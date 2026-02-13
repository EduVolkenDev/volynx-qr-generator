export const Core = (() => {
  const state = {
    me: null,
    route: "/login",
    params: {},
    pendingToken: null, // vindo de /q/:token
  };

  const hooks = () => (window.APP_CUSTOM?.hooks || {});
  const pages = () => (window.APP_CUSTOM?.pages || {});
  const brand = () => (window.APP_CUSTOM?.brand || {});
  const theme = () => (window.APP_CUSTOM?.theme || {});

  function applyTheme() {
    const t = theme();
    if (!t || typeof t !== "object") return;
    const root = document.documentElement;
    for (const [k,v] of Object.entries(t)) {
      root.style.setProperty(`--${k}`, String(v));
    }
  }

  function tpl(name, fallback) {
    const p = pages();
    return (p && p[name]) ? p[name] : fallback;
  }

  async function api(path, opts = {}) {
    const res = await fetch(path, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(opts.headers||{}) },
      ...opts,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Erro");
    return data;
  }

  function setToast(msg) {
    const old = document.querySelector(".toast");
    if (old) old.remove();
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2800);
  }

  function moneyLabel(voucher) {
    const { type, value } = voucher;
    if (type === "PERCENT") return `${Number(value)}%`;
    if (type === "FIXED") return `£${Number(value).toFixed(2)}`;
    if (type === "FREE") return "Gratuidade";
    if (type === "FREE_ITEM") return "Item grátis";
    return "";
  }

  async function loadMe() {
    try {
      const r = await api("/api/auth/me");
      state.me = r.user;
      return state.me;
    } catch {
      state.me = null;
      return null;
    }
  }

  function navTo(route, params = {}) {
    state.route = route;
    state.params = params;
    history.pushState({}, "", route);
    render();
  }

  function parseInitialRoute() {
    // /q/:token => captura token e manda pra /login (com contexto)
    const p = location.pathname;
    const m = p.match(/^\/q\/([^\/]+)$/);
    if (m) {
      state.pendingToken = decodeURIComponent(m[1]);
      history.replaceState({}, "", "/login");
    }
    // normaliza
    if (!["/login","/setup","/admin","/operator"].includes(location.pathname)) {
      history.replaceState({}, "", "/login");
    }
    state.route = location.pathname;
  }

  function topbarHtml() {
    const b = { appName: "Volynx QR-Generator", logoText: "V", ...brand() };
    const me = state.me;

    const nav = me ? `
      <div class="nav">
        ${me.role === "admin" ? `<button class="pill ${state.route==="/admin"?"active":""}" data-nav="/admin">Admin</button>` : ""}
        <button class="pill ${state.route==="/operator"?"active":""}" data-nav="/operator">Operação</button>
        <button class="pill" data-action="logout">Sair</button>
      </div>
    ` : `<div class="nav"><span class="small">Acesso restrito</span></div>`;

    return `
      <div class="topbar">
        <div class="topbar-inner">
          <div class="brand">
            <div class="logo">${b.logoText}</div>
            <div>
              <h1>${b.appName}</h1>
              <p class="sub">${me ? (me.email + " • " + me.role) : "Login obrigatório"}</p>
            </div>
          </div>
          ${nav}
        </div>
      </div>
    `;
  }

  function viewLogin() {
    return tpl("login", `
      <div class="container">
        <div class="card">
          <div class="h2">Fazer login</div>
          ${state.pendingToken ? `
            <div class="badge warn" style="margin-bottom:12px">
              📲 Você escaneou um código VOLYNX. Faça login ou crie sua conta para ativar o acesso.
            </div>
          ` : `<p class="small">Acesse sua conta VOLYNX para gerenciar e validar seus códigos.</p>`}
          <div class="hr"></div>
          <div class="grid">
            <div class="field">
              <label>Email</label>
              <input id="email" placeholder="seu@email.com" autocomplete="username" />
            </div>
            <div class="field">
              <label>Senha</label>
              <input id="password" type="password" placeholder="••••••••" autocomplete="current-password" />
            </div>
            <button class="btn primary" data-action="login">Fazer login</button>
            <div class="hr"></div>
            <p class="small" style="text-align:center;margin:0">Não tem uma conta VOLYNX?</p>
            <button class="btn" data-nav="/setup">Cadastre-se aqui</button>
          </div>
        </div>
      </div>
    `);
  }

  function viewSetup() {
    return tpl("setup", `
      <div class="container">
        <div class="card">
          <div class="h2">Criar conta VOLYNX</div>
          <p class="small">Crie sua conta para começar a usar seus códigos e gerenciar seus acessos.</p>
          <div class="hr"></div>
          <div class="grid">
            <div class="field">
              <label>Nome da organização</label>
              <input id="org_name" placeholder="Minha Empresa" />
            </div>
            <div class="field">
              <label>Email</label>
              <input id="email" placeholder="voce@email.com" autocomplete="username" />
            </div>
            <div class="field">
              <label>Senha</label>
              <input id="password" type="password" placeholder="Crie uma senha forte" autocomplete="new-password" />
            </div>
            <button class="btn primary" data-action="setup">Criar conta</button>
            <div class="hr"></div>
            <p class="small" style="text-align:center;margin:0">Já tem uma conta?</p>
            <button class="btn" data-nav="/login">Fazer login</button>
          </div>
        </div>
      </div>
    `);
  }

  async function viewAdmin() {
    const stats = await api("/api/admin/stats");
    const vouchers = await api("/api/admin/vouchers");

    const rows = vouchers.vouchers.map(v => `
      <tr>
        <td><b>${escapeHtml(v.name)}</b><div class="small">${v.type} • ${moneyLabel(v)}</div></td>
        <td><span class="badge ${v.status==="active"?"ok":(v.status==="paused"?"warn":"no")}">${v.status}</span></td>
        <td><button class="btn" data-action="openVoucher" data-id="${v.id}">Abrir</button></td>
      </tr>
    `).join("");

    return tpl("admin", `
      <div class="container">
        <div class="grid cols3">
          <div class="card kpi"><div class="v">${stats.stats.vouchers}</div><div class="k">Vouchers</div></div>
          <div class="card kpi"><div class="v">${stats.stats.instances}</div><div class="k">Instâncias (tokens)</div></div>
          <div class="card kpi"><div class="v">${stats.stats.redeemed}</div><div class="k">Resgatados</div></div>
        </div>

        <div style="height:12px"></div>

        <div class="grid cols2">
          <div class="card">
            <div class="h2">Criar voucher</div>
            <div class="small">Crie a campanha e depois gere instâncias (tokens únicos).</div>
            <div class="hr"></div>
            <div class="grid">
              <div class="field"><label>Nome</label><input id="v_name" placeholder="Black Friday VIP" /></div>
              <div class="row">
                <div class="field"><label>Tipo</label>
                  <select id="v_type">
                    <option value="PERCENT">PERCENT</option>
                    <option value="FIXED">FIXED</option>
                    <option value="FREE">FREE</option>
                    <option value="FREE_ITEM">FREE_ITEM</option>
                  </select>
                </div>
                <div class="field"><label>Valor</label><input id="v_value" type="number" step="0.01" placeholder="10" /></div>
              </div>
              <div class="row">
                <div class="field"><label>Início (ISO)</label><input id="v_starts" placeholder="2026-02-10T00:00:00Z (opcional)" /></div>
                <div class="field"><label>Fim (ISO)</label><input id="v_ends" placeholder="2026-03-10T23:59:59Z (opcional)" /></div>
              </div>
              <div class="row">
                <div class="field"><label>Limite total</label><input id="v_limit_total" type="number" placeholder="0 = ilimitado" /></div>
                <div class="field"><label>Por usuário</label><input id="v_limit_user" type="number" placeholder="0 = ilimitado" /></div>
              </div>
              <button class="btn primary" data-action="createVoucher">Criar</button>
            </div>
          </div>

          <div class="card">
            <div class="h2">Vouchers</div>
            <div class="small">Clique em “Abrir” para gerar tokens e ver QR.</div>
            <div class="hr"></div>
            <table class="table">
              <thead><tr><th>Nome</th><th>Status</th><th></th></tr></thead>
              <tbody>${rows || `<tr><td colspan="3" class="small">Nenhum voucher ainda.</td></tr>`}</tbody>
            </table>
          </div>
        </div>

        <div style="height:12px"></div>

        <div id="voucherDetail"></div>
      </div>
    `);
  }

  async function renderVoucherDetail(voucherId) {
    const host = document.querySelector("#voucherDetail");
    if (!host) return;

    const instances = await api(`/api/admin/vouchers/${voucherId}/instances`);
    const instRows = instances.instances.map(i => `
      <tr>
        <td><code>${i.token}</code><div class="small">${i.redeemed_at ? ("Resgatado: " + i.redeemed_at) : "Não resgatado"}</div></td>
        <td><span class="badge ${i.status==="active"?"ok":(i.status==="paused"?"warn":"no")}">${i.status}</span></td>
        <td class="row">
          <a class="btn" href="/api/qr/${encodeURIComponent(i.token)}.svg" target="_blank" rel="noreferrer">QR</a>
          <button class="btn" data-action="setInstanceStatus" data-token="${i.token}" data-status="paused">Pausar</button>
          <button class="btn" data-action="setInstanceStatus" data-token="${i.token}" data-status="active">Ativar</button>
          <button class="btn danger" data-action="setInstanceStatus" data-token="${i.token}" data-status="disabled">Desativar</button>
        </td>
      </tr>
    `).join("");

    host.innerHTML = `
      <div class="card">
        <div class="row" style="justify-content:space-between">
          <div>
            <div class="h2">Instâncias (tokens únicos)</div>
            <div class="small">Limite de listagem: 500. Tokens gerados são single-use.</div>
          </div>
          <div class="row">
            <input id="gen_count" type="number" style="width:120px" value="10" min="1" max="5000" />
            <button class="btn primary" data-action="generateInstances" data-id="${voucherId}">Gerar</button>
          </div>
        </div>
        <div class="hr"></div>
        <table class="table">
          <thead><tr><th>Token</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>${instRows || `<tr><td colspan="3" class="small">Nenhuma instância.</td></tr>`}</tbody>
        </table>
      </div>
    `;

    // bind actions dentro do voucherDetail (HTML foi inserido depois do render principal)
    host.querySelectorAll("[data-action]").forEach(el => {
      el.addEventListener("click", () => handle(el.getAttribute("data-action"), el.dataset));
    });
  }

  function viewOperator() {
    return tpl("operator", `
      <div class="container">
        <div class="grid cols2">
          <div class="card">
            <div class="h2">Validar / Resgatar código</div>
            <div class="small">Escaneie o QR code ou cole o token abaixo para validar e resgatar o acesso.</div>
            <div class="hr"></div>
            <div class="grid">
              <div class="field">
                <label>Token do código</label>
                <input id="op_token" placeholder="Cole o token aqui" />
              </div>
              <div class="row">
                <button class="btn primary" data-action="validateToken">Validar código</button>
                ${`<button class="btn" data-action="usePendingToken">Usar código escaneado</button>`}
              </div>
              <div id="op_result"></div>
            </div>
          </div>

          <div class="card">
            <div class="h2">Últimos resgates</div>
            <div class="small">Auditoria rápida para operação.</div>
            <div class="hr"></div>
            <div id="op_redemptions" class="small">Carregando…</div>
          </div>
        </div>
      </div>
    `);
  }

  async function loadRedemptions() {
    const box = document.querySelector("#op_redemptions");
    if (!box) return;
    try {
      const r = await api("/api/operator/redemptions");
      const items = r.redemptions.slice(0, 10).map(x => `
        <div class="card" style="margin-bottom:10px">
          <div class="row" style="justify-content:space-between">
            <div><b>${escapeHtml(x.voucher_name)}</b><div class="small">${escapeHtml(x.token)}</div></div>
            <div class="small">${x.created_at}</div>
          </div>
          <div class="small">${escapeHtml(x.redeemed_by)} • ${x.type} ${x.value}</div>
        </div>
      `).join("");
      box.innerHTML = items || `<span class="small">Sem resgates ainda.</span>`;
    } catch (e) {
      box.textContent = "Falha ao carregar resgates.";
    }
  }

  function mountSignaturePad(canvas) {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.scale(dpr, dpr);

    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    let drawing = false;
    let last = null;

    function pos(e) {
      const r = canvas.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
      return { x, y };
    }

    function down(e) {
      drawing = true;
      last = pos(e);
      e.preventDefault();
    }
    function move(e) {
      if (!drawing) return;
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      e.preventDefault();
    }
    function up() { drawing = false; last = null; }

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    canvas.addEventListener("touchstart", down, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", up);

    return {
      clear() { ctx.clearRect(0,0,canvas.width,canvas.height); },
      toDataUrl() { return canvas.toDataURL("image/png"); },
    };
  }

  async function render() {
    applyTheme();
    const app = document.querySelector("#app");
    const h = hooks();

    try { h.beforeRender?.(state.route, state); } catch {}

    // topbar + view
    let viewHtml = "";
    if (state.route === "/login") viewHtml = viewLogin();
    else if (state.route === "/setup") viewHtml = viewSetup();
    else {
      await loadMe();
      if (!state.me) {
        state.route = "/login";
        history.replaceState({}, "", "/login");
        viewHtml = viewLogin();
      } else if (state.route === "/admin") {
        if (state.me.role !== "admin") {
          state.route = "/operator";
          history.replaceState({}, "", "/operator");
          viewHtml = viewOperator();
        } else {
          viewHtml = await viewAdmin();
        }
      } else if (state.route === "/operator") {
        viewHtml = viewOperator();
      } else {
        state.route = "/login";
        history.replaceState({}, "", "/login");
        viewHtml = viewLogin();
      }
    }

    app.innerHTML = topbarHtml() + viewHtml;

    // bind nav
    app.querySelectorAll("[data-nav]").forEach(el => {
      el.addEventListener("click", () => navTo(el.getAttribute("data-nav")));
    });

    // bind actions
    app.querySelectorAll("[data-action]").forEach(el => {
      el.addEventListener("click", () => handle(el.getAttribute("data-action"), el.dataset));
    });

    // operator: preload pending token
    if (state.route === "/operator") {
      if (state.pendingToken) {
        const inp = document.querySelector("#op_token");
        if (inp && !inp.value) inp.value = state.pendingToken;
      }
      loadRedemptions();
    }

    // admin: if selected voucher open detail
    if (state.route === "/admin" && state.params?.voucherId) {
      renderVoucherDetail(state.params.voucherId);
    }

    try { h.afterRender?.(state.route, state); } catch {}
  }

  async function handle(action, data) {
    const h = hooks();
    try {
      if (h.onAction?.(action, data, state) === true) return; // custom override handled
    } catch {}

    try {
      if (action === "login") {
        const email = document.querySelector("#email")?.value?.trim();
        const password = document.querySelector("#password")?.value;
        await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
        await loadMe();
        // se veio de QR, vai direto pra operação com token
        if (state.pendingToken) navTo("/operator");
        else navTo(state.me?.role === "admin" ? "/admin" : "/operator");
        setToast("Login ok");
      }

      if (action === "logout") {
        await api("/api/auth/logout", { method: "POST", body: "{}" });
        state.me = null;
        navTo("/login");
        setToast("Saiu");
      }

      if (action === "setup") {
        const org_name = document.querySelector("#org_name")?.value?.trim();
        const email = document.querySelector("#email")?.value?.trim();
        const password = document.querySelector("#password")?.value;
        await api("/api/setup", { method: "POST", body: JSON.stringify({ org_name, email, password }) });
        await loadMe();
        navTo("/admin");
        setToast("Setup concluído");
      }

      if (action === "createVoucher") {
        const name = document.querySelector("#v_name")?.value?.trim();
        const type = document.querySelector("#v_type")?.value;
        const value = document.querySelector("#v_value")?.value;
        const starts_at = document.querySelector("#v_starts")?.value?.trim() || null;
        const ends_at = document.querySelector("#v_ends")?.value?.trim() || null;
        const max_redemptions_total = Number(document.querySelector("#v_limit_total")?.value || 0);
        const max_redemptions_per_user = Number(document.querySelector("#v_limit_user")?.value || 0);

        await api("/api/admin/vouchers", {
          method: "POST",
          body: JSON.stringify({ name, type, value, starts_at, ends_at, max_redemptions_total, max_redemptions_per_user })
        });
        setToast("Voucher criado");
        render();
      }

      if (action === "openVoucher") {
        navTo("/admin", { voucherId: Number(data.id) });
      }

      if (action === "generateInstances") {
        const count = Number(document.querySelector("#gen_count")?.value || 1);
        await api(`/api/admin/vouchers/${Number(data.id)}/instances`, {
          method: "POST",
          body: JSON.stringify({ count })
        });
        setToast("Tokens gerados");
        renderVoucherDetail(Number(data.id));
      }

      if (action === "setInstanceStatus") {
        await api(`/api/admin/instances/${encodeURIComponent(data.token)}`, {
          method: "PATCH",
          body: JSON.stringify({ status: data.status })
        });
        setToast("Status atualizado");
        // re-render detail
        if (state.params?.voucherId) renderVoucherDetail(state.params.voucherId);
      }

      if (action === "usePendingToken") {
        if (!state.pendingToken) return setToast("Nenhum token capturado ainda");
        const inp = document.querySelector("#op_token");
        if (inp) inp.value = state.pendingToken;
      }

      if (action === "validateToken") {
        const token = document.querySelector("#op_token")?.value?.trim();
        const r = await api("/api/operator/validate", { method: "POST", body: JSON.stringify({ token }) });

        const host = document.querySelector("#op_result");
        const badgeClass = r.valid ? "ok" : "no";
        host.innerHTML = `
          <div class="card">
            <div class="row" style="justify-content:space-between">
              <div>
                <div class="badge ${badgeClass}">${r.valid ? "VÁLIDO" : "INVÁLIDO"} • ${escapeHtml(r.reason)}</div>
                <div class="h2" style="margin-top:10px">${escapeHtml(r.voucher.name)}</div>
                <div class="small">${escapeHtml(r.voucher.type)} • ${escapeHtml(String(r.voucher.value))}</div>
              </div>
              <img alt="qr" style="width:96px;height:96px;border-radius:12px;border:1px solid var(--border);background:rgba(0,0,0,.18)"
                   src="/api/qr/${encodeURIComponent(token)}.svg" />
            </div>
            <div class="hr"></div>

            ${r.valid ? `
              <div class="small">Assinatura (opcional):</div>
              <canvas class="signature" id="sig"></canvas>
              <div class="row" style="margin-top:10px">
                <button class="btn" data-action="sigClear">Limpar assinatura</button>
                <button class="btn primary" data-action="redeemToken">Resgatar</button>
              </div>
            ` : `<div class="small">Nada a fazer. Corrija o token ou reative a instância.</div>`}
          </div>
        `;

        // bind dynamic actions
        host.querySelectorAll("[data-action]").forEach(el => el.addEventListener("click", () => handle(el.getAttribute("data-action"), el.dataset)));
        if (r.valid) {
          const pad = mountSignaturePad(document.querySelector("#sig"));
          state._sigPad = pad;
        }
      }

      if (action === "sigClear") {
        state._sigPad?.clear?.();
      }

      if (action === "redeemToken") {
        const token = document.querySelector("#op_token")?.value?.trim();
        const signature_data_url = state._sigPad ? state._sigPad.toDataUrl() : null;
        await api("/api/operator/redeem", { method: "POST", body: JSON.stringify({ token, signature_data_url }) });
        setToast("Resgate concluído");
        state.pendingToken = null;
        document.querySelector("#op_result").innerHTML = "";
        loadRedemptions();
      }

    } catch (e) {
      setToast(e.message || "Erro");
    }
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  return { state, api, navTo, render, parseInitialRoute, setToast };
})();
