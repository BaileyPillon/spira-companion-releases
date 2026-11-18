"use strict";

const x2StatLabels = ["Strength", "Defense", "Magic", "Magic Def.", "Agility", "Accuracy", "Evasion", "Luck"];
let x2Member = 0;
let x2Collection = "accessories";
let x2Search = "";
let x2ApJob = 0;
let x2ApOpen = false;
let x2GatesOpen = false;
const x2SelectedGrids = new Map();
const x2GridPlans = new Map();

function x2JobName(info, id) {
  if (id === 0x5000) return "None";
  return info?.[id - 0x5000]?.[0] || catalog.x2.jobs[id] || "Unknown dressphere";
}

function x2AbilityProgress(encoded, job) {
  if (typeof encoded !== "string") return [];
  let bytes;
  try { bytes = atob(encoded); } catch { return []; }
  if (bytes.length !== 0x6a0) return [];
  return (x2DressphereAbilities[job] || []).map(([name,cost,offset]) => {
    const ap = bytes.charCodeAt(offset) | bytes.charCodeAt(offset + 1) << 8;
    return {name, cost, ap:Math.min(ap,cost), done:ap >= cost};
  });
}

function showX2DressphereAp(current, member) {
  const {loadout} = current;
  const jobs = loadout.dresspheres.map(([id]) => id - 0x5000).filter(id => x2DressphereAbilities[id]);
  const equipped = member.dressphere - 0x5000;
  if (x2DressphereAbilities[equipped] && !jobs.includes(equipped)) jobs.unshift(equipped);
  if (!jobs.length) return;
  const details = element("details", "grid-attributes");
  details.open = x2ApOpen;
  details.addEventListener("toggle", () => { x2ApOpen = details.open; });
  const sheet = element("div", "sheet guide-list");
  const choices = element("div", "filters");
  const selected = jobs.includes(x2ApJob) ? x2ApJob : jobs.includes(equipped) ? equipped : jobs[0];
  const select = options("AP dressphere", jobs.map(id => [id,x2JobName(loadout.dressphereInfo, id + 0x5000)]),
    selected, value => { x2ApJob = Number(value); draw(); });
  choices.append(select);
  details.append(element("summary", "", "Dressphere AP"), choices, sheet);
  panel.append(details);

  function draw() {
    const abilities = x2AbilityProgress(current.dressphereAp[member.id], Number(select.value));
    const learned = abilities.filter(ability => ability.done).length;
    sheet.replaceChildren(entry("Mastery", `${learned}/${abilities.length} AP abilities learned`,
      "Innate commands and special dresspheres are outside this count."));
    for (const ability of abilities) {
      const row = entry(ability.name, ability.done ? "Learned" :
        `${ability.ap}/${ability.cost} AP · ${ability.cost - ability.ap} to go`);
      row.classList.toggle("completed", ability.done);
      sheet.append(row);
    }
  }
  draw();
}

function showX2Equipment(current) {
  const loadout = current.loadout;
  const member = loadout.party.find(actor => actor.id === x2Member) || loadout.party[0];
  if (!member) return;
  heading("Equipment");
  const roster = element("div", "loadout-roster");
  roster.setAttribute("role", "group");
  roster.setAttribute("aria-label", "Character");
  for (const actor of loadout.party) {
    const button = action(partyName(current, actor), () => {
      x2Member = actor.id;
      signature = "";
      render();
      panel.querySelector('.loadout-roster [aria-pressed="true"]')?.focus({preventScroll: true});
    });
    button.setAttribute("aria-pressed", String(member.id === actor.id));
    roster.append(button);
  }
  panel.append(roster);

  const worn = element("dl", "sheet loadout-fields");
  const grid = loadout.gridInfo?.[member.grid];
  const dressphere = loadout.dressphereInfo?.[member.dressphere - 0x5000];
  appendLoadoutField(worn, "Garment Grid", grid?.[0] || "Grid " + member.grid, grid?.[1]);
  appendLoadoutField(worn, "Dressphere", x2JobName(loadout.dressphereInfo, member.dressphere),
    member.dressphere === 0x5000 ? "" : dressphere?.[1]);
  member.accessories.forEach((id, slot) => {
    const item = loadout.accessoryInfo?.[id];
    appendLoadoutField(worn, "Accessory " + (slot + 1),
      id == null ? "Empty" : item?.[0] || "Accessory " + id, item?.[1]);
  });
  panel.append(worn);
  showX2DressphereHunt(current);
  showX2GateGuide(current, member);
  showX2EquipCompare(loadout, member);
  if (current.dressphereAp) showX2DressphereAp(current, member);

  if (member.dressphere !== 0x5000) {
    const stats = element("dl", "loadout-stats");
    member.stats.forEach((value, i) => {
      const stat = element("div");
      stat.append(element("dt", "", x2StatLabels[i]), element("dd", "", value));
      stats.append(stat);
    });
    panel.append(element("h2", "", "Attributes"), stats);
  }

  panel.append(element("h2", "", "Collection"));
  const filters = element("div", "filters");
  filters.append(options("Collection type", [
    ["accessories", "Spare accessories"], ["grids", "Garment Grids"], ["jobs", "Dresspheres"],
  ], x2Collection, value => {
    x2Collection = value;
    x2Search = "";
    signature = "";
    render();
    panel.querySelector(".loadout-collection select")?.focus({preventScroll: true});
  }));
  filters.classList.add("loadout-collection");
  const search = element("input");
  search.type = "search";
  search.placeholder = "Filter by name or effect";
  search.setAttribute("aria-label", search.placeholder);
  search.value = x2Search;
  const results = element("div", "sheet");
  search.addEventListener("input", () => {
    x2Search = search.value;
    showX2Collection(loadout, results);
  });
  filters.append(search);
  panel.append(filters, results);
  showX2Collection(loadout, results);
}

function showX2GateGuide(current, member) {
  const {loadout} = current;
  const grids = [...new Set([member.grid, ...loadout.grids])].filter(id => loadout.gridInfo?.[id]?.[2]);
  if (!grids.length) return;
  const details = element("details", "grid-attributes garment-grid-guide");
  details.open = x2GatesOpen;
  details.addEventListener("toggle", () => {
    if (details.open && !x2GatesOpen) details.scrollIntoView({block:"start"});
    x2GatesOpen = details.open;
  });
  const filters = element("div", "filters");
  const route = element("div");
  const results = element("div", "sheet");
  const previous = x2SelectedGrids.get(member.id);
  const select = options("Garment Grid", grids.map(id => [id,loadout.gridInfo[id][0]]),
    grids.includes(previous) ? previous : grids[0], value => {
      x2SelectedGrids.set(member.id, Number(value));
      draw();
    });
  filters.append(select);
  details.append(element("summary", "", "Garment Grid gates"), filters, route, results);
  panel.append(details);
  function draw() {
    const id = Number(select.value);
    const [,help,gates] = loadout.gridInfo[id];
    const rows = loadout.gridLayouts?.[id];
    const showLive = rows?.length;
    const specialId = [0x500f, 0x5012, 0x5015][member.id];
    const special = loadout.dresspheres.some(([id]) => id === specialId) ? catalog.x2.jobs[specialId] : null;
    const key = [member.id, id, showLive ? "native" : "reference"].join("/");
    if (!x2GridPlans.has(key)) x2GridPlans.set(key, {slots:new Map()});
    const plan = x2GridPlans.get(key);
    const equipped = id === member.grid;
    const fighter = current.battle ? current.party.find(actor => actor.id === member.id && actor.active) : null;
    const crossed = equipped && fighter ? member.gridVisitedNodes : undefined;
    const activeGates = showLive && crossed != null ? x2GridCrossed(rows, crossed) : 0;
    route.replaceChildren();
    if (showLive) {
      const layout = x2NativeGrid(rows);
      const names = layout.jobs.map(job => job ? x2JobName(loadout.dressphereInfo, 0x5000 + job) : "Empty");
      const live = {
        rows,
        ids:layout.ids,
        names:names.map((name, slot) => names.indexOf(name) === names.lastIndexOf(name) ?
          name : `${name} (${slot + 1})`),
        labels:names.map((name, slot) => name + " · Slot " + (slot + 1)),
        empty:new Set(layout.jobs.flatMap((job, slot) => job ? [] : [slot])),
        position:equipped ? x2GridPosition(layout, member, fighter, current.battle) : -1,
        crossed,
      };
      showX2GridPlan(route, layout.topology, gates, plan, live, special);
    } else if (x2GarmentTopology[id]) {
      showX2GridPlan(route, x2GarmentTopology[id], gates, plan, null, special);
      route.append(element("p", "field-note garment-grid-source",
        "Open this grid in FFX-2 to sync its dresspheres."));
    }
    results.replaceChildren(entry(equipped ? "Equipped grid" : "Owned grid", help));
    for (const [mask, effect] of gates) {
      const colors = x2GateNames(mask);
      const text = mask ? colors.join(" + ") : "On equip";
      const active = mask > 0 && (activeGates & mask) === mask;
      results.append(entry(text, active ? "Active this battle" : "", effect.replace(/^Equip:\s*/i, "")));
    }
    if (!gates.length) results.append(entry("This grid has no gate rewards."));
  }
  draw();
}

function openX2BattleGrid(current) {
  const member = current.loadout.party.find(actor => actor.id === x2Member &&
    current.party.some(fighter => fighter.id === actor.id && fighter.active)) ||
    current.loadout.party.find(actor => current.party.some(fighter => fighter.id === actor.id && fighter.active));
  if (!member) return;
  x2Member = member.id;
  x2SelectedGrids.set(member.id, member.grid);
  x2GatesOpen = true;
  choose("equip");
  const guide = panel.querySelector(".garment-grid-guide");
  guide?.querySelector("summary")?.focus({preventScroll:true});
  guide?.scrollIntoView({block:"start"});
}

function appendLoadoutField(list, label, name, effect) {
  const field = element("div", "loadout-field");
  const value = element("dd", "", name);
  if (effect) value.append(element("small", "", effect));
  field.append(element("dt", "", label), value);
  list.append(field);
}

function showX2Collection(loadout, results) {
  let choices;
  if (x2Collection === "grids") {
    choices = loadout.grids.map(id => ({
      name: loadout.gridInfo?.[id]?.[0] || "Grid " + id,
      effect: loadout.gridInfo?.[id]?.[1],
    }));
  } else if (x2Collection === "jobs") {
    choices = loadout.dresspheres.map(([id, quantity]) => ({
      name: x2JobName(loadout.dressphereInfo, id),
      effect: loadout.dressphereInfo?.[id - 0x5000]?.[1],
      quantity,
    }));
  } else {
    choices = loadout.accessories.map(([id, quantity]) => ({
      name: loadout.accessoryInfo?.[id]?.[0] || "Accessory " + id,
      effect: loadout.accessoryInfo?.[id]?.[1],
      quantity,
    }));
  }
  const query = x2Search.trim().toLowerCase();
  const rows = choices.filter(({name, effect}) => name.toLowerCase().includes(query) ||
    (effect || "").toLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name));
  results.replaceChildren();
  for (const {name, effect, quantity} of rows) {
    const row = entry(name, "", effect);
    if (quantity != null) row.prepend(element("span", "loadout-quantity", "×" + quantity));
    results.append(row);
  }
  if (!rows.length) results.append(element("p", "entry", query ? "No matches." : "Nothing in this collection yet."));
}

function showX2LevelProgress(current) {
  if (!current.loadout || current.battle) return;
  const rows = element("div", "sheet");
  for (const member of current.loadout.party) {
    if (!member.xpToNext) continue;
    rows.append(entry(partyName(current, member),
      number.format(member.xpToNext) + " EXP to next level", number.format(member.xp) + " total EXP"));
  }
  if (rows.childElementCount) panel.append(element("h2", "", "Experience"), rows);
}
// Selected chapter deadlines from the PS2 completion route. This checklist is manual.
const x2ChapterTasks = {
  1: [
    ["moogle","Touch the Moogle during the Luca chase","Find the Moogle behind crates at the docks and confirm the HP/MP restore. It unlocks an extra scene on the later Luca visit."],
    ["intro","Meet the crew and watch Journey’s Start","Speak to the crew on the Celsius, visit Barkeep in the cabin, and watch the treasure sphere at Shinra’s station."],
    ["maechen","Hear Maechen out at Youth League HQ","Speak to Lucil twice. Listen through Maechen’s entire story without interrupting and shake his hand when he offers."],
    ["escort","Finish the Moonflow escort","Start Tobli’s job and see the Hypello’s cargo safely to its destination."],
    ["oaka","Bring O’aka aboard","Find him in Macalania Woods and agree to take him on the Celsius so you can pay off his debt."],
    ["clasko-aboard","Invite Clasko aboard","After the Mushroom Rock Road mission, go back to Clasko near the Save Sphere and invite him onto the Celsius."]
  ],
  2: [
    ["faction","Return the Awesome Sphere","The Youth League branch is the common single-playthrough completion route. New Yevon opens different scenes on another run."],
    ["tickets","Sell tickets at the Moonflow","Talk to Tobli after the Chapter 1 escort and finish his ticket mission before advancing."],
    ["clasko","Start Clasko’s ranch","Take Clasko to the old arena in the Calm Lands and clear out the fiends. Catch a chocobo by the end of Chapter 3."],
    ["monkeys","Complete Operation: Monkey!","Pair the monkeys in Zanarkand before the end of Chapter 3 so the payoff can appear in Chapter 5."],
    ["publicity","Start Calm Lands publicity","Sign up for an agency’s campaign. Build up the campaign before revisiting the Calm Lands in Chapter 5."]
  ],
  3: [
    ["djose","Visit Djose before it becomes the final hot spot","Check in at Djose early for the optional scene and Primer. Return to finish the mission after your other Chapter 3 errands."],
    ["debt","Pay off O’aka’s debt","If O’aka is on board, finish paying before you visit the Macalania Travel Agency this chapter."],
    ["whistles","Hear all four whistles in the Farplane","After Yuna is alone in the dark, press the confirm button repeatedly until you hear four whistles. This affects the ending."]
  ],
  4: [
    ["first-wave","Watch the first CommSphere scenes","Check Besaid, Kilika, Mushroom Rock and Bevelle before moving on with the concert preparations."],
    ["second-wave","Revisit the CommSpheres before the concert","Some sites require repeat visits or moving the camera. Check them before advancing the concert, including Besaid, Luca and Mt. Gagazet."],
    ["post-concert","Listen to Maechen after the concert","Speak to him aboard the Celsius after the performance to hear the rest of Lenne’s story."]
  ],
  5: [
    ["cabin-scene","See the cabin scene","Rest at the Celsius cabin again. If you rested in all earlier chapters, check for the scene with Barkeep and Brother."],
    ["episodes","Finish the regional episodes","Revisit the optional locations before taking the last route into the Farplane. Earlier chapter actions can change which episodes are available."],
    ["glen","Trigger the ending prompt","After the finale, press confirm in the Farplane Glen to hear a whistle. If prompted, tell the fayth you want to see him."]
  ]
};

const x2ChecklistStorage = "spira.x2ChapterTasks.v1";
const x2Checked = new Set();
let x2ChecklistChapter = 0;
let x2ShowStoryFlags = false;
try {
  const saved = JSON.parse(localStorage.getItem(x2ChecklistStorage) || "[]");
  if (Array.isArray(saved)) for (const id of saved) if (typeof id === "string") x2Checked.add(id);
} catch { /* Keep session choices if storage is unavailable. */ }

function x2TasksForChapter(chapter) {
  const tasks = [...(x2ChapterTasks[chapter] || [])];
  if (chapter >= 1 && chapter <= 4) tasks.unshift(["rest","Rest in the Celsius cabin",
    "Ask Barkeep to let you rest once this chapter. The Chapter 5 scene requires a rest in each chapter."]);
  return tasks.map(([id,title,detail]) => ({key:`${chapter}/${id}`,title,detail}));
}

function openX2ChapterChecklist() {
  x2ChecklistChapter = 0;
  signature = "";
  choose("chapter-checklist");
}

const x2SceneClues = new Map([
  [0x04fb * 256 + 8, "Comfort Brother on the bridge before speaking to Shinra."],
  [0x066c * 256 + 64, "Listen through Maechen’s story at Youth League HQ and accept the handshake."],
  [0x0520 * 256 + 32, "Invite Clasko aboard and speak with him in the cabin before finishing the Chapter 2 Highroad mission."]
]);

function x2StoryProgress(encoded) {
  if (typeof encoded !== "string") return null;
  let bytes;
  try { bytes = atob(encoded); } catch { return null; }
  if (bytes.length !== 0x2868) return null;
  const chapters = Array.from({length:6}, () => new Map());
  const commspheres = new Map();
  let credited = 0;
  for (const [index, [chapter,offset,mask,place]] of x2StoryEvents.entries()) {
    const done = (bytes.charCodeAt(offset) & mask) !== 0;
    const region = chapters[chapter].get(place) || {name:x2StoryPlaces[place],done:0,total:0,clues:[]};
    region.total++;
    if (done) {
      region.done++;
      credited++;
    } else {
      const clue = x2SceneClues.get(offset * 256 + mask);
      if (clue) region.clues.push(clue);
    }
    chapters[chapter].set(place, region);
    // Chapter 4’s 39 communication-sphere triggers are listed together in the source table.
    if (index >= 350 && index < 389) {
      const camera = commspheres.get(place) || {name:x2StoryPlaces[place],done:0,total:0};
      camera.total++;
      if (done) camera.done++;
      commspheres.set(place, camera);
    }
  }
  return {credited, chapters, commspheres};
}

function showX2ChapterChecklist(current) {
  heading("Chapter Checklist", `Live game · Chapter ${current.chapter}`);
  if (typeof showX2SceneAudit === "function") showX2SceneAudit(current);
  const live = x2StoryProgress(current.storyFlags);
  if (live) {
    const percent = Math.min(100, live.credited / 5);
    const row = entry(percent.toFixed(1) + "% story completion", `${live.credited} story flags recorded`,
      "Some scenes are exclusive to an alternate route or ending.");
    const meter = element("progress");
    meter.max = 100;
    meter.value = percent;
    meter.setAttribute("aria-label", "Story completion percent");
    row.append(meter);
    row.classList.add("collection-overview");
    panel.append(row);
  }
  showX2CrimsonRoute(current);
  const guides = element("div", "filters");
  if (current.loadout) guides.append(action("Dressphere Hunt", openX2DressphereHunt));
  if (current.experiment) guides.append(action("The Experiment", () => openX2Challenge("experiment", current)));
  if (current.towers) guides.append(action("Tower Calibration", () => openX2Challenge("towers", current)));
  if (guides.childElementCount) panel.append(guides);
  if (current.calmLands) {
    const quests = element("div", "filters");
    quests.append(action("Publicity & Matrimony", () => openX2Challenge("publicity", current)),
      action("Chocobo Ranch", () => openX2Challenge("ranch", current)));
    panel.append(quests);
  }
  const overview = element("p", "field-note");
  overview.setAttribute("role", "status");
  const sheet = element("div", "sheet guide-list");
  const controls = element("div", "filters");
  const chapters = options("Checklist chapter", [["0","Follow current chapter"],
    ...[1,2,3,4,5].map(chapter => [chapter, "Chapter " + chapter])], String(x2ChecklistChapter), value => {
    x2ChecklistChapter = Number(value);
    draw();
  });
  controls.append(chapters);
  if (live) {
    const mode = action("", () => {
      x2ShowStoryFlags = !x2ShowStoryFlags;
      draw();
    });
    function reflectMode() {
      mode.textContent = x2ShowStoryFlags ? "Show manual checks" : "Find missing scenes";
      cameras.setAttribute("aria-pressed", String(x2ShowStoryFlags === "commspheres"));
    }
    mode.addEventListener("click", reflectMode);
    const cameras = action("CommSpheres", () => {
      x2ChecklistChapter = 4;
      chapters.value = "4";
      x2ShowStoryFlags = "commspheres";
      reflectMode();
      draw();
    });
    reflectMode();
    controls.append(mode, cameras);
  }
  panel.append(controls, overview, sheet);

  function draw() {
    const chapter = x2ChecklistChapter || current.chapter;
    sheet.replaceChildren();
    if (live && x2ShowStoryFlags === "commspheres") {
      if (chapter !== 4) {
        overview.textContent = "CommSphere checks are in Chapter 4.";
        return;
      }
      const cameras = [...live.commspheres.values()];
      const watched = cameras.reduce((sum, camera) => sum + camera.done, 0);
      overview.textContent = `${watched}/39 CommSphere flags recorded · Chapter 4`;
      cameras.sort((a,b) => Number(a.done === a.total) - Number(b.done === b.total));
      for (const camera of cameras) {
        const row = entry(camera.name, `${camera.done}/${camera.total} recorded`,
          camera.done < camera.total && camera.total > 1 ? "Check the feed again. Some scenes need another visit or a camera movement." : "");
        row.classList.toggle("completed", camera.done === camera.total);
        sheet.append(row);
      }
      return;
    }
    if (live && x2ShowStoryFlags) {
      overview.textContent = `Chapter ${chapter} · Locations with unrecorded story flags`;
      const groups = [...live.chapters[chapter].values()].filter(region => region.done < region.total);
      for (const region of groups) {
        const missed = region.total - region.done;
        const row = entry(region.name, `${region.done}/${region.total} recorded · ${(missed / 5).toFixed(1)}% unrecorded`);
        for (const clue of region.clues) row.append(element("p", "field-note", clue));
        sheet.append(row);
      }
      if (!groups.length) sheet.append(entry("All listed flags recorded for this chapter"));
      return;
    }
    const tasks = x2TasksForChapter(chapter);
    const updateTotal = () => {
      const checked = tasks.filter(task => x2Checked.has(task.key)).length;
      overview.textContent = `${checked}/${tasks.length} checks marked · Chapter ${chapter}. Mark these by hand as you play.`;
    };
    updateTotal();
    for (const task of tasks) {
      const row = element("div", "entry");
      const label = element("label", "prep-choice");
      const input = element("input");
      input.type = "checkbox";
      input.checked = x2Checked.has(task.key);
      row.classList.toggle("completed", input.checked);
      input.addEventListener("change", () => {
        if (input.checked) x2Checked.add(task.key);
        else x2Checked.delete(task.key);
        try { localStorage.setItem(x2ChecklistStorage, JSON.stringify([...x2Checked])); }
        catch { /* Keep session choices if storage is unavailable. */ }
        row.classList.toggle("completed", input.checked);
        updateTotal();
      });
      label.append(input, element("strong", "", task.title));
      row.append(label, element("p", "field-note", task.detail));
      sheet.append(row);
    }
  }
  draw();
}
