"use strict";

const x2TowerRewards = [
  ["Ether","Ether ×2","Turbo Ether","Turbo Ether ×2","Elixir"],
  ["X-Potion","Mega-Potion ×2","Elixir","Elixir","Megalixir"],
  ["Mega Phoenix","Mega Phoenix","Elixir","Elixir","Megalixir"],
  ["Power Wrist","Black Belt","Hyper Wrist","Power Gloves","Champion Belt"],
  ["Silver Bracer","Hypno Crown","Gold Bracer","Pixie Dust","Regal Crown"],
  ["Yellow Ring","Lightning Gleam","NulShock Ring","Ochre Ring","Electrocutioner"],
  ["Blue Ring","Watery Gleam","NulTide Ring","Cerulean Ring","Short Circuit"],
  ["Red Ring","Fiery Gleam","NulBlaze Ring","Crimson Ring","Freezerburn"],
  ["White Ring","Icy Gleam","NulFrost Ring","Snow Ring","Sublimator"],
  ["Tetra Band","Tetra Gloves","Tetra Guard","Tetra Bracelet","Ribbon"]
];

const x2TowerCharacters = ["Rikku","Paine","Yuna","Rikku","Paine","Yuna","Rikku","Paine","Yuna","Yuna"];
const x2MemoryButtons = [
  ["Cross","×"],["Circle","○"],["Triangle","△"],["Square","□"],
  ["Up","↑"],["Down","↓"],["Left","←"],["Right","→"],
  ["L1","L1"],["R1","R1"],["L2","L2"],["R2","R2"]
];
let x2TowerSection = "all";
let x2MemoryOpen = false;
let x2TowerSequence = [];

function x2TowerProgress(records) {
  const rows = records.scores.map((score, index) => {
    const tier = [6,15,25,30].filter(minimum => score >= minimum).length;
    return {id:index + 1, score, attempted:records.attempted[index], character:x2TowerCharacters[index],
      reward:x2TowerRewards[index][tier], perfectReward:x2TowerRewards[index][4]};
  });
  const attempted = rows.filter(row => row.attempted).length;
  const perfect = rows.filter(row => row.score === 30).length;
  return {rows, attempted, perfect, ready:attempted === 10 && perfect >= 5};
}

function showX2Towers(current) {
  const {rows, attempted, perfect, ready} = x2TowerProgress(current.towers);
  heading("Tower Calibration", "Thunder Plains");
  const title = `${attempted}/10 attempted · ${perfect} perfect`;
  let instruction = "Calibrate during Chapters 2 and 3. Try all ten and score 30 on any five for Samurai’s Honor.";
  if (ready) instruction = "Samurai’s Honor requirements met. Speak to the technician at the Travel Agency if you haven’t claimed it.";
  if (current.chapter === 5) instruction = "Defeat the fiends at the towers to collect the Chapter 5 chests shown below.";
  const overview = entry(title, "", instruction);
  overview.classList.add("story-hint", "x2-experiment-next");
  overview.classList.toggle("x2-quest-complete", ready);
  panel.append(overview);
  const controls = element("div", "filters");
  const list = element("div", "sheet guide-list");
  controls.append(options("Tower area", [["all","All towers"],["south","South · 1–5"],["north","North · 6–10"]],
    x2TowerSection, value => { x2TowerSection = value; draw(); }));
  const memory = action("Tower 10 reverse aid", () => {
    aid.open = true;
    aid.querySelector("summary").focus({preventScroll:true});
    aid.scrollIntoView({block:"start"});
  });
  controls.append(memory);
  const aid = x2TowerMemoryAid();
  const help = element("details", "grid-attributes");
  const notes = element("div", "sheet guide-list");
  notes.append(
    entry("Start calibrating", "", "Talk to the Al Bhed technician by the first tower in Chapter 2 or 3 and offer to help. Approach each tower to calibrate it."),
    entry("Rikku", "", "Match the lit prompts quickly. Some later prompts ask for two buttons together."),
    entry("Paine", "", "Watch for the flash as the falling prompts pass the middle of the screen."),
    entry("Yuna", "", "Repeat the sequence shown in the memory phase. Tower 10 asks for the sequence backwards."));
  help.append(element("summary", "", "Calibration controls"), notes);
  panel.append(controls, aid, list, help);
  draw();

  function draw() {
    const visible = rows.filter(row => x2TowerSection === "all" ||
      (x2TowerSection === "south" ? row.id <= 5 : row.id >= 6));
    list.replaceChildren(...visible.map(row => {
      const status = row.attempted ? `${row.score}/30` : "Unattempted";
      const result = entry("Tower " + row.id, `${status} · ${row.character}`);
      result.classList.toggle("completed", row.score === 30);
      result.append(element("p", "", "Chapter 5 chest · " + row.reward));
      if (row.reward !== row.perfectReward) result.append(element("p", "field-note", "At 30 · " + row.perfectReward));
      return result;
    }));
  }
}

function x2TowerMemoryAid() {
  const details = element("details", "grid-attributes");
  details.open = x2MemoryOpen;
  details.addEventListener("toggle", () => { x2MemoryOpen = details.open; });
  const body = element("div", "sheet x2-memory-aid");
  const keys = element("div", "x2-memory-keys");
  const result = element("p", "x2-memory-order");
  result.setAttribute("role", "status");
  const tools = element("div", "filters");
  const undo = action("Undo", () => { x2TowerSequence.pop(); draw(); });
  const reset = action("Clear", () => { x2TowerSequence = []; draw(); });
  const buttons = x2MemoryButtons.map(([label,symbol], index) => {
    const button = action(symbol, () => { x2TowerSequence.push(index); draw(); });
    button.setAttribute("aria-label", label);
    return button;
  });
  keys.append(...buttons);
  tools.append(undo,reset);
  body.append(element("p", "field-note", "Tap each prompt as it flashes. Enter the displayed reverse order on your controller."),
    result, keys, tools);
  details.append(element("summary", "", "Tower 10 reverse aid"), body);
  draw();
  return details;

  function draw() {
    result.replaceChildren();
    if (!x2TowerSequence.length) result.textContent = "Waiting for the first prompt";
    else for (const id of [...x2TowerSequence].reverse()) {
      const [label,symbol] = x2MemoryButtons[id];
      const step = element("span", "x2-memory-step", symbol);
      step.setAttribute("aria-label", label);
      result.append(step);
    }
    undo.disabled = reset.disabled = !x2TowerSequence.length;
    for (const button of buttons) button.disabled = x2TowerSequence.length >= 6;
  }
}
