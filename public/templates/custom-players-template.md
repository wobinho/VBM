# Custom Players JSON — schema reference

Drop this JSON into the **Custom Save → Players** step's "Import JSON" button, or use it as the spec when writing a tool that generates rosters.

## Accepted top-level shapes

The importer accepts either form:

```json
{ "players": [ { ... }, { ... } ] }
```

or a bare array:

```json
[ { ... }, { ... } ]
```

Any other top-level keys (like `$schema`, `note`, `fields`) are ignored — the template file ships with them so the file is self-documenting.

## Per-player fields

| Field            | Type    | Range / values                                                                                       | Required |
|------------------|---------|------------------------------------------------------------------------------------------------------|----------|
| `player_name`    | string  | non-empty                                                                                            | yes      |
| `position`       | string  | `Outside Hitter`, `Middle Blocker`, `Opposite Hitter`, `Setter`, `Libero`                            | yes      |
| `age`            | int     | 14–60                                                                                                | yes      |
| `country`        | string  | free-form nationality, e.g. `"Italy"`                                                                | yes      |
| `jersey_number`  | int     | 1–99                                                                                                 | yes      |
| `height`         | int     | 140–230 (cm)                                                                                         | yes      |
| `potential`      | int     | 1–99 — overall is capped at this value as the player grows                                           | yes      |
| `contract_years` | int     | 1–10                                                                                                 | yes      |
| `monthly_wage`   | int     | ≥ 0                                                                                                  | yes      |
| `player_value`   | int     | ≥ 0                                                                                                  | yes      |
| 30 stat fields   | int     | each 1–100 — see below                                                                               | yes      |

> `overall` is **not** in the file. It is computed at seed time from the stats + position using the same formula the rest of the game uses.

## The 30 stat fields (all required, all integers 1–100)

**Skill (6)** — `attack`, `defense`, `serve`, `block`, `receive`, `setting`

**Technical (8)** — `precision`, `flair`, `digging`, `positioning`, `ball_control`, `technique`, `playmaking`, `spin`

**Physical (8)** — `speed`, `agility`, `strength`, `endurance`, `vertical`, `flexibility`, `torque`, `balance`

**Mental (8)** — `leadership`, `teamwork`, `concentration`, `pressure`, `consistency`, `vision`, `game_iq`, `intimidation`

## Pool quota — why your file might be too small

The fantasy draft assigns **7 players per team** with this make-up:

| Position         | Per team |
|------------------|----------|
| Outside Hitter   | 2        |
| Middle Blocker   | 2        |
| Opposite Hitter  | 1        |
| Setter           | 1        |
| Libero           | 1        |

So for a save with `T` teams, the pool **must contain at least** `2T` Outside Hitters, `2T` Middle Blockers, `T` Opposite Hitters, `T` Setters, and `T` Liberos. The wizard's quota panel shows the live counts so you can see what's missing.

## OVR formula (read-only — derived at seed time)

```
OVR = Main1 * 0.40 + Main2 * 0.35 + avg(Secondary 6) * 0.20 + avg(Other 22) * 0.05
```

Main / secondary stats vary by position (see `src/lib/overall.ts`). Stat fields above 100 or below 1 are rejected by the importer.
