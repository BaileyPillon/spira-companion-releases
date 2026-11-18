const {readFileSync} = require("node:fs");
const {runInContext,createContext} = require("node:vm");
const assert = require("node:assert/strict");
const test = require("node:test");

const context = createContext({
  localStorage:{getItem() { return '["blue:0:White Wind"]'; }}
});
for (const file of ["ffx2-crimson", "ffx2-sphere-break", "ffx2-field-guide", "ffx-overdrive",
  "ffx2-publicity-data", "ffx2-calm-lands", "catalog", "ffx2-experiment", "ffx2-dressphere-hunt",
  "ffx2-towers"]) {
  runInContext(readFileSync(`app/assets/${file}.js`, "utf8"), context);
}
const read = expression => JSON.parse(runInContext(`JSON.stringify(${expression})`, context));

test("Crimson Sphere deadlines update by chapter and live inventory", () => {
  const opening = read("x2CrimsonProgress({chapter:1,crimsonSpheres:0})");
  assert.equal(opening[8].window, "Chapter deadline");
  assert.equal(opening[0].window, "Later");
  const preConcert = read("x2CrimsonProgress({chapter:4,crimsonSpheres:0x30f})");
  assert.equal(preConcert[4].window, "Chapter deadline");
  const late = read("x2CrimsonProgress({chapter:5,crimsonSpheres:0x35f})");
  assert.deepEqual(late.filter(sphere => !sphere.owned).map(sphere => [sphere.id,sphere.window]),
    [[6,"This chapter"],[8,"This chapter"]]);
  const alternate = read("x2CrimsonProgress({chapter:5,crimsonSpheres:0x317})");
  assert.equal(alternate[3].window, "This chapter");
  assert.equal(alternate[6].window, "Chapter passed");
  assert.equal(read("x2CrimsonProgress({chapter:5})"), null);
});

test("Publicity and matrimony answers respect chapter, area and campaign", () => {
  const before = read('x2CampaignAnswers(2,"Mi’ihen Highroad","both")')[0][1];
  assert.equal(before.length, 14);
  assert.match(before[0][4], /After the chocobo mission/);
  const late = read('x2CampaignAnswers(5,"Besaid","both")')[0][1];
  assert.ok(late.some(([,name]) => name === "Keepa on the beach"));
  assert.ok(!late.some(([,name]) => name.includes("back-left")));
  assert.deepEqual(read('x2CampaignAnswers(4,"Besaid","both")'), []);
  const marriage = read('x2CampaignAnswers(4,"","matrimony")');
  assert.deepEqual(marriage.map(([name,rows]) => [name, rows.length]), [["Moonflow",2],["Guadosalam",1]]);
  assert.equal(marriage[0][1][0][3], 1);
});

test("Ruin Depths needs three successful returns at each level", () => {
  const progress = read('x2RanchProgress([8,3,0,2,4])');
  assert.equal(progress.remaining, 4);
  assert.deepEqual(progress.levels.map(row => row.need), [0,0,3,1,0]);
  assert.equal(read('x2RanchProgress([3,3,3,3,3])').remaining, 0);
});

test("Experiment progression distinguishes the first story win, level caps, and Annihilator", () => {
  const stats = read("x2ExperimentStats({parts:[[0,1,0],[6,3,1],[38,0,0]]})");
  assert.deepEqual(stats.map(row => [row.points,row.level,row.toMax]), [[3,1,35],[20,4,18],[38,5,0]]);
  const stages = read(`(() => {
    const maxed = {parts:[[12,3,5],[11,6,3],[15,6,5]]};
    return [
      x2ExperimentStep(maxed,5)[0],
      x2ExperimentStep({...maxed,earlyScene:true},5)[0],
      x2ExperimentStep({...maxed,earlyScene:true,maxScene:true},5)[0],
      x2ExperimentStep({parts:[[0,0,0],[1,0,0],[2,0,0]]},5)[0]
    ];
  })()`);
  assert.deepEqual(stages, ["Check the lower-level scene","Ready for the level-5 fight",
    "Both scenes recorded","Fight the earlier form first"]);
  const cues = read(`(() => {
    const battle = {battle:true,enemies:[{name:"Experiment",hp:300}]};
    return [37,38].map(score => x2BlueEncounters({...battle,experiment:{
      parts:[[0,0,0],[0,0,0],[score,0,0]]
    }}).has("Annihilator"));
  })()`);
  assert.deepEqual(cues,[false,true]);
});

test("Dressphere routes separate preparation, one-chapter pickups, rematches, and ownership", () => {
  const chapter2 = read("x2DressphereHunt({chapter:2, loadout:{dresspheres:[[0x500f,2]]}})");
  assert.equal(chapter2.length, 17);
  assert.equal(chapter2.find(row => row.name === "Trainer").state, "Prepare now");
  assert.equal(chapter2.find(row => row.name === "Full Throttle").state, "Chapter deadline");
  assert.equal(chapter2.find(row => row.name === "Floral Fallal").quantity, 2);
  const later = read("x2DressphereHunt({chapter:5,loadout:{dresspheres:[]}})");
  assert.equal(later.find(row => row.name === "Lady Luck").state, "This chapter");
  assert.equal(later.find(row => row.name === "Berserker").state, "Chapter passed");
});

test("Tower prize tiers and Samurai’s Honor count attempted zero scores", () => {
  const rows = read("x2TowerProgress({scores:[30,30,30,30,30,5,6,15,25,29],attempted:Array(10).fill(true)})");
  assert.equal(rows.ready,true);
  assert.equal(rows.perfect,5);
  assert.deepEqual(rows.rows.slice(5).map(row => row.reward),
    ["Yellow Ring","Watery Gleam","NulBlaze Ring","Snow Ring","Tetra Bracelet"]);
  const ribbon = read("x2TowerProgress({scores:[30,30,30,30,0,0,0,0,0,30],attempted:Array(10).fill(true)})");
  assert.equal(ribbon.ready,true);
  assert.equal(ribbon.rows[9].reward,"Ribbon");
  const pending = read("x2TowerProgress({scores:[30,30,30,30,0,0,0,0,0,30],attempted:[true,true,true,true,true,true,false,true,true,true]})");
  assert.equal(pending.attempted,9);
  assert.equal(pending.ready,false);
});

test("Overdrive countdown keeps learned bits, the current mode and per-mode remaining separate", () => {
  const rows = read(`xOverdriveRows({
    overdriveMode:2, overdriveModes:1 << 8, overdriveRemaining:[0,19,0,55,65535,79]
  })`);
  assert.equal(rows.length, 17);
  assert.equal(rows[1].name, "Comrade");
  assert.equal(rows[1].remaining, 19);
  assert.equal(rows[1].learned, false);
  assert.equal(rows[2].equipped, true);
  assert.equal(rows[8].learned, true);
  assert.equal(rows[4].remaining, null);
});

test("Gun Mage tracking uses each character’s current save and falls back to old checks", () => {
  const available = read(`(() => {
    const battle = {battle:true,enemies:[{name:"Coeurl",hp:100}],
      party:[{id:0,hp:300,job:0x5002},{id:1,hp:200,job:0x5002}]};
    return [
      x2BlueOpportunity(battle),
      x2BlueOpportunity({...battle,blueBullets:[0x8010,0x8000,0]}),
      x2BlueOpportunity({...battle,blueBullets:[0,0x8010,0]}),
      x2BlueOpportunity({...battle,blueBullets:[0x8010,0x8010,0]})
    ];
  })()`);
  assert.deepEqual(available, [
    {member:0,names:["Blaster"]},
    {member:1,names:["White Wind"]},
    {member:0,names:["White Wind","Blaster"]},
    null
  ]);
});

test("Sphere Break keeps an echo and reaches its first multiple on the final coin", () => {
  const entry = "1235";
  const border = "102876010903";
  for (let core = 1; core <= 9; core++) {
    for (const mode of ["count","multiple","off"]) {
      const moves = read(`sphereBreakMoves(${core},"${entry}","${border}","${mode}",3)`);
      assert.ok(moves.length);
      for (const move of moves) {
        assert.ok(move.coins[0] < 4);
        assert.equal(new Set(move.coins).size, move.coins.length);
        let sum = 0;
        for (const [index,id] of move.coins.entries()) {
          const value = Number((entry + border)[id]);
          assert.ok(value > 0);
          sum += value;
          assert.equal(sum % core === 0, index === move.coins.length - 1);
        }
        assert.equal(sum, move.sum);
        assert.equal(move.silver, move.coins.filter(id => id >= 4).length);
        if (core === 1) assert.equal(move.coins.length, 1);
      }
    }
  }
  assert.equal(read(`sphereBreakMoves(5,"${entry}","${border}","count",3)`)[0].echo, true);
  assert.equal(read(`sphereBreakMoves(5,"${entry}","${border}","multiple",3)`)[0].multiple, 3);
  assert.equal(read(`sphereBreakMoves(1,"${entry}","${border}","count",1)`)[0].echo, false);
  assert.deepEqual(read('sphereBreakMoves(9,"1111","000000000000")'), []);
  assert.equal(read('sphereBreakMoves(7,"1235","012")'), null);
});
