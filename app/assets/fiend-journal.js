"use strict";

const fiendJournalKey = "spira.x2.encounters.v1";
const trackedFiendKey = "spira.tracked-fiends.v1";
let observedFiends = [];
let trackedFiends = {};
try {
  observedFiends = JSON.parse(localStorage.getItem(fiendJournalKey) || "[]").slice(-512);
  trackedFiends = JSON.parse(localStorage.getItem(trackedFiendKey) || "{}") || {};
} catch { /* Local storage is optional. */ }

function rememberX2Encounter(current) {
  if (current.game !== "x2" || !current.disc || !current.battle || !current.enemies) return;
  let changed = false;
  for (const foe of current.enemies) {
    if (!foe.name || foe.hp <= 0 || !Number.isInteger(foe.id)) continue;
    const name = x2FiendName(foe.name);
    const same = observedFiends.some(row => row.disc === current.disc && row.room === current.room &&
      row.chapter === current.chapter && row.name === name && row.hp === foe.maxHp && row.id === foe.id);
    if (same) continue;
    observedFiends.push({disc:current.disc, room:current.room, chapter:current.chapter,
      name, title:foe.name, id:foe.id, hp:foe.maxHp, mp:foe.maxMp, level:foe.level});
    changed = true;
  }
  if (!changed) return;
  observedFiends = observedFiends.slice(-512);
  try { localStorage.setItem(fiendJournalKey, JSON.stringify(observedFiends)); } catch {}
}

function trackFiend(current, name, area, goal) {
  const previous = trackedFiends[current.disc];
  if (previous?.name === name && previous?.goal === goal) delete trackedFiends[current.disc];
  else trackedFiends[current.disc] = {name,area,goal};
  try { localStorage.setItem(trackedFiendKey, JSON.stringify(trackedFiends)); } catch {}
  signature = "";
  render();
}

function trackFiendButton(current, name, area, goal) {
  const previous = trackedFiends[current.disc];
  const active = previous?.name === name && previous?.goal === goal;
  const button = action(active ? "Stop tracking" : "Track " + name, () => trackFiend(current, name, area, goal));
  button.setAttribute("aria-pressed", String(active));
  return button;
}

function showTrackedFiend(current) {
  const mark = trackedFiends[current.disc];
  if (!mark || typeof mark.name !== "string") return;
  const isX = current.game === "x";
  const inFight = current.enemies?.some(foe => foe.hp > 0 &&
    (isX ? enemyName(foe.id) === mark.name : x2FiendName(foe.name) === x2FiendName(mark.name)));
  const count = isX ? arenaCaptureCount(current, mark.name) : null;
  const bit = isX ? null : x2OversoulEntries.find(([name]) => name === mark.name)?.[1];
  const done = isX ? count != null && count >= mark.goal :
    x2FieldChecks.has(`oversoul:${mark.name}`) || x2OversoulSeen(current.oversoul, bit);
  const label = done ? "Goal reached" : inFight ? "In this battle" : mark.area;
  const row = entry(mark.name, [label, count == null ? "" : `${count} / ${mark.goal} needed`].filter(Boolean).join(" · "));
  const controls = element("div", "tracker-actions");
  if (tab !== "map" && current.fieldMap && !current.battle) controls.append(action("Open field map", () => choose("map")));
  controls.append(action(isX ? "Find hunting spots" : "Find Oversoul", () => {
    if (isX) openArenaHunt({focus:mark.name});
    else openX2FieldGuide("oversoul", 0, mark.name);
  }), trackFiendButton(current, mark.name, mark.area, mark.goal));
  row.append(controls);
  const sheet = element("section", "tracked-fiend sheet");
  sheet.setAttribute("aria-label", "Tracked fiend");
  sheet.append(row);
  panel.append(sheet);
}

function x2BestiaryEntries(current) {
  const entries = new Map(x2OversoulEntries.map(([title,bit,area,floor]) =>
    [x2FiendName(title), {title,bit,area,floor, locations:[], stats:[], forms:[]}]));
  if (current.disc === "SLUS-20672") {
    for (const [title,areas,chapter,normal,oversoul] of x2FiendReference) {
      const name = x2FiendName(title);
      if (!entries.has(name)) entries.set(name, {title,locations:[],stats:[],forms:[]});
      const {forms} = entries.get(name);
      forms.push({areas,chapter,values:normal,oversoul:false});
      if (oversoul) forms.push({areas,chapter,values:oversoul,oversoul:true});
    }
  }
  for (const row of observedFiends) {
    if (row.disc !== current.disc) continue;
    if (!entries.has(row.name)) entries.set(row.name, {title:row.title,locations:[],stats:[],forms:[]});
    const entry = entries.get(row.name);
    const where = roomName({game:"x2", room:row.room}) + (row.chapter ? " · Chapter " + row.chapter : "");
    if (!entry.locations.includes(where)) entry.locations.push(where);
    if (!entry.stats.some(stats => stats.hp === row.hp && stats.mp === row.mp && stats.level === row.level)) {
      entry.stats.push(row);
    }
  }
  return [...entries.values()].sort((a,b) => a.title.localeCompare(b.title));
}

let x2BestiaryArea = "";
let x2BestiaryQuery = "";
let x2BestiaryTarget = null;
function openX2Bestiary(query, target = null) {
  x2BestiaryArea = "";
  x2BestiaryQuery = query || "";
  x2BestiaryTarget = target;
  signature = "";
  choose("x2-bestiary");
}

const x2Elements = ["Fire","Ice","Water","Lightning","Holy","Gravity"];
const x2AffinityNames = {n:"Normal",w:"Weak",a:"Absorbs",i:"Immune",r:"Resists","?":"Unknown"};
const x2LootMethods = ["Drop","Steal","Bribe"];

function x2MatchFiendForm(variants, foe) {
  const viable = variants.filter(form => form.values[0] === foe.maxHp && form.values[1] === foe.maxMp);
  if (viable.length < 2) return viable[0];
  const byLevel = viable.filter(form => form.values[2] === foe.level);
  return byLevel.length === 1 ? byLevel[0] : undefined;
}

function x2TargetReference(current, foe) {
  if (current.disc !== "SLUS-20672" || !foe.name) return "";
  const name = x2FiendName(foe.name);
  const forms = x2FiendReference.filter(([title]) => x2FiendName(title) === name).flatMap((row) => [
    {values:row[3],oversoul:false}, ...(row[4] ? [{values:row[4],oversoul:true}] : [])
  ]);
  const form = x2MatchFiendForm(forms, foe);
  if (!form) return "";
  const notes = [...form.values[3]].flatMap((code,index) => code === "n" || code === "?" ? [] :
    [`${x2Elements[index]} ${x2AffinityNames[code].toLowerCase()}`]);
  if (form.oversoul) notes.unshift("Oversoul");
  return notes.join(" · ");
}

function x2BestiaryPlaces(record) {
  return [...new Set([record.area,...record.locations,...record.forms.flatMap(form => form.areas)].filter(Boolean))];
}

function x2LootNames(form) {
  return form.values.slice(4).flatMap(method => method ? method.slice(0,2).filter(Boolean).map(item => item[0]) : []);
}

function showX2FiendForm(parent, form, live, matchingItems) {
  const [hp] = form.values;
  const details = element("details", "x2-fiend-form");
  details.open = live;
  const label = [form.oversoul ? "Oversoul" : "Normal", `${number.format(hp)} HP`,
    live ? "Matches current target" : "", ...matchingItems]
    .filter(Boolean).join(" · ");
  details.append(element("summary", "", label));
  if (live) addX2FiendDetails(details, form);
  else details.addEventListener("toggle", () => {
    if (details.open && details.childElementCount === 1) addX2FiendDetails(details, form);
  });
  parent.append(details);
}

function addX2FiendDetails(details, form) {
  const [,mp,level,affinities,...loot] = form.values;
  const info = [form.chapter && "Ch. " + form.chapter, form.areas.join(" · "), level && "Lv. " + level,
    mp != null && number.format(mp) + " MP"].filter(Boolean).join(" · ");
  if (info) details.append(element("p", "field-note", info));
  const elements = element("dl", "x2-affinities");
  [...affinities].forEach((effect,index) => {
    const group = element("div");
    group.dataset.affinity = effect;
    group.append(element("dt", "", x2Elements[index]), element("dd", "", x2AffinityNames[effect]));
    elements.append(group);
  });
  details.append(elements);
  const table = element("table", "x2-loot");
  table.setAttribute("aria-label", "Loot");
  const header = element("thead");
  const titles = element("tr");
  for (const title of ["Method","Common","Rare"]) titles.append(element("th", "", title));
  header.append(titles);
  const tbody = element("tbody");
  const itemText = item => !item ? "—" : item[0] + (item[1] === 1 ? "" : " ×" + item[1]);
  loot.forEach((method,index) => {
    if (!method || !method[0] && !method[1]) return;
    const [common,rare,chance] = method;
    const row = element("tr");
    const methodCell = element("th", "", x2LootMethods[index]);
    methodCell.scope = "row";
    if (chance != null) methodCell.append(element("small", "", chance + "% base"));
    row.append(methodCell,element("td", "", itemText(common)),element("td", "", itemText(rare)));
    tbody.append(row);
  });
  if (tbody.childElementCount) {
    table.append(header,tbody);
    details.append(table);
  }
}

function showX2Bestiary(current) {
  heading("Bestiary", "FFX-2 enemy forms, loot and locations");
  const entries = x2BestiaryEntries(current);
  const controls = element("div", "filters x2-bestiary-filters");
  const query = element("input");
  query.type = "search";
  query.placeholder = "Search fiend, area or item";
  query.setAttribute("aria-label", "Search Bestiary");
  query.value = x2BestiaryQuery;
  const areas = [...new Set(entries.flatMap(x2BestiaryPlaces))].sort();
  if (!areas.includes(x2BestiaryArea)) x2BestiaryArea = "";
  controls.append(query, options("Encounter area", [["","All areas"],...areas.map(area => [area,area])], x2BestiaryArea,
    value => { x2BestiaryArea = value; draw(); }));
  const sheet = element("div", "sheet");
  panel.append(controls,sheet);
  query.addEventListener("input", () => { x2BestiaryQuery = query.value; x2BestiaryTarget = null; draw(); });
  draw();

  function draw() {
    const term = x2BestiaryQuery.trim().toLowerCase();
    sheet.replaceChildren();
    for (const record of entries) {
      const places = x2BestiaryPlaces(record);
      if (x2BestiaryArea && !places.includes(x2BestiaryArea)) continue;
      const lootMatches = new Map(record.forms.map(form => [form, term ?
        [...new Set(x2LootNames(form).filter(name => name.toLowerCase().includes(term)))] : []]));
      if (term && ![...lootMatches.values()].some(names => names.length) &&
          ![record.title,...places].some(text => text.toLowerCase().includes(term))) continue;
      const known = x2OversoulSeen(current.oversoul, record.bit) || x2FieldChecks.has(`oversoul:${record.title}`);
      const row = entry(record.title, known ? "Oversoul seen" : "", record.locations.length ?
        "Recorded at " + record.locations.join(" · ") : places.join(" · "));
      for (const foe of record.stats) {
        row.append(element("p", "", [foe.level > 0 && "Lv. " + foe.level, number.format(foe.hp) + " HP",
          number.format(foe.mp) + " MP"].filter(Boolean).join(" · ")));
      }
      const inFocus = x2BestiaryTarget && x2FiendName(x2BestiaryTarget.name) === x2FiendName(record.title);
      const live = inFocus ? x2MatchFiendForm(record.forms, x2BestiaryTarget) : undefined;
      if (inFocus && !live && record.forms.length) row.append(element("p", "field-note", "Compare the listed forms with your current target."));
      for (const form of record.forms) {
        showX2FiendForm(row, form, form === live, lootMatches.get(form));
      }
      if (record.area && current.oversoul) row.append(action("Oversoul checklist", () => openX2FieldGuide("oversoul",0,record.title)));
      sheet.append(row);
    }
    if (!sheet.childElementCount) sheet.append(element("p", "entry", "No matching fiends."));
  }
}
