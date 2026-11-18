const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInContext, createContext } = require("node:vm");
const test = require("node:test");

const ffx = readFileSync(resolve(__dirname, "../app/assets/ffx.js"), "utf8");
const story = readFileSync(resolve(__dirname, "../app/assets/story.js"), "utf8");
const element = (tag, css, text) => ({
  tag, css, text, children: [],
  append(...nodes) { this.children.push(...nodes); },
  get childElementCount() { return this.children.length; },
});
const names = node => (node.tag === "strong" ? [node.text] : node.children.flatMap(names));
const text = node => [node.text, ...node.children.flatMap(text)].filter(Boolean);
const enemy = (name, targeted) => ({ name, targeted, hp: 10, maxHp: 12, affinities: {} });

function mount(current) {
  const panel = element("main");
  const context = createContext({
    panel, current, element, localStorage: { getItem: () => null },
    entry: (name, note) => {
      const node = element("div");
      node.append(element("strong", "", name), element("small", "", note));
      return node;
    },
    metric: () => element("span"),
    partyName: (_, actor) => actor.name,
    ffxData: { enemies: Object.fromEntries(current.enemies.map(actor => [actor.id, actor])) },
    visits: [],
  });
  runInContext(ffx, context);
  runInContext(`showBattleTarget(current);
    if (current.game === "x2") showSequelBattle(current);
    else showField(current);`, context);
  return panel.children;
}

test("all selected FFX enemies remain visible, with Cid excluded", () => {
  const [selected, , remaining] = mount({ game: "x", enemies: [
    { ...enemy("Dual Horn", true), id: 1 },
    { ...enemy("Evil Eye", true), id: 2 },
    { ...enemy("Bomb", false), id: 3 },
    { ...enemy("Cid", true), id: 4 },
  ] });
  assert.deepEqual(names(selected), ["Dual Horn", "Evil Eye"]);
  assert.deepEqual(names(remaining), ["Bomb"]);
});

test("FFX enemy effects appear both on the selected target and in the enemy list", () => {
  const [selected, , remaining] = mount({ game: "x", enemies: [
    { ...enemy("Selected fiend", true), id: 1, statusTimed: 1 << 11 },
    { ...enemy("Other fiend", false), id: 2, statusBits: 1 << 4 },
  ] });
  assert.ok(text(selected).includes("Haste"));
  assert.ok(text(remaining).includes("Power Break"));
});

test("FFX-2 distinguishes same-name foes and shows a KO'd ally targeted for revival", () => {
  const [selected, , remaining] = mount({ game: "x2",
    enemies: [enemy("Goon", false), enemy("Goon", true), enemy("Goon", true)],
    party: [{ ...enemy("Paine", true), hp: 0 }],
  });
  assert.deepEqual(names(selected), ["Goon B", "Goon C", "Paine"]);
  assert.deepEqual(names(remaining), ["Goon A"]);
});

test("Evrae advice uses the battle gauge, actual item stock, party condition and enemy Haste", () => {
  const foe = { id: 119, hp: 32000, maxHp: 32000 };
  const rikku = { id: 6, active: true, hp: 1716, maxHp: 1716, overdrive: 100, overdriveMax: 100 };
  const current = { game: "x", battle: true, party: [rikku], items: [[0x206e, 99], [0x2014, 48], [0x2006, 14], [0x200b, 5]], enemies: [foe] };
  const context = createContext({ current, foe, number: new Intl.NumberFormat("en-US"), element,
    panel: element("main"), metric: () => element("span") });
  runInContext(story, context);
  const advice = () => Array.from(runInContext("evraeAdvice(current, foe)", context));
  assert.deepEqual(advice(), ["Mix Sunburst", "Rikku can mix two Underdog’s Secrets. 19,998 damage leaves 12,002 HP."]);
  foe.hp = 19000;
  assert.match(advice()[1], /can finish Evrae/);
  current.party.push({ id: 2, active: true, hp: 2500, maxHp: 2500, statusBits: 4 });
  assert.equal(advice()[0], "Use an Al Bhed Potion");
  current.party.pop();
  rikku.statusBits = 4;
  assert.equal(advice()[0], "Cure Rikku’s petrification");
  rikku.hp = 0;
  assert.equal(advice()[0], "Revive Rikku");
  rikku.hp = 1716;
  rikku.statusBits = 0;
  current.items[0][1] = 1;
  assert.equal(advice()[0], "Watch for Poison Breath");
  current.items[0][1] = 99;
  rikku.overdrive = 0;
  foe.statusTimed = 1 << 11;
  assert.equal(advice()[0], "Evrae has Haste");
  runInContext("showStoryHint(current)", context);
  assert.deepEqual(names(context.panel), ["Evrae has Haste"]);
  foe.hp = 0;
  runInContext("showStoryHint(current)", context);
  assert.equal(context.panel.childElementCount, 1);
});
