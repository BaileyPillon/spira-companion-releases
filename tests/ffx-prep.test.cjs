const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const {createContext, runInContext} = require("node:vm");
const test = require("node:test");

function prep(code, input) {
  const context = createContext({input});
  for (const file of ["ffx-customization-data.js", "ffx-prep.js"]) {
    runInContext(readFileSync(join(__dirname, "../app/assets", file), "utf8"), context);
  }
  return JSON.parse(runInContext(`JSON.stringify(${code})`, context));
}

test("Boss Prep favors usable owned gear and accepts Ribbon instead of Stoneproof", () => {
  const gear = [
    {type:1, equipped:true, abilities:[0x8056,0x8055,0x800a,0x8057]},
    {type:1, celestial:true, abilities:[0x8080,null,null,null]},
    {type:1, abilities:[0x8080,0x8056,null,null]}
  ];
  const fit = prep("prepLoadout(input, ffxPrepPlans.dark, new Map())", {gear});
  assert.equal(fit.fits, true);
  assert.deepEqual(fit.matched, [0x8056,null,null,0x8080]);
  assert.deepEqual(fit.missing.map(({item}) => item), [0x2039,0x2007]);
});

test("Boss Prep adds costs across the party before subtracting shared stock", () => {
  const costs = prep("prepCosts(input, new Map([[0x2037,99]]))", [
    {missing:[{item:0x2037,cost:80}]}, {missing:[{item:0x2037,cost:80}]}
  ]);
  assert.deepEqual(costs, [{item:0x2037,needed:160,owned:99,short:61}]);
});

test("Karma estimate follows the selected party and honors the damage cap", () => {
  const roster = [{id:2,fiendsDefeated:67},{id:5,fiendsDefeated:1100},{id:0,fiendsDefeated:91}];
  const estimate = prep("prepKarmaRoster(input).map(({member,karma,mode}) => [member.id,karma,mode])", roster);
  assert.deepEqual(estimate, [[5,99999,2],[0,9100,1],[2,6700,1]]);
});

test("Penance arms use actor IDs in forecast order and discard a defeated arm", () => {
  const enemies = [{id:345,battleId:9,hp:0},{id:346,battleId:10,hp:400}];
  const result = prep("penanceArmStatus(input)", {enemies,turnOrder:[0,9,4,10,8]});
  assert.equal(result.both, false);
  assert.equal(result.soonest.id, 346);
  assert.equal(result.soonest.next, 2);
});
