(function () {
    'use strict';

    // true when running inside FiveM's NUI, false in a plain browser tab
    const isFiveM = typeof GetParentResourceName === 'function';

    const gameEl = document.getElementById('game');
    const devPanel = document.getElementById('devPanel');
    const devResult = document.getElementById('devResult');

    let state = null; // current game state, null when idle

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

    function randomPosition() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const topSafe = 110;

        const zoneLeft = Math.max(EDGE_PADDING, w * RIGHT_ZONE_START);
        const zoneRight = w - EDGE_PADDING;

        const x = zoneLeft + Math.random() * Math.max(0, zoneRight - zoneLeft);
        const y = topSafe + Math.random() * (h - topSafe - EDGE_PADDING);
        return { x, y };
    }

    function clearBoard() {
        gameEl.innerHTML = '';
    }

    function endGame(success) {
        state = null;
        clearBoard();
        reportResult(success);

        if (!isFiveM) {
            devResult.textContent = success ? 'Result: SUCCESS' : 'Result: FAIL';
            devResult.style.color = success ? '#5dffa0' : '#ff6b6b';
        }
    }

    function spawnCircle(index, total) {
        if (!state) return;

        const pos = randomPosition();

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
            wrap, target, ring,
            pos,
            perfectTime,
            resolved: false
        };

        state.activeCircle = circleData;

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

        circleData.wrap.classList.add(success ? 'hit' : 'miss');

        if (!success) {
            // hold the red outline for a beat before ending the game
            setTimeout(() => endGame(false), MISS_HOLD_MS);
            return;
        }

        setTimeout(() => {
            if (circleData.wrap.parentNode) {
                circleData.wrap.parentNode.removeChild(circleData.wrap);
            }
        }, 260);

        state.completed += 1;
        state.activeCircle = null;

        if (state.completed >= state.totalCircles) {
            endGame(true);
        } else {
            spawnCircle(state.completed, state.totalCircles);
        }
    }

    function handleGlobalClick(e) {
        if (!state || !state.activeCircle) return;
        if (e.target.closest && e.target.closest('#devPanel')) return;

        const circleData = state.activeCircle;

        // Read the ring's actual current rendered size instead of trusting
        // a separate JS timer for the "still closing" case — this avoids
        // clock-vs-paint drift right at the perfect moment.
        const ringRect = circleData.ring.getBoundingClientRect();
        const ringSize = ringRect.width;
        const remaining = ringSize - CIRCLE_SIZE; // px still left to shrink

        if (remaining > 0) {
            // ring hasn't finished closing yet — judge by the hit window in px
            const totalShrinkPx = (CIRCLE_SIZE * APPROACH_START_SCALE) - CIRCLE_SIZE;
            const pxPerMs = totalShrinkPx / state.shrinkTime;
            const windowPx = state.hitWindow * pxPerMs;

            resolveCircle(circleData, remaining <= windowPx);
            return;
        }

        // ring has already fully closed — clicks within this window after
        // closure still count as a perfect hit
        const msSinceClosed = performance.now() - circleData.perfectTime;
        const CLOSED_GRACE_MS = 500;
        resolveCircle(circleData, msSinceClosed <= CLOSED_GRACE_MS);
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
            activeCircle: null
        };

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
