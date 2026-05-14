# 🎣 Grudge Fishing

A **Grudge Studio Forge** 3D fishing game built with Three.js, powered by Cloudflare D1 + R2.

**🌐 Play Now**: [grudge-fishing-game.vercel.app](https://grudge-fishing-game.vercel.app)

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

## Balance — Playtest Results (v2)

Playtested on 2026-05-14 with 70+ API casts across all rod tiers.

### Rarity Distribution

**v1 (BROKEN)**: T5 rod at level 30 gave ~40% legendary. Way too generous.

**v2 (FIXED)**: Luck is now capped at 0.5 total, with much smaller scaling multipliers.

| Scenario | Common | Uncommon | Rare | Epic | Legendary |
|----------|--------|----------|------|------|-----------|
| T1 rod, Level 1 (luck=0) | ~60% | ~25% | ~10% | ~4% | ~1% |
| T3 rod, Level 10 (luck≈0.13) | ~50% | ~27% | ~13% | ~7% | ~3% |
| T5 rod, Level 30 (luck≈0.45) | ~37% | ~25% | ~18% | ~12% | ~8% |
| T5 + Golden Lure, Level 35 (luck=0.50 cap) | ~35% | ~24% | ~19% | ~13% | ~9% |

### Bite Timing

- **T1 rod**: 4–19 seconds (reel_speed=0.8, wide variance intentional)
- **T5 rod**: 1.5–7.5 seconds (reel_speed=2.0, endgame feels fast)
- **Sweet spot**: T3 at 2.5–12 seconds — most engaging wait

### Tension Minigame

- **Common fish (difficulty 0.2–0.5)**: Easy to reel, ~7 seconds to catch
- **Rare fish (difficulty 0.6–0.8)**: Requires active pumping every 1–2 seconds
- **Legendary (difficulty 1.0)**: Reel window is only 2 seconds, tension swings violently — genuinely challenging
- **Fail threshold**: tension < 0.05 or > 0.95 → line snaps
- **Green zone**: 0.3–0.7 — only progresses reel when marker is inside

### Known Balance Notes

1. **Deep biome legendaries are limited**: Only Shark (lvl 30), Goblin Shark (lvl 35), Anglerfish (lvl 35). Players under level 35 will only ever hook Shark as legendary in deep water.
2. **Weight bell curve**: Uses average-of-3-random (central limit theorem) — most weights cluster near median, records require extreme rolls.
3. **XP progression**: Level auto-advances every 5 catches (player_level = 1 + catches/5). Consider adding a proper XP curve.
4. **Gold economy**: No spend sinks yet — gold accumulates with no use. Needs rod/lure shop.

## Roadmap — ThreeNodes.js Integration

[ThreeNodes.js](https://github.com/idflood/ThreeNodes.js) (vvvv clone for Three.js) will be integrated for:

### Game Mechanics Nodes
- **Fish Behavior Node** — visual graph for swim patterns (speed, amplitude, depth, aggression)
- **Rod Stats Node** — drag-and-drop stat tuning (cast_range, reel_speed, luck_bonus) with live preview
- **Rarity Roll Node** — visual probability editor with live distribution histogram
- **Tension Curve Node** — graph editor for fish pull patterns per species (sine frequency, random amplitude, difficulty scaling)
- **Bite Timer Node** — visual min/max range editor with rod speed multiplier preview

### Game Tier Nodes
- **Tier Pipeline Node** — visual T1→T8 material cost escalation editor
- **Level Gate Node** — connect species → minimum level → rod tier requirements
- **Biome Router Node** — visual routing of fish species to biome spawn pools
- **Loot Table Node** — weighted drop table editor with rarity + biome + depth filters

### Database Prefab Nodes
- **Fish Species Prefab** — node that outputs a complete D1 INSERT row from visual inputs (model_key, rarity, biome, weight range, XP, gold)
- **Rod Prefab** — visual rod builder that exports D1-ready JSON
- **Lure Prefab** — biome targeting + durability + rarity bonus editor
- **Batch Export Node** — outputs SQL seed file from all connected prefab nodes
- **R2 Asset Linker Node** — auto-generates model_url from model_key + R2 base path

### Architecture
```
ThreeNodes.js Editor
  ↓ exports JSON prefab definitions
CF Worker (grudge-fishing-api)
  ↓ reads prefabs from D1
Game Client (grudge-fishing-game)
  ↓ loads fish/rod/lure data from API
  ↓ loads GLB models from R2 CDN
```

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
