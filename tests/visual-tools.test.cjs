const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {resolve} = require("node:path");
const {runInContext,createContext} = require("node:vm");
const test = require("node:test");

const context = createContext({present: Number.isInteger});
for (const file of ["ffx-data","ffx","grid-inspector","ffx-mix-data","ffx-mix","mix-explorer",
  "ffx2-grid-data","garment-rehearsal","chapter-board"]) {
  runInContext(readFileSync(resolve(__dirname,"../app/assets",file+".js"), "utf8"),context);
}
const evaluate = source => runInContext(source,context);

test("Sphere Grid symbols cover both layouts and distinguish Strength and Magic by shape", () => {
  assert.equal(evaluate("[...ffxData.standard.nodes,...ffxData.expert.nodes].every(n => gridGlyph(n[2]) !== 'unknown')"), true);
  assert.equal(evaluate("gridGlyph(5)"),"power");
  assert.equal(evaluate("gridGlyph(13)"),"mana");
  assert.equal(evaluate("gridGlyph(255)"),"unknown");
});

test("remote activation respects locks, empty nodes and International command families", () => {
  assert.deepEqual(Array.from(evaluate("[1,5,39,56,58,78,118,119,120,125,126,255].map(gridRemoteSphere)")),
    [null,8267,null,8269,8268,8270,8271,8268,8269,8269,8268,null]);
});

test("Mix families partition all 64 results and linked recipes always contain the ingredient", () => {
  assert.equal(evaluate("mixResults.every(m => mixFamilies.filter(([,lo,hi])=>lo<=m.index && hi>=m.index).length===1)"),true);
  assert.equal(evaluate("mixResults.every(m => mixWorkbenchRecipes(m,mixInventory([]),null).length === m.recipes.length)"),true);
  assert.equal(evaluate("mixWorkbenchRecipes(mixForPair(0,0),mixInventory([[8192,2]]),0)[0].join()"),"0,0");
  assert.equal(evaluate("mixResults.every(m => mixWorkbenchRecipes(m,mixInventory([]),3).every(p=>p.includes(3)))"),true);
});

test("rehearsal follows only connected slots, seeds live gates and safely replays undo or a blocked path", () => {
  context.route = [[[0,0],[0,1],[1,0],[1,1]],[[0,1,1,[]],[1,2,4,[]],[2,3,2,[]],[2,3,8,[]]]];
  const path = (steps, blocked=[]) => JSON.parse(evaluate(`JSON.stringify(garmentPracticePath(route,0,new Set(${JSON.stringify(blocked)}),${JSON.stringify(steps)},8))`));
  assert.deepEqual(path([2]).edges,[]);
  assert.deepEqual(path([0,1,2]).nodes,[0,1,2,3]);
  assert.equal(path([0,1,2]).mask,15);
  assert.equal(path([0,1]).mask,13);
  assert.deepEqual(path([0,1,2],[2]).edges,[0]);
  assert.deepEqual(path([],[0]).moves,[]);
  assert.deepEqual(path([0,1]).moves.map(m=>m.index),[1,2,3]);
  assert.equal(evaluate("Object.values(x2GarmentTopology).every(t => t[0].every((_,i) => garmentPracticePath(t,i,new Set(),[]).moves.length > 0))"),true);
});

test("destination counts keep every flag once and route remote viewings to the Celsius", () => {
  context.scenes = [
    {chapter:4,location:"Besaid · Cave",visit:"Celsius · Shinra’s CommSphere network",done:false},
    {chapter:4,location:"Besaid Village",done:true},
    {chapter:4,location:"Besaid · Great Hall",done:false,conditional:true},
    {chapter:5,location:"Celsius · Deck",done:true}
  ];
  assert.equal(evaluate("chapterDestinations(scenes,4,true).reduce((n,p)=>n+p.flags.length,0)"),3);
  assert.equal(evaluate("chapterDestinations(scenes,4,false)[0].name"),"Celsius");
  assert.equal(evaluate("chapterDestinations(scenes,4,true).find(p=>p.name==='Besaid').recorded"),1);
});
