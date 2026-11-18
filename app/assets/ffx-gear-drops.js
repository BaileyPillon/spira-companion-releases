"use strict";

const lootPresets = {
  ap:{label:"Triple AP · 2 open", type:0, required:[0x8013], free:2, enemy:299},
  ribbon:{label:"Ribbon · 3 open", type:1, required:[0x8080], free:3, enemy:340},
  survival:{label:"Ribbon + Break HP Limit", type:1, required:[0x8080,0x8017], free:2, enemy:340}
};
let lootPlan = {...lootPresets.ap, owner:-1, finisher:-1};
let lootFiltersOpen = false;

function gearDropProfile(id) {
  return ffxGearDropData.profiles[ffxGearDropData.enemies[id]];
}

function dropOwnerOdds(eligible, finisher) {
  const bonus = eligible.includes(finisher) ? 3 : 0;
  const total = eligible.length + bonus;
  return eligible.map(id => [id, (1 + (id === finisher ? bonus : 0)) / total]);
}

function gearRollChance(pool, slotRolls, abilityRolls, required, free) {
  if (required.some(id => !pool.includes(id))) return 0;
  const codes = [...new Set(pool.filter(Boolean))];
  const maskOf = id => id ? 1 << codes.indexOf(id) : 0;
  const bits = pool.map(maskOf);
  const randomBits = bits.slice(1);
  const wanted = required.reduce((mask, id) => mask | maskOf(id), 0);
  const size = Array.from({length:1 << codes.length}, (_, mask) => {
    let count = 0;
    for (; mask; mask &= mask - 1) count++;
    return count;
  });
  let total = 0;
  for (const slots of new Set(slotRolls)) {
    if (slots - free < required.length) continue;
    const go = new Map();
    function finish(mask, rolls) {
      if (size[mask] > slots - free) return 0;
      if (!rolls || size[mask] === slots) return (mask & wanted) === wanted ? 1 : 0;
      const key = rolls * size.length + mask;
      if (go.has(key)) return go.get(key);
      const probability = randomBits.reduce((sum, bit) => sum + finish(mask | bit, rolls - 1), 0) / randomBits.length;
      go.set(key, probability);
      return probability;
    }
    const weight = slotRolls.filter(value => value === slots).length / slotRolls.length;
    total += weight * abilityRolls.reduce((sum, rolls) => sum + finish(bits[0], rolls), 0) / abilityRolls.length;
  }
  return total;
}

function gearOdds(profile, plan, eligible) {
  const [rate, slots, rolls, weapons, armors] = profile;
  const pools = plan.type === 0 ? weapons : armors;
  const seen = new Map();
  let total = 0;
  for (const [id, weight] of dropOwnerOdds(eligible, plan.finisher)) {
    if (plan.owner !== -1 && id !== plan.owner) continue;
    const pool = pools[id];
    if (!seen.has(pool)) {
      seen.set(pool, gearRollChance(ffxGearDropData.pools[pool], slots, rolls, plan.required, plan.free));
    }
    total += weight * seen.get(pool);
  }
  return total * rate / 255 / 2;
}

function gearHuntSources(plan, eligible) {
  return Object.keys(ffxGearDropData.enemies).flatMap(id => {
    const foe = ffxData.enemies[id];
    if (!foe?.hp || !isFiend(foe)) return [];
    const profile = gearDropProfile(id);
    const chance = gearOdds(profile, plan, eligible);
    return chance > 0 || Number(id) === plan.enemy ? [{id:Number(id), foe, profile, chance}] : [];
  }).sort((a,b) => Number(b.id === plan.enemy) - Number(a.id === plan.enemy) ||
    b.chance - a.chance || a.foe.name.localeCompare(b.foe.name));
}

function gearAlreadyOwned(party, plan) {
  return party.flatMap(member => {
    if (member.id < 0 || member.id >= 7 || (plan.owner !== -1 && member.id !== plan.owner)) return [];
    return (member.gear || []).flatMap(piece =>
      piece.type === plan.type && plan.required.every(id => piece.abilities.includes(id)) &&
      piece.abilities.filter(id => id == null).length >= plan.free ? [{member,piece}] : []);
  });
}

function gearWinsFor(chance, confidence) {
  if (chance <= 0) return null;
  return Math.ceil(Math.log1p(-confidence) / Math.log1p(-chance));
}

function openGearDrops(preset = "", enemy = null) {
  const selection = lootPresets[preset];
  if (selection) lootPlan = {...lootPlan, ...selection, enemy:enemy ?? selection.enemy};
  else if (enemy != null) {
    const type = lootPresets.ap.enemy === enemy ? "ap" : lootPresets.ribbon.enemy === enemy ? "ribbon" : "";
    if (type) lootPlan = {...lootPlan, ...lootPresets[type]};
    else lootPlan = {...lootPlan, type:0, required:[], free:0, enemy};
  }
  bestiaryMode = "gear";
  signature = "";
  choose("bestiary");
}

const lootPercent = new Intl.NumberFormat(undefined, {style:"percent",maximumFractionDigits:2});

function showGearOwned(current, plan, parent) {
  if (!plan.required.length && plan.free === 0) return;
  const pieces = gearAlreadyOwned(current.party, plan);
  const owners = [...new Set(pieces.map(({member}) => member.id))];
  const details = element("details", "gear-drop-detail");
  details.append(element("summary", "", owners.length ?
    `${number.format(pieces.length)} matching gear owned · ${owners.map(id => catalog.x.party[id]).join(", ")}` :
    "No matching gear in your inventory"));
  for (const {member,piece} of pieces) {
    details.append(element("p", "", `${catalog.x.party[member.id]} · ${gearName(piece, member.id)}${piece.equipped ? " · equipped" : ""}`));
  }
  for (const ability of plan.required) {
    const recipe = ffxCustomization[plan.type].find(([id]) => id === ability);
    if (!recipe) continue;
    const [,item,cost] = recipe;
    const owned = itemAmounts(current.items).get(item) || 0;
    const material = ffxData.items[item];
    const row = element("div", "tracker-actions");
    row.append(element("span", "", `${ffxData.abilities[ability]} · ${owned}/${cost} ${material} for customization`),
      action("Find " + material, () => openItemSources(material)));
    details.append(row);
  }
  parent.append(details);
}

function showGearSource(current, plan, eligible, source, goals) {
  const {foe,id,profile,chance} = source;
  const inBattle = current.enemies?.some(actor => actor.id === id && actor.hp > 0);
  const creation = goals.get(foe.name);
  const locked = creation && !creation.ready && !arenaDefeated(current, foe.name);
  const darkBit = id >= 334 && id <= 343 ? darkFightIds.indexOf(Math.min(id,341)) : -1;
  const darkCleared = darkBit >= 0 && !!(current.progress?.darkAeons & (1 << darkBit));
  const row = entry(foe.name, [
    inBattle ? "In battle" : locked ? "Arena unlock needed" : "",
    darkCleared ? "Dark Aeon defeated" : "",
    id === 340 ? "Stolen Fayth Cavern" : "",
    number.format(foe.hp) + " HP"
  ].filter(Boolean).join(" · "));
  const estimate = chance > 0 ? (chance < .0001 ? "<0.01%" : lootPercent.format(chance)) + " per kill" : "Cannot drop this match";
  row.append(element("p", "gear-drop-estimate", estimate));
  if (chance > 0) {
    const kills = confidence => {
      const count = gearWinsFor(chance, confidence);
      return number.format(count) + (count === 1 ? " kill" : " kills");
    };
    row.append(element("p", "field-note",
      `50% by ${kills(.5)} · 90% by ${kills(.9)}`));
  }
  const details = element("details", "gear-drop-detail");
  const slots = [...new Set(profile[1])];
  details.append(element("summary", "", "Drop table"),
    element("p", "field-note", `${lootPercent.format(profile[0] / 255)} any gear · ${slots.join(" / ")} total slots`));
  const ids = plan.owner === -1 ? eligible : [plan.owner];
  const pools = profile[3 + plan.type];
  const names = [...new Set(ids.flatMap(owner => ffxGearDropData.pools[pools[owner]].filter(Boolean)))];
  if (names.length) details.append(element("p", "field-note", names.map(id => ffxData.abilities[id]).join(" · ")));
  if (id === 340 && !darkCleared) {
    details.append(element("p", "field-note", "For repeat attempts, leave and re-enter the cavern before winning all five encounters."));
  }
  if (creation) details.append(action("View Arena requirements", () => openArenaCreation(foe.name)));
  row.append(details);
  return row;
}

function showGearDrops(current) {
  const eligible = [...new Set(current.party.map(member => member.id))].filter(id => id >= 0 && id < 7);
  if (!eligible.length) {
    panel.append(element("p", "empty", "Waiting for the active save’s party roster."));
    return;
  }
  const presets = element("div", "filters");
  for (const [key,preset] of Object.entries(lootPresets)) {
    const selected = lootPlan.type === preset.type && lootPlan.free === preset.free &&
      lootPlan.required.join() === preset.required.join();
    const button = action(preset.label, () => openGearDrops(key), selected);
    button.setAttribute("aria-pressed", String(selected));
    presets.append(button);
  }
  panel.append(presets);
  const controls = element("div", "filters gear-drop-filters");
  const build = element("div", "filters gear-drop-filters");
  const change = patch => {
    lootPlan = {...lootPlan, ...patch};
    const scroll = panel.scrollTop;
    const label = document.activeElement?.getAttribute("aria-label");
    signature = "";
    render();
    panel.scrollTop = scroll;
    const field = [...panel.querySelectorAll(".gear-drop-filters select")].find(select => select.getAttribute("aria-label") === label);
    field?.focus({preventScroll:true});
  };
  const owner = eligible.includes(lootPlan.owner) ? lootPlan.owner : -1;
  const finisher = eligible.includes(lootPlan.finisher) ? lootPlan.finisher : -1;
  const plan = {...lootPlan, owner, finisher};
  const abilityChoices = [...new Set(ffxGearDropData.profiles.flatMap(profile => profile[3 + plan.type]
    .flatMap(index => ffxGearDropData.pools[index])))].filter(Boolean)
    .sort((a,b) => ffxData.abilities[a].localeCompare(ffxData.abilities[b]));
  const owners = eligible.map(id => [id,catalog.x.party[id]]);
  build.append(
    options("Gear type", [[0,"Weapon"],[1,"Armor"]], plan.type, value => change({type:Number(value),required:[],enemy:null})),
    options("Required ability", [[0,"Any ability"], ...abilityChoices.map(id => [id,ffxData.abilities[id]])],
      plan.required[0] || 0, value => change({required:Number(value) ? [Number(value)] : [],enemy:null})),
    options("Second ability", [[0,"No second ability"], ...abilityChoices.filter(id => id !== plan.required[0])
      .map(id => [id,ffxData.abilities[id]])], plan.required[1] || 0, value =>
      change({required:[plan.required[0],Number(value)].filter(Boolean),enemy:null})),
    options("Minimum free slots", [0,1,2,3,4].map(n => [n,n ? `${n}+ open slots` : "Any open slots"]),
      plan.free, value => change({free:Number(value), enemy:null}))
  );
  controls.append(
    options("Gear owner", [[-1,"Any recipient"], ...owners], owner, value => change({owner:Number(value)})),
    options("Finishing blow", [[-1,"Aeon / no owner bonus"], ...owners.map(([id,name]) => [id,name + " finishes"])],
      finisher, value => change({finisher:Number(value)}))
  );
  build.children[2].disabled = !plan.required.length;
  for (const select of [...controls.children, ...build.children]) {
    const label = element("label", "", select.getAttribute("aria-label"));
    select.replaceWith(label);
    label.append(select);
  }
  const advanced = element("details", "gear-drop-detail");
  advanced.open = lootFiltersOpen;
  advanced.addEventListener("toggle", () => { lootFiltersOpen = advanced.open; });
  advanced.append(element("summary", "", "Customize abilities and slots"), build);
  panel.append(controls, advanced);
  showGearOwned(current, plan, panel);
  const sources = gearHuntSources(plan, eligible);
  const goals = new Map(arenaGoals(current).flatMap(([,rows]) => rows.map(goal => [goal.name,goal])));
  const best = sources.slice(0, 6);
  const other = sources.slice(6);
  panel.append(element("h2", "", plan.enemy != null ? "Selected fiend and alternatives" : "Gear sources"),
    element("p", "field-note", "Estimates use your available roster, selected finishing blow and repeat kills under the same conditions."));
  if (!best.length) {
    panel.append(element("p", "empty", "No fiend drops this combination. Try fewer required abilities or open slots."));
    return;
  }
  const list = element("div", "sheet");
  for (const source of best) list.append(showGearSource(current,plan,eligible,source,goals));
  panel.append(list);
  if (other.length) {
    const rest = element("details", "gear-drop-detail");
    rest.append(element("summary", "", "Show " + other.length + " more sources"));
    rest.addEventListener("toggle", () => {
      if (!rest.open || rest.childElementCount > 1) return;
      const tail = element("div", "sheet");
      for (const source of other) tail.append(showGearSource(current,plan,eligible,source,goals));
      rest.append(tail);
    });
    panel.append(rest);
  }
}
