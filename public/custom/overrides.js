/**
 * Volynx QR-Generator — Custom Overrides (edite aqui, não no core)
 *
 * Objetivo: permitir que designers/devs mudem UI/UX (HTML), tema (CSS vars) e funções (hooks)
 * sem tocar nos arquivos principais.
 *
 * Regras do jogo:
 * - Você pode sobrescrever páginas: login, setup, admin, operator
 * - Você pode aplicar um tema (CSS variables) em `theme`
 * - Você pode interceptar ações em `hooks.onAction` (retorne true para impedir o core)
 */

// DEV BOOST: no localhost, mata cache do PWA e força reload do overrides.css
(() => {
  if (location.hostname !== "localhost") return;

  // 1) força o browser a baixar o CSS custom sempre
  const link = document.querySelector(
    'link[rel="stylesheet"][href^="/custom/overrides.css"]',
  );
  if (link) link.href = `/custom/overrides.css?v=${Date.now()}`;

  // 2) desliga Service Worker/caches no ambiente local
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()));
  }
  if (window.caches?.keys) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
})();

window.APP_CUSTOM = {
  brand: {
    appName: "Volynx QR-Generator",
    logoText: "V",
  },

  // Qualquer var aqui vira --{key} no :root (ex.: primary => --primary)
  theme: {
    // primary: "#22c55e",
  },

  // Sobrescreva HTML de telas aqui (opcional)
  pages: {
    // login: `<div class="container"><div class="card">Meu login custom...</div></div>`,
  },

  hooks: {
    beforeRender(route, state) {
      // Ex.: bloquear /setup em produção
      // if (route === "/setup" && location.hostname !== "localhost") location.href = "/login";
    },

    afterRender(route, state) {
      // Ex.: tracking simples
      // console.log("route:", route);
    },

    onAction(action, data, state) {
      // Ex.: substituir comportamento do botão login
      // if (action === "login") { ...; return true; }
      return false;
    },
  },
};
