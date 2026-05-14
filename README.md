# 🎣 Grudge Fishing

A **Grudge Studio Forge** 3D fishing game built with Three.js, powered by Cloudflare D1 + R2.

## Features

- **Procedural Island** — heightfield terrain with palm trees, rocks, and sandy beaches
- **Animated Water Shader** — Shadertoy caustics, wave displacement, foam edges, deep/shallow gradient
- **35 Fish Species** — common → legendary, stored in Cloudflare D1 with biome/depth/weight mechanics
- **5 Tiered Fishing Rods** — Driftwood (T1) → Leviathan (T5) with luck/speed bonuses
- **6 Lures** — biome-targeted with rarity bonuses
- **Tension Minigame** — keep the marker in the green zone to reel in your catch
- **Dock + Fishing Assets** — 52 GLB models from R2 CDN (fish, rods, lures, dock, boat)
- **Grudge6 Characters** — human, barbarian, elf, dwarf, orc, undead selectable
- **Ambient Swimming Fish** — loaded from API, animated swim paths
- **Catch Notifications** — rarity-colored popups with XP/gold/weight/personal records
- **Live Leaderboard** — D1-backed catch records and global leaderboard

## Tech Stack

- **Frontend**: Vite + Three.js (vanilla JS)
- **Backend**: Cloudflare Worker + D1 (SQLite) + R2 (object storage)
- **API**: `grudge-fishing-api.grudge.workers.dev`
- **Assets**: `assets.grudge-studio.com/models/fishing/`
- **Deployment**: Vercel

## Controls

| Key | Action |
|-----|--------|
| **F** | Cast line |
| **R** | Start reel / pump reel |
| **Esc** | Cancel / retract line |
| **Click** | Pump reel (during minigame) |
| **Orbit** | Mouse drag to rotate camera |

## API Endpoints

- `GET /api/fishing/species` — list fish (filter by `?rarity=` or `?biome=`)
- `GET /api/fishing/rods` — list rods (filter by `?tier=`)
- `POST /api/fishing/cast` — roll a fish bite
- `POST /api/fishing/catch` — record a catch
- `GET /api/fishing/records/:playerId` — player catch records
- `GET /api/fishing/leaderboard` — global heaviest catches

## Development

```bash
npm install
npm run dev
```

## Deployment

Push to `main` → auto-deploys on Vercel.

---

Created by **Racalvin The Pirate King** · [Grudge Studio](https://grudge-studio.com)
