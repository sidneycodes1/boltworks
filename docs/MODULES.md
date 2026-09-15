# BOLTWORKS — Module Assembly System

## Overview

BOLTWORKS features a modular tank assembly system where the player's tank is constructed from individual 404-verified asset modules. Between waves, the tank visibly disassembles and rebuilds with upgraded modules, demonstrating the game's core originality mechanic.

## Module Categories

### Hull Modules
- `hull_light` — Compact hull, 740 tris, 3.3×2.35×2.24m
- `hull_heavy` — Reinforced hull with layered frontal armour, 1392 tris, 4.108×3.05×3.224m

### Track Modules
- `tracks_standard` — Standard tracks with 12 road wheels, 5100 tris, 3×0.611×0.81m
- `tracks_wide` — Wide tracks with 14 road wheels, reinforced links

### Turret Modules
- `turret_round` — Rounded turret with commander's cupola
- `turret_angular` — Angular turret with 60-degree front face

### Barrel Modules
- `barrel_short` — Short barrel with muzzle brake, 288 tris
- `barrel_long` — Long barrel with thermal sleeve, 336 tris
- `barrel_twin` — Twin-barrel with mounting block, 1740 tris

### Armour Modules
- `armour_plate_side` — Side armour with grid pattern bolt holes, 432 tris
- `armour_plate_front` — Front trapezoidal armour with battle damage, 368 tris

## Assembly Process

### 1. Asset Loading
All module assets are loaded at startup during the initialization phase:
```javascript
const moduleAssets = {
  hull_light: await ASSET('./assets/hull_light.js', { height: 1.2, surfaces: true }),
  hull_heavy: await ASSET('./assets/hull_heavy.js', { height: 1.2, surfaces: true }),
  // ... all other modules
};
window.__MODULE_ASSETS__ = moduleAssets;
```

### 2. Initial Assembly
The game starts with a basic configuration:
- Hull: `hull_light`
- Tracks: `tracks_standard`
- Turret: `turret_round`
- Barrel: `barrel_short`
- Armour: None

### 3. Wave-Based Upgrades
Between waves, the tank automatically upgrades:

**Wave 2:**
- Hull: `hull_heavy` (reinforced armour)
- Barrel: `barrel_long` (longer range)
- Armour: `armour_plate_side` (side protection)

**Wave 3:**
- Turret: `turret_angular` (better angles)
- Barrel: `barrel_twin` (double firepower)
- Tracks: `tracks_wide` (stability)
- Armour: `armour_plate_front` (frontal protection)

### 4. Disassembly Animation
When a wave clears:
1. Assembly state flag set (`inAssembly = true`)
2. Tank parts scale down from 1.0 to 0.1 over 1 second
3. Parts rotate wildly during disassembly
4. Parts move outward from center
5. Tank removed from scene
6. Module selection updated

### 5. Reassembly Animation
After module selection:
1. New tank created with upgraded modules
2. Parts start at scale 0.1
3. Parts scale up to 1.0 over 1 second
4. Parts rotate to normal orientation
5. Assembly state flag cleared (`inAssembly = false`)
6. Combat resumes

## Module Configuration

Current modules are tracked in:
```javascript
let currentModules = {
  hull: 'hull_light',
  tracks: 'tracks_standard',
  turret: 'turret_round',
  barrel: 'barrel_short',
  armourSide: null,
  armourFront: null
};
```

## Assembly Functions

### `rebuildTank()`
Initiates the rebuild process for the next wave. Selects new modules based on wave number and chains disassembly → reassembly.

### `disassembleTank()`
Animates the current tank flying apart. Returns a Promise that resolves when disassembly completes.

### `assembleTank()`
Creates a new tank with current modules and animates assembly. Returns a Promise that resolves when assembly completes.

## Visual Impact

The assembly system is the game's core originality mechanic:
- Player watches tank physically rebuild between waves
- Silhouette visibly changes with each upgrade
- Demonstrates the advantage of code-based assets over meshes
- Creates a clear progression system tied to wave completion

## Asset Contract Compliance

All modules follow the 404 asset contract:
- Single default export: `export default function (THREE) { return g; }`
- No imports, network calls, timers, or Node APIs
- MeshStandardMaterial with explicit colors
- Material names from contract list (metal, stone, etc.)
- Base at y=0, centered on x/z, front faces +Z
- Recognizable from every angle
