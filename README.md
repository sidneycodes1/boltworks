# BOLTWORKS

An original isometric arcade tank game for the 404 Game Jam (Sep 2026).

## Originality Mechanic (20% of judging)

The tank is assembled from modules. Hull, tracks, turret, barrel, and armour plates are each separate verified 404 asset modules. Between waves the player bolts on different parts and watches the tank physically rebuild in front of them, then drives what they built. This is cheap in this format and expensive in any mesh-based one — that gap is the story.

## Locked Scope

- 1 arena across 3 escalating waves (the same grid gains denser cover each wave)
- 3 enemy tank types: rusher, shooter, heavy
- 6-8 bolt-on player modules across hull/turret/barrel/armour
- Win: clear wave 3. Lose: hull integrity reaches zero.

This scope is deliberately small. A finished small game beats an unfinished big one, and 40% of the score is "is it good to play".

## Build Status

Built with Antigravity through the 404 game recipe. Every 3D object is Three.js code — no meshes, no asset store, no hand modelling.

## Tech Stack

- Three.js @0.169.0 (pinned)
- 404 asset generation pipeline
- Procedural surfaces from recipe harness
- Phone-first touch controls

## Jam Entry

- Repo: https://github.com/sidneycodes1/boltworks
- Deadline: 25 Sep 2026 23:59 UTC
- Solo build
