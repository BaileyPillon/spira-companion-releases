"use strict";

// Enemy names are the English PS2 battle names. Alternate names go after the in-game name.
const x2BlueBullets = [
  ["Fire Breath", ["Balivarha"]],
  ["Seed Cannon", ["Cephalotus", "Leucophylla"]],
  ["Stone Breath", ["Dolmen", "Epitaph", "Monolith", "Tomb"]],
  ["Absorb", ["Baralai", "Black Elemental", "Cindy", "Flan Azabache", "Haizhe", "Jahi", "Protochimera"]],
  ["White Wind", ["Bully Cap", "Coeurl", "Ms. Goon", "Mycotoxin", "Queen Coeurl"], "Confuse the fiend so it can cast White Wind on your Gun Mage."],
  ["Bad Breath", ["Great Malboro", "Malboro"]],
  ["Mighty Guard", ["Garik Ronso", "Haizhe"], "Confuse the fiend so it can cast Mighty Guard on your Gun Mage."],
  ["Supernova", ["Ultima Weapon"], "Use the normal form of Ultima Weapon. Its Oversoul form won’t cast Supernova."],
  ["Cry in the Night", ["Mega Tonberry"], "Bring Oversouled Mega Tonberry to low HP."],
  ["Drill Shot", ["Baralai"], "Fight Baralai in Bevelle in Chapter 2 or in the Den of Woe in Chapter 5. Change his HP ten times and make the Gun Mage take the last of those actions."],
  ["Mortar", ["Gippal"], "In the Den of Woe, bring Gippal below 75% HP to make Mortar more likely."],
  ["Annihilator", ["Experiment"], "Raise the Experiment’s Special level to 5 at Djose. Watch for Annihilator after Lifeslicer. Each Repair Manual grants one rematch."],
  ["Heaven’s Cataract", ["Chac", "Gucumatz", "Kukulcan"]],
  ["1000 Needles", ["Cactuar"]],
  ["Storm Cannon", ["Ironside"]],
  ["Blaster", ["Coeurl", "Queen Coeurl"]]
];

let x2FieldMode = "oversoul";
let x2ManualOnly = false;
let x2FieldQuery = "";
let x2FieldMissing = false;
let x2InfinitoFloor = "";
let x2BlueMember = 0;
const x2FieldKey = "spira.x2.field-guide";
let x2FieldChecks;
try { x2FieldChecks = new Set(JSON.parse(localStorage.getItem(x2FieldKey) || "[]")); }
catch { x2FieldChecks = new Set(); }

function x2OversoulSeen(hex, bit) {
  if (bit == null || !/^[0-9a-f]{128}$/i.test(hex || "")) return false;
  const offset = Math.floor(bit / 8) * 2;
  return (parseInt(hex.slice(offset, offset + 2), 16) & (1 << (bit % 8))) !== 0;
}

function x2MatchesFloor(range, floor) {
  if (!floor) return true;
  if (range === "Any") return true;
  const [first, last] = range.match(/\d+/g)?.map(Number) || [];
  return first != null && floor >= first && floor <= (range.endsWith("+") ? 100 : last ?? first);
}

function x2FiendName(name) {
  const key = (name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return key === "garik" ? "garikronso" : key;
}

function x2BlueEncounters(current) {
  if (!current.battle) return new Map();
  const targets = new Set(current.enemies?.filter(enemy => enemy.hp > 0).map(enemy => x2FiendName(enemy.name)));
  const opportunities = new Map();
  for (const [ability,fiends] of x2BlueBullets) {
    if (ability === "Annihilator" && current.experiment && x2ExperimentStats(current.experiment)[2].level < 5) continue;
    const present = fiends.filter(name => targets.has(x2FiendName(name)));
    if (present.length) opportunities.set(ability, present.join(" · "));
  }
  return opportunities;
}

function x2BlueKey(member, name) {
  return `blue:${member}:${name}`;
}

function x2BlueLearned(current, member, index) {
  const saved = current.blueBullets?.[member];
  return Number.isInteger(saved) ? !!(saved & (1 << index)) :
    x2FieldChecks.has(x2BlueKey(member, x2BlueBullets[index][0]));
}

function x2BlueOpportunity(current) {
  const available = x2BlueEncounters(current);
  for (const member of current.party) {
    if (member.id > 2 || member.hp < 1 || member.job !== 0x5002) continue;
    const names = x2BlueBullets.flatMap(([name], index) =>
      available.has(name) && !x2BlueLearned(current, member.id, index) ? [name] : []);
    if (names.length) return {member:member.id, names};
  }
  return null;
}

function openX2FieldGuide(mode, member = 0, query = "") {
  x2FieldMode = mode;
  x2BlueMember = member;
  x2FieldQuery = query;
  x2FieldMissing = false;
  x2InfinitoFloor = "";
  x2ManualOnly = false;
  signature = "";
  choose("field-guide");
}

function showX2BlueOpportunity(current) {
  const opportunity = x2BlueOpportunity(current);
  if (!opportunity) return;
  const {member, names} = opportunity;
  const hint = element("aside", "story-hint encounter-guide");
  hint.append(element("strong", "", `Blue Bullet opportunity for ${catalog.x2.party[member]}`),
    element("p", "", names.join(" · ")),
    action("See how to learn it", () => openX2FieldGuide("blue", member)));
  panel.append(hint);
}

function x2FieldRows(current) {
  if (x2FieldMode === "blue") {
    const encounters = x2BlueEncounters(current);
    const live = Number.isInteger(current.blueBullets?.[x2BlueMember]);
    return x2BlueBullets.map(([name,fiends,note], index) => {
      const key = x2BlueKey(x2BlueMember, name);
      const done = x2BlueLearned(current, x2BlueMember, index);
      return {name, key, description:fiends.join(" · "),
        note, current:done ? undefined : encounters.get(name), done, automatic:live,
        saved:live && done};
    }).sort((a,b) => Number(!!b.current) - Number(!!a.current));
  }
  return x2OversoulEntries.map(([name,bit,place,floor]) => {
    const key = `oversoul:${name}`;
    const saved = x2OversoulSeen(current.oversoul, bit);
    const description = [place === "Via Infinito" && floor ? "" : place,
      floor && `Via Infinito ${floor === "Any" ? "any floor" : "F" + floor}`]
      .filter(Boolean).join(" · ");
    return {name, key, description, floor, saved, mapped:bit!=null, done:saved || x2FieldChecks.has(key),
      note:bit == null ? "Manual tracking" : saved ? "Seen in Shinra’s Bestiary" : "Watches Shinra’s Bestiary"};
  });
}

function showX2FieldGuide(current) {
  heading("Fiend Guide", "Final Fantasy X-2");
  const filters = element("div", "filters field-guide-filters");
  const description = element("p", "field-note");
  const summary = element("p", "field-note field-guide-count");
  const sheet = element("div", "sheet");
  const query = element("input");
  query.type = "search";
  query.placeholder = x2FieldMode === "blue" ? "Search abilities or fiends" : "Search fiends or places";
  query.setAttribute("aria-label", "Search Fiend Guide");
  query.value = x2FieldQuery;
  const mode = options("Tracker", [["oversoul","Shinra’s Oversouls"],["blue","Blue Bullets"]], x2FieldMode,
    value => openX2FieldGuide(value));
  filters.append(mode);
  if (x2FieldMode === "blue") filters.append(options("Gun Mage", catalog.x2.party.map((name,index) => [index,name]),
    x2BlueMember, value => {
      x2BlueMember = Number(value);
      draw();
    }));
  const missing = element("input");
  missing.type = "checkbox";
  missing.checked = x2FieldMissing;
  const missingLabel = element("label", "mix-filter", "Missing only");
  missingLabel.prepend(missing);
  filters.append(query);
  if (x2FieldMode === "oversoul") {
    const label=element("label","mix-filter","Manual entries only"), checkbox=element("input");
    checkbox.type="checkbox";checkbox.checked=x2ManualOnly;
    checkbox.addEventListener("change",()=>{x2ManualOnly=checkbox.checked;draw();});
    label.prepend(checkbox);filters.append(label);
    const floor = element("input", "infinito-floor");
    floor.type = "number";
    floor.min = "1";
    floor.max = "100";
    floor.placeholder = "Floor";
    floor.setAttribute("aria-label", "Via Infinito floor");
    floor.value = x2InfinitoFloor;
    floor.addEventListener("input", () => { x2InfinitoFloor = floor.value; draw(); });
    filters.append(floor);
  }
  filters.append(missingLabel);
  panel.append(filters, description, summary, sheet);

  function draw(focusKey) {
    const blue = x2FieldMode === "blue";
    const records = x2FieldRows(current);
    const found = records.filter(record => (!x2FieldMissing || !record.done) &&
      (blue || !x2ManualOnly || !record.mapped) &&
      (blue || x2MatchesFloor(record.floor, Number(x2InfinitoFloor))) &&
      `${record.name} ${record.description}`.toLowerCase().includes(x2FieldQuery.trim().toLowerCase()));
    description.textContent = blue ? (Number.isInteger(current.blueBullets?.[x2BlueMember]) ?
      "Learned abilities follow your save. Moves you can learn in this fight appear first." :
      "Mark abilities after your Gun Mage learns them. Enemies in the current fight appear first.") :
      "Seeing a fiend Oversoul is enough. Flee to keep the family’s Oversoul ready for the next encounter. Supported entries fill in from Shinra’s Bestiary.";
    summary.textContent = `${records.filter(record => record.done).length} / ${records.length} ${blue ? "learned" : "seen"}`;
    if(!blue && x2ManualOnly)summary.textContent+=" · "+found.length+" manual entries in this selection";
    sheet.replaceChildren();
    let focus;
    for (const record of found) {
      const row = entry(record.name, record.current ? `In this fight · ${record.current}` : record.description);
      if (record.current && record.current !== record.description) {
        row.append(element("p", "field-note", `Sources · ${record.description}`));
      }
      if (record.note) row.append(element("p", "field-note", record.note));
      if (record.saved && blue) {
        row.classList.add("completed");
        row.append(element("p", "field-note", "Learned"));
      }
      if (!record.saved && !record.automatic) {
        const label = record.done ? (blue ? "Learned" : "Seen") : (blue ? "Mark learned" : "Mark seen");
        const button = action(label, () => {
          if (record.done) x2FieldChecks.delete(record.key);
          else x2FieldChecks.add(record.key);
          try { localStorage.setItem(x2FieldKey, JSON.stringify([...x2FieldChecks])); } catch {}
          draw(record.key);
        });
        button.setAttribute("aria-pressed", String(record.done));
        button.setAttribute("aria-label", `${label}: ${record.name}`);
        row.append(button);
        if (record.key === focusKey) focus = button;
      }
      if (!blue && !record.done) {
        row.append(trackFiendButton(current, record.name, record.description, 1));
      }
      sheet.append(row);
    }
    if (found.length === 0) sheet.append(element("p", "empty", "No matching entries."));
    if (focusKey) (focus || missing).focus({preventScroll:true});
  }
  missing.addEventListener("change", () => { x2FieldMissing = missing.checked; draw(); });
  query.addEventListener("input", () => { x2FieldQuery = query.value; draw(); });
  draw();
}
