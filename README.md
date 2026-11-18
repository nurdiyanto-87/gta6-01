# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/nurdiyanto-87/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/nurdiyanto-87/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**San Cielo Heat** — an original open-world crime game in the spirit of GTA 6, built for make.fun's "Make GTA 6" bounty. Explore the sun-soaked city of San Cielo on foot and by car: steal from 9 vehicle types, weave through lane-following traffic and sidewalk pedestrians, earn wanted stars and outrun the SCPD (or pay for a respray), fight armed goons with fists, pistol and SMG, and run a 6-mission story arc for Ram — plus repeatable courier jobs, a live minimap, saves, and fully procedural WebAudio sound. Vanilla JavaScript + Canvas 2D, zero libraries, zero network requests. Every name, character, vehicle, street and sound is original.

## Run it

```sh
node --experimental-strip-types -e "const h=require('node:http'),f=require('node:fs'),p=require('node:path');h.createServer((q,s)=>{let fp=p.join('game',q.url==='/'?'index.html':q.url.split('?')[0]);f.readFile(fp,(e,d)=>{if(e){s.writeHead(404);s.end()}else{s.writeHead(200,{'Content-Type':fp.endsWith('.js')?'text/javascript':fp.endsWith('.css')?'text/css':'text/html'});s.end(d)}})}).listen(8080)"
```

Then open http://localhost:8080 — or serve `game/` with any static file server.

Controls: WASD walk/drive · Shift run · Space handbrake · Mouse aim · Click shoot · E enter/exit car & start jobs · 1/2/3 weapons · P pause · M mute · F save.

---

<sub>Entered on [make.fun](https://make.fun/?ref=silver-quasar-79&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
