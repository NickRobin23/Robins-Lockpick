# robins-lockpick

An osu!-style lockpicking minigame for FiveM. Circles appear one at a time with a shrinking approach ring around them — click when the ring closes in on the circle to land a hit. Miss the timing and the circle flashes red before the attempt fails.

![difficulty](https://img.shields.io/badge/difficulty-1--10-8fef3e) ![fivem](https://img.shields.io/badge/FiveM-resource-blue)

## Features

- Approach-ring timing mechanic, similar to osu!'s clicking gameplay
- Adjustable difficulty (1–10) and circle count per call
- Transparent background - renders only the circles over the game world, nothing else
- Works standalone in a browser for quick UI testing, with no FiveM client needed

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
├── client.lua          -- export, difficulty curve, NUI lifecycle
└── html/
    ├── index.html
    ├── style.css        -- circle/ring styling, transparent background
    └── script.js        -- game loop, timing logic, hit detection
```

## License

MIT
