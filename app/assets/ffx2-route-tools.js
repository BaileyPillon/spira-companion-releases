"use strict";

// Scene numbers index the USA voice flag table. These scenes can survive New Game Plus.
const mascotRegions = [
  ["Zanarkand", [445], "Pair the monkeys in Chapter 2 or 3. Visit Isaaru at the ruins in Chapter 5. Do this stop early so your final episode can return you to the Celsius."],
  ["Besaid", [394,398], "Check in on Wakka, say goodbye to Beclem at the beach, then bring the War Buddy sphere back to Wakka. Follow him to the village for the naming ceremony."],
  ["Kilika", [358,359,403], "Follow Dona and Barthello’s balloon messages on both Chapter 4 cameras. In Chapter 5, take the pilgrimage road toward the temple to see their reunion."],
  ["Luca", [466,467], "From the Save Sphere below the Highroad stairs, approach the overlook and follow the moogle through town to Dock 2."],
  ["Mi’ihen Highroad", [468], "Help Rin investigate through the Chapter 4 cameras. Visit the travel agency for the reveal. Rikku, Calli or the Chocobo Eater can give the Complete ending."],
  ["Mushroom Rock Road", [427,428], "If you backed the Youth League, enter the tournament and defeat Lucil. On the New Yevon route, visit Yaibal at the lift."],
  ["Djose", [431,433], "Dig for assemblies in Bikanel. Return to Djose and defeat the Experiment with Attack, Defense and Special all at level 5."],
  ["Moonflow", [435], "Help Tobli with his cargo and ticket sales in the early chapters. Meet him on the south bank in Chapter 5 for his show."],
  ["Guadosalam", [405,407], "Reunite the Macalania musicians and stop Garik’s attack. When the Guado return, speak to Tromell near the musicians."],
  ["Thunder Plains", [436,438], "Defeat Humbaba, enter the new cave and rescue Cid by defeating Machina Panzer."],
  ["Macalania", [439,440], "Visit the spring near the travel agency, then the spring where Yuna and Tidus met. Walk into the clearing for Yuna’s farewell."],
  ["Bikanel", [420,421], "Bring home the ten Cactuar gatekeepers, finish Cactuar Hollow, then defeat Angra Mainyu at the excavation camp."],
  ["Bevelle", [386,387,450], "Use Zanarkand’s Chapter 4 camera to hear Isaaru. In Chapter 5 go to New Yevon headquarters and look for Isaaru in Maroda’s scene."],
  ["Calm Lands", [442], "Reach 400 publicity points with either company and visit the central Calm Lands. You can still earn publicity in Chapter 5."],
  ["Mt. Gagazet", [412,415], "Help Lian and Ayde and stop Garik in Chapter 3. Return to Kimahri, then find him and Garik along the mountain trail."]
];
const episodeOutcomes = [["", "Unchecked"], ["complete", "Episode Complete"], ["concluded", "Episode Concluded"]];

function routeNotesKey(current, name) {
  return planKey(name + "." + fieldContext(current) + (sample ? ".sample" : ""));
}
function drawMascotBoard(current, view) {
  const key = routeNotesKey(current, "mascot");
  const marks = readCompanionSetting(key, {}) || {};
  const scenes = x2SceneAudit(current);
  const owned = new Map(current.loadout?.dresspheres || []).get(0x500e) > 0;
  const count = mascotRegions.filter(([region]) => marks[region] === "complete").length;
  const concluded = mascotRegions.filter(([region]) => marks[region] === "concluded").length;
  const summary = entry(count + "/15 regions confirmed", concluded ? planCount(concluded, "region") + " marked Episode Concluded" : "Chapter " + current.chapter,
    "Use the outcome shown on the Celsius destination map. Your marks belong to this companion profile. Scene flags and dresspheres can carry into New Game Plus.");
  if (owned) summary.append(element("p", "field-note", "Mascot is in your loaded inventory."));
  if (scenes?.[486].done) summary.append(element("p", "field-note", "The save has recorded the Mascot award scene."));
  if (count === 15 && !owned) summary.append(element("p", "", "Return to the Celsius bridge after the final episode to check for the award."));
  view.list.append(summary);
  planSelect(view.controls, "Show regions", [["open","Still to confirm"],["all","All regions"],["concluded","Episode Concluded"]], fieldChoices.mascotFilter || "open", value => {
    fieldChoices.mascotFilter = value; planRefresh();
  });
  let visible = 0;
  for (const [region, indices, route] of mascotRegions) {
    const mark = episodeOutcomes.some(([v]) => v === marks[region]) ? marks[region] : "";
    if ((fieldChoices.mascotFilter || "open") === "open" && mark === "complete" || fieldChoices.mascotFilter === "concluded" && mark !== "concluded") continue;
    visible++;
    const detail = element("details", "planner-config");
    detail.dataset.detailKey = "mascot-" + region;
    detail.append(element("summary", "", region + " · " + episodeOutcomes.find(([v]) => v === mark)[1]), element("p", "", route));
    if (region === "Calm Lands" && current.calmLands)
      detail.append(element("p", "field-note", "Open Air " + current.calmLands.openAir + "/400 · Argent " + current.calmLands.argent + "/400"));
    if (scenes) {
      const groups = x2GroupSceneChecks(indices.map(i => scenes[i]));
      for (const g of groups) detail.append(element("p", "field-note", (g.flags.some(s => s.done) ? "Scene recorded · " : "No matching flag recorded · ") + g.name));
    } else detail.append(element("p", "field-note", "Scene flags unavailable for this save."));
    const outcome = planSelect(detail, region + " outcome", episodeOutcomes, mark, value => {
      const next = {...marks};
      if (value) next[region] = value; else delete next[region];
      if (!saveCompanionSetting(key, next)) { view.message.textContent = "Could not save this outcome."; outcome.value = mark; return; }
      planRefresh();
    });
    view.list.append(detail);
  }
  if (!visible) view.list.append(entry("No regions match this filter"));
}

const besaidDoors = {
  entrance: {
    name:"Cave entrance",
    rooms:[125,120,120,123],
    route:"During Where’s Wakka?, examine each red map marker. At the crossroads, enter the digits in keypad order.",
    digits:[
      ["Promontory", "Inspect the stone marker overlooking the village."],
      ["Beach · far end", "Climb the marked ruins at the far southwest end of the beach."],
      ["Beach · entrance cliff", "Turn left as you enter the beach. Climb toward the person on the cliff and inspect the red marker."],
      ["Ancient Road", "Climb the broken pillar on the right and examine its top. This is the fourth slot even if you find it second."]
    ]
  },
  inner: {
    name:"Search Sphere door",
    rooms:[127,126,124,122],
    route:"Use the Besaid Key on the chest in the temple’s side chamber. The Chapter 3 tourist rescue offers a free route to the key. Hold Circle to search, press X at the red signal, then use R1 to zoom. Open the panel inside the cave to reach Raging Giant.",
    digits:[
      ["Village · temple roof", "Dig between the western buildings. Point the camera up at the temple roof."],
      ["Village Slope · ridge", "Search near the fence below the Save Sphere. Scan the distant ridge above the slope."],
      ["Waterfall Way · falls", "Search near the approach to the first bridge. Zoom in at the waterfall."],
      ["Valley overlook · treetop", "Find the buried camera at the overlook. Zoom in on the lone tree across the valley."]
    ]
  }
};

function cipherSlots(notes) {
  return Array.from({length:4}, (_, i) => {
    const slot = notes?.[i];
    return {digit:typeof slot?.digit === "string" && /^[0-9]$/.test(slot.digit) ? slot.digit : "", unsure:slot?.unsure === true};
  });
}

function drawBesaidCiphers(current, view) {
  const doorId = fieldChoices.besaidDoor || (current.chapter > 1 ? "inner" : "entrance"), door = besaidDoors[doorId];
  const key = routeNotesKey(current, "besaid." + doorId);
  const slots = cipherSlots(readCompanionSetting(key, []));
  planSelect(view.controls, "Cipher door", Object.entries(besaidDoors).map(([id,d]) => [id,d.name]), doorId, value => {
    fieldChoices.besaidDoor = value; planRefresh();
  });
  const count = slots.filter(s => s.digit).length, unsure = slots.filter(s => s.digit && s.unsure).length;
  const code = slots.map(s => s.digit || "·").join(" ");
  const summary = entry(door.name, code, count + "/4 digits recorded" + (unsure ? " · " + planCount(unsure,"digit") + " to recheck" : ""));
  summary.classList.add("cipher-readout");
  view.list.append(summary, element("p", "", door.route));
  if (doorId === "inner" && current.loadout?.grids?.includes(25))
    view.list.append(element("p", "field-note", "Your save already owns the Raging Giant Garment Grid."));
  for (const [i, [location, clue]] of door.digits.entries()) {
    const row = entry((i + 1) + ". " + location, door.rooms[i] === current.room ? "In your current area" : "", clue);
    const select = planSelect(row, "Digit " + (i + 1), [["","Unknown"], ...Array.from({length:10}, (_,n) => [n,String(n)])], slots[i].digit, digit => {
      const next = slots.slice(); next[i] = {digit, unsure:!!digit && slots[i].unsure};
      if (saveCompanionSetting(key, next)) planRefresh();
      else { select.value = slots[i].digit; view.message.textContent = "Could not save this digit."; }
    });
    if (slots[i].digit) {
      const label = element("label", "goal-choice", "Recheck this digit"), box = element("input");
      box.type = "checkbox"; box.checked = slots[i].unsure; box.setAttribute("aria-label", "Recheck digit " + (i + 1));
      box.addEventListener("change", () => {
        const next = slots.slice(); next[i] = {...slots[i], unsure:box.checked};
        if (saveCompanionSetting(key, next)) planRefresh();
        else { box.checked = slots[i].unsure; view.message.textContent = "Could not save this mark."; }
      });
      label.prepend(box); row.append(label);
    }
    view.list.append(row);
  }
}
