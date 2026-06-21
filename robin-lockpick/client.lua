--[[
    robins-lockpick

    exports['robins-lockpick']:StartLockpick(opts, callback)

    opts = {
        difficulty = 1-10   (default 5)
        circles    = number of circles (default 5)
        title      = string shown above the circles
    }

    callback(success: boolean)

    Test command: /testlockpick [circles] [difficulty]
]]

local isLockpickActive = false

-- difficulty -> ring shrink time (ms) and hit window (ms)
local function getDifficultyParams(difficulty)
    difficulty = math.max(1, math.min(10, difficulty or 5))
    local shrinkTime = 2400 - (difficulty - 1) * 220  -- 2400ms @1 -> 420ms @10
    local hitWindow = 220 - (difficulty - 1) * 21      -- 220ms @1  ->  31ms @10
    return shrinkTime, hitWindow
end

local function StartLockpick(opts, cb)
    if isLockpickActive then
        if cb then cb(false) end
        return
    end

    opts = opts or {}
    local difficulty = opts.difficulty or 5
    local circleCount = opts.circles or 5
    local title = opts.title or "Picking lock..."

    local shrinkTime, hitWindow = getDifficultyParams(difficulty)

    isLockpickActive = true
    SetNuiFocus(true, true)

    SendNUIMessage({
        action = "startGame",
        circleCount = circleCount,
        shrinkTime = shrinkTime,
        hitWindow = hitWindow,
        title = title
    })

    CreateThread(function()
        local p = promise.new()

        RegisterNUICallback('lockpickResult', function(data, nuiCb)
            nuiCb('ok')
            isLockpickActive = false
            SetNuiFocus(false, false)
            p:resolve(data.success == true)
        end)

        local success = Citizen.Await(p)
        if cb then cb(success) end
    end)
end

exports('StartLockpick', StartLockpick)

-- lets the NUI release focus on cancel (e.g. ESC)
RegisterNUICallback('closeUI', function(data, cb)
    isLockpickActive = false
    SetNuiFocus(false, false)
    cb('ok')
end)

RegisterCommand('testlockpick', function(source, args)
    local circles = tonumber(args[1]) or 5
    local difficulty = tonumber(args[2]) or 5

    StartLockpick({ circles = circles, difficulty = difficulty, title = "Test Lockpick" }, function(success)
        if success then
            TriggerEvent('chat:addMessage', { args = { '^2[Lockpick]', 'Success!' } })
        else
            TriggerEvent('chat:addMessage', { args = { '^1[Lockpick]', 'Failed.' } })
        end
    end)
end, false)
