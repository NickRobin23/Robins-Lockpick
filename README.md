# robins-lockpick

An osu!-style lockpicking minigame for FiveM. Circles appear one at a time with a shrinking approach ring around them — click when the ring closes in on the circle to land a hit. Miss the timing and the circle flashes red before the attempt fails.

![difficulty](https://img.shields.io/badge/difficulty-1--10-8fef3e) ![fivem](https://img.shields.io/badge/FiveM-resource-blue)

## Features

- Approach-ring timing mechanic, similar to osu!'s clicking gameplay
- Adjustable difficulty (1–10) and circle count per call
- Plays a real lockpicking animation on the player for the duration of the minigame, stopping automatically on success, failure, or cancel
- Optional "lockpick" item support for **ox_inventory** or **qb-inventory/qbx_core**, picked via `config.lua`
- Configurable chance for the lockpick to break (and be removed) on a failed attempt — never removed on success
- Transparent background — renders only the circles over the game world, nothing else
- Works standalone in a browser for quick UI testing, with no FiveM client needed

## Preview
<p align="center">
  <img src="[.github/preview.png](https://cdn.discordapp.com/attachments/696092449323483167/1518342355684425959/Screenshot_2026-06-21_at_3.50.09_PM.png?ex=6a399203&is=6a384083&hm=bd5b6d58d94400562791368d080055cd120c6be46619f297cbab1712a9e321e5&)" width="600" alt="Lockpick minigame preview">
</p>

## Installation

1. Download or clone this repository into your server's `resources` directory.
2. Add the following to your `server.cfg`:

   ```
   ensure robins-lockpick
   ```

## Usage

Call it from any other client-side script using the export:

```lua
exports['robins-lockpick']:StartLockpick({
    difficulty = 7,   -- 1 (easiest) to 10 (hardest), default 5
    circles = 6        -- number of circles in the sequence, default 5
}, function(success)
    if success then
        -- lock picked, e.g. unlock the door/vehicle
    else
        -- failed, e.g. start a cooldown or alert nearby police
    end
end)
```

### Parameters

| Option | Type | Default | Description |
|---|---|---|---|
| `difficulty` | number (1–10) | `5` | Higher values shrink the approach ring faster and shrink the timing window. |
| `circles` | number | `5` | How many circles must be hit in sequence to succeed. |

### Difficulty reference

| Difficulty | Ring shrink time | Hit window |
|---|---|---|
| 1 | 2400ms | 220ms |
| 3 | 1960ms | 178ms |
| 5 | 1520ms | 136ms |
| 7 | 1080ms | 94ms |
| 10 | 420ms | 31ms |

A hit is valid from the start of the hit window up until **0.5 seconds** after the ring fully closes. Anything later is a miss.

## Inventory integration ("lockpick" item)

Open `config.lua` and set which inventory you're using:

```lua
Config.Inventory = 'qb'    -- 'qb', 'ox', or 'none'
Config.BreakChance = 0.25  -- chance the lockpick breaks on a FAILED attempt
Config.ItemDifficulty = 5  -- difficulty used when the item is used
Config.ItemCircles = 5     -- circle count used when the item is used
```

The lockpick is **never** removed on a successful pick. On a failed pick, there's a `Config.BreakChance` chance (25% by default) that it breaks and is removed from the player's inventory — otherwise they keep it and can try again.

You still need to register the `lockpick` item itself in your inventory's own item file — this resource only handles the use logic and break chance, not item registration.

### ox_inventory

Set `Config.Inventory = 'ox'`, then add to `ox_inventory/data/items.lua`:

```lua
['lockpick'] = {
    label = 'Lockpick',
    weight = 100,
    stack = true,
    close = true,
    consume = 0,
    client = {
        export = 'robins-lockpick.UseLockpickItem',
    },
},
```

`consume = 0` is important — this resource handles removing the item itself (only on a failed break roll), so ox_inventory shouldn't auto-consume it on every use.

### qb-inventory / qbx_core

Set `Config.Inventory = 'qb'`, then add to `qb-core/shared/items.lua` (or your QBox items config):

```lua
['lockpick'] = {
    ['name'] = 'lockpick',
    ['label'] = 'Lockpick',
    ['weight'] = 100,
    ['type'] = 'item',
    ['image'] = 'lockpick.png',
    ['unique'] = false,
    ['useable'] = true,
    ['shouldClose'] = true,
    ['description'] = 'A set of tools for picking locks',
},
```

This resource registers `lockpick` as a usable item automatically and only removes it from the player's inventory if the break roll hits on a failed attempt.

## Testing

A chat command is included for quick in-game testing:

```
/testlockpick [circles] [difficulty]
```

Example: `/testlockpick 6 8` starts a 6-circle lockpick at difficulty 8.

You can also open `html/index.html` directly in a browser (no FiveM required) to preview and test the UI. A small panel in the bottom-left lets you set circle count and difficulty and run the game with mouse clicks.

## File structure

```
robins-lockpick/
├── fxmanifest.lua
├── config.lua           -- inventory choice, break chance, item difficulty
├── client.lua            -- export, difficulty curve, NUI lifecycle, anim, inventory hooks
├── server.lua            -- item registration + break-on-fail logic
└── html/
    ├── index.html
    ├── style.css        -- circle/ring styling, transparent background
    └── script.js        -- game loop, timing logic, hit detection
```

## License

MIT
