"use strict";

const ffxPrimerLocations = [
  ["Salvage Ship", "Check the stern. If you missed it, look by Wakka’s reunion spot on Bikanel."],
  ["Besaid Village", "Inside the Crusaders’ lodge. Dark Valefor can guard the village on a return visit."],
  ["S.S. Liki", "Check the engine room with the chocobos. A missed copy moves to Bikanel."],
  ["Kilika", "On the counter in the tavern near Kulukan."],
  ["S.S. Winno", "On the bridge. A missed copy moves to Bikanel."],
  ["Luca", "In the visitors’ locker room opposite the Aurochs’ locker room."],
  ["Luca", "On the floor in the Sphere Theater reception area."],
  ["Mi’ihen Highroad", "Rin gives it to you at the Travel Agency."],
  ["Mi’ihen Highroad", "On the Newroad just beyond the Travel Agency."],
  ["Mushroom Rock Road", "Follow the narrow side path off the Valley trail."],
  ["Djose Highroad", "Behind a stone pillar along the road."],
  ["Moonflow", "At the North Wharf after taking the shoopuf."],
  ["Guadosalam", "On the floor inside one of the houses."],
  ["Thunder Plains", "Tell Rin your Al Bhed is going okay. A missed copy moves to Bikanel."],
  ["Macalania Woods", "Look near the Save Sphere and O’aka at the path to the spring."],
  ["Lake Macalania", "Outside the Travel Agency, on the left."],
  ["Bikanel", "Check the ruins in the Central desert."],
  ["Bikanel", "Along the main route through the Central desert."],
  ...ffxMissables.filter(record => record.primer).map(record => [record.group, record.detail]),
  ["Calm Lands", "In the far northwest corner of the main plain."],
  ["Remiem Temple", "Outside, down the path to the left of the temple entrance."],
  ["Cavern of the Stolen Fayth", "Along the path near the Save Sphere by the teleporter."],
  ["Omega Ruins", "On the ground near the treasure chests in the western section."]
];
const primerNumbers = "I II III IV V VI VII VIII IX X XI XII XIII XIV XV XVI XVII XVIII XIX XX XXI XXII XXIII XXIV XXV XXVI".split(" ");

const ffxJechtLocations = [
  ["Macalania Woods · Spring", "Defeat Spherimorph to see the first sphere and make the others appear.", null],
  ["Besaid Village", "Beside the temple. Dark Valefor can block entry after Bevelle.", 0],
  ["S.S. Liki", "On the bridge of the ferry between Besaid and Kilika.", 5],
  ["Luca · Stadium", "In the hallway outside the Aurochs’ locker room.", 4],
  ["Mi’ihen Highroad · Oldroad South", "Near the chest at the end of the Oldroad.", 3],
  ["Mushroom Rock Road · Precipice", "The Auron Sphere is on the ridge above the beach.", 8],
  ["Moonflow · South Wharf", "Look by the landing on the south bank.", 2],
  ["Thunder Plains · South", "Look beside a lightning tower in the southern half.", 1],
  ["Macalania Woods · South", "Check the east side of the woods entrance.", 7],
  ["Mt. Gagazet · Mountain Trail", "The Braska Sphere is on a side path before the Fayth Cluster.", 6]
];

const ffxRageSources = [
  ["Available from the start", []],
  ["", ["Dual Horn", "Valaha", "Grendel", "Yenke Ronso"]],
  ["Use Lancet on Ragora in Kilika Woods.", ["Ragora"]],
  ["", ["Bomb", "Grenade", "Puroboros", "Biran Ronso"]],
  ["", ["YKT-63", "YKT-11", "Biran Ronso"]],
  ["", ["Basilisk", "Anacondaur", "Yenke Ronso"]],
  ["", ["Chimera", "Chimera Brain", "Yenke Ronso"]],
  ["", ["Ghost", "Wraith", "Biran Ronso"]],
  ["Wait for Yenke to cast White Wind before using Lancet on him.", ["Dark Flan", "Yenke Ronso"]],
  ["", ["Malboro", "Great Malboro"]],
  ["Wait for Biran to cast Mighty Guard before using Lancet on him.", ["Behemoth", "Behemoth King", "Biran Ronso"]],
  ["", ["Omega Weapon", "Nemesis"]]
];

// The crest and sigil bits follow the source game’s item slots. Display the
// character’s name because the planet names change between English editions.
const ffxCelestials = [
  ["Caladbolg", 35, "Beat the trainer’s Catcher Chocobo race to move the guard, then go down the northwest slope in the Calm Lands.",
    "Open the chest in Yunalesca’s chamber by going down the far stairs after the fight.", "Finish Catcher Chocobo with a time below zero."],
  ["Nirvana", 37, "Capture one of every Calm Lands fiend and open the chest at the Monster Arena.",
    "Swim to the side of the beach at Besaid to find the chest.", "Get all Aeons, then defeat Belgemine’s Aeons through the Magus Sisters and send her at Remiem Temple."],
  ["Masamune", 39, "Bring the Rusty Sword from outside the Cavern of the Stolen Fayth to Lord Mi’ihen’s statue at Mushroom Rock Road.",
    "Open the chest at the end of the Mi’ihen Highroad Oldroad.", "Unlock a combined total of ten Area and Species Conquest creations."],
  ["Spirit Lance", 42, "Pray at three Qactuar stones in the Thunder Plains, follow the ghost and pray at the ruined tower.",
    "Open the chest near the columns at Mt. Gagazet’s Prominence.", "After getting the airship, win both Butterfly Catcher courses in Macalania Woods."],
  ["World Champion", 44, "Win five Blitzball games, then speak to the bartender in Luca.",
    "Search a locker in the Aurochs’ locker room.", "After winning Attack Reels, Status Reels and Aurochs Reels, look for the sigil as a Blitzball league prize."],
  ["Onion Knight", 46, "Defeat Geosgaeno at Baaj Temple and search underwater for the chest.",
    "Return to the Farplane in Guadosalam and open the chest.", "Dodge 200 consecutive lightning bolts in the Thunder Plains and claim the reward outside the agency."],
  ["Godhand", 48, "Enter GODHAND on the airship, then open the chest in the unlocked Mushroom Rock area.",
    "Check the chest in the western Sanubia Desert, inside a sand whirlpool.", "Finish the Village of the Cactuars quest on Bikanel and open the chest inside the valley."]
];

const collectionLabels = [["primers","Al Bhed Primers"],["spheres","Jecht Spheres"],["rages","Ronso Rages"],["celestials","Celestial Weapons"],
  ["aeons","Optional Aeons"],["anima","Anima Treasures"],["bosses","Optional Bosses"],["goals","Completion Goals"],
  ["endgame","Endgame Route"],["airship","Airship Secrets"]];
let collectionGroup = "primers";
let collectionMissingOnly = false;
const completionPresets = {
  trophies:["primers","rages","celestials","aeons","bosses","grid","blitz"],
  full:["primers","spheres","rages","celestials","aeons","anima","bosses","grid","blitz","arena","challenges"]
};
const completionExtra = [["grid","All seven Sphere Grids","grid"],["blitz","Wakka’s Blitzball rewards","blitzball"],
  ["arena","All Arena creations defeated","arena"],["challenges","Challenge sigils","challenges"]];
let completionPreset = "trophies";
let completionCustom = [...completionPresets.trophies];
try {
  const preferences = JSON.parse(localStorage.getItem("spira.completion.v1") || "null");
  if (["trophies","full","custom"].includes(preferences?.preset)) completionPreset = preferences.preset;
  if (Array.isArray(preferences?.custom)) completionCustom = preferences.custom.filter(id => completionPresets.full.includes(id));
} catch { /* Local storage is optional. */ }

function rememberCompletionGoals() {
  try { localStorage.setItem("spira.completion.v1", JSON.stringify({preset:completionPreset,custom:completionCustom})); } catch { /* Keep session choices. */ }
}

function ffxCollection(current, group) {
  const progress = current.progress;
  if (group === "anima") return animaTreasures(current);
  if (group === "primers") return ffxPrimerLocations.map(([place, detail], index) => {
    const missable = ffxMissables.find(record => record.primer === index + 1);
    const done = !!(progress.primers & (1 << index));
    return {name:"Primer " + primerNumbers[index], detail, place, done,
      state:done ? "Collected" : missable ? missableState(current, missable) : "Missing"};
  });
  if (group === "spheres") return ffxJechtLocations.map(([name, detail, bit]) => ({
    name, detail, done:bit == null ? !!(progress.bushido & 1) :
      !!(progress.jechtSpheres & (1 << bit))
  }));
  if (group === "rages") return ffxRageSources.map(([detail, sources], index) => ({
    name:ffxData.commands[0x3068 + index], detail, sources, done:!!(progress.ronsoRages & (1 << index))
  }));
  if (group === "aeons") return [
    ["Anima","Baaj Temple","Collect all six Destruction Sphere treasures, defeat Geosgaeno, and light the statues inside the temple."],
    ["Yojimbo","Cavern of the Stolen Fayth","Defeat Yojimbo and negotiate his fee at the fayth chamber."],
    ["Magus Sisters","Remiem Temple","Obtain Anima and Yojimbo. Get the Blossom Crown from the Arena and the Flower Scepter from Belgemine’s Bahamut."]
  ].map(([name,place,detail], index) => ({name,place,detail,prep:index === 1 ? "yojimbo" : null,
    done:!!(progress.optionalAeons & (1 << index))}));
  if (group === "bosses") return [
    ...prepDarkAeons.map((name,index) => ({name, done:!!(progress.darkAeons & (1 << index)), prep:`dark-${darkFightIds[index]}`})),
    ...[["Penance","penance"],["Nemesis"],["Ultima Weapon"],["Omega Weapon"],["Geosgaeno"]].map(([name,prep]) =>
      ({name, prep, done:arenaDefeated(current,name), sources:[name]}))
  ].map(record => ({...record,state:record.done ? "Defeated" : "Remaining"}));
  return ffxCelestials.map(([name, crest, weaponHint, crestHint, sigilHint], id) => {
    const gear = current.party.find(member => member.id === id)?.gear || [];
    const weapon = gear.find(piece => piece.type === 0 && piece.celestial);
    const powered = !!weapon?.abilities.includes(0x8019);
    const crestApplied = powered || !!weapon?.abilities.includes(0x800e);
    return {name, place:catalog.x.party[id], detail:weaponHint, done:powered, parts:[
      ["Weapon", weapon ? "Owned" : "Check location", weaponHint],
      ["Crest", crestApplied ? "Applied" : ffxBit(progress.keyItems, crest) ? "Owned" : "Check location", crestHint],
      ["Sigil", powered ? "Applied" : ffxBit(progress.keyItems, crest + 1) ? "Owned" : "Check location", sigilHint]
    ], state:powered ? "Fully powered" : crestApplied ? "Crest applied" : weapon ? "Weapon owned" : "Weapon not yet seen"};
  });
}

function showCollections(current) {
  heading("Collections", "Progress from your current save");
  const groups = element("div", "filters guide-filters");
  const filter = action("Missing only", () => {
    collectionMissingOnly = !collectionMissingOnly;
    filter.setAttribute("aria-pressed", String(collectionMissingOnly));
    drawRows();
  });
  filter.setAttribute("aria-pressed", String(collectionMissingOnly));
  groups.append(options("Collection", collectionLabels, collectionGroup, value => {
    collectionGroup = value;
    drawRows();
  }), filter);
  const overview = element("div", "collection-overview");
  const sheet = element("div", "sheet guide-list");
  panel.append(groups, overview, sheet);

  function drawRows() {
    overview.replaceChildren();
    sheet.replaceChildren();
    if (collectionGroup === "endgame") {
      showEndgameRoute(current, overview, sheet);
      return;
    }
    if (collectionGroup === "airship") {
      showAirshipSecrets(current, overview, sheet);
      return;
    }
    if (collectionGroup === "goals") {
      drawCompletionGoals(current, overview, sheet, drawRows);
      return;
    }
    const records = ffxCollection(current, collectionGroup);
    if (!records.length) {
      sheet.append(entry("Waiting for collection data"));
      return;
    }
    const done = records.filter(record => record.done).length;
    const label = collectionLabels.find(([key]) => key === collectionGroup)[1];
    const progress = element("progress");
    progress.max = records.length;
    progress.value = done;
    progress.setAttribute("aria-label", label + " completed");
    const units = {primers:"collected", spheres:"collected", rages:"learned", celestials:"fully powered",
      aeons:"recruited", anima:"chests opened", bosses:"defeated"};
    const title = element("div", "collection-total");
    title.append(element("strong", "", label), element("span", "", `${done} / ${records.length} ${units[collectionGroup]}`));
    overview.append(title, progress);
    if (collectionGroup === "spheres") {
      const milestones = ["Shooting Star", "Banishing Blade", "Tornado"];
      const next = [1,3,10].findIndex(target => done < target);
      if (next >= 0) overview.append(element("p", "", `Next Bushido: ${milestones[next]} at ${[1,3,10][next]}`));
    }
    if (collectionGroup === "rages") overview.append(element("p", "", "Use Kimahri’s Lancet on a listed fiend."));
    if (collectionGroup === "anima") overview.append(element("p", "", current.progress.optionalAeons & 1 ?
      "Anima has joined your party." : done === records.length ?
        "All six treasures are ready. Search for Baaj from the airship at X 11–16, Y 57–63, defeat Geosgaeno, then approach each statue." :
        "Open the remaining chests to unlock their statues at Baaj Temple."));
    if (collectionGroup === "celestials") overview.append(element("p", "", ffxBit(current.progress.keyItems, 3) ?
      "Bring each weapon, crest and sigil to the Celestial Mirror altar in Macalania Woods." :
      "Get the Cloudy Mirror from the Remiem chocobo race and restore it at the altar in Macalania Woods."));
    for (const record of records) {
      if (collectionMissingOnly && record.done) continue;
      const state = record.state || (record.done ? "Complete" : "Missing");
      const row = entry(record.name, [record.place,state].filter(Boolean).join(" · "),
        record.parts || (record.statue && record.done) ? "" : record.detail);
      row.classList.toggle("completed", record.done);
      if (collectionGroup === "celestials") row.append(action("Check weapon power", () => {
        fieldChoices.celestialMember = ffxCelestials.findIndex(([name]) => name === record.name);
        choose("plan-celestial");
      }));
      if (record.statue) row.append(element("p", "field-note", "Baaj statue · " + record.statue));
      if (collectionGroup === "aeons" && record.name === "Anima") {
        row.append(action("Anima temple treasures", () => choose("collections", "anima")));
      }
      if (record.parts) {
        const details = element("details", "arena-pending");
        details.append(element("summary", "", "Weapon, crest and sigil locations"));
        for (const [part, status, hint] of record.parts) {
          details.append(element("p", "collection-part", `${part} · ${status} · ${hint}`));
        }
        row.append(details);
        if (record.name === "World Champion") {
          const controls = element("div", "tracker-actions");
          controls.append(action("Wakka’s Blitzball rewards", openBlitzRewards));
          row.append(controls);
        }
        if (typeof ffxChallenges !== "undefined") {
          const challenge = ffxChallenges.find(challenge => ffxCelestials[challenge.hero][0] === record.name);
          if (challenge) row.append(action(challenge.name, () => openChallenges(challenge.id)));
        }
      }
      if (record.sources?.length) {
        const sources = element("div", "tracker-actions");
        for (const name of record.sources) sources.append(action(name, () => choose("bestiary", name)));
        row.append(sources);
      }
      if (record.prep) row.append(action(record.prep === "yojimbo" ? "Plan a Zanmato payment" : "Open armor plan",
        () => openPrep(record.prep)));
      sheet.append(row);
    }
    if (!sheet.childElementCount) sheet.append(entry("Collection complete"));
  }
  drawRows();
}

function drawCompletionGoals(current, overview, sheet, redraw) {
  const controls = element("div", "filters");
  controls.append(options("Completion preset", [["trophies","Trophy goals"],["full","Full-save goals"],["custom","Custom goals"]], completionPreset,
    value => { completionPreset = value; rememberCompletionGoals(); redraw(); }));
  overview.append(controls);
  const extra = new Map(completionExtra.map(([id,label,tab]) => [id,{label,tab}]));
  const goals = completionPresets[completionPreset] || completionCustom;
  if (completionPreset === "custom") {
    const choices = element("fieldset", "completion-choices");
    choices.append(element("legend", "", "Include in this checklist"));
    for (const id of completionPresets.full) {
      const label = element("label", "prep-choice");
      const toggle = element("input");
      toggle.type = "checkbox";
      toggle.checked = completionCustom.includes(id);
      toggle.addEventListener("change", () => {
        completionCustom = toggle.checked ? [...completionCustom,id] : completionCustom.filter(goal => goal !== id);
        rememberCompletionGoals();
        redraw();
        overview.querySelectorAll(".completion-choices input")[completionPresets.full.indexOf(id)]?.focus();
      });
      label.append(toggle, extra.get(id)?.label || collectionLabels.find(([key]) => key === id)[1]);
      choices.append(label);
    }
    overview.append(choices);
  }
  if (!goals.length) sheet.append(entry("Choose goals to track"));
  for (const id of goals) {
    const meta = extra.get(id);
    const label = meta?.label || collectionLabels.find(([key]) => key === id)[1];
    let records;
    if (id === "grid") {
      const graph = liveGridLayout(current);
      records = Array.from({length:7}, (_, member) => ({done:gridCompletion(graph,current,member).counts.active === graph.nodes.length}));
    } else if (id === "blitz") records = (blitzballProgress(current) || []).map(reward => ({done:reward.earned}));
    else if (id === "challenges") records = ffxChallenges.map(challenge =>
      ({done:challengeSigil(current,challenge) !== "Unclaimed"}));
    else if (id === "arena") records = [...areaCreations,...speciesCreations.map(([name]) => name),...arenaOriginals.map(([name]) => name)]
      .map(name => ({done:arenaDefeated(current,name)}));
    else records = ffxCollection(current, id);
    const complete = records.filter(record => record.done).length;
    if (collectionMissingOnly && records.length && complete === records.length) continue;
    const row = entry(label, records.length ? `${complete} / ${records.length} complete` : "Waiting for live data");
    const open = id === "blitz" ? openBlitzRewards : id === "arena" ? () => openArenaCreation() :
      id === "challenges" ? () => openChallenges() :
      () => choose(meta?.tab || "collections", meta ? null : id);
    row.append(action("Open " + label, open));
    sheet.append(row);
  }
  if (!sheet.childElementCount) sheet.append(entry("All selected goals complete"));
}

const ffxCaptureRegions = new Map(Object.entries(arenaRegions).flatMap(([region, names]) =>
  names.map(name => [name, region])));

function battleOpportunities(current) {
  const names = [...new Set((current.enemies || []).filter(foe => foe.hp > 0).map(foe => enemyName(foe.id)))];
  const capture = current.room !== 307 && captureRoster(current).some(member => member.ready);
  return {
    rages:Number.isInteger(current.progress?.ronsoRages) ? ffxCollection(current, "rages")
      .filter(rage => !rage.done && rage.sources.some(name => names.includes(name)))
      .map(rage => ({...rage,sources:rage.sources.filter(name => names.includes(name))})) : [],
    captures:capture ? names.filter(name => ffxCaptureRegions.has(name))
      .map(name => ({name, region:ffxCaptureRegions.get(name), count:arenaCaptureCount(current, name)}))
      .filter(({count}) => count != null && count < arenaTarget) : []
  };
}

function showBattleOpportunities(current) {
  const {rages} = battleOpportunities(current);
  if (!rages.length) return;
  const section = element("section", "battle-opportunities sheet");
  section.append(element("h2", "", "Battle opportunities"));
  for (const {name, sources, detail} of rages) {
    const row = entry("Lancet · " + name, sources.join(" / "), detail || "Use Kimahri’s Lancet to learn it.");
    row.append(action("Ronso Rages", () => choose("collections", "rages")));
    section.append(row);
  }
  panel.append(section);
}
