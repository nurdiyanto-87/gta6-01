# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/nurdiyanto-87/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/nurdiyanto-87/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar Heat** — an original open-world crime game set in the sun-soaked city of Port Solmar. Leo Marsh arrives broke and works his way up from a favour at Rosa's Diner to breaking Victor Kroll's grip on the city, across six story missions plus repeatable courier jobs.

What is in the game:

- A 3200×3200 explorable city with five districts, eight named landmarks, a beach, a pier and a central park — the same fixed-seed city every run
- On foot and by car: walk, sprint, steal any of nine vehicle types and drive with arcade physics, handbrake slides and damage smoke
- Living streets: traffic that cruises the grid and brakes for what is ahead, and pedestrians who stroll, wait and flee
- A five-star wanted system: pursuing interceptors that ram and box you in, roadblocks at three stars, evasion by breaking line of sight, and a paid repaint at the garage to go clean
- Combat with three weapons (pistol, SMG, shotgun), projectiles with travel and range, enemies who close in, strafe and shoot, and pickups for health, armour, ammo and hidden cash stashes
- A HUD with health/armour bars, cash, wanted stars, weapon and ammo, an objective banner, an off-screen objective arrow and a live minimap
- A title screen, pause menu, how-to-play screen and localStorage saves (after every job and at the safehouse)
- Fully procedural WebAudio sound: synth gunshots, engine hum, siren, and an original chord-loop melody — no audio files

No libraries, no engine, no network requests: vanilla JavaScript and Canvas 2D, split into one-job modules under `game/src/`. Everything — the city, characters, vehicles, names, story, art and sounds — is original to this game.

## Run it

```sh
python3 -m http.server 8080 --directory game
# then open http://localhost:8080 in desktop Chrome
```

Keyboard and mouse: WASD move/drive, mouse aim, click shoot, F enter/exit car, E interact, R reload, 1/2/3 weapons, Space handbrake, Esc pause, M mute.

---

<sub>Entered on [make.fun](https://make.fun/?ref=silver-quasar-79&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
