const root = document.documentElement;

window.addEventListener("pointermove", event => {
  root.style.setProperty("--cursor-x", `${event.clientX}px`);
  root.style.setProperty("--cursor-y", `${event.clientY}px`);
}, { passive: true });
