const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {resolve} = require("node:path");
const {createContext, runInContext} = require("node:vm");
const test = require("node:test");

const context = createContext({localStorage:{getItem:() => null}});
for (const name of ["ffx-data","ffx","ffx-gear-drop-data","ffx-gear-drops"]) {
  runInContext(readFileSync(resolve(__dirname, `../app/assets/${name}.js`), "utf8"), context);
}
const evalJson = code => JSON.parse(JSON.stringify(runInContext(code, context)));

test("One-Eye's three-slot Triple AP weapons reflect the recruited party and finisher", () => {
  const [any, neutral, named, other, unrecruited] = evalJson(`(() => {
    const plan = {...lootPresets.ap, owner:-1, finisher:-1};
    const roster = [0,1,2,3,4,5,6];
    const chance = patch => gearOdds(gearDropProfile(299), {...plan,...patch}, roster);
    return [chance({}), chance({owner:4}), chance({owner:4,finisher:4}), chance({owner:4,finisher:1}),
      gearOdds(gearDropProfile(299), {...plan,owner:4}, [0,1,3])];
  })()`);
  assert.ok(Math.abs(any - .25) < 1e-12);
  assert.equal(neutral, .25 / 7);
  assert.equal(named, .10);
  assert.equal(other, .025);
  assert.equal(unrecruited, 0);
});

test("Dark Yojimbo models duplicate Ribbon rolls and the separate two-ability case", () => {
  const [only, both, impossible, p50, p90] = evalJson(`(() => {
    const chance = key => gearOdds(gearDropProfile(340), {...lootPresets[key],owner:-1,finisher:-1}, [0,1,2,3,4,5,6]);
    const only = chance("ribbon");
    const both = chance("survival");
    const impossible = gearOdds(gearDropProfile(340), {...lootPresets.survival,free:3,owner:-1,finisher:-1}, [0]);
    return [only,both,impossible,gearWinsFor(both,.5),gearWinsFor(both,.9)];
  })()`);
  assert.ok(Math.abs(only - 0.75 / 2 / 49) < 1e-12);
  assert.ok(Math.abs(both - 0.75 / 2 * 6 / 49) < 1e-12);
  assert.equal(impossible, 0);
  assert.deepEqual([p50,p90], [15,49]);
});

test("forced abilities, duplicates and zero ability slots terminate the random rolls correctly", () => {
  const actual = evalJson(`(() => {
    const pool = [1,2,2,2,1,1,1,0];
    return [gearRollChance(pool,[1],[3],[1],0),gearRollChance(pool,[2],[2],[1],1),
      gearRollChance(pool,[2],[2],[2],0),gearRollChance(pool,[2],[2],[3],0)];
  })()`);
  assert.deepEqual(actual,[1,16/49,33/49,0]);
});

test("all generated entries resolve known abilities and live gear checks respect owner and free slots", () => {
  const result = evalJson(`(() => {
    const gear = (type, abilities) => ({type,abilities});
    const party = [{id:0,gear:[gear(0,[0x8013,null]),gear(0,[0x8013,null,null]),gear(1,[0x8013,null,null])]},
      {id:4,gear:[gear(0,[0x8013,null,null])]}];
    return [ffxGearDropData.pools.flat().filter(id => id && !ffxData.abilities[id]),
      gearAlreadyOwned(party,{...lootPresets.ap,owner:4}).map(({member}) => member.id),
      gearHuntSources({...lootPresets.ap,owner:-1,finisher:-1},[0,4]).slice(0,1).map(row => row.foe.name)];
  })()`);
  assert.deepEqual(result,[[],[4],["One-Eye"]]);
});
