local function rollBreak()
    return math.random() < Config.BreakChance
end

----------------------------------------------------------------------
-- qb-inventory
----------------------------------------------------------------------

local function getQBCore()
    local ok, core = pcall(function()
        return exports['qb-core']:GetCoreObject()
    end)

    if ok then return core end
    return nil
end

local qbRegistered = false

local function registerQBItem()
    if qbRegistered then return end

    local QBCore = getQBCore()
    if not QBCore then return end

    QBCore.Functions.CreateUseableItem('lockpick', function(source, item)
        TriggerClientEvent('robins-lockpick:client:use', source)
    end)

    qbRegistered = true
end

local function handleQBResult(src, success)
    local QBCore = getQBCore()
    if not QBCore then return end

    local Player = QBCore.Functions.GetPlayer(src)
    if not Player then return end

    if not success and rollBreak() then
        Player.Functions.RemoveItem('lockpick', 1)
        TriggerClientEvent('inventory:client:ItemBox', src, QBCore.Shared.Items['lockpick'], 'remove')
        TriggerClientEvent('QBCore:Notify', src, 'Your lockpick broke.', 'error')
    end
end

if Config.Inventory == 'qb' then
    CreateThread(function()
        -- qb-core may not be fully ready the instant this resource starts
        for _ = 1, 50 do
            if qbRegistered then return end
            registerQBItem()
            Wait(200)
        end
    end)

    -- in case qb-core/qbx_core is (re)started after this resource
    AddEventHandler('onResourceStart', function(resourceName)
        if resourceName == 'qb-core' or resourceName == 'qbx_core' then
            registerQBItem()
        end
    end)

    RegisterNetEvent('robins-lockpick:server:result', function(success)
        handleQBResult(source, success)
    end)
end

----------------------------------------------------------------------
-- ox_inventory
----------------------------------------------------------------------

local function handleOxResult(src, success)
    if success or not rollBreak() then return end

    exports.ox_inventory:RemoveItem(src, 'lockpick', 1)
    TriggerClientEvent('ox_lib:notify', src, { type = 'error', description = 'Your lockpick broke.' })
end

if Config.Inventory == 'ox' then
    RegisterNetEvent('robins-lockpick:server:result', function(success)
        handleOxResult(source, success)
    end)
end
