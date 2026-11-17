# Solmar

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ItsSuperMeow/solmar/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ItsSuperMeow/solmar/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar is an original open-world crime game for the make.fun GTA 6 bounty: a
sun-soaked coastal city to explore on foot and by car, with traffic,
pedestrians, a wanted level and police who chase you, five story missions,
combat, and a HUD with a minimap. Play it in a desktop browser from static
files — no network needed.

## The game

You are Rio, a driver for the Solmar crew. Mara, the crew boss, has five jobs
for you: steal a car, run a package, lose the heat, make a timed delivery, and
pull off the final heist. The city is yours to explore — an 8x8-block grid with
a beach, a pier and a central plaza — on foot or behind the wheel of any car
you can steal.

- **On foot:** WASD to move, Shift to run, Space to jump, F to punch, click
  to shoot the pistol, R to reload.
- **Driving:** press E near a car to steal it, WASD to drive, Space for the
  handbrake, E again to get out.
- **Wanted level:** stealing, hitting pedestrians and shooting raise your
  stars from 0 to 5. Police officers and pursuit cars respond; stay clean for
  30 seconds to lose the heat.
- **Missions:** five jobs in order, each with a 3D beacon, a minimap marker
  and a cash reward. Your money, progress and position save to localStorage.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## How it is built

Three.js (vendored as `game/vendor/three.min.js`) renders the city; the rest
is plain JavaScript split into files with one clear job each:

- `game/js/city.js` — the procedural city: streets, buildings, beach, pier
- `game/js/player.js` — Rio on foot: movement, jumping, punching
- `game/js/vehicles.js` — cars, lane traffic, stealing and arcade driving
- `game/js/pedestrians.js` — sidewalk walkers who flee from danger
- `game/js/police.js` — the wanted level, foot officers, pursuit cars
- `game/js/combat.js` — pistol shooting, raycast hits, muzzle flash, ammo
- `game/js/missions.js` — the five story jobs, beacons and rewards
- `game/js/hud.js` — health, money, wanted stars, minimap, objectives
- `game/js/audio.js` — procedural WebAudio sounds (engine, siren, gunshots)
- `game/js/save.js` — localStorage saves
- `game/js/main.js` — init, game loop, camera, input, start screen

Everything in the game — the city, the characters, the vehicles, the names,
the story, the art and the sounds — is original, made for this entry. Nothing
is taken from any commercial game.

## Screenshots

Take them with Playwright against the served game, staging each scene with
the `?shot=` query parameter: `street`, `drive`, `chase`, `mission`.
