"use strict";

const x2ExperimentThresholds = [0,4,10,20,38];
const x2RepairManuals = [
  ["How to Repair with Soul","Djose Temple","Talk to the seated Al Bhed in the room to the left of the stairs after your first win."],
  ["The Spirit of Recycling","Djose Temple · upper floor","Speak to the man in the pedestal room and give the password MARNELA."],
  ["The ABC’s of Repair","Calm Lands · Ruin Depths","Open the chest inside the dungeon reached through the Chocobo Ranch."],
  ["Repairing for Dummies","Djose Temple · exterior","Stand between the three monkeys and press Cross when they jump together."],
  ["Everyman’s Repair Manual","Mi’ihen Highroad","Interact with the machina on the Highroad until you find the one carrying it."]
];

function x2ExperimentStats(experiment) {
  return ["Attack","Defense","Special"].map((name,index) => {
    const [a,s,z] = experiment.parts[index];
    const points = a + 3 * s + 5 * z;
    const level = x2ExperimentThresholds.filter(minimum => points >= minimum).length;
    const next = x2ExperimentThresholds[level];
    return {name, a, s, z, points, level, toNext:next == null ? 0 : next - points, toMax:Math.max(0,38 - points)};
  });
}

function x2ExperimentStep(experiment, chapter) {
  const maxed = x2ExperimentStats(experiment).every(stat => stat.level === 5);
  if (experiment.earlyScene && experiment.maxScene) return ["Both scenes recorded",""];
  if (chapter < 5) return maxed ? ["All three stats are level 5",
    "Check your story flags. The lower-level battle is available only before all three stats are maxed."] :
    ["First fight opens in Chapter 5","Save at least one stat below level 5 until you defeat the earlier form at Djose Temple."];
  if (!experiment.earlyScene) return maxed ? ["Check the lower-level scene",
    "All three stats are level 5. If the earlier win was skipped, the lower-level scene requires an earlier save or another playthrough."] :
    ["Fight the earlier form first","Visit Djose Temple while at least one stat is still below level 5. Then dig for the rematch."];
  return maxed ? ["Ready for the level-5 fight",
    "Bring a repair manual if the Experiment needs rebuilding. Equip Gun Mage before the fight if you still need Annihilator."] :
    ["Dig for the rematch","Each category needs 38 points. Search the yellow marks at Bikanel until Attack, Defense and Special reach level 5."];
}

function showX2Experiment(current) {
  const plan = current.experiment;
  heading("The Experiment", "Djose Temple");
  const [caption,body] = x2ExperimentStep(plan, current.chapter);
  const intro = entry(caption, "", body);
  intro.classList.add("story-hint", "x2-experiment-next");
  intro.classList.toggle("x2-quest-complete", !!plan.earlyScene && !!plan.maxScene);
  panel.append(intro);
  const stats = element("div", "sheet x2-campaign-score x2-experiment-stats");
  for (const stat of x2ExperimentStats(plan)) {
    const row = entry(stat.name, `Level ${stat.level} · ${stat.points} points`,
      stat.toMax ? `${stat.toMax} to max` + (stat.level < 4 ? ` · ${stat.toNext} to next level` : "") : "Maximum level");
    row.classList.add("x2-quest-stat");
    const value = element("progress");
    value.max = 38;
    value.value = stat.points;
    value.setAttribute("aria-label", stat.name + " assembly points");
    const measure = element("div", "x2-quest-measure");
    measure.append(value, element("span", "field-note", `A ${stat.a} · S ${stat.s} · Z ${stat.z}`));
    row.append(measure);
    stats.append(row);
  }
  panel.append(stats, element("p", "field-note x2-quest-note",
    `${plan.digs} successful digs · ${plan.failedDigs} failed · A gives 1 point, S gives 3, Z gives 5.`));
  if (typeof plan.earlyScene === "boolean") {
    const scenes = element("div", "sheet");
    scenes.append(entry("Lower-level battle scene", plan.earlyScene ? "Recorded" : "Unrecorded"),
      entry("Level-5 battle scenes", plan.maxScene ? "Recorded" : "Unrecorded"));
    panel.append(scenes);
  }
  if (plan.earlyScene === false && Number.isInteger(plan.primers)) {
    const warning = plan.primers === 26 ?
      "All primers are collected. The first win can use alternate dialogue that skips this story credit." :
      "For the lower-level story credit, leave at least one primer uncollected until the first win.";
    panel.append(element("p", "field-note x2-quest-note", `Al Bhed primers · ${plan.primers}/26. ${warning}`));
  }
  const tools = element("div", "filters");
  const missing = catalog.x2.party.flatMap((name, id) => Number.isInteger(current.blueBullets?.[id]) &&
    !(current.blueBullets[id] & (1 << 11)) ? [name] : []);
  if (missing.length) {
    const note = "Missing Annihilator · " + missing.join(", ");
    panel.append(element("p", "field-note x2-quest-note", note));
  }
  if (current.oversoul) tools.append(action("Annihilator guide", () => {
    const member = current.party.find(actor => actor.active && actor.job === 0x5002)?.id ?? 0;
    openX2FieldGuide("blue", member, "Annihilator");
  }));
  if (current.calmLands) tools.append(action("Open Ruin Depths route", () => openX2Challenge("ranch", current)));
  panel.append(tools);
  const manuals = element("details", "grid-attributes");
  const manualCount = x2RepairManuals.filter((_, index) => plan.manuals & (1 << index)).length;
  const manualRows = element("div", "sheet");
  x2RepairManuals.forEach(([name,place,tip], index) => {
    const held = !!(plan.manuals & (1 << index));
    const row = entry(name, held ? "In Key Items · " + place : place, tip);
    row.classList.toggle("completed", held);
    manualRows.append(row);
  });
  manuals.append(element("summary", "", `Repair manuals · ${manualCount} held`), manualRows);
  panel.append(manuals);
}
