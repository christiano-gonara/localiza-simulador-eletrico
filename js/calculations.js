"use strict";

// Funções puras: não acessam a tela, a API ou o banco de dados.
function simulate(input, car, a) {
  const positive = [
    input.kmDay,
    input.daysMonth,
    car.range,
    car.battery,
    car.gas?.urban,
    a.homeTariff,
    a.publicTariff,
    a.gasPrice,
    a.rangeFactor,
    a.window,
    a.efficiency,
    a.safety,
  ];
  if (
    positive.some((n) => !Number.isFinite(n) || n <= 0) ||
    input.daysMonth > 31 ||
    input.kmDay > 1000 ||
    !["yes", "no"].includes(input.charging) ||
    a.rangeFactor > 1 ||
    a.window > 1 ||
    a.efficiency > 1 ||
    a.safety < 1
  )
    throw new Error("Confira os valores da simulação.");
  const monthlyKm = input.kmDay * input.daysMonth;
  const effectiveRange = car.range * a.rangeFactor;
  const usableRange = effectiveRange * a.window;
  const consumption = car.battery / effectiveRange;
  const tariff = input.charging === "yes" ? a.homeTariff : a.publicTariff;
  const electricCost = ((monthlyKm * consumption) / a.efficiency) * tariff;
  const fuelCost = (monthlyKm / car.gas.urban) * a.gasPrice;
  const status =
    input.kmDay * a.safety > usableRange
      ? "not-fit"
      : input.charging === "no"
        ? "adjust"
        : "fits";
  return {
    status,
    monthlyKm,
    effectiveRange,
    usableRange,
    consumption,
    tariff,
    electricCost,
    fuelCost,
    savings: fuelCost - electricCost,
    electricPerKm: electricCost / monthlyKm,
    fuelPerKm: fuelCost / monthlyKm,
  };
}
function normalizeFuel(payload) {
  if (
    !payload ||
    payload.error !== false ||
    !payload.precos ||
    !payload.precos.gasolina ||
    typeof payload.data_coleta !== "string" ||
    !/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?$/.test(payload.data_coleta)
  )
    throw new Error("Resposta de preços inválida");
  const validStates = new Set(
    "ac al am ap ba ce df es go ma mg ms mt pa pb pe pi pr rj rn ro rr rs sc se sp to".split(
      " ",
    ),
  );
  const prices = {};
  for (const [uf, raw] of Object.entries(payload.precos.gasolina)) {
    if (!validStates.has(uf)) continue;
    const price =
      typeof raw === "number"
        ? raw
        : Number(String(raw).trim().replace(",", "."));
    if (Number.isFinite(price) && price > 0 && price < 50) prices[uf] = price;
  }
  if (!Object.keys(prices).length) throw new Error("Sem preços por estado");
  return {
    prices,
    collectedAt: payload.data_coleta,
    source: payload.fonte || "https://combustivelapi.com.br/",
  };
}
function compareSubscription(costs, plan) {
  if (
    ![12, 24, 36, 48].includes(plan.months) ||
    ![1000, 1500, 2000, 2500, 3000].includes(plan.kmAllowance)
  )
    throw new Error("Confira o prazo e a franquia.");
  for (const amount of [plan.electricPrice, plan.gasPrice])
    if (
      amount !== null &&
      amount !== undefined &&
      (!Number.isFinite(amount) || amount <= 0 || amount > 100000)
    )
      throw new Error("Informe mensalidades válidas.");
  if (
    [costs.monthlyKm, costs.electricCost, costs.fuelCost].some(
      (value) => !Number.isFinite(value) || value < 0,
    )
  )
    throw new Error("Confira os gastos da simulação.");
  const electricTotal =
    plan.electricPrice == null ? null : plan.electricPrice + costs.electricCost;
  const gasTotal =
    plan.gasPrice == null ? null : plan.gasPrice + costs.fuelCost;
  const ready = electricTotal !== null && gasTotal !== null;
  return {
    ready,
    electricTotal,
    gasTotal,
    savings: ready ? gasTotal - electricTotal : null,
    exceedsKm: costs.monthlyKm > plan.kmAllowance,
    excessKm: Math.max(0, costs.monthlyKm - plan.kmAllowance),
  };
}
if (typeof module !== "undefined")
  module.exports = { simulate, normalizeFuel, compareSubscription };
