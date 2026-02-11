import { Core } from "./core.js";

// PWA install
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

Core.parseInitialRoute();
window.addEventListener("popstate", () => Core.render());

// Primeira renderização
Core.render();
