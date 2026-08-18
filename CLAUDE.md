# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, no-build web app: a Pokémon GO IV (individual value) calculator with a Korean UI. Given a species, CP, HP, and optionally trainer level / appraisal tiers, it brute-forces every (level, attack IV, defense IV, stamina IV) combination and reports which ones match — including whether a 100% ("hundo") roll is possible or confirmed.

There is no framework, bundler, or package.json. Open `index.html` directly or serve the directory statically:

```
python3 -m http.server 8000
```

## Files

- `index.html` — page structure/markup only, no inline logic
- `style.css` — all styling; supports light/dark via `prefers-color-scheme`
- `data.js` — generated data, not hand-edited (see below)
- `app.js` — all calculation and UI logic

## `data.js`: how it's generated and why it looks the way it does

`data.js` defines two globals consumed by `app.js`:

- `CPM_WHOLE_LEVELS` — an 80-element array of the official CP multiplier for whole levels 1–80, extracted verbatim from Niantic's live GAME_MASTER (via the PokeMiners/game_masters mirror on GitHub). Half-levels (e.g. 20.5) are *not* stored — `app.js` derives them at runtime with Niantic's documented formula `sqrt((cpm(n)^2 + cpm(n+1)^2) / 2)`. Do not hand-edit or hardcode half-level CPM values; recompute via the formula instead.
- `POKEMON_DATA` — an array of `[dex, speciesId, koreanName, formLabel_or_null, baseAtk, baseDef, baseHp]` rows, merged from two sources: base stats from PvPoke's `gamemaster.json` (cross-checked against the official GAME_MASTER), and Korean species names from PokeAPI's `pokemon_species_names.csv` (language id 3 = ko). Shadow and Mega entries are deliberately excluded (they reuse the base species' stats for CP/HP purposes, so listing them separately would just be duplicate/confusing search results), and entries whose base stats are identical to another form of the same species are deduped, keeping the un-suffixed form.

If this data ever needs regenerating (e.g. new generation released), redo that merge — don't hand-type species rows.

## Core calculation (`app.js`)

The whole feature is: given target CP/HP, search level × IV space for matches.

- `cpmAtLevel(level)` — looks up or derives the CP multiplier for any level 1–40 (whole or half).
- `computeCP` / `computeHP` — the standard Pokémon GO formulas: `CP = max(10, floor(atk * sqrt(def) * sqrt(sta) * cpm^2 / 10))`, `HP = max(10, floor(sta * cpm))`.
- `findMatchingCombos` — iterates level (1–40 in 0.5 steps) × staminaIV (0–15, filtered by HP match first since HP doesn't depend on atk/def) × atkIV × defIV (0–15 each), collecting every combo whose computed CP and HP match the input. This is ~330k iterations worst case per search, which runs in a few ms in-browser — no need to optimize further.
- The search is capped at level 40 by design (`MAX_LEVEL`), not 50/51: wild/raid/egg-caught Pokémon practically never exceed level 40, and the exact CPM digits for the XL-candy range (40.5–51) were not verified against an authoritative source when this was built. If XL-level support is ever added, re-verify those CPM values against the official GAME_MASTER first.
- The appraisal-tier filter (`tierMatches`) narrows results post-hoc by intersecting each stat's IV with the 0–7 / 8–12 / 13–14 / 15 band the user selected — this mirrors the in-game Team Leader appraisal bars and is usually what takes a many-combo result down to a single confirmed one.

## Conventions

- No inline `<script>`/`<style>` in `index.html` — logic stays in `app.js`, styling in `style.css`.
- All user-facing text is Korean; keep it that way (this is the entire point of the app — official Pokémon GO Korea uses Korean UI/appraisal text).
- No build step, no dependencies, no bundler — keep it that way unless there's a concrete reason to add one; the app's value is that it's a single directory you can open with no setup.
