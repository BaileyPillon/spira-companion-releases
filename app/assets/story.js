"use strict";

const ffxAirshipHints = {
  194: "Speak to Cid on the bridge, then take the corridor toward the deck.",
  211: "Leave the cabin and follow the corridor toward the deck.",
  265: "Follow the corridor toward the deck. Use the save sphere before going outside.",
  277: "Defeat Evrae to reach Bevelle. Tidus and Rikku can ask Cid to change the ship’s distance.",
  351: "Follow the corridor and take the lift to the deck."
};

const ffxRouteHints = [
  [/^Zanarkand.*(Stadium|Overpass|Highway)/i, "Follow Auron away from the stadium."],
  [/^Baaj/i, "Search the ruins for shelter. Check the debris and nearby rooms for supplies."],
  [/^Besaid Village|^Besaid · Village/i, "Visit the temple and speak to the villagers to advance the pilgrimage."],
  [/^Besaid · (Crossroads|Valley|Ancient Road|Waterfall Way|Promontory)/i, "Follow the path between Besaid Village and the port. The ferry departs from the port."],
  [/^Kilika (Forest|Woods)|^Kilika · Pilgrimage Road/i, "Follow the forest paths uphill to the temple."],
  [/^Luca ·|^Stadium ·/i, "Check the stadium and the docks. The exit toward Mi’ihen Highroad is through Luca’s main gate."],
  [/^Highroad|^Mi.hen/i, "Follow the Highroad north toward Mushroom Rock. The agency is a good place to restock."],
  [/^Mushroom Rock/i, "Use the lifts to reach the ridge and follow the route toward the command center."],
  [/^Djose/i, "The pilgrimage continues at Djose Temple. The road beyond it leads to the Moonflow."],
  [/^Moonflow/i, "The shoopuf connects the south and north banks. The road from the north bank leads to Guadosalam."],
  [/^Guadosalam/i, "Visit Seymour’s manor and the Farplane. The uphill passage leads to the Thunder Plains."],
  [/^Thunder Plains/i, "Use the lightning towers for cover and continue toward Macalania. The agency is between the two halves."],
  [/^Macalania Woods/i, "Follow the forest path toward the lake. The save sphere by the lake road is a useful stop."],
  [/^Lake Macalania|^Macalania · Road/i, "The temple is beyond the agency. Follow the path around the lake."],
  [/^Bikanel|^Sanubia|^Oasis/i, "Follow the path through the desert toward Home. Check the signs for safer routes."],
  [/^Home ·/i, "Follow the Al Bhed through Home and make for the airship dock."],
  [/^Bevelle · (Main Gate|Tower of Light)/i, "Push through the guards and follow the route into Bevelle."],
  [/^Bevelle · (Via Purifico|The Two Fates)/i, "Follow the passages to regroup with the rest of the party."],
  [/^Calm Lands/i, "Cross the plains toward the northeast gorge to reach Mt. Gagazet."],
  [/^Gagazet/i, "Follow the mountain trail through the summit and into the cave toward Zanarkand."],
  [/^Zanarkand|^Dome/i, "Follow the ruins to the Dome. Use the lit panels and floor symbols in the trial rooms."],
  [/^Inside Sin|^Sin ·|^Sea of Sorrow/i, "Follow the path toward the Tower of the Dead. Use save spheres to prepare for the next fight."]
];

const x2ChapterHints = [
  "",
  "Check the hot spots on the Celsius bridge. The opening sphere hunt leads to Mt. Gagazet, then Besaid and Zanarkand.",
  "Speak to Brother on the Celsius bridge about the Awesome Sphere. Check the bridge for the next mission after choosing where to return it.",
  "Check the hot spots on the Celsius bridge for fiend outbreaks. Complete the active missions at the temples to advance.",
  "Talk to Shinra aboard the Celsius and check the CommSphere reports as the concert preparations advance.",
  "Check the Celsius bridge for remaining missions. When you’re ready for the finale, choose a route into the Farplane."
];

function storyHint(current) {
  if (!current.disc) return "";
  if (current.game === "x2") {
    if (current.room === 311 && (!current.chapter || current.chapter === 1)) {
      return current.battle ? "Use Attack to take out the goons first. Use a Potion if Rikku or Paine is low on HP." :
        "Follow the performance through the opening sequence, then fend off the guards with Rikku and Paine.";
    }
    if (current.room === 185 && (!current.chapter || current.chapter === 1)) {
      return current.battle ? "Focus Rikku and Paine on the same goon to cut down the number of attacks coming at you." :
        "Follow the others through the docks to catch up with the impostor.";
    }
    if (current.battle) return "";
    if (current.room === 221 && current.chapter === 5) return "Hold the jump button as you cross the gaps. Follow the ledges deeper toward the Farplane.";
    if (current.room === 179 && current.chapter === 1 && !current.battle) {
      return "Use the save sphere by the ledge, then climb through the Spire. Hold the jump button when you approach a gap.";
    }
    return x2ChapterHints[current.chapter] || "";
  }
  if (current.battle) return "";
  if (current.story >= 2000 && current.story <= 2040 && ffxAirshipHints[current.room]) {
    return ffxAirshipHints[current.room];
  }
  if (/^Airship/.test(roomName(current)) && current.story > 2040) {
    return "Speak to Cid on the bridge to review your current destination.";
  }
  const room = roomName(current);
  return ffxRouteHints.find(([pattern]) => pattern.test(room))?.[1] || "";
}

function evraeAdvice(current, foe) {
  const rikku = current.party.find(member => member.id === 6);
  const party = current.party.filter(member => member.active);
  const itemCount = id => current.items.find(entry => entry?.[0] === id)?.[1] ?? 0;
  const potions = itemCount(0x2014);
  const canUse = rikku?.active && rikku.hp > 0 && !(rikku.statusBits & 0x304) && !(rikku.statusTimed & 1);
  const danger = party.some(member => member.hp > 0 &&
    (member.hp * 3 <= member.maxHp || (member.statusBits & 0x0c)));
  if (danger && canUse && potions && !party.some(member => member.hp > 0 && (member.statusBits & 2))) {
    return ["Use an Al Bhed Potion", "Rikku can heal the front line and clear poison or petrification."];
  }
  if (rikku?.active && rikku.hp === 0 && itemCount(0x2006)) {
    return ["Revive Rikku", "Use a Phoenix Down to get your healer back."];
  }
  if (rikku?.active && (rikku.statusBits & 4) && (itemCount(0x200b) || itemCount(0x200f))) {
    return ["Cure Rikku’s petrification", "Restore your healer with a Soft or Remedy."];
  }
  if (canUse && rikku.overdriveMax > 0 && rikku.overdrive === rikku.overdriveMax && itemCount(0x206e) >= 2) {
    const remaining = Math.max(0, foe.hp - 19998);
    return ["Mix Sunburst", "Rikku can mix two Underdog’s Secrets. " +
      (remaining ? `19,998 damage leaves ${number.format(remaining)} HP.` : "19,998 damage can finish Evrae.")];
  }
  const cid = current.enemies?.find(actor => actor.id === 149);
  const [acting, ...upcoming] = current.turnOrder || [];
  if (cid && [0, 6].includes(acting)) {
    const enemyTurn = upcoming.indexOf(foe.battleId);
    const cidTurn = upcoming.indexOf(cid.battleId);
    if (enemyTurn >= 0 && cidTurn >= 0) {
      return cidTurn < enemyTurn ?
        ["Cid moves before Evrae", "If Evrae has inhaled, use Trigger Command → Pull Back now."] :
        ["Evrae acts before Cid", "If Evrae has inhaled, heal or defend. Cid can’t move the ship before that turn."];
    }
  }
  if (foe.statusTimed & (1 << 11)) {
    return ["Evrae has Haste", "Keep Rikku healing and let Wakka attack from either range."];
  }
  return ["Watch for Poison Breath", "If Evrae inhales, order Pull Back with Rikku or Tidus when Cid can act before Evrae."];
}

function ffxBossAdvice(current, foe) {
  if ((foe.id === 130 || foe.id === 142) && typeof phasePriority === "function") {
    const priority = phasePriority(current, foe.id === 130 ? "yunalesca" : "flux", foe);
    if (priority) return priority;
  }
  const active = current.party.filter(member => member.active && member.hp > 0);
  switch (foe.id) {
    case 119: return evraeAdvice(current, foe);
    case 120: {
      const count = current.items.find(([id]) => id === 0x2006)?.[1] || 0;
      return count >= 2 ? ["Use Phoenix Downs on Evrae Altana", "Altana is undead. Two Phoenix Downs defeat it from full HP."] :
        ["Healing hurts Evrae Altana", "Target the undead boss with recovery items. Conserve Phoenix Downs if you only have one."];
    }
    case 126: return ["Focus on Seymour Natus", "Poison can help drain his HP. When Mortibody runs out of HP, it takes more from Seymour."];
    case 129: {
      const keeperTurn = (current.turnOrder || []).slice(1).indexOf(foe.battleId);
      return keeperTurn === 0 ? ["Spectral Keeper acts next", "If a platform has a Glyph Mine, use Move to leave it. Keep the party outside the boss’s front arc."] :
        ["Spread out on the platforms", "Use Move to avoid the front arc and any Glyph Mines. Cure Berserk so allies can move."];
    }
    case 142: return active.some(member => member.statusBits & 2) ?
      ["Cure Zombie before Full-Life", "Use Holy Water or Remedy on zombified allies. Seymour Flux can follow Lance of Atrophy with Full-Life."] :
      ["Prepare for Total Annihilation", "Use Shell and heal the front line. If Seymour starts charging, defend or summon an aeon to take the attack."];
    case 130: return active.some(member => member.statusBits & 2) ?
      ["Keep one ally zombified", "Zombie protects that ally from Mega Death. Use recovery spells on allies without Zombie."] :
      ["Plan for Mega Death", "Keep at least one ally zombified by Hellbiter before pushing Yunalesca into her final form."];
    default: return null;
  }
}

let battleReferenceOpen = false;

function showStoryHint(current, host = panel, compact = false) {
  const boss = current.game === "x" && current.battle && current.enemies?.find(foe =>
    [119,120,126,129,130,142].includes(foe.id) && foe.hp > 0);
  if (boss) {
    const box = element(compact ? "details" : "aside", "story-hint encounter-guide");
    if (compact) {
      box.open = battleReferenceOpen;
      box.addEventListener("toggle", () => { if (box.isConnected) battleReferenceOpen = box.open; });
    }
    const id = boss.id === 129 && boss.maxHp === 60000 ? 130 : boss.id;
    const [title, detail] = ffxBossAdvice(current, {...boss, id});
    const heading = element(compact ? "summary" : "div", "encounter-heading");
    const name = {119:"Evrae",120:"Evrae Altana",126:"Seymour Natus",129:"Spectral Keeper",130:"Yunalesca",142:"Seymour Flux"}[id];
    heading.append(element("h2", "", name), metric("HP", boss.hp, boss.maxHp));
    if (compact) heading.append(element("span", "encounter-disclosure", "Fight details"));
    box.append(heading, element("strong", "", title), element("p", "", detail));
    if (title === "Mix Sunburst" && current.disc) {
      box.append(action("Sunburst recipes", () => choose("mix", "Sunburst")));
    }
    if (current.grid && id === 119) box.append(action("Evrae armor plan", () => openPrep("evrae")));
    if (current.disc === "SLPS-25088" && (id === 130 || id === 142)) {
      box.append(action("Story boss coach", openLiveBossCoach));
    }
    host.append(box);
    return;
  }
  if (current.grid && current.battle && showPrepEncounter(current)) return;
  const hint = typeof fieldObjective === "function" ? fieldObjective(current) : storyHint(current);
  if (!hint) return;
  const box = element("aside", "story-hint");
  box.append(element("strong", "", current.battle ? "Battle tip" : "Story hint"), element("p", "", hint));
  host.append(box);
}
