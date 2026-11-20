"use strict";

let ffxCharacter = 0;
let bestiaryArea = "";
let bestiaryQuery = "";
let bestiarySource = "";
let bestiaryBribeTarget = null;
let bestiaryMode = "fiends";
let selectedGridNode = null;
let updateFieldMarker = null;
let releaseFieldMap = null;
let followPlayer = false;
const discoveredExits = new Map();
const exitStorageKey = "spira.exits.v2";
let lastFieldPosition;

function roomExits(disc, room, create = false) {
  const key = `${disc}/${room}`;
  if (create && !discoveredExits.has(key)) discoveredExits.set(key, new Map());
  return discoveredExits.get(key);
}

try {
  const saved = JSON.parse(localStorage.getItem(exitStorageKey) || "[]");
  for (const [disc, room, destination, x, y] of saved.slice(0, 512)) {
    if (typeof disc !== "string") continue;
    if (![room, destination, x, y].every(Number.isInteger)) continue;
    roomExits(disc, room, true).set(destination, {x, y});
  }
  const original = JSON.parse(localStorage.getItem("spira.ffx-international.exits.v1") || "[]");
  for (const [room, destination, x, y] of original.slice(0, 512)) {
    if ([room, destination, x, y].every(Number.isInteger)) {
      const exits = roomExits("SLPS-25088", room, true);
      if (!exits.has(destination)) exits.set(destination, {x, y});
    }
  }
} catch { /* Local storage is optional. */ }

function rememberExit(previous, next) {
  if (!next.disc || next.battle) {
    lastFieldPosition = null;
    return;
  }
  if (!previous || previous.disc !== next.disc || next.battles < previous.battles || next.story < previous.story) {
    lastFieldPosition = null;
  }
  const last = lastFieldPosition;
  if (last && last.disc === next.disc && previous?.disc === next.disc && previous.status === "live" &&
      last.room === next.previousRoom && last.room !== next.room &&
      next.timestamp >= last.timestamp && next.timestamp - last.timestamp <= 2500) {
    const exits = roomExits(next.disc, last.room, true);
    if (!exits.has(next.room)) {
      exits.set(next.room, last.position);
      const rows = [...discoveredExits].flatMap(([key, destinations]) => {
        const [disc, room] = key.split("/");
        return [...destinations].map(([destination, {x, y}]) => [disc, Number(room), destination, x, y]);
      });
      try { localStorage.setItem(exitStorageKey, JSON.stringify(rows.slice(-512))); } catch { /* Keep the in-memory copy. */ }
    }
  }
  if (next.fieldPlayer) {
    lastFieldPosition = {disc: next.disc, room: next.room, timestamp: next.timestamp, position: next.fieldPlayer};
  } else if (last?.room !== next.room) {
    lastFieldPosition = null;
  }
}
let gearFocus = "all";
let equipmentView = "gear";

const permanentEffects = ["KO","Zombie","Petrify","Poison","Power Break","Magic Break","Armor Break",
  "Mental Break","Confuse","Berserk","Provoke","Threaten"];
const timedEffects = ["Sleep","Silence","Darkness","Shell","Protect","Reflect","NulTide","NulBlaze",
  "NulShock","NulFrost","Regen","Haste","Slow"];
const sequelEffects = ["KO", "Petrify", "Sleep", "Silence", "Darkness", "Poison", "Confusion", "Berserk",
  "Curse", "Guard", "Eject", "Double HP", "Double MP", "Spellspring", "Damage 9999", "Critical",
  "No EXP", "Changing dressphere", "Auto-Life"];
const sequelTimedEffects = ["Shell", "Protect", "Reflect", "Regen", "Haste", "Slow", "Stop"];

function statusEffects(game, actor) {
  const permanent = game === "x2" ? sequelEffects : permanentEffects;
  const timed = game === "x2" ? sequelTimedEffects : timedEffects;
  return [...permanent.filter((_, i) => actor.statusBits & (1 << i)),
    ...timed.filter((_, i) => actor.statusTimed & (1 << i))].join(" · ");
}

function entry(title, detail, body) {
  const row = element("div", "entry");
  row.append(element("strong", "", title));
  if (detail) row.append(element("p", "detail", detail));
  if (body) row.append(element("p", "", body));
  return row;
}

function options(label, values, current, change) {
  const select = element("select");
  select.setAttribute("aria-label", label);
  for (const [value, title] of values) {
    const option = element("option", "", title);
    option.value = value;
    select.append(option);
  }
  select.value = current;
  select.addEventListener("change", () => change(select.value));
  return select;
}

function selectMember(current, bar) {
  const party = current.party.filter(member => member.id < 7);
  const selected = party.find(member => member.id === ffxCharacter) || party[0];
  if (!selected) return null;
  ffxCharacter = selected.id;
  bar.append(options("Character", party.map(m => [m.id, catalog.x.party[m.id]]), selected.id, value => {
    ffxCharacter = Number(value);
    selectedGridNode = null;
    signature = "";
    render();
  }));
  return selected;
}

function gearName(piece, id) {
  const kind = piece.type === 0 ? "Weapon" : "Armor";
  const name = ffxData.equipment[piece.name]?.[catalog.x.party[id]];
  return name && name !== "-" ? name : kind;
}

function showEquipment(current) {
  heading("Equipment", "Equipped gear and alternatives in your inventory");
  const views = element("div", "filters");
  for (const [value, title] of [["gear","Owned gear"],["optimize","Compare gear"],["customize","Customize"]]) {
    const button = action(title, () => {
      equipmentView = value;
      panel.scrollTop = 0;
      signature = "";
      render();
    });
    button.setAttribute("aria-pressed", String(equipmentView === value));
    views.append(button);
  }
  views.append(action("Boss Prep", () => openPrep()));
  panel.append(views);
  if (equipmentView === "optimize") {
    showFfxEquipCompare(current);
    return;
  }
  if (equipmentView === "customize") {
    showCustomization(current);
    return;
  }
  const filters = element("div", "filters");
  const member = selectMember(current, filters);
  const priorities = {
    all: ["All gear", null],
    physical: ["Physical damage", /Strength \+|Piercing|Counterattack|Evade & Counter/],
    magic: ["Magic damage", /^Magic \+|Magic Booster|One MP Cost|Half MP Cost|Magic Counter/],
    survival: ["Survival", /HP \+|Defense \+|Auto-(Protect|Shell|Phoenix|Regen)|Proof$|Ward$/],
    capture: ["Fiend capture", /^Capture$/]
  };
  filters.append(options("Equipment focus", Object.entries(priorities).map(([id,[label]]) => [id,label]),
    gearFocus, value => { gearFocus = value; signature = ""; render(); }));
  panel.append(filters);
  if (!member) return;
  const focus = priorities[gearFocus][1];
  const abilitiesFor = piece => piece.abilities.map(id => id == null ? "Empty slot" :
    ffxData.abilities[id] || "Ability " + id.toString(16));
  for (const [type, title] of [[0,"Weapons"],[1,"Armor"]]) {
    panel.append(element("h2", "", title));
    const sheet = element("div", "sheet");
    const gear = member.gear.filter(piece => piece.type === type).map(piece => {
      const abilities = abilitiesFor(piece);
      return {piece, abilities, matches: focus ? abilities.filter(name => focus.test(name)).length : 0};
    }).filter(({piece,matches}) => !focus || piece.equipped || matches)
      .sort((a,b) => Number(b.piece.equipped) - Number(a.piece.equipped) || b.matches - a.matches);
    for (const {piece, abilities, matches} of gear) {
      const label = [piece.equipped ? "Equipped" : "", matches ? priorities[gearFocus][0] : ""].filter(Boolean).join(" · ");
      sheet.append(entry(gearName(piece, member.id), label, abilities.join(" · ")));
    }
    if (sheet.childElementCount) panel.append(sheet);
    else panel.append(element("p", "", focus ? "No matching equipment in this slot." : "No equipment found for this slot."));
  }
}

function showCommands(current) {
  panel.append(element("h2", "", "Learned commands"));
  const sheet = element("div", "sheet");
  for (const member of current.party) {
    const names = member.commands?.map(id => ffxData.commands[id]).filter(Boolean) || [];
    if (names.length) sheet.append(entry(catalog.x.party[member.id], "", names.join(" · ")));
  }
  if (sheet.childElementCount) panel.append(sheet);
  else panel.append(element("p", "", "No additional commands learned yet."));
}

function enemyNotes(enemy) {
  if (!enemy) return "";
  return [...(enemy.armored ? ["Armored"] : []), ...Object.entries(enemy.affinities)
    .map(([element, affinity]) => affinity + " " + element)].join(" · ");
}

function enemyName(id) {
  return ffxData.enemies[id]?.name || "Fiend " + id;
}

function isFiend(enemy) {
  return !enemy || (enemy.name !== "Cid" && !/^(Dummy|[-?])/i.test(enemy.name));
}

function isSelectedFoe(foe) {
  return foe.targeted && foe.hp > 0;
}

function showSequelBattle(current) {
  if (!current.enemies?.length) return;
  const sheet = element("div", "sheet");
  for (const foe of current.enemies) {
    if (isSelectedFoe(foe)) continue;
    const label = [foe.level > 0 ? "Lv. " + foe.level : "", foe.hp === 0 ? "Defeated" : "",
      foe.hp > 0 ? statusEffects("x2", foe) : ""].filter(Boolean).join(" · ");
    const row = entry(battleEnemyName(current, foe), label);
    row.append(metric("HP", foe.hp, foe.maxHp));
    if (foe.maxMp > 0) row.append(metric("MP", foe.mp, foe.maxMp));
    if (current.disc && foe.name) row.append(action("Look up " + foe.name, () => openX2Bestiary(foe.name, foe)));
    sheet.append(row);
  }
  if (sheet.childElementCount) panel.append(element("h2", "", "Battle enemies"), sheet);
}

function battleEnemyName(current, foe) {
  const name = current.game === "x" ? enemyName(foe.id) : foe.name || "Fiend " + foe.id;
  const sameName = current.enemies.filter(other => other.name === foe.name && other.id === foe.id);
  return sameName.length > 1 ? name + " " + String.fromCharCode(65 + sameName.indexOf(foe)) : name;
}

const xAeons = ["Valefor", "Ifrit", "Ixion", "Shiva", "Bahamut", "Anima", "Yojimbo", "Cindy", "Sandy", "Mindy"];

function xTurnName(current, id) {
  const foe = current.enemies?.find(actor => actor.battleId === id);
  return foe ? battleEnemyName(current,foe) :
    catalog.x.party[id] || xAeons[id - 8] || (id >= 20 ? "Enemy " + (id - 19) : "Actor " + (id + 1));
}
function showXTurnOrder(current, scroll) {
  if (!current.turnOrder?.length) return;
  const section = element("section", "ctb");
  section.append(element("h2", "", "Turn order"));
  const turns = element("ol", "ctb-list");
  for (const [index, id] of current.turnOrder.entries()) {
    const name = xTurnName(current,id);
    const row = element("li", id >= 20 && name !== "Cid" ? "ctb-enemy" : "");
    row.append(element("span", "ctb-number", index === 0 ? "Now" : String(index + 1)),
      element("span", "ctb-name", name));
    if (index === 0) row.setAttribute("aria-current", "step");
    turns.append(row);
  }
  turns.tabIndex = 0;
  turns.setAttribute("aria-label", "Upcoming turns, scroll for more");
  section.append(turns);
  panel.append(section);
  if (scroll) turns.scrollLeft = scroll;
}

function showBattleTarget(current) {
  const foes = (current.enemies || []).filter(foe => isSelectedFoe(foe) &&
    (current.game === "x2" || isFiend(ffxData.enemies[foe.id])));
  const allies = (current.party || []).filter(member => member.active !== false && member.targeted);
  const count = foes.length + allies.length;
  if (count === 0) return;
  const group = element("section", "battle-targets");
  group.append(element("h2", "", count === 1 ? "Selected target" : `Selected targets · ${count}`));
  for (const actor of [...foes, ...allies]) {
    const ally = allies.includes(actor);
    const name = ally ? partyName(current, actor) : battleEnemyName(current, actor);
    const reference = current.game === "x" && !ally ? ffxData.enemies[actor.id] : null;
    const effects = statusEffects(current.game, actor);
    const sequelInfo = !ally && current.game === "x2" && typeof x2TargetReference === "function" ?
      x2TargetReference(current, actor) : "";
    const detail = [effects, reference ? enemyNotes(reference) : sequelInfo].filter(Boolean).join(" · ");
    const row = element("div", "battle-target");
    const title = element("div");
    title.append(element("strong", "", name));
    const level = actor.level || reference?.level;
    if (detail || level) title.append(element("small", "target-detail", [level ? "Lv. " + level : "", detail].filter(Boolean).join(" · ")));
    row.append(title, metric("HP", actor.hp, actor.maxHp));
    if ((ally || current.game === "x2") && actor.maxMp > 0) row.append(metric("MP", actor.mp, actor.maxMp));
    if (reference) {
      const facts = element("div", "target-facts");
      if (reference.steal?.length) {
        const names = [...new Set(reference.steal.map(([item]) => item))].join(", ");
        facts.append(element("span", "", "Steal · " + names));
      }
      if (reference.overkill > 1) {
        facts.append(element("span", "", "Overkill · " + number.format(reference.overkill) + " damage"));
      }
      if (reference.bribe) facts.append(action("Plan bribe · " + reference.bribe[0], () => {
        choose("bestiary", reference.name, actor.id);
      }));
      if (current.disc === "SLPS-25088" && gearDropProfile(actor.id)) {
        facts.append(action("Gear drops", () => openGearDrops("", actor.id)));
      }
      if (facts.childElementCount) row.append(facts);
    }
    if (!ally && current.game === "x2" && current.disc && actor.name) {
      row.append(action("Look up " + actor.name, () => openX2Bestiary(actor.name, actor)));
    }
    group.append(row);
  }
  panel.append(group);
}

function showField(current) {
  const foes = (current.enemies || []).filter(foe => isFiend(ffxData.enemies[foe.id]));
  const sheet = element("div", "sheet");
  for (const foe of foes) {
    if (isSelectedFoe(foe)) continue;
    const enemy = ffxData.enemies[foe.id];
    const row = entry(battleEnemyName(current, foe), [foe.hp === 0 ? "Defeated" : statusEffects("x", foe), enemyNotes(enemy)]
      .filter(Boolean).join(" · "), "");
    row.append(metric("HP", foe.hp, foe.maxHp));
    sheet.append(row);
  }
  if (sheet.childElementCount) panel.append(element("h2", "", "Battle enemies"), sheet);
  const host = element("div", "section-heading");
  host.append(element("h2", "", "Recent areas"));
  panel.append(host);
  const locations = visits.filter(visit => visit.game === "x").slice(0,4);
  const last = current.previousRoom;
  if (locations.length === 1 && last > 0 && last !== current.room) {
    locations.push({game:"x", room:last});
  }
  if (locations.length) {
    const strip = element("div", "sheet");
    locations.forEach((visit, i) => strip.append(entry(roomName(visit), i === 0 ? "Current area" : "", "")));
    panel.append(strip);
  }
}

function unpackMap(encoded) {
  const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  return new DataView(bytes.buffer);
}

let lastTerrain;
const explorationKey = "spira.explored-rooms.v1";
const exploredRooms = new Map();
let exploredOnly = false;
try {
  exploredOnly = localStorage.getItem("spira.explored-only") === "true";
  for (const [key, cells] of JSON.parse(localStorage.getItem(explorationKey) || "[]").slice(-100)) {
    if (typeof key === "string" && Array.isArray(cells)) {
      exploredRooms.set(key, new Set(cells.filter(cell => Number.isInteger(cell) && cell >= 0 && cell < 576)));
    }
  }
} catch { /* Local storage is optional. */ }

function fieldTerrain(current) {
  const map = current.fieldMap;
  if (!map || typeof map.vertices !== "string" || typeof map.triangles !== "string") return null;
  if (lastTerrain?.vertices === map.vertices && lastTerrain?.triangles === map.triangles) return lastTerrain;
  let vertexData, triangleData;
  try {
    vertexData = unpackMap(map.vertices);
    triangleData = unpackMap(map.triangles);
  } catch { return null; }
  const points = [];
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  const edges = new Map();
  const path = new Path2D();
  for (let i = 0; i + 3 < vertexData.byteLength; i += 4) {
    points.push([vertexData.getInt16(i, true), vertexData.getInt16(i + 2, true)]);
  }
  for (let i = 0; i + 5 < triangleData.byteLength; i += 6) {
    const [a,b,c] = [0,2,4].map(offset => points[triangleData.getUint16(i + offset, true)]);
    if (!a || !b || !c) continue;
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (!area) continue;
    path.moveTo(...a);
    path.lineTo(...(area > 0 ? b : c));
    path.lineTo(...(area > 0 ? c : b));
    path.closePath();
    for (const [x,y] of [a,b,c]) {
      bounds[0] = Math.min(bounds[0], x);
      bounds[1] = Math.min(bounds[1], y);
      bounds[2] = Math.max(bounds[2], x);
      bounds[3] = Math.max(bounds[3], y);
    }
    for (const [start,end] of [[a,b],[b,c],[c,a]]) {
      const key = [start.toString(), end.toString()].sort().join("/");
      if (edges.has(key)) edges.get(key).count++;
      else edges.set(key, {start, end, count:1});
    }
  }
  if (!Number.isFinite(bounds[0])) return null;
  const boundary = new Path2D();
  for (const {start,end,count} of edges.values()) {
    if (count !== 1) continue;
    boundary.moveTo(...start);
    boundary.lineTo(...end);
  }
  lastTerrain = {vertices:map.vertices, triangles:map.triangles, path, boundary, bounds,
    step:Math.max(bounds[2] - bounds[0], bounds[3] - bounds[1]) / 24};
  return lastTerrain;
}

function explorationRoom(current, terrain) {
  return [current.disc, current.room, current.fieldMap.unit, ...terrain.bounds,
    terrain.vertices.slice(0,24), terrain.triangles.length].join("/");
}

function fieldExplorationCell(terrain, point) {
  const [left,top,right,bottom] = terrain.bounds;
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
      point.x < left || point.x > right || point.y < top || point.y > bottom) return -1;
  const x = Math.min(23, Math.floor((point.x - left) / terrain.step));
  const y = Math.min(23, Math.floor((point.y - top) / terrain.step));
  return y * 24 + x;
}

function rememberFieldExploration(current) {
  if (!current.disc || current.battle || !current.fieldPlayer) return;
  const terrain = fieldTerrain(current);
  if (!terrain) return;
  const cell = fieldExplorationCell(terrain, current.fieldPlayer);
  if (cell < 0) return;
  const key = explorationRoom(current, terrain);
  const cells = exploredRooms.get(key) || new Set();
  if (cells.has(cell)) return;
  cells.add(cell);
  exploredRooms.delete(key);
  exploredRooms.set(key, cells);
  if (exploredRooms.size > 100) exploredRooms.delete(exploredRooms.keys().next().value);
  try {
    localStorage.setItem(explorationKey, JSON.stringify([...exploredRooms].map(([room, points]) => [room,[...points]])));
  } catch { /* Keep in-memory exploration. */ }
}

function showStatusMap(current, parent) {
  const terrain = fieldTerrain(current);
  if (!terrain || current.battle) return;
  const preview = action("Open field map", () => choose("map"));
  preview.classList.add("status-map");
  parent.append(preview);
  drawFieldMap(terrain, current, visibleExits(current), preview, true);
}

function visibleExits(current) {
  const recorded = roomExits(current.disc, current.room) || new Map();
  const scripted = (current.fieldExits || []).filter(exit =>
    current.game === "x" ? !!ffxRooms[exit.room] : !!catalog.x2.rooms[exit.room]);
  const destinations = new Set(scripted.map(exit => exit.room));
  const visitedTriggers = new Map();
  for (const [room, position] of recorded) {
    const options = scripted.filter(exit => exit.room === room);
    let nearest, distance = Infinity;
    for (const exit of options) {
      const nextDistance = Math.hypot(exit.x - position.x, exit.y - position.y);
      if (nextDistance < distance) {
        nearest = exit.trigger;
        distance = nextDistance;
      }
    }
    if (nearest !== undefined) visitedTriggers.set(room, nearest);
  }
  return [...scripted.map(exit => ({...exit, key: `script/${exit.trigger}`, used: visitedTriggers.get(exit.room) === exit.trigger})),
    ...[...recorded].filter(([room]) => !destinations.has(room))
      .map(([room, exit]) => ({...exit, room, key: `used/${room}`, used: true}))]
    .map(exit => current.game === "x" ? {...exit, gate:ffxExitGate(current, exit.room)} : exit);
}

function showFieldMap(current) {
  heading(roomName(current), current.fieldMap?.mesh ? "Walkable terrain" : "Field map");
  const exits = visibleExits(current);
  let focusExit;
  const objective = fieldObjective(current);
  if (objective) panel.append(entry("Next objective", "", objective));
  const terrain = fieldTerrain(current);
  if (terrain) focusExit = drawFieldMap(terrain, current, exits);
  else panel.append(element("p", "section-copy", "No field outline is available in this room."));
  showTrackedFiend(current);
  if (exits.length) {
    panel.append(element("h2", "", "Exits"));
    const sheet = element("div", "sheet exit-list");
    for (const exit of exits) {
      const name = roomName({game:current.game, room:exit.room});
      if (!focusExit) sheet.append(entry(name, exit.gate));
      else {
        const button = element("button", "exit-row", name);
        button.setAttribute("aria-label", "Show exit to " + name + " on map" + (exit.gate ? " · " + exit.gate : ""));
        if (exit.gate || exit.used) button.append(element("span", "exit-used", exit.gate || "Visited"));
        button.addEventListener("click", () => focusExit(exit));
        sheet.append(button);
      }
    }
    panel.append(sheet);
  } else if (focusExit) {
    panel.append(element("p", "field-note", "The map remembers exits as you use them."));
  }
  const destinations = fieldDestinations(current, exits);
  if (destinations.length) {
    panel.append(element("h2", "", "Routes from here"));
    const sheet = element("div", "sheet");
    for (const [room, directions] of destinations) {
      sheet.append(entry(roomName({game:current.game, room}), ffxExitGate(current, room), directions));
    }
    panel.append(sheet);
  }
  if (current.previousRoom > 0 && current.previousRoom !== current.room) {
    panel.append(element("h2", "", "Previous area"));
    const sheet = element("div", "sheet");
    sheet.append(entry(roomName({game:current.game, room:current.previousRoom})));
    panel.append(sheet);
  }
}

function drawFieldMap(terrain, current, exits, host = panel, preview = false) {
  const canvas = element("canvas", "grid-canvas field-map");
  canvas.setAttribute("aria-label", "Field map with player position and discovered exits. Drag to pan.");
  const {bounds, path, boundary, step} = terrain;
  const room = explorationRoom(current, terrain);
  const controls = element("div", "filters map-controls");
  const zoomIn = action("+", () => zoom(1.4));
  const zoomOut = action("−", () => zoom(1 / 1.4));
  zoomIn.setAttribute("aria-label", "Zoom in");
  zoomOut.setAttribute("aria-label", "Zoom out");
  let player = current.fieldPlayer;
  let selectedExit;
  const follow = action("Follow", () => {
    if (!player) return;
    followPlayer = !followPlayer;
    if (followPlayer) {
      selectedExit = undefined;
      centerOn(player);
    }
    syncControls();
    paint();
  });
  follow.setAttribute("aria-label", "Follow player");
  const explored = action("Explored only", () => {
    exploredOnly = !exploredOnly;
    try { localStorage.setItem("spira.explored-only", String(exploredOnly)); } catch {}
    syncControls();
    paint();
  });
  controls.append(zoomIn, zoomOut, action("Fit", () => {
    followPlayer = false;
    selectedExit = undefined;
    fit();
  }), follow, explored);
  const legend = element("p", "map-legend");
  const explorationNote = element("span", "", "Exploration recorded by Spira");
  const playerLegend = element("span", "legend-player", "You are here");
  legend.append(playerLegend);
  if (exits.length) legend.append(element("span", "legend-exit", "Exit"));
  if (exits.some(exit => exit.gate)) legend.append(element("span", "legend-gate", "Guarded"));
  legend.append(explorationNote);
  if (preview) {
    canvas.setAttribute("aria-hidden", "true");
    host.prepend(canvas);
  } else host.append(controls, canvas, legend);
  let width, height;
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext("2d");
  let scale, baseScale, panX, panY, drag;
  function centerOn(point) {
    panX = point.x;
    panY = point.y;
  }
  function syncControls() {
    follow.disabled = !player;
    follow.setAttribute("aria-pressed", String(followPlayer));
    explored.setAttribute("aria-pressed", String(exploredOnly));
    explorationNote.hidden = !exploredOnly;
    playerLegend.hidden = !player;
    zoomIn.disabled = scale >= baseScale * 12;
    zoomOut.disabled = scale <= baseScale / 2;
  }
  function fit(preserveView = false) {
    const ratio = preserveView && baseScale ? scale / baseScale : 1;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!preserveView || panX === undefined) {
      panX = (bounds[0] + bounds[2]) / 2;
      panY = (bounds[1] + bounds[3]) / 2;
    }
    baseScale = Math.min((width - 34) / (bounds[2] - bounds[0]), (height - 34) / (bounds[3] - bounds[1]));
    scale = baseScale * ratio;
    if (!preview && followPlayer && player) centerOn(player);
    syncControls();
    paint();
  }
  function zoom(factor) {
    scale = Math.max(baseScale / 2, Math.min(baseScale * 12, scale * factor));
    syncControls();
    paint();
  }
  function paint() {
    ctx.clearRect(0, 0, width, height);
    const point = ([x,y]) => [width / 2 + (x - panX) * scale, height / 2 + (y - panY) * scale];
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-panX, -panY);
    const seen = exploredRooms.get(room);
    const fog = exploredOnly && !!seen?.size;
    if (fog) {
      const revealed = new Path2D();
      for (const cell of seen) {
        const x = bounds[0] + (cell % 24 + 0.5) * step;
        const y = bounds[1] + (Math.floor(cell / 24) + 0.5) * step;
        revealed.moveTo(x + step, y);
        revealed.arc(x, y, step, 0, 2 * Math.PI);
      }
      ctx.clip(revealed);
    }
    ctx.fillStyle = "#325b67";
    ctx.fill(path);
    ctx.strokeStyle = "#54818b";
    ctx.lineWidth = .5 / scale;
    ctx.stroke(boundary);
    ctx.restore();
    for (const exit of exits) {
      if (fog && !exit.used && !seen.has(fieldExplorationCell(terrain, exit))) continue;
      const [x,y] = point([exit.x, exit.y]);
      if (x < 0 || x > width || y < 0 || y > height) continue;
      const color = exit.gate ? "#b7c9c8" : "#91e1cf";
      ctx.fillStyle = color;
      if (exit.gate) {
        ctx.beginPath();
        ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4);
        ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (exit.used) ctx.fillRect(x - 3, y - 3, 6, 6);
      else {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - 3, y - 3, 6, 6);
      }
      if (selectedExit === exit.key) {
        ctx.strokeStyle = "#eff5ef";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - 6, y - 6, 12, 12);
      }
      if (preview) continue;
      ctx.font = "600 12px Roboto, sans-serif";
      ctx.textAlign = x > width / 2 ? "right" : "left";
      const name = roomName({game:current.game, room:exit.room});
      const labelX = Math.max(8, Math.min(width - 8, x + (x > width / 2 ? -9 : 9)));
      const labelY = y < 18 ? y + 16 : y - 7;
      ctx.strokeStyle = "#10262e";
      ctx.lineWidth = 3;
      ctx.strokeText(name, labelX, labelY);
      ctx.fillText(name, labelX, labelY);
    }
    if (player) {
      const [x,y] = point([player.x, player.y]);
      ctx.beginPath();
      ctx.arc(x,y,6,0,Math.PI * 2);
      ctx.fillStyle = "#f4cc90";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#101e25";
      ctx.stroke();
    }
  }
  const pointers = new Map();
  const distance = () => {
    const [a,b] = pointers.values();
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
  };
  const resetGesture = () => {
    const positions = [...pointers.values()];
    drag = positions.length === 1 ? [...positions[0], panX, panY] : null;
  };
  if (!preview) canvas.addEventListener("pointerdown", event => {
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    resetGesture();
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", event => {
    if (!pointers.has(event.pointerId)) return;
    const pinch = pointers.size === 2;
    const oldDistance = pinch ? distance() : 0;
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    if (pinch) {
      if (oldDistance > 0) zoom(distance() / oldDistance);
      return;
    }
    if (!drag) return;
    if (Math.hypot(event.clientX - drag[0], event.clientY - drag[1]) < 3) return;
    followPlayer = false;
    selectedExit = undefined;
    syncControls();
    panX = drag[2] - (event.clientX - drag[0]) / scale;
    panY = drag[3] - (event.clientY - drag[1]) / scale;
    paint();
  });
  canvas.addEventListener("lostpointercapture", event => {
    pointers.delete(event.pointerId);
    resetGesture();
  });
  if (!preview) canvas.addEventListener("wheel", event => { event.preventDefault(); zoom(event.deltaY < 0 ? 1.2 : 1/1.2); }, {passive:false});
  updateFieldMarker = next => {
    if (player?.x === next?.x && player?.y === next?.y) return;
    player = next;
    if (!preview && followPlayer && player) centerOn(player);
    syncControls();
    paint();
  };
  fit();
  const resize = new ResizeObserver(() => {
    if (canvas.clientWidth !== width || canvas.clientHeight !== height) fit(true);
  });
  resize.observe(canvas);
  releaseFieldMap = () => resize.disconnect();
  return exit => {
    followPlayer = false;
    selectedExit = exit.key;
    centerOn(exit);
    scale = Math.max(scale, baseScale * 1.7);
    syncControls();
    paint();
    canvas.scrollIntoView({block: "nearest"});
  };
}

function arenaValue(current, offset) {
  return parseInt(current.arena?.slice(offset * 2, offset * 2 + 2), 16) || 0;
}

function bribeEstimate(gil, hp, baseYield) {
  const rolls = Math.max(0, Math.floor(gil * 64 / (5 * hp)) - 64);
  const odds = 100 * Math.min(256, rolls) / 256;
  const adjustedYield = Math.sqrt(rolls / 256) * baseYield;
  const clamp = value => Math.min(99, Math.max(1, Math.floor(value)));
  return {odds, min:rolls ? clamp(adjustedYield * 0.8) : 0,
    max:rolls ? clamp(adjustedYield * 1.2 + 1) : 0};
}

function bribePlanner(foe, opened, getGil) {
  const [item, quantity, fullPrice] = foe.bribe;
  const details = element("details", "arena-pending bribe-planner");
  details.append(element("summary", "", `Plan bribe · ${item}`));
  let refresh;
  function draw() {
    if (!details.open || refresh) return;
    const choices = element("div", "filters");
    const label = element("label", "", "Total offered to this fiend");
    const offer = element("input", "bribe-offer");
    offer.type = "number";
    offer.inputMode = "numeric";
    offer.min = 0;
    offer.max = 99999999;
    offer.value = foe.hp * 10;
    label.append(offer);
    const result = element("p", "detail");
    const yieldNote = element("p", "");
    result.setAttribute("aria-live", "polite");
    refresh = () => {
      const amount = offer.valueAsNumber;
      if (!Number.isSafeInteger(amount) || !offer.validity.valid) {
        result.textContent = "Enter a whole gil amount from 0 to 99,999,999.";
        yieldNote.textContent = "";
        return;
      }
      const {odds, min, max} = bribeEstimate(amount, foe.hp, quantity);
      const gil = getGil();
      const short = Math.max(0, amount - gil);
      result.textContent = `${Number(odds.toFixed(2))}% chance per attempt · ${short ?
        number.format(short) + " gil short" : number.format(gil - amount) + " gil left if paid in full"}`;
      yieldNote.textContent = odds ? `Estimated reward on success · ${item} ×${min === max ? min : min + "–" + max}` :
        "Increase the offer to have a chance at this reward.";
    };
    for (const multiple of [10,15,20,25]) {
      choices.append(action(multiple + "× HP", () => { offer.value = multiple * foe.hp; refresh(); }));
    }
    offer.addEventListener("input", refresh);
    details.append(choices, label, result, yieldNote,
      element("p", "field-note", `${number.format(fullPrice)} gil reaches the maximum success chance against an awake target.`),
      element("p", "", "Offers to the same fiend add up within a battle. After a miss, try adding 1 gil. Wake a sleeping target before paying."));
    refresh();
  }
  details.addEventListener("toggle", draw);
  details.open = opened;
  draw();
  return {details, update:() => { if (details.open) refresh?.(); }};
}

function itemSourceIndex() {
  const index = new Map();
  for (const [id,foe] of Object.entries(ffxData.enemies)) {
    if (!foe.hp || !isFiend(foe)) continue;
    for (const [method, loot] of [["Drop",foe.drops],["Steal",foe.steal],["Bribe",foe.bribe ? [foe.bribe] : []]]) {
      for (const [name,count,gil] of loot || []) {
        if (!index.has(name)) index.set(name, []);
        const sources = index.get(name);
        if (!sources.some(row => row.id === Number(id) && row.method === method && row.count === count)) {
          sources.push({id:Number(id),name:foe.name,method,count,gil});
        }
      }
    }
  }
  return index;
}

function showItemSources(current) {
  const sources = itemSourceIndex();
  const names = [...sources.keys()].sort((a,b) => a.localeCompare(b));
  const controls = element("div", "filters guide-filters");
  const search = element("input");
  search.type = "search";
  search.placeholder = "Find an item source";
  search.setAttribute("aria-label", search.placeholder);
  search.value = bestiaryQuery;
  const sheet = element("div", "sheet guide-list");
  const amounts = itemAmounts(current.items);
  let method = "";
  const methods = options("Source method", [["","Any method"],["Drop","Drop"],["Steal","Steal"],["Bribe","Bribe"]], method,
    value => { method = value; draw(); });
  controls.append(search, methods);
  panel.append(controls, sheet);
  search.addEventListener("input", () => { bestiaryQuery = search.value; draw(); });

  function draw() {
    sheet.replaceChildren();
    const query = normalizeGuideText(search.value.trim());
    if (!query) {
      sheet.append(entry("Search for an item", "", "Try a sphere, Chocobo Wing, or a Mix ingredient."));
      return;
    }
    const exact = names.find(name => normalizeGuideText(name) === query);
    const matched = exact ? [exact] : names.filter(name => normalizeGuideText(name).includes(query));
    for (const item of matched) {
      const rows = sources.get(item).filter(source => !method || source.method === method);
      if (!rows.length) continue;
      const itemId = Number(Object.keys(ffxData.items).find(id => ffxData.items[id] === item));
      const details = element("details", "entry");
      details.open = matched.length === 1;
      details.append(element("summary", "", `${item} · ${amounts.get(itemId) || 0} owned · ${rows.length} ${rows.length === 1 ? "source" : "sources"}`));
      if (arenaFarms.some(([id]) => Number(id) === itemId)) details.append(action("Plan Arena farm", () => openArenaFarm(itemId)));
      for (const row of rows) {
        const zones = Object.entries(ffxData.zones).filter(([, ids]) => ids.includes(row.id)).map(([name]) => name);
        const description = row.method === "Bribe" ?
          `Bribe · about ${row.count} at ${number.format(row.gil)} gil` : `${row.method} ×${row.count}`;
        const source = entry(row.name, description, zones.join(" · "));
        source.append(action(row.method === "Bribe" ? "Plan bribe" : "View fiend", () =>
          choose("bestiary", row.name, row.method === "Bribe" ? row.id : null)));
        details.append(source);
      }
      sheet.append(details);
    }
    if (!sheet.childElementCount) sheet.append(entry("No matching item sources"));
  }
  draw();
}

function openItemSources(query = null) {
  choose("bestiary", query ?? "", null, true);
}

function showBestiary(current) {
  heading("Bestiary", bestiaryMode === "gear" ? "Find equipment and compare drop odds" : "Find fiends and item sources");
  if (returningToMix) panel.append(action("Back to Mix", () => choose("mix")));
  const modes = element("div", "filters");
  const sections = [["fiends","Fiends"],["items","Item sources"]];
  if (current.disc === "SLPS-25088") sections.push(["gear","Gear Drops"]);
  for (const [id,name] of sections) {
    const button = action(name, () => { bestiaryMode = id; signature = ""; render(); });
    button.setAttribute("aria-pressed", String(bestiaryMode === id));
    modes.append(button);
  }
  panel.append(modes);
  if (bestiaryMode === "gear" && current.disc === "SLPS-25088") {
    showGearDrops(current);
    return null;
  }
  if (bestiaryMode === "items") {
    showItemSources(current);
    return null;
  }
  const filters = element("div", "filters");
  filters.classList.add("guide-filters");
  const query = element("input");
  query.type = "search";
  query.placeholder = "Search fiend or item";
  query.setAttribute("aria-label", query.placeholder);
  query.value = bestiaryQuery;
  const area = options("Area", [["","All areas"], ...Object.keys(ffxData.zones).sort().map(name => [name,name])],
    bestiaryArea, value => { bestiaryArea = value; redraw(); });
  const source = options("Item source", [["","Any source"], ["steal","Steal"], ["drops","Drop"], ["bribe","Bribe"]],
    bestiarySource, value => { bestiarySource = value; redraw(); });
  filters.append(query, area, source);
  panel.append(filters);
  const sheet = element("div", "sheet guide-list");
  panel.append(sheet);
  let wallet = current.gil;
  const gil = element("p", "field-note");
  panel.insertBefore(gil, sheet);
  let planners = [];
  const redraw = () => {
    sheet.replaceChildren();
    planners = [];
    gil.hidden = bestiarySource !== "bribe" && bestiaryBribeTarget == null;
    gil.textContent = number.format(wallet) + " gil on hand";
    const normalize = normalizeGuideText;
    const text = normalize(bestiaryQuery.trim());
    const zone = bestiaryArea ? new Set(ffxData.zones[bestiaryArea]) : null;
    const fights = new Set((current.enemies || []).map(enemy => enemy.id));
    const entries = Object.entries(ffxData.enemies)
      .filter(([id, foe]) => {
        if (!foe.hp || !isFiend(foe) || (zone && !zone.has(Number(id)))) return false;
        const loot = {steal:foe.steal || [], drops:foe.drops || [], bribe:foe.bribe ? [foe.bribe] : []};
        const items = bestiarySource ? loot[bestiarySource] : Object.values(loot).flat();
        return ((!bestiarySource || loot[bestiarySource].length) && normalize(foe.name).includes(text)) ||
          items.some(([name]) => normalize(name).includes(text));
      })
      .sort(([a, first], [b, second]) => Number(fights.has(Number(b))) - Number(fights.has(Number(a))) ||
        first.name.localeCompare(second.name));
    for (const [id, foe] of entries) {
      const seen = arenaValue(current, 512 + Math.floor(Number(id) / 8)) & (1 << (Number(id) % 8));
      const defeated = arenaValue(current, 576 + Math.floor(Number(id) / 8)) & (1 << (Number(id) % 8));
      const row = entry(foe.name,
        [fights.has(Number(id)) ? "In battle" : defeated ? "Defeated" : seen ? "Seen" : "", number.format(foe.hp) + " HP", number.format(foe.mp) + " MP"]
          .filter(Boolean).join(" · "), enemyNotes(foe));
      const notes = [];
      const list = items => [...new Set(items.map(([name,n]) => name + (n > 1 ? " ×" + n : "")))].join(", ");
      if (foe.steal?.length) notes.push("Steal · " + list(foe.steal));
      if (foe.drops?.length) notes.push("Drops · " + list(foe.drops));
      if (notes.length) row.append(element("p", "", notes.join(" · ")));
      if (text && !zone) {
        const areas = Object.entries(ffxData.zones).filter(([, ids]) => ids.includes(Number(id))).map(([name]) => name);
        if (areas.length) row.append(element("p", "field-note", areas.join(" · ")));
      }
      if (foe.bribe) {
        const planner = bribePlanner(foe, Number(id) === bestiaryBribeTarget, () => wallet);
        planners.push(planner);
        row.append(planner.details);
      }
      sheet.append(row);
    }
    if (!entries.length) sheet.append(entry("No matching fiends"));
  };
  query.addEventListener("input", () => { bestiaryBribeTarget = null; bestiaryQuery = query.value; redraw(); });
  redraw();
  return next => {
    if (next.gil === wallet) return;
    wallet = next.gil;
    gil.textContent = number.format(wallet) + " gil on hand";
    for (const planner of planners) planner.update();
  };
}

const arenaRegions = {
  "Besaid": ["Dingo","Condor","Water Flan"],
  "Kilika": ["Dinonix","Killer Bee","Yellow Element","Ragora"],
  "Mi’ihen Highroad": ["Mi'ihen Fang","Ipiria","Floating Eye","White Element","Raldo","Vouivre","Bomb","Dual Horn"],
  "Mushroom Rock Road": ["Raptor","Gandarewa","Thunder Flan","Red Element","Lamashtu","Funguar","Garuda"],
  "Djose Road": ["Garm","Simurgh","Bite Bug","Snow Flan","Bunyip","Basilisk","Ochu"],
  "Thunder Plains": ["Melusine","Aerouge","Buer","Gold Element","Kusariqqu","Larva","Iron Giant","Qactuar"],
  "Macalania": ["Snow Wolf","Iguion","Wasp","Evil Eye","Ice Flan","Blue Element","Murussu","Mafdet","Xiphos","Chimera"],
  "Bikanel": ["Sand Wolf","Alcyone","Mushussu","Zu","Sand Worm","Cactuar"],
  "Calm Lands": ["Skoll","Nebiros","Flame Flan","Shred","Anacondaur","Ogre","Coeurl","Chimera Brain","Malboro"],
  "Stolen Fayth Cavern": ["Yowie","Imp","Dark Element","Nidhogg","Thorn","Valaha","Epaaj","Ghost","Tonberry"],
  "Mt. Gagazet": ["Bandersnatch","Ahriman","Dark Flan","Grenade","Grat","Grendel","Bashura","Mandragora","Behemoth","Splasher","Achelous","Maelspike"],
  "Inside Sin": ["Exoray","Wraith","Gemini (Sword)","Gemini (Club)","Demonolith","Great Malboro","Barbatos","Adamantoise","Behemoth King"],
  "Omega Ruins": ["Zaurus","Floating Death","Black Element","Halma","Puroboros","Spirit","Machea","Master Coeurl","Master Tonberry","Varuna"]
};
let arenaRegion = "Calm Lands";
let arenaView = "captures";
let arenaCreation = "";
let arenaTarget = 10;
let arenaMissingOnly = false;

const arenaHuntingSpots = {
  Tonberry: "Try the green-lit side room in the Cavern of the Stolen Fayth or the chamber by the teleport platform.",
  "Master Tonberry": "Try the platforms in the deeper part of Omega Ruins, on the route to Omega Weapon.",
  "Master Coeurl": "Try the platforms in the deeper part of Omega Ruins, on the route to Omega Weapon.",
  Varuna: "Try the platforms in the deeper part of Omega Ruins, on the route to Omega Weapon."
};

function setArenaRegion(region) {
  arenaRegion = region;
  arenaView = "captures";
  arenaCreation = "";
  signature = "";
  choose("arena");
}

function openArenaCreation(name = "") {
  arenaView = "creations";
  arenaCreation = name;
  signature = "";
  choose("arena");
}

function closestCaptureRegion(current,target) {
  if (!hasCaptureData(current)) return null;
  const regions=[];
  for (const [region,names] of Object.entries(arenaRegions)) {
    const counts=names.map(name=>arenaCaptureCount(current,name));
    if (counts.some(count=>count==null)) continue;
    const needed=counts.reduce((sum,count)=>sum+Math.max(0,target-count),0);
    if (needed) regions.push({region,needed});
  }
  return regions.sort((a,b)=>a.needed-b.needed||a.region.localeCompare(b.region))[0]||null;
}
function showArena(current) {
  heading("Monster Arena", arenaView === "hunt" ? "Encounter scouting and live captures" : "Live captures from your save");
  const views = element("div", "filters");
  const setView = value => {
    arenaView = value;
    arenaCreation = "";
    panel.scrollTop = 0;
    signature = "";
    render();
  };
  for (const [value, title] of [["captures","Captures"],["hunt","Hunt"],["creations","Creations"],["farming","Farming"]]) {
    const button = action(title, () => setView(value), arenaView === value);
    button.setAttribute("aria-pressed", String(arenaView === value));
    views.append(button);
  }
  panel.append(views);
  if (arenaView === "hunt") {
    showArenaHunt(current);
    return;
  }
  if (arenaView === "farming") {
    showArenaFarming(current);
    return;
  }
  views.append(action("Find item sources", () => choose("bestiary")));
  if (arenaView === "creations") {
    if (arenaCreation) panel.append(action("Show all creations", () => setView("creations")));
    showArenaCreations(current);
    return;
  }
  const controls = element("div", "filters");
  const sheet = element("div", "sheet");
  const goals = arenaGoals(current).flatMap(([, rows]) => rows);
  const redraw = () => {
    const next=closestCaptureRegion(current,arenaTarget);
    nearest.hidden=!next;
    if(next) nearest.textContent="Closest unfinished region · "+next.region+" · "+next.needed+(next.needed===1?" catch":" catches")+" left";
    sheet.replaceChildren();
    const counts = arenaRegions[arenaRegion].map(name => [name, arenaCaptureCount(current, name)]);
    const caught = counts.filter(([,count]) => count > 0).length;
    const total = counts.reduce((sum,[,count]) => sum + (count ?? 0), 0);
    sheet.append(entry(arenaRegion, caught + " / " + counts.length + " species · " + total + " / " + counts.length * 10 + " captures"));
    const missing = counts.filter(([,count]) => count == null || count < arenaTarget);
    const inBattle = new Set((current.enemies || []).filter(foe => foe.hp > 0).map(foe => enemyName(foe.id)));
    sheet.append(element("p", "tracker-caption", missing.length ?
      `${missing.length} species below ${arenaTarget} captures` : "Capture goal met for this region"));
    for (const [name, count] of arenaMissingOnly ? missing : counts) {
      const need = count == null ? "Capture slot unavailable" : count >= arenaTarget ? "Goal met" : `${arenaTarget - count} to go`;
      const row = entry(name, [inBattle.has(name) ? "In battle" : "", count == null ? "" : count + " / 10 captured", need]
        .filter(Boolean).join(" · "), count != null && count < arenaTarget ? arenaHuntingSpots[name] : "");
      const links = element("div", "tracker-actions");
      links.append(action("Look up " + name, () => choose("bestiary", name)));
      if (count != null && count < arenaTarget) {
        links.append(action("Find hunting spots", () => openArenaHunt({focus:name})),
          trackFiendButton(current, name, arenaRegion, arenaTarget));
      }
      for (const goal of goals.filter(goal => goal.fiends?.includes(name) && goal.fiends.length < allArenaFiends.length)) {
        links.append(action(goal.name, () => openArenaCreation(goal.name)));
      }
      row.append(links);
      sheet.append(row);
    }
  };
  const regionSelect=options("Capture region", Object.keys(arenaRegions).map(name => [name,name]), arenaRegion,
    value => { arenaRegion = value; redraw(); });
  const nearest=action("Closest unfinished region",()=>{
    const next=closestCaptureRegion(current,arenaTarget);
    if(next){arenaRegion=next.region;regionSelect.value=arenaRegion;redraw();}
  });
  controls.append(regionSelect,nearest);
  controls.append(options("Capture goal", [[1,"Goal: 1 each"],[5,"Goal: 5 each"],[10,"Goal: 10 each"]], arenaTarget,
    value => { arenaTarget = Number(value); redraw(); }));
  const missing = action("Missing only", () => {
    arenaMissingOnly = !arenaMissingOnly;
    missing.setAttribute("aria-pressed", String(arenaMissingOnly));
    redraw();
  });
  missing.setAttribute("aria-pressed", String(arenaMissingOnly));
  controls.append(missing);
  panel.append(controls, sheet);
  redraw();
}

function gridBytes(current, index) {
  const offset = index * 4;
  return [parseInt(current.grid.slice(offset, offset + 2), 16), parseInt(current.grid.slice(offset + 2, offset + 4), 16)];
}

function gridPath(graph, current, member, start, end, withLocks = false) {
  // A state records how many of the four steps in a paid backtrack block
  // have been used. An untraveled link starts a new block at full price.
  const span = 4;
  const scale = graph.nodes.length * span + 1;
  const moveCost = scale * scale;
  const best = new Float64Array(graph.nodes.length * span).fill(Infinity);
  const before = new Int32Array(best.length).fill(-1);
  const initial = start * span;
  best[initial] = 0;
  const queue = [[0, initial]];
  const edges = Array.from({length:graph.nodes.length}, () => []);
  const lockLevel = graph.nodes.map((_,i) => ffxData.types[gridBytes(current,i)[0]]?.[1] || 0);
  for (const [i,[a,b]] of graph.links.entries()) {
    const bits = parseInt((current.gridLinks || "").slice(i * 2, i * 2 + 2), 16) || 0;
    const visited = !!(bits & (1 << member));
    edges[a].push([b,visited]);
    edges[b].push([a,visited]);
  }
  while (queue.length) {
    queue.sort(([a],[b]) => b - a);
    const [score, state] = queue.pop();
    if (best[state] !== score) continue;
    const node = Math.floor(state / span), progress = state % span;
    if (node === end) {
      const path = [];
      for (let step = state; step >= 0; step = before[step]) path.push(Math.floor(step / span));
      const locks = [...new Set(path.filter(id => id !== start && lockLevel[id]))].map(id => lockLevel[id]);
      return {path:path.reverse(), cost:Math.floor(score / moveCost), locks};
    }
    for (const [neighbor,visited] of edges[node]) {
      const lock = lockLevel[neighbor];
      if ((lock && !withLocks) || neighbor === start) continue;
      const backtrack = visited && !lock;
      const next = neighbor * span + (backtrack ? (progress + 1) % span : 0);
      // Prefer fewer locks, then fewer steps, when paid movement ties.
      const distance = score + 1 + (backtrack && progress ? 0 : moveCost) + (lock ? scale : 0);
      if (distance >= best[next]) continue;
      best[next] = distance;
      before[next] = state;
      queue.push([distance,next]);
    }
  }
  return {path:[],cost:null,locks:[]};
}

const gridAttributes = ["Strength", "Defense", "Magic", "Magic Defense", "Agility", "Luck", "Evasion", "Accuracy"];
const gridStatSpheres = [8279,8280,8281,8282,8283,8286,8284,8285];
const gridTargets = new Map();
let gridStatIndex = 0;
let gridStatsOpen = false;
let gridAllowLocks = false;
let gridFocus = "all";

function gridCompletion(graph, current, id) {
  const counts = {active:0, inactive:0, empty:0, locked:0, unknown:0};
  const states = graph.nodes.map((_, index) => {
    const [type, mask] = gridBytes(current, index);
    const state = !ffxData.types[type] ? "unknown" : ffxData.types[type][1] ? "locked" :
      type === 1 ? "empty" : mask & (1 << id) ? "active" : "inactive";
    counts[state]++;
    return state;
  });
  return {states, counts};
}

function gridActivationSphere(type) {
  const node = ffxData.types[type];
  if (!node || type === 1) return null;
  if (node[1]) return 0x2050 + node[1];
  if (node[2]) return 0x2049;
  const stat = node[0].split(" +")[0];
  if (["Strength", "Defense", "HP"].includes(stat)) return 0x2046;
  if (["Magic", "Magic Defense", "MP"].includes(stat)) return 0x2047;
  if (["Agility", "Accuracy", "Evasion"].includes(stat)) return 0x2048;
  return stat === "Luck" ? 0x204a : null;
}

function liveGridLayout(current) {
  const scores = [ffxData.standard, ffxData.expert].map(graph => graph.nodes.reduce((count,node,i) =>
    count + Number(node[2] === gridBytes(current,i)[0]), 0) / graph.nodes.length);
  return scores[1] > scores[0] ? ffxData.expert : ffxData.standard;
}

function gridStatPlan(current, graph, member, index, target) {
  const name = gridAttributes[index];
  const currentStat = member.attributes[index];
  let growth = 0;
  let activations = 0;
  for (let node = 0; node < graph.nodes.length; node++) {
    const [type, mask] = gridBytes(current, node);
    const label = ffxData.types[type]?.[0] || "";
    if (mask & (1 << member.id) || !label.startsWith(name + " +")) continue;
    growth += Number(label.slice(name.length + 2)) || 0;
    activations++;
  }
  const newNodes = Math.ceil(Math.max(0, target - currentStat - growth) / 4);
  const sphere = gridStatSpheres[index];
  return {currentStat, growth, activations, newNodes, sphere,
    activationSphere: gridActivationSphere(Number(Object.keys(ffxData.types).find(type => ffxData.types[type][0] === name + " +4")))};
}

function showGrid(current) {
  const graph = liveGridLayout(current);
  heading("Sphere Grid", graph === ffxData.expert ? "Expert layout" : "Standard layout");
  panel.append(action("Open build sandbox", () => choose("grid-lab")));
  const bar = element("div", "filters");
  const member = selectMember(current, bar);
  if (!member) return;
  const gridOrigin = current.gridPositions?.[member.id];
  const hasPosition = Number.isInteger(gridOrigin) && gridOrigin >= 0 && gridOrigin < graph.nodes.length;
  const names = graph.nodes.map((_, i) => ffxData.types[gridBytes(current,i)[0]]?.[0] || "Unknown node");
  const activated = graph.nodes.map((_, i) => !!(gridBytes(current,i)[1] & (1 << member.id)));
  const {states, counts} = gridCompletion(graph, current, member.id);
  if (gridFocus !== "all" && states[selectedGridNode] !== gridFocus) selectedGridNode = null;
  const canvas = element("canvas", "grid-canvas");
  canvas.setAttribute("aria-label", "Sphere Grid map. Drag to pan or use the node selector.");
  const context = canvas.getContext("2d");
  const note = element("p", "grid-note");
  const details = element("p", "grid-note");
  const sphereSource = element("div", "grid-sphere-source");
  const amounts = itemAmounts(current.items);
  const filter = element("div", "filters grid-filters");
  const search = element("input");
  search.type = "search";
  search.placeholder = "Find an ability or node";
  search.setAttribute("aria-label", search.placeholder);
  const gridChoices = names.map((name,i) => [i, name + " · " + (i + 1)]);
  const selected = options("Grid node", [["","Select a node"], ...gridChoices],
    selectedGridNode ?? "", value => { selectedGridNode = value === "" ? null : Number(value); if (selectedGridNode != null) focusNode(selectedGridNode); refresh(); });
  const clear = action("Clear route", () => { selectedGridNode = null; refresh(); });
  filter.append(search, selected, clear);
  const totals = element("div", "filters grid-completion");
  const categories = [["all","All nodes", graph.nodes.length], ["inactive","Unactivated", counts.inactive],
    ["empty","Empty", counts.empty], ["locked","Locked", counts.locked]];
  const focus = options("Node filter", categories.map(([state,label,count]) => [state, `${label} · ${count}`]), gridFocus, value => {
    gridFocus = value;
    if (value !== "all" && states[selectedGridNode] !== value) selectedGridNode = null;
    filterNodes();
    refresh();
  });
  totals.append(focus);
  const showNode = i => gridFocus === "all" || states[i] === gridFocus;
  function filterNodes() {
    const text = search.value.trim().toLowerCase();
    const matched = gridChoices.filter(([id, title]) => showNode(id) && title.toLowerCase().includes(text));
    const keep = selectedGridNode != null && !matched.some(([id]) => id === selectedGridNode);
    selected.replaceChildren(...[["", matched.length ? "Select a node" : "No matching nodes"],
      ...(keep ? [gridChoices[selectedGridNode]] : []), ...matched].map(([value, label]) => {
      const option = element("option", "", label);
      option.value = value;
      return option;
    }));
    selected.value = selectedGridNode ?? "";
    return matched;
  }
  search.addEventListener("input", filterNodes);
  search.addEventListener("keydown", event => {
    if (event.key !== "Enter" || !search.value.trim()) return;
    const matches = filterNodes();
    if (matches.length === 1) {
      selectedGridNode = matches[0][0];
      focusNode(selectedGridNode);
      refresh();
    } else selected.focus();
  });
  const lockToggle = action("Allow key spheres", () => {
    gridAllowLocks = !gridAllowLocks;
    lockToggle.setAttribute("aria-pressed", String(gridAllowLocks));
    route = null;
    refresh();
  });
  lockToggle.setAttribute("aria-pressed", String(gridAllowLocks));
  const view = element("div", "filters");
  const locate = action("Find character", () => { focusNode(gridOrigin); refresh(); });
  locate.disabled = !hasPosition;
  view.append(locate, action("+", () => zoom(1.45)), action("−", () => zoom(1 / 1.45)), action("Fit grid", () => fit()), lockToggle);
  view.children[1].setAttribute("aria-label", "Zoom in");
  view.children[2].setAttribute("aria-label", "Zoom out");
  panel.append(bar, note, totals, filter, details, sphereSource, view, canvas);
  filterNodes();
  const needs = new Map();
  for (const [index,state] of states.entries()) {
    if (state !== "inactive" && state !== "locked") continue;
    const sphere = gridActivationSphere(gridBytes(current,index)[0]);
    if (sphere != null) needs.set(sphere, (needs.get(sphere) || 0) + 1);
  }
  if (needs.size) {
    const requirements = element("details", "grid-attributes");
    const summary = element("summary", "", "Spheres for remaining nodes");
    const sheet = element("div", "sheet");
    for (const [id,needed] of [...needs].sort(([a],[b]) => a-b)) {
      const name = ffxData.items[id];
      const row = entry(name, `${amounts.get(id) || 0} owned / ${needed} needed`);
      row.append(action("Find " + name, () => choose("bestiary", name)));
      if (arenaFarms.some(([value]) => value === String(id))) row.append(action("Plan Arena farm", () => openArenaFarm(id)));
      sheet.append(row);
    }
    const empty = counts.empty ? ` ${counts.empty} empty nodes need a stat sphere before they can be activated.` : "";
    requirements.append(summary, element("p", "field-note", `Counts use standard activation spheres and keys.${empty}`), sheet);
    panel.append(requirements);
  }
  if (member.attributes?.length === gridAttributes.length) {
    const stats = element("details", "grid-attributes");
    stats.open = gridStatsOpen;
    stats.addEventListener("toggle", () => { gridStatsOpen = stats.open; });
    stats.append(element("summary", "", "Plan stat targets"));
    const controls = element("div", "filters");
    const stat = options("Stat to plan", gridAttributes.map((name, index) => [index,name]), gridStatIndex, value => {
      gridStatIndex = Number(value);
      target.value = gridTargets.get(gridStatIndex) ?? 255;
      drawStat();
    });
    const label = element("label", "farm-target", "Target stat");
    const target = element("input");
    target.type = "number";
    target.inputMode = "numeric";
    target.min = 1;
    target.max = 255;
    target.value = gridTargets.get(gridStatIndex) ?? 255;
    target.addEventListener("input", drawStat);
    label.append(target);
    controls.append(stat, label);
    const sheet = element("div", "sheet");
    function drawStat() {
      const goal = target.valueAsNumber;
      if (!Number.isInteger(goal) || !target.validity.valid) {
        sheet.replaceChildren(entry("Enter a target from 1 to 255"));
        return;
      }
      gridTargets.set(gridStatIndex, goal);
      const plan = gridStatPlan(current, graph, member, gridStatIndex, goal);
      const {currentStat,growth,activations,newNodes,sphere,activationSphere} = plan;
      const row = entry(gridAttributes[gridStatIndex], `${currentStat} now · ${goal} target`,
        currentStat >= goal ? "Target met." : `+${growth} on ${activations} unactivated nodes · ${newNodes} new +4 nodes needed after those.`);
      if (newNodes) {
        const missing = Math.max(0, newNodes - (amounts.get(sphere) || 0));
        row.append(element("p", "", `${counts.empty} empty slots · ${missing} ${ffxData.items[sphere]} to farm${newNodes > counts.empty ? " · clear or reuse slots" : ""}.`));
        row.append(action("Plan " + ffxData.items[sphere] + " farm", () => openArenaFarm(sphere, newNodes)));
      }
      if (currentStat < goal && activationSphere != null) {
        row.append(element("p", "field-note", `Use ${ffxData.items[activationSphere]} to activate these nodes. ${amounts.get(activationSphere) || 0} owned.`));
      }
      sheet.replaceChildren(row);
    }
    stats.append(controls, sheet);
    panel.append(stats);
    drawStat();
  }
  const bounds = graph.nodes.reduce((box,[x,y]) => [
    Math.min(box[0],x), Math.min(box[1],y), Math.max(box[2],x), Math.max(box[3],y)
  ], [Infinity,Infinity,-Infinity,-Infinity]);
  let scale = 1, panX = 0, panY = 0, drag = null;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  context.setTransform(dpr,0,0,dpr,0,0);
  const point = ([x,y]) => [width / 2 + (x - panX) * scale, height / 2 + (y - panY) * scale];
  let routeTarget;
  let route;

  function fit() {
    panX = (bounds[0] + bounds[2]) / 2;
    panY = (bounds[1] + bounds[3]) / 2;
    scale = Math.min((width - 20) / (bounds[2] - bounds[0]), (height - 20) / (bounds[3] - bounds[1]));
    refresh();
  }
  function zoom(ratio) {
    scale = Math.min(3, Math.max(.06, scale * ratio));
    refresh();
  }
  function focusNode(index) {
    [panX, panY] = graph.nodes[index];
    scale = Math.max(scale, .32);
  }
  function refresh() {
    if (!route || routeTarget !== selectedGridNode) {
      routeTarget = selectedGridNode;
      route = hasPosition && selectedGridNode != null ?
        gridPath(graph,current,member.id,gridOrigin,selectedGridNode,gridAllowLocks) : {path:[],cost:null,locks:[]};
      if (hasPosition && selectedGridNode != null && !gridAllowLocks && !route.path.length) {
        route = gridPath(graph,current,member.id,gridOrigin,selectedGridNode,true);
      }
    }
    const {path,cost,locks} = route;
    const pathNodes = new Set(path);
    const pathLinks = new Set(path.slice(1).flatMap((id,i) => [path[i] + "/" + id, id + "/" + path[i]]));
    note.textContent = catalog.x.party[member.id] + " · S.Lv " + member.sphereLevel + " · " +
      counts.active + " / " + graph.nodes.length + " nodes activated";
    if (selectedGridNode != null && !Array.from(selected.options).some(option => option.value === String(selectedGridNode))) filterNodes();
    selected.value = selectedGridNode ?? "";
    clear.disabled = selectedGridNode == null;
    const stateLabel = {active:"Activated", inactive:"Unactivated", empty:"Needs a stat sphere", locked:"Needs a key sphere", unknown:"Unknown"};
    details.textContent = selectedGridNode == null ? (hasPosition ? "Gold marks your position. Tap a node to plan a route." : "Tap a node to inspect it.") :
      names[selectedGridNode] + " · " + stateLabel[states[selectedGridNode]] +
      (!hasPosition ? "" : path.length ? " · " + (path.length - 1) + (path.length === 2 ? " link" : " links") +
        " · est. " + cost + " S.Lv" + (cost > member.sphereLevel ? " (need " + (cost - member.sphereLevel) + " more)" : "") :
        " · No route found");
    if (locks.length) {
      for (const level of new Set(locks)) {
        const required = locks.filter(lock => lock === level).length;
        const owned = current.items.find(([id]) => id === 0x2050 + level)?.[1] || 0;
        details.textContent += ` · Lv. ${level} Key Sphere ×${required} (${owned} owned)`;
      }
    }
    const sphere = selectedGridNode == null || states[selectedGridNode] === "active" ? null :
      gridActivationSphere(gridBytes(current,selectedGridNode)[0]);
    const name = ffxData.items[sphere];
    if ((sphereSource.dataset.item || "") !== (name || "")) {
      sphereSource.replaceChildren();
      sphereSource.dataset.item = name || "";
      if (name) sphereSource.append(element("p", "field-note", `${name} · ${amounts.get(sphere) || 0} owned`),
        action("Find " + name, () => choose("bestiary", name)));
    }
    context.clearRect(0,0,width,height);
    for (const [a,b,center] of graph.links) {
      const [x,y] = point(graph.nodes[a]);
      const [xx,yy] = point(graph.nodes[b]);
      context.beginPath();
      context.moveTo(x,y);
      if (center >= 0) {
        const [cx,cy] = point(graph.nodes[center]);
        const midX = (x + xx) / 2, midY = (y + yy) / 2;
        const radius = Math.hypot(x - cx, y - cy);
        const distance = Math.hypot(midX - cx, midY - cy);
        const curve = distance ? 2 * (radius - distance) / distance : 0;
        context.quadraticCurveTo(midX + (midX - cx) * curve, midY + (midY - cy) * curve, xx, yy);
      } else context.lineTo(xx,yy);
      context.strokeStyle = pathLinks.has(a + "/" + b) ? "#f4cc90" : "#35535c";
      context.stroke();
    }
    graph.nodes.forEach((node,i) => {
      const [x,y] = point(node);
      if (x < -8 || x > width + 8 || y < -8 || y > height + 8) return;
      const type = ffxData.types[gridBytes(current,i)[0]];
      context.beginPath();
      context.arc(x,y, Math.max(1.5, Math.min(i === selectedGridNode ? 8 : 5, scale * 9)),0,2*Math.PI);
      context.fillStyle = i === selectedGridNode || pathNodes.has(i) ? "#f4cc90" : !showNode(i) ? "#283f48" :
        gridFocus === "inactive" || activated[i] ? "#91e1cf" : type?.[1] ? "#e2948b" :
        gridFocus === "empty" || type?.[2] ? "#a9bdf6" : "#59757e";
      context.fill();
      if (hasPosition && i === gridOrigin) {
        context.beginPath();
        context.arc(x,y,Math.max(5, Math.min(8,scale * 9 + 3)),0,2*Math.PI);
        context.strokeStyle = "#f4cc90";
        context.lineWidth = 2;
        context.stroke();
        context.lineWidth = 1;
      }
    });
  }
  canvas.addEventListener("pointerdown", event => {
    drag = {x:event.offsetX,y:event.offsetY,panX,panY};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", event => {
    if (!drag) return;
    panX = drag.panX - (event.offsetX - drag.x) / scale;
    panY = drag.panY - (event.offsetY - drag.y) / scale;
    refresh();
  });
  canvas.addEventListener("pointercancel", () => { drag = null; });
  canvas.addEventListener("pointerup", event => {
    if (drag && Math.hypot(event.offsetX - drag.x, event.offsetY - drag.y) < 6) {
      let distance = 16;
      graph.nodes.forEach((node,i) => {
        if (!showNode(i)) return;
        const [x,y] = point(node);
        const d = Math.hypot(x - event.offsetX, y - event.offsetY);
        if (d < distance) { selectedGridNode = i; distance = d; }
      });
    }
    drag = null;
    refresh();
  });
  canvas.addEventListener("wheel", event => { event.preventDefault(); zoom(event.deltaY < 0 ? 1.2 : 1/1.2); }, {passive:false});
  if (selectedGridNode >= graph.nodes.length) selectedGridNode = null;
  fit();
}
