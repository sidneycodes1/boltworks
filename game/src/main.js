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
  rusher: { hp: 30, speed: 8, damage: 5, range: 0 },
  shooter: { hp: 40, speed: 4, damage: 8, range: 15, fireRate: 3 },
  heavy: { hp: 80, speed: 2, damage: 12, range: 20, fireRate: 4 }
};

// Telemetry for gate
window.__READY__ = false;
window.__START__ = () => {
  if (!gameReady) return;
  gameStarted = true;
  startScreen.classList.remove('on');
  lastTime = performance.now();

  // Start first wave
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
  
  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.9 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Shell pool (instanced)
  const shellGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8);
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

    console.log('[BOLTWORKS] Tank added to scene');

    // Hide loading screen
    console.log('[BOLTWORKS] Hiding loading screen');
    loadEl.style.display = 'none';

    // Camera follow
    camera.position.set(playerTank.position.x + 15, playerTank.position.y + 15, playerTank.position.z + 15);
    camera.lookAt(playerTank.position);
    
    loadmsg.textContent = 'ready';
    barf.style.width = '100%';

    console.log('[BOLTWORKS] Setting gameReady = true');
    gameReady = true;
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

  // Update tank position based on input
  const speed = 5; // m/s
  if (input.x !== 0 || input.y !== 0) {
    const moveX = input.x * speed * dt;
    const moveZ = input.y * speed * dt;
    playerTank.position.x += moveX;
    playerTank.position.z += moveZ;

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
  if (!shell) return;

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
      enemy.mesh.position.addScaledVector(toPlayer, config.speed * dt);
      enemy.mesh.lookAt(playerTank.position);
    } else if (enemy.type === 'shooter') {
      // Maintain range, fire at player
      if (dist > config.range) {
        toPlayer.normalize();
        enemy.mesh.position.addScaledVector(toPlayer, config.speed * dt);
      } else if (dist < config.range * 0.7) {
        toPlayer.normalize();
        enemy.mesh.position.addScaledVector(toPlayer, -config.speed * dt);
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
      enemy.mesh.position.addScaledVector(toPlayer, config.speed * dt);
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
      if (dist < 1.5) {
        // Hit enemy
        enemy.hp -= 20;
        shell.active = false;

        // Kill enemy
        if (enemy.hp <= 0) {
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
    playerHP -= config.damage * 0.15; // Further reduced damage per shot
    window.__GAME__.hp = playerHP;
  }
}

function checkGameState() {
  if (gameOver || waveWin) return;

  // Lose condition
  if (playerHP <= 0) {
    gameOver = true;
    window.__GAME__.over = true;
    console.log('[BOLTWORKS] Game Over - Player destroyed');
    return;
  }

  // Win condition - wave cleared
  if (waveKills >= waveTotal && waveTotal > 0) {
    waveWin = true;
    window.__GAME__.wave = wave;
    console.log('[BOLTWORKS] Wave', wave, 'cleared');

    // Start next wave after delay
    setTimeout(() => {
      if (wave < 3) {
        startWave(wave + 1);
      } else {
        gameOver = true;
        window.__GAME__.over = true;
        console.log('[BOLTWORKS] Victory - All waves cleared');
      }
    }, 2000);
    return;
  }
}

function startWave(waveNum) {
  wave = waveNum;
  waveKills = 0;
  waveTotal = waveNum * 3; // More enemies each wave
  waveWin = false;

  console.log('[BOLTWORKS] Starting wave', wave);

  // Module assembly between waves
  if (wave > 1) {
    rebuildTank();
  }

  // Spawn enemies
  const types = ['rusher', 'shooter', 'heavy'];
  for (let i = 0; i < waveTotal; i++) {
    const type = types[i % 3];
    const angle = (i / waveTotal) * Math.PI * 2;
    const dist = 15 + Math.random() * 5;
    const pos = new THREE.Vector3(
      Math.sin(angle) * dist,
      0,
      Math.cos(angle) * dist
    );
    spawnEnemy(type, pos);
  }

  window.__GAME__.wave = wave;
  window.__GAME__.alive = enemies.length;
}

function rebuildTank() {
  inAssembly = true;
  console.log('[BOLTWORKS] Rebuilding tank for wave', wave);

  // Select new modules based on wave
  const modules = window.__MODULE_ASSETS__;
  if (!modules) return;

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

  // Animate disassembly
  disassembleTank().then(() => {
    // Animate reassembly with new modules
    assembleTank().then(() => {
      inAssembly = false;
      console.log('[BOLTWORKS] Tank rebuild complete');
    });
  });
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

function assembleTank() {
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

    // Position tank
    playerTank.position.y = 0.2;
    playerTank.castShadow = true;

    // Start with parts scaled down for assembly animation
    playerTank.children.forEach((child) => {
      child.scale.set(0.1, 0.1, 0.1);
      child.rotation.y = Math.random() * Math.PI * 2;
    });

    scene.add(playerTank);

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

  // Capture button
  const capBtn = document.getElementById('bcap');
  capBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const canvas = document.getElementById('c');
    renderer.render(scene, camera);
    const dataURL = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `boltworks_frame_${Date.now()}.png`;
    a.click();
    console.log('[BOLTWORKS] Frame captured');
  });

  capBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const canvas = document.getElementById('c');
    renderer.render(scene, camera);
    const dataURL = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `boltworks_frame_${Date.now()}.png`;
    a.click();
    console.log('[BOLTWORKS] Frame captured');
  });

  // Keyboard fallback for desktop
  const keys = {};
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    updateKeys();
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
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
      const canvas = document.getElementById('c');
      renderer.render(scene, camera);
      const dataURL = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataURL;
      a.download = `boltworks_frame_${Date.now()}.png`;
      a.click();
      console.log('[BOLTWORKS] Frame captured via keyboard');
    }
  }

  // Console command: window.captureFrame()
  window.captureFrame = () => {
    const canvas = document.getElementById('c');
    renderer.render(scene, camera);
    const dataURL = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `boltworks_frame_${Date.now()}.png`;
    a.click();
    console.log('[BOLTWORKS] Frame captured via console');
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