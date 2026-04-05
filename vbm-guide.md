# VBM Codebase Guide: The Ultimate Handbook

Welcome to the **VBM (Volleyball Management)** codebase guide. This document serves as a comprehensive map for developers to understand the logic, structure, and extensibility of the project.

---

## 1. Project Overview & Tech Stack
VBM is a volleyball management simulation built with a modern web stack:
- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Database**: SQLite (via `better-sqlite3`)
- **Styling**: Tailwind CSS
- **State Management**: React Context (`src/contexts`)

---

## 2. Directory Structure Map

### `/src/app` (Routing & Pages)
The core "parts" of the website reside here:
- `page.tsx`: **Dashboard** – The central hub showing upcoming matches and team status.
- `team/page.tsx`: **Team Info** – Statistics and history of the user's club.
- `squad/page.tsx`: **Squad Management** – Setting lineups and viewing player details.
- `match/page.tsx`: **Match Day** – Interface for simulating matches (uses the simulation engine).
- `standings/page.tsx`: **League Table** – Current rankings, wins, losses, and set ratios.
- `transfers/page.tsx`: **Market** – Buying/selling players and free agents.
- `player-admin/page.tsx`: **Admin Tools** – Bulk player creation, editing, and exporting.

### `/src/lib` (Core Logic)
This is the "brain" of the application:
- `overall.ts`: **The OVR Formula** – Logic for calculating a player's overall rating based on position.
- `simulation-engine.ts`: **The Match Sim** – Resolves rallies, sets, and full matches based on player stats.
- `db/schema.ts`: **Database Blueprint** – Table definitions (Players, Teams, Fixtures, etc.).
- `db/seed.ts`: **Initial Data** – Generates the starting world (players, teams, league quality).
- `country-codes.ts`: Mapping for flags and nationalities.

### `/src/components` (Reusable UI)
- `player-card.tsx`: Small UI block for a player's basic info.
- `player-modal.tsx`: Detailed view showing all 30 sub-stats.
- `match-sim-modal.tsx`: Visual feedback for match results.

---

## 3. The Logic of Features

### A. Player Stats & Overall (OVR)
Players have **30 individual attributes** categorized into:
1. **Core Skills**: Attack, Defense, Serve, Block, Receive, Setting.
2. **Technical**: Precision, Flair, Digging, etc.
3. **Physical**: Speed, Vertical, Strength, etc.
4. **Mental**: Leadership, Game IQ, Pressure, etc.

**Location**: `src/lib/overall.ts`
- **Calculation Logic**: Every position (Setter, Libero, etc.) has different weightings.
- **Formula**: `Main1 (40%) + Main2 (35%) + SecondaryAvg (20%) + OtherAvg (5%)`.

### B. Simulation Engine
The simulation is **rally-based** rather than just a randomized outcome. It simulates every point.

**Location**: `src/lib/simulation-engine.ts`
- **Logic**: It picks a server, then a receiver, then an attacker vs. blocker.
- **Factors**: Chemistry (cohesion), Momentum (streaks), Mental stats (rally endurance), and Setter bonuses.

---

## 4. How to Change & Improve (Developer's Guide)

### 📈 How to change OVR Calculation
If you want to change how "Good" a player is perceived or how stats impact their rating:
1. Open `src/lib/overall.ts`.
2. Find the `POSITION_GROUPINGS` object.
3. Change the `main1`, `main2`, or `secondary` stats for a position.
4. **Example**: To make `vertical` more important for Middle Blockers, add it to `main2` and adjust the math in `calculateOverall`.

### 🏐 How to improve Simulation Realism
If you find matches are too predictable, or you want more aces/errors:
1. Open `src/lib/simulation-engine.ts`.
2. Locate the `simulateRally` function.
3. **Aces/Errors**: Modify `aceProb` or `errProb` formulas.
4. **Rally Length**: Adjust the `V` constant (randomness variance) or the "Long rally" mental battle at the end of the function.
5. **Chemistry**: Modify `computeChemistry` to increase the penalty for having mixed nationalities or low teamwork.

### 🏛️ How to modify Database / Seed Data
If you want to add new teams or change the starting player quality:
1. **Schema**: Change `src/lib/db/schema.ts` if adding new columns (e.g., `injury_prone`).
2. **Seed**: Change `src/lib/db/seed.ts`.
   - Modify `overallTargets` array to change the "tier" of teams.
   - Modify `generatePlayer` to change the range of sub-stats.

### 🎨 How to update the UI
1. Look in `src/app/[page]/page.tsx` for the layout.
2. Most UI components use standard Tailwind classes.
3. For "Global" styles (colors, fonts), check `src/app/globals.css`.

---

## 5. Development Workflow
1. **Reset Database**: Run `node reset-database.js` to wipe current data and re-seed from `seed.ts`.
2. **New Page**: Create a new folder in `src/app/` with a `page.tsx` file.
3. **New API**: Add routes inside `src/app/api/` for server-side logic.

---
*Guide version: 1.0.0 | Last Updated: 2026-04-05*
