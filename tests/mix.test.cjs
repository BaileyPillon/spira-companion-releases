const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInContext, createContext } = require("node:vm");
const test = require("node:test");

const context = createContext({ present: value => Number.isSafeInteger(value) && value >= 0 });
for (const file of ["ffx-data.js", "ffx-mix-data.js", "ffx-mix.js"]) {
  runInContext(readFileSync(resolve(__dirname, "../app/assets", file), "utf8"), context);
}
const evaluate = code => runInContext(code, context);

test("all Mix results and item pairs are indexed once and match known recipes", () => {
  assert.equal(evaluate("mixResults.length"), 64);
  assert.equal(evaluate("mixResults.reduce((count, mix) => count + mix.recipes.length, 0)"), 6328);
  assert.equal(evaluate("new Set(mixResults.flatMap(mix => mix.recipes.map(pair => pair.join('/')))).size"), 6328);
  assert.equal(evaluate("mixResults[ffxMixRows[110][110]].name"), "Sunburst");
  assert.equal(evaluate("mixResults[ffxMixRows[110][57]].name"), "Hyper Mighty G");
  assert.equal(evaluate("mixResults[ffxMixRows[0][0]].name"), "Ultra Potion");
  assert.equal(evaluate("mixForPair(57, 110) === mixForPair(110, 57)"), true);
});

test("live stock requires two copies of a repeated ingredient and supports effect searches", () => {
  for (const copies of [0, 1, 2]) {
    context.items = [[0x206e, copies], [0x2039, 1]];
    assert.equal(evaluate(`findMixResults(mixInventory(items), "Sunburst", true).length`), copies === 2 ? 1 : 0);
  }
  assert.equal(evaluate(`findMixResults(mixInventory(items), "Auto-Life Light Curtain", true)[0].name`), "Hyper Mighty G");
  assert.equal(evaluate(`findMixResults(mixInventory(items), "19,998 Underdog's Secret", true)[0].recipes.length`), 1);
  assert.equal(evaluate(`findMixResults(mixInventory([]), "Sunburst", false)[0].recipes.length`), 73);
});

test("quick picks disappear when the live inventory cannot support their recipes", () => {
  assert.equal(evaluate("quickMixChoices(mixInventory([])).length"), 0);
  assert.equal(evaluate("quickMixChoices(mixInventory([[0x206e,1]])).some(({mix}) => mix.name === 'Sunburst')"), false);
  assert.equal(evaluate("quickMixChoices(mixInventory([[0x206e,2]])).some(({mix}) => mix.name === 'Sunburst')"), true);
});
