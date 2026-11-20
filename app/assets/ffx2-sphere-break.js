"use strict";

const sphereBreakBoard = [
  4,5,null,6,7,
  8,0,null,1,9,
  null,null,16,null,null,
  10,2,null,3,11,
  12,13,null,14,15
];

function sphereBreakMoves(core, entry, border, mode = "count", previous = 0) {
  if (!/^[1-9]$/.test(core) || !/^[1-9]{4}$/.test(entry) || !/^\d{12}$/.test(border)) return null;
  const values = Array.from(entry + border, Number);
  const limit = 1 << values.length;
  const last = new Int8Array(limit).fill(-1);
  const sums = new Uint8Array(limit), count = new Uint8Array(limit), borders = new Uint8Array(limit);
  last[0] = -2;
  let available = 0;
  for (const [coin,value] of values.entries()) if (value) available |= 1 << coin;
  let suggested = 0, mostBorder = 0;

  for (let mask = 0; mask < limit; mask++) {
    if (last[mask] === -1) continue;
    if (mask && sums[mask] % core === 0) {
      if (!suggested || score(mask) > score(suggested)) suggested = mask;
      if (!mostBorder || borderScore(mask) > borderScore(mostBorder)) mostBorder = mask;
      continue;
    }
    // The first coin must be an entry coin. Any multiple ends the turn immediately.
    let choices = mask ? available & ~mask : available & 15;
    while (choices) {
      const bit = choices & -choices;
      choices ^= bit;
      const next = mask | bit;
      if (last[next] !== -1) continue;
      const coin = 31 - Math.clz32(bit);
      last[next] = coin;
      sums[next] = sums[mask] + values[coin];
      count[next] = count[mask] + 1;
      borders[next] = borders[mask] + Number(coin >= 4);
    }
  }
  if (!suggested) return [];
  return borders[mostBorder] > borders[suggested] ? [move(suggested), move(mostBorder)] : [move(suggested)];

  function keepsEcho(mask) {
    return previous > 0 && (mode === "count" && Number(core) !== 1 && count[mask] === previous ||
      mode === "multiple" && sums[mask] / core === previous);
  }

  function borderScore(mask) {
    return borders[mask] * 32 - count[mask];
  }

  function score(mask) {
    if (keepsEcho(mask)) return 10000 + borderScore(mask);
    if (mode === "count" && !previous && borders[mask]) {
      return 9000 - 512 * Math.abs(count[mask] - 3) + borderScore(mask);
    }
    return borderScore(mask);
  }

  function move(mask) {
    const sum = sums[mask], silver = borders[mask], echo = keepsEcho(mask);
    const coins = [];
    while (mask) {
      const coin = last[mask];
      coins.push(coin);
      mask ^= 1 << coin;
    }
    return {sum, silver, echo, multiple:sum / core, coins:coins.reverse()};
  }
}

const sphereBreakRound = {core:"", entry:"1235", border:"", mode:"count", previous:""};

function showX2SphereBreak() {
  heading("Sphere Break", "Luca · Lady Luck");
  const workspace = element("section", "spherebreak");
  const controls = element("div", "spherebreak-controls");
  const table = element("div", "spherebreak-table");
  table.setAttribute("role", "img");
  const result = element("div", "spherebreak-result");
  const message = element("p", "field-note spherebreak-message");
  message.setAttribute("role", "status");
  const actions = element("div", "filters");
  let selected = 0;
  let moves;
  const cells = new Map();
  for (const id of sphereBreakBoard) {
    const cell = element("span", id == null ? "spherebreak-space" : "spherebreak-coin");
    cell.setAttribute("aria-hidden", "true");
    if (id != null) {
      if (id === 16) cell.classList.add("spherebreak-core");
      else if (id < 4) cell.classList.add("spherebreak-entry");
      cells.set(id, cell);
    }
    table.append(cell);
  }

  const core = input("Core", "core", 1, "1–9");
  const entryCoins = input("Entry coins", "entry", 4, "1235");
  const border = input("Border coins", "border", 12, "12 digits");
  const echo = options("Echo rule", [["count","Coin Count"],["multiple","Multiplier"],["off","None"]],
    sphereBreakRound.mode, value => {
      sphereBreakRound.mode = value;
      sphereBreakRound.previous = "";
      previous.value = "";
      draw();
    });
  const previous = input("Previous break", "previous", 3, "—");
  const hint = element("p", "field-note spherebreak-input-hint", "Enter coins left to right, top to bottom. Use 0 for an empty border slot.");
  const previousLabel = element("label", "", "Previous break");
  previousLabel.append(previous);
  for (const [name,control] of [["Core",core],["Entry coins",entryCoins],["Border coins",border],["Echo rule",echo]]) {
    const label = element("label", "", name);
    label.append(control);
    controls.append(label);
  }
  controls.append(previousLabel, hint);

  const alternate = action("More border coins", () => {
    selected = selected === 0 ? 1 : 0;
    paint();
  });
  const record = action("Played this move", () => {
    const move = moves?.[selected];
    if (!move) return;
    sphereBreakRound.previous = sphereBreakRound.mode === "count" ?
      (sphereBreakRound.core === "1" ? "" : String(move.coins.length)) : String(move.multiple);
    sphereBreakRound.core = sphereBreakRound.border = "";
    core.value = border.value = "";
    previous.value = sphereBreakRound.previous;
    draw();
    core.focus();
  }, true);
  actions.append(record, alternate);
  result.append(message, actions);
  workspace.append(controls, table, result);
  const help = element("details", "grid-attributes spherebreak-help");
  const rules = element("div", "sheet guide-list");
  rules.append(
    entry("Lady Luck", "Play Shinra in the Chapter 3 Luca tournament for 50 quota in 15 turns. For a rematch in Chapter 5, find him in the stadium basement and aim for 100 in 15."),
    entry("Coin Count Echo", "Use the same total number of coins as the previous turn. A core of 1 ends the move on the first coin and resets this Echo."),
    entry("Multiplier Echo", "Use the same multiple of the core as the previous turn. For example, 12 on a core of 4 and 15 on a core of 5 both count as 3×."));
  help.append(element("summary", "", "Shinra and Echo rules"), rules);
  panel.append(spherePracticePanel(),workspace,help);
  draw();

  function input(label, key, length, placeholder) {
    const field = element("input");
    field.type = "text";
    field.inputMode = "numeric";
    field.autocomplete = "off";
    field.maxLength = length;
    field.placeholder = placeholder;
    field.setAttribute("aria-label", label);
    field.value = sphereBreakRound[key];
    field.addEventListener("input", () => {
      field.value = field.value.replace(/\D/g, "");
      sphereBreakRound[key] = field.value;
      draw();
    });
    return field;
  }

  function draw() {
    selected = 0;
    const {core,entry,border,mode,previous} = sphereBreakRound;
    const label = mode === "multiple" ? "Previous multiple" : "Previous coin count";
    previousLabel.firstChild.textContent = label;
    previousLabel.hidden = mode === "off";
    previousLabel.lastChild.setAttribute("aria-label", label);
    moves = sphereBreakMoves(core, entry, border, mode, Number(previous));
    paint();
  }

  function paint() {
    const {core,entry,border,mode} = sphereBreakRound;
    const values = [...Array.from({length:4}, (_,i) => entry[i]),
      ...Array.from({length:12}, (_,i) => border[i]), core];
    const move = moves?.[selected];
    for (const [id, cell] of cells) {
      const value = values[id];
      const step = move ? move.coins.indexOf(id) + 1 : 0;
      cell.textContent = value === "0" || !value ? "·" : value;
      cell.classList.toggle("is-move", step > 0);
      if (step) cell.append(element("small", "spherebreak-step", step));
    }
    const order = move?.coins.map(id => `${id < 4 ? "entry" : "border"} ${values[id]}`).join(" → ");
    table.setAttribute("aria-label", move ? "Coin order: " + order : "Sphere Break board");
    record.disabled = !move;
    alternate.hidden = (moves?.length || 0) < 2 || mode === "off";
    alternate.textContent = selected ? "Recommended move" : "More border coins";
    if (!move) {
      message.textContent = moves ? "No legal break from this board. Check the coin values." :
        "Enter the core and board to find a move.";
      return;
    }
    const title = element("strong", "", move.echo ? "Keep the Echo" :
      core === "1" && mode === "count" ? "Core 1 resets the Echo" : `Break at ${move.sum}`);
    message.replaceChildren(title, element("span", "spherebreak-order", order),
      element("span", "", `${move.coins.length} coins · ${move.silver} border · ${move.multiple}× core`));
  }
}
