"use strict";

function captureCircuit(current, target) {
  const remaining = huntRemaining(current, target);
  const missing = new Set([...remaining].filter(([, count]) => count > 0).map(([name]) => name));
  const stops = [];
  while (missing.size && stops.length < 3) {
    const needed = new Map([...missing].map((name) => [name, remaining.get(name)]));
    const choices = ffxHuntSpots
      .filter((spot) => spot[0] !== "omega_ruins_upper" || arenaDefeated(current, "Omega Weapon"))
      .map((spot) => huntSpotReport(spot, needed))
      .filter((report) => report.sightings.size)
      .sort(
        (a, b) =>
          b.sightings.size - a.sightings.size ||
          b.targets / b.slots - a.targets / a.slots ||
          Number(b.spot[2].includes(current.room)) - Number(a.spot[2].includes(current.room))
      );
    if (!choices.length) break;
    const stop = choices[0];
    stops.push(stop);
    for (const name of stop.sightings.keys()) missing.delete(name);
  }
  return { stops, remaining: missing };
}
function workshopBill(lines, inventory) {
  const costs = new Map();
  for (const row of lines) {
    const [ability, copies] = row;
    const recipe = ffxCustomization.flat().find(([id]) => id === ability);
    if (!recipe || !Number.isInteger(copies) || copies < 1 || copies > 99) continue;
    const [, material, cost] = recipe;
    costs.set(material, (costs.get(material) || 0) + copies * cost);
  }
  return [...costs]
    .map(([id, required]) => ({
      id,
      required,
      owned: inventory.get(id) || 0,
      short: Math.max(0, required - (inventory.get(id) || 0))
    }))
    .sort((a, b) => b.short - a.short || a.id - b.id);
}
function bribeShopping(sources, needed, gil) {
  return sources
    .filter((row) => row.method === "Bribe" && row.count > 0 && row.gil > 0)
    .map((row) => {
      const foe = ffxData.enemies[row.id],
        range = bribeEstimate(row.gil, foe.hp, row.count);
      const best = Math.ceil(needed / Math.max(1, range.max)) * row.gil;
      const worst = Math.ceil(needed / Math.max(1, range.min)) * row.gil;
      return { ...row, best, worst, range, affordable: Number.isFinite(gil) ? gil >= worst : null };
    })
    .sort((a, b) => a.worst - b.worst || a.best - b.best || a.id - b.id);
}
function fieldItemChoices(items) {
  return Object.entries(items).sort((a, b) => a[1].localeCompare(b[1]));
}
function drawCircuit(current, view) {
  if (!hasCaptureData(current)) {
    view.list.append(entry("Waiting for Arena capture data"));
    return;
  }
  const target = fieldChoices.captureTarget || 10;
  planSelect(
    view.controls,
    "Captures per species",
    [
      [1, "1 each"],
      [5, "5 each"],
      [10, "10 each"]
    ],
    target,
    (value) => {
      fieldChoices.captureTarget = Number(value);
      planRefresh();
    }
  );
  const route = captureCircuit(current, target);
  for (const [i, stop] of route.stops.entries()) {
    const row = entry(
      i + 1 + ". " + stop.spot[3],
      stop.fights + " of " + stop.slots + " formation slots contain a target",
      [...stop.sightings.keys()]
        .map((n) => n + " (" + arenaCaptureCount(current, n) + "/" + target + ")")
        .join(" · ")
    );
    row.append(
      action("Inspect hunting area", () => {
        arenaTarget = target;
        openArenaHunt({ scope: huntRegions[stop.spot[1]], spot: stop.spot[0] });
      })
    );
    view.list.append(row);
  }
  if (route.remaining.size)
    view.list.append(
      entry("Outside these stops", route.remaining.size + " species", [...route.remaining].join(" · "))
    );
  if (!route.stops.length && !route.remaining.size)
    view.list.append(entry("Capture goal reached", "Every species meets the selected target."));
}
function readPlanPairs(key) {
  const rows = readCompanionSetting(planKey(key), []);
  return Array.isArray(rows)
    ? rows.filter(
        (pair) =>
          Array.isArray(pair) &&
          pair.length === 2 &&
          pair.every(Number.isInteger) &&
          pair[1] > 0 &&
          pair[1] <= 99
      )
    : [];
}
function drawWorkshop(current, view) {
  const key = "workshop",
    lines = readPlanPairs(key);
  const recipes = ffxCustomization
    .flat()
    .map(([id]) => [id, ffxData.abilities[id]])
    .sort((a, b) => a[1].localeCompare(b[1]));
  const selected = planSelect(
    view.controls,
    "Auto-ability",
    recipes,
    fieldChoices.ability || recipes[0][0],
    (v) => {
      fieldChoices.ability = Number(v);
    }
  );
  const qty = planNumber(view.controls, "Equipment pieces", fieldChoices.copies || 1, 1, 99);
  qty.addEventListener("input", () => {
    fieldChoices.copies = qty.value;
  });
  view.controls.append(
    action("Set quantity", () => {
      const count = validPlanNumber(qty);
      if (count == null) return;
      const id = Number(selected.value);
      planSave(key, [...lines.filter(([ability]) => ability !== id), [id, count]], view.message);
    })
  );
  for (const [id, copies] of lines) {
    if (!ffxData.abilities[id]) continue;
    const line = entry(ffxData.abilities[id], copies + " equipment " + (copies === 1 ? "piece" : "pieces"));
    line.append(
      action("Remove " + ffxData.abilities[id], () =>
        planSave(
          key,
          lines.filter(([ability]) => ability !== id),
          view.message
        )
      )
    );
    view.list.append(line);
  }
  if (!lines.length) {
    view.list.append(entry("Choose the first auto-ability for your gear"));
    return;
  }
  view.list.append(element("h2", "", "Materials for all pieces"));
  for (const row of workshopBill(lines, itemAmounts(current.items))) {
    const name = ffxData.items[row.id],
      line = entry(
        name,
        row.short ? row.short + " short" : "Enough in inventory",
        row.owned + " owned · " + row.required + " required"
      );
    line.append(action("Find " + name, () => openItemSources(name)));
    if (row.required > 99) line.append(element("p", "field-note", "Craft in batches. The bag holds 99 of this item at a time."));
    fieldBribeSources ??= itemSourceIndex();
    if (row.short && row.owned < 99 && fieldBribeSources.get(name)?.some(source => source.method === "Bribe")) {
      line.append(action("Price the next batch", () => {
        fieldChoices.bribeItem = name;
        fieldChoices.bribeTarget = Math.min(99, row.required);
        choose("plan-bribes");
      }));
    }
    view.list.append(line);
  }
}
let fieldBribeSources;
function drawBribes(current, view) {
  fieldBribeSources ??= itemSourceIndex();
  const names = [...fieldBribeSources]
    .filter(([, rows]) => rows.some((row) => row.method === "Bribe"))
    .map(([name]) => name)
    .sort();
  const name = fieldChoices.bribeItem || (names.includes("Chocobo Wing") ? "Chocobo Wing" : names[0]);
  planSelect(
    view.controls,
    "Bribe item",
    names.map((name) => [name, name]),
    name,
    (v) => {
      fieldChoices.bribeItem = v;
      planRefresh();
    }
  );
  const target = fieldChoices.bribeTarget || 80;
  const input = planNumber(view.controls, "Target inventory", target, 1, 99);
  const results = element("div");
  const draw = () => {
    results.replaceChildren();
    if (!input.validity.valid) return;
    fieldChoices.bribeTarget = input.valueAsNumber;
    const id = Object.entries(ffxData.items).find(([, n]) => n === name)?.[0],
      owned = itemAmounts(current.items).get(Number(id)) || 0;
    const needed = Math.max(0, input.valueAsNumber - owned);
    results.append(
      entry(
        name,
        owned + " owned · " + needed + " still needed",
        Number.isFinite(current.gil) ? number.format(current.gil) + " gil available" : "Gil unavailable"
      )
    );
    if (!needed) return;
    for (const row of bribeShopping(fieldBribeSources.get(name) || [], needed, current.gil)) {
      const label =
        number.format(row.best) + (row.best === row.worst ? "" : "–" + number.format(row.worst)) + " gil";
      const line = entry(
        row.name,
        label,
        row.range.min +
          "–" +
          row.range.max +
          " per successful full-price bribe · " +
          number.format(row.gil) +
          " gil per fiend" +
          (row.affordable == null
            ? ""
            : row.affordable
              ? " · budget covers the range"
              : current.gil < row.best
                ? " · below minimum budget"
                : " · yield affects affordability")
      );
      line.append(action("Inspect " + row.name, () => choose("bestiary", row.name, row.id)));
      results.append(line);
    }
  };
  input.addEventListener("input", draw);
  view.list.append(results);
  draw();
}
function reserveStock(stock, reservations) {
  const usable = stock.slice();
  for (const [id, keep] of reservations)
    if (Number.isInteger(id) && id >= 0 && id < usable.length) usable[id] = Math.max(0, stock[id] - keep);
  return usable;
}
function drawReserves(current, view) {
  const key = "mix-reserves",
    reserves = readPlanPairs(key).filter(([id]) => mixItemNames[id]);
  const choices = mixItemNames.map((n, i) => [i, n]).sort((a, b) => a[1].localeCompare(b[1]));
  const id = fieldChoices.reserveItem ?? choices[0][0];
  const selected = planSelect(view.controls, "Ingredient to keep", choices, id, (v) => {
    fieldChoices.reserveItem = Number(v);
  });
  const quantity = planNumber(view.controls, "Keep in inventory", fieldChoices.keep || 1, 1, 99);
  quantity.addEventListener("input", () => {
    fieldChoices.keep = quantity.value;
  });
  view.controls.append(
    action("Set reserve", () => {
      const keep = validPlanNumber(quantity);
      if (keep == null) return;
      const item = Number(selected.value);
      planSave(key, [...reserves.filter(([k]) => k !== item), [item, keep]], view.message);
    })
  );
  for (const [item, keep] of reserves) {
    const line = entry(mixItemNames[item], "Keep " + keep);
    line.append(
      action("Release " + mixItemNames[item], () =>
        planSave(
          key,
          reserves.filter(([k]) => k !== item),
          view.message
        )
      )
    );
    view.list.append(line);
  }
  const names = mixSortedResults.map((m) => [m.index, m.name]);
  const resultId =
    fieldChoices.reserveMix ?? mixResults.find((m) => m.name === "Trio of 9999")?.index ?? names[0][0];
  planSelect(view.controls, "Desired Mix", names, resultId, (v) => {
    fieldChoices.reserveMix = Number(v);
    planRefresh();
  });
  const usable = reserveStock(mixInventory(current.items), reserves);
  const recipes = mixResults[resultId].recipes
    .map((pair) => ({ pair, count: mixRecipeStock(usable, pair) }))
    .filter((r) => r.count)
    .sort((a, b) => b.count - a.count);
  const list = element("div");
  view.list.append(
    entry(mixResults[resultId].name, recipes.length + " recipes available after reserves"),
    list
  );
  for (const { pair, count } of recipes)
    list.append(entry(pair.map((i) => mixItemNames[i]).join(" + "), count + " uses with this pair"));
  if (!recipes.length)
    list.append(
      action("Inspect all recipes", () => {
        mixInStock = false;
        choose("mix", mixResults[resultId].name);
      })
    );
}
function drawXFieldPlan(current, id, view) {
  if (id === "phase" || id === "remiem") {
    if (current.disc !== "SLPS-25088") view.list.append(entry("Load Final Fantasy X International on PS2"));
    else if (id === "phase") drawPhaseCoach(current, view);
    else drawRemiemRace(current, view);
    return;
  }
  if (id === "accuracy" || id === "celestial") {
    if (current.disc !== "SLPS-25088") view.list.append(entry("Load Final Fantasy X International on PS2"));
    else if (id === "accuracy") drawBossOdds(current, view);
    else drawCelestialPower(current, view);
    return;
  }
  if (!current.disc || !current.grid) {
    view.list.append(entry("Load an FFX International PS2 save to use this tool"));
    return;
  }
  ({ circuit: drawCircuit, workshop: drawWorkshop, bribes: drawBribes, reserves: drawReserves })[id](
    current,
    view
  );
}
