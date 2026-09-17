/**
 * BOLTWORKS — boot, loop and mission
 *
 * Isometric arcade tank game for 404 Game Jam
 */
console.log('[BOLTWORKS] main.js loaded');

import * as THREE from 'three';
import { ASSET } from '../assetlib.js?v=202609160104';
import { setSurfaceDefaults } from '../surfaces.js?v=202609160104';

console.log('[BOLTWORKS] Imports complete');

const canvas = document.getElementById('c');
const loadEl = document.getElementById('load');
const barf = document.getElementById('barf');
const loadmsg = document.getElementById('loadmsg');
const startScreen = document.getElementById('start');

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

// World state
let worldAssets = {};
let worldRoot = null;
let worldGrid = []; // 12x12 grid: 0 = empty, 1 = wall, 2 = barrier, 3 = spawn
const GRID_SIZE = 12;
const CELL_SIZE = 4; // metres
const WALL_HALF_EXTENT = 0.5; // wall_block is a 1m cube
let spawnMarkers = [];

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

// Telemetry for gate
window.__READY__ = false;
window.__START__ = () => {
  if (!gameReady) return;
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
  scene.background = new THREE.Color(0x0a0b0c);
  
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
  
  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);
  
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 50;
  dirLight.shadow.camera.left = -20;
  dirLight.shadow.camera.right = 20;
  dirLight.shadow.camera.top = 20;
  dirLight.shadow.camera.bottom = -20;
  scene.add(dirLight);
  
  // Shell pool (instanced)
  const shellGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.6, 8);
  const shellMat = new THREE.MeshBasicMaterial({ color: 0xffb45a });
  const maxShells = 50;
  const shellMesh = new THREE.InstancedMesh(shellGeo, shellMat, maxShells);
  shellMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(shellMesh);

  // Initialize shell data
  for (let i = 0; i < maxShells; i++) {
    shells.push({
      active: false,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      lifetime: 0
    });
    const dummy = new THREE.Object3D();
    dummy.position.set(0, -100, 0); // Hide inactive shells
    dummy.updateMatrix();
    shellMesh.setMatrixAt(i, dummy.matrix);
  }
  shellMesh.instanceMatrix.needsUpdate = true;

  // Load enemy assets
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
    
  } catch (e) {
    loadmsg.textContent = 'error: ' + e.message;
    console.error('[BOLTWORKS] ERROR during init:', e);
    console.error('[BOLTWORKS] Stack:', e.stack);
  }
}

function loop(time) {
  requestAnimationFrame(loop);

  if (!gameStarted) return;

  const dt = Math.min((time - lastTime) / 1000, 0.1);
  lastTime = time;

  // Assembly and end states still render, but never run code that assumes a
  // player tank exists. This is a state transition, not a null-object dodge.
  if (gameState !== 'playing') {
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

  // Render
  renderer.render(scene, camera);
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
  shell.position.copy(playerTank.position);
  shell.position.y += 1.5;
  shell.velocity.set(
    Math.sin(angle) * speed,
    0,
    Math.cos(angle) * speed
  );
  shell.lifetime = 2; // seconds

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
      dummy.position.set(0, -100, 0);
      dummy.updateMatrix();
      scene.children.find(c => c.isInstancedMesh)?.setMatrixAt(i, dummy.matrix);
      needsUpdate = true;
      return;
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

    // Collision with player (ram damage)
    if (dist < 2) {
      playerHP -= config.damage * dt * 0.5; // Reduced ram damage
      window.__GAME__.hp = playerHP;
    }
  });

  // Check shell-enemy collisions
  shells.forEach(shell => {
    if (!shell.active) return;

    enemies.forEach((enemy, eIndex) => {
      const dist = shell.position.distanceTo(enemy.mesh.position);
      if (dist < 2.0) { // Increased hit radius
        // Hit enemy
        console.log('[BOLTWORKS] Shell hit enemy! Distance:', dist);
        enemy.hp -= 20;
        shell.active = false;

        // Kill enemy
        if (enemy.hp <= 0) {
          console.log('[BOLTWORKS] Enemy destroyed!');
          scene.remove(enemy.mesh);
          enemies.splice(eIndex, 1);
          waveKills++;
          window.__GAME__.kills = waveKills;
          window.__GAME__.alive = enemies.length;
        }
      }
    });
  });
}

function enemyFire(enemy) {
  // Simple enemy fire - damage player if in range
  const dist = enemy.mesh.position.distanceTo(playerTank.position);
  const config = ENEMY_TYPES[enemy.type];

  if (dist <= config.range) {
    playerHP -= config.damage * 0.05; // Very low damage per shot for balance
    window.__GAME__.hp = playerHP;
  }
}

function checkGameState() {
  if (gameOver || waveWin) return;

  // Lose condition
  if (playerHP <= 0) {
    gameOver = true;
    gameState = 'gameover';
    window.__GAME__.over = true;
    console.log('[BOLTWORKS] Game Over - Player destroyed');
    return;
  }

  // Win condition - wave cleared
  if (waveKills >= waveTotal && waveTotal > 0) {
    waveWin = true;
    gameState = 'transitioning';
    window.__GAME__.wave = wave;
    console.log('[BOLTWORKS] Wave', wave, 'cleared');

    // Start next wave after delay
    setTimeout(() => {
      if (wave < 3) {
        startWave(wave + 1);
      } else {
        gameOver = true;
        gameState = 'victory';
        window.__GAME__.over = true;
        console.log('[BOLTWORKS] Victory - All waves cleared');
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

  console.log('[BOLTWORKS] Starting wave', wave);

  // Module assembly between waves
  if (wave > 1) {
    await rebuildTank();
  }

  // Spawn enemies at spawn markers (or fallback to circle if no markers)
  const types = ['rusher', 'shooter', 'heavy'];
  for (let i = 0; i < waveTotal; i++) {
    const type = types[i % 3];
    let pos;

    if (spawnMarkers.length > 0) {
      // Use spawn markers cyclically
      const spawnIndex = i % spawnMarkers.length;
      pos = spawnMarkers[spawnIndex].clone();
      // Add slight random offset to prevent stacking
      pos.x += (Math.random() - 0.5) * 2;
      pos.z += (Math.random() - 0.5) * 2;
    } else {
      // Fallback: spawn in circle at safe distance
      const angle = (i / waveTotal) * Math.PI * 2;
      const dist = 15 + Math.random() * 5;
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
    captureFrame('CAP touch');
  }, { passive: false });

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
