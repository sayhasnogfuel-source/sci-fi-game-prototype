import * as THREE from "https://unpkg.com/three@0.164.1/build/three.module.js";

// -------------------------
// Core scene setup
// -------------------------
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x09182b, 0.024);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 3.2, 7.5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// -------------------------
// HUD / UI references
// -------------------------
const startScreen = document.getElementById("startScreen");
const gameOverScreen = document.getElementById("gameOverScreen");
const gameOverTitle = document.getElementById("gameOverTitle");
const gameOverReason = document.getElementById("gameOverReason");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const healthFill = document.getElementById("healthFill");
const ammoValue = document.getElementById("ammoValue");
const scoreValue = document.getElementById("scoreValue");
const missionText = document.getElementById("topCenter");

// -------------------------
// Gameplay constants/state
// -------------------------
const MAP_SIZE = 48;
const MAX_KILLS = 10;
let gameState = "start";
let score = 0;
let kills = 0;
let extractionOpen = false;
let canShoot = true;
let ammo = 40;
let reloadCooldown = 0;
let damageFlash = 0;
let shakeTimer = 0;
let shootTimer = 0;

const keys = { w: false, a: false, s: false, d: false, jump: false, aim: false, shoot: false };
const raycaster = new THREE.Raycaster();
const clock = new THREE.Clock();

const player = {
  group: new THREE.Group(),
  vel: new THREE.Vector3(),
  health: 100,
  grounded: true,
  yaw: 0,
  pitch: 0,
  moveSpeed: 9,
  isAiming: false,
};

const bullets = [];
const enemyBullets = [];
const enemies = [];
const particles = [];
const colliders = [];

// -------------------------
// Audio (simple generated tones)
// -------------------------
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playBeep(freq = 240, duration = 0.06, type = "square", gainVal = 0.03) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = gainVal;
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  osc.stop(audioCtx.currentTime + duration);
}

// -------------------------
// Visual environment
// -------------------------
function buildEnvironment() {
  const hemi = new THREE.HemisphereLight(0x55c3ff, 0x190d31, 0.8);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xff9555, 1.1);
  keyLight.position.set(14, 24, 8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -30;
  keyLight.shadow.camera.right = 30;
  keyLight.shadow.camera.top = 30;
  keyLight.shadow.camera.bottom = -30;
  scene.add(keyLight);

  const blueFill = new THREE.PointLight(0x35c9ff, 2.4, 80, 2);
  blueFill.position.set(-8, 6, -6);
  scene.add(blueFill);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x10192a, metalness: 0.7, roughness: 0.4 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(120, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x112544, side: THREE.BackSide })
  );
  scene.add(sky);

  const borderMat = new THREE.MeshStandardMaterial({ color: 0x1b2940, metalness: 0.8, roughness: 0.3 });
  const wallGeo = new THREE.BoxGeometry(MAP_SIZE, 3.5, 1);
  const wallZ = MAP_SIZE / 2;
  addStaticMesh(new THREE.Mesh(wallGeo, borderMat), 0, 1.75, wallZ);
  addStaticMesh(new THREE.Mesh(wallGeo, borderMat), 0, 1.75, -wallZ);

  const sideGeo = new THREE.BoxGeometry(1, 3.5, MAP_SIZE);
  addStaticMesh(new THREE.Mesh(sideGeo, borderMat), wallZ, 1.75, 0);
  addStaticMesh(new THREE.Mesh(sideGeo, borderMat), -wallZ, 1.75, 0);

  // Raised platforms and covers
  for (let i = 0; i < 7; i++) {
    const w = 4 + Math.random() * 4;
    const d = 3 + Math.random() * 5;
    const h = 1.2 + Math.random() * 1.6;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0x152a42 : 0x25354d, metalness: 0.75, roughness: 0.34 })
    );
    const px = (Math.random() - 0.5) * 28;
    const pz = (Math.random() - 0.5) * 22;
    addStaticMesh(box, px, h / 2, pz);
  }

  // Sci-fi crates
  for (let i = 0; i < 14; i++) {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 1.6, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x283447, metalness: 0.95, roughness: 0.24, emissive: 0x0e2135 })
    );
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(1.62, 0.14, 1.62),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0x39c6ff : 0xff8c2d })
    );
    const x = (Math.random() - 0.5) * 28;
    const z = (Math.random() - 0.5) * 20;
    addStaticMesh(crate, x, 0.8, z);
    glow.position.set(x, 1.65, z);
    scene.add(glow);
  }

  // Energy barriers + extraction gate
  for (let i = 0; i < 3; i++) {
    const barrier = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 2.6),
      new THREE.MeshBasicMaterial({ color: 0x44cfff, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    barrier.position.set(-12 + i * 10, 1.4, 14);
    scene.add(barrier);
  }

  extractionGate.door.position.set(0, 2.4, -18);
  scene.add(extractionGate.door);
  scene.add(extractionGate.glow);
}

function addStaticMesh(mesh, x, y, z) {
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  colliders.push(new THREE.Box3().setFromObject(mesh));
}

// -------------------------
// Player and enemy creation
// -------------------------
function buildPlayer() {
  const armor = new THREE.MeshStandardMaterial({ color: 0x2d4264, metalness: 0.92, roughness: 0.25, emissive: 0x081222 });
  const visor = new THREE.MeshStandardMaterial({ color: 0x3bd0ff, emissive: 0x2ca4cf, metalness: 0.7, roughness: 0.15 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 1.0, 5, 10), armor);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 14), visor);
  head.position.y = 0.95;

  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.72), new THREE.MeshStandardMaterial({ color: 0x5a6d8c, metalness: 0.85, roughness: 0.3 }));
  gun.position.set(0.25, 0.55, 0.35);

  player.group.add(body, head, gun);
  player.group.position.set(0, 1.1, 14);
  player.group.castShadow = true;
  scene.add(player.group);
}

function spawnEnemy(x, z) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x4f667e, metalness: 0.85, roughness: 0.25, emissive: 0x1f3148 })
  );
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff6d2f }));
  eye.position.set(0, 0, 0.34);
  g.add(core, eye);

  for (let i = 0; i < 3; i++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.5), new THREE.MeshStandardMaterial({ color: 0x6f85a0, metalness: 0.9, roughness: 0.2 }));
    arm.rotation.y = (Math.PI * 2 * i) / 3;
    arm.position.set(Math.sin(arm.rotation.y) * 0.48, 0, Math.cos(arm.rotation.y) * 0.48);
    g.add(arm);
  }

  g.position.set(x, 1.25, z);
  g.castShadow = true;
  scene.add(g);

  enemies.push({
    mesh: g,
    hp: 40,
    cooldown: Math.random() * 0.8,
    bob: Math.random() * Math.PI,
    speed: 2 + Math.random() * 1.4,
  });
}

function spawnWave() {
  while (enemies.length < 6 && kills < MAX_KILLS) {
    const side = Math.floor(Math.random() * 4);
    const offset = (Math.random() - 0.5) * 30;
    if (side === 0) spawnEnemy(-18, offset);
    if (side === 1) spawnEnemy(18, offset);
    if (side === 2) spawnEnemy(offset, -14);
    if (side === 3) spawnEnemy(offset, 10);
  }
}

// -------------------------
// Extraction gate
// -------------------------
const extractionGate = {
  door: new THREE.Mesh(
    new THREE.BoxGeometry(6, 4.8, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x293753, metalness: 0.92, roughness: 0.3, emissive: 0x10213a })
  ),
  glow: new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 3.7),
    new THREE.MeshBasicMaterial({ color: 0x3bd0ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
  ),
};
extractionGate.glow.position.set(0, 2.4, -17.65);

// -------------------------
// Input setup
// -------------------------
const mobile = {
  active: window.matchMedia("(pointer: coarse)").matches,
  joyId: null,
  joyX: 0,
  joyY: 0,
};

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyW") keys.w = true;
  if (e.code === "KeyA") keys.a = true;
  if (e.code === "KeyS") keys.s = true;
  if (e.code === "KeyD") keys.d = true;
  if (e.code === "Space") keys.jump = true;
});
window.addEventListener("keyup", (e) => {
  if (e.code === "KeyW") keys.w = false;
  if (e.code === "KeyA") keys.a = false;
  if (e.code === "KeyS") keys.s = false;
  if (e.code === "KeyD") keys.d = false;
  if (e.code === "Space") keys.jump = false;
});
window.addEventListener("mousedown", (e) => {
  if (e.button === 0) keys.shoot = true;
  if (e.button === 2) keys.aim = true;
});
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) keys.shoot = false;
  if (e.button === 2) keys.aim = false;
});
window.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("mousemove", (e) => {
  if (gameState !== "playing") return;
  player.yaw -= e.movementX * 0.0028;
  player.pitch -= e.movementY * 0.0015;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -0.5, 0.5);
});

const joystickBase = document.getElementById("joystickBase");
const joystickKnob = document.getElementById("joystickKnob");
const jumpBtn = document.getElementById("jumpBtn");
const shootBtn = document.getElementById("shootBtn");

if (mobile.active) {
  joystickBase.addEventListener("pointerdown", (e) => (mobile.joyId = e.pointerId));
  joystickBase.addEventListener("pointermove", (e) => {
    if (e.pointerId !== mobile.joyId) return;
    const rect = joystickBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const max = 45;
    const len = Math.hypot(dx, dy);
    const nx = len > max ? (dx / len) * max : dx;
    const ny = len > max ? (dy / len) * max : dy;
    joystickKnob.style.transform = `translate(${nx}px, ${ny}px)`;
    mobile.joyX = nx / max;
    mobile.joyY = ny / max;
  });
  const endJoy = () => {
    mobile.joyId = null;
    mobile.joyX = 0;
    mobile.joyY = 0;
    joystickKnob.style.transform = "translate(0px, 0px)";
  };
  joystickBase.addEventListener("pointerup", endJoy);
  joystickBase.addEventListener("pointercancel", endJoy);

  jumpBtn.addEventListener("pointerdown", () => (keys.jump = true));
  jumpBtn.addEventListener("pointerup", () => (keys.jump = false));
  shootBtn.addEventListener("pointerdown", () => (keys.shoot = true));
  shootBtn.addEventListener("pointerup", () => (keys.shoot = false));
}

// -------------------------
// Combat helpers
// -------------------------
function shoot(fromEnemy = false, source = player.group, targetPos = null) {
  const mat = new THREE.MeshBasicMaterial({ color: fromEnemy ? 0xff8a3b : 0x53d7ff });
  const proj = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), mat);
  proj.position.copy(source.position).add(new THREE.Vector3(0, 0.45, 0));

  let dir = new THREE.Vector3();
  if (fromEnemy && targetPos) {
    dir.copy(targetPos).sub(source.position).normalize();
  } else {
    camera.getWorldDirection(dir);
  }

  scene.add(proj);
  const pack = { mesh: proj, vel: dir.multiplyScalar(fromEnemy ? 16 : 30), life: 2.2, enemy: fromEnemy };
  (fromEnemy ? enemyBullets : bullets).push(pack);
  playBeep(fromEnemy ? 180 : 440, 0.05, "square", fromEnemy ? 0.02 : 0.03);
}

function explode(position, color = 0xff8a3b) {
  for (let i = 0; i < 24; i++) {
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 6, 6),
      new THREE.MeshBasicMaterial({ color })
    );
    p.position.copy(position);
    scene.add(p);
    particles.push({
      mesh: p,
      vel: new THREE.Vector3((Math.random() - 0.5) * 10, Math.random() * 8, (Math.random() - 0.5) * 10),
      life: 1,
    });
  }
  playBeep(80, 0.15, "sawtooth", 0.07);
}

// -------------------------
// Update loops
// -------------------------
function updatePlayer(dt) {
  if (keys.jump && player.grounded) {
    player.vel.y = 8;
    player.grounded = false;
    playBeep(320, 0.04, "triangle", 0.03);
  }

  const move = new THREE.Vector3();
  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);

  if (mobile.active) {
    move.addScaledVector(forward, -mobile.joyY).addScaledVector(right, mobile.joyX);
  } else {
    if (keys.w) move.add(forward);
    if (keys.s) move.sub(forward);
    if (keys.a) move.sub(right);
    if (keys.d) move.add(right);
  }

  if (move.lengthSq() > 0) move.normalize();
  player.group.position.addScaledVector(move, dt * player.moveSpeed);

  player.vel.y -= 20 * dt;
  player.group.position.y += player.vel.y * dt;

  if (player.group.position.y <= 1.1) {
    player.group.position.y = 1.1;
    player.vel.y = 0;
    player.grounded = true;
  }

  player.group.position.x = THREE.MathUtils.clamp(player.group.position.x, -22, 22);
  player.group.position.z = THREE.MathUtils.clamp(player.group.position.z, -22, 22);

  player.group.rotation.y = player.yaw;
  player.isAiming = keys.aim;
}

function updateCamera(dt) {
  const back = player.isAiming ? 4.5 : 6.7;
  const up = player.isAiming ? 2.6 : 3.3;
  const desired = new THREE.Vector3(
    player.group.position.x - Math.sin(player.yaw) * back,
    player.group.position.y + up + Math.sin(player.pitch) * 1.3,
    player.group.position.z - Math.cos(player.yaw) * back
  );

  const shake = shakeTimer > 0 ? 0.16 : 0;
  camera.position.lerp(desired, dt * 6);
  camera.position.x += (Math.random() - 0.5) * shake;
  camera.position.y += (Math.random() - 0.5) * shake;

  const lookAt = player.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
  camera.lookAt(lookAt);
  camera.fov = THREE.MathUtils.lerp(camera.fov, player.isAiming ? 58 : 70, dt * 8);
  camera.updateProjectionMatrix();
}

function updateEnemies(dt) {
  enemies.forEach((enemy) => {
    enemy.bob += dt * 4;
    enemy.mesh.position.y = 1.2 + Math.sin(enemy.bob) * 0.2;

    const toPlayer = player.group.position.clone().sub(enemy.mesh.position);
    const dist = toPlayer.length();
    const dir = toPlayer.normalize();

    if (dist > 4.8) {
      enemy.mesh.position.addScaledVector(dir, dt * enemy.speed);
    }

    enemy.mesh.lookAt(player.group.position.x, enemy.mesh.position.y, player.group.position.z);
    enemy.cooldown -= dt;
    if (enemy.cooldown <= 0 && dist < 24) {
      enemy.cooldown = 1 + Math.random() * 1.4;
      shoot(true, enemy.mesh, player.group.position.clone().add(new THREE.Vector3(0, 0.8, 0)));
    }
  });
}

function updateProjectiles(dt) {
  const removeAt = (arr, i) => {
    scene.remove(arr[i].mesh);
    arr.splice(i, 1);
  };

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.mesh.position.addScaledVector(b.vel, dt);
    b.life -= dt;
    if (b.life <= 0) {
      removeAt(bullets, i);
      continue;
    }

    let hit = false;
    for (let e = enemies.length - 1; e >= 0; e--) {
      const enemy = enemies[e];
      if (b.mesh.position.distanceTo(enemy.mesh.position) < 0.65) {
        enemy.hp -= 20;
        removeAt(bullets, i);
        hit = true;

        if (enemy.hp <= 0) {
          explode(enemy.mesh.position, 0x4fd7ff);
          scene.remove(enemy.mesh);
          enemies.splice(e, 1);
          score += 120;
          kills += 1;
          scoreValue.textContent = score;
          missionText.textContent = kills >= MAX_KILLS
            ? "Objective clear! Reach the extraction gate."
            : `Destroy drones: ${kills}/${MAX_KILLS}`;
        }
        break;
      }
    }
    if (!hit && (Math.abs(b.mesh.position.x) > 25 || Math.abs(b.mesh.position.z) > 25)) removeAt(bullets, i);
  }

  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.mesh.position.addScaledVector(b.vel, dt);
    b.life -= dt;

    if (b.life <= 0 || Math.abs(b.mesh.position.x) > 28 || Math.abs(b.mesh.position.z) > 28) {
      removeAt(enemyBullets, i);
      continue;
    }

    if (b.mesh.position.distanceTo(player.group.position.clone().add(new THREE.Vector3(0, 0.8, 0))) < 0.8) {
      removeAt(enemyBullets, i);
      player.health -= 9;
      shakeTimer = 0.18;
      damageFlash = 0.3;
      playBeep(130, 0.08, "square", 0.05);
      if (player.health <= 0) {
        player.health = 0;
        endGame(false, "Your armor was destroyed by drones.");
      }
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.y -= 18 * dt;
    p.life -= dt;
    p.mesh.scale.setScalar(Math.max(0.05, p.life));
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }
}

function checkExtraction() {
  if (kills >= MAX_KILLS && !extractionOpen) {
    extractionOpen = true;
    extractionGate.glow.material.opacity = 0.65;
    extractionGate.glow.material.color.setHex(0x66ffbf);
    extractionGate.door.material.emissive.setHex(0x1b3e31);
  }

  if (extractionOpen) {
    const atGate = player.group.position.distanceTo(new THREE.Vector3(0, 1.1, -16.8)) < 3.2;
    if (atGate) {
      endGame(true, "Extraction successful. Prototype mission complete.");
    }
  }
}

function applyPostFX(dt) {
  damageFlash = Math.max(0, damageFlash - dt);
  if (damageFlash > 0) {
    scene.background = new THREE.Color(0x2d1010);
  } else {
    scene.background = new THREE.Color(0x0b1526);
  }
  shakeTimer = Math.max(0, shakeTimer - dt);
}

// -------------------------
// Game state helpers
// -------------------------
function resetGame() {
  score = 0;
  kills = 0;
  ammo = 40;
  player.health = 100;
  extractionOpen = false;
  scoreValue.textContent = "0";
  ammoValue.textContent = "40";
  healthFill.style.width = "100%";
  missionText.textContent = "Destroy 10 drones and reach the extraction gate";

  player.group.position.set(0, 1.1, 14);
  player.vel.set(0, 0, 0);
  player.yaw = Math.PI;
  player.pitch = 0;

  enemies.forEach((e) => scene.remove(e.mesh));
  enemies.length = 0;
  bullets.forEach((b) => scene.remove(b.mesh));
  bullets.length = 0;
  enemyBullets.forEach((b) => scene.remove(b.mesh));
  enemyBullets.length = 0;
  particles.forEach((p) => scene.remove(p.mesh));
  particles.length = 0;

  extractionGate.glow.material.opacity = 0.2;
  extractionGate.glow.material.color.setHex(0x3bd0ff);
  extractionGate.door.material.emissive.setHex(0x10213a);

  spawnWave();
}

function startGame() {
  gameState = "playing";
  startScreen.classList.remove("visible");
  gameOverScreen.classList.remove("visible");
  resetGame();
}

function endGame(win, reason) {
  if (gameState !== "playing") return;
  gameState = "ended";
  gameOverScreen.classList.add("visible");
  gameOverTitle.textContent = win ? "Mission Complete" : "Mission Failed";
  gameOverReason.textContent = `${reason} Score: ${score}`;
}

startBtn.addEventListener("click", async () => {
  if (audioCtx.state !== "running") await audioCtx.resume();
  startGame();
});
restartBtn.addEventListener("click", () => startGame());

// -------------------------
// Main loop
// -------------------------
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);

  if (gameState === "playing") {
    updatePlayer(dt);
    updateCamera(dt);

    shootTimer -= dt;
    reloadCooldown -= dt;

    if (keys.shoot && shootTimer <= 0 && ammo > 0) {
      shoot(false);
      shootTimer = 0.13;
      ammo -= 1;
      ammoValue.textContent = ammo;
      shakeTimer = 0.08;
    }

    if (ammo <= 0 && reloadCooldown <= 0) {
      reloadCooldown = 1.6;
      setTimeout(() => {
        ammo = 40;
        ammoValue.textContent = ammo;
        playBeep(520, 0.08, "triangle", 0.04);
      }, 1500);
    }

    if (Math.random() < 0.012) spawnWave();

    updateEnemies(dt);
    updateProjectiles(dt);
    updateParticles(dt);
    checkExtraction();

    healthFill.style.width = `${player.health}%`;
  }

  applyPostFX(dt);
  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

buildEnvironment();
buildPlayer();
animate();
