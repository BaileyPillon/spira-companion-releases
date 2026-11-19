"use strict";

const endgameTargets = [334,335,336,337,338,339,340,341,342,343,344,345,346];

function bossHitPlan(stats, foe, aim, goal) {
  if (![stats?.[5], stats?.[7], foe?.[7], foe?.[8]].every(n => Number.isInteger(n) && n >= 0 && n <= 255)) return null;
  const luck = stats[5], accuracy = stats[7], foeLuck = foe[7], evasion = foe[8];
  const wins = (value, stacks) => battleHitRolls(battleModelData.actions[0x3000], accuracy, value, evasion, foeLuck, stacks);
  const needed = Math.ceil(goal * 101 / 100);
  // Search the actual integer stat so clamped rolls and the stat cap are handled exactly.
  let targetLuck = luck;
  while (targetLuck <= 255 && wins(targetLuck, aim) < needed) targetLuck++;
  let requiredAim = 0;
  while (requiredAim <= 5 && wins(luck, requiredAim) < needed) requiredAim++;
  return {rolls:wins(luck, aim), noAim:wins(luck, 0), fullAim:wins(luck, 5), luck, accuracy, targetLuck:targetLuck <= 255 ? targetLuck : null,
    requiredAim:requiredAim <= 5 ? requiredAim : null};
}

function drawBossOdds(current, view) {
  const encounter = (current.enemies || []).find(e => endgameTargets.includes(e.id) && e.hp > 0);
  const selection = fieldChoices.oddsTarget ?? "live";
  const target = selection === "live" ? encounter?.id ?? 343 : Number(selection);
  const aim = fieldChoices.oddsAim ?? 0, goal = fieldChoices.oddsGoal ?? 100;
  const label = id => id >= 345 ? "Penance · " + enemyName(id) : enemyName(id);
  planSelect(view.controls, "Opponent", [["live","Follow fight · " + label(encounter?.id ?? 343)], ...endgameTargets.map(id => [id,label(id)])], selection, value => {
    fieldChoices.oddsTarget = value; planRefresh();
  });
  planSelect(view.controls, "Aim stacks", [0,1,2,3,4,5].map(n => [n,String(n)]), aim, value => {
    fieldChoices.oddsAim = Number(value); planRefresh();
  });
  planSelect(view.controls, "Hit goal", [90,95,100].map(n => [n,n + "%"]), goal, value => {
    fieldChoices.oddsGoal = Number(value); planRefresh();
  });
  const foe = battleModelData.monsters[target].stats;
  view.message.textContent = label(target) + " · " + foe[7] + " Luck · " + foe[8] + " Evasion. Uses saved party stats and the Aim stacks you select.";
  for (const member of (current.party || []).filter(m => m.id >= 0 && m.id < 7)) {
    const name = catalog.x.party[member.id];
    const result = bossHitPlan(member.attributes, foe, aim, goal);
    if (!result) { view.list.append(entry(name, "Waiting for character stats")); continue; }
    const percent = (100 * result.rolls / 101).toLocaleString(undefined, {maximumFractionDigits:1});
    const row = entry(name, percent + "% to hit", result.luck + " Luck · " + result.accuracy + " Accuracy · " + result.rolls + "/101 successful rolls");
    const gap = result.targetLuck == null ? 0 : result.targetLuck - result.luck;
    const advice = result.targetLuck == null ? "This goal exceeds the 255 Luck cap at the selected Aim setting." :
      gap > 0 ? "Add " + gap + " Luck to reach " + result.targetLuck + " (" + planCount(Math.ceil(gap / 4), "node") + " at +4 each)." :
      "Hit goal met with the selected Aim.";
    row.append(element("p", "", advice));
    const meter = element("div", "odds-bars");
    for (const [caption, rolls] of [["No Aim", result.noAim], ["5× Aim", result.fullAim]]) {
      const label = element("label", "", caption), bar = element("progress");
      bar.max = 101; bar.value = rolls;
      label.append(bar, element("span", "", (100 * rolls / 101).toFixed(1).replace(/\.0$/, "") + "%"));
      meter.append(label);
    }
    row.append(meter);
    if (result.requiredAim != null && result.requiredAim !== aim)
      row.append(element("p", "field-note", "With current Luck, the goal takes " + planCount(result.requiredAim, "Aim stack") + "."));
    view.list.append(row);
  }
  if (!view.list.childElementCount) view.list.append(entry("Waiting for the party roster"));
  view.list.append(element("p", "field-note", "Normal Attack with clear vision. The forecast assumes no Reflex, Jinx or Luck buffs. In battle, Battle comparison uses the current effects."));
}

function drawCelestialPower(current, view) {
  const members = (current.party || []).filter(m => m.id >= 0 && m.id < 7);
  const selected = members.find(m => m.id === fieldChoices.celestialMember) ||
    members.find(m => m.gear?.some(g => g.celestial && g.type === 0 && g.equipped)) || members[0];
  if (!selected) { view.list.append(entry("Waiting for the party roster")); return; }
  planSelect(view.controls, "Weapon owner", members.map(m => [m.id,catalog.x.party[m.id]]), selected.id, value => {
    fieldChoices.celestialMember = Number(value); planRefresh();
  });
  const weapon = selected.gear?.find(g => g.type === 0 && g.celestial);
  const power = celestialPower(selected);
  const owned = !Array.isArray(selected.gear) ? "Equipment unavailable" : weapon?.equipped ? "Equipped" : weapon ? "In inventory" : "Acquisition preview";
  view.list.append(entry(ffxCelestials[selected.id][0], owned, selected.id === 2 ? "Masamune grows stronger as Auron loses HP. At 70% HP it reaches its base damage." :
    (selected.id === 1 || selected.id === 5 ? "Refill MP" : "Restore HP") + " to bring this weapon back to full power."));
  if (!power) { view.list.append(entry("Waiting for HP or MP")); return; }
  const format = factor => factor.toFixed(2) + "×";
  view.list.append(entry("At current " + power.pool, selected.hp === 0 ? "KO · revive before attacking" : format(power.multiplier) + " physical damage",
    number.format(power.current) + " / " + number.format(power.maximum) + " " + power.pool));
  const band = element("div", "power-bands");
  for (const percent of [0,25,50,75,100]) {
    const value = Math.max(power.pool === "HP" ? 1 : 0, Math.round(power.maximum * percent / 100));
    const hypothetical = {...selected, [power.pool.toLowerCase()]:value};
    const factor = celestialPower(hypothetical).multiplier;
    const label = element("label", "", percent === 0 && power.pool === "HP" ? "1 HP" : percent + "% " + power.pool);
    const bar = element("progress");
    bar.max = selected.id === 2 ? 130 / 60 : 1; bar.value = factor;
    label.append(bar, element("span", "", format(factor)));
    band.append(label);
  }
  view.list.append(band);
  view.list.append(element("p", "field-note", "Weapon strikes bypass Defense. The Armored property still reduces damage unless pierced or broken. Spells and Overdrives use their own rules."));
  if (current.battle && selected.active && selected.hp > 0) view.list.append(action("Compare this character’s attacks", () => {
    battleCompareMember = selected.id; choose("battle-lab");
  }));
}
