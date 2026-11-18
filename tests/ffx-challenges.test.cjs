const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const {createContext,runInContext} = require("node:vm");
const test = require("node:test");

const context = createContext({});
runInContext(readFileSync(join(__dirname,"../app/assets/ffx-challenges.js"), "utf8"), context);
const evaluate = code => JSON.parse(JSON.stringify(runInContext(code, context)));

test("Catcher Chocobo needs an extra balloon when the score would land exactly at zero", () => {
  assert.deepEqual(evaluate("[catcherBalloonTarget(360,0),catcherBalloonTarget(359,0),catcherBalloonTarget(380,1)]"), [13,12,14]);
});

test("Lightning run advances on dodges, resets on a hit, and stops on uncertain transitions", () => {
  assert.deepEqual(evaluate("(() => {\n" +
    "const run = {count:5,room:140,battles:9,timestamp:1000,bolts:40,dodges:32,best:15};\n" +
    "const frame = (bolts,dodges,overrides = {}) => ({room:140,battles:9,timestamp:1500,\n" +
    "  progress:{challenges:{lightning:{bolts,dodges,best:15}}},...overrides});\n" +
    "return [lightningRunAfter(run,frame(41,33)).count,lightningRunAfter(run,frame(41,32)).count,\n" +
    "  lightningRunAfter(run,frame(42,33)),lightningRunAfter(run,frame(39,32)),\n" +
    "  lightningRunAfter(run,frame(40,32,{room:162})),lightningRunAfter(run,frame(40,32,{battle:true})),\n" +
    "  lightningRunAfter(run,frame(40,32,{timestamp:4500}))];\n" +
    "})()"), [6,0,null,null,null,null,null]);
});

test("Cactuar quest distinguishes the airship and the last sphere from a finished village", () => {
  assert.deepEqual(evaluate("[0,1,2,15,25,17,18].map(stage => cactuarStep(stage)[0])"),
    ["Start the hunt","Tomay","Return to the glyph","Elio","Elio","Flaile’s sphere","Village open"]);
});
