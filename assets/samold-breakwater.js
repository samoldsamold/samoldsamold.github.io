const yard = document.querySelector('[data-tetrapod-yard]');
const stage = document.querySelector('[data-tetrapod-stage]');
const canvas = document.querySelector('[data-tetrapod-canvas]');
const statusNode = document.querySelector('[data-tetrapod-status]');
const dropButton = document.querySelector('[data-tetrapod-drop]');
const clearButton = document.querySelector('[data-tetrapod-clear]');
let currentStatus = statusNode ? { en: statusNode.textContent, cn: statusNode.textContent } : null;

const MODULES = {
  three: 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js',
  cannon: 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js',
  anime: 'https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.es.js'
};

// Fudo Tetra's 20t row lists h=3060mm, leg length l=2539mm, 2r=672mm.
// The scene keeps those ratios: l/h ~= 0.83 and outer radius/h ~= 0.11.
const MODEL_HEIGHT = 1.6;
const ARM_LENGTH = MODEL_HEIGHT * (2539 / 3060);
const OUTER_RADIUS = MODEL_HEIGHT * ((672 / 2) / 3060);
const INNER_RADIUS = OUTER_RADIUS * 0.58;
const CORE_RADIUS = MODEL_HEIGHT * 0.145;
const MAX_BLOCKS = 34;

if (statusNode && 'MutationObserver' in window) {
  new MutationObserver(() => renderStatus()).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['lang']
  });
}

if (yard && stage && canvas && statusNode && dropButton && clearButton) {
  initTetrapodLab().catch(error => {
    console.error(error);
    yard.classList.add('is-engine-error');
    setStatus('3D engine failed to load', '3D 引擎加载失败');
  });
}

async function initTetrapodLab() {
  setStatus('Loading Three.js, Cannon and Anime.js', '正在加载 Three.js、Cannon 和 Anime.js');

  const [THREE, CANNON, animeModule] = await Promise.all([
    import(MODULES.three),
    import(MODULES.cannon),
    import(MODULES.anime).catch(() => null)
  ]);
  const anime = animeModule?.default || animeModule?.anime || null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const state = createSimulation(THREE, CANNON, reducedMotion);
  const impactLayer = createImpactLayer();

  dropButton.addEventListener('click', () => {
    state.dropPile(reducedMotion.matches ? 5 : 12);
    playDropImpact(anime, impactLayer, reducedMotion.matches);
    pulse(anime, dropButton);
  });

  clearButton.addEventListener('click', () => {
    state.clearBlocks();
    playClearSweep(anime, impactLayer, reducedMotion.matches);
    pulse(anime, clearButton);
  });

  state.start();
  setStatus('Cannon ready: four-legged tetrapods', 'Cannon 已就绪：四脚 tetrapod');

  if (!reducedMotion.matches) {
    window.setTimeout(() => {
      state.dropPile(8);
      playDropImpact(anime, impactLayer, reducedMotion.matches);
    }, 720);
  }
}

function createSimulation(THREE, CANNON, reducedMotion) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0)
  });
  const concreteMaterial = new CANNON.Material('tetrapod-concrete');
  const groundMaterial = new CANNON.Material('yard-floor');
  const contact = new CANNON.ContactMaterial(concreteMaterial, groundMaterial, {
    friction: 0.72,
    restitution: 0.12
  });
  const blockContact = new CANNON.ContactMaterial(concreteMaterial, concreteMaterial, {
    friction: 0.84,
    restitution: 0.08
  });
  const blocks = [];
  const clock = new THREE.Clock();
  const directions = tetrapodDirections(THREE);
  const up = new THREE.Vector3(0, 1, 0);

  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  world.allowSleep = true;
  world.solver.iterations = 12;
  world.solver.tolerance = 0.001;
  world.addContactMaterial(contact);
  world.addContactMaterial(blockContact);
  world.defaultContactMaterial.friction = 0.6;
  world.defaultContactMaterial.restitution = 0.08;

  scene.add(new THREE.HemisphereLight(0xe8ffe4, 0x112015, 1.55));
  const key = new THREE.DirectionalLight(0xdfffd8, 2.6);
  key.position.set(-3.2, 5.2, 4.4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9eff67, 1.4);
  rim.position.set(3.4, 2.6, -4.6);
  scene.add(rim);

  const floorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(8.6, 0.08, 4.6),
    new THREE.MeshStandardMaterial({
      color: 0x172217,
      transparent: true,
      opacity: 0.2,
      roughness: 1
    })
  );
  floorMesh.position.set(0, -1.82, 0);
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  const worldBounds = createWorldBounds(CANNON, groundMaterial);
  worldBounds.forEach(body => world.addBody(body));

  function resize() {
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    camera.aspect = width / height;
    camera.position.set(0, 1.9, width < 620 ? 6.7 : 5.45);
    camera.lookAt(0, -0.15, 0);
    camera.updateProjectionMatrix();
  }

  function dropPile(count) {
    for (let index = 0; index < count; index += 1) {
      if (blocks.length >= MAX_BLOCKS) removeBlock(blocks[0]);
      const block = createBlock(THREE, CANNON, directions, up, concreteMaterial);
      const spread = stage.clientWidth < 620 ? 1.25 : 1.9;
      block.body.position.set(
        randomBetween(-spread, spread),
        3.4 + index * 0.24,
        randomBetween(-0.65, 0.65)
      );
      block.body.velocity.set(randomBetween(-0.2, 0.2), reducedMotion.matches ? -0.4 : -1.2, randomBetween(-0.1, 0.1));
      block.body.angularVelocity.set(randomBetween(-1.8, 1.8), randomBetween(-2.2, 2.2), randomBetween(-1.8, 1.8));
      randomizeQuaternion(CANNON, block.body);
      scene.add(block.mesh);
      world.addBody(block.body);
      blocks.push(block);
    }

    setStatus(`${blocks.length} tetrapods in the yard`, `试验槽内 ${blocks.length} 个消波块`);
  }

  function removeBlock(block) {
    world.removeBody(block.body);
    scene.remove(block.mesh);
    block.mesh.traverse(child => {
      if (child.geometry) child.geometry.dispose();
    });
    const index = blocks.indexOf(block);
    if (index >= 0) blocks.splice(index, 1);
  }

  function clearBlocks() {
    [...blocks].forEach(removeBlock);
    setStatus('Cleared: text is visible again', '已清除：文字重新露出');
  }

  function start() {
    resize();
    window.addEventListener('resize', resize, { passive: true });
    tick();
  }

  function tick() {
    requestAnimationFrame(tick);
    const delta = Math.min(clock.getDelta(), 0.033);
    world.step(1 / 60, delta, 3);

    blocks.forEach(block => {
      block.mesh.position.copy(block.body.position);
      block.mesh.quaternion.copy(block.body.quaternion);
    });

    renderer.render(scene, camera);
  }

  return { start, dropPile, clearBlocks };
}

function tetrapodDirections(THREE) {
  const lowerRadius = Math.sqrt(8 / 9);
  const angles = [Math.PI / 2, Math.PI / 2 + (Math.PI * 2) / 3, Math.PI / 2 + (Math.PI * 4) / 3];
  return [
    new THREE.Vector3(0, 1, 0),
    ...angles.map(angle => new THREE.Vector3(
      lowerRadius * Math.cos(angle),
      -1 / 3,
      lowerRadius * Math.sin(angle)
    ))
  ].map(vector => vector.normalize());
}

function createBlock(THREE, CANNON, directions, up, material) {
  const mesh = createTetrapodMesh(THREE, directions, up);
  const body = new CANNON.Body({
    mass: 2.35,
    material,
    linearDamping: 0.06,
    angularDamping: 0.08,
    allowSleep: true,
    sleepSpeedLimit: 0.08,
    sleepTimeLimit: 0.9
  });

  body.addShape(new CANNON.Sphere(CORE_RADIUS * 0.95));
  directions.forEach(direction => {
    const offset = toCannon(direction, ARM_LENGTH * 0.52, CANNON);
    const end = toCannon(direction, ARM_LENGTH, CANNON);
    const armShape = new CANNON.Box(new CANNON.Vec3(INNER_RADIUS * 0.92, ARM_LENGTH * 0.52, INNER_RADIUS * 0.92));
    const armQuaternion = cannonQuatFromDirection(THREE, CANNON, direction);
    body.addShape(armShape, offset, armQuaternion);
    body.addShape(new CANNON.Sphere(OUTER_RADIUS * 0.98), end);
  });

  return { mesh, body };
}

function createTetrapodMesh(THREE, directions, up) {
  const group = new THREE.Group();
  const concrete = createConcreteMaterial(THREE);
  const darker = concrete.clone();
  darker.color.set(0x6f7d6e);
  const armGeometry = new THREE.CylinderGeometry(OUTER_RADIUS, INNER_RADIUS, ARM_LENGTH, 20, 2, false);
  const capGeometry = new THREE.SphereGeometry(OUTER_RADIUS, 18, 12);
  const coreGeometry = new THREE.DodecahedronGeometry(CORE_RADIUS * 1.28, 1);

  directions.forEach((direction, index) => {
    const material = index === 2 ? darker : concrete;
    const arm = new THREE.Mesh(armGeometry.clone(), material);
    arm.position.copy(direction).multiplyScalar(ARM_LENGTH * 0.5);
    arm.quaternion.setFromUnitVectors(up, direction);
    arm.castShadow = true;
    arm.receiveShadow = true;
    group.add(arm);

    const cap = new THREE.Mesh(capGeometry.clone(), material);
    cap.position.copy(direction).multiplyScalar(ARM_LENGTH);
    cap.scale.set(1.08, 0.86, 1.08);
    cap.quaternion.setFromUnitVectors(up, direction);
    cap.castShadow = true;
    cap.receiveShadow = true;
    group.add(cap);
  });

  const core = new THREE.Mesh(coreGeometry, darker);
  core.castShadow = true;
  core.receiveShadow = true;
  group.add(core);

  group.rotation.y = Math.PI / 7;
  return group;
}

function createConcreteMaterial(THREE) {
  const texture = createConcreteTexture(THREE);
  return new THREE.MeshStandardMaterial({
    color: 0x9da894,
    map: texture,
    roughness: 0.96,
    metalness: 0.02
  });
}

function createConcreteTexture(THREE) {
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 96;
  textureCanvas.height = 96;
  const ctx = textureCanvas.getContext('2d');
  ctx.fillStyle = '#9da894';
  ctx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
  for (let i = 0; i < 850; i += 1) {
    const shade = 126 + Math.floor(Math.random() * 74);
    ctx.fillStyle = `rgba(${shade}, ${Math.min(220, shade + 12)}, ${shade}, ${Math.random() * 0.24})`;
    ctx.fillRect(Math.random() * 96, Math.random() * 96, Math.random() * 2.4 + 0.4, Math.random() * 2.4 + 0.4);
  }
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  return texture;
}

function createWorldBounds(CANNON, groundMaterial) {
  const bodies = [];
  const floor = new CANNON.Body({ mass: 0, material: groundMaterial });
  floor.addShape(new CANNON.Box(new CANNON.Vec3(4.6, 0.08, 2.6)));
  floor.position.set(0, -1.86, 0);
  bodies.push(floor);

  const wallSpecs = [
    { position: [-4.2, 0.1, 0], half: [0.08, 2.4, 2.6] },
    { position: [4.2, 0.1, 0], half: [0.08, 2.4, 2.6] },
    { position: [0, 0.1, -2.35], half: [4.6, 2.4, 0.08] },
    { position: [0, 0.1, 2.35], half: [4.6, 2.4, 0.08] }
  ];

  wallSpecs.forEach(spec => {
    const body = new CANNON.Body({ mass: 0, material: groundMaterial });
    body.addShape(new CANNON.Box(new CANNON.Vec3(...spec.half)));
    body.position.set(...spec.position);
    bodies.push(body);
  });

  return bodies;
}

function toCannon(direction, scale, CANNON) {
  return new CANNON.Vec3(direction.x * scale, direction.y * scale, direction.z * scale);
}

function cannonQuatFromDirection(THREE, CANNON, direction) {
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction
  );
  return new CANNON.Quaternion(quat.x, quat.y, quat.z, quat.w);
}

function randomizeQuaternion(CANNON, body) {
  body.quaternion.setFromEuler(
    randomBetween(-Math.PI, Math.PI),
    randomBetween(-Math.PI, Math.PI),
    randomBetween(-Math.PI, Math.PI),
    'XYZ'
  );
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function createImpactLayer() {
  let layer = stage.querySelector('.tetrapod-impact-layer');
  if (layer) return layer;
  layer = document.createElement('div');
  layer.className = 'tetrapod-impact-layer';
  layer.setAttribute('aria-hidden', 'true');
  stage.appendChild(layer);
  return layer;
}

function playDropImpact(anime, layer, reduced) {
  if (!anime || !layer || reduced) return;

  layer.replaceChildren();
  const copy = stage.querySelector('.tetrapod-buried-copy');
  const chips = Array.from({ length: 16 }, (_, index) => {
    const chip = document.createElement('span');
    chip.className = 'tetrapod-impact-chip';
    chip.style.setProperty('--chip-rotate', `${index * 22.5 + randomBetween(-8, 8)}deg`);
    layer.appendChild(chip);
    return chip;
  });
  const scans = Array.from({ length: 3 }, (_, index) => {
    const scan = document.createElement('span');
    scan.className = 'tetrapod-impact-chip is-scan';
    scan.style.setProperty('--scan-y', `${32 + index * 17}%`);
    layer.appendChild(scan);
    return scan;
  });

  anime.remove([stage, copy, ...chips, ...scans].filter(Boolean));
  anime.timeline({
    easing: 'easeOutExpo',
    complete: () => layer.replaceChildren()
  })
    .add({
      targets: stage,
      translateY: [0, -5, 0],
      scale: [1, 1.008, 1],
      boxShadow: [
        '0 0 0 rgba(180,255,92,0)',
        '0 0 62px rgba(180,255,92,0.2)',
        '0 0 0 rgba(180,255,92,0)'
      ],
      duration: 420
    }, 0)
    .add({
      targets: copy,
      translateX: [0, -8, 4, 0],
      opacity: [1, 0.68, 1],
      duration: 520
    }, 20)
    .add({
      targets: chips,
      translateX: () => randomBetween(-260, 260),
      translateY: () => randomBetween(-220, 150),
      rotate: () => randomBetween(-84, 84),
      scaleY: [0.5, 1.4, 0.2],
      opacity: [0, 0.82, 0],
      delay: anime.stagger(18, { from: 'center' }),
      duration: 760
    }, 40)
    .add({
      targets: scans,
      translateX: ['-110%', '110%'],
      opacity: [0, 0.86, 0],
      delay: anime.stagger(70),
      duration: 520,
      easing: 'easeInOutQuint'
    }, 90);
}

function playClearSweep(anime, layer, reduced) {
  if (!anime || !layer || reduced) return;

  layer.replaceChildren();
  const copy = stage.querySelector('.tetrapod-buried-copy');
  const sweep = document.createElement('span');
  sweep.className = 'tetrapod-impact-chip is-scan';
  sweep.style.setProperty('--scan-y', '50%');
  layer.appendChild(sweep);

  anime.remove([stage, copy, sweep].filter(Boolean));
  anime.timeline({
    easing: 'easeOutQuad',
    complete: () => layer.replaceChildren()
  })
    .add({
      targets: sweep,
      translateX: ['-115%', '115%'],
      opacity: [0, 0.9, 0],
      duration: 460
    }, 0)
    .add({
      targets: copy,
      translateY: [10, 0],
      opacity: [0.64, 1],
      duration: 360
    }, 130)
    .add({
      targets: stage,
      boxShadow: [
        '0 0 0 rgba(180,255,92,0)',
        '0 0 42px rgba(180,255,92,0.14)',
        '0 0 0 rgba(180,255,92,0)'
      ],
      duration: 620
    }, 0);
}

function pulse(anime, target) {
  if (!anime) return;
  anime.remove(target);
  anime({
    targets: target,
    scale: [1, 1.045, 1],
    duration: 260,
    easing: 'easeOutQuad'
  });
}

function setStatus(en, cn) {
  if (!statusNode) return;
  currentStatus = { en, cn };
  renderStatus();
}

function renderStatus() {
  if (!statusNode || !currentStatus) return;
  statusNode.textContent = document.documentElement.lang === 'zh-CN'
    ? currentStatus.cn
    : currentStatus.en;
}
