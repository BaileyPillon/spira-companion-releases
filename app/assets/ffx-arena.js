"use strict";

const areaCreations = [
  "Stratoavis", "Malboro Menace", "Kottos", "Coeurlregina", "Jormungand",
  "Cactuar King", "Espada", "Abyss Worm", "Chimerageist", "Don Tonberry",
  "Catoblepas", "Abaddon", "Vorban"
];
const speciesCreations = [
  ["Fenrir", 3, "Dingo|Mi'ihen Fang|Garm|Snow Wolf|Sand Wolf|Skoll|Bandersnatch"],
  ["Ornitholestes", 3, "Dinonix|Ipiria|Raptor|Melusine|Iguion|Yowie|Zaurus"],
  ["Pteryx", 5, "Condor|Simurgh|Alcyone"],
  ["Hornet", 4, "Killer Bee|Bite Bug|Wasp|Nebiros"],
  ["Vidatu", 4, "Gandarewa|Aerouge|Imp"],
  ["One-Eye", 4, "Floating Eye|Buer|Evil Eye|Ahriman|Floating Death"],
  ["Jumbo Flan", 3, "Water Flan|Thunder Flan|Ice Flan|Snow Flan|Flame Flan|Dark Flan"],
  ["Nega Elemental", 3, "Yellow Element|White Element|Red Element|Gold Element|Blue Element|Dark Element|Black Element"],
  ["Tanket", 3, "Raldo|Bunyip|Murussu|Mafdet|Shred|Halma"],
  ["Fafnir", 4, "Vouivre|Lamashtu|Kusariqqu|Mushussu|Nidhogg"],
  ["Sleep Sprout", 5, "Funguar|Thorn|Exoray"],
  ["Bomb King", 5, "Bomb|Grenade|Puroboros"],
  ["Juggernaut", 5, "Dual Horn|Valaha|Grendel"],
  ["Ironclad", 10, "Iron Giant|Gemini (Sword)|Gemini (Club)"]
];
const allArenaFiends = Object.values(arenaRegions).flat();
const arenaEnemyIds = Object.entries(ffxData.enemies).reduce((ids, [id, foe]) => {
  if (!ids.has(foe.name)) ids.set(foe.name, []);
  ids.get(foe.name).push(Number(id));
  return ids;
}, new Map());
const arenaOriginals = [
  ["Earth Eater", "area", 2], ["Greater Sphere", "species", 2],
  ["Catastrophe", "area", 6], ["Th'uban", "species", 6],
  ["Neslug", "capture", 1], ["Ultima Buster", "capture", 5],
  ["Shinryu", "capture", 2, ["Splasher", "Achelous", "Maelspike"]], ["Nemesis", "all", 10]
];

const arenaFarms = [
  ["ap", "Triple AP weapons", "One-Eye", null, "Farm weapons with Triple AP and two open slots. Add Overdrive → AP for the Don Tonberry method."],
  ["8262", "Power Sphere", "Kottos", 20, "Use Extract Power or a Power Distiller before the finishing blow."],
  ["8263", "Mana Sphere", "Kottos", 20, "Use Extract Mana or a Mana Distiller before the finishing blow."],
  ["8264", "Speed Sphere", "Kottos", 20, "Use Extract Speed or a Speed Distiller before the finishing blow."],
  ["8265", "Ability Sphere", "Kottos", 20, "Use Extract Ability or an Ability Distiller before the finishing blow."],
  ["8266", "Fortune Sphere", "Earth Eater", 1, "Use these to activate Luck nodes. Knock Earth Eater onto its back before using Wakka’s Attack Reels."],
  ["8286", "Luck Sphere", "Greater Sphere", 1, "Place a +4 Luck node, then spend a Fortune Sphere per character to activate it."],
  ...[
    [8279,"Juggernaut"], [8280,"Tanket"], [8281,"Jumbo Flan"], [8282,"One-Eye"],
    [8283,"Fenrir"], [8284,"Pteryx"], [8285,"Hornet"], [8277,"Ironclad"], [8278,"Vidatu"],
    [8300,"Shinryu"]
  ].map(([id, foe]) => [String(id),ffxData.items[id],foe,1,""])
];
let arenaFarm = "ap";
const arenaFarmTargets = new Map();

function openArenaFarm(id, target) {
  const key = String(id);
  if (!arenaFarms.some(([value]) => value === key)) return;
  if (Number.isInteger(target)) arenaFarmTargets.set(key, Math.min(99, target));
  arenaFarm = key;
  arenaView = "farming";
  arenaCreation = "";
  signature = "";
  choose("arena");
}

function arenaFarmNeeds(owned, target, quantity) {
  const missing = Math.max(0, target - owned);
  return {missing, wins:Math.ceil(missing / quantity), overkills:Math.ceil(missing / (2 * quantity))};
}

function showArenaFarming(current) {
  const stats = element("div", "sheet guide-list");
  const goals = arenaGoals(current).flatMap(([,rows]) => rows);
  const inventory = itemAmounts(current.items);
  const controls = element("div", "filters");
  controls.append(options("Farm reward", arenaFarms.map(([id,name]) => [id,name]), arenaFarm,
    value => { arenaFarm = value; draw(); }));
  panel.append(controls, stats);

  function draw() {
    const [id, reward, foe, quantity, hint] = arenaFarms.find(([value]) => value === arenaFarm);
    const goal = goals.find(row => row.name === foe);
    const defeated = arenaDefeated(current, foe);
    const status = defeated ? "Defeated" : goal.ready ? "Capture requirements met" : "Capture requirements remaining";
    const enemy = ffxData.enemies[arenaEnemyIds.get(foe)[0]];
    const row = entry(foe, status, goal.detail);
    row.append(element("p", "", `${number.format(enemy.hp)} HP · ${number.format(enemy.overkill)} damage on the finishing hit for Overkill`));
    if (hint) row.append(element("p", "", hint));
    const links = element("div", "tracker-actions");
    links.append(action("View " + foe + " unlock", () => openArenaCreation(foe)));
    if (id === "ap") links.append(action("Don Tonberry AP setup", () => openPrep("ap")),
      action("Compare Triple AP drops", () => openGearDrops("ap")));
    row.append(links);

    if (id === "ap") {
      const eligible = (current.party || []).filter(member => member.id < 7 && member.gear?.some(piece =>
        piece.type === 0 && piece.abilities.includes(0x8013) && piece.abilities.includes(null)));
      stats.replaceChildren(entry(reward, `${eligible.length} / 7 characters own Triple AP with an open slot`,
        eligible.map(member => catalog.x.party[member.id]).join(", ")), row);
      return;
    }
    const owned = inventory.get(Number(id)) || 0;
    const plan = entry(reward, `${owned} owned · ${quantity} per common drop · ${quantity * 2} with Overkill`);
    const label = element("label", "farm-target", "Target stock");
    const target = element("input");
    target.type = "number";
    target.inputMode = "numeric";
    target.min = 1;
    target.max = 99;
    target.value = arenaFarmTargets.get(id) ?? Math.min(99, owned + quantity * 2);
    label.append(target);
    const result = element("p", "");
    result.setAttribute("aria-live", "polite");
    function update() {
      const amount = target.valueAsNumber;
      if (!Number.isInteger(amount) || !target.validity.valid) {
        result.textContent = "Enter a stock target from 1 to 99.";
        return;
      }
      arenaFarmTargets.set(id, amount);
      const {missing, wins, overkills} = arenaFarmNeeds(owned, amount, quantity);
      result.textContent = missing ? `${missing} to go · ${wins} normal or ${overkills} Overkill wins with common drops` : "Stock target met";
    }
    target.addEventListener("input", update);
    update();
    plan.classList.add("arena-farm-plan");
    plan.append(label, result, element("p", "field-note", "A rare drop can replace the listed reward."));
    stats.replaceChildren(plan, row);
  }
  draw();
}

function arenaCaptureCount(current, name) {
  const ids = arenaEnemyIds.get(name) || [];
  return ids.length ? Math.min(10, Math.max(...ids.map(id => arenaValue(current, id)))) : null;
}

function arenaDefeated(current, name) {
  return (arenaEnemyIds.get(name) || []).some(id =>
    !!(arenaValue(current, 576 + (id >> 3)) & (1 << (id & 7))));
}

function arenaGoals(current) {
  function captureGoal(name, fiends, target) {
    const pending = fiends.map(foe => [foe, arenaCaptureCount(current, foe)])
      .filter(([,count]) => count == null || count < target);
    return {name, fiends, target, ready:!pending.length, detail:`Capture ${target} of each · ${fiends.length - pending.length} / ${fiends.length} complete`,
      pending:pending.map(([foe,count]) => count == null ? foe + " · capture slot unavailable" : `${foe} · ${count} / ${target}`)};
  }
  const areas = Object.values(arenaRegions).map((fiends, index) => captureGoal(areaCreations[index], fiends, 1));
  const species = speciesCreations.map(([name, target, fiends]) => captureGoal(name, fiends.split("|"), target));
  const originals = [];
  for (const [name, rule, target, fiends] of arenaOriginals) {
    if (rule === "capture") {
      originals.push(captureGoal(name, fiends || allArenaFiends, target));
    } else if (rule === "all") {
      const goal = captureGoal(name, allArenaFiends, target);
      const defeats = [...areas, ...species, ...originals].filter(({name}) => !arenaDefeated(current, name));
      goal.detail += " · " + (areas.length + species.length + originals.length - defeats.length) + " / " +
        (areas.length + species.length + originals.length) + " other creations defeated";
      goal.pending.push(...defeats.map(({name}) => "Defeat " + name));
      goal.ready = !goal.pending.length;
      originals.push(goal);
    } else {
      const group = rule === "area" ? areas : species;
      const count = group.filter(goal => goal.ready || arenaDefeated(current, goal.name)).length;
      originals.push({name, ready:count >= target, prerequisites:group.filter(goal => !goal.ready && !arenaDefeated(current, goal.name)),
        detail:`Meet ${target} ${rule === "area" ? "Area" : "Species"} Conquest unlocks · ${count} / ${target}`, pending:[]});
    }
  }
  return [["Area Conquest", areas], ["Species Conquest", species], ["Original Creations", originals]];
}

function showArenaCreations(current) {
  for (const [title, goals] of arenaGoals(current)) {
    const matching = arenaCreation ? goals.filter(goal => goal.name === arenaCreation) : goals;
    if (!matching.length) continue;
    panel.append(element("h2", "", title));
    const sheet = element("div", "sheet");
    for (const goal of matching) {
      const defeated = arenaDefeated(current, goal.name);
      const status = defeated ? "Defeated" : goal.ready ? "Requirements met" : "In progress";
      const row = entry(goal.name, status, goal.detail);
      if (goal.pending.length && !defeated) {
        const details = element("details", "arena-pending");
        const list = element("ul");
        if (goal.fiends) {
          for (const fiend of goal.fiends) {
            const count = arenaCaptureCount(current, fiend);
            if (count >= goal.target) continue;
            const area = Object.keys(arenaRegions).find(region => arenaRegions[region].includes(fiend));
            const tally = count == null ? "Capture slot unavailable" : `${count} / ${goal.target}`;
            const item = element("li", "", `${fiend} · ${tally} · ${area}`);
            item.append(action("Find " + fiend, () => choose("bestiary", fiend)));
            list.append(item);
          }
        }
        for (const missing of goal.pending.filter(text => !goal.fiends || text.startsWith("Defeat "))) {
          list.append(element("li", "", missing));
        }
        details.append(element("summary", "", "Remaining requirements"), list);
        details.open = !!arenaCreation;
        row.append(details);
      }
      if (arenaCreation && !goal.ready && !defeated && goal.prerequisites?.length) {
        const list = element("ul", "arena-options");
        row.append(element("p", "", "Choose any remaining unlocks from this group."), list);
        for (const prerequisite of goal.prerequisites.slice().sort((a,b) => a.pending.length - b.pending.length)) {
          const option = element("li");
          option.append(action(prerequisite.name, () => openArenaCreation(prerequisite.name)),
            element("span", "", `${prerequisite.pending.length} species short`));
          list.append(option);
        }
      }
      sheet.append(row);
    }
    panel.append(sheet);
  }
}
