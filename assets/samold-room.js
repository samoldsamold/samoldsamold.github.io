const root = document.documentElement;

// Track cursor for global glow and lang-button proximity reveal
let _langBtn = null;

window.addEventListener("pointermove", event => {
  root.style.setProperty("--cursor-x", `${event.clientX}px`);
  root.style.setProperty("--cursor-y", `${event.clientY}px`);

  // Proximity-based reveal for the language toggle button
  if (!_langBtn) _langBtn = document.querySelector('.room-lang-btn');
  if (_langBtn) {
    const r = _langBtn.getBoundingClientRect();
    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Full glow radius of the page is ~460px; start appearing at 320px
    const raw  = Math.max(0, 1 - dist / 320);
    const prox = +(raw * raw).toFixed(3); // square for steeper falloff near zero

    _langBtn.style.setProperty('--lang-opacity', prox);
    _langBtn.style.setProperty('--lang-border',  (0.15 + prox * 0.55).toFixed(3));
    _langBtn.style.setProperty('--lang-color',   (0.12 + prox * 0.78).toFixed(3));
    // Enable pointer-events only when visible enough to be found
    _langBtn.classList.toggle('is-reachable', prox > 0.08);
  }
}, { passive: true });

function currentRoomId() {
  const file = (window.location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  if (file) return file;
  const active = document.querySelector('.room-nav a.is-active');
  const href = active ? active.getAttribute('href') || '' : '';
  return href.replace(/\.html.*$/, '') || 'showcase';
}

function createSvgNode(name, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

function drawSamoldWordField(group, width, height, compact) {
  group.replaceChildren();
  const fontSize = compact
    ? Math.max(24, Math.min(50, width * 0.043))
    : Math.max(54, Math.min(116, width * 0.098));
  const wordWidth = fontSize * (compact ? 4.85 : 5.1);
  const gapX = fontSize * (compact ? 0.82 : 1.24);
  const stepX = wordWidth + gapX;
  const stepY = compact ? fontSize * 1.34 : fontSize * 2.12;
  const letterSpacing = compact ? '0.06em' : '0.04em';
  const cols = Math.max(1, Math.floor(Math.max(0, width + gapX) / stepX));
  const totalWidth = wordWidth + (cols - 1) * stepX;
  const startX = (width - totalWidth) / 2 + wordWidth / 2;

  for (let y = fontSize * 0.85; y <= height - fontSize * 0.45; y += stepY) {
    for (let col = 0; col < cols; col += 1) {
      const text = createSvgNode('text', {
        x: String(startX + col * stepX),
        y: String(y),
        'font-size': String(fontSize),
        'letter-spacing': letterSpacing,
        'text-anchor': 'middle'
      });
      text.textContent = 'SAMOLD';
      group.appendChild(text);
    }
  }
}

function createRoomWordField() {
  const hero = document.querySelector('.room-hero');
  if (!hero || hero.dataset.wordfieldReady === 'true') return null;
  hero.dataset.wordfieldReady = 'true';

  const baseField = createSvgNode('svg', { class: 'room-wordfield room-wordfield-base', 'aria-hidden': 'true' });
  const baseWords = createSvgNode('g');
  baseField.appendChild(baseWords);
  hero.prepend(baseField);

  function layout() {
    const width = Math.max(1, Math.round(hero.clientWidth));
    const height = Math.max(1, Math.round(hero.clientHeight));
    baseField.setAttribute('width', String(width));
    baseField.setAttribute('height', String(height));
    baseField.setAttribute('viewBox', `0 0 ${width} ${height}`);
    drawSamoldWordField(baseWords, width, height, false);
  }

  window.addEventListener('resize', layout, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(hero);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  layout();
  return { refresh: layout };
}

// ── Cursor reveal layer ───────────────────────────────────────────────────
// The visible page keeps the selected language. The cursor blob reveals the
// other language on a light inverse layer, with a tighter SAMOLD word field.
const HERO_REVEAL_SELECTORS = [
  { selector: '.room-kicker', kind: 'kicker' },
  { selector: '.room-title', kind: 'title' },
  { selector: '.room-subtitle', kind: 'subtitle' },
  { selector: '.room-note span:last-child', kind: 'note' }
];

function createRoomReveal(enCache, cn) {
  const hero = document.querySelector('.room-hero');
  if (!hero || !cn || !cn.texts || hero.dataset.revealReady === 'true') {
    return window.__roomRevealApi || null;
  }

  hero.dataset.revealReady = 'true';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const maskId = `roomRevealMask-${Math.random().toString(36).slice(2)}`;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = {
    lang: 'en',
    targetX: -600,
    targetY: -600,
    lastClientX: -600,
    lastClientY: -600,
    targetOpacity: 0,
    revealOpacity: 0,
    headerX: -600,
    headerY: -600,
    headerRadius: 120,
    headerTargetOpacity: 0,
    headerOpacity: 0,
    width: 1,
    height: 1
  };

  function svgEl(name, attrs = {}) {
    const node = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  }

  const revealSvg = svgEl('svg', { class: 'room-reveal-svg', 'aria-hidden': 'true' });
  const defs = svgEl('defs');
  const filter = svgEl('filter', { id: 'roomGooey', x: '-25%', y: '-25%', width: '150%', height: '150%' });
  filter.appendChild(svgEl('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '18', result: 'blur' }));
  filter.appendChild(svgEl('feColorMatrix', {
    in: 'blur',
    mode: 'matrix',
    values: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -10',
    result: 'goo'
  }));
  defs.appendChild(filter);

  const mask = svgEl('mask', { id: maskId, maskUnits: 'userSpaceOnUse' });
  const maskRect = svgEl('rect', { fill: 'black' });
  const followerGroup = svgEl('g', { filter: 'url(#roomGooey)' });
  const followers = Array.from({ length: reduceMotion ? 1 : 8 }, (_, index) => {
    const dot = svgEl('circle', { cx: '-600', cy: '-600', r: String(110 - index * 4), fill: 'white' });
    followerGroup.appendChild(dot);
    return dot;
  });
  mask.appendChild(maskRect);
  mask.appendChild(followerGroup);
  defs.appendChild(mask);
  revealSvg.appendChild(defs);

  const revealGroup = svgEl('g', { mask: `url(#${maskId})`, opacity: '0' });
  const revealBg = svgEl('rect', { class: 'room-reveal-bg' });
  const revealPattern = svgEl('g', { class: 'room-reveal-pattern' });
  const revealContent = svgEl('g', { class: 'room-reveal-content' });
  revealGroup.appendChild(revealBg);
  revealGroup.appendChild(revealPattern);
  revealGroup.appendChild(revealContent);
  revealSvg.appendChild(revealGroup);
  hero.appendChild(revealSvg);

  const headerReveal = createHeaderReveal();

  function createHeaderReveal() {
    const header = document.querySelector('.room-header');
    if (!header || document.querySelector('.room-header-reveal')) return null;

    const overlay = document.createElement('div');
    overlay.className = 'room-header-reveal';
    overlay.setAttribute('aria-hidden', 'true');

    const inner = document.createElement('div');
    inner.className = 'room-header-reveal-inner';

    const brandSource = header.querySelector('.brand-block') || header.querySelector('.brand-home');
    const navSource = header.querySelector('.room-nav');
    if (brandSource) inner.appendChild(brandSource.cloneNode(true));
    if (navSource) {
      const navCopy = navSource.cloneNode(true);
      inner.appendChild(navCopy);

      const sourceLinks = [...navSource.querySelectorAll('a')];
      const copyLinks = [...navCopy.querySelectorAll('a')];
      sourceLinks.forEach((link, index) => {
        const copy = copyLinks[index];
        if (!copy) return;
        const show = () => copy.classList.add('is-clone-hover');
        const hide = () => copy.classList.remove('is-clone-hover');
        link.addEventListener('pointerenter', show, { passive: true });
        link.addEventListener('pointerleave', hide, { passive: true });
        link.addEventListener('focus', show);
        link.addEventListener('blur', hide);
      });
    }

    overlay.appendChild(inner);
    overlay.querySelectorAll('a, button').forEach(control => {
      control.tabIndex = -1;
      control.setAttribute('aria-hidden', 'true');
      if (control.tagName === 'A') control.removeAttribute('href');
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  const positions = followers.map(() => ({ x: -600, y: -600 }));
  const speeds = reduceMotion ? [1] : [0.44, 0.36, 0.29, 0.235, 0.19, 0.155, 0.13, 0.11];
  const copies = HERO_REVEAL_SELECTORS.map(item => {
    const fo = svgEl('foreignObject', { class: `room-reveal-fo ${item.kind}` });
    const div = document.createElement('div');
    div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    div.className = `room-reveal-copy ${item.kind}`;
    fo.appendChild(div);
    revealContent.appendChild(fo);
    return { ...item, fo, div };
  });
  const titleAnchor = {
    ready: false,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    style: null
  };
  const fitCanvas = document.createElement('canvas');
  const fitContext = fitCanvas.getContext('2d');

  function styleSnapshot(style) {
    return {
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      textAlign: style.textAlign,
      textTransform: style.textTransform,
      overflowWrap: style.overflowWrap || 'normal'
    };
  }

  function captureTitleAnchor(rect, style, heroRect) {
    if (rect.width <= 0 || rect.height <= 0) return;
    titleAnchor.ready = true;
    titleAnchor.x = rect.left - heroRect.left;
    titleAnchor.y = rect.top - heroRect.top;
    titleAnchor.width = rect.width;
    titleAnchor.height = rect.height;
    titleAnchor.style = styleSnapshot(style);
  }

  function plainText(html) {
    const el = document.createElement('div');
    el.innerHTML = html || '';
    return (el.textContent || '').trim();
  }

  function fittedChineseTitleSize(text, width) {
    const small = window.matchMedia('(max-width: 560px)').matches;
    const min = small ? 28 : 38;
    const max = small ? 42 : Math.min(76, state.width * 0.052);
    const chars = Math.max(1, Array.from(text).length);
    const estimated = (width / chars) * 0.94;
    let size = Math.max(min, Math.min(max, estimated));

    if (fitContext) {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        fitContext.font = `700 ${size}px "Space Grotesk", Inter, sans-serif`;
        if (fitContext.measureText(text).width <= width * 0.96 || size <= min) break;
        size -= 2;
      }
    }

    return `${Math.max(min, size).toFixed(2)}px`;
  }

  function heroValue(lang, selector) {
    if (lang === 'cn') {
      const value = cn.texts[selector];
      return Array.isArray(value) ? value[0] : value;
    }
    const value = enCache[selector];
    return Array.isArray(value) ? value[0] : value;
  }

  function syncFollowerNodes() {
    positions.forEach((pos, index) => {
      followers[index].setAttribute('cx', pos.x.toFixed(2));
      followers[index].setAttribute('cy', pos.y.toFixed(2));
    });
  }

  function snapFollowers(x, y) {
    positions.forEach(pos => {
      pos.x = x;
      pos.y = y;
    });
    syncFollowerNodes();
  }

  function syncSvgSize() {
    const width = Math.max(1, Math.round(hero.clientWidth));
    const height = Math.max(1, Math.round(hero.clientHeight));
    state.width = width;
    state.height = height;

    revealSvg.setAttribute('width', String(width));
    revealSvg.setAttribute('height', String(height));
    revealSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    maskRect.setAttribute('width', String(width));
    maskRect.setAttribute('height', String(height));
    revealBg.setAttribute('width', String(width));
    revealBg.setAttribute('height', String(height));

    const baseRadius = Math.max(86, Math.min(148, Math.min(width, height) * 0.19));
    state.headerRadius = baseRadius;
    followers.forEach((dot, index) => {
      dot.setAttribute('r', String(Math.max(58, baseRadius - index * 4.8)));
    });

    drawSamoldWordField(revealPattern, width, height, true);
  }

  function syncCopyGeometry() {
    const heroRect = hero.getBoundingClientRect();
    const revealLang = state.lang === 'cn' ? 'en' : 'cn';
    copies.forEach(copy => {
      const source = document.querySelector(copy.selector);
      if (!source) return;

      const rect = source.getBoundingClientRect();
      const sourceStyle = window.getComputedStyle(source);
      if (copy.kind === 'title' && (!titleAnchor.ready || root.lang !== 'zh-CN')) {
        captureTitleAnchor(rect, sourceStyle, heroRect);
      }

      const anchor = copy.kind === 'title' && titleAnchor.ready
        ? titleAnchor
        : {
            x: rect.left - heroRect.left,
            y: rect.top - heroRect.top,
            width: rect.width,
            height: rect.height,
            style: styleSnapshot(sourceStyle)
          };

      const padY = copy.kind === 'title' ? 0 : 8;
      const height = copy.kind === 'title'
        ? Math.max(anchor.height + 36, rect.height + 36)
        : rect.height + padY * 2;
      const y = copy.kind === 'title'
        ? anchor.y + anchor.height / 2 - height / 2
        : anchor.y - padY;
      const style = copy.kind === 'title' && titleAnchor.style ? titleAnchor.style : anchor.style;

      copy.fo.setAttribute('x', String(anchor.x));
      copy.fo.setAttribute('y', String(y));
      copy.fo.setAttribute('width', String(anchor.width));
      copy.fo.setAttribute('height', String(height));

      const isTitle = copy.kind === 'title';
      const isChineseTitle = isTitle && revealLang === 'cn';
      const fontSize = isChineseTitle
        ? fittedChineseTitleSize(plainText(copy.div.innerHTML), anchor.width)
        : style.fontSize;

      Object.assign(copy.div.style, {
        display: isTitle ? 'flex' : 'block',
        width: '100%',
        height: isTitle ? '100%' : 'auto',
        margin: '0',
        padding: isTitle ? '0' : `${padY}px 0 0`,
        boxSizing: 'border-box',
        fontFamily: style.fontFamily,
        fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        textAlign: style.textAlign,
        textTransform: style.textTransform,
        overflowWrap: style.overflowWrap || 'normal',
        whiteSpace: isChineseTitle ? 'nowrap' : 'normal'
      });
    });
  }

  function updateTargetFromLastPointer() {
    const rect = hero.getBoundingClientRect();
    const inside =
      state.lastClientX >= rect.left &&
      state.lastClientX <= rect.right &&
      state.lastClientY >= rect.top &&
      state.lastClientY <= rect.bottom;
    const header = document.querySelector('.room-header');
    const backdrop = document.querySelector('.room-top-backdrop');
    const headerVisible = Boolean(
      header &&
      (document.body.classList.contains('is-room-scrolled') || header.matches(':focus-within'))
    );
    const headerHeight = backdrop
      ? backdrop.getBoundingClientRect().height
      : Math.max(116, window.innerHeight * 0.13);
    const circleTouchesHeader =
      headerVisible &&
      state.lastClientX >= -state.headerRadius &&
      state.lastClientX <= window.innerWidth + state.headerRadius &&
      state.lastClientY - state.headerRadius <= headerHeight &&
      state.lastClientY + state.headerRadius >= 0;

    state.headerX = state.lastClientX;
    state.headerY = state.lastClientY;
    state.headerTargetOpacity = circleTouchesHeader ? 1 : 0;

    if (!inside) {
      state.targetOpacity = 0;
      return;
    }

    const x = state.lastClientX - rect.left;
    const y = state.lastClientY - rect.top;
    const shouldSnap = reduceMotion || (state.targetOpacity === 0 && state.revealOpacity < 0.05);
    state.targetX = x;
    state.targetY = y;
    state.targetOpacity = 1;
    if (shouldSnap) snapFollowers(x, y);
  }

  function layout() {
    syncSvgSize();
    syncCopyGeometry();
    updateTargetFromLastPointer();
  }

  function update(lang) {
    state.lang = lang;
    const revealLang = lang === 'cn' ? 'en' : 'cn';
    copies.forEach(copy => {
      const value = heroValue(revealLang, copy.selector);
      copy.div.classList.toggle('is-cn', revealLang === 'cn');
      copy.div.dataset.revealLang = revealLang;
      if (value !== undefined) copy.div.innerHTML = value;
    });
    requestAnimationFrame(layout);
  }

  window.addEventListener('pointermove', event => {
    state.lastClientX = event.clientX;
    state.lastClientY = event.clientY;
    updateTargetFromLastPointer();
  }, { passive: true });

  hero.addEventListener('pointerleave', () => {
    state.targetOpacity = 0;
  }, { passive: true });

  document.addEventListener('pointerleave', () => {
    state.targetOpacity = 0;
    state.headerTargetOpacity = 0;
  }, { passive: true });

  window.addEventListener('blur', () => {
    state.targetOpacity = 0;
    state.headerTargetOpacity = 0;
  });

  window.addEventListener('scroll', updateTargetFromLastPointer, { passive: true });
  window.addEventListener('resize', layout, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(hero);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

  function tick() {
    const opacitySpeed = reduceMotion ? 1 : 0.16;
    state.revealOpacity += (state.targetOpacity - state.revealOpacity) * opacitySpeed;
    if (state.revealOpacity < 0.002) state.revealOpacity = 0;
    if (state.revealOpacity > 0.998) state.revealOpacity = 1;
    revealGroup.setAttribute('opacity', state.revealOpacity.toFixed(3));

    state.headerOpacity += (state.headerTargetOpacity - state.headerOpacity) * opacitySpeed;
    if (state.headerOpacity < 0.002) state.headerOpacity = 0;
    if (state.headerOpacity > 0.998) state.headerOpacity = 1;
    if (headerReveal) {
      headerReveal.style.setProperty('--header-reveal-x', `${state.headerX.toFixed(2)}px`);
      headerReveal.style.setProperty('--header-reveal-y', `${state.headerY.toFixed(2)}px`);
      headerReveal.style.setProperty('--header-reveal-radius', `${state.headerRadius.toFixed(2)}px`);
      headerReveal.style.setProperty('--header-reveal-opacity', state.headerOpacity.toFixed(3));
    }

    positions.forEach((pos, index) => {
      const speed = speeds[index] || speeds[speeds.length - 1];
      pos.x += (state.targetX - pos.x) * speed;
      pos.y += (state.targetY - pos.y) * speed;
      followers[index].setAttribute('cx', pos.x.toFixed(2));
      followers[index].setAttribute('cy', pos.y.toFixed(2));
    });
    requestAnimationFrame(tick);
  }

  layout();
  tick();

  window.__roomRevealApi = { update, refresh: layout };
  return window.__roomRevealApi;
}

// ── Per-room hero interactions ─────────────────────────────────────────────
// Labs owns the intentionally hard-to-read inverse reveal. Other rooms keep
// text directly readable and use lightweight pointer-driven effects.
function createRoomHeroEffect(room) {
  const hero = document.querySelector('.room-hero');
  if (!hero) return { refresh() {} };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  hero.dataset.roomEffect = room;
  hero.classList.add(`room-effect-${room}`);

  if (reduceMotion || !finePointer || room === 'labs') return { refresh() {} };

  if (room === 'showcase') return createMagneticTitleEffect(hero);
  if (room === 'articles') return createArticleMarginCueEffect(hero);
  if (room === 'moments') return createViewfinderEffect(hero);
  if (room === 'overview') return createOverviewCompassEffect(hero);
  if (room === 'discoveries') return createDiscoveryPinEffect(hero);
  return { refresh() {} };
}

function createMagneticTitleEffect(hero) {
  const title = hero.querySelector('.room-title');
  if (!title) return { refresh() {} };
  let letters = [];
  let raf = 0;

  function wrap() {
    const text = (title.textContent || '').trim();
    letters = [];
    title.classList.add('room-title-magnetic');
    title.setAttribute('aria-label', text);
    title.replaceChildren();

    const isCjk = /[\u3400-\u9fff]/.test(text);
    const tokens = isCjk ? [text] : text.split(/\s+/).filter(Boolean);

    tokens.forEach(token => {
      const word = document.createElement('span');
      word.className = 'magnetic-word';
      word.setAttribute('aria-hidden', 'true');

      Array.from(token).forEach(char => {
        const span = document.createElement('span');
        span.className = 'magnetic-letter';
        span.textContent = char;
        word.appendChild(span);
        letters.push({ el: span, x: 0, y: 0, s: 1, tx: 0, ty: 0, ts: 1 });
      });

      title.appendChild(word);
    });
  }

  function setTargets(event) {
    letters.forEach(item => {
      const rect = item.el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = event.clientX - cx;
      const dy = event.clientY - cy;
      const distance = Math.hypot(dx, dy);
      const radius = 220;
      if (!distance || distance > radius) {
        item.tx = 0;
        item.ty = 0;
        item.ts = 1;
        return;
      }
      const pull = Math.pow(1 - distance / radius, 2);
      const move = 12 * pull;
      item.tx = (dx / distance) * move;
      item.ty = (dy / distance) * move;
      item.ts = 1 + 0.1 * pull;
    });
  }

  function resetTargets() {
    letters.forEach(item => {
      item.tx = 0;
      item.ty = 0;
      item.ts = 1;
    });
  }

  function tick() {
    letters.forEach(item => {
      item.x += (item.tx - item.x) * 0.18;
      item.y += (item.ty - item.y) * 0.18;
      item.s += (item.ts - item.s) * 0.18;
      item.el.style.transform = `translate3d(${item.x.toFixed(2)}px, ${item.y.toFixed(2)}px, 0) scale(${item.s.toFixed(3)})`;
    });
    raf = requestAnimationFrame(tick);
  }

  hero.addEventListener('pointermove', setTargets, { passive: true });
  hero.addEventListener('pointerleave', resetTargets, { passive: true });
  wrap();
  tick();

  return {
    refresh() {
      cancelAnimationFrame(raf);
      wrap();
      tick();
    }
  };
}

function createArticleMarginCueEffect(hero) {
  const leftCue = document.createElement('div');
  const rightCue = document.createElement('div');
  leftCue.className = 'room-margin-cue room-margin-cue-left';
  rightCue.className = 'room-margin-cue room-margin-cue-right';
  leftCue.setAttribute('aria-hidden', 'true');
  rightCue.setAttribute('aria-hidden', 'true');
  hero.append(leftCue, rightCue);

  function move(event) {
    const rect = hero.getBoundingClientRect();
    hero.style.setProperty('--cue-y', `${event.clientY - rect.top}px`);
    hero.classList.add('is-reading');
  }

  hero.addEventListener('pointermove', move, { passive: true });
  hero.addEventListener('pointerleave', () => hero.classList.remove('is-reading'), { passive: true });
  return { refresh() {} };
}

function createViewfinderEffect(hero) {
  const frame = document.createElement('div');
  frame.className = 'room-viewfinder';
  frame.setAttribute('aria-hidden', 'true');
  ['tl', 'tr', 'br', 'bl'].forEach(pos => {
    const corner = document.createElement('span');
    corner.className = `room-viewfinder-corner ${pos}`;
    frame.appendChild(corner);
  });

  const flash = document.createElement('div');
  flash.className = 'room-camera-flash';
  flash.setAttribute('aria-hidden', 'true');
  hero.append(frame, flash);

  const interactiveSelector = 'a, button, input, select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])';

  function move(event) {
    const rect = hero.getBoundingClientRect();
    hero.style.setProperty('--vf-x', `${event.clientX - rect.left}px`);
    hero.style.setProperty('--vf-y', `${event.clientY - rect.top}px`);
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const isInteractive = Boolean(target && target.closest(interactiveSelector));
    hero.classList.add('is-framing');
    hero.classList.toggle('is-focusing', isInteractive);
  }

  hero.addEventListener('pointermove', move, { passive: true });
  hero.addEventListener('pointerleave', () => {
    hero.classList.remove('is-framing', 'is-focusing');
  }, { passive: true });
  hero.addEventListener('click', () => {
    flash.classList.remove('is-flashing');
    window.requestAnimationFrame(() => flash.classList.add('is-flashing'));
    window.setTimeout(() => flash.classList.remove('is-flashing'), 120);
  });
  return { refresh() {} };
}

function createOverviewCompassEffect(hero) {
  const compass = document.createElement('div');
  compass.className = 'room-compass';
  compass.setAttribute('aria-hidden', 'true');
  const nodes = [
    { letter: 'S', label: 'Showcase', x: 0.2, y: 0.34 },
    { letter: 'A', label: 'Articles', x: 0.38, y: 0.24 },
    { letter: 'M', label: 'Moments', x: 0.62, y: 0.24 },
    { letter: 'O', label: 'Overview', x: 0.8, y: 0.34 },
    { letter: 'L', label: 'Labs', x: 0.32, y: 0.74 },
    { letter: 'D', label: 'Discoveries', x: 0.68, y: 0.74 }
  ];

  const nodeEls = nodes.map(node => {
    const item = document.createElement('span');
    item.className = 'room-compass-node';
    item.style.setProperty('--node-x', `${node.x * 100}%`);
    item.style.setProperty('--node-y', `${node.y * 100}%`);
    item.innerHTML = `<span>${node.letter}</span><small>${node.label.toUpperCase()}</small>`;
    compass.appendChild(item);
    return item;
  });
  hero.appendChild(compass);

  function move(event) {
    const rect = hero.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    nodes.forEach((node, index) => {
      const nx = node.x * rect.width;
      const ny = node.y * rect.height;
      const distance = Math.hypot(x - nx, y - ny);
      const proximity = Math.max(0, 1 - distance / 200);
      const opacity = 0.34 + proximity * 0.66;
      const scale = 0.94 + proximity * 0.13;
      nodeEls[index].style.setProperty('--node-proximity', proximity.toFixed(3));
      nodeEls[index].style.setProperty('--node-opacity', opacity.toFixed(3));
      nodeEls[index].style.setProperty('--node-scale', scale.toFixed(3));
      nodeEls[index].classList.toggle('is-active', proximity > 0.08);
    });
  }

  function hide() {
    nodeEls.forEach(node => {
      node.style.setProperty('--node-proximity', '0');
      node.style.setProperty('--node-opacity', '0.34');
      node.style.setProperty('--node-scale', '0.94');
      node.classList.remove('is-active');
    });
  }

  hero.addEventListener('pointermove', move, { passive: true });
  hero.addEventListener('pointerleave', hide, { passive: true });
  return { refresh: hide };
}

function createDiscoveryPinEffect(hero) {
  const layer = document.createElement('div');
  layer.className = 'room-discovery-pins';
  layer.setAttribute('aria-hidden', 'true');
  hero.appendChild(layer);

  let lastPin = 0;
  let lastX = -999;
  let lastY = -999;

  function addPin(event) {
    const now = performance.now();
    const rect = hero.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (now - lastPin < 120 && Math.hypot(x - lastX, y - lastY) < 34) return;

    lastPin = now;
    lastX = x;
    lastY = y;

    const pin = document.createElement('span');
    pin.className = 'room-discovery-pin material-symbols-outlined';
    pin.textContent = 'bookmark';
    pin.style.left = `${x}px`;
    pin.style.top = `${y}px`;
    layer.appendChild(pin);

    while (layer.children.length > 24) layer.firstElementChild.remove();
    window.setTimeout(() => pin.remove(), 1800);
  }

  hero.addEventListener('pointermove', addPin, { passive: true });
  return {
    refresh() {
      layer.replaceChildren();
      lastPin = 0;
    }
  };
}

// ── Language system ────────────────────────────────────────────────────────
// Each room page declares window.ROOM_CN = { title, texts: { selector: val } }
// before this script. Values can be a string (single element) or an array
// (applied to matching elements in document order).
(function () {
  const cn = window.ROOM_CN;
  if (!cn || !cn.texts) return;

  const LANG_KEY = 'samold-lang';
  const getLang = () => { try { return localStorage.getItem(LANG_KEY) || 'en'; } catch { return 'en'; } };
  const setLang = l => { try { localStorage.setItem(LANG_KEY, l); } catch {} };

  const enCache = {};
  let revealApi = null;
  let heroEffect = null;
  let titleSlotReady = false;

  function cache() {
    enCache.__title = document.title;
    for (const sel of Object.keys(cn.texts)) {
      const els = [...document.querySelectorAll(sel)];
      if (!els.length) continue;
      enCache[sel] = els.length === 1 ? els[0].innerHTML : els.map(e => e.innerHTML);
    }
  }

  function applyTexts(lang) {
    const isCN = lang === 'cn';
    root.lang = isCN ? 'zh-CN' : 'en';
    document.title = isCN ? (cn.title || document.title) : (enCache.__title || document.title);

    for (const [sel, cnVal] of Object.entries(cn.texts)) {
      const els = [...document.querySelectorAll(sel)];
      if (!els.length) continue;
      const enVal = enCache[sel];

      els.forEach((el, i) => {
        if (isCN) {
          const v = Array.isArray(cnVal) ? cnVal[i] : cnVal;
          if (v !== undefined) el.innerHTML = v;
        } else {
          const v = Array.isArray(enVal) ? enVal[i] : enVal;
          if (v !== undefined) el.innerHTML = v;
        }
      });
    }
  }

  function updateBtn(lang) {
    const btn = document.querySelector('.room-lang-btn');
    if (btn) btn.textContent = lang === 'cn' ? 'EN' : '中文';
  }

  function updateBrand(lang) {
    const label = document.querySelector('.brand-home span');
    if (label) label.textContent = 'SAMOLD';
  }

  function prepareTitleSlot() {
    if (titleSlotReady) return;
    const title = document.querySelector('.room-title');
    if (!title) return;
    const height = Math.ceil(title.getBoundingClientRect().height);
    if (height > 0) {
      title.style.setProperty('--room-title-slot', `${height}px`);
      titleSlotReady = true;
    }
  }

  function apply(lang) {
    if (lang === 'cn') prepareTitleSlot();
    applyTexts(lang);
    updateBtn(lang);
    updateBrand(lang);
    if (revealApi) revealApi.update(lang);
    if (heroEffect) heroEffect.refresh(lang);
    setLang(lang);
  }

  function injectBtn() {
    if (document.querySelector('.brand-block')) return;
    const brandHome = document.querySelector('.brand-home');
    if (!brandHome) return;

    const block = document.createElement('div');
    block.className = 'brand-block';
    brandHome.parentNode.insertBefore(block, brandHome);
    block.appendChild(brandHome);

    const btn = document.createElement('button');
    btn.className = 'room-lang-btn';
    btn.textContent = '中文';
    btn.setAttribute('aria-label', 'Switch language');
    block.appendChild(btn);

    btn.addEventListener('click', () => apply(getLang() === 'en' ? 'cn' : 'en'));
  }

  document.addEventListener('DOMContentLoaded', () => {
    cache();
    injectBtn();
    const room = currentRoomId();
    document.body.dataset.room = room;
    createRoomWordField();
    if (room === 'labs') revealApi = createRoomReveal(enCache, cn);
    heroEffect = createRoomHeroEffect(room);
    prepareTitleSlot();
    const stored = getLang();
    if (stored === 'cn') apply('cn');
    else {
      updateBtn('en');
      updateBrand('en');
      if (revealApi) revealApi.update('en');
      if (heroEffect) heroEffect.refresh('en');
    }
  });
})();

// The hero starts as a pure room landing screen. The header returns only after
// the visitor begins scrolling, with a soft top-down reveal.
(function () {
  const page = document.querySelector('.room-page');
  if (!page) return;
  let backdrop = document.querySelector('.room-top-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'room-top-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.prepend(backdrop);
  }

  function updateHeaderState() {
    const threshold = Math.min(120, window.innerHeight * 0.12);
    const scrolled = window.scrollY > threshold;
    page.classList.toggle('is-room-scrolled', scrolled);
    document.body.classList.toggle('is-room-scrolled', scrolled);
  }

  window.addEventListener('scroll', updateHeaderState, { passive: true });
  window.addEventListener('resize', updateHeaderState, { passive: true });
  document.addEventListener('DOMContentLoaded', updateHeaderState);
  updateHeaderState();
})();

// Room content cards use the same cursor-lit language as the resume cards:
// the global glow yields to a card-local radial light and touch screens light
// the card nearest the reading center.
(function () {
  const cards = [...document.querySelectorAll('.room-card')];
  if (!cards.length) return;

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  let activeCard = null;
  let raf = 0;

  function setActiveCard(card) {
    if (activeCard === card) return;
    if (activeCard) activeCard.classList.remove('is-card-lit');
    activeCard = card;
    document.body.classList.toggle('cursor-in-room-card', Boolean(card && finePointer.matches));
    if (activeCard) activeCard.classList.add('is-card-lit');
  }

  function setCardPoint(card, clientX, clientY) {
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--card-x', `${clientX - rect.left}px`);
    card.style.setProperty('--card-y', `${clientY - rect.top}px`);
  }

  function syncPointerCard(event) {
    if (!finePointer.matches) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const card = target ? target.closest('.room-card') : null;
    if (card) {
      setCardPoint(card, event.clientX, event.clientY);
      setActiveCard(card);
    } else {
      setActiveCard(null);
    }
  }

  function syncScrollCard() {
    if (finePointer.matches) return;
    const focusY = window.innerHeight * 0.5;
    let best = null;
    let bestDistance = Infinity;

    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      const visible = rect.bottom > 0 && rect.top < window.innerHeight;
      if (!visible) return;
      const center = rect.top + rect.height / 2;
      const distance = Math.abs(center - focusY);
      if (distance < bestDistance) {
        best = card;
        bestDistance = distance;
      }
    });

    if (best) {
      best.style.setProperty('--card-x', '50%');
      best.style.setProperty('--card-y', '50%');
    }
    setActiveCard(best);
  }

  function scheduleScrollSync() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      syncScrollCard();
    });
  }

  cards.forEach(card => {
    card.addEventListener('pointermove', event => {
      if (event.pointerType === 'mouse') {
        setCardPoint(card, event.clientX, event.clientY);
      }
    }, { passive: true });

    card.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse') {
        setCardPoint(card, event.clientX, event.clientY);
        setActiveCard(card);
      }
    }, { passive: true });

    card.addEventListener('pointerleave', event => {
      if (event.pointerType === 'mouse') {
        setActiveCard(null);
      }
    }, { passive: true });
  });

  document.addEventListener('pointermove', syncPointerCard, { passive: true });
  document.addEventListener('pointerleave', () => setActiveCard(null), { passive: true });
  window.addEventListener('blur', () => setActiveCard(null));
  window.addEventListener('scroll', scheduleScrollSync, { passive: true });
  window.addEventListener('resize', scheduleScrollSync, { passive: true });
  finePointer.addEventListener('change', () => {
    setActiveCard(null);
    scheduleScrollSync();
  });
  document.addEventListener('DOMContentLoaded', scheduleScrollSync);
  scheduleScrollSync();
})();
