"use strict";

// Os dados do simulador são lidos do JSON; os cálculos ficam em calculations.js.
const $ = (id) => document.getElementById(id);

async function loadSimulatorConfig() {
  const response = await fetch("data/simulator.json", { cache: "no-cache" });
  if (!response.ok)
    throw new Error("Não foi possível carregar os dados do simulador.");
  const config = await response.json();
  if (
    config.schemaVersion !== 1 ||
    !config.cars?.mini ||
    !config.cars?.dolphin ||
    !config.states ||
    !config.fuel?.snapshot ||
    !config.defaults?.input ||
    !config.defaults?.assumptions ||
    !config.subscription?.defaults ||
    !config.subscription?.examplePrices
  ) {
    throw new Error("Confira a estrutura de data/simulator.json.");
  }
  normalizeFuel(config.fuel.snapshot);
  return config;
}

function initializeSimulator(config) {
  const { images, artwork, glyphs, gasImages } = window.LocalizaAssets;
  const API = config.fuel.api;
  const API_SNAPSHOT = config.fuel.snapshot;
  const icon = (name, extra = "") =>
    glyphs[name].replace(
      "<svg ",
      `<svg class="icon ${extra}" aria-hidden="true" focusable="false" `,
    );
  const STATES = config.states;
  const CARS = config.cars;
  const state = {
    screen: "routine",
    selectedScenario: null,
    input: { ...config.defaults.input },
    a: { ...config.defaults.assumptions },
    plan: { ...config.subscription.defaults, prices: examplePrices() },
    result: null,
    checks: [false, false, false],
    fuel: {
      data: normalizeFuel(API_SNAPSHOT),
      status: "saved",
      loading: false,
      lastError: null,
    },
  };
  try {
    const cached = JSON.parse(localStorage.getItem("localiza-fuel-v2"));
    const data = normalizeFuel(cached);
    if (data.collectedAt > state.fuel.data.collectedAt) state.fuel.data = data;
  } catch {}
  const number = (n, d = 0) =>
    Number(n).toLocaleString("pt-BR", { maximumFractionDigits: d });
  const brl = (n, d = 0) =>
    Number(n).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
  const collectionDate = () =>
    state.fuel.data.collectedAt.slice(0, 10).split("-").reverse().join("/");
  function gasoline(uf = state.input.uf) {
    const value = state.fuel.data.prices[uf];
    if (!Number.isFinite(value) || value <= 0)
      throw new Error("A API não tem preço para esse estado. Escolha outro.");
    return value;
  }
  function examplePrices() {
    return JSON.parse(JSON.stringify(config.subscription.examplePrices));
  }
  function planNote() {
    return state.plan.prices[state.input.car].source === "example"
      ? "Valores de demonstração"
      : "Valores informados por você. Confirme a cotação para este prazo e esta franquia.";
  }
  function monthlyDecision(r) {
    const p = r.subscription;
    if (!p.ready) return "Informe as duas mensalidades para comparar.";
    if (p.exceedsKm)
      return "Sua rotina ultrapassa a franquia. Falta incluir o custo dos km excedentes.";
    if (r.status === "not-fit")
      return "A distância exige rever a recarga. O menor preço não confirma que esta rotina funciona.";
    if (Math.abs(p.savings) < 0.005)
      return "Assinatura + uso ficam no mesmo valor neste cenário.";
    return p.savings > 0
      ? "O elétrico custa menos neste cenário. Confirme o acesso à recarga em casa."
      : "O carro a gasolina custa menos neste cenário, mesmo com a energia mais barata.";
  }
  function decisionSummary(r) {
    const p = r.subscription;
    if (!p.ready)
      return { kind: "pending", glyph: "info", title: "Faltam mensalidades", detail: "Informe os dois valores." };
    if (p.exceedsKm)
      return { kind: "restricted", glyph: "gauge", title: "Franquia excedida", detail: `${number(p.excessKm)} km extras · custo pendente` };
    if (r.status === "not-fit")
      return { kind: "restricted", glyph: "warning-circle", title: "Reveja a rotina", detail: "Recarga precisa de ajuste." };
    if (r.status === "adjust")
      return { kind: "restricted", glyph: "charging-station", title: "Planeje a recarga", detail: "Confirme o acesso ao carregador." };
    if (Math.abs(p.savings) < 0.005)
      return { kind: "neutral", glyph: "wallet", title: "Custos equivalentes", detail: "Assinatura + uso" };
    return p.savings > 0
      ? { kind: "electric", glyph: "lightning", title: "Elétrico custa menos", detail: "Neste cenário" }
      : { kind: "gasoline", glyph: "gas-pump", title: "Gasolina custa menos", detail: "Neste cenário" };
  }
  function decisionCard(r) {
    const d = decisionSummary(r);
    return `<div class="decision decision-compact ${d.kind}" data-decision><span class="decision-symbol" aria-hidden="true">${icon(d.glyph)}</span><div><strong>${d.title}</strong><small>${d.detail}</small></div></div>`;
  }
  function clearPlanQuotes() {
    if (!$("assumptionForm")) return;
    $("plan-gas").value = "";
    $("plan-electric").value = "";
    $("assumptionForm").dataset.priceSource = "manual";
    $("assumptionForm").dataset.planChanged = "true";
    $("plan-price-note").textContent =
      "Prazo ou franquia alterados. Informe novas mensalidades; não calculamos descontos automaticamente.";
  }
  function applyAssumptions(form) {
    if (!form.reportValidity()) return;
    const data = new FormData(form),
      uf = data.get("uf");
    try {
      gasoline(uf);
      const amount = (name) =>
        data.get(name) === "" ? null : Number(data.get(name));
      const nextPlan = {
          months: Number(data.get("months")),
          kmAllowance: Number(data.get("kmAllowance")),
        },
        nextPrices = {
          electricPrice: amount("electricPrice"),
          gasPrice: amount("gasPrice"),
          source: form.dataset.priceSource || "manual",
        };
      compareSubscription(
        { monthlyKm: 0, electricCost: 0, fuelCost: 0 },
        { ...nextPlan, ...nextPrices },
      );
      const changed =
        nextPlan.months !== state.plan.months ||
        nextPlan.kmAllowance !== state.plan.kmAllowance;
      if (changed)
        for (const id of Object.keys(state.plan.prices))
          state.plan.prices[id] = {
            electricPrice: null,
            gasPrice: null,
            source: "manual",
          };
      Object.assign(state.plan, nextPlan);
      state.plan.prices[state.input.car] = nextPrices;
      state.input.uf = uf;
      state.input.daysMonth = Number(data.get("daysMonth"));
      state.input.charging = "yes";
      state.a.homeTariff = Number(data.get("homeTariff"));
      if (state.result) state.result = compute();
      $("modal").close();
      render();
      toast("Ajustes aplicados.");
    } catch (error) {
      $("plan-error").hidden = false;
      $("plan-error").textContent = error.message;
    }
  }
  function compute() {
    const usage = simulate(
      { ...state.input, charging: "yes" },
      CARS[state.input.car],
      { ...state.a, gasPrice: gasoline() },
    );
    return {
      ...usage,
      subscription: compareSubscription(usage, {
        months: state.plan.months,
        kmAllowance: state.plan.kmAllowance,
        ...state.plan.prices[state.input.car],
      }),
    };
  }
  function radio(name, values, current) {
    return `<div class="seg">${values.map(([v, label, glyph]) => `<input type="radio" id="${name}-${v}" name="${name}" value="${v}" ${v === current ? "checked" : ""}><label for="${name}-${v}">${icon(glyph)}<span>${label}</span></label>`).join("")}</div>`;
  }
  function fuelNote(uf = state.input.uf) {
    const price = state.fuel.data.prices[uf];
    return `<div class="fuel-inline"><span class="fuel-glyph">${icon("gas-pump")}</span><div><strong>${Number.isFinite(price) ? `Gasolina em ${uf.toUpperCase()} · ${brl(price, 2)}/L` : "Estado sem preço na API"}</strong><small>${state.fuel.loading ? "Consultando a API…" : state.fuel.status === "live" ? "Consulta API" : state.fuel.status === "unavailable" ? "Consulta indisponível · dado salvo" : "Dado salvo"} · coleta ${collectionDate()}</small></div></div>`;
  }
  function stateOptions(current) {
    return Object.entries(STATES)
      .map(
        ([uf, name]) =>
          `<option value="${uf}" ${uf === current ? "selected" : ""} ${Number.isFinite(state.fuel.data.prices[uf]) ? "" : "disabled"}>${name}${Number.isFinite(state.fuel.data.prices[uf]) ? "" : " · sem dado"}</option>`,
      )
      .join("");
  }
  function syncForm() {
    const form = $("routineForm");
    if (!form) return;
    const data = new FormData(form);
    state.input.kmDay = Number(data.get("kmDay") || 40);
    state.input.daysMonth = Number(data.get("daysMonth") || 30);
    state.input.charging = "yes";
  }
  function render() {
    const isRoutine = state.screen === "routine";
    document.querySelectorAll("[data-scenario]").forEach((button) => {
      const active = button.dataset.scenario === state.selectedScenario;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    $("stepRoutine").classList.toggle("active", isRoutine);
    $("stepResult").classList.toggle("active", !isRoutine);
    $("stepResult").disabled = !state.result;
    $("stepRoutine").setAttribute("aria-current", isRoutine ? "step" : "false");
    $("stepResult").setAttribute("aria-current", isRoutine ? "false" : "step");
    $("screen").innerHTML = isRoutine ? routine() : resultScreen();
    $("dock").innerHTML = isRoutine
      ? `<button class="primary" data-action="simulate" ${Number.isFinite(state.fuel.data.prices[state.input.uf]) ? "" : "disabled"}>Ver meu cenário ${icon("arrow-right")}</button>`
      : `<button class="icon-button" data-action="edit" aria-label="Editar rotina">${icon("sliders-horizontal")}</button><button class="primary" data-action="next">Antes de assinar ${icon("arrow-right")}</button>`;
  }
  function routine() {
    const i = state.input;
    return `<div class="intro"><div class="eyebrow">Simulador de rotina</div><h1>Um elétrico funciona<br>para você?</h1><p>Compare assinatura e uso, com recarga em casa.</p></div><form id="routineForm"><section class="card vehicle-card"><div class="section-label"><span class="label-icon">${icon("car-profile")} Escolha o elétrico</span></div><div class="cars">${Object.values(
      CARS,
    )
      .map(
        (c) =>
          `<button type="button" class="car" data-car="${c.id}" aria-pressed="${i.car === c.id}"><span class="check">${icon("check-circle")}</span><img src="${images[c.id]}" alt="${c.full}"><strong>${c.name}</strong><small>Comparar com ${c.gas.name}</small></button>`,
      )
      .join(
        "",
      )}</div></section><section class="card routine-card"><div class="section-label"><span class="label-icon">${icon("path")} Sua rotina mensal</span></div><div class="routine-slider-box"><div class="range-head"><span class="range-title">Quilometragem diária</span><div class="km-input-badge"><input type="number" id="kmNumber" min="10" max="240" step="5" value="${i.kmDay}" aria-label="Quilometragem diária"><small>km/dia</small></div></div><input type="range" id="kmDay" name="kmDay" min="10" max="240" step="5" value="${i.kmDay}"><div class="range-labels"><span>10 km</span><span>120 km</span><span>240 km</span></div></div><div class="routine-details-grid"><div class="field days-field-v2"><label for="daysMonth"><span class="label-icon-inline">${icon("calendar-dots")}</span> Dias de uso/mês</label><div class="stepper-input"><button type="button" class="step-btn" data-step="-1" aria-label="Diminuir dias">-</button><input type="number" id="daysMonth" name="daysMonth" min="1" max="31" step="1" value="${i.daysMonth}" required><button type="button" class="step-btn" data-step="1" aria-label="Aumentar dias">+</button></div></div><div class="stat-badge-month"><span class="stat-badge-label">Total estimado</span><strong id="monthPreview">${number(i.kmDay * i.daysMonth)} <small>km/mês</small></strong></div></div><div class="home-charging-card"><div class="charging-card-header"><span class="charging-icon-badge">${icon("house-line")}</span><div><strong>Recarga em casa</strong><p id="chargingHint">${chargingHint()}</p></div></div></div></section><section class="card plan-preview"><div class="section-label"><span class="label-icon">${icon("wallet")} Assinatura + uso</span></div><p>${state.plan.months} meses · ${number(state.plan.kmAllowance)} km/mês para os dois carros</p><button type="button" class="subtle-link" data-action="assumptions">Ajustar preços e assinatura</button><p class="hint example-notice">${planNote()}</p></section><div class="price-setting"><div data-fuel-note>${fuelNote()}</div><button type="button" class="icon-button" data-action="assumptions" aria-label="Ajustar preços e assinatura">${icon("sliders-horizontal")}</button></div><p class="note">${icon("info")}<span>O total soma mensalidade e energia ou gasolina. Não inclui instalação, taxas ou km excedentes.</span></p><div id="formError" class="error" role="alert" hidden></div></form>`;
  }
  function chargingHint() {
    return "Este comparativo considera recarga em casa. Confirme o acesso ao carregador.";
  }
  function row(label, value) {
    return `<div class="data-row"><span>${label}</span><strong>${value}</strong></div>`;
  }
  function group(id, title, subtitle, glyph, body) {
    return `<details class="group" id="group-${id}"><summary><span class="group-icon">${icon(glyph)}</span><span class="summary-text"><strong>${title}</strong><small>${subtitle}</small></span>${icon("caret-down", "chevron")}</summary><div class="group-body">${body}</div></details>`;
  }
  const STATUS = {
    fits: {
      badge: "Autonomia estimada",
      title: "Seu trajeto cabe na estimativa.",
      detail: "Confirme o acesso à recarga em casa.",
    },
    adjust: {
      badge: "Planeje a recarga",
      title: "Seu trajeto cabe. A recarga pede atenção.",
      detail: "Confira os pontos públicos antes de sair.",
    },
    "not-fit": {
      badge: "Reveja este cenário",
      title: "A distância pede outra configuração.",
      detail: "Considere outro carro ou recargas durante o dia.",
    },
  };
  function resultScreen() {
    const r = state.result,
      i = state.input,
      c = CARS[i.car],
      s = STATUS[r.status],
      p = r.subscription;
    const fraction = (i.kmDay * state.a.safety) / r.usableRange,
      filled = Math.min(10, Math.ceil(fraction * 10)),
      max = Math.max(
        p.gasTotal ?? r.fuelCost,
        p.electricTotal ?? r.electricCost,
      ),
      cheaper = p.ready && p.savings >= 0;
    const money = (n) => (n == null ? "Cotação necessária" : brl(n, 2));
    const costSide = (electric) => {
      const price = state.plan.prices[i.car],
        total = electric ? p.electricTotal : p.gasTotal,
        usage = electric ? r.electricCost : r.fuelCost;
      return `<article class="cost-side ${electric ? "electric" : ""}"><span class="mini-icon">${icon(electric ? "lightning" : "gas-pump")} ${electric ? "Elétrico" : "Gasolina"}</span><img class="compare-car-photo" src="${electric ? images[i.car] : gasImages[i.car]}" alt="Foto ilustrativa ${electric ? c.full : c.gas.full}"><h3>${electric ? c.name : c.gas.name}</h3><small class="cost-version">${electric ? c.version : c.gas.version}</small><div class="cost-total"><small>${p.exceedsKm ? "Subtotal / mês" : "Total / mês"}</small><strong class="${total == null ? "pending-cost" : ""}" data-total="${electric ? "electric" : "gas"}">${money(total)}</strong></div><div class="bar"><span style="width:${((total ?? usage) / max) * 100}%"></span></div><details class="cost-disclosure"><summary aria-label="Detalhar custo do ${electric ? c.name : c.gas.name}"><span>Detalhar custo</span>${icon("caret-down", "cost-chevron")}</summary><dl class="cost-breakdown"><div><dt>Assinatura</dt><dd>${money(electric ? price.electricPrice : price.gasPrice)}</dd></div><div><dt>${electric ? "Energia" : "Gasolina"}</dt><dd>${brl(usage, 2)}</dd></div></dl></details></article>`;
    };
    const autonomy =
      row("Sua rotina", `${number(i.kmDay)} km/dia`) +
      row("Estimativa entre recargas", `${number(r.usableRange)} km`) +
      row("Onde recarregar", "Em casa") +
      `<div class="explain">Confirme o acesso ao carregador e avalie a instalação, se necessário. Se o trajeto diário exigir outra recarga, este cenário doméstico precisa ser revisto.</div>`;
    const method =
      row("Gasolina em " + i.uf.toUpperCase(), brl(gasoline(), 2) + "/L") +
      row(
        "Consumo do " + c.gas.name,
        number(c.gas.urban, 1) + " km/L na cidade",
      ) +
      row("Energia em casa", brl(r.tariff, 2) + "/kWh") +
      row("Preço coletado", collectionDate()) +
      `<div class="explain">O total soma assinatura e uso. Não inclui instalação, taxas extras ou km excedentes.<br><br>Consumo a gasolina: Inmetro 2026. Para o elétrico, usamos 80% da autonomia nominal, bateria entre 20% e 80%, perdas de recarga de 10% e margem de 30% no trajeto diário.</div>`;
    function comparisonCard(electricCar, gasCar, r, p) {
      // Atributos de comparação com ícones visuais
      const specs = [
        { 
          glyph: "gauge", 
          label: "Câmbio", 
          gas: "Automático CVT (7 marchas)", 
          elec: "Automático direto (1 marcha)" 
        },
        { 
          glyph: "suitcase", 
          label: "Porta-malas", 
          gas: "300 litros", 
          elec: electricCar.id === "mini" ? "230 litros" : "345 litros" 
        },
        { 
          glyph: "shield", 
          label: "Segurança", 
          gas: "2 airbags (frontais)", 
          elec: "6 airbags (frontais, laterais e cortina)" 
        },
        { 
          glyph: "screencast", 
          label: "Multimídia", 
          gas: "Central multimídia 7\"", 
          elec: electricCar.id === "mini" ? "Tela giratória 10.1\" com Apple CarPlay/Android" : "Tela giratória 12.8\" com Apple CarPlay/Android" 
        },
      ];

      return `
      <details class="card compare-hub-card specs-disclosure">
        <summary class="specs-summary">
          <div class="specs-summary-title">
            <span class="summary-icon">${icon("sliders-horizontal")}</span>
            <h4>Comparativo de características</h4>
          </div>
          <div class="specs-summary-right">
            <div class="specs-cars-legend">
              <span class="legend-badge gas-badge">${icon("gas-pump")} ${gasCar.name}</span>
              <span class="legend-badge elec-badge">${icon("lightning")} ${electricCar.name}</span>
            </div>
            ${icon("caret-down", "specs-chevron")}
          </div>
        </summary>

        <div class="specs-cards-grid">
          ${specs.map(s => `
            <div class="spec-card-row">
              <div class="spec-row-lead">
                <span class="spec-glyph">${icon(s.glyph)}</span>
                <strong>${s.label}</strong>
              </div>
              <div class="spec-columns">
                <div class="spec-val-box gas-val">
                  <small class="name-argo">${icon("gas-pump")} ${gasCar.name}</small>
                  <span>${s.gas}</span>
                </div>
                <div class="spec-val-box elec-val">
                  <small class="name-electric">${icon("lightning")} ${electricCar.name}</small>
                  <span>${s.elec}</span>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </details>`;
    }

    return `<div class="intro result-intro"><div class="eyebrow">${c.full}</div><h1>Seu cenário</h1><p>${number(i.kmDay)} km/dia · ${number(r.monthlyKm)} km/mês · recarga em casa</p></div><div class="result-car-switch" role="group" aria-label="Escolha o comparativo">${Object.values(
      CARS,
    )
      .map(
        (car) =>
          `<button type="button" data-car="${car.id}" aria-pressed="${i.car === car.id}"><span class="switch-copy"><strong>${car.name}</strong><small>× ${car.gas.name}</small></span><span class="switch-glyph" aria-hidden="true">${icon(i.car === car.id ? "check-circle" : "arrow-right")}</span></button>`,
      )
      .join(
        "",
      )}</div><section class="hero ${r.status}"><div class="hero-head"><div><span class="badge">${icon(r.status === "not-fit" ? "warning-circle" : "check-circle")}${s.badge}</span><h2>${s.title}</h2></div>${r.status === "not-fit" ? `<span class="status-warning">${icon("warning-circle")}</span>` : `<img class="art3d battery-art" src="${artwork.battery3d}" alt="" aria-hidden="true">`}</div><p>${s.detail}</p><div class="ticks" aria-hidden="true">${Array.from({ length: 10 }, (_, j) => `<span class="${j < filled ? "filled" : ""}"></span>`).join("")}</div><div class="meter-label"><span>Seu dia · ${number(i.kmDay)} km</span><strong>Entre recargas · ${number(r.usableRange)} km</strong></div></section><section class="card comparison-card"><div class="comparison-title"><div><span class="eyebrow">Mesmo prazo e franquia</span><h2>Assinatura + uso</h2></div><img class="art3d money-art" src="${artwork.money3d}" alt="" aria-hidden="true"></div><p class="plan-context">${state.plan.months} meses · ${number(state.plan.kmAllowance)} km/mês</p><div class="cost-comparison">${costSide(false)}${costSide(true)}</div>${p.ready ? `<div class="saving ${cheaper ? "" : "negative"}"><span class="saving-caption">${icon("wallet")}<span>${p.exceedsKm ? "Diferença parcial" : Math.abs(p.savings) < 0.005 ? "Mesmo custo estimado" : cheaper ? "Economia estimada" : "Custo adicional estimado"}<small>assinatura + uso do elétrico</small></span></span><span><strong data-savings>${brl(Math.abs(p.savings), 2)}</strong><small>/mês</small></span></div>` : `<div class="warning">Informe as mensalidades do ${c.name} e do ${c.gas.name}.</div>`}${decisionCard(r)}<button class="subtle-link" data-action="assumptions">Ajustar preços e assinatura</button><p class="hint example-notice">${planNote()}</p><div class="comparison-source" data-fuel-note>${fuelNote()}</div></section>${comparisonCard(c, c.gas, r, p)}${group("charging", "Autonomia e recarga", `${number(r.usableRange)} km estimados entre recargas`, "battery-charging", autonomy)}${group("method", "Como calculamos", "Assinatura, consumo e tarifas", "gauge", method)}<p class="note">${icon("info")}<span>Estimativa de assinatura + uso. Não garante autonomia nem inclui instalação, taxas ou km excedentes.</span></p>`;
  }
  function openModal(title, body) {
    $("modalTitle").textContent = title;
    $("modalContent").innerHTML = body;
    $("modal").showModal();
  }
  function assumptions() {
    const price = state.plan.prices[state.input.car],
      c = CARS[state.input.car];
    openModal(
      "Preços e assinatura",
      `<form id="assumptionForm"><p>Use o mesmo prazo e a mesma franquia para os dois carros. Troque o exemplo pelas mensalidades da sua cotação.</p><div class="field-grid"><div class="field"><label for="plan-months">Prazo</label><select id="plan-months" name="months">${config.subscription.months.map((n) => `<option value="${n}" ${n === state.plan.months ? "selected" : ""}>${n} meses</option>`).join("")}</select></div><div class="field"><label for="plan-km">Franquia mensal</label><select id="plan-km" name="kmAllowance">${config.subscription.kmAllowances.map((n) => `<option value="${n}" ${n === state.plan.kmAllowance ? "selected" : ""}>${number(n)} km</option>`).join("")}</select></div><div class="field full"><label for="plan-gas">Assinatura do ${c.gas.name} (R$/mês)</label><input type="number" id="plan-gas" name="gasPrice" min="0.01" max="100000" step="0.01" value="${price.gasPrice ?? ""}" placeholder="Cotação necessária"></div><div class="field full"><label for="plan-electric">Assinatura do ${c.name} (R$/mês)</label><input type="number" id="plan-electric" name="electricPrice" min="0.01" max="100000" step="0.01" value="${price.electricPrice ?? ""}" placeholder="Cotação necessária"></div></div><p class="modal-note" id="plan-price-note">${planNote()}</p><button type="button" class="subtle-link" data-action="example-prices">Usar valores fictícios para demonstrar</button><div class="field full"><label class="label-icon" for="pref-state">${icon("map-pin")} Estado do preço da gasolina</label><div class="state-controls"><select id="pref-state" name="uf">${stateOptions(state.input.uf)}</select><button type="button" class="icon-button" data-action="refresh" aria-label="Atualizar preços" ${state.fuel.loading ? "disabled" : ""}>${icon("arrows-clockwise")}</button></div></div><div class="modal-fuel-note" data-fuel-note>${fuelNote()}</div><p class="hint">Média divulgada pela API, não o preço de um posto.</p><div class="field-grid"><div class="field full"><label class="label-icon" for="a-homeTariff">${icon("house-line")} Energia em casa (R$/kWh)</label><input type="number" id="a-homeTariff" name="homeTariff" min="0.01" max="20" step="0.01" value="${state.a.homeTariff}" required><p class="hint">Use a tarifa da sua conta de luz. O valor inicial é um exemplo.</p></div><div class="field full"><label class="label-icon" for="a-daysMonth">${icon("calendar-dots")} Dias de uso por mês</label><input type="number" id="a-daysMonth" name="daysMonth" min="1" max="31" step="1" value="${state.input.daysMonth}" required></div></div><div id="plan-error" class="error" role="alert" hidden></div><button type="submit" class="primary">Aplicar ajustes ${icon("check-circle")}</button></form>`,
    );
    $("assumptionForm").dataset.priceSource = price.source;
  }
  function updateFuelViews() {
    document.querySelectorAll("[data-fuel-note]").forEach((el) => {
      const uf =
        el.closest("#modalContent") && $("pref-state")
          ? $("pref-state").value
          : state.input.uf;
      el.innerHTML = fuelNote(uf);
    });
    const button = document.querySelector('[data-action="refresh"]');
    if (button) button.disabled = state.fuel.loading;
    const select = $("pref-state");
    if (select) {
      const selected = select.value;
      select.innerHTML = stateOptions(selected);
    }
  }
  async function refreshFuel() {
    if (state.fuel.loading) return;
    state.fuel.loading = true;
    state.fuel.lastError = null;
    updateFuelViews();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(API, {
        signal: controller.signal,
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const payload = await response.json(),
        data = normalizeFuel(payload);
      if (data.collectedAt >= state.fuel.data.collectedAt) {
        state.fuel.data = data;
        try {
          localStorage.setItem("localiza-fuel-v2", JSON.stringify(payload));
        } catch {}
      }
      state.fuel.status = "live";
    } catch (error) {
      state.fuel.status = "unavailable";
      state.fuel.lastError = String(error.message || error);
    } finally {
      clearTimeout(timer);
      state.fuel.loading = false;
      if (state.result) {
        if (Number.isFinite(state.fuel.data.prices[state.input.uf]))
          state.result = compute();
        else {
          state.result = null;
          state.screen = "routine";
          toast("A API não trouxe preço para este estado. Escolha outro.");
        }
        const opened = [...document.querySelectorAll("details[open]")].map(
          (el) => el.id,
        );
        render();
        opened.forEach((id) => {
          if ($(id)) $(id).open = true;
        });
      }
      updateFuelViews();
      const primary = document.querySelector('[data-action="simulate"]');
      if (primary)
        primary.disabled = !Number.isFinite(
          state.fuel.data.prices[state.input.uf],
        );
    }
    return state.fuel;
  }
  function next() {
    openModal(
      "Antes de assinar",
      `<div class="section-label"><span>O que confirmar</span><span id="checkCount"></span></div><div class="progress" id="checkProgress"></div><ul class="checklist">${[
        [
          "Onde recarregar",
          "Confirme o acesso ou a instalação do carregador em casa.",
          "charging-station",
        ],
        [
          "Condições do plano",
          "Confira a mensalidade e a franquia de km.",
          "car-profile",
        ],
        [
          "Primeiros usos",
          "Peça orientação sobre recarga e suporte.",
          "lightning",
        ],
      ]
        .map(
          ([title, detail, glyph], j) =>
            `<li><label><input type="checkbox" data-check="${j}" ${state.checks[j] ? "checked" : ""}><span class="list-icon">${icon(glyph)}</span><span><strong>${title}</strong><small>${detail}</small></span></label></li>`,
        )
        .join(
          "",
        )}</ul><button class="primary" data-action="summary">Ver resumo ${icon("arrow-right")}</button>`,
    );
    updateChecks();
  }
  function updateChecks() {
    if (!$("checkCount")) return;
    $("checkCount").textContent = state.checks.filter(Boolean).length + " de 3";
    $("checkProgress").innerHTML = state.checks
      .map((v) => `<span class="${v ? "done" : ""}"></span>`)
      .join("");
  }
  function summary() {
    const r = state.result,
      c = CARS[state.input.car],
      i = state.input,
      p = r.subscription,
      price = state.plan.prices[i.car],
      money = (n) => (n == null ? "Cotação necessária" : brl(n, 2));
    const value = `SIMULAÇÃO DE ASSINATURA + USO\n${c.full} × ${c.gas.full}\nRotina: ${i.kmDay} km/dia, ${i.daysMonth} dias/mês\nRecarga: em casa\nPlano: ${state.plan.months} meses, ${state.plan.kmAllowance} km/mês\nAssinatura do elétrico: ${money(price.electricPrice)}\nEnergia: ${money(r.electricCost)}/mês\nAssinatura a gasolina: ${money(price.gasPrice)}\nGasolina: ${money(r.fuelCost)}/mês\n${p.exceedsKm ? "Subtotal" : "Total"} do elétrico: ${money(p.electricTotal)}/mês\n${p.exceedsKm ? "Subtotal" : "Total"} a gasolina: ${money(p.gasTotal)}/mês\n${p.ready ? "Diferença mensal: " + money(p.savings) : "Comparação pendente de cotação"}\n${monthlyDecision(r)}\n${planNote()}\nGasolina em ${i.uf.toUpperCase()}: ${brl(gasoline(), 2)}/L, coleta ${collectionDate()}\nEstimativa. Não inclui instalação, taxas extras ou km excedentes. Autonomia não garantida.`;
    $("modalTitle").textContent = "Seu resumo";
    $("modalContent").innerHTML =
      `<textarea id="copyText" readonly aria-label="Resumo da simulação"></textarea><button class="primary" data-action="copy">Copiar resumo ${icon("copy")}</button>`;
    $("copyText").value = value;
  }
  function about() {
    openModal(
      "Sobre a simulação",
      `<p>Compare assinatura + uso de um elétrico e de um carro a gasolina. O comparativo considera recarga em casa.</p><p>As mensalidades iniciais são fictícias, só para demonstração. Não são preços médios de mercado nem ofertas da Localiza. Informe sua cotação com o mesmo prazo e franquia.</p><p>A gasolina vem da Combustível API, com a data de coleta. Se a consulta falhar, usamos o último dado salvo.</p><p>A estimativa não inclui instalação, estacionamento, km excedentes ou outras taxas. Uma distância longa pode exigir recarga no percurso, fora deste cenário.</p><div class="sources"><a href="https://combustivelapi.com.br/" target="_blank" rel="noopener">Combustível API</a><br><a href="https://www.gov.br/inmetro/pt-br/assuntos/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/veiculos-automotivos-pbe-veicular" target="_blank" rel="noopener">Inmetro · PBE Veicular 2026</a><br><a href="https://phosphoricons.com/" target="_blank" rel="noopener">Ícones: Phosphor Duotone</a> · <a href="https://old.3dicons.co/" target="_blank" rel="noopener">3dicons</a><br><small>Ilustrações BYD. Protótipo não oficial.</small></div>`,
    );
  }
  function toast(text) {
    $("toast").textContent = text;
    $("toast").hidden = false;
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => ($("toast").hidden = true), 2800);
  }
  function run() {
    syncForm();
    try {
      state.result = compute();
      state.screen = "result";
      render();
      document.querySelector(".app").scrollTo(0, 0);
    } catch (error) {
      $("formError").hidden = false;
      $("formError").textContent = error.message;
    }
  }
  function edit() {
    state.screen = "routine";
    render();
    document.querySelector(".app").scrollTo(0, 0);
  }
  document.addEventListener("input", (event) => {
    if (event.target.id === "kmNumber") {
      const val = Number(event.target.value);
      if (val >= 10 && val <= 240) {
        $("kmDay").value = val;
      }
    }
    if (event.target.id === "kmDay") {
      $("kmNumber").value = event.target.value;
    }
    if (event.target.closest("#routineForm")) {
      syncForm();
      state.result = null;
      $("stepResult").disabled = true;
      if (event.target.id === "kmDay" && $("kmNumber")) {
        $("kmNumber").value = state.input.kmDay;
      }
      $("monthPreview").innerHTML =
        number(state.input.kmDay * state.input.daysMonth) +
        " <small>km/mês</small>";
      $("chargingHint").textContent = chargingHint();
    }
  });
  document.addEventListener("change", (event) => {
    if (event.target.id === "kmNumber") {
      let val = Math.round(Number(event.target.value) || 40);
      if (val < 10) val = 10;
      if (val > 240) val = 240;
      event.target.value = val;
      $("kmDay").value = val;
      $("kmDay").dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (event.target.matches("[data-check]")) {
      state.checks[Number(event.target.dataset.check)] = event.target.checked;
      updateChecks();
    }
    if (event.target.id === "pref-state") updateFuelViews();
    if (event.target.id === "plan-months" || event.target.id === "plan-km")
      clearPlanQuotes();
    if (event.target.id === "plan-gas" || event.target.id === "plan-electric") {
      $("assumptionForm").dataset.priceSource = "manual";
      $("plan-price-note").textContent =
        "Valores informados por você. Confirme a cotação para este prazo e esta franquia.";
    }
  });
  document.addEventListener("submit", (event) => {
    if (event.target.id === "routineForm") {
      event.preventDefault();
      run();
    }
    if (event.target.id === "assumptionForm") {
      event.preventDefault();
      applyAssumptions(event.target);
    }
  });
  document.addEventListener("click", async (event) => {
    const stepBtn = event.target.closest(".step-btn");
    if (stepBtn) {
      const input = $("daysMonth");
      if (input) {
        const delta = Number(stepBtn.dataset.step);
        const val = Math.min(31, Math.max(1, Number(input.value || 30) + delta));
        input.value = val;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return;
    }
    const car = event.target.closest("[data-car]");
    if (car) {
      syncForm();
      state.input.car = car.dataset.car;
      state.result = state.screen === "result" ? compute() : null;
      render();
      return;
    }
    const preset = event.target.closest("[data-scenario]");
    if (preset) {
      const key = preset.dataset.scenario;
      state.selectedScenario = key;
      state.input = {
        ...state.input,
        kmDay: key === "limit" ? 80 : 40,
        daysMonth: key === "limit" ? 22 : 30,
        charging: "yes",
      };
      try {
        state.result = compute();
        state.screen = "result";
        render();
        document.querySelector(".app").scrollTo(0, 0);
      } catch (error) {
        toast(error.message);
      }
      return;
    }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "simulate") run();
    if (action === "edit") edit();
    if (action === "result" && state.result) {
      state.screen = "result";
      render();
      document.querySelector(".app").scrollTo(0, 0);
    }
    if (action === "assumptions") {
      syncForm();
      assumptions();
    }
    if (action === "example-prices") {
      const price = examplePrices()[state.input.car];
      $("plan-gas").value = price.gasPrice;
      $("plan-electric").value = price.electricPrice;
      $("assumptionForm").dataset.priceSource = "example";
      $("plan-price-note").textContent =
        "Valores fictícios para demonstração. Não são preços de mercado nem ofertas da Localiza.";
    }
    if (action === "about") about();
    if (action === "close") $("modal").close();
    if (action === "next") next();
    if (action === "summary") summary();
    if (action === "refresh") await refreshFuel();
    if (action === "copy") {
      const text = $("copyText");
      try {
        if (navigator.clipboard && window.isSecureContext)
          await navigator.clipboard.writeText(text.value);
        else {
          text.focus();
          text.select();
          if (!document.execCommand("copy")) throw new Error("copy");
        }
        toast("Resumo copiado.");
      } catch {
        text.focus();
        text.select();
        toast("Selecione o texto e copie.");
      }
    }
  });
  $("modal").addEventListener("click", (event) => {
    if (event.target === $("modal")) {
      const rect = $("modal").getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        $("modal").close();
    }
  });
  window.LocalizaDemo = {
    state,
    CARS,
    compute,
    render,
    run,
    edit,
    refreshFuel,
    gasoline,
    monthlyDecision,
    planNote,
  };
  render();
  refreshFuel();
}

loadSimulatorConfig()
  .then(initializeSimulator)
  .catch((error) => {
    console.error("Falha ao iniciar o simulador:", error);
    const message = document.createElement("section");
    message.className = "error";
    message.setAttribute("role", "alert");
    const heading = document.createElement("h2");
    heading.textContent = "Não foi possível abrir o simulador";
    const explanation = document.createElement("p");
    explanation.textContent =
      location.protocol === "file:"
        ? "Abra a pasta com um servidor estático local para carregar o JSON. Veja o comando no README."
        : "Confira data/simulator.json e recarregue a página.";
    message.append(heading, explanation);
    $("screen").replaceChildren(message);
    $("dock").replaceChildren();
  });
