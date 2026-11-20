"use strict";

const caveOrder = [3,10,11,5,1,8,12,13,9,6,7,14,2,15,16,4];
function caveInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}
function caveNext(rows) {
  return caveOrder.find(id => !caveInteger(rows[id]?.code));
}
function caveNotebook(value) {
  const saved = {pass:value?.pass === 2 ? 2 : 1};
  for (const pass of [1,2]) {
    const source = value?.[pass];
    const rows = {};
    for (const id of caveOrder) {
      const old = source?.rows?.[id];
      if (!old || typeof old !== "object") continue;
      const row = {};
      for (const side of ["left","right"]) if (typeof old[side] === "string") row[side] = old[side].slice(0,180);
      for (const field of ["code","battles","gil"]) if (caveInteger(old[field])) row[field] = old[field];
      rows[id] = row;
    }
    saved[pass] = {rows,wall:caveOrder.includes(source?.wall) ? source.wall : caveNext(rows) || 4};
  }
  return saved;
}
// Interval endpoints use wall numbers, while their chronological order comes from the route.
function caveTerm(token, rows, wall) {
  if (/^\d+$/.test(token) && caveInteger(Number(token))) return Number(token);
  const prior = /^W(\d+)$/.exec(token);
  const before = id => caveOrder.includes(id) && caveOrder.indexOf(id) < caveOrder.indexOf(wall);
  if (prior) {
    const id = Number(prior[1]);
    if (!before(id)) throw Error("Choose a wall earlier on this route.");
    if (!caveInteger(rows[id]?.code)) throw Error("Record the accepted code for wall " + id + ".");
    return rows[id].code;
  }
  const interval = /^([BG])\((\d+),(\d+)\)$/.exec(token);
  if (!interval) throw Error("Use numbers joined by +, or insert a clue below.");
  const field = interval[1] === "B" ? "battles" : "gil";
  const start = Number(interval[2]), end = Number(interval[3]);
  if (!(start === 0 || before(start)) || !(before(end) || end === wall) || caveOrder.indexOf(start) >= caveOrder.indexOf(end))
    throw Error("Choose checkpoints in the order you reached them.");
  const total = id => {
    if (id === 0) return 0;
    if (!caveInteger(rows[id]?.[field])) throw Error("Enter cumulative " + field + " at wall " + id + ".");
    return rows[id][field];
  };
  const result = total(end) - total(start);
  if (result < 0) throw Error("The later checkpoint has a smaller total. Recheck both counts.");
  return result;
}
function caveCalculate(row, rows, wall) {
  try {
    const clues = [row.left || "",row.right || ""];
    if (clues.some(clue => !clue.trim())) return {message:"Enter the previous screen’s clue and this wall’s clue."};
    const values = clues.map(clue => clue.toUpperCase().replace(/\s/g,"").split("+").reduce((sum,token) => sum + caveTerm(token, rows, wall), 0));
    const code = values[0] + values[1];
    if (!caveInteger(code)) return {message:"Check the size of the numbers in both clues."};
    return {code, message:values.join(" + ") + " = " + code};
  } catch (error) { return {message:error.message}; }
}
function caveDetails(title, id) {
  const details = element("details","planner-config");
  details.dataset.detailKey = id;
  details.append(element("summary","",title));
  return details;
}
function drawCaveWalls(current, view) {
  const key = routeNotesKey(current,"thunder-walls");
  const notes = caveNotebook(readCompanionSetting(key,{}));
  const pass = notes.pass === 2 ? 2 : 1;
  const run = notes[pass] || {};
  const rows = run.rows || {};
  const wall = caveOrder.includes(run.wall) ? run.wall : caveNext(rows) || 4;
  const row = {...rows[wall]};
  const count = caveOrder.filter(id => caveInteger(rows[id]?.code)).length;
  const earlier = caveOrder.slice(0, caveOrder.indexOf(wall));
  const message = view.message;
  function save(refresh = true) {
    if (!saveCompanionSetting(key, notes)) { message.textContent = "Could not save these cave notes."; return false; }
    if (refresh) planRefresh();
    return true;
  }
  function saveRow(refresh = true) {
    rows[wall] = row;
    notes[pass] = {...run, rows,wall};
    return save(refresh);
  }
  planSelect(view.controls,"Cave clear",[[1,"First puzzle clear"],[2,"Second puzzle clear"]],pass,value => {
    notes.pass = Number(value); save();
  });
  planSelect(view.controls,"Wall",caveOrder.map(id => [id, "Wall " + id + (caveInteger(rows[id]?.code) ? " · opened" : "")]),wall,value => {
    notes[pass] = {...run,rows,wall:Number(value)}; save();
  });
  message.textContent = (current.room === 249 ? "Inside the New Cave · " : "") + count + "/16 walls opened. " +
    (count === 16 ? pass === 1 ? "Return for a second clear to unlock Force of Nature." : "Check the north hallway for Force of Nature." :
    "Follow the red arrow to wall " + caveNext(rows) + ".");
  const card = entry("Wall " + wall, caveInteger(row.code) ? "Accepted code · " + row.code : "Combine the two clues for this wall.");
  const fields = element("div","cave-fields");
  const inputs = {};
  const result = element("output","cave-code");
  let confirm;
  function showResult() {
    const calculation = caveCalculate(row,rows,wall);
    result.textContent = calculation.message;
    confirm.disabled = calculation.code === undefined;
  }
  for (const [id,label] of [["left","Previous screen · lower right"],["right","Current wall · upper left"]]) {
    const field = element("label","plan-field",label);
    const input = element("input");
    input.type = "text"; input.maxLength = 180; input.autocomplete = "off";
    input.setAttribute("aria-label",label); input.value = row[id] || "";
    input.addEventListener("input",() => { row[id] = input.value; saveRow(false); showResult(); });
    inputs[id] = input; field.append(input); fields.append(field);
  }
  function accept(code) {
    row.code = code;
    rows[wall] = row;
    notes[pass] = {...run,rows,wall:caveNext(rows) || wall};
    save();
  }
  confirm = action("Wall opened · save code",() => {
    const {code} = caveCalculate(row,rows,wall);
    if (caveInteger(code)) accept(code);
  },true);
  showResult();
  card.append(fields,result,confirm);
  const nextWall = caveOrder[caveOrder.indexOf(wall) + 1];
  if (nextWall) {
    const label = "Carry clue to wall " + nextWall;
    const carry = element("label","plan-field",label);
    const input = element("input");
    input.type = "text"; input.maxLength = 180; input.autocomplete = "off";
    input.value = rows[nextWall]?.left || ""; input.setAttribute("aria-label",label);
    input.addEventListener("input",() => {
      rows[nextWall] = {...rows[nextWall],left:input.value}; saveRow(false);
    });
    carry.append(input);
    const group = element("div","cave-fields");
    group.append(carry);
    card.append(group,element("small","","Before leaving this screen, copy its lower-right clue here. It will be waiting at the next wall."));
  }
  const insert = caveDetails("Insert an earlier code or encounter count","wall-terms");
  const picker = element("div","cave-fields");
  const side = planSelect(picker,"Add to clue",[["left","Previous screen"],["right","Current wall"]],"left",()=>{});
  const type = planSelect(picker,"Clue type",[["W","Earlier wall code"],["B","Battles between checkpoints"],["G","Gil earned between checkpoints"]],earlier.length ? "W" : "B",toggle);
  const start = planSelect(picker,"From checkpoint",[[0,"Entrance"],...earlier.map(id => [id,"Wall " + id])],0,()=>{});
  const end = planSelect(picker,"To checkpoint",[...earlier,wall].map(id => [id,"Wall " + id]),wall,()=>{});
  const source = planSelect(picker,"Earlier wall",earlier.map(id => [id,"Wall " + id]),earlier[0],()=>{});
  const add = action("Insert in clue",() => {
    const token = type.value === "W" ? "W" + source.value : type.value + "(" + start.value + "," + end.value + ")";
    const target = side.value;
    const prior = (row[target] || "").trimEnd();
    const value = prior + (prior && !prior.endsWith("+") ? " + " : "") + token;
    if (value.length > inputs[target].maxLength) { message.textContent = "This clue is too long. Check the terms."; return; }
    row[target] = value; inputs[target].value = value;
    saveRow(false); showResult();
  });
  function toggle() {
    const isWall = type.value === "W";
    source.parentElement.hidden = !isWall;
    start.parentElement.hidden = end.parentElement.hidden = isWall;
    add.disabled = isWall && !earlier.length;
  }
  toggle(); insert.append(picker,add);
  const record = caveDetails("Record checkpoint totals or a known code","wall-record-" + wall);
  record.append(element("p","","Use the cave’s cumulative battles and gil earned since entry at this wall. The northeast record tracks gil, southwest tracks battles, and southeast lists opened codes. If a chest opened a wall, copy its accepted code here."));
  const counters = element("div","cave-fields");
  for (const [name,label] of [["battles","Battles since entry"],["gil","Gil earned since entry"]]) {
    const input = planNumber(counters,label,caveInteger(row[name]) ? row[name] : "",0,999999999);
    input.required = false;
    input.addEventListener("input",() => {
      if (input.validity.valid && input.value !== "") row[name] = input.valueAsNumber;
      else delete row[name];
      saveRow(false); showResult();
    });
  }
  const known = planNumber(counters,"Known wall code",caveInteger(row.code) ? row.code : "",0,999999999);
  record.append(counters,action("Record known code",() => {
    const code = validPlanNumber(known);
    if (code !== null) accept(code);
  }));
  if (caveInteger(row.code)) record.append(action("Unmark this wall",() => { delete row.code; saveRow(); }));
  const journal = caveDetails("Wall record · " + count + " of 16","wall-journal");
  const table = element("ol","wall-records");
  for (const id of caveOrder) {
    const item = element("li");
    item.append(action("Wall " + id + " · " + (caveInteger(rows[id]?.code) ? rows[id].code : "—"),() => {
      notes[pass] = {...run,rows,wall:id}; save();
    })); table.append(item);
  }
  journal.append(table);
  const help = caveDetails("When to start each clear","wall-help");
  help.append(element("p","","Rescue Cid first. Return to solve the sixteen walls for the first clear and collect the Salvation Promised grid and Paine’s Corpus Invictus. Exit and solve the cave again for Force of Nature. Each clear has its own notebook. A Charm Bangle prevents random encounters if you want to keep battle and gil clues at zero."));
  const reset = action("Start this clear over",() => {
    reset.hidden = true; discard.hidden = false; keep.hidden = false;
  });
  const discard = action("Erase notes for this clear",() => { notes[pass] = {}; save(); });
  const keep = action("Keep notes",() => { reset.hidden = false; discard.hidden = true; keep.hidden = true; });
  discard.hidden = keep.hidden = true;
  help.append(reset,discard,keep);
  view.list.append(card,insert,record,journal,help);
}
