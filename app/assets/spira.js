"use strict";

const panel = document.querySelector("#panel");
const connection = document.querySelector("#connection");
const nav = [...document.querySelectorAll("nav button")];
const number = new Intl.NumberFormat();
const clock = new Intl.DateTimeFormat(undefined, {hour:"numeric", minute:"2-digit"});
const states = {
  waiting: "Waiting", title: "At title screen", reading: "Connecting",
  unsupported: "Unsupported disc", stale: "Feed stopped", live: "Live", paused: "Paused", sample: "Sample data",
  reconnecting: "Reconnecting"
};
const exampleParty = {
  x: [
    {id:0, active:true, hp:1480, maxHp:1720, mp:66, maxMp:84, sphereLevel:3, overdrive:82, overdriveMax:100},
    {id:1, active:true, hp:960, maxHp:1120, mp:101, maxMp:125, sphereLevel:2, overdrive:33, overdriveMax:100},
    {id:2, active:true, hp:920, maxHp:2040, mp:32, maxMp:54, sphereLevel:4, overdrive:61, overdriveMax:100}
  ],
  x2: [
    {id:0, active:true, hp:930, maxHp:1100, mp:43, maxMp:63, level:17, job:20480},
    {id:1, active:true, hp:530, maxHp:990, mp:52, maxMp:60, level:17, job:20483},
    {id:2, active:true, hp:1410, maxHp:1410, mp:25, maxMp:39, level:18, job:20481}
  ]
};

let tab = "status";
let folder = false;
let state = "waiting";
let frame = null;
let sample = null;
let error = "";
let visits = [];
let signature = "";
let lastSeen = 0;
let reconnecting = false;
let mixQuery = "";
let returningToMix = false;
let updateMix = null;
let updateBestiary = null;
let inventoryQuery = "";

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value != null) node.textContent = value;
  return node;
}

function action(label, callback, primary = false) {
  const button = element("button", primary ? "action primary" : "action", label);
  button.addEventListener("click", callback);
  return button;
}

function heading(title, subtitle) {
  panel.append(element("h1", "", title));
  if (subtitle) panel.append(element("p", "sub", subtitle));
}

function roomName(current) {
  return (current.game === "x" ? ffxRooms[current.room] : "") ||
    catalog[current.game].rooms[current.room] || "Area " + current.room;
}

function present(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validFrame(next) {
  return next && next.schema === 1 && present(next.timestamp) &&
    ["waiting", "title", "reading", "unsupported", "live"].includes(next.status) &&
    (["waiting", "unsupported"].includes(next.status) || Object.hasOwn(catalog, next.game)) &&
    (next.status !== "live" || (present(next.room) && present(next.gil) && present(next.battles) &&
      Array.isArray(next.party) && Array.isArray(next.items)));
}

function choose(nextTab, initialQuery = null, bribeTarget = null, itemSources = false) {
  const plan = typeof fieldPlanFor === "function" && fieldPlanFor(nextTab);
  if (plan && tab !== nextTab) fieldPlanOrigin = [...nav].some(button => button.dataset.tab === tab && !button.hidden) ? tab : "workspace";
  if (typeof coachManualNavigation === "function") coachManualNavigation();
  if (nextTab === "missables") focusedMissable = initialQuery;
  returningToMix = nextTab === "bestiary" && tab === "mix" && initialQuery != null;
  if (nextTab === "mix") {
    if (initialQuery != null) mixQuery = initialQuery;
    signature = "";
  }
  if (nextTab === "bestiary" && initialQuery != null) {
    bestiaryMode = itemSources ? "items" : "fiends";
    bestiaryQuery = initialQuery;
    bestiaryArea = "";
    bestiarySource = bribeTarget == null ? "" : "bribe";
    bestiaryBribeTarget = bribeTarget;
    signature = "";
  }
  if (nextTab === "collections" && initialQuery != null) {
    collectionGroup = initialQuery;
    signature = "";
  }
  tab = nextTab;
  panel.scrollTop = 0;
  render();
}

function update(raw, granted) {
  folder = granted;
  let next;
  try { next = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { next = null; }
  const valid = validFrame(next);
  const now = Date.now();
  const previousLive = state === "live" && !reconnecting ? frame : null;
  // A short missed read can happen during an emulator transition. Keep the last
  // complete frame visible, with its connection status clearly marked.
  reconnecting = (!valid || next.status === "waiting") && state === "live" &&
    now - frame.timestamp < 3000;
  if (reconnecting) {
    if (typeof updateLiveCoach === "function") updateLiveCoach(null);
    updateHuntSession(null);
    if (typeof updateLightningTracking === "function") updateLightningTracking(null);
    if (typeof syncBlitzBreakSlots === "function") syncBlitzBreakSlots(null);
    showConnection("reconnecting");
    if (typeof updateGuide === "function") updateGuide(tab === "guide", frame, "reconnecting");
    render();
    return;
  }
  const age = valid ? now - next.timestamp : Infinity;
  state = valid ? next.status : (lastSeen ? "stale" : "waiting");
  if (valid && (age > 4000 || age < -10000)) state = "stale";
  if (valid && state !== "stale" && state !== "waiting") {
    lastSeen = next.timestamp;
    if (sample) sample = null;
  }
  if (state === "live") {
    rememberExit(previousLive, next);
    if (typeof rememberFieldExploration === "function") rememberFieldExploration(next);
    if (typeof rememberX2Encounter === "function") rememberX2Encounter(next);
  }
  updateHuntSession(state === "live" ? next : null);
  if (typeof updateLightningTracking === "function") updateLightningTracking(state === "live" ? next : null);
  if (typeof syncBlitzBreakSlots === "function") syncBlitzBreakSlots(state === "live" ? next : null);
  if (typeof updateX2RanchWatch === "function" && state === "live") updateX2RanchWatch(next);
  frame = valid ? next : null;
  if (state === "live") {
    if (!toolSupportsGame(tab, frame.game) ||
        (!frame.grid && nav.some(button => button.hasAttribute("data-ffx") && button.dataset.tab === tab)) ||
        (tab === "equip" && !frame.grid && !frame.loadout) ||
        (tab === "mix" && (frame.game !== "x" || !frame.disc)) ||
        (tab === "map" && !frame.disc) || (["missables","collections"].includes(tab) && !frame.progress) ||
        (tab === "field-guide" && !frame.oversoul) ||
        (tab === "challenges" && !frame.grid && frame.game !== "x2") ||
        (tab === "x2-bestiary" && (frame.game !== "x2" || !frame.disc)) ||
        (tab === "chapter-checklist" && (frame.game !== "x2" || !frame.chapter))) {
      tab = "status";
      panel.scrollTop = 0;
    }
    const recent = visits[0];
    if (!recent || recent.game !== frame.game || recent.room !== frame.room) {
      visits = [{game:frame.game, room:frame.room, timestamp:frame.timestamp}, ...visits].slice(0, 24);
    }
  }
  if (typeof updateLiveCoach === "function") updateLiveCoach(state === "live" ? frame : null);
  render();
  if (state === "live") {
    if (tab === "trials") updateFieldMarker?.(frame.cloisterPlayer);
    else if (frame.fieldMap || tab === "map") updateFieldMarker?.(frame.fieldPlayer);
  }
}

function demo(game) {
  sample = {game, room:game === "x" ? 110 : 171, gil:game === "x" ? 8742 : 4130,
    battles:25, chapter:2, party:exampleParty[game], items:[[8192,8],[8193,3],[8196,2],[8198,5],[8202,3]]};
  error = "";
  choose("status");
}

function pickFolder() {
  error = "";
  if (window.SpiraSetup) window.SpiraSetup.pickFolder();
  else window.Spira.setupError("Folder selection is available in the Android app.");
}

function setup() {
  heading("Connect to ARMSX2");
  const detected = frame?.disc && [frame.disc, frame.crc].filter(Boolean).join(" / ");
  const connected = state === "live" || state === "title";
  const checks = element("div", "sheet");
  const connectionHelp = {
    live:"Your game is sending live data.",
    title:"Connection ready. Load a save or start a new game.",
    unsupported:"Check the disc serial and CRC against the supported builds in the install guide.",
    stale:"Resume the game to restart the feed.",
    reading:"Waiting for the game to finish loading.",
    waiting:"Open a supported game and check that PINE is enabled on port 28011."
  };
  const connectionLabel = connected ? (detected ? "PINE connected" : "Steam bridge connected") : states[state];
  checks.append(entry(connectionLabel, detected || "", connectionHelp[state]));
  panel.append(checks);
  const steps = element("ol", "section-copy");
  for (const step of [
    "In ARMSX2 Settings, search for Enable PINE and turn it on.",
    "Start Final Fantasy X International or Final Fantasy X-2 in ARMSX2.",
    "Open this companion on the bottom screen. It follows the running disc automatically."
  ]) steps.append(element("li", "", step));
  panel.append(steps);
  if (folder) panel.append(element("p", "", "Steam bridge folder connected."));
  if (error) panel.append(element("p", "error", error));
  const controls = element("div", "controls");
  controls.append(action("Steam bridge folder", pickFolder),
    action("Preview FFX", () => demo("x")), action("Preview FFX-2", () => demo("x2")));
  if (sample) controls.append(action("End preview", () => { sample = null; choose("status"); }));
  panel.append(controls);
  if (window.SpiraCheats) window.SpiraCheats.settings();
  if (typeof guideSuggestionSetting === "function") panel.append(guideSuggestionSetting());
  if (typeof coachSettings === "function") panel.append(coachSettings());
  panel.append(action("Playthrough profiles and backups", () => choose("profiles")));
}

function statList(current) {
  const stats = element("dl", "stats");
  const values = [["Gil", current.gil], ["Battles", current.battles]];
  if (current.game === "x2" && present(current.chapter)) values.unshift(["Chapter", current.chapter]);
  for (const [label, value] of values) {
    const entry = element("div");
    entry.append(element("dt", "", label), element("dd", "", number.format(value)));
    stats.append(entry);
  }
  return stats;
}

function metric(label, value, max) {
  const group = element("div", "metric" + (label === "MP" ? " mp" : "") +
    (label === "HP" && value === 0 ? " down" : label === "HP" && value * 4 < max ? " low" : ""));
  const line = element("span");
  line.append(element("b", "", label), element("strong", "", number.format(value) + " / " + number.format(max)));
  const bar = element("progress");
  bar.max = Math.max(max, 1);
  bar.value = value;
  bar.setAttribute("aria-hidden", "true");
  group.append(line, bar);
  return group;
}

function partyName(current, member) {
  return member.name || catalog[current.game].party[member.id] || "Creature " + (member.id - 2);
}

function partyList(current, activeOnly) {
  const list = element("div", "sheet");
  for (const member of current.party) {
    if (!member || !present(member.id) || (activeOnly && member.active !== true) ||
      ![member.hp, member.mp, member.maxHp, member.maxMp].every(present)) continue;
    const row = element("div", "member");
    const name = partyName(current, member);
    const title = element("div");
    title.append(element("strong", "", name));
    const details = [];
    if (current.game === "x" && present(member.sphereLevel)) {
      if (!current.battle || !member.active) details.push("S.Lv " + member.sphereLevel);
      if ((!activeOnly || current.battle) && member.overdriveMax > 0 &&
          present(member.overdrive) && member.overdrive <= member.overdriveMax) {
        details.push(member.overdrive === member.overdriveMax ? "Overdrive ready" :
          "OD " + Math.floor(member.overdrive * 100 / member.overdriveMax) + "%");
      }
    }
    if (current.game === "x2") {
      if (present(member.level) && member.level > 0) details.push("Lv " + member.level);
      const job = current.loadout && present(member.job) ?
        x2JobName(current.loadout.dressphereInfo, member.job) : catalog.x2.jobs[member.job];
      if (job) details.push(job);
    }
    if (!activeOnly && member.active === false) details.push("Reserve");
    if (details.length) title.append(element("small", "", details.join(" · ")));
    if (member.statusBits || member.statusTimed) {
      const effects = statusEffects(current.game, member);
      if (effects) title.append(element("small", "member-effects", effects));
    }
    row.append(title, metric("HP", member.hp, member.maxHp), metric("MP", member.mp, member.maxMp));
    list.append(row);
  }
  if (list.childElementCount) panel.append(list);
  else panel.append(element("p", "empty", "Waiting for party data."));
}

function itemAmounts(items) {
  const amounts = new Map();
  for (const entry of items) {
    if (!Array.isArray(entry) || !entry.every(present)) continue;
    amounts.set(entry[0], (amounts.get(entry[0]) || 0) + entry[1]);
  }
  return amounts;
}

function supplies(current) {
  heading(current.grid ? "Inventory" : "Recovery items", catalog[current.game].title);
  const amounts = itemAmounts(current.items);
  const list = element("div", "sheet");
  {
    const search = element("input");
    search.type = "search";
    search.placeholder = current.grid ? "Find an item or sphere" : "Find a recovery item";
    search.setAttribute("aria-label", search.placeholder);
    search.value = inventoryQuery;
    search.addEventListener("input", () => {
      inventoryQuery = search.value;
      draw();
    });
    const filters = element("div", "filters guide-filters");
    filters.append(search);
    panel.append(filters);
  }
  const names = current.grid ? Object.entries(ffxData.items).map(([id,name]) => [name, Number(id) - 0x2000]) :
    catalog[current.game].recovery.map((name, index) => [name, index]);
  function draw() {
    list.replaceChildren();
    const query = normalizeGuideText(inventoryQuery.trim());
    for (const [name, index] of names) {
      const count = amounts.get(0x2000 + index) || 0;
      if (query ? !normalizeGuideText(name).includes(query) : !count && ![0, 1, 4, 6, 10, 15].includes(index)) continue;
      const row = element("div", "item");
      row.append(current.game === "x" && current.grid ? action(name, () => openItemSources(name)) : element("span", "", name),
        element("strong", "", "×" + count));
      list.append(row);
    }
    if (!list.childElementCount) list.append(entry("No matching items"));
  }
  panel.append(element("h2", "", current.grid ? "Items and spheres" : "Inventory"), list);
  draw();
}

function journal() {
  heading("Recent areas", "Area changes observed while this app is open");
  if (!visits.length) {
    panel.append(element("p", "empty", "Start either game to see your route here."));
    return;
  }
  const list = element("div", "sheet");
  for (const visit of visits) {
    const row = element("div", "visit");
    row.append(element("span", "", roomName(visit) + " · " + (visit.game === "x" ? "FFX" : "FFX-2")),
      element("time", "", clock.format(new Date(visit.timestamp))));
    list.append(row);
  }
  panel.append(element("h2", "", "This session"), list);
}

function waiting() {
  const title = frame && catalog[frame.game]?.title;
  if (state === "title") {
    heading(title, frame.edition || frame.build);
    panel.append(element("p", "empty", "Start a new game or load a save to see your party and supplies."));
  } else if (state === "unsupported") {
    heading(title || "Unsupported disc");
    panel.append(element("p", "empty", frame.disc ? "Disc " + frame.disc + " · " + frame.crc :
      "This Steam executable has a different build."));
  } else if (state === "stale") {
    heading("Live feed stopped");
    panel.append(element("p", "empty", "Resume either game to reconnect."));
  } else if (state === "reading") {
    heading(title || "Connecting");
    panel.append(element("p", "empty", "Waiting for the game to finish loading."));
  } else {
    heading("Waiting for the game");
    panel.append(element("p", "empty", "Start either game in ARMSX2 with PINE enabled."));
  }
  if (state !== "title") {
    const buttons = element("div", "controls");
    buttons.append(action("Open setup", () => choose("setup"), true));
    panel.append(buttons);
  }
}

function showConnection(status) {
  if (connection.dataset.state !== status || connection.textContent !== states[status]) {
    connection.dataset.state = status;
    connection.textContent = states[status];
  }
}

function render() {
  const visibleState = sample ? "sample" : state === "live" && frame.paused ? "paused" : state;
  showConnection(reconnecting ? "reconnecting" : visibleState);
  const current = sample || (state === "live" ? frame : null);
  if (typeof updateGuide === "function") updateGuide(tab === "guide", sample ? null : current, reconnecting ? "reconnecting" : visibleState);
  panel.hidden = tab === "guide";
  const ffx = !!current?.grid;
  const hasMix = current?.game === "x" && !!current.disc;
  const { timestamp, ...data } = current || {};
  const fieldPlan = typeof fieldPlanFor === "function" && fieldPlanFor(tab);
  let displayed = data;
  if (fieldPlan && current) displayed = fieldPlanSignature(fieldPlan.id,current);
  const {fieldMap, fieldPlayer, fieldExits, loadout, storyFlags, dressphereAp, oversoul, ...statusData} = data;
  if (tab === "status") displayed = [reconnecting, statusData, oversoul, fieldMap, fieldExits,
    loadout?.dresspheres, !!loadout?.gridInfo];
  if (tab === "setup") displayed = [frame?.disc, frame?.crc];
  if (tab === "profiles") displayed = null;
  if (tab === "battle-lab") displayed = [reconnecting,data.disc,data.battle,data.paused,data.party,data.enemies,data.items];
  if (tab === "trials") displayed = [data.room,data.story,data.cloister,data.progress?.trials,data.paused,reconnecting];
  if (tab === "workspace") displayed = [data.game,data.disc,!!data.grid,!!data.progress,!!data.oversoul,!!data.chapter,
    data.items,loadout?.accessories,loadout?.grids,loadout?.dresspheres,loadout?.accessoryInfo,loadout?.gridInfo,loadout?.dressphereInfo];
  if (tab === "grid-lab") displayed = [data.game, !!data.grid, data.items];
  if (tab === "planner") displayed = [data.disc, data.room, data.story, data.items, data.arena, data.progress,
    data.party?.map(member => [member.id, member.gear])];
  if (tab === "supplies") displayed = [data.disc, data.items];
  if (tab === "cheats") displayed = [reconnecting,data.disc,data.room,data.story,data.battle,data.gil,data.items];
  if (tab === "mix") displayed = [data.disc];
  if (tab === "map") displayed = [data.disc, data.room, data.previousRoom, data.story, data.chapter, data.battle,
    data.progress, data.arena, oversoul, data.enemies?.map(foe => [foe.id,foe.hp > 0]), fieldMap, fieldExits];
  if (tab === "missables") displayed = [data.room, data.story, data.progress];
  if (tab === "collections") displayed = [data.room, data.story, data.progress, data.party?.map(m => [m.id, m.gear]),
    ["goals","bosses","endgame"].includes(collectionGroup) && data.arena,
    ["goals","endgame"].includes(collectionGroup) && data.grid,
    collectionGroup === "endgame" && data.party?.map(m => m.active)];
  if (tab === "chapter-checklist") displayed = [data.game, data.chapter, storyFlags, data.crimsonSpheres,
    !!loadout, !!data.experiment, !!data.towers];
  if (tab === "field-guide") displayed = x2FieldMode === "blue" ?
    [!!oversoul, data.blueBullets, [...x2BlueEncounters(data)]] : [oversoul];
  if (tab === "x2-bestiary") displayed = [data.disc, oversoul, observedFiends.length, observedFiends.at(-1), data.battle,
    data.paused, data.enemies?.map(foe => [foe.slot,foe.id,foe.name,foe.hp > 0,foe.maxHp,foe.maxMp,foe.level])];
  if (ffx && tab === "challenges") displayed = [data.room, data.progress?.challenges, data.progress?.keyItems,
    data.items, data.party.map(member => [member.id,member.active,member.gear]), lightningRun?.count, lightningInterrupted, data.battle,
    data.story, reconnecting, fieldMap, [data.butterfly?.active,data.butterfly?.caught], data.catcher];
  if (data.game === "x2" && tab === "challenges") displayed =
    [data.game, !!data.calmLands, x2Challenge, x2Challenge === "publicity" && [data.chapter, data.calmLands],
      x2Challenge === "ranch" && [data.chapter, data.calmLands?.dispatches, data.battles],
      x2Challenge === "experiment" && [data.chapter, data.experiment, data.blueBullets],
      x2Challenge === "towers" && [data.chapter, data.towers], !!data.experiment, !!data.towers];
  if (tab === "blitzball") displayed = [data.room, data.story, data.battles, data.progress?.blitzball, data.progress?.keyItems,
    blitzView === "live" && [data.blitzMatch, data.paused, reconnecting],
    data.party?.find(member => member.id === 4)?.gear?.filter(piece => piece.celestial)];
  if (ffx && tab === "prep") displayed = [data.items, data.arena, data.progress?.wantz, data.progress?.darkAeons,
    data.party.map(m => [m.id, m.active, m.maxHp, m.attributes, m.gear, m.fiendsDefeated, m.overdriveMode, m.overdriveModes, m.overdriveRemaining])];
  if (ffx && tab === "prep" && prepPlan === "yojimbo") displayed =
    [data.gil, data.progress?.yojimboCompatibility, data.progress?.optionalAeons, zanmatoFoes(data)];
  if (ffx && tab === "grid") displayed = [data.grid, data.gridPositions, data.gridLinks, data.items, data.party.map(m => [m.id, m.sphereLevel, m.attributes])];
  if (ffx && tab === "equip") displayed = equipmentView === "customize" ?
    [data.items, data.party.map(m => [m.id, m.gear])] : data.party.map(m => [m.id, m.gear]);
  if (loadout && tab === "equip") displayed = [loadout, dressphereAp, data.chapter, data.battle,
    data.battle && data.party.map(actor => [actor.id, actor.active, actor.job])];
  if (loadout && tab === "party") {
    displayed = [data.party, data.battle, loadout.party.map(m => [m.xp, m.xpToNext]), loadout.dressphereInfo];
  }
  if (ffx && tab === "arena") displayed = [data.arena, data.enemies?.filter(m => m.hp > 0).map(m => m.id),
    arenaView === "farming" && data.items, arenaView === "farming" && data.party.map(m => [m.id,m.gear])];
  if (ffx && tab === "arena" && arenaView === "hunt") displayed = [
    reconnecting, data.arena, data.room, data.disc, data.crc, data.battle, data.paused, !!fieldMap, data.turnOrder, data.enemies,
    data.battle && data.party.map(m => [m.id,m.active,m.hp > 0,m.statusBits,m.statusTimed,m.gear]), huntSession?.fights
  ];
  if (ffx && tab === "bestiary") displayed = [data.arena?.slice(1024), data.enemies?.map(m => m.id),
    bestiaryMode === "items" && data.items];
  if (ffx && tab === "bestiary" && bestiaryMode === "gear") displayed = [data.disc, data.arena, data.items, data.progress?.darkAeons,
    data.party.map(member => [member.id,member.gear]), data.enemies?.filter(foe => foe.hp > 0).map(foe => foe.id)];
  const panelState = tab === "map" && state === "live" ? "live" : visibleState;
  const key = JSON.stringify([tab, panelState, displayed, frame?.game, folder, error, tab === "journal" ? visits : [],
    typeof coachReturn === "undefined" ? null : coachReturn && [coachReturn.tab,coachReturn.fullscreen]]);
  if (key === signature) {
    if (tab === "mix" && hasMix) updateMix?.(current);
    if (tab === "bestiary" && ffx) updateBestiary?.(current);
    return;
  }
  signature = key;
  const expansionUi=typeof rememberExpansionUi==="function"?rememberExpansionUi():null;
  const turnScroll = tab === "status" ? panel.querySelector(".ctb-list")?.scrollLeft : 0;
  releaseFieldMap?.();
  releaseFieldMap = null;
  updateFieldMarker = null;
  updateMix = null;
  updateBestiary = null;
  for (const button of nav) {
    if (button.hasAttribute("data-ffx")) button.hidden = !ffx && button.dataset.tab !== tab;
    if (button.hasAttribute("data-mix")) button.hidden = !hasMix && button.dataset.tab !== tab;
    if (button.dataset.tab === "equip") button.hidden = !ffx && !loadout && tab !== "equip";
    if (button.hasAttribute("data-ps2")) button.hidden = !current?.disc && button.dataset.tab !== tab;
    if (button.hasAttribute("data-progress")) button.hidden = !current?.progress && button.dataset.tab !== tab;
    if (button.dataset.tab === "chapter-checklist") button.hidden = !(current?.game === "x2" && current?.chapter);
    if (button.dataset.tab === "field-guide") button.hidden = !oversoul;
    if (button.dataset.tab === "challenges") {
      button.hidden = !ffx && current?.game !== "x2" && tab !== "challenges";
    }
    if (button.dataset.tab === "x2-bestiary") button.hidden = current?.game !== "x2" || !current.disc;
    if (button.dataset.tab === "cheats") button.hidden = !window.SpiraCheats?.visible();
    if (button.dataset.tab === tab) button.setAttribute("aria-current", "page");
    else if (fieldPlan && button.dataset.tab===fieldPlanOrigin) button.setAttribute("aria-current","location");
    else button.removeAttribute("aria-current");
  }
  if (typeof rememberCoachUi === "function") rememberCoachUi();
  panel.replaceChildren();
  if (tab === "setup") setup();
  else if (tab === "profiles") showProfiles();
  else if (tab === "workspace") showWorkspace(current);
  else if (fieldPlan) showFieldPlan(current,fieldPlan);
  else if (tab === "grid-lab") showGridSandbox(current);
  else if (tab === "planner") showJourney(current);
  else if (tab === "battle-lab") showBattleComparison(current);
  else if (tab === "trials") showCloister(current);
  else if (tab === "cheats" && window.SpiraCheats) window.SpiraCheats.show(current, visibleState);
  else if (tab === "journal") journal();
  else if (!current) waiting();
  else if (tab === "supplies") supplies(current);
  else if (tab === "mix" && hasMix) {
    updateMix = showMix(current, mixQuery);
    updateMix(current);
  }
  else if (tab === "equip" && ffx) showEquipment(current);
  else if (tab === "equip" && loadout) showX2Equipment(current);
  else if (tab === "prep" && ffx) showPrep(current);
  else if (tab === "grid" && ffx) showGrid(current);
  else if (tab === "bestiary" && ffx) updateBestiary = showBestiary(current);
  else if (tab === "x2-bestiary" && current.game === "x2" && current.disc) showX2Bestiary(current);
  else if (tab === "arena" && ffx) showArena(current);
  else if (tab === "missables" && current.progress) showMissables(current);
  else if (tab === "collections" && current.progress) showCollections(current);
  else if (tab === "chapter-checklist" && current.game === "x2" && current.chapter) showX2ChapterChecklist(current);
  else if (tab === "field-guide" && oversoul) showX2FieldGuide(current);
  else if (tab === "blitzball" && ffx) showBlitzball(current);
  else if (tab === "challenges" && ffx) showChallenges(current);
  else if (tab === "challenges" && current.game === "x2") showX2Challenges(current);
  else if (tab === "map" && current.disc) showFieldMap(current);
  else if (tab === "party") {
    heading("Party", catalog[current.game].title);
    panel.append(element("h2", "", "Formation"));
    partyList(current, false);
    if (ffx) {
      showXOverdriveModes(current);
      showCommands(current);
    }
    else if (loadout && !current.battle) showX2LevelProgress(current);
  } else {
    const top = element("div", "status-heading");
    const location = element("div");
    location.append(element("h1", "", roomName(current)),
      element("p", "sub", [catalog[current.game].title, current.edition].filter(Boolean).join(" · ")));
    top.append(location);
    if (current.disc && !fieldMap && !current.battle) {
      top.append(action("Open map", () => choose("map")));
    }
    panel.append(top);
    const coached = current.disc && typeof showLiveCoach === "function" ? showLiveCoach(current) : null;
    const overview = element("div", "status-overview");
    const fieldSummary = element("div", "status-field-summary");
    if (!current.battle) {
      fieldSummary.append(statList(current));
      if (current.disc === "SLPS-25088" && current.room === 290)
        fieldSummary.append(action("Remiem race navigator", () => choose("plan-remiem")));
      if (hasCaptureData(current) && (current.room === 307 ||
          localHuntSpots(current.room).length && captureRoster(current).length)) {
        fieldSummary.append(action("Scout fiends", () => openArenaHunt()));
      }
    }
    if (!current.battle && current.game === "x2" && current.chapter) {
      const tools = element("div", "filters");
      tools.append(action("Check Chapter " + current.chapter, () => openX2ChapterChecklist()));
      if (current.disc === "SLUS-20672" && current.chapter === 5 && current.room === 249)
        tools.append(action("Thunder Plains wall solver", () => choose("plan-walls")));
      if (current.disc === "SLUS-20672" && /^Besaid\b/i.test(roomName(current)))
        tools.append(action("Besaid cipher notebook", () => choose("plan-ciphers")));
      if (oversoul) tools.append(action("Track Oversouls", () => openX2FieldGuide("oversoul")));
      if (loadout && x2DressphereHunt(current).some(row => ["Chapter deadline","Prepare now"].includes(row.state))) {
        tools.append(action("Check dressphere deadlines", openX2DressphereHunt));
      }
      const crimson = x2CrimsonProgress(current);
      if (crimson) {
        const deadline = crimson.find(record => record.window === "Chapter deadline");
        const label = deadline ? `Crimson Sphere #${deadline.id} · Chapter deadline` : "Crimson Spheres";
        tools.append(action(label, openX2CrimsonRoute));
      }
      const region = x2CampaignRegion(current);
      if ([3,5].includes(current.chapter) && region === "Luca") {
        tools.append(action("Sphere Break", () => openX2Challenge("sphere-break", current)));
      }
      if (current.calmLands && (region || roomName(current).startsWith("Calm Lands"))) {
        tools.append(action("Campaign answers", () => openX2Challenge("publicity", current)));
      }
      if (current.calmLands && roomName(current).startsWith("Calm Lands")) {
        tools.append(action("Chocobo Ranch", () => openX2Challenge("ranch", current)));
      }
      fieldSummary.append(tools);
    }
    if (current.progress?.challenges && !current.battle) {
      const challenge = challengeHere(current.room);
      if (challenge) fieldSummary.append(action(challenge.name, () => openChallenges(challenge.id)));
    }
    if (!current.battle) {
      if (coached !== "story") showStoryHint(current, fieldSummary);
      overview.append(fieldSummary);
      if (fieldMap) showStatusMap(current, overview);
      panel.append(overview);
    }
    if (ffx && current.battle) showXTurnOrder(current, turnScroll);
    if (ffx && current.battle) {
      panel.append(action("Compare battle actions", () => choose("battle-lab")));
      showApParticipation(current);
    }
    if (current.battle) showBattleTarget(current);
    if (current.battle) showStoryHint(current, panel, !!current.disc);
    if (ffx && current.battle) {
      showCaptureAssist(current, huntBattleTargets(current));
      showBattleOpportunities(current);
    }
    if (ffx && xAeons[current.turnOrder?.[0] - 8] === "Yojimbo" && (current.progress?.optionalAeons & 2)) {
      panel.append(action("Plan a Zanmato payment", () => openPrep("yojimbo")));
    }
    if (oversoul && current.battle) showX2BlueOpportunity(current);
    if (current.battle && current.experiment && current.enemies?.some(foe => foe.name === "Experiment" && foe.hp > 0)) {
      panel.append(action("Experiment levels", () => openX2Challenge("experiment", current)));
    }
    if (current.battle && loadout?.gridInfo && current.party.some(actor => actor.active && actor.id < 3)) {
      panel.append(action("Plan a spherechange", () => openX2BattleGrid(current)));
    }
    if (current.battle) showBattleTactics(current);
    if (current.disc) showTrackedFiend(current);
    if (current.progress) showMissables(current, true);
    panel.append(element("h2", "", current.battle ? "Battle party" : "Front line"));
    partyList(current, true);
    if (ffx) showField(current);
    else if (current.game === "x2") showSequelBattle(current);
    if (current.battle) panel.append(statList(current));
  }
  if (typeof fieldPlanLinks === "function") fieldPlanLinks(current);
  if (typeof guideReturnAction === "function" && !(typeof coachReturn !== "undefined" && coachReturn?.tab === "guide")) guideReturnAction();
  if (typeof coachReturnAction === "function") coachReturnAction();
  if(typeof restoreExpansionUi==="function")restoreExpansionUi(expansionUi);
}

for (const button of nav) button.addEventListener("click", () => choose(button.dataset.tab));
window.Spira = {update, setupError(message) { error = message; choose("setup"); }};
render();
