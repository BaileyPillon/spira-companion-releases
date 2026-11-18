"use strict";

const equipGoals = [
  ["physical","Physical damage"], ["magic","Magic damage"], ["survival","Survival"],
  ["speed","Speed"], ["capture","Fiend capture"], ["ap","AP farming"]
];
let equipGoal = "physical";
let x2AccessorySlot = 0;

const equipAbilityWeights = {
  physical: [/^Strength \+/, /^Piercing$|^Evade & Counter$|^Counterattack$/],
  magic: [/^Magic \+/, /^Magic Booster$|^One MP Cost$|^Half MP Cost$/],
  survival: [/^HP \+|^Defense \+|^Magic Def(?:ense)? \+/, /^Auto-(Protect|Shell|Regen|Phoenix)$|^Ribbon$|proof$/i],
  speed: [/^Agility \+/, /^Auto-Haste$|^First Strike$/],
  capture: [/^Capture$/, /^First Strike$|^Piercing$/],
  ap: [/^(Triple|Double) (AP|Overdrive)$/, /^Overdrive → AP$|^Overdrive -> AP$/]
};

function ffxEquipScore(abilities, goal) {
  const [numeric, bonuses] = equipAbilityWeights[goal];
  const names = abilities.map(id => ffxData.abilities[id]).filter(Boolean);
  if (goal === "capture" && !names.includes("Capture")) return 0;
  if (goal === "ap" && names.some(name => /^Overdrive (?:→|->) AP$/.test(name))) return 100 +
    names.reduce((score, name) => score + (/^Triple /.test(name) ? 15 : /^Double /.test(name) ? 9 : 0), 0);
  return names.reduce((score, name) => score + (numeric.test(name) ? Number(name.match(/\+(\d+)/)?.[1] || 20) :
    bonuses.test(name) ? 16 : 0), 0);
}

function ffxGearChange(member, type, goal) {
  const choices = member.gear.filter(piece => piece.type === type);
  const worn = choices.find(piece => piece.equipped);
  const best = choices.reduce((selected, piece) =>
    ffxEquipScore(piece.abilities, goal) > (selected ? ffxEquipScore(selected.abilities, goal) : 0) ? piece : selected, worn);
  if (!best || best === worn) return {worn, best, gained:[], lost:[]};
  const change = (from, to) => [...new Set(from?.abilities || [])].filter(id => id != null && !to?.abilities.includes(id))
    .map(id => ffxData.abilities[id]).filter(Boolean);
  return {worn, best, gained:change(best,worn), lost:change(worn,best)};
}

function showFfxEquipCompare(current) {
  const controls = element("div", "filters");
  const member = selectMember(current, controls);
  controls.append(options("Optimize for", equipGoals, equipGoal, value => {
    equipGoal = value;
    signature = "";
    render();
  }));
  panel.append(controls);
  if (!member) return;
  const results = element("div", "sheet");
  for (const [type,title] of [[0,"Weapon"], [1,"Armor"]]) {
    const {worn, best, gained, lost} = ffxGearChange(member, type, equipGoal);
    const label = !best ? "No owned match" : best === worn ? "Keep " + gearName(best, member.id) :
      gearName(worn || {type}, member.id) + " → " + gearName(best, member.id);
    const row = entry(title, label);
    if (gained.length) row.append(element("p", "", "Gain " + gained.join(" · ")));
    if (lost.length) row.append(element("p", "", "Give up " + lost.join(" · ")));
    results.append(row);
  }
  panel.append(results, element("p", "field-note", "Use Equip in FFX to make the swaps."));
}

const accessoryStatLabels = ["HP", "MP", "Strength", "Defense", "Magic", "Magic Def.", "Agility", "Accuracy", "Evasion", "Luck"];
const accessoryWeights = {
  physical:[0,0,4,0,0,0,1,2,0,1],
  magic:[0,1,0,0,4,0,1,0,0,0],
  survival:[1,0,0,3,0,3,0,0,2,0],
  speed:[0,0,0,0,0,0,4,0,0,0]
};

function x2AccessoryChange(loadout, member, slot, goal) {
  const worn = member.accessories[slot];
  const other = member.accessories[1 - slot];
  const info = loadout.accessoryInfo;
  const stats = id => info?.[id]?.[2] || Array(10).fill(0);
  const gain = id => stats(id).reduce((score, value, index) => score + value * accessoryWeights[goal][index], 0);
  let best = worn;
  for (const [id, quantity] of loadout.accessories) {
    if (quantity > 0 && id !== other && gain(id) > gain(best)) best = id;
  }
  return {worn, best, delta:stats(best).map((value,index) => value - stats(worn)[index])};
}

function showX2EquipCompare(loadout, member) {
  if (!loadout.accessoryInfo?.some(row => row?.[2])) return;
  const details = element("details", "grid-attributes");
  details.append(element("summary", "", "Compare accessories"));
  const controls = element("div", "filters");
  const sheet = element("div", "sheet");
  let goal = Object.hasOwn(accessoryWeights, equipGoal) ? equipGoal : "physical";
  controls.append(options("Accessory to replace", [[0,"Replace accessory 1"],[1,"Replace accessory 2"]],
    x2AccessorySlot, value => { x2AccessorySlot = Number(value); draw(); }),
    options("Optimize for", equipGoals.filter(([id]) => Object.hasOwn(accessoryWeights,id)),
      goal, value => { goal = value; draw(); }));
  details.append(controls, sheet);
  panel.append(details);
  function draw() {
    const {worn, best, delta} = x2AccessoryChange(loadout, member, x2AccessorySlot, goal);
    const name = id => loadout.accessoryInfo[id]?.[0] || "Empty slot";
    const row = entry(best === worn ? (worn == null ? "No stat upgrade in stock" : "Keep " + name(worn)) :
      name(worn) + " → " + name(best));
    if (best !== worn) {
      const changes = delta.flatMap((value, index) => value ?
        [accessoryStatLabels[index] + " " + (value > 0 ? "+" : "") + value + (index < 2 ? "%" : "")] : []);
      row.append(element("p", "detail", changes.join(" · ")));
      if (loadout.accessoryInfo[best]?.[1]) row.append(element("p", "", "New effect · " + loadout.accessoryInfo[best][1]));
      if (loadout.accessoryInfo[worn]?.[1]) row.append(element("p", "", "Current effect · " + loadout.accessoryInfo[worn][1]));
    }
    row.append(element("p", "field-note", "Ranked by base stat bonuses in your spare accessories. Check the effects before equipping."));
    sheet.replaceChildren(row);
  }
  draw();
}
