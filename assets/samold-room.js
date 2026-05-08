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
    width: 1,
    height: 1
  };

  function svgEl(name, attrs = {}) {
    const node = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  }

  const baseField = svgEl('svg', { class: 'room-wordfield room-wordfield-base', 'aria-hidden': 'true' });
  const baseWords = svgEl('g');
  baseField.appendChild(baseWords);
  hero.prepend(baseField);

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

  const revealGroup = svgEl('g', { mask: `url(#${maskId})` });
  const revealBg = svgEl('rect', { class: 'room-reveal-bg' });
  const revealPattern = svgEl('g', { class: 'room-reveal-pattern' });
  const revealContent = svgEl('g', { class: 'room-reveal-content' });
  revealGroup.appendChild(revealBg);
  revealGroup.appendChild(revealPattern);
  revealGroup.appendChild(revealContent);
  revealSvg.appendChild(revealGroup);
  hero.appendChild(revealSvg);

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

  function heroValue(lang, selector) {
    if (lang === 'cn') {
      const value = cn.texts[selector];
      return Array.isArray(value) ? value[0] : value;
    }
    const value = enCache[selector];
    return Array.isArray(value) ? value[0] : value;
  }

  function drawWordField(group, width, height, compact) {
    group.replaceChildren();
    const fontSize = compact
      ? Math.max(24, Math.min(50, width * 0.043))
      : Math.max(54, Math.min(116, width * 0.098));
    const wordWidth = fontSize * (compact ? 4.85 : 5.1);
    const gapX = fontSize * (compact ? 0.82 : 1.24);
    const stepX = wordWidth + gapX;
    const stepY = compact ? fontSize * 1.34 : fontSize * 2.12;
    const letterSpacing = compact ? '0.06em' : '0.04em';
    const cols = Math.max(1, Math.floor(Math.max(0, width - wordWidth) / stepX) + 1);
    const totalWidth = wordWidth + (cols - 1) * stepX;
    const startX = (width - totalWidth) / 2 + wordWidth / 2;

    let row = 0;
    for (let y = fontSize * 0.82; y < height - fontSize * 0.18; y += stepY) {
      const rowShift = row % 2 ? Math.min(stepX * 0.42, Math.max(0, (width - totalWidth) * 0.5)) : 0;
      for (let col = 0; col < cols; col += 1) {
        const x = Math.min(width - wordWidth / 2, Math.max(wordWidth / 2, startX + col * stepX + rowShift));
        const text = svgEl('text', {
          x: String(x),
          y: String(y),
          'font-size': String(fontSize),
          'letter-spacing': letterSpacing,
          'text-anchor': 'middle'
        });
        text.textContent = 'SAMOLD';
        group.appendChild(text);
      }
      row += 1;
    }
  }

  function syncSvgSize() {
    const width = Math.max(1, Math.round(hero.clientWidth));
    const height = Math.max(1, Math.round(hero.clientHeight));
    state.width = width;
    state.height = height;

    for (const svg of [baseField, revealSvg]) {
      svg.setAttribute('width', String(width));
      svg.setAttribute('height', String(height));
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }

    maskRect.setAttribute('width', String(width));
    maskRect.setAttribute('height', String(height));
    revealBg.setAttribute('width', String(width));
    revealBg.setAttribute('height', String(height));

    const baseRadius = Math.max(86, Math.min(148, Math.min(width, height) * 0.19));
    followers.forEach((dot, index) => {
      dot.setAttribute('r', String(Math.max(58, baseRadius - index * 4.8)));
    });

    drawWordField(baseWords, width, height, false);
    drawWordField(revealPattern, width, height, true);
  }

  function syncCopyGeometry() {
    const heroRect = hero.getBoundingClientRect();
    copies.forEach(copy => {
      const source = document.querySelector(copy.selector);
      if (!source) return;

      const rect = source.getBoundingClientRect();
      const style = window.getComputedStyle(source);
      const padY = copy.kind === 'title' ? 18 : 8;
      const height = rect.height + padY * 2;

      copy.fo.setAttribute('x', String(rect.left - heroRect.left));
      copy.fo.setAttribute('y', String(rect.top - heroRect.top - padY));
      copy.fo.setAttribute('width', String(rect.width));
      copy.fo.setAttribute('height', String(height));

      Object.assign(copy.div.style, {
        display: 'block',
        width: '100%',
        height: 'auto',
        margin: '0',
        padding: `${padY}px 0 0`,
        boxSizing: 'border-box',
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        textAlign: style.textAlign,
        textTransform: style.textTransform,
        overflowWrap: style.overflowWrap || 'normal',
        whiteSpace: copy.kind === 'title' && state.lang !== 'cn' ? 'nowrap' : 'normal'
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

    state.targetX = inside ? state.lastClientX - rect.left : -600;
    state.targetY = inside ? state.lastClientY - rect.top : -600;
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
      if (value !== undefined) copy.div.innerHTML = value;
    });
    requestAnimationFrame(layout);
  }

  window.addEventListener('pointermove', event => {
    state.lastClientX = event.clientX;
    state.lastClientY = event.clientY;
    updateTargetFromLastPointer();
  }, { passive: true });

  window.addEventListener('scroll', updateTargetFromLastPointer, { passive: true });
  window.addEventListener('resize', layout, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(layout).observe(hero);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

  function tick() {
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
    if (label) label.textContent = lang === 'cn' ? '老样子' : 'SAMOLD';
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
    revealApi = createRoomReveal(enCache, cn);
    prepareTitleSlot();
    const stored = getLang();
    if (stored === 'cn') apply('cn');
    else {
      updateBtn('en');
      updateBrand('en');
      if (revealApi) revealApi.update('en');
    }
  });
})();

// The hero starts as a pure room landing screen. The header returns only after
// the visitor begins scrolling, with a soft top-down reveal.
(function () {
  const page = document.querySelector('.room-page');
  if (!page) return;

  function updateHeaderState() {
    const threshold = Math.min(120, window.innerHeight * 0.12);
    page.classList.toggle('is-room-scrolled', window.scrollY > threshold);
  }

  window.addEventListener('scroll', updateHeaderState, { passive: true });
  window.addEventListener('resize', updateHeaderState, { passive: true });
  document.addEventListener('DOMContentLoaded', updateHeaderState);
  updateHeaderState();
})();
