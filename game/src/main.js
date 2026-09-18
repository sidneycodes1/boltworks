/**
 * BOLTWORKS — boot, loop and mission
 *
 * Isometric arcade tank game for 404 Game Jam
 */
console.log('[BOLTWORKS] main.js loaded');

import * as THREE from 'three';
import { ASSET } from '../assetlib.js?v=202609160104';
import { setSurfaceDefaults } from '../surfaces.js?v=202609160104';
import { BoltAudio } from './audio.js?v=202609160104';

const audio = new BoltAudio();

console.log('[BOLTWORKS] Imports complete');

const canvas = document.getElementById('c');
const loadEl = document.getElementById('load');
const barf = document.getElementById('barf');
const loadmsg = document.getElementById('loadmsg');
const startScreen = document.getElementById('start');
const hpFill = document.getElementById('hp-fill');
const hpText = document.getElementById('hp-text');
const waveHud = document.getElementById('hud-wave');
const enemiesHud = document.getElementById('hud-enemies');
const gameOverScreen = document.getElementById('gameover');
const victoryScreen = document.getElementById('victory');
const gameOverStats = document.getElementById('gameover-stats');
const victoryStats = document.getElementById('victory-stats');
const flashEl = document.getElementById('flash');

// Enable procedural surfaces
setSurfaceDefaults({ on: true });

// Game state
let gameReady = false;
let gameStarted = false;
// The loop may render in every state, but only `playing` may read or update the
// active tank / combat simulation. Tank assembly deliberately removes the tank.
let gameState = 'loading'; // loading | ready | playing | transitioning | gameover | victory
let playerTank = null;
let camera = null;
let renderer = null;
let scene = null;
let lastTime = 0;
let input = { x: 0, y: 0, fire: false };

// Combat state
let shells = [];
let enemies = [];
let particles = [];
let shellMesh = null;
let combatFx = [];
let hitStopUntil = 0;
let shakeUntil = 0;
let shakeMagnitude = 0;
let lastDustAt = 0;
let lastPlayerImpactAt = 0;
let lastFireTime = 0;
const FIRE_COOLDOWN = 0.3; // seconds
let playerHP = 150;
const MAX_HP = 150;
let wave = 1;
let waveKills = 0;
let waveTotal = 0;
let gameOver = false;
let waveWin = false;
let inAssembly = false;
let savedTankTransform = null;
let totalKills = 0;
let runStartedAt = 0;
let destructionDebris = [];
let deathTimer = null;

// World state
let worldAssets = {};
let worldRoot = null;
let worldGrid = []; // 12x12 grid: 0 = empty, 1 = wall, 2 = barrier, 3 = spawn
const GRID_SIZE = 12;
const CELL_SIZE = 4; // metres
const WALL_HALF_EXTENT = 0.5; // wall_block is a 1m cube
let spawnMarkers = [];

// STYLE-LOCK accent. It must live in the 3D world, not only the UI: player
// focal details, world trims and the hero light all share this one hue so warm
// always reads as "the point of focus" against the cool blue-grey environment.
const ACCENT_HEX = 0xffb45a;
let accentMat = null;
function getAccentMaterial() {
  if (!accentMat) {
    accentMat = new THREE.MeshStandardMaterial({
      color: ACCENT_HEX, emissive: ACCENT_HEX, emissiveIntensity: 0.25,
      roughness: 0.45, metalness: 0.1
    });
    accentMat.name = 'accent';
  }
  return accentMat;
}

let playerHeroLight = null;
function addPlayerAccents(tank, turretGroup) {
  const mat = getAccentMaterial();

  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.09, 0.14), mat);
  bar.position.set(0, 0.52, 1.5);
  tank.add(bar);

  for (const sx of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 1.7), mat);
    strip.position.set(sx * 0.74, 0.42, 0.1);
    tank.add(strip);
  }

  if (turretGroup) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 18), mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.42, 0);
    turretGroup.add(ring);
  }

  // The hero light is the only warm pool in the world and it travels with the
  // player, so the focal object is the thing lighting its own surroundings.
  const hero = new THREE.PointLight(ACCENT_HEX, 2.8, 13, 2);
  hero.position.set(0, 2.2, 0);
  tank.add(hero);
  playerHeroLight = hero;
}

/**
 * Recede the backdrop. Every environment asset is pulled to a muted, shadowed
 * brown (darker and less saturated than the player's accent) and stripped of
 * any emissive, so the tank is the only saturated, glowing thing in frame.
 */
function tintEnvironment() {
  const recolor = (asset, hex, roughness) => asset?.traverse((n) => {
    if (!n.isMesh || !n.material || Array.isArray(n.material)) return;
    n.material = n.material.clone();
    if (n.material.color) n.material.color.setHex(hex);
    if (n.material.emissive) n.material.emissiveIntensity = 0;
    if (roughness !== undefined) n.material.roughness = roughness;
  });
  recolor(worldAssets.ground_slab, 0x463928, 0.98);
  recolor(worldAssets.wall_block, 0x342b20, 0.95);
  recolor(worldAssets.wall_block_cracked, 0x342b20, 0.95);
  recolor(worldAssets.wall_block_rubble, 0x30281e, 0.95);
  recolor(worldAssets.barrier_low, 0x342b20, 0.95);
  recolor(worldAssets.barrier_corner, 0x342b20, 0.95);
  recolor(worldAssets.crate_supply, 0x6b5940, 0.92);
  recolor(worldAssets.fuel_drum, 0x554632, 0.9);
  // Spawn markers keep their shape and warm colour but lose the glow.
  worldAssets.spawn_marker?.traverse((n) => {
    if (n.isMesh && n.material && !Array.isArray(n.material) && n.material.emissive) {
      n.material = n.material.clone();
      n.material.emissiveIntensity = 0;
    }
  });
}

// Module assembly state
let currentModules = {
  hull: 'hull_light',
  tracks: 'tracks_standard',
  turret: 'turret_round',
  barrel: 'barrel_short',
  armourSide: null,
  armourFront: null
};

// Enemy configs
const ENEMY_TYPES = {
  rusher: { hp: 30, speed: 8, damage: 2, range: 0 },
  shooter: { hp: 40, speed: 4, damage: 3, range: 15, fireRate: 3 },
  heavy: { hp: 80, speed: 2, damage: 4, range: 20, fireRate: 4 }
};

// Fixed marker/offset assignments keep every run and critic capture repeatable.
// They are intentionally plain data rather than generated placement rules.
const WAVE_SPAWN_PLAN = {
  1: [
    { marker: 0, offset: [0, 0] }, { marker: 1, offset: [0, 0] }, { marker: 2, offset: [0, 0] }
  ],
  2: [
    { marker: 0, offset: [0, 0] }, { marker: 1, offset: [0, 0] }, { marker: 2, offset: [0, 0] },
    { marker: 3, offset: [0, 0] }, { marker: 0, offset: [0, 1.25] }, { marker: 2, offset: [0, -1.25] }
  ],
  3: [
    { marker: 0, offset: [0, 0] }, { marker: 1, offset: [0, 0] }, { marker: 2, offset: [0, 0] },
    { marker: 3, offset: [0, 0] }, { marker: 0, offset: [0, 1.25] }, { marker: 1, offset: [0, -1.25] },
    { marker: 2, offset: [0, 1.25] }, { marker: 3, offset: [0, -1.25] }, { marker: 0, offset: [1.25, 0] }
  ]
};

// Telemetry for gate
window.__READY__ = false;
window.__START__ = () => {
  if (!gameReady) return;
  if (gameOver || !playerTank) {
    resetRun();
    return;
  }
  gameStarted = true;
  gameState = 'transitioning';
  startScreen.classList.remove('on');

  // Show touch controls
  const touch = document.getElementById('touch');
  if (touch) {
    touch.classList.add('on');
    console.log('[BOLTWORKS] Touch controls enabled');
  } else {
    console.error('[BOLTWORKS] Touch controls element not found');
  }

  lastTime = performance.now();

  // Start first wave
  console.log('[BOLTWORKS] Starting game, player HP:', playerHP);
  startWave(1);

  requestAnimationFrame(loop);
};
window.__GAME__ = {
  pos: [0, 0],
  fps: 0,
  speed: 0,
  score: 0,
  over: false,
  draws: 0,
  tris: 0,
  hp: 100,
  wave: 1,
  kills: 0,
  alive: true,
  tankBox: { w: 0, h: 0 }
};

async function init() {
  loadmsg.textContent = 'loading assets...';
  
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe8d6b0);
  // Bright dusty haze. It lifts the far arena (the top of frame) without
  // touching the near ground, so the frame gets a real value range instead of
  // one flat tone.
  scene.fog = new THREE.Fog(0xe8d6b0, 30, 52);
  
  // Camera for isometric view
  const aspect = window.innerWidth / window.innerHeight;
  const frustumSize = 25;
  camera = new THREE.OrthographicCamera(
    frustumSize * aspect / -2,
    frustumSize * aspect / 2,
    frustumSize / 2,
    frustumSize / -2,
    0.1,
    1000
  );
  camera.position.set(20, 20, 20);
  camera.lookAt(0, 0, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;

  // Lighting
  // The whole frame is warm. A dim warm fill and a warm key light the tired,
  // dusty environment; the only saturated, glowing thing is the player's
  // 0xffb45a trim, so the tank is unmistakeably the point of focus.
  const ambient = new THREE.AmbientLight(0xcabfae, 1.0);
  scene.add(ambient);
  
  const dirLight = new THREE.DirectionalLight(0xfff2e0, 3.0);
  dirLight.position.set(-15, 28, 18);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 80;
  dirLight.shadow.camera.left = -32;
  dirLight.shadow.camera.right = 32;
  dirLight.shadow.camera.top = 32;
  dirLight.shadow.camera.bottom = -32;
  dirLight.shadow.bias = -0.0003;
  dirLight.shadow.normalBias = 0.02;
  scene.add(dirLight);

  // Extended base ground plane to prevent void clipping beyond the arena slab boundary
  const groundFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x2e251a, roughness: 0.98 })
  );
  groundFloor.rotation.x = -Math.PI / 2;
  groundFloor.position.y = -0.15;
  groundFloor.receiveShadow = true;
  scene.add(groundFloor);

  // Runtime introspection so a capture can read the values actually in effect
  // rather than the ones a document claims.
  window.__DEBUG__ = { renderer, scene, camera, ambient, dirLight, groundFloor, THREE };
  
  // Shell pool (instanced)
  const shellGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.6, 8);
  const shellMat = new THREE.MeshBasicMaterial({ color: 0xffb45a });
  const maxShells = 50;
  shellMesh = new THREE.InstancedMesh(shellGeo, shellMat, maxShells);
  shellMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(shellMesh);

  // Initialize shell data
  for (let i = 0; i < maxShells; i++) {
    shells.push({
      active: false,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      lifetime: 0,
      owner: null
    });
    const dummy = new THREE.Object3D();
    dummy.position.set(0, -100, 0); // Hide inactive shells
    dummy.updateMatrix();
    shellMesh.setMatrixAt(i, dummy.matrix);
  }
  shellMesh.instanceMatrix.needsUpdate = true;
  window.__DEBUG__.shells = shells;
  window.__DEBUG__.shellMesh = shellMesh;
  window.__DEBUG__.enemies = enemies;
  loadmsg.textContent = 'loading enemies...';

  try {
    const enemyHullRusher = await ASSET('./assets/enemy_hull_rusher.js', { surfaces: true });
    const enemyHullShooter = await ASSET('./assets/enemy_hull_shooter.js', { surfaces: true });
    const enemyHullHeavy = await ASSET('./assets/enemy_hull_heavy.js', { surfaces: true });
    const enemyTurret = await ASSET('./assets/enemy_turret.js', { surfaces: true });

    console.log('[BOLTWORKS] Enemy assets loaded');

    // Store enemy assets for spawning
    window.__ENEMY_ASSETS__ = {
      rusher: enemyHullRusher,
      shooter: enemyHullShooter,
      heavy: enemyHullHeavy,
      turret: enemyTurret
    };
  } catch (e) {
    console.error('[BOLTWORKS] Failed to load enemy assets:', e);
  }

  // Load module assets for assembly
  loadmsg.textContent = 'loading modules...';

  try {
    const moduleAssets = {
      hull_light: await ASSET('./assets/hull_light.js', { height: 1.2, surfaces: true }),
      hull_heavy: await ASSET('./assets/hull_heavy.js', { height: 1.2, surfaces: true }),
      tracks_standard: await ASSET('./assets/tracks_standard.js', { surfaces: true }),
      tracks_wide: await ASSET('./assets/tracks_wide.js', { surfaces: true }),
      turret_round: await ASSET('./assets/turret_round.js', { height: 0.6, surfaces: true }),
      turret_angular: await ASSET('./assets/turret_angular.js', { height: 0.6, surfaces: true }),
      barrel_short: await ASSET('./assets/barrel_short.js', { surfaces: true }),
      barrel_long: await ASSET('./assets/barrel_long.js', { surfaces: true }),
      barrel_twin: await ASSET('./assets/barrel_twin.js', { surfaces: true }),
      armour_plate_side: await ASSET('./assets/armour_plate_side.js', { surfaces: true }),
      armour_plate_front: await ASSET('./assets/armour_plate_front.js', { surfaces: true })
    };

    console.log('[BOLTWORKS] Module assets loaded');

    // Store module assets for assembly
    window.__MODULE_ASSETS__ = moduleAssets;
  } catch (e) {
    console.error('[BOLTWORKS] Failed to load module assets:', e);
  }

  // Load world assets
  loadmsg.textContent = 'loading world...';

  try {
    worldAssets = {
      wall_block: await ASSET('./assets/wall_block.js', { surfaces: true }),
      wall_block_cracked: await ASSET('./assets/wall_block_cracked.js', { surfaces: true }),
      wall_block_rubble: await ASSET('./assets/wall_block_rubble.js', { surfaces: true }),
      barrier_low: await ASSET('./assets/barrier_low.js', { surfaces: true }),
      barrier_corner: await ASSET('./assets/barrier_corner.js', { surfaces: true }),
      ground_slab: await ASSET('./assets/ground_slab.js', { surfaces: true }),
      crate_supply: await ASSET('./assets/crate_supply.js', { surfaces: true }),
      fuel_drum: await ASSET('./assets/fuel_drum.js', { surfaces: true }),
      spawn_marker: await ASSET('./assets/spawn_marker.js', { surfaces: true })
    };

    console.log('[BOLTWORKS] World assets loaded');

    // Recede the backdrop: muted brown environment, no emissive anywhere.
    tintEnvironment();
  } catch (e) {
    console.error('[BOLTWORKS] Failed to load world assets:', e);
    // Continue without world assets - game will use flat ground
  }

  // Load and create player tank
  loadmsg.textContent = 'building tank...';

  try {
    console.log('[BOLTWORKS] Assembling initial tank...');

    // Use module assets for initial tank
    const modules = window.__MODULE_ASSETS__;
    if (!modules) throw new Error('Module assets not loaded');

    const hull = modules[currentModules.hull].clone();
    const tracks = modules[currentModules.tracks].clone();
    const turret = modules[currentModules.turret].clone();
    const barrel = modules[currentModules.barrel].clone();

    // Assemble tank
    playerTank = new THREE.Group();
    playerTank.add(hull);

    // Add tracks (left and right)
    const tracksL = tracks.clone();
    tracksL.position.set(0, 0, 0.9);
    playerTank.add(tracksL);

    const tracksR = tracks.clone();
    tracksR.position.set(0, 0, -0.9);
    playerTank.add(tracksR);

    // Add turret
    const turretGroup = new THREE.Group();
    turretGroup.add(turret);
    turretGroup.position.y = 0.8;
    playerTank.add(turretGroup);

    // Add barrel
    barrel.position.set(0, 0.5, 1.2);
    turretGroup.add(barrel);

    addPlayerAccents(playerTank, turretGroup);

    playerTank.position.y = 0.2;
    playerTank.castShadow = true;
    scene.add(playerTank);
    playerTank.userData.collisionRadius = measureTankCollisionRadius(playerTank);

    console.log('[BOLTWORKS] Tank added to scene');

    // Build initial world layout if assets loaded
    if (Object.keys(worldAssets).length > 0) {
      buildWorldLayout(1);
    } else {
      // Fallback: create simple ground plane
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(50, 50),
        new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.9 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);
      console.log('[BOLTWORKS] Using fallback ground plane');
    }

    // Hide loading screen
    console.log('[BOLTWORKS] Hiding loading screen');
    loadEl.style.display = 'none';

    // Camera follow
    camera.position.set(playerTank.position.x + 15, playerTank.position.y + 15, playerTank.position.z + 15);
    camera.lookAt(playerTank.position);

    // Reset player HP to ensure it starts at max
    playerHP = MAX_HP;
    window.__GAME__.hp = playerHP;
    console.log('[BOLTWORKS] Player HP reset to', playerHP);
    
    loadmsg.textContent = 'ready';
    barf.style.width = '100%';

    console.log('[BOLTWORKS] Setting gameReady = true');
    gameReady = true;
    gameState = 'ready';
    console.log('[BOLTWORKS] Setting window.__READY__ = true');
    window.__READY__ = true;

    // Show start screen
    console.log('[BOLTWORKS] Showing start screen');
    startScreen.classList.add('on');
    console.log('[BOLTWORKS] Init complete');
    requestAnimationFrame(loop);
    
  } catch (e) {
    loadmsg.textContent = 'error: ' + e.message;
    console.error('[BOLTWORKS] ERROR during init:', e);
    console.error('[BOLTWORKS] Stack:', e.stack);
  }
}

function loop(time) {
  requestAnimationFrame(loop);

  if (!gameStarted) {
    renderer.render(scene, camera);
    return;
  }

  const dt = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;

  // Assembly and end states still render, but never run code that assumes a
  // player tank exists. This is a state transition, not a null-object dodge.
  if (gameState !== 'playing') {
    if (gameState === 'destroying') updateDestructionDebris(dt);
    renderer.render(scene, camera);
    return;
  }

  // Update tank position based on input
  const speed = 5; // m/s
  if (input.x !== 0 || input.y !== 0) {
    const moveX = input.x * speed * dt;
    const moveZ = input.y * speed * dt;

    // Check wall collision before moving
    const newX = playerTank.position.x + moveX;
    const newZ = playerTank.position.z + moveZ;

    if (!checkWallCollision(new THREE.Vector3(newX, 0, newZ))) {
      playerTank.position.x = newX;
      playerTank.position.z = newZ;
    }

    // Rotate tank to face movement direction
    if (Math.abs(input.x) > 0.1 || Math.abs(input.y) > 0.1) {
      const angle = Math.atan2(input.x, input.y);
      playerTank.rotation.y = angle;
    }
  }

  // Fire shells
  if (input.fire && time - lastFireTime > FIRE_COOLDOWN * 1000) {
    fireShell();
    lastFireTime = time;
  }

  // Update shells
  updateShells(dt);

  // Update enemies
  updateEnemies(dt);
  updateCombatFx(dt, time);
  if (input.x !== 0 || input.y !== 0) spawnTrackDust(time);
  audio.updateEngine(Math.min(1, Math.hypot(input.x, input.y)));

  // Check win/lose conditions
  checkGameState();

  // Update camera to follow tank
  camera.position.set(
    playerTank.position.x + 15,
    playerTank.position.y + 15,
    playerTank.position.z + 15
  );
  camera.lookAt(playerTank.position);

  // Update telemetry
  window.__GAME__.pos = [playerTank.position.x, playerTank.position.z];
  window.__GAME__.fps = 1 / dt;
  window.__GAME__.speed = speed * (Math.abs(input.x) + Math.abs(input.y));
  window.__GAME__.draws = renderer.info.render.calls;
  window.__GAME__.tris = renderer.info.render.triangles;
  updateHud();

  // Render
  renderer.render(scene, camera);
}

// Kept DOM-only by design: these values mirror the public telemetry object and
// never add text or geometry to the Three.js scene.
function updateHud() {
  const game = window.__GAME__;
  const hp = Math.max(0, Math.min(MAX_HP, game.hp));
  hpFill.style.width = `${(hp / MAX_HP) * 100}%`;
  hpText.textContent = `HP ${Math.ceil(hp)} / ${MAX_HP}`;
  waveHud.textContent = `WAVE ${game.wave} / 3`;
  enemiesHud.textContent = `ENEMIES ${game.alive}`;
}

function fireShell() {
  // Find inactive shell
  const shell = shells.find(s => !s.active);
  if (!shell) {
    console.log('[BOLTWORKS] No inactive shells available');
    return;
  }

  // Fire in tank's forward direction
  const angle = playerTank.rotation.y;
  const speed = 30; // m/s

  shell.active = true;
  shell.owner = 'player';
  shell.position.copy(playerTank.position);
  shell.position.y += 1.5;
  shell.velocity.set(
    Math.sin(angle) * speed,
    0,
    Math.cos(angle) * speed
  );
  shell.lifetime = 2; // seconds
  spawnMuzzleFlash();
  triggerScreenShake(.07, 90);
  audio.playFire();

  console.log('[BOLTWORKS] Shell fired from position:', shell.position);
}

function updateShells(dt) {
  const dummy = new THREE.Object3D();
  let needsUpdate = false;

  shells.forEach((shell, i) => {
    if (!shell.active) return;

    // Move shell
    shell.position.addScaledVector(shell.velocity, dt);
    shell.lifetime -= dt;

    // Deactivate if lifetime expires or out of bounds
    if (shell.lifetime <= 0 ||
      Math.abs(shell.position.x) > 30 ||
      Math.abs(shell.position.z) > 30) {
      shell.active = false;
      shell.owner = null;
      dummy.position.set(0, -100, 0);
      dummy.updateMatrix();
      scene.children.find(c => c.isInstancedMesh)?.setMatrixAt(i, dummy.matrix);
      needsUpdate = true;
      return;
    }

    // Enemy shells hitting player (visible projectile fairness)
    if (shell.owner === 'enemy' && playerTank) {
      if (shell.position.distanceTo(playerTank.position) < 1.8) {
        shell.active = false;
        shell.owner = null;
        damagePlayer(10);
        dummy.position.set(0, -100, 0);
        dummy.updateMatrix();
        scene.children.find(c => c.isInstancedMesh)?.setMatrixAt(i, dummy.matrix);
        needsUpdate = true;
        return;
      }
    }

    // Update visual
    dummy.position.copy(shell.position);
    dummy.rotation.set(0, -Math.atan2(shell.velocity.x, shell.velocity.z), 0);
    dummy.updateMatrix();
    scene.children.find(c => c.isInstancedMesh)?.setMatrixAt(i, dummy.matrix);
    needsUpdate = true;
  });

  if (needsUpdate) {
    const shellMesh = scene.children.find(c => c.isInstancedMesh);
    if (shellMesh) {
      shellMesh.instanceMatrix.needsUpdate = true;
    }
  }
}

function spawnEnemy(type, position) {
  const assets = window.__ENEMY_ASSETS__;
  if (!assets) return;

  const hull = assets[type].clone();
  const turret = assets.turret.clone();

  const enemy = {
    type,
    mesh: new THREE.Group(),
    hp: ENEMY_TYPES[type].hp,
    lastFire: 0,
    position: position.clone()
  };

  enemy.mesh.add(hull);
  enemy.mesh.add(turret);
  enemy.mesh.traverse((node) => {
    if (node.isMesh && node.material && !Array.isArray(node.material)) node.material = node.material.clone();
  });
  enemy.mesh.position.copy(position);
  enemy.mesh.castShadow = true;
  scene.add(enemy.mesh);
  enemy.collisionRadius = measureTankCollisionRadius(enemy.mesh);

  enemies.push(enemy);
  window.__GAME__.alive = enemies.length;
}

function updateEnemies(dt) {
  enemies.forEach((enemy, index) => {
    const config = ENEMY_TYPES[enemy.type];
    const toPlayer = new THREE.Vector3()
      .subVectors(playerTank.position, enemy.mesh.position);
    const dist = toPlayer.length();

    // AI behavior based on type
    if (enemy.type === 'rusher') {
      // Rush straight at player
      toPlayer.normalize();
      const newPos = enemy.mesh.position.clone().addScaledVector(toPlayer, config.speed * dt);
      if (!checkWallCollision(newPos, enemy.collisionRadius)) {
        enemy.mesh.position.copy(newPos);
      }
      enemy.mesh.lookAt(playerTank.position);
    } else if (enemy.type === 'shooter') {
      // Maintain range, fire at player
      if (dist > config.range) {
        toPlayer.normalize();
        const newPos = enemy.mesh.position.clone().addScaledVector(toPlayer, config.speed * dt);
        if (!checkWallCollision(newPos, enemy.collisionRadius)) {
          enemy.mesh.position.copy(newPos);
        }
      } else if (dist < config.range * 0.7) {
        toPlayer.normalize();
        const newPos = enemy.mesh.position.clone().addScaledVector(toPlayer, -config.speed * dt);
        if (!checkWallCollision(newPos, enemy.collisionRadius)) {
          enemy.mesh.position.copy(newPos);
        }
      }
      enemy.mesh.lookAt(playerTank.position);

      // Fire at player
      if (performance.now() - enemy.lastFire > config.fireRate * 1000) {
        enemyFire(enemy);
        enemy.lastFire = performance.now();
      }
    } else if (enemy.type === 'heavy') {
      // Slow advance, heavy fire
      toPlayer.normalize();
      const newPos = enemy.mesh.position.clone().addScaledVector(toPlayer, config.speed * dt);
      if (!checkWallCollision(newPos, enemy.collisionRadius)) {
        enemy.mesh.position.copy(newPos);
      }
      enemy.mesh.lookAt(playerTank.position);

      if (performance.now() - enemy.lastFire > config.fireRate * 1000) {
        enemyFire(enemy);
        enemy.lastFire = performance.now();
      }
    }

    // Collision with player (ram damage + separation)
    if (dist < 2) {
      playerHP -= config.damage * dt * 0.5; // Reduced ram damage
      window.__GAME__.hp = playerHP;
      // Simple separation: push both apart along the line between them
      if (dist > 0.01) {
        const overlap = (2 - dist);
        const pushDir = toPlayer.clone().normalize();
        playerTank.position.addScaledVector(pushDir, overlap * 0.5 + 0.015);
        enemy.mesh.position.addScaledVector(pushDir, -overlap * 0.5);
      } else {
        playerTank.position.x += 0.05;
        enemy.mesh.position.x -= 0.05;
      }
    }
  });

  // Check shell-enemy collisions (only player shells)
  shells.forEach((shell, shellIdx) => {
    if (!shell.active || shell.owner !== 'player') return;

    enemies.forEach((enemy, eIndex) => {
      const dist = shell.position.distanceTo(enemy.mesh.position);
      if (dist < 2.0) { // Increased hit radius
        // Hit enemy
        console.log('[BOLTWORKS] Shell hit enemy! Distance:', dist);
        enemy.hp -= 20;
        shell.active = false;
        shell.owner = null;
        // Hide shell visual immediately
        {
          const dummy = new THREE.Object3D();
          dummy.position.set(0, -100, 0);
          dummy.updateMatrix();
          scene.children.find(c => c.isInstancedMesh)?.setMatrixAt(shellIdx, dummy.matrix);
          const sm = scene.children.find(c => c.isInstancedMesh);
          if (sm) sm.instanceMatrix.needsUpdate = true;
        }

        // Kill enemy
        if (enemy.hp <= 0) {
          console.log('[BOLTWORKS] Enemy destroyed!');
          scene.remove(enemy.mesh);
          enemies.splice(eIndex, 1);
          waveKills++;
          totalKills++;
          window.__GAME__.kills = waveKills;
          window.__GAME__.alive = enemies.length;
        }
      }
    });
  });
}

function enemyFire(enemy) {
  const config = ENEMY_TYPES[enemy.type];
  const toPlayer = new THREE.Vector3().subVectors(playerTank.position, enemy.mesh.position);
  const dist = toPlayer.length();
  if (dist > config.range * 1.2) return; // out of range, don't waste shell
  const shell = shells.find(s => !s.active);
  if (!shell) return;
  toPlayer.normalize();
  shell.active = true;
  shell.owner = 'enemy';
  shell.position.copy(enemy.mesh.position);
  shell.position.y += 1.2;
  shell.position.addScaledVector(toPlayer, 1.6);
  const speed = 22;
  shell.velocity.copy(toPlayer).multiplyScalar(speed);
  shell.lifetime = 3;
  spawnEnemyMuzzleFlash(enemy);
}

function checkGameState() {
  if (gameOver || waveWin) return;

  // Lose condition
  if (playerHP <= 0) {
    beginPlayerDeath();
    return;
  }

  // Win condition - wave cleared
  if (waveKills >= waveTotal && waveTotal > 0) {
    waveWin = true;
    gameState = 'transitioning';
    window.__GAME__.wave = wave;
    console.log('[BOLTWORKS] Wave', wave, 'cleared');
    audio.playWaveClear();

    // Start next wave after delay
    setTimeout(() => {
      if (wave < 3) {
        startWave(wave + 1);
      } else {
        gameOver = true;
        gameState = 'victory';
        window.__GAME__.over = true;
        console.log('[BOLTWORKS] Victory - All waves cleared');
        showVictory();
      }
    }, 2000);
    return;
  }
}

async function startWave(waveNum) {
  // A wave cannot create enemies until a previous tank assembly has completed.
  if (!gameStarted || (gameState !== 'transitioning' && gameState !== 'ready')) return;

  wave = waveNum;
  waveKills = 0;
  waveTotal = waveNum * 3; // More enemies each wave
  waveWin = false;
  if (wave === 1) runStartedAt = performance.now();

  console.log('[BOLTWORKS] Starting wave', wave);

  // Module assembly between waves
  if (wave > 1) {
    await rebuildTank();
  }

  // Spawn enemies at spawn markers (or fallback to circle if no markers)
  const types = ['rusher', 'shooter', 'heavy'];
  const spawnPlan = WAVE_SPAWN_PLAN[wave] || [];
  for (let i = 0; i < waveTotal; i++) {
    const type = types[i % 3];
    let pos;

    if (spawnMarkers.length > 0) {
      const assignment = spawnPlan[i] || { marker: i % spawnMarkers.length, offset: [0, 0] };
      pos = spawnMarkers[assignment.marker % spawnMarkers.length].clone();
      pos.x += assignment.offset[0];
      pos.z += assignment.offset[1];
    } else {
      // Deterministic fallback for an asset-loading failure.
      const angle = (i / waveTotal) * Math.PI * 2;
      const dist = 18;
      pos = new THREE.Vector3(
        Math.sin(angle) * dist,
        0,
        Math.cos(angle) * dist
      );
    }

    // Ensure enemies don't spawn too close to player
    const distToPlayer = pos.distanceTo(playerTank.position);
    if (distToPlayer < 5) {
      // Move enemy further away
      const awayFromPlayer = pos.clone().sub(playerTank.position).normalize();
      pos.copy(playerTank.position).add(awayFromPlayer.multiplyScalar(10));
    }

    spawnEnemy(type, pos);
  }

  window.__GAME__.wave = wave;
  window.__GAME__.alive = enemies.length;
  gameState = 'playing';
}


function damagePlayer(amount) {
  playerHP -= amount;
  window.__GAME__.hp = playerHP;
  const now = performance.now();
  if (now - lastPlayerImpactAt > 70) {
    lastPlayerImpactAt = now;
    triggerHitStop(50);
    triggerScreenShake(.22, 150);
    audio.playHit();
  }
}

function triggerHitStop(milliseconds) {
  hitStopUntil = Math.max(hitStopUntil, performance.now() + milliseconds);
}

function triggerScreenShake(magnitude, milliseconds) {
  shakeMagnitude = Math.max(shakeMagnitude, magnitude);
  shakeUntil = Math.max(shakeUntil, performance.now() + milliseconds);
}

function applyScreenShake(time) {
  if (time >= shakeUntil) { shakeMagnitude = 0; return; }
  const fade = (shakeUntil - time) / 180;
  camera.position.x += (Math.random() - .5) * shakeMagnitude * fade;
  camera.position.y += (Math.random() - .5) * shakeMagnitude * fade;
}

function flashEnemy(enemy) {
  const until = performance.now() + 100;
  enemy.mesh.traverse((node) => {
    if (!node.isMesh || !node.material || Array.isArray(node.material)) return;
    const material = node.material;
    combatFx.push({ type: 'material', material, until, emissive: material.emissive.clone(), intensity: material.emissiveIntensity || 1 });
    material.emissive.setHex(0xff5544);
    material.emissiveIntensity = 1.8;
  });
}

let flashTexture = null;
function getFlashTexture() {
  if (flashTexture) return flashTexture;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.25, 'rgba(143, 180, 216, 0.95)');
  grad.addColorStop(0.55, 'rgba(143, 180, 216, 0.4)');
  grad.addColorStop(1, 'rgba(143, 180, 216, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  flashTexture = new THREE.CanvasTexture(c);
  return flashTexture;
}

function spawnMuzzleFlash() {
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getFlashTexture(),
    color: 0x8fb4d8,
    transparent: true,
    opacity: .95,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  const forward = new THREE.Vector3(Math.sin(playerTank.rotation.y), 0, Math.cos(playerTank.rotation.y));
  flash.position.copy(playerTank.position).addScaledVector(forward, 2.1);
  flash.position.y += 1.45;
  flash.scale.set(1.4, 1.4, 1);
  scene.add(flash);

  const flashLight = new THREE.PointLight(0x8fb4d8, 3.2, 10, 2);
  flashLight.position.copy(flash.position);
  scene.add(flashLight);

  combatFx.push({ type: 'sprite', mesh: flash, light: flashLight, until: performance.now() + 85, born: performance.now(), base: 1.4 });
}

function spawnEnemyMuzzleFlash(enemy) {
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getFlashTexture(),
    color: 0x8fb4d8,
    transparent: true,
    opacity: .95,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  const dir = new THREE.Vector3().subVectors(playerTank.position, enemy.mesh.position).normalize();
  flash.position.copy(enemy.mesh.position).addScaledVector(dir, 1.2);
  flash.position.y += 1.2;
  flash.scale.set(1.2, 1.2, 1);
  scene.add(flash);
  const flashLight = new THREE.PointLight(0x8fb4d8, 2.8, 9, 2);
  flashLight.position.copy(flash.position);
  scene.add(flashLight);
  combatFx.push({ type: 'sprite', mesh: flash, light: flashLight, until: performance.now() + 85, born: performance.now(), base: 1.2 });
}

function spawnTrackDust(time) {
  if (time - lastDustAt < 110 || combatFx.filter((fx) => fx.type === 'dust').length >= 14) return;
  lastDustAt = time;
  const dust = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x8b9097, transparent: true, opacity: .34, depthWrite: false }));
  const back = new THREE.Vector3(-Math.sin(playerTank.rotation.y), 0, -Math.cos(playerTank.rotation.y));
  dust.position.copy(playerTank.position).addScaledVector(back, 1.35);
  dust.position.y = .15;
  dust.scale.set(.38, .38, 1);
  scene.add(dust);
  combatFx.push({ type: 'dust', mesh: dust, until: time + 460, born: time, base: .38 });
}

function spawnEnemyDestruction(enemy) {
  const origin = enemy.mesh.position.clone();
  enemy.mesh.children.forEach((part, i) => {
    const debris = part.clone(true);
    debris.position.copy(origin).add(part.position);
    scene.add(debris);
    combatFx.push({ type: 'debris', mesh: debris, velocity: new THREE.Vector3((i ? .8 : -.8), 2.4 + i, i ? -.55 : .55), until: performance.now() + 720 });
  });
  const rubble = worldAssets.wall_block_rubble?.clone();
  if (rubble) {
    rubble.position.copy(origin); rubble.scale.setScalar(.26); scene.add(rubble);
    combatFx.push({ type: 'debris', mesh: rubble, velocity: new THREE.Vector3(0, 2.2, 0), until: performance.now() + 720 });
  }
}

function updateCombatFx(dt, time) {
  combatFx = combatFx.filter((fx) => {
    if (time < fx.until) {
      if (fx.type === 'sprite' || fx.type === 'dust') {
        const life = Math.max(0, (fx.until - time) / (fx.until - fx.born));
        fx.mesh.material.opacity = fx.type === 'dust' ? life * .34 : life;
        const size = fx.base * (fx.type === 'dust' ? 1 + (1 - life) * 1.5 : 1 + (1 - life) * .7);
        fx.mesh.scale.set(size, size, 1);
        if (fx.light) fx.light.intensity = life * 2.8;
      } else if (fx.type === 'debris') {
        fx.velocity.y -= 7 * dt;
        fx.mesh.position.addScaledVector(fx.velocity, dt);
        fx.mesh.rotation.x += .12; fx.mesh.rotation.z += .08;
      }
      return true;
    }
    if (fx.type === 'material') { fx.material.emissive.copy(fx.emissive); fx.material.emissiveIntensity = fx.intensity; }
    else {
      if (fx.mesh) scene.remove(fx.mesh);
      if (fx.light) scene.remove(fx.light);
    }
    return false;
  });
}

function beginPlayerDeath() {
  if (gameOver) return;
  gameOver = true;
  gameState = 'hitstop';
  window.__GAME__.over = true;
  spawnPlayerDestruction();
  audio.playEnemyDeath();
  flashEl.classList.remove('on');
  void flashEl.offsetWidth;
  flashEl.classList.add('on');
  clearTimeout(deathTimer);
  deathTimer = setTimeout(() => {
    gameState = 'destroying';
    showGameOver();
  }, 150);
  console.log('[BOLTWORKS] Game Over - Player destroyed');
}

function spawnPlayerDestruction() {
  if (!playerTank) return;
  const origin = playerTank.position.clone();
  playerTank.children.forEach((part, i) => {
    const debris = part.clone(true);
    debris.position.copy(origin).add(part.position);
    debris.rotation.copy(playerTank.rotation);
    scene.add(debris);
    destructionDebris.push({ mesh: debris, velocity: new THREE.Vector3((i - 2) * .9, 2.8 + i * .35, (i % 2 ? 1 : -1) * .75), spin: (i + 1) * .11, age: 0 });
  });
  // The verified rubble asset supplies the visibly broken aftermath rather
  // than inventing a mesh outside the asset contract.
  for (let i = 0; i < 4; i++) {
    const rubble = worldAssets.wall_block_rubble?.clone();
    if (!rubble) continue;
    rubble.scale.setScalar(.28);
    rubble.position.copy(origin).add(new THREE.Vector3((i - 1.5) * .45, .15, (i % 2 ? .35 : -.35)));
    scene.add(rubble);
    destructionDebris.push({ mesh: rubble, velocity: new THREE.Vector3((i - 1.5) * .55, 2.1 + i * .2, (i % 2 ? .6 : -.6)), spin: .14, age: 0 });
  }
  playerTank.visible = false;
}

function updateDestructionDebris(dt) {
  destructionDebris.forEach((debris) => {
    debris.age += dt;
    debris.velocity.y -= 7 * dt;
    debris.mesh.position.addScaledVector(debris.velocity, dt);
    debris.mesh.rotation.x += debris.spin;
    debris.mesh.rotation.z += debris.spin * .7;
  });
}

function clearDestructionDebris() {
  destructionDebris.forEach(({ mesh }) => scene.remove(mesh));
  destructionDebris = [];
}

function showGameOver() {
  gameOverStats.textContent = `WAVES SURVIVED ${wave}  •  ENEMIES DESTROYED ${totalKills}`;
  gameOverScreen.classList.add('on');
}

function showVictory() {
  const seconds = Math.max(0, Math.round((performance.now() - runStartedAt) / 1000));
  victoryStats.textContent = `ENEMIES DESTROYED ${totalKills}  •  TIME ${seconds}s`;
  victoryScreen.classList.add('on');
}

function resetRun() {
  clearTimeout(deathTimer);
  gameOverScreen.classList.remove('on');
  victoryScreen.classList.remove('on');
  flashEl.classList.remove('on');
  clearDestructionDebris();
  enemies.forEach((enemy) => scene.remove(enemy.mesh));
  enemies = [];
  if (playerTank) scene.remove(playerTank);
  playerTank = null;
  currentModules = { hull: 'hull_light', tracks: 'tracks_standard', turret: 'turret_round', barrel: 'barrel_short', armourSide: null, armourFront: null };
  playerHP = MAX_HP;
  wave = 1; waveKills = 0; waveTotal = 0; totalKills = 0; gameOver = false; waveWin = false;
  Object.assign(window.__GAME__, { hp: MAX_HP, wave: 1, kills: 0, alive: 0, over: false, score: 0, pos: [0, 0] });
  gameStarted = true;
  gameState = 'transitioning';
  buildWorldLayout(1);
  assembleTank({ position: new THREE.Vector3(0, .2, 0), rotationY: 0 }).then(() => startWave(1));
}

function exitToTitle() {
  clearTimeout(deathTimer);
  gameOverScreen.classList.remove('on');
  victoryScreen.classList.remove('on');
  flashEl.classList.remove('on');
  enemies.forEach((enemy) => scene.remove(enemy.mesh));
  enemies = [];
  clearDestructionDebris();
  gameStarted = false;
  gameState = 'ready';
  document.getElementById('touch').classList.remove('on');
  startScreen.classList.add('on');
}

async function rebuildTank() {
  inAssembly = true;
  console.log('[BOLTWORKS] Rebuilding tank for wave', wave);

  // Select new modules based on wave
  const modules = window.__MODULE_ASSETS__;
  if (!modules || !playerTank) {
    throw new Error('Cannot rebuild tank before its modules and current tank are available');
  }

  // The current transform is gameplay state, not part of the animation.
  // Preserve it before disassembly mutates/removes the tank object.
  savedTankTransform = {
    position: playerTank.position.clone(),
    rotationY: playerTank.rotation.y
  };

  // Upgrade modules each wave
  if (wave === 2) {
    currentModules.hull = 'hull_heavy';
    currentModules.barrel = 'barrel_long';
    currentModules.armourSide = 'armour_plate_side';
  } else if (wave === 3) {
    currentModules.turret = 'turret_angular';
    currentModules.barrel = 'barrel_twin';
    currentModules.tracks = 'tracks_wide';
    currentModules.armourFront = 'armour_plate_front';
  }

  await disassembleTank();
  // Rebuild world layout for the next wave while combat remains gated.
  buildWorldLayout(wave);
  await assembleTank(savedTankTransform);
  savedTankTransform = null;
  inAssembly = false;
  console.log('[BOLTWORKS] Tank rebuild complete');
}

function disassembleTank() {
  return new Promise((resolve) => {
    const duration = 1000; // 1 second disassembly
    const startTime = performance.now();

    // Animate parts flying off
    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      playerTank.children.forEach((child, i) => {
        // Scale down
        const scale = 1 - progress * 0.9;
        child.scale.set(scale, scale, scale);

        // Rotate wildly
        child.rotation.x += 0.1;
        child.rotation.z += 0.1;

        // Move outward
        const offset = (i + 1) * 2;
        child.position.x += Math.sin(elapsed * 0.01 + i) * 0.05;
        child.position.y += progress * offset * 0.05;
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Clear tank
        scene.remove(playerTank);
        playerTank = null;
        resolve();
      }
    };

    animate();
  });
}

function assembleTank(transform) {
  return new Promise((resolve) => {
    const modules = window.__MODULE_ASSETS__;
    if (!modules) {
      resolve();
      return;
    }

    // Create new tank with current modules
    const hull = modules[currentModules.hull].clone();
    const tracks = modules[currentModules.tracks].clone();
    const turret = modules[currentModules.turret].clone();
    const barrel = modules[currentModules.barrel].clone();

    playerTank = new THREE.Group();
    playerTank.add(hull);

    // Add tracks
    const tracksL = tracks.clone();
    tracksL.position.set(0, 0, 0.9);
    playerTank.add(tracksL);

    const tracksR = tracks.clone();
    tracksR.position.set(0, 0, -0.9);
    playerTank.add(tracksR);

    // Add turret
    const turretGroup = new THREE.Group();
    turretGroup.add(turret);
    turretGroup.position.y = 0.8;
    playerTank.add(turretGroup);

    // Add barrel
    barrel.position.set(0, 0.5, 1.2);
    turretGroup.add(barrel);

    addPlayerAccents(playerTank, turretGroup);

    // Add armour plates if equipped
    if (currentModules.armourSide) {
      const armourL = modules[currentModules.armourSide].clone();
      armourL.position.set(1.2, 0.5, 0);
      playerTank.add(armourL);

      const armourR = modules[currentModules.armourSide].clone();
      armourR.position.set(-1.2, 0.5, 0);
      armourR.rotation.y = Math.PI;
      playerTank.add(armourR);
    }

    if (currentModules.armourFront) {
      const armourF = modules[currentModules.armourFront].clone();
      armourF.position.set(0, 0.6, 1.5);
      playerTank.add(armourF);
    }

    // Restore the exact gameplay transform captured before disassembly. This
    // prevents a wave clear from teleporting the player back to arena origin.
    playerTank.position.copy(transform?.position || new THREE.Vector3(0, 0.2, 0));
    playerTank.rotation.y = transform?.rotationY || 0;
    playerTank.castShadow = true;

    // Start with parts scaled down for assembly animation
    playerTank.children.forEach((child) => {
      child.scale.set(0.1, 0.1, 0.1);
      child.rotation.y = Math.random() * Math.PI * 2;
    });

    scene.add(playerTank);
    playerTank.userData.collisionRadius = measureTankCollisionRadius(playerTank);

    // Animate assembly
    const duration = 1000; // 1 second assembly
    const startTime = performance.now();

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      playerTank.children.forEach((child) => {
        // Scale up
        const scale = 0.1 + progress * 0.9;
        child.scale.set(scale, scale, scale);

        // Rotate to normal
        child.rotation.y *= 0.9;
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Reset to proper scale
        playerTank.children.forEach((child) => {
          child.scale.set(1, 1, 1);
          child.rotation.y = 0;
        });
        resolve();
      }
    };

    animate();
  });
}

// World building functions
function buildWorldLayout(waveNum) {
  console.log('[BOLTWORKS] Building world layout for wave', waveNum);
  console.log('[BOLTWORKS] World assets available:', Object.keys(worldAssets).length);

  // Check if world assets are available
  if (Object.keys(worldAssets).length === 0) {
    console.log('[BOLTWORKS] World assets not loaded, skipping world layout');
    return;
  }

  // Clear existing world objects
  clearWorld();

  // Create arena layout based on wave
  createArenaLayout(waveNum);

  console.log('[BOLTWORKS] World grid created, placing objects...');

  // Place world objects based on grid
  placeWorldObjects();
}

function clearWorld() {
  // Static arena geometry lives under one root. Removing that root prevents
  // previous-wave instances from accumulating while leaving the shell pool,
  // lights, player, and enemies untouched.
  if (worldRoot) scene.remove(worldRoot);
  worldRoot = new THREE.Group();
  worldRoot.name = 'world-root';
  scene.add(worldRoot);

  // Clear spawn markers
  spawnMarkers = [];
}

/**
 * Instancing works on meshes, whereas generated assets arrive as Groups that
 * can contain more than one material/mesh. Create one InstancedMesh for each
 * mesh part of an asset type, sharing its geometry and material across every
 * placement. This preserves the complete authored asset while removing the
 * clone-per-prop draw-call cost.
 */
function addInstancedWorldAsset(asset, placements, name) {
  if (!asset || placements.length === 0) return;

  asset.updateMatrixWorld(true);
  const parts = [];
  asset.traverse((node) => {
    if (node.isMesh && node.geometry && node.material && !Array.isArray(node.material)) {
      parts.push({ geometry: node.geometry, material: node.material, matrix: node.matrixWorld.clone() });
    }
  });

  const transform = new THREE.Object3D();
  const matrix = new THREE.Matrix4();
  parts.forEach((part, partIndex) => {
    const instances = new THREE.InstancedMesh(part.geometry, part.material, placements.length);
    instances.name = `${name}-instances-${partIndex}`;
    instances.castShadow = true;
    instances.receiveShadow = true;

    placements.forEach((placement, i) => {
      transform.position.copy(placement.position);
      transform.rotation.set(0, placement.rotation || 0, 0);
      transform.scale.setScalar(placement.scale || 1);
      transform.updateMatrix();
      matrix.copy(transform.matrix).multiply(part.matrix);
      instances.setMatrixAt(i, matrix);
    });
    instances.instanceMatrix.needsUpdate = true;
    worldRoot.add(instances);
  });
}

function createArenaLayout(waveNum) {
  // Initialize 12x12 grid
  worldGrid = [];
  for (let x = 0; x < GRID_SIZE; x++) {
    worldGrid[x] = [];
    for (let z = 0; z < GRID_SIZE; z++) {
      worldGrid[x][z] = 0; // 0 = empty
    }
  }

  // Wave-specific layouts (deterministic, not procedural)
  const layouts = {
    1: {
      // Wave 1: sparse cover
      walls: [
        [0,0], [0,11], [11,0], [11,11], // corners
        [0,5], [0,6], [11,5], [11,6], // middle sides
        [5,0], [6,0], [5,11], [6,11]  // middle top/bottom
      ],
      barriers: [
        [3,3], [8,3], [3,8], [8,8] // interior corners
      ],
      spawns: [
        [1,5], [1,6], [10,5], [10,6] // spawn points
      ]
    },
    2: {
      // Wave 2: moderate cover
      walls: [
        [0,0], [0,11], [11,0], [11,11], // corners
        [0,3], [0,4], [0,7], [0,8], // left side
        [11,3], [11,4], [11,7], [11,8], // right side
        [3,0], [4,0], [7,0], [8,0], // top
        [3,11], [4,11], [7,11], [8,11], // bottom
        [5,5], [6,5] // center
      ],
      barriers: [
        [2,2], [9,2], [2,9], [9,9], // corners
        [5,2], [6,2], [5,9], [6,9], // middle
        [2,5], [9,5] // sides
      ],
      spawns: [
        [1,3], [1,8], [10,3], [10,8] // spawn points
      ]
    },
    3: {
      // Wave 3: dense cover
      walls: [
        [0,0], [0,11], [11,0], [11,11], // corners
        [0,2], [0,3], [0,4], [0,5], [0,6], [0,7], [0,8], [0,9], // left side
        [11,2], [11,3], [11,4], [11,5], [11,6], [11,7], [11,8], [11,9], // right side
        [2,0], [3,0], [4,0], [5,0], [6,0], [7,0], [8,0], [9,0], // top
        [2,11], [3,11], [4,11], [5,11], [6,11], [7,11], [8,11], [9,11], // bottom
        [3,3], [8,3], [3,8], [8,8], [5,5], [6,5] // interior
      ],
      barriers: [
        [1,2], [10,2], [1,9], [10,9], // near corners
        [2,1], [9,1], [2,10], [9,10], // near corners
        [4,4], [7,4], [4,7], [7,7], // interior
        [5,3], [6,3], [5,8], [6,8] // middle
      ],
      spawns: [
        [1,2], [1,9], [10,2], [10,9] // spawn points
      ]
    }
  };

  const layout = layouts[waveNum] || layouts[1];

  // Place walls
  layout.walls.forEach(([x, z]) => {
    if (x >= 0 && x < GRID_SIZE && z >= 0 && z < GRID_SIZE) {
      worldGrid[x][z] = 1; // 1 = wall
    }
  });

  // Place barriers
  layout.barriers.forEach(([x, z]) => {
    if (x >= 0 && x < GRID_SIZE && z >= 0 && z < GRID_SIZE) {
      worldGrid[x][z] = 2; // 2 = barrier
    }
  });

  // Place spawn markers
  layout.spawns.forEach(([x, z]) => {
    if (x >= 0 && x < GRID_SIZE && z >= 0 && z < GRID_SIZE) {
      worldGrid[x][z] = 3; // 3 = spawn
    }
  });

  console.log('[BOLTWORKS] Arena layout for wave', waveNum, ':', layout.walls.length, 'walls,', layout.barriers.length, 'barriers,', layout.spawns.length, 'spawns');
}

function placeWorldObjects() {
  const offset = (GRID_SIZE * CELL_SIZE) / 2 - CELL_SIZE / 2;

  // Count objects for placement
  let wallCount = 0;
  let barrierCount = 0;
  let spawnCount = 0;

  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      if (worldGrid[x][z] === 1) wallCount++;
      if (worldGrid[x][z] === 2) barrierCount++;
      if (worldGrid[x][z] === 3) spawnCount++;
    }
  }

  const walls = [];
  const barriers = [];
  const spawns = [];
  const slabs = [];

  // Collect placements first, then instance each generated asset type.
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      const worldX = x * CELL_SIZE - offset;
      const worldZ = z * CELL_SIZE - offset;
      slabs.push({ position: new THREE.Vector3(worldX, -0.1, worldZ) });

      if (worldGrid[x][z] === 1) {
        walls.push({ position: new THREE.Vector3(worldX, 0, worldZ) });
      } else if (worldGrid[x][z] === 2) {
        barriers.push({ position: new THREE.Vector3(worldX, 0, worldZ), rotation: (x + z) % 2 ? 0 : Math.PI / 2 });
      } else if (worldGrid[x][z] === 3) {
        spawns.push({ position: new THREE.Vector3(worldX, 0.05, worldZ) });
        spawnMarkers.push(new THREE.Vector3(worldX, 0, worldZ));
      }
    }
  }

  // Deterministic set dressing: props remain visual only and never occupy a
  // collision cell. The type and rotation are fixed for reproducible captures.
  const dressingPositions = [
    [2, 2], [9, 2], [2, 9], [9, 9], [5, 2], [6, 2], [5, 9], [6, 9]
  ];
  const crates = [];
  const drums = [];

  dressingPositions.forEach(([x, z], i) => {
    if (worldGrid[x][z] === 0) { // Only place on empty cells
      const worldX = x * CELL_SIZE - offset;
      const worldZ = z * CELL_SIZE - offset;
      const placement = { position: new THREE.Vector3(worldX, 0, worldZ), rotation: i * Math.PI / 2 };
      (i % 2 === 0 ? crates : drums).push(placement);
    }
  });

  addInstancedWorldAsset(worldAssets.ground_slab, slabs, 'ground-slab');
  addInstancedWorldAsset(worldAssets.wall_block, walls, 'wall-block');
  addInstancedWorldAsset(worldAssets.barrier_low, barriers, 'barrier-low');
  addInstancedWorldAsset(worldAssets.spawn_marker, spawns, 'spawn-marker');
  addInstancedWorldAsset(worldAssets.crate_supply, crates, 'crate-supply');
  addInstancedWorldAsset(worldAssets.fuel_drum, drums, 'fuel-drum');

  console.log('[BOLTWORKS] World layout built:', wallCount, 'walls,', barrierCount, 'barriers,', spawnCount, 'spawns');
}

function measureTankCollisionRadius(tank) {
  const bounds = new THREE.Box3().setFromObject(tank);
  const size = bounds.getSize(new THREE.Vector3());
  // A circle based on the actual rendered footprint stays stable as the tank
  // turns, unlike a world-aligned bounding box that changes with rotation.
  return Math.max(0.45, Math.hypot(size.x, size.z) * 0.5);
}

function checkWallCollision(position, radius = playerTank?.userData.collisionRadius || 1) {
  // If world grid is not initialized, no collision
  if (worldGrid.length === 0) return false;

  const offset = (GRID_SIZE * CELL_SIZE) / 2 - CELL_SIZE / 2;
  const arenaHalf = GRID_SIZE * CELL_SIZE * 0.5;
  if (Math.abs(position.x) + radius > arenaHalf || Math.abs(position.z) + radius > arenaHalf) return true;

  // Test the tank's circular footprint against the actual wall cube bounds.
  // Grid cells only choose placement; they are not four-metre-wide colliders.
  const minX = Math.max(0, Math.floor((position.x - radius + offset) / CELL_SIZE));
  const maxX = Math.min(GRID_SIZE - 1, Math.floor((position.x + radius + offset) / CELL_SIZE));
  const minZ = Math.max(0, Math.floor((position.z - radius + offset) / CELL_SIZE));
  const maxZ = Math.min(GRID_SIZE - 1, Math.floor((position.z + radius + offset) / CELL_SIZE));

  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      if (worldGrid[x][z] !== 1) continue;
      const wallX = x * CELL_SIZE - offset;
      const wallZ = z * CELL_SIZE - offset;
      const nearestX = THREE.MathUtils.clamp(position.x, wallX - WALL_HALF_EXTENT, wallX + WALL_HALF_EXTENT);
      const nearestZ = THREE.MathUtils.clamp(position.z, wallZ - WALL_HALF_EXTENT, wallZ + WALL_HALF_EXTENT);
      if (Math.hypot(position.x - nearestX, position.z - nearestZ) < radius) return true;
    }
  }

  // Low barriers are deliberate visual cover: tanks and enemy shots pass over
  // them, while full wall blocks remain solid.
  return false;
}

// Input handling
function setupInput() {
  const stick = document.getElementById('stick');
  const stickBase = document.getElementById('stickbase');
  const stickNub = document.getElementById('sticknub');
  const fireBtn = document.getElementById('bfire');
  
  let stickActive = false;
  let stickCenter = { x: 0, y: 0 };
  
  // Touch controls
  stick.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = stick.getBoundingClientRect();
    stickCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    stickActive = true;
    stick.classList.add('active');
    stickBase.style.opacity = '1';
    stickNub.style.opacity = '1';
  });
  
  stick.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!stickActive) return;
    
    const touch = e.touches[0];
    const dx = touch.clientX - stickCenter.x;
    const dy = touch.clientY - stickCenter.y;
    
    // Normalize to -1 to 1
    const maxDist = 40;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), maxDist);
    const normDist = dist / maxDist;
    
    input.x = (dx / maxDist) * Math.min(normDist * 1.5, 1);
    input.y = (dy / maxDist) * Math.min(normDist * 1.5, 1);
    
    // Update stick nub visual
    stickNub.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  
  stick.addEventListener('touchend', (e) => {
    e.preventDefault();
    stickActive = false;
    stick.classList.remove('active');
    input.x = 0;
    input.y = 0;
    stickBase.style.opacity = '0';
    stickNub.style.opacity = '0';
    stickNub.style.transform = 'translate(0, 0)';
  });
  
  // Fire button
  fireBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    input.fire = true;
    fireBtn.classList.add('dn');
  });
  
  fireBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    input.fire = false;
    fireBtn.classList.remove('dn');
  });

  const captureFrame = (source) => {
    renderer.render(scene, camera);
    const dataURL = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `boltworks_frame_${Date.now()}.png`;
    a.click();
    console.log(`[BOLTWORKS] Frame captured via ${source}`);
  };

  // Capture button. A touch produces a synthetic click on many mobile browsers,
  // so explicitly suppress that click after handling the touch ourselves.
  const capBtn = document.getElementById('bcap');
  let lastCaptureTouch = -Infinity;
  capBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (performance.now() - lastCaptureTouch < 750) return;
    captureFrame('CAP button');
  });

  capBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    lastCaptureTouch = performance.now();
    capBtn.classList.add('dn');
    captureFrame('CAP touch');
  }, { passive: false });
  capBtn.addEventListener('touchend', () => capBtn.classList.remove('dn'), { passive: true });
  capBtn.addEventListener('touchcancel', () => capBtn.classList.remove('dn'), { passive: true });

  // Keyboard fallback for desktop
  const keys = {};
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    updateKeys();
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if (e.code === 'KeyC') window.__CAPTURE_TRIGGERED__ = false;
    updateKeys();
  });
  
  function updateKeys() {
    input.x = (keys['ArrowRight'] ? 1 : 0) - (keys['ArrowLeft'] ? 1 : 0);
    input.y = (keys['ArrowDown'] ? 1 : 0) - (keys['ArrowUp'] ? 1 : 0);
    input.fire = keys['Space'] || false;

    if (input.fire) fireBtn.classList.add('dn');
    else fireBtn.classList.remove('dn');

    // Debug: trigger wave with 'W' key
    if (keys['KeyW'] && !window.__WAVE_TRIGGERED__) {
      window.__WAVE_TRIGGERED__ = true;
      startWave(1);
    }

    // Debug: capture frame with 'C' key
    if (keys['KeyC'] && !window.__CAPTURE_TRIGGERED__) {
      window.__CAPTURE_TRIGGERED__ = true;
      captureFrame('keyboard');
    }
  }

  // Console command: window.captureFrame()
  window.captureFrame = () => {
    captureFrame('console');
  };
  
  // Start button
  document.getElementById('startb').addEventListener('click', () => {
    window.__START__();
  });
  document.getElementById('retryb').addEventListener('click', () => { audio.init(); resetRun(); });
  document.getElementById('againb').addEventListener('click', () => { audio.init(); resetRun(); });
  document.getElementById('gameover-exit').addEventListener('click', exitToTitle);
  document.getElementById('victory-exit').addEventListener('click', exitToTitle);

  const muteBtn = document.getElementById('muteb');
  if (muteBtn) {
    muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      audio.init();
      const muted = audio.toggleMute();
      muteBtn.textContent = muted ? '🔇' : '🔊';
      muteBtn.setAttribute('aria-label', muted ? 'Unmute Sound' : 'Mute Sound');
    });
  }
  
  // Resize handler
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 25;
    camera.left = frustumSize * aspect / -2;
    camera.right = frustumSize * aspect / 2;
    camera.top = frustumSize / 2;
    camera.bottom = frustumSize / -2;
    camera.updateProjectionMatrix();
  });
}

// Start
console.log('[BOLTWORKS] Starting init...');
init().then(() => {
  console.log('[BOLTWORKS] Init resolved, setting up input');
  setupInput();
  console.log('[BOLTWORKS] Input setup complete');
}).catch((e) => {
  console.error('[BOLTWORKS] Init rejected:', e);
  console.error('[BOLTWORKS] Stack:', e.stack);
});
