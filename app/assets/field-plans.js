"use strict";

// Secondary tools share the existing Workspace navigation and profile storage.
const fieldPlans = [
  ["accuracy", "Boss hit planner", "prep", "x", "Check your party’s normal Attack against a Dark Aeon or Penance and see how much Luck or Aim closes the gap."],
  ["mascot", "Mascot episode board", "chapter-checklist", "x2", "Track the Chapter 5 result at each destination and compare it with scenes in your save."],
  ["celestial", "Celestial weapon power", "equip", "x", "See how each character’s current HP or MP changes physical weapon damage."],
  ["ciphers", "Besaid cipher notebook", "challenges", "x2", "Find and record the four digits for each of Besaid’s two cave doors."],
  [
    "circuit",
    "Capture circuit",
    "arena",
    "x",
    "Choose the next three hunting spots from the captures your save still needs."
  ],
  [
    "errands",
    "Chapter itinerary",
    "chapter-checklist",
    "x2",
    "Group unfinished scene checks by destination and story branch."
  ],
  [
    "workshop",
    "Customization shopping list",
    "equip",
    "x",
    "Budget materials across several abilities and pieces of gear."
  ],
  [
    "bribes",
    "Bribe shopping comparison",
    "bestiary",
    "x",
    "Compare fiends and gil budgets for the number of items you need."
  ],
  [
    "reserves",
    "Mix ingredient reserves",
    "mix",
    "x",
    "Find recipes you can make while keeping chosen ingredients for later."
  ],
  [
    "bookmark",
    "Compare chapter saves",
    "chapter-checklist",
    "x2",
    "Bookmark one save and see exactly which mapped scene flags differ."
  ],
  [
    "bullets",
    "Gun Mage party board",
    "field-guide",
    "x2",
    "See who still needs each Blue Bullet and which fiends can teach it."
  ],
  [
    "sweep",
    "Via Infinito floor sweep",
    "field-guide",
    "x2",
    "Plan a stretch of floors around the Oversouls still missing."
  ],
  [
    "lessons",
    "Next AP abilities",
    "equip",
    "x2",
    "Rank partially learned abilities across owned dresspheres by AP remaining."
  ],
  [
    "ledger",
    "Farming ledger",
    "supplies",
    null,
    "Compare your inventory and gil with the start of a farming session."
  ]
].map(([id, name, parent, game, detail]) => ({ id, tab: "plan-" + id, name, parent, game, detail }));
const fieldChoices = {};
let fieldPlanOrigin = "workspace";
function fieldPlanFor(tabName) {
  return fieldPlans.find((plan) => plan.tab === tabName);
}
function fieldPlanSignature(id, current) {
  const base = [current.game, current.disc, current.crc, !!current.grid, reconnecting, !!current.paused];
  if (id === "accuracy") return [...base, current.party?.map(m => [m.id, m.attributes]), current.enemies?.map(e => [e.id, e.hp > 0])];
  if (id === "celestial") return [...base, current.battle, current.party?.map(m => [m.id, m.active, m.hp, m.maxHp, m.mp, m.maxMp, m.gear?.filter(g => g.celestial)])];
  if (id === "mascot") return [...base, current.chapter, current.storyFlags, current.loadout?.dresspheres, current.calmLands?.argent, current.calmLands?.openAir];
  if (id === "ciphers") return [...base, current.chapter, current.room, current.loadout?.grids?.includes(25)];
  const values = {
    circuit: [current.arena, current.room],
    errands: [current.chapter, current.storyFlags],
    workshop: [current.items],
    bribes: [current.items, current.gil],
    reserves: [current.items],
    bookmark: [current.chapter, current.storyFlags],
    bullets: [current.blueBullets, !!current.oversoul],
    sweep: [current.oversoul],
    lessons: [current.dressphereAp, current.loadout?.dresspheres, current.loadout?.dressphereInfo],
    ledger: [current.items, current.gil]
  };
  return [...base, ...(values[id] || [])];
}
function fieldPlanLinks(current) {
  if (!current || tab === "workspace") return;
  const tools = fieldPlans.filter((p) => p.parent === tab && (!p.game || p.game === current.game));
  if (!tools.length) return;
  const actions = element("div", "tracker-actions plan-links");
  for (const p of tools) actions.append(action(p.name, () => choose(p.tab)));
  const header = panel.querySelector("h1");
  if (header)
    (header.nextElementSibling?.classList.contains("sub") ? header.nextElementSibling : header).after(
      actions
    );
}
function planSelect(parent, label, values, value, onChange) {
  const field = element("label", "plan-field", label);
  const select = options(label, values, String(value), onChange);
  field.append(select);
  parent.append(field);
  return select;
}
function planNumber(parent, label, value, min, max) {
  const field = element("label", "plan-field", label),
    input = element("input");
  input.type = "number";
  input.inputMode = "numeric";
  input.min = min;
  input.max = max;
  input.step = 1;
  input.required = true;
  input.value = value;
  input.setAttribute("aria-label", label);
  field.append(input);
  parent.append(field);
  return input;
}
function validPlanNumber(input) {
  if (!input.reportValidity()) return null;
  return input.valueAsNumber;
}
function planRefresh() {
  signature = "";
  render();
}
function planKey(name) {
  return "spira.fieldplans." + name + ".v1";
}
function planSave(name, data, message) {
  if (saveCompanionSetting(planKey(name), data)) {
    planRefresh();
    return true;
  }
  message.textContent = "Could not save this change. Check available storage and try again.";
  return false;
}
function fieldContext(current) {
  return (
    current.game +
    "." +
    String(current.disc || current.build || current.edition || "unknown") +
    "." +
    String(current.crc || "")
  );
}
function fieldItemNames(current) {
  if (current.game === "x" && current.grid) return ffxData.items;
  return Object.fromEntries(catalog[current.game].recovery.map((name, index) => [0x2000 + index, name]));
}
function ledgerSnapshot(current) {
  return {
    time: current.timestamp,
    room: roomName(current),
    gil: current.gil ?? null,
    items: Array.from(itemAmounts(current.items))
  };
}
function inventoryChanges(start, current) {
  const before = new Map(start.items),
    now = itemAmounts(current.items);
  return Array.from(new Set([...before.keys(), ...now.keys()]), (id) => ({
    id,
    before: before.get(id) || 0,
    now: now.get(id) || 0,
    delta: (now.get(id) || 0) - (before.get(id) || 0)
  }))
    .filter((row) => row.delta)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.id - b.id);
}
function canRecordPlan(current) {
  return (
    !!frame &&
    !sample &&
    !reconnecting &&
    state === "live" &&
    frame.status === "live" &&
    fieldContext(current) === fieldContext(frame) &&
    Date.now() - frame.timestamp < 4000
  );
}
function signedAmount(value) {
  return value > 0 ? "+" + number.format(value) : number.format(value);
}
function planCount(count, word) {
  return count + " " + word + (count === 1 ? "" : "s");
}
function drawLedger(current, view) {
  const key = "ledger." + fieldContext(current),
    start = readCompanionSetting(planKey(key), null);
  const record = action("Start comparison here", () => {
    if (canRecordPlan(current)) planSave(key, ledgerSnapshot(frame), view.message);
    else view.message.textContent = "Wait for a fresh live frame.";
  });
  record.disabled = !canRecordPlan(current);
  if (
    !start ||
    !Array.isArray(start.items) ||
    !start.items.every((row) => Array.isArray(row) && row.length === 2 && row.every(Number.isFinite))
  ) {
    view.controls.append(record);
    view.list.append(
      entry(
        "Choose a starting point",
        "",
        "After a fight, purchase or reload, this ledger shows the net change from that point."
      )
    );
    return;
  }
  const clear = action("Finish comparison", () => planSave(key, null, view.message));
  view.controls.append(clear);
  view.list.append(
    entry(
      "Since " + String(start.room || "your checkpoint"),
      new Date(start.time).toLocaleString(),
      Number.isFinite(start.gil) && Number.isFinite(current.gil)
        ? signedAmount(current.gil - start.gil) + " gil"
        : "Gil unavailable"
    )
  );
  const names = fieldItemNames(current),
    changes = inventoryChanges(start, current);
  for (const row of changes)
    view.list.append(
      entry(names[row.id] || "Item " + row.id, signedAmount(row.delta), row.before + " → " + row.now)
    );
  if (!changes.length) view.list.append(entry("Inventory unchanged"));
}
function showFieldPlan(current, plan) {
  heading(plan.name, plan.detail);
  const source = [...nav].find((button) => button.dataset.tab === fieldPlanOrigin);
  panel.append(action("Back to " + (source?.textContent || "Workspace"), () => choose(fieldPlanOrigin)));
  if (!current || (plan.game && current.game !== plan.game)) {
    panel.append(
      entry(
        "Load a supported " +
          (plan.game === "x2" ? "FFX-2" : plan.game === "x" ? "FFX" : "FFX or FFX-2") +
          " save"
      )
    );
    return;
  }
  const controls = element("div", "filters notebook-controls"),
    message = element("p", "field-note"),
    list = element("div", "sheet notebook-results");
  message.setAttribute("role", "status");
  panel.append(controls, message, list);
  const view = { controls, message, list };
  if (plan.id === "ledger") drawLedger(current, view);
  else if (current.game === "x") drawXFieldPlan(current, plan.id, view);
  else drawX2FieldPlan(current, plan.id, view);
}
