(function () {
    'use strict';

    // true when running inside FiveM's NUI, false in a plain browser tab
    const isFiveM = typeof GetParentResourceName === 'function';

    const gameEl = document.getElementById('game');
    const devPanel = document.getElementById('devPanel');
    const devResult = document.getElementById('devResult');
    const cursorReticle = document.getElementById('cursorReticle');

    let state = null; // current game state, null when idle

    // keep the reticle following the mouse smoothly, but only ever
    // visible while a game is actually running
    document.addEventListener('mousemove', (e) => {
        cursorReticle.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
    });

    // sends a result back to client.lua (no-op log when running standalone)
    function postToLua(eventName, data) {
        if (!isFiveM) {
            console.log('[standalone] would POST to Lua:', eventName, data);
            return Promise.resolve({ ok: true });
        }

        const resourceName = GetParentResourceName();
        return fetch(`https://${resourceName}/${eventName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=UTF-8' },
            body: JSON.stringify(data || {})
        }).catch((err) => {
            console.error('NUI callback failed:', err);
        });
    }

    function reportResult(success) {
        postToLua('lockpickResult', { success: success });
    }

    const CIRCLE_SIZE = 100;          // px, matches CSS .targetCircle / .approachRing
    const APPROACH_START_SCALE = 2.4; // ring starting size, as a multiple of CIRCLE_SIZE
    const EDGE_PADDING = 110;         // keep circles off the extreme edges/HUD
    const RIGHT_ZONE_START = 0.55;    // circles only spawn from this % of screen width onward
    const STAGGER_RATIO = 0.45;       // new circle spawns after this fraction of shrinkTime, so several overlap on screen at once

    function randomPosition(avoid) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const topSafe = 110;
        const minSeparation = CIRCLE_SIZE * 1.4; // keep simultaneous circles from overlapping

        const zoneLeft = Math.max(EDGE_PADDING, w * RIGHT_ZONE_START);
        const zoneRight = w - EDGE_PADDING;

        for (let attempt = 0; attempt < 20; attempt++) {
            const x = zoneLeft + Math.random() * Math.max(0, zoneRight - zoneLeft);
            const y = topSafe + Math.random() * (h - topSafe - EDGE_PADDING);

            const tooClose = (avoid || []).some((p) => {
                const dx = x - p.x;
                const dy = y - p.y;
                return Math.sqrt(dx * dx + dy * dy) < minSeparation;
            });

            if (!tooClose) return { x, y };
        }

        // fallback: couldn't find a clear spot after enough tries, just use the last one
        const x = zoneLeft + Math.random() * Math.max(0, zoneRight - zoneLeft);
        const y = topSafe + Math.random() * (h - topSafe - EDGE_PADDING);
        return { x, y };
    }

    function clearBoard() {
        gameEl.innerHTML = '';
    }

    function endGame(success) {
        if (state) {
            clearTimeout(state.spawnTimer);
            state.activeCircles.forEach((c) => clearTimeout(c.missTimer));
        }
        state = null;
        clearBoard();
        reportResult(success);

        document.body.classList.remove('game-active');
        cursorReticle.classList.remove('visible');

        if (!isFiveM) {
            devResult.textContent = success ? 'Result: SUCCESS' : 'Result: FAIL';
            devResult.style.color = success ? '#5dffa0' : '#ff6b6b';
        }
    }

    function spawnCircle(index, total) {
        if (!state || state.gameOver) return;

        // schedule the next circle to appear before this one even resolves,
        // so several are visible on screen at once with staggered timings
        if (index + 1 < total) {
            state.spawnTimer = setTimeout(() => {
                spawnCircle(index + 1, total);
            }, state.shrinkTime * STAGGER_RATIO);
        }

        const pos = randomPosition(state.activeCircles.map((c) => c.pos));

        const wrap = document.createElement('div');
        wrap.className = 'circleWrap';
        wrap.style.left = pos.x + 'px';
        wrap.style.top = pos.y + 'px';

        const target = document.createElement('div');
        target.className = 'targetCircle';
        const order = document.createElement('div');
        order.className = 'order';
        order.textContent = (index + 1);
        target.appendChild(order);

        const ring = document.createElement('div');
        ring.className = 'approachRing';
        ring.style.transition = 'none';
        ring.style.width = (CIRCLE_SIZE * APPROACH_START_SCALE) + 'px';
        ring.style.height = (CIRCLE_SIZE * APPROACH_START_SCALE) + 'px';

        wrap.appendChild(target);
        wrap.appendChild(ring);
        gameEl.appendChild(wrap);

        // force layout so the start size/opacity is committed before
        // transitioning, otherwise the first circle can snap instead of animate
        ring.offsetWidth;

        wrap.classList.add('visible'); // fade in

        ring.style.transition = `width ${state.shrinkTime}ms linear, height ${state.shrinkTime}ms linear`;
        ring.style.width = CIRCLE_SIZE + 'px';
        ring.style.height = CIRCLE_SIZE + 'px';

        const spawnTime = performance.now();
        const perfectTime = spawnTime + state.shrinkTime;

        const circleData = {
            wrap, target, ring, pos,
            perfectTime,
            resolved: false
        };

        state.activeCircles.push(circleData);

        // fail once the post-closure grace period has fully elapsed without
        // a click — matches CLOSED_GRACE_MS in handleGlobalClick plus a
        // small buffer so it never races a click landing right at the edge
        circleData.missTimer = setTimeout(() => {
            if (!circleData.resolved) {
                resolveCircle(circleData, false);
            }
        }, state.shrinkTime + 550);
    }

    const MISS_HOLD_MS = 1500; // how long the red outline stays before the game ends

    function resolveCircle(circleData, success) {
        if (circleData.resolved || !state) return;
        circleData.resolved = true;
        clearTimeout(circleData.missTimer);

        const idx = state.activeCircles.indexOf(circleData);
        if (idx !== -1) state.activeCircles.splice(idx, 1);

        circleData.wrap.classList.add(success ? 'hit' : 'miss');

        if (!success) {
            // freeze the game immediately: no more spawns, no more clicks
            // register, while the red outline holds before teardown
            state.gameOver = true;
            clearTimeout(state.spawnTimer);
            setTimeout(() => endGame(false), MISS_HOLD_MS);
            return;
        }

        setTimeout(() => {
            if (circleData.wrap.parentNode) {
                circleData.wrap.parentNode.removeChild(circleData.wrap);
            }
        }, 260);

        state.completed += 1;

        if (state.completed >= state.totalCircles) {
            endGame(true);
        }
    }

    function handleGlobalClick(e) {
        if (!state || state.gameOver || state.activeCircles.length === 0) return;
        if (e.target.closest && e.target.closest('#devPanel')) return;

        const clickX = e.clientX;
        const clickY = e.clientY;
        const clickRadius = CIRCLE_SIZE / 2; // must land within the visible target circle

        // find the closest active circle whose target circle is actually under the click
        let best = null;
        let bestDist = Infinity;

        for (const circleData of state.activeCircles) {
            const dx = clickX - circleData.pos.x;
            const dy = clickY - circleData.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= clickRadius && dist < bestDist) {
                best = circleData;
                bestDist = dist;
            }
        }

        if (!best) return; // clicked empty space, no circle affected

        // Read the ring's actual current rendered size instead of trusting
        // a separate JS timer for the "still closing" case — this avoids
        // clock-vs-paint drift right at the perfect moment.
        const ringRect = best.ring.getBoundingClientRect();
        const ringSize = ringRect.width;
        const remaining = ringSize - CIRCLE_SIZE; // px still left to shrink

        if (remaining > 0) {
            // ring hasn't finished closing yet — judge by the hit window in px
            const totalShrinkPx = (CIRCLE_SIZE * APPROACH_START_SCALE) - CIRCLE_SIZE;
            const pxPerMs = totalShrinkPx / state.shrinkTime;
            const windowPx = state.hitWindow * pxPerMs;

            resolveCircle(best, remaining <= windowPx);
            return;
        }

        // ring has already fully closed — clicks within this window after
        // closure still count as a perfect hit
        const msSinceClosed = performance.now() - best.perfectTime;
        const CLOSED_GRACE_MS = 500;
        resolveCircle(best, msSinceClosed <= CLOSED_GRACE_MS);
    }

    function handleGlobalKey(e) {
        if (e.key === 'Escape') {
            if (state) {
                endGame(false);
            }
            postToLua('closeUI', {});
        }
    }

    function startGame(opts) {
        clearBoard();

        const circleCount = Math.max(1, parseInt(opts.circleCount, 10) || 5);
        const shrinkTime = Math.max(150, parseInt(opts.shrinkTime, 10) || 1200);
        const hitWindow = Math.max(20, parseInt(opts.hitWindow, 10) || 180);

        state = {
            totalCircles: circleCount,
            completed: 0,
            shrinkTime,
            hitWindow,
            activeCircles: [],
            spawnTimer: null
        };

        document.body.classList.add('game-active');
        cursorReticle.classList.add('visible');

        spawnCircle(0, circleCount);
    }

    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('keydown', handleGlobalKey);

    // receives SendNUIMessage(...) calls from client.lua
    window.addEventListener('message', (event) => {
        const data = event.data;
        if (!data || !data.action) return;

        if (data.action === 'startGame') {
            startGame(data);
        }
    });

    // browser-only test panel, hidden automatically inside FiveM
    if (!isFiveM) {
        document.body.classList.add('standalone-preview');
        devPanel.style.display = 'block';

        document.getElementById('devStart').addEventListener('click', () => {
            const circles = parseInt(document.getElementById('devCircles').value, 10) || 5;
            const difficulty = Math.max(1, Math.min(10, parseInt(document.getElementById('devDifficulty').value, 10) || 5));

            // mirrors the difficulty curve in client.lua
            const shrinkTime = 2400 - (difficulty - 1) * 220;
            const hitWindow = 220 - (difficulty - 1) * 21;

            devResult.textContent = '';
            window.postMessage({
                action: 'startGame',
                circleCount: circles,
                shrinkTime: shrinkTime,
                hitWindow: hitWindow,
                title: 'Test Lockpick'
            }, '*');
        });
    }
})();
