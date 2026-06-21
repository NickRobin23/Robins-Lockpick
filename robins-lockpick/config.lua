Config = {}

-- Which inventory system to integrate the "lockpick" item with.
-- Options: 'qb'   -> qb-inventory / qbx_core
--          'ox'   -> ox_inventory
--          'none' -> no item integration, use the export directly
Config.Inventory = 'none'

-- Chance (0.0 - 1.0) that the lockpick breaks and is removed from the
-- player's inventory when the minigame is FAILED. On success the lockpick is never removed.
Config.BreakChance = 0.25 -- = 25%

-- Difficulty/circle count used when the player uses the "lockpick" item
-- (not used by direct exports.StartLockpick calls from your own scripts)
Config.ItemDifficulty = 5
Config.ItemCircles = 5
