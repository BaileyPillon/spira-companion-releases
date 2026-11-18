"use strict";

const ffxPrepPlans = {
  dark: {name:"Dark Aeons", type:1, slots:[[0x8056],[0x8055],[0x800a],[0x8038,0x8080]],
    advice:"Stoneproof covers petrification against Dark Bahamut and Dark Yojimbo. Ribbon also covers other ailments. Save an aeon to absorb an Overdrive you can’t survive."},
  penance: {name:"Penance · 9,999 HP", type:1, slots:[[0x8056],[0x8055],[0x8008],[0x806d]],
    advice:"Build toward 9,999 HP and 255 Defense for this setup. Stack Cheer five times, keep the arms from taking turns, and clear Armor Break after Immolation."},
  ap: {name:"Don Tonberry · AP farm", type:0, slots:[[0x8011]],
    advice:"Have the Stoic attacker trigger Karma and revive them if they’re knocked out. Set the other two to Comrade. Don Tonberry stops countering once it reaches the party. Equip Overdrive → AP before the fight.",
    bonus:[[0x8013,0x8012],[0x800f,0x800e,0x8010]]},
  evrae: {name:"Evrae · Poison Breath", type:1, slots:[[0x803c,0x8080]],
    advice:"Poisonproof or Ribbon leaves your healer free to act after Poison Breath. You can also pull back before it lands or cure Poison with an Al Bhed Potion."},
  yojimbo: {name:"Yojimbo · Zanmato"}
};

const darkAeonTips = {
  334:"Have an aeon ready to absorb Energy Blast when Dark Valefor’s Overdrive is full.",
  335:"Dark Ifrit counters with a physical attack. Shell helps against Meteor Strike. Save an aeon to absorb Hellfire.",
  336:"The first fight ends at zero HP, but you must defeat Dark Ixion a second time to clear the encounter.",
  337:"Auto-Haste helps you keep pace. Prepare an aeon to take Diamond Dust when her Overdrive fills.",
  338:"Dark Bahamut counters after five damaging actions. Keep Stoneproof or Ribbon equipped and clear the breaks after Impulse.",
  339:"Pain can instantly KO its target. Keep Auto-Phoenix available and consider shielding the party from Oblivion with an aeon.",
  340:"Daigoro can petrify and shatter. Keep an aeon ready for Zanmato and win all five encounters before leaving the cavern.",
  341:"When all three sisters are alive, save an aeon to absorb Delta Attack.",
  342:"When all three sisters are alive, save an aeon to absorb Delta Attack.",
  343:"Mindy is hard to hit with normal attacks. Overdrives can bypass her evasion. Protect against the sisters’ Delta Attack."
};

const prepRecipes = ffxCustomization.map(recipes =>
  new Map(recipes.map(([ability,item,cost]) => [ability,{item,cost}])));
const prepDarkAeons = ["Dark Valefor", "Dark Ifrit", "Dark Ixion", "Dark Shiva", "Dark Bahamut",
  "Dark Yojimbo", "Dark Anima", "Dark Magus Sisters"];
const darkFightIds = [334,335,336,337,338,340,339,341];
for (const [index,id] of darkFightIds.entries()) {
  const common = ffxPrepPlans.dark.slots.slice(0,3);
  const protection = id === 336 ? [0x8040,0x8080] : id === 337 ? [0x8030] : [0x8038,0x8080];
  ffxPrepPlans[`dark-${id}`] = {name:prepDarkAeons[index], type:1, slots:[...common,protection], advice:darkAeonTips[id]};
}

let prepPlan = "dark";
let prepMembers = null;
let prepMembersOpen = false;

function prepForFoe(foe) {
  if (foe.id === 119) return "evrae";
  if (foe.id === 317) return "ap";
  if (foe.id >= 334 && foe.id <= 343) return `dark-${Math.min(foe.id,341)}`;
  if (foe.id === 344) return "penance";
  return null;
}

function openPrep(plan) {
  if (plan && Object.hasOwn(ffxPrepPlans, plan)) {
    prepPlan = plan;
    signature = "";
  }
  choose("prep");
}

function penanceArmStatus(current) {
  const arms = [345,346].map(id => {
    const enemy = current.enemies.find(foe => foe.id === id && foe.hp > 0);
    return {id, enemy, next:enemy ? (current.turnOrder || []).slice(1).indexOf(enemy.battleId) : -1};
  });
  const soonest = arms.filter(arm => arm.next >= 0).sort((a,b) => a.next - b.next)[0];
  return {arms, soonest, both:arms.every(arm => arm.enemy)};
}

function showPrepEncounter(current) {
  const boss = current.enemies?.find(foe => foe.hp > 0 && (foe.id === 317 || foe.id >= 334 && foe.id <= 344));
  if (!boss) return false;
  const box = element("aside", "story-hint encounter-guide");
  const header = element("div", "encounter-heading");
  header.append(element("h2", "", enemyName(boss.id)), metric("HP", boss.hp, boss.maxHp));
  box.append(header);
  if (boss.id === 344) {
    const {arms, soonest, both} = penanceArmStatus(current);
    const list = element("ul", "prep-arms");
    for (const {id,enemy} of arms) {
      list.append(element("li", "", `${enemyName(id)} · ${enemy ? number.format(enemy.hp) + " HP" : "Down"}`));
    }
    box.append(list, element("strong", "", soonest ? `${enemyName(soonest.id)} is next among the arms` : "Control the arms"),
      element("p", "", both ? "Both arms are up. Take one down before Penance can use Judgment Day in its second phase." :
        "Use the opening to damage Penance. Check the forecast again when an arm returns."));
  } else if (boss.id === 317) {
    const lead = prepKarmaRoster(current.party.filter(member => member.active && member.hp > 0))[0];
    if (lead) box.append(element("p", "", `${catalog.x.party[lead.member.id]} has defeated the most fiends on the front line. Karma can deal ${number.format(lead.karma)} damage before modifiers.`));
  } else {
    box.append(element("p", "", darkAeonTips[boss.id]));
  }
  box.append(action(boss.id === 317 ? "AP farm setup" : "Open armor plan", () => openPrep(prepForFoe(boss))));
  panel.append(box);
  return true;
}

function prepLoadout(member, plan, inventory) {
  const candidates = (member.gear || []).filter(piece => piece.type === plan.type).map(piece => {
    const matched = plan.slots.map(slot => slot.find(id => piece.abilities.includes(id)) ?? null);
    const missing = plan.slots.filter((_, index) => matched[index] == null).map(([id]) => prepRecipes[plan.type].get(id));
    const costs = prepCosts([{missing}], inventory);
    const slots = piece.abilities.filter(id => id === null).length;
    const fits = !missing.length || !piece.celestial && slots >= missing.length;
    const short = costs.filter(material => material.short > 0).length;
    const bonus = (plan.bonus || []).map(group => group.find(id => piece.abilities.includes(id))).filter(id => id != null);
    return {piece, matched, missing, fits, short, bonus};
  });
  candidates.sort((a,b) => Number(b.fits) - Number(a.fits) || a.missing.length - b.missing.length ||
    a.short - b.short || b.bonus.length - a.bonus.length || Number(b.piece.equipped) - Number(a.piece.equipped));
  return candidates[0];
}

function prepCosts(loadouts, inventory) {
  const totals = new Map();
  for (const {missing} of loadouts) {
    for (const {item,cost} of missing) totals.set(item, (totals.get(item) || 0) + cost);
  }
  return [...totals].map(([item,needed]) => {
    const owned = inventory.get(item) || 0;
    return {item,needed,owned,short:Math.max(0, needed - owned)};
  });
}

function prepKarmaRoster(party) {
  const ranked = party.filter(member => Number.isInteger(member.fiendsDefeated))
    .sort((a,b) => b.fiendsDefeated - a.fiendsDefeated);
  const attacker = ranked[0];
  return ranked.map(member => ({member, attacker:member === attacker,
    karma:Math.min(99999,100 * member.fiendsDefeated), mode:member === attacker ? 2 : 1}));
}

function showPrep(current) {
  heading("Boss Prep");
  const filters = element("div", "filters prep-filters");
  const planLabel = element("label", "", "Fight or goal");
  planLabel.append(options("Fight or goal", Object.entries(ffxPrepPlans).map(([id, plan]) => [id,plan.name]), prepPlan,
    value => { prepPlan = value; panel.scrollTop = 0; signature = ""; render(); }));
  filters.append(planLabel);
  if (current.disc === "SLPS-25088" && (prepPlan.startsWith("dark") || prepPlan === "penance")) {
    filters.append(action("Compare Ribbon drops", () => openGearDrops("ribbon")));
  }
  panel.append(filters);
  if (prepPlan === "yojimbo") {
    showYojimboPlan(current);
    return;
  }

  const plan = ffxPrepPlans[prepPlan];
  const inventory = itemAmounts(current.items);
  const party = current.party.filter(member => member.id < 7);
  const front = party.filter(member => member.active);
  const selected = prepMembers ? party.filter(member => prepMembers.includes(member.id)) : front.length ? front : party.slice(0,3);
  const members = element("details", "prep-members arena-pending");
  members.open = prepMembersOpen;
  members.addEventListener("toggle", () => { prepMembersOpen = members.open; });
  members.append(element("summary", "", "Plan for " + (selected.map(member => catalog.x.party[member.id]).join(", ") || "your party")));
  const choices = element("div", "filters");
  for (const member of party) {
    const label = element("label", "prep-choice");
    const check = element("input");
    check.type = "checkbox";
    check.checked = selected.includes(member);
    check.addEventListener("change", () => {
      const ids = selected.map(other => other.id).filter(id => id !== member.id);
      if (check.checked) ids.push(member.id);
      prepMembers = ids;
      signature = "";
      render();
      panel.querySelectorAll(".prep-choice input")[party.indexOf(member)].focus({preventScroll:true});
    });
    label.append(check, catalog.x.party[member.id]);
    choices.append(label);
  }
  choices.append(action("Use front line", () => { prepMembers = null; signature = ""; render(); }));
  members.append(choices);
  panel.append(members);

  const rows = selected.map(member => ({member, fit:prepLoadout(member, plan, inventory)}));
  const karma = prepPlan === "ap" ? prepKarmaRoster(selected) : [];
  if (karma.length) {
    const lead = karma[0];
    const callout = element("aside", "story-hint prep-karma");
    callout.append(element("strong", "", `Karma attacker · ${catalog.x.party[lead.member.id]}`),
      element("p", "", `${number.format(lead.karma)} estimated damage from ${number.format(lead.member.fiendsDefeated)} fiends defeated.`));
    panel.append(callout);
  }
  const complete = rows.filter(({fit}) => fit && !fit.missing.length).length;
  const needBase = rows.filter(({fit}) => !fit?.fits).length;
  if (rows.length) {
    panel.append(element("h2", "", `${complete} of ${rows.length} have the ${plan.type ? "armor" : "AP weapon"}`));
    panel.append(element("p", "prep-requirements", plan.slots.map(slot => slot.map(id => ffxData.abilities[id]).join(" or ")).join(" · ")));
  }
  const sheet = element("div", "sheet");
  for (const {member, fit} of rows) {
    let state = `Need compatible ${plan.type ? "armor" : "weapon"}`;
    if (fit?.fits) state = !fit.missing.length ? (fit.piece.equipped ? "Equipped" : "Equip owned gear") : "Can build on owned gear";
    const title = catalog.x.party[member.id];
    const name = fit ? gearName(fit.piece, member.id) : "";
    const row = entry(title, state, fit?.fits ? name : "");
    if (fit?.fits && fit.missing.length) {
      const abilities = element("ul", "prep-abilities");
      for (const [i, slot] of plan.slots.entries()) {
        const ability = fit.matched[i];
        const text = ability ? ffxData.abilities[ability] : slot.map(id => ffxData.abilities[id]).join(" or ");
        abilities.append(element("li", ability ? "prep-equipped" : "prep-missing", ability ? text : `Add ${text}`));
      }
      row.append(abilities);
    }
    if (fit?.fits && fit.bonus.length) row.append(element("p", "", fit.bonus.map(id => ffxData.abilities[id]).join(" · ")));
    if (prepPlan === "penance" && member.attributes?.length) {
      row.append(element("p", "", `Max HP ${number.format(member.maxHp)} · Defense ${member.attributes[1]} / 255`));
    }
    const role = karma.find(entry => entry.member === member);
    if (role) {
      const setting = role.attacker ? "Stoic" : "Comrade";
      const modeStatus = member.overdriveMode === role.mode ? "active" :
        member.overdriveModes & (1 << role.mode) ? "available in the Overdrive menu" : "still locked";
      const mode = member.overdriveRemaining ? xOverdriveRows(member)[role.mode] : null;
      row.append(element("p", "", `${setting} · ${mode && !mode.learned ? xOverdriveStatus(mode) : modeStatus}`));
      if (mode && !mode.learned) row.append(action("View Overdrive modes", () => openXOverdriveModes(member.id)));
    }
    sheet.append(row);
  }
  if (rows.length) panel.append(sheet);
  else panel.append(element("p", "field-note", "Select party members to plan their gear."));
  if (rows.length > 3) panel.append(element("p", "field-note", `Materials include all ${rows.length} selected characters. Up to three fight at once.`));
  if (needBase) {
    const kind = plan.type ? "armor" : "weapon";
    panel.append(element("p", "field-note", `${needBase} ${needBase === 1 ? "character needs" : "characters need"} a compatible ${kind}. An empty ${kind} with ${plan.slots.length} free ${plan.slots.length === 1 ? "slot" : "slots"} works.`));
    if (plan.slots.length === 4) panel.append(element("p", "field-note", current.progress?.wantz ?
      "After the Highbridge visit, find Wantz near the Thunder Plains entrance to Macalania Woods South." :
      "Speak to Wantz on Mt. Gagazet during the first ascent to unlock his four-slot shop later."));
  }

  const blankBase = {missing:plan.slots.map(([id]) => prepRecipes[plan.type].get(id))};
  const loadouts = rows.map(({fit}) => fit?.fits ? fit : blankBase);
  const bill = prepCosts(loadouts, inventory);
  if (bill.length) {
    panel.append(element("h2", "", "Materials for this party"));
    if (needBase) panel.append(element("p", "field-note", "Includes materials for new gear where a character needs a compatible base."));
    const materials = element("div", "sheet");
    for (const {item,needed,owned,short} of bill) {
      const name = ffxData.items[item];
      const row = entry(name, `${owned} owned / ${needed} needed · ${short ? `${short} short` : "In stock"}`);
      if (short) row.append(action("Find " + name, () => choose("bestiary", name)));
      materials.append(row);
    }
    panel.append(materials);
  }

  panel.append(element("h2", "", "Fight plan"), element("p", "", plan.advice));
  if (prepPlan === "penance") {
    const [potions, hiPotions, xPotions] = [0x2000,0x2001,0x2002].map(id => inventory.get(id) || 0);
    panel.append(element("p", "field-note", `Auto-Potion stock · ${xPotions} X-Potions, ${hiPotions} Hi-Potions, ${potions} Potions.`));
    if (potions || hiPotions || !xPotions) panel.append(element("p", "field-note", "Stock X-Potions only so Auto-Potion uses the full heal."));
  }
  if (prepPlan.startsWith("dark") || prepPlan === "penance") showPenanceGate(current);
  if (prepPlan === "ap") showApUnlocks(current);
}

function showPenanceGate(current) {
  const bits = current.progress?.darkAeons;
  if (!Number.isInteger(bits)) return;
  const cleared = prepDarkAeons.filter((_, i) => bits & (1 << i)).length;
  const details = element("details", "arena-pending");
  const list = element("ul");
  details.append(element("summary", "", `${cleared} / ${prepDarkAeons.length} Dark Aeon encounters cleared`), list);
  for (const [i, name] of prepDarkAeons.entries()) {
    list.append(element("li", "", `${name} · ${bits & (1 << i) ? "Cleared" : "Remaining"}`));
  }
  panel.append(element("h2", "", "Unlock Penance"), details);
}

function showApUnlocks(current) {
  const sheet = element("div", "sheet");
  const goals = arenaGoals(current).flatMap(([,goals]) => goals);
  for (const [name, text] of [["Don Tonberry", "Unlock the Karma counterattack encounter."],
    ["One-Eye", "Farm Triple AP weapons with an empty slot for Overdrive → AP. Triple Overdrive is an optional upgrade."]]) {
    const goal = goals.find(goal => goal.name === name);
    const ready = goal.ready || arenaDefeated(current, name);
    const row = entry(name, ready ? "Capture requirements met" : goal.detail, text);
    if (!ready) {
      const requirements = element("details", "arena-pending");
      requirements.append(element("summary", "", "See missing captures"));
      const list = element("ul");
      for (const item of goal.pending) list.append(element("li", "", item));
      requirements.append(list);
      row.append(requirements);
    }
    row.append(action("Look up " + name, () => choose("bestiary", name)));
    if (name === "One-Eye") row.append(action("Plan Triple AP farm", () => openArenaFarm("ap")));
    sheet.append(row);
  }
  panel.append(element("h2", "", "Monster Arena unlocks"), sheet);
}
