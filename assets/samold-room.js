const root = document.documentElement;

window.addEventListener("pointermove", event => {
  root.style.setProperty("--cursor-x", `${event.clientX}px`);
  root.style.setProperty("--cursor-y", `${event.clientY}px`);
}, { passive: true });

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

  function apply(lang) {
    applyTexts(lang);
    updateBtn(lang);
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
    const stored = getLang();
    if (stored === 'cn') apply('cn');
    else updateBtn('en');
  });
})();
