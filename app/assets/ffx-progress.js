"use strict";

const homeRooms = [130, 219, 275, 276, 280, 286, 303];
const bevellePassage = [180, 181, 182];
const besaidVillage = [17, 83, 100, 133, 337, 386];
const zanarkandTreasureStory = 2900;
const winnoDecks = [94,302];
const airshipDestinations = [
  [0,"Baaj Temple","X14, Y57","Anima’s temple and the hidden Onion Knight."],
  [2,"Omega Ruins","X72, Y35","Omega Weapon, rare items and Monster Arena captures."],
  [7,"Besaid Falls","X31, Y75","Dragoon Lance for Kimahri."],
  [8,"Mi’ihen Ruins","X35, Y57","Sonar for Rikku."],
  [9,"Battle Site","X41, Y57","Phantom Bangle for Lulu."],
  [10,"Sanubia Sands","X15, Y42","Ascalon for Tidus, with Double AP."],
  [5,"Mushroom Rock","GODHAND","Bring the Celestial Mirror to open Rikku’s weapon chest."],
  [4,"Besaid Ruins 1","VICTORIOUS","Victorious armor for Rikku."],
  [6,"Besaid Ruins 2","MURASAME","Murasame for Auron."]
];

function airshipDiscoveryRows(bits) {
  return airshipDestinations.map(([bit,name,code,detail]) => ({
    name, code, detail, discovered: Number.isInteger(bits) ? !!(bits & (1 << bit)) : null
  }));
}

function showAirshipSecrets(current, overview, sheet) {
  const rows = airshipDiscoveryRows(current.progress.destinations);
  const count = rows.filter(row => row.discovered).length;
  const status = Number.isInteger(current.progress.destinations) ? `${count}/9 locations unlocked.` : "Waiting for destination flags.";
  overview.append(element("p", "field-note", status + (current.story >= 2900 ?
    " Talk to Cid on the bridge. Use Search for coordinates or Input for passwords." :
    " These options become available when you have free use of the airship.")));
  for (const row of rows) {
    if (collectionMissingOnly && row.discovered) continue;
    const state = row.discovered ? "Unlocked" : row.discovered === false ? "Undiscovered" : "Unknown";
    const item = entry(row.name, `${row.code} · ${state}`, row.detail);
    item.classList.toggle("completed", row.discovered === true);
    if (row.name === "Baaj Temple") item.append(action("Anima treasures", () => choose("collections", "anima")));
    if (row.name === "Omega Ruins") item.append(action("Omega captures", () => setArenaRegion("Omega Ruins")));
    sheet.append(item);
  }
  if (!sheet.childElementCount) sheet.append(entry("All secret destinations unlocked"));
}
const ffxMissables = [
  {name:"Al Bhed Primer XIX", group:"Home", rooms:homeRooms, primer:19, permanent:true, past:c => c.story >= 2000,
    detail:"Pick it up by the Save Sphere outside Home’s front entrance. Home is destroyed after the escape aboard the Fahrenheit."},
  {name:"Al Bhed Primer XX", group:"Home", rooms:homeRooms, primer:20, permanent:true, past:c => c.story >= 2000,
    detail:"After the forced hallway fight, go back up the stairs and enter the door on the left. Pick up the primer on the bed in the Living Quarters before Home is destroyed."},
  {name:"Al Bhed Primer XXI", group:"Home", rooms:homeRooms, primer:21, permanent:true, past:c => c.story >= 2000,
    detail:"At the three-way split in Home’s Main Corridor, take the right branch and check the floor at its far end before heading to the airship."},
  {name:"Al Bhed Primer XXII", group:"Bevelle", rooms:[205, 208, 330, ...bevellePassage], primer:22, permanent:true,
    past:c => c.story > 2220 || (c.story > 2040 &&
      [226, 227, 306, 390, 287, 198, 209, 253, 305, 195, 339].includes(c.room)),
    detail:"After the wedding, go down the spiral lift and stairs to the Priests’ Passage. Look to the right of the stairs by the Save Sphere before starting Bevelle’s Cloister of Trials."},
  {name:"Wantz’s four-slot shop", group:"Mt. Gagazet", rooms:[244, 259, 383], flag:"wantz", permanent:true,
    past:c => c.story >= 2635,
    detail:"Speak to Wantz on Gagazet’s Mountain Trail during the first ascent, before continuing to Seymour Flux. After the Highbridge visit, he sells empty four-slot gear at the Thunder Plains entrance to Macalania Woods South."},
  {name:"Besaid Destruction Sphere treasure", group:"Besaid", rooms:[...besaidVillage, 42, 84, 103, 117, 122], trial:0, gate:"darkValefor",
    detail:"Insert the Destruction Sphere in the recess revealed by the Besaid Sphere and open the Rod of Wisdom chest. It counts toward Anima. Dark Valefor guards the village after the escape from Bevelle."},
  {name:"Jecht Sphere in Besaid", group:"Besaid", rooms:[...besaidVillage, 221, 241, 242, 248, 338], gate:"darkValefor", jecht:0,
    detail:"After beating Spherimorph, backtrack through Luca and take the ferries to Besaid before continuing to Lake Macalania. The sphere is beside the temple entrance. Dark Valefor guards the village after Bevelle."},
  {name:"Macalania Destruction Sphere treasure", group:"Macalania", rooms:[80, 106, 153, 239, 284],
    trial:3, gate:"darkShiva", detail:"Rebuild the ice bridge, send the pedestal down the slope to obtain the Destruction Sphere, then open the Luck Sphere chest on the lower floor. It counts toward Anima. Dark Shiva blocks the temple on a later return."},
  {name:"Kilika Destruction Sphere treasure", group:"Kilika", rooms:[108, 118, 166], trial:1,
    detail:"Use the Destruction Sphere in the recess revealed when you put the Glyph Sphere in the wall. Open the Red Armlet chest before leaving to record Kilika’s seal for Anima."},
  {name:"Djose Destruction Sphere treasure", group:"Djose", rooms:[214, 245], trial:2,
    detail:"After opening the upstairs path, go back downstairs and touch the glowing glyph on the left wall. Carry the Destruction Sphere upstairs to the center pedestal, then open the Magic Sphere chest for Anima."},
  {name:"Bevelle Destruction Sphere treasure", group:"Bevelle", rooms:[], trial:4,
    detail:"Collect the HP Sphere on the required route out of the Cloister. The Knight Lance is optional."},
  {name:"Zanarkand Destruction Sphere treasure", group:"Zanarkand Dome", rooms:[319, 320], trial:5,
    detail:"Return after getting the airship. Light all seven white squares across both rooms, then place the revealed Destruction Sphere beside the large monitor to collect the Magistral Rod and complete Zanarkand’s seal for Anima."},
  {name:"Sun Crest", group:"Zanarkand Dome", rooms:[197, 270, 318], key:0x23, gate:"darkBahamut",
    detail:"After beating Yunalesca, walk down the far staircase to make the Sun Crest chest appear. Open it in Yunalesca’s chamber before leaving. Dark Bahamut guards that room on your return."}
];

function earlyPickupReminders(current) {
  if (current.disc !== "SLPS-25088" || current.battle) return [];
  if (winnoDecks.includes(current.room) && !(current.progress?.blitzball?.techniques?.[0]?.[0] & 2)) return [{
    name:"Jecht Shot", group:"S.S. Winno",
    detail:"Check the blitzball on deck. Clear the directional prompts to learn Jecht Shot. If you miss it, you can try again on a later crossing."
  }];
  if ([...besaidVillage,69,144].includes(current.room) && current.story <= 2220) return [{
    name:"Valefor’s Energy Blast", group:"Besaid",
    detail:"Once Yuna is traveling with the party, ask the shopkeeper about her dog and talk to it for Valefor’s second Overdrive. It’s easier to get before Dark Valefor blocks the village."
  }];
  return [];
}

function ffxBit(hex, bit) {
  return !!(parseInt((hex || "").slice((bit >> 3) * 2, (bit >> 3) * 2 + 2), 16) & (1 << (bit & 7)));
}

function missableState(current, record) {
  const progress = current.progress;
  const collected = record.primer ? !!(progress.primers & (1 << (record.primer - 1))) :
    record.key ? ffxBit(progress.keyItems, record.key) :
    record.jecht != null ? !!(progress.jechtSpheres & (1 << record.jecht)) :
    record.trial != null ? !!(progress.trials & (1 << record.trial)) :
    record.flag ? progress[record.flag] : false;
  if (collected) return "Collected";
  if (record.past?.(current)) return "Pickup window closed";
  if (record.gate && progress[record.gate]) return "Guardian defeated · can revisit";
  if (record.rooms.includes(current.room) && !(record.name === "Jecht Sphere in Besaid" && current.story < 1500) &&
    !(record.trial === 5 && current.story < zanarkandTreasureStory)) return "Check now";
  return record.permanent ? "One-time pickup" : record.gate && current.story > 2220 ?
    "Dark Aeon can block the return" : "Harder to revisit";
}

function animaTreasures(current) {
  if (!Number.isInteger(current.progress?.trials)) return [];
  const temples = [
    ["Rod of Wisdom", "Left · nearest the seal", "Dark Valefor"],
    ["Red Armlet", "Right · nearest the entrance"],
    ["Magic Sphere", "Right · middle"],
    ["Luck Sphere", "Left · middle", "Dark Shiva"],
    ["HP Sphere", "Right · nearest the seal"],
    ["Magistral Rod", "Left · nearest the entrance"]
  ];
  return ffxMissables.filter(record => record.trial != null).sort((a,b) => a.trial - b.trial).map(record => {
    const [reward, statue, guardian] = temples[record.trial];
    const done = Boolean(current.progress.trials & (1 << record.trial));
    const state = done ? "Chest opened" :
      guardian && current.story > 2220 && !current.progress[record.gate] ? guardian + " guards the return" :
      record.trial === 4 ? "Required during the story" :
      record.trial === 5 && current.story < zanarkandTreasureStory ? "Return after getting the airship" :
      record.rooms.includes(current.room) ? "Check this area" : "Chest still needed";
    return {name:record.group, place:reward, detail:record.detail, statue, done, state};
  });
}

let focusedMissable = null;

function showMissables(current, nearbyOnly = false) {
  if (!current.progress || (nearbyOnly && current.battle)) return;
  const relevant = ffxMissables.filter(record => record.trial !== 4 && (!nearbyOnly || record.rooms.includes(current.room)))
    .map(record => [record, missableState(current, record)])
    .filter(([,state]) => !nearbyOnly || state === "Check now");
  const reminders = nearbyOnly ? earlyPickupReminders(current) : earlyPickupReminders(current)
    .filter(record => record.name === focusedMissable);
  for (const record of reminders) relevant.push([record,"Optional reminder"]);
  if (nearbyOnly && !relevant.length) return;
  if (!nearbyOnly) {
    const count = ffxMissables.filter(record => record.primer && (current.progress.primers & (1 << (record.primer - 1)))).length;
    heading("Missables", count + " / 4 one-time primers in your language collection");
    panel.append(element("p", "field-note", "An Al Bhed Compilation Sphere can import volumes from another save. The pickup locations still close when their story sections end."));
    const actions = element("div", "filters");
    actions.append(action("Anima temple treasures", () => choose("collections", "anima")));
    panel.append(actions);
  } else {
    const toolbar = element("div", "section-heading");
    toolbar.append(element("h2", "", "Check before leaving"), action("All missables", () => choose("missables")));
    panel.append(toolbar);
  }
  const sheet = element("div", "sheet guide-list");
  const priority = ([record,state]) => record.name === focusedMissable ? 2 : Number(state === "Check now");
  const rows = nearbyOnly ? relevant : relevant.sort((a,b) => priority(b) - priority(a));
  for (const [record,state] of rows) sheet.append(entry(record.name, record.group + " · " + state, record.detail));
  panel.append(sheet);
}

function ffxExitGate(current, destination) {
  if (!current.progress || current.story <= 2220) return "";
  if (current.room === 69 && besaidVillage.includes(destination) && !current.progress.darkValefor) return "Dark Valefor guards this route";
  if ([153, 106].includes(current.room) && [80, 106, 239].includes(destination) && !current.progress.darkShiva) return "Dark Shiva guards this route";
  return "";
}

const ffxRoomRoutes = {
  69: [[17, "Village gate"], [20, "Path to the crossroads"]],
  205: [[180, "Up the tower stairs and down the spiral lift"]],
  180: [[306, "At the end of the Priests’ Passage"]],
  181: [[306, "At the end of the Priests’ Passage"]],
  182: [[306, "At the end of the Priests’ Passage"]],
  276: [[280, "Through Home’s main entrance"]],
  280: [[275, "Living Quarters · door at the top of the stairs"],
    [219, "Environment Controls · door near the right branch"]],
  303: [[194, "Board the Fahrenheit to leave Home"]]
};

function fieldDestinations(current, exits) {
  if (current.game !== "x" || current.battle) return [];
  return (ffxRoomRoutes[current.room] || []).filter(([room]) => !exits.some(exit =>
    exit.room === room || roomName({game:"x",room:exit.room}) === roomName({game:"x",room})));
}

function fieldObjective(current) {
  if (current.game !== "x" || current.battle) return storyHint(current);
  if (homeRooms.includes(current.room)) return "Find the summoners in Home, then escape with Cid through the airship dock.";
  if ([205, 208, 330].includes(current.room)) return "Cross Bevelle’s Tower of Light and stop Seymour’s wedding. Take the spiral lift to the temple afterward.";
  if (bevellePassage.includes(current.room)) return "Follow the priests’ passage into Bevelle’s Cloister of Trials.";
  if (current.room === 306) return "Ride the glyph platforms to the far end of Bevelle’s Cloister of Trials.";
  if ([244,383].includes(current.room) && current.story < 2635) {
    return current.progress?.wantz ? "Climb Gagazet toward Seymour Flux." : "Climb Gagazet toward Seymour Flux. Speak to Wantz along the trail.";
  }
  if (current.room === 197) return "After defeating Yunalesca, collect the Sun Crest before leaving her chamber.";
  return storyHint(current);
}
