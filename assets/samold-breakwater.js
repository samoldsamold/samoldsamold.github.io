(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function ready(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function svgMarkup() {
    const uid = `breakwater-${Math.random().toString(36).slice(2)}`;
    const concrete = `${uid}-concrete`;
    const dark = `${uid}-dark`;
    const front = `${uid}-front`;
    const glow = `${uid}-glow`;
    const lowerRadius = Math.sqrt(8 / 9);
    const directions = {
      crown: { x: 0, y: 0, z: 1 },
      front: { x: 0, y: lowerRadius, z: -1 / 3 },
      left: { x: -0.8164965809277261, y: -0.4714045207910314, z: -1 / 3 },
      right: { x: 0.8164965809277258, y: -0.4714045207910321, z: -1 / 3 }
    };
    const center = { x: 80, y: 83 };

    function fmt(value) {
      return Number(value.toFixed(2)).toString();
    }

    function point(value) {
      return `${fmt(value.x)} ${fmt(value.y)}`;
    }

    function project(vector, length = 1) {
      const x = vector.x * length;
      const y = vector.y * length;
      const z = vector.z * length;
      return {
        x: center.x + (x * 0.82 - y * 0.36) * 58,
        y: center.y + (x * 0.16 + y * 0.38 - z * 0.86) * 58
      };
    }

    function add(base, normal, amount) {
      return { x: base.x + normal.x * amount, y: base.y + normal.y * amount };
    }

    function mix(a, b, t) {
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }

    function armPath(vector, length, rootRadius, tipRadius) {
      const root = project(vector, 0.16);
      const tip = project(vector, length);
      const dx = tip.x - root.x;
      const dy = tip.y - root.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const axis = { x: dx / distance, y: dy / distance };
      const normal = { x: -axis.y, y: axis.x };
      const rootLeft = add(root, normal, rootRadius);
      const rootRight = add(root, normal, -rootRadius);
      const tipLeft = add(tip, normal, tipRadius);
      const tipRight = add(tip, normal, -tipRadius);
      const cap = add(tip, axis, tipRadius * 0.92);
      const backCap = add(tip, axis, -tipRadius * 0.38);
      const leftMidA = add(mix(rootLeft, tipLeft, 0.36), normal, -rootRadius * 0.12);
      const leftMidB = add(mix(rootLeft, tipLeft, 0.78), normal, tipRadius * 0.1);
      const rightMidA = add(mix(rootRight, tipRight, 0.78), normal, -tipRadius * 0.1);
      const rightMidB = add(mix(rootRight, tipRight, 0.36), normal, rootRadius * 0.12);
      const rootBack = add(root, axis, -rootRadius * 0.28);

      return [
        `M${point(rootLeft)}`,
        `C${point(leftMidA)} ${point(leftMidB)} ${point(tipLeft)}`,
        `Q${point(cap)} ${point(tipRight)}`,
        `C${point(rightMidA)} ${point(rightMidB)} ${point(rootRight)}`,
        `Q${point(rootBack)} ${point(rootLeft)}Z`
      ].join(' ');
    }

    function ridgePath(vector, length) {
      const root = project(vector, 0.32);
      const tip = project(vector, length * 0.86);
      return `M${point(root)} C${point(mix(root, tip, 0.32))} ${point(mix(root, tip, 0.7))} ${point(tip)}`;
    }

    const arms = [
      { className: 'breakwater-arm-back', vector: directions.left, length: 1.16, root: 18, tip: 10.8, fill: `url(#${dark})` },
      { className: 'breakwater-arm-crown', vector: directions.crown, length: 1.12, root: 19.5, tip: 11, fill: `url(#${concrete})` },
      { className: 'breakwater-arm-right', vector: directions.right, length: 1.08, root: 18, tip: 10.5, fill: `url(#${concrete})` },
      { className: 'breakwater-arm-front', vector: directions.front, length: 1.11, root: 19, tip: 11.2, fill: `url(#${front})` }
    ];
    const armMarkup = arms.map(arm => `
          <path class="breakwater-arm ${arm.className}" d="${armPath(arm.vector, arm.length, arm.root, arm.tip)}" fill="${arm.fill}"/>
          <path class="breakwater-ridge" d="${ridgePath(arm.vector, arm.length)}"/>
    `).join('');

    return `
      <svg class="breakwater-svg" viewBox="0 0 160 160" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="${concrete}" x1="24" y1="18" x2="132" y2="142" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#eef6e9"/>
            <stop offset="0.44" stop-color="#9aa790"/>
            <stop offset="1" stop-color="#344037"/>
          </linearGradient>
          <linearGradient id="${dark}" x1="40" y1="32" x2="120" y2="132" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#899987"/>
            <stop offset="0.64" stop-color="#425044"/>
            <stop offset="1" stop-color="#17211c"/>
          </linearGradient>
          <linearGradient id="${front}" x1="48" y1="62" x2="116" y2="146" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#d9e4d3"/>
            <stop offset="0.5" stop-color="#7f8c7e"/>
            <stop offset="1" stop-color="#263229"/>
          </linearGradient>
          <radialGradient id="${glow}" cx="50%" cy="50%" r="62%">
            <stop offset="0" stop-color="currentColor" stop-opacity="0.32"/>
            <stop offset="1" stop-color="currentColor" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <ellipse class="breakwater-ground" cx="80" cy="130" rx="47" ry="12"/>
        <circle class="breakwater-aura" cx="80" cy="82" r="58" fill="url(#${glow})"/>
        <g class="breakwater-glyph">
          ${armMarkup}
          <path class="breakwater-core" d="M55.5 72.8c7.4-18.4 33.6-23 49.4-9 17.1 15.1 13.7 41.8-6.7 53.2-18.5 10.3-42.4 1.1-47.5-18.9-2-8-.7-18.2 4.8-25.3Z" fill="url(#${dark})"/>
          <path class="breakwater-face" d="M64.8 75.4c9.2-12.4 28.1-13.1 38.6-1.5 10.3 11.4 6 29.8-8.1 37.3-13.1 7-29.9.6-33.9-14-1.9-7-.4-15.1 3.4-21.8Z"/>
          <path class="breakwater-chip chip-a" d="M70.8 68.5l14.1-5.4 6.2 6.6-15.8 4.5Z"/>
          <path class="breakwater-chip chip-b" d="M97.8 83.8l11.3-3.1 2 7.4-11.8 5.7Z"/>
          <path class="breakwater-chip chip-c" d="M67.1 98l13.1 6.2-4.3 8.1-13.4-7.7Z"/>
        </g>
      </svg>
    `;
  }

  function createBreakwater() {
    if (document.querySelector('[data-samold-breakwater]')) return;

    const host = document.createElement('div');
    const shell = document.querySelector('.shell');
    const scope = shell ? 'home' : 'room';
    host.className = 'samold-breakwater';
    host.dataset.samoldBreakwater = 'true';
    host.dataset.breakwaterScope = scope;
    host.style.setProperty('--breakwater-x', '-16deg');
    host.style.setProperty('--breakwater-y', '28deg');
    host.style.setProperty('--breakwater-z', '0deg');
    host.innerHTML = `
      <button class="breakwater-button" type="button" aria-label="Rotate breakwater block / 旋转消波块">
        <span class="breakwater-tilt">
          <span class="breakwater-spinner">
            ${svgMarkup()}
          </span>
        </span>
      </button>
    `;

    (shell || document.body).appendChild(host);
    bindBreakwater(host);
  }

  function bindBreakwater(host) {
    const button = host.querySelector('.breakwater-button');
    if (!button) return;

    const state = {
      x: -16,
      y: 28,
      z: 0,
      dragging: false,
      dragged: false,
      startX: 0,
      startY: 0,
      startRotX: -16,
      startRotY: 28
    };

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function sync() {
      host.style.setProperty('--breakwater-x', `${state.x.toFixed(2)}deg`);
      host.style.setProperty('--breakwater-y', `${state.y.toFixed(2)}deg`);
      host.style.setProperty('--breakwater-z', `${state.z.toFixed(2)}deg`);
    }

    function nudge(dx, dy, dz) {
      state.x = clamp(state.x + dx, -64, 64);
      state.y += dy;
      state.z += dz;
      sync();
    }

    function settleDrag() {
      if (!state.dragging) return;
      state.dragging = false;
      host.classList.remove('is-dragging');
      window.setTimeout(() => {
        state.dragged = false;
      }, 0);
    }

    button.addEventListener('pointerdown', event => {
      state.dragging = true;
      state.dragged = false;
      state.startX = event.clientX;
      state.startY = event.clientY;
      state.startRotX = state.x;
      state.startRotY = state.y;
      host.classList.add('is-dragging');
      if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    button.addEventListener('pointermove', event => {
      if (!state.dragging) return;
      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;
      if (Math.hypot(dx, dy) > 4) state.dragged = true;
      state.y = state.startRotY + dx * 0.72;
      state.x = clamp(state.startRotX - dy * 0.5, -64, 64);
      sync();
    });

    button.addEventListener('pointerup', settleDrag);
    button.addEventListener('pointercancel', settleDrag);
    button.addEventListener('lostpointercapture', settleDrag);

    button.addEventListener('click', () => {
      if (state.dragged) return;
      const turn = reduceMotion.matches ? 18 : 24;
      nudge(-2, turn, 18);
      host.classList.add('is-clicked');
      window.setTimeout(() => host.classList.remove('is-clicked'), 220);
    });

    button.addEventListener('keydown', event => {
      const step = event.shiftKey ? 28 : 16;
      if (event.key === 'ArrowLeft') {
        nudge(0, -step, 0);
      } else if (event.key === 'ArrowRight') {
        nudge(0, step, 0);
      } else if (event.key === 'ArrowUp') {
        nudge(-step, 0, 0);
      } else if (event.key === 'ArrowDown') {
        nudge(step, 0, 0);
      } else if (event.key === 'Enter' || event.key === ' ') {
        nudge(-2, 24, 18);
      } else {
        return;
      }
      event.preventDefault();
    });

    sync();
  }

  ready(createBreakwater);
})();
