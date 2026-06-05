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
const ROOT_RADIUS = OUTER_RADIUS * 0.66;
const TIP_RADIUS = OUTER_RADIUS * 1.04;
const CAP_DEPTH = MODEL_HEIGHT * 0.052;
const LEG_FULL_LENGTH = ARM_LENGTH + CAP_DEPTH;
const HUB_RADIUS = OUTER_RADIUS * 1.28;
const MAX_BLOCKS = 20;

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
    state.dropPile(reducedMotion.matches ? 4 : 8);
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
      state.dropPile(3);
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
  const visualKit = createTetrapodKit(THREE);
  const up = new THREE.Vector3(0, 1, 0);

  renderer.setClearColor(0x000000, 0);
  if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }
  if (THREE.ACESFilmicToneMapping) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
  }
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  world.allowSleep = true;
  world.solver.iterations = 12;
  world.solver.tolerance = 0.001;
  world.addContactMaterial(contact);
  world.addContactMaterial(blockContact);
  world.defaultContactMaterial.friction = 0.6;
  world.defaultContactMaterial.restitution = 0.08;

  scene.add(new THREE.HemisphereLight(0xd8ded2, 0x182019, 1.28));
  const key = new THREE.DirectionalLight(0xf0f2e7, 2.75);
  key.position.set(-3.6, 5.8, 4.8);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb4ff80, 0.92);
  rim.position.set(3.6, 2.2, -4.4);
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
    camera.position.set(0, width < 620 ? 1.65 : 1.5, width < 620 ? 6.2 : 5.05);
    camera.lookAt(0, -0.38, 0);
    camera.updateProjectionMatrix();
  }

  function dropPile(count) {
    for (let index = 0; index < count; index += 1) {
      if (blocks.length >= MAX_BLOCKS) removeBlock(blocks[0]);
      const block = createBlock(THREE, CANNON, directions, up, concreteMaterial, visualKit);
      const spread = stage.clientWidth < 620 ? 1.08 : 1.62;
      block.body.position.set(
        randomBetween(-spread, spread),
        3.25 + index * 0.28,
        randomBetween(-0.52, 0.52)
      );
      block.body.velocity.set(randomBetween(-0.16, 0.16), reducedMotion.matches ? -0.36 : -1.05, randomBetween(-0.08, 0.08));
      block.body.angularVelocity.set(randomBetween(-1.35, 1.35), randomBetween(-1.9, 1.9), randomBetween(-1.35, 1.35));
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

function createBlock(THREE, CANNON, directions, up, material, visualKit) {
  const mesh = createTetrapodMesh(THREE, directions, up, visualKit);
  const body = new CANNON.Body({
    mass: 2.35,
    material,
    linearDamping: 0.06,
    angularDamping: 0.08,
    allowSleep: true,
    sleepSpeedLimit: 0.08,
    sleepTimeLimit: 0.9
  });

  body.addShape(new CANNON.Sphere(HUB_RADIUS * 0.86));
  directions.forEach(direction => {
    const offset = toCannon(direction, LEG_FULL_LENGTH * 0.5, CANNON);
    const end = toCannon(direction, LEG_FULL_LENGTH * 0.96, CANNON);
    const armShape = new CANNON.Box(new CANNON.Vec3(TIP_RADIUS * 0.72, LEG_FULL_LENGTH * 0.5, TIP_RADIUS * 0.72));
    const armQuaternion = cannonQuatFromDirection(THREE, CANNON, direction);
    body.addShape(armShape, offset, armQuaternion);
    body.addShape(new CANNON.Sphere(TIP_RADIUS * 0.72), end);
  });

  return { mesh, body };
}

function createTetrapodMesh(THREE, directions, up, kit) {
  const group = new THREE.Group();
  const zAxis = new THREE.Vector3(0, 0, 1);

  directions.forEach((direction, index) => {
    const material = kit.legMaterials[index % kit.legMaterials.length];
    const arm = new THREE.Mesh(kit.legGeometry, material);
    arm.quaternion.setFromUnitVectors(up, direction);
    arm.castShadow = true;
    arm.receiveShadow = true;
    group.add(arm);

    const cap = new THREE.Mesh(kit.capGeometry, kit.capMaterial);
    cap.position.copy(direction).multiplyScalar(LEG_FULL_LENGTH + 0.004);
    cap.quaternion.setFromUnitVectors(zAxis, direction);
    cap.receiveShadow = true;
    cap.castShadow = true;
    group.add(cap);
  });

  const core = new THREE.Mesh(kit.hubGeometry, kit.hubMaterial);
  core.castShadow = true;
  core.receiveShadow = true;
  group.add(core);

  group.rotation.y = Math.PI / 7;
  return group;
}

function createTetrapodKit(THREE) {
  const texture = createConcreteTexture(THREE);
  const base = createConcreteMaterial(THREE, texture, 0x8b9288);
  const warmer = createConcreteMaterial(THREE, texture, 0x93988d);
  const cooler = createConcreteMaterial(THREE, texture, 0x7d857e);
  const hub = createConcreteMaterial(THREE, texture, 0x80877f);
  const cap = createConcreteMaterial(THREE, texture, 0x626a63);

  return {
    legGeometry: createTaperedLegGeometry(THREE),
    capGeometry: new THREE.CircleGeometry(TIP_RADIUS * 0.83, 30),
    hubGeometry: createHubGeometry(THREE),
    legMaterials: [base, warmer, base, cooler],
    hubMaterial: hub,
    capMaterial: cap
  };
}

function createConcreteMaterial(THREE, texture, color) {
  return new THREE.MeshStandardMaterial({
    color,
    map: texture,
    bumpMap: texture,
    bumpScale: 0.022,
    roughness: 0.98,
    metalness: 0.01
  });
}

function createTaperedLegGeometry(THREE) {
  const radialSegments = 30;
  const profile = [
    { y: 0, r: ROOT_RADIUS * 1.18 },
    { y: ARM_LENGTH * 0.1, r: ROOT_RADIUS },
    { y: ARM_LENGTH * 0.42, r: OUTER_RADIUS * 0.72 },
    { y: ARM_LENGTH * 0.76, r: OUTER_RADIUS * 0.88 },
    { y: ARM_LENGTH * 0.94, r: TIP_RADIUS * 1.02 },
    { y: ARM_LENGTH + CAP_DEPTH * 0.42, r: TIP_RADIUS * 1.03 },
    { y: LEG_FULL_LENGTH, r: TIP_RADIUS * 0.9 }
  ];
  const vertices = [];
  const indices = [];
  const uvs = [];

  profile.forEach((point, ringIndex) => {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const angle = (segment / radialSegments) * Math.PI * 2;
      const rough = 1 + Math.sin(segment * 1.7 + ringIndex * 0.63) * 0.008;
      vertices.push(
        Math.cos(angle) * point.r * rough,
        point.y,
        Math.sin(angle) * point.r * rough
      );
      uvs.push(segment / radialSegments, point.y / LEG_FULL_LENGTH);
    }
  });

  for (let ring = 0; ring < profile.length - 1; ring += 1) {
    const current = ring * radialSegments;
    const next = (ring + 1) * radialSegments;
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const a = current + segment;
      const b = current + ((segment + 1) % radialSegments);
      const c = next + segment;
      const d = next + ((segment + 1) % radialSegments);
      indices.push(a, c, b, b, c, d);
    }
  }

  const rootCenter = vertices.length / 3;
  vertices.push(0, 0, 0);
  uvs.push(0.5, 0);
  for (let segment = 0; segment < radialSegments; segment += 1) {
    indices.push(rootCenter, segment, (segment + 1) % radialSegments);
  }

  const tipCenter = vertices.length / 3;
  vertices.push(0, LEG_FULL_LENGTH, 0);
  uvs.push(0.5, 1);
  const tipStart = (profile.length - 1) * radialSegments;
  for (let segment = 0; segment < radialSegments; segment += 1) {
    indices.push(tipCenter, tipStart + ((segment + 1) % radialSegments), tipStart + segment);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createHubGeometry(THREE) {
  const geometry = new THREE.SphereGeometry(HUB_RADIUS, 26, 18);
  const position = geometry.attributes.position;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const rough = 1 + Math.sin(x * 19.1 + y * 13.7 + z * 11.3) * 0.018;
    position.setXYZ(index, x * 1.08 * rough, y * 0.98 * rough, z * 1.03 * rough);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function createConcreteTexture(THREE) {
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 160;
  textureCanvas.height = 160;
  const ctx = textureCanvas.getContext('2d');
  ctx.fillStyle = '#8d9389';
  ctx.fillRect(0, 0, textureCanvas.width, textureCanvas.height);
  for (let i = 0; i < 2100; i += 1) {
    const shade = 104 + Math.floor(Math.random() * 82);
    const alpha = Math.random() * 0.2;
    ctx.fillStyle = `rgba(${shade}, ${Math.min(196, shade + 8)}, ${Math.max(92, shade - 4)}, ${alpha})`;
    ctx.fillRect(
      Math.random() * textureCanvas.width,
      Math.random() * textureCanvas.height,
      Math.random() * 2.6 + 0.35,
      Math.random() * 2.6 + 0.35
    );
  }
  for (let i = 0; i < 48; i += 1) {
    const shade = 76 + Math.floor(Math.random() * 42);
    ctx.strokeStyle = `rgba(${shade}, ${shade + 8}, ${shade}, 0.12)`;
    ctx.lineWidth = Math.random() * 1.2 + 0.35;
    ctx.beginPath();
    ctx.moveTo(Math.random() * 160, Math.random() * 160);
    ctx.lineTo(Math.random() * 160, Math.random() * 160);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.45, 1.45);
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
