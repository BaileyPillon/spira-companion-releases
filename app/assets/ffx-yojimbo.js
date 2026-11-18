"use strict";

const zanmatoPayments = [1, ...Array.from({length:28}, (_, index) => 2 ** (index + 2))];
const zanmatoBosses = [119,317,334,335,336,337,338,339,340,341,344];
const yojimboPlan = {foe:"live", level:4, payment:"8192", compatibility:"", overdrive:false};

// PS2 International paid-turn model for the "most powerful of enemies" answer.
function zanmatoRolls(compatibility, level, payment, overdrive) {
  if (payment < 1) return 0;
  const resistance = level <= 3 ? 8 : 4;
  const gilMotivation = Math.max(0, Math.floor(Math.log2(payment)) - 2) * 4;
  const base = Math.floor(Math.floor(compatibility / 10) * resistance / 10) +
    Math.floor(gilMotivation * resistance / 10) + (overdrive ? 20 : 0);
  return Math.min(64, Math.max(0, base - 16));
}

function zanmatoQuote(compatibility, level, payment, overdrive, gil) {
  const rolls = amount => zanmatoRolls(compatibility, level, amount, overdrive);
  const max = Math.min(gil, 999999999);
  const affordable = zanmatoPayments.filter(amount => amount <= max);
  const best = rolls(affordable.at(-1) || 0);
  return {
    rolls:rolls(payment),
    tier:zanmatoPayments.findLast(amount => amount <= payment),
    next:zanmatoPayments.find(amount => amount > payment && amount <= max && rolls(amount) > rolls(payment)),
    half:affordable.find(amount => rolls(amount) >= 32),
    ninety:affordable.find(amount => rolls(amount) >= 58),
    best,
    bestPayment:affordable.find(amount => rolls(amount) === best)
  };
}

function zanmatoFoes(current) {
  const enemies = (current.enemies || []).filter(enemy => enemy.hp > 0);
  return [enemies.find(enemy => enemy.targeted)?.id ?? enemies[0]?.id, ...new Set(enemies.map(enemy => enemy.id))];
}

function showYojimboPlan(current) {
  const recruited = !!(current.progress.optionalAeons & 2);
  const compatibility = current.progress.yojimboCompatibility;
  const wallet = current.gil;
  const [target, ...ids] = zanmatoFoes(current);
  const filters = element("div", "filters yojimbo-filters");
  const quote = element("div", "sheet yojimbo-quote");
  const payment = element("input");
  payment.inputMode = "numeric";
  payment.maxLength = 9;
  payment.value = yojimboPlan.payment;
  const override = element("input");
  override.inputMode = "numeric";
  override.maxLength = 3;
  override.value = yojimboPlan.compatibility;
  override.placeholder = compatibility == null ? "0–255" : String(compatibility);
  const od = element("input");
  od.type = "checkbox";
  od.checked = yojimboPlan.overdrive;
  const odLabel = element("label", "mix-filter", "Full Overdrive");
  odLabel.prepend(od);
  const targetOptions = [["live", target == null ? "Current target (none)" : "Current target · " + enemyName(target)],
    ...[...new Set([...ids, ...zanmatoBosses])].map(id => [String(id),enemyName(id)]), ["manual","Choose resistance level"]];
  if (!targetOptions.some(([id]) => id === yojimboPlan.foe)) yojimboPlan.foe = "live";
  const foe = options("Fiend", targetOptions, yojimboPlan.foe, value => { yojimboPlan.foe = value; draw(); });
  const level = options("Resistance level", Array.from({length:6}, (_, index) => [index + 1, "Level " + (index + 1)]),
    yojimboPlan.level, value => { yojimboPlan.level = Number(value); draw(); });
  const controls = [[element("label", "", "Fiend"),foe], [element("label", "", "Resistance level"),level],
    [element("label", "", "Offer (gil)"),payment], [element("label", "", "Compatibility override"),override]];
  for (const [label, input] of controls) {
    label.append(input);
    filters.append(label);
  }
  filters.append(odLabel);
  panel.append(element("p", "field-note", recruited ? "Yojimbo recruited" : "Yojimbo recruitment preview"),
    element("p", "field-note", `Wallet ${number.format(wallet)} gil · Save compatibility ${compatibility == null ? "unavailable" : compatibility + "/255"}`),
    filters, quote,
    element("p", "field-note", "Uses the PS2 International model for “To defeat the most powerful of enemies.” Estimates apply when Yojimbo asks for payment."));

  function draw() {
    const id = yojimboPlan.foe === "live" ? target : Number(yojimboPlan.foe);
    // Penance and its arms use the high-resistance bracket documented in the HD table.
    const detected = id >= 344 && id <= 346 ? 5 : zanmatoLevels[id];
    controls[1][0].hidden = detected != null;
    const resistance = detected == null ? yojimboPlan.level : detected + 1;
    const friendship = override.value === "" ? compatibility : /^\d+$/.test(override.value) ? Number(override.value) : NaN;
    const amount = /^\d+$/.test(payment.value) ? Number(payment.value) : 0;
    if (!Number.isInteger(friendship) || friendship < 0 || friendship > 255 || amount < 1) {
      quote.replaceChildren(entry("Zanmato estimate", "Enter an offer of at least 1 gil and compatibility from 0 to 255."));
      return;
    }

    const result = zanmatoQuote(friendship, resistance, amount, od.checked, wallet);
    const odds = percent => new Intl.NumberFormat(undefined, {style:"percent", maximumFractionDigits:1}).format(percent / 64);
    const gilLabel = value => number.format(value) + " gil";
    const bracket = resistance <= 3 ? "Resistance levels 1–3" : "Resistance levels 4–6";
    const resultRow = entry(`${odds(result.rolls)} chance of Zanmato`, `${bracket} · ${result.rolls} of 64 rolls`);
    if (amount > wallet) resultRow.append(element("p", "field-note", "This offer exceeds your current wallet."));
    if (result.tier < amount) resultRow.append(element("p", "detail", `${gilLabel(result.tier)} gives the same odds.`));
    const pay = value => { payment.value = String(value); yojimboPlan.payment = payment.value; draw(); };
    const steps = element("div", "filters");
    for (const [label, value] of [["Next increase",result.next],["At least 50%",result.half],["At least 90%",result.ninety]]) {
      if (value != null) steps.append(action(`${label} · ${gilLabel(value)}`, () => pay(value)));
    }
    if (result.bestPayment != null && result.best > 0) resultRow.append(element("p", "field-note",
      `Best within budget is ${odds(result.best)} at ${gilLabel(result.bestPayment)}.`));
    if (steps.childElementCount) resultRow.append(steps);
    quote.replaceChildren(resultRow);
  }

  payment.addEventListener("input", () => { yojimboPlan.payment = payment.value; draw(); });
  override.addEventListener("input", () => { yojimboPlan.compatibility = override.value; draw(); });
  od.addEventListener("change", () => { yojimboPlan.overdrive = od.checked; draw(); });
  draw();
}
