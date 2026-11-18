const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const {createContext, runInContext} = require("node:vm");
const test = require("node:test");

function evaluate(code, globals = {}) {
  const context = createContext(globals);
  for (const file of ["ffx-blitzball.js", "ffx-blitz-stats-data.js", "ffx-blitz-team.js"])
    runInContext(readFileSync(join(__dirname, "../app/assets", file), "utf8"), context);
  return JSON.parse(runInContext(`JSON.stringify((() => { ${code} })())`, context));
}

test("all 60 save IDs resolve to distinct, ordered, bounded reference samples", () => {
  const result = evaluate(`return blitzPlayers.map(name => ({name, data:blitzStatReference[name]}));`);
  assert.equal(new Set(result.map(p => p.name)).size, 60);
  for (const {name, data} of result) {
    assert.ok(data, name);
    assert.ok(data.location, name);
    assert.equal(data.samples.at(-1)[0], 99);
    let previous = 0;
    for (const row of data.samples) {
      assert.equal(row.length, 9);
      assert.ok(row[0] > previous);
      previous = row[0];
      row.forEach((value,index) => assert.ok(Number.isInteger(value) && value >= 0 && value <= (index === 1 ? 9999 : 99)));
    }
  }
});

test("exact reference levels and interpolated levels are distinguished", () => {
  const [first, middle, end] = evaluate(`return [1,3,99].map(level => blitzStatsAt('Tidus',level));`);
  assert.equal(first.stats.HP, 132);
  assert.equal(first.stats.SH, 10);
  assert.equal(first.estimated, false);
  assert.equal(middle.stats.HP, 185);
  assert.equal(middle.stats.SH, 12);
  assert.equal(middle.estimated, true);
  assert.equal(end.stats.SH, 78);
});

test("uninitialized or unsupported levels are never turned into live stats", () => {
  assert.deepEqual(evaluate(`return [0,100,NaN,null,1.5].map(level => blitzStatsAt('Tidus',level));`), [null,null,null,null,null]);
  const [missing, preview] = evaluate(`return [blitzStatsAt('Wakka',1), blitzStatsAt('Wakka',1,true)];`);
  assert.equal(missing, null);
  assert.equal(preview.level, 3);
  assert.equal(preview.minimum, true);
});

test("candidate pools use current team ownership, including expiring rivals", () => {
  const result = evaluate(`const blitz = {players:Array.from({length:60}, () => [2,10,1])};
    blitz.players[0] = [5,10,255]; blitz.players[50] = [-1,1,0];
    return ['roster','free','all'].map(pool => blitzTeamCandidates(blitz,pool).map(p => p.id));`);
  assert.deepEqual(result[0], [0]);
  assert.deepEqual(result[1], [0,50]);
  assert.equal(result[2].length,60);
});

test("the lineup maximizes all six positions globally rather than taking each top player twice", () => {
  const result = evaluate(`const ids = [0,2,3,4,5,6,50];
    const blitz = {players:Array.from({length:60}, (_,id) => [ids.includes(id) ? 5 : 2,10,10])};
    const pool = blitzTeamCandidates(blitz,'roster');
    const team = blitzBuildTeam(pool);
    let maximum = -Infinity;
    function brute(used, slot, score) {
      if (slot === 6) { maximum = Math.max(maximum,score); return; }
      for (const player of pool) if (!used.includes(player.id))
        brute([...used,player.id],slot+1,score+blitzRoleScore(player.stats,blitzSlots[slot]));
    }
    brute([],0,0);
    return {ids:team.map(p => p.id), score:team.reduce((s,p,i) => s+blitzRoleScore(p.stats,blitzSlots[i]),0), maximum};`);
  assert.equal(new Set(result.ids).size,6);
  assert.ok(Math.abs(result.score - result.maximum) < 1e-8);
});

test("position choices are honored without duplication and short rosters fail clearly", () => {
  const result = evaluate(`const blitz = {players:Array.from({length:60}, () => [5,10,10])};
    const pool = blitzTeamCandidates(blitz,'roster');
    return [blitzBuildTeam(pool,[0,null,null,null,null,6]).map(p => p.id), blitzBuildTeam(pool.slice(0,5))];`);
  assert.equal(result[0][0],0);
  assert.equal(result[0][5],6);
  assert.equal(new Set(result[0]).size,6);
  assert.equal(result[1],null);
});

test("forecast levels never overwrite saved levels or contract status", () => {
  const result = evaluate(`const blitz = {players:[[5,1,255]]};
    const forecast = blitzTeamCandidates(blitz,'roster',99)[0];
    return [forecast.level,forecast.player,blitz.players[0]];`);
  assert.deepEqual(result,[99,[5,1,255],[5,1,255]]);
});

test("reference-only previews include all players without inventing contracts", () => {
  const result = evaluate(`const all = blitzTeamCandidates(null,'all',99);
    return [all.length,all.every(p => p.player === null),blitzCandidateContract(all[0]),
      blitzTeamCandidates(null,'roster',99),blitzTeamCandidates(null,'all')];`);
  assert.deepEqual(result,[60,true,"Contract unknown · load your roster",[],[]]);
});

test("learned Jecht Shot is shown from the save, not inferred from the player's name", () => {
  const result = evaluate(`return [blitzKnownMoves({techniques:[[2,0,[]]]},0),
    blitzKnownMoves({techniques:[[0,0,[]]]},0), blitzKnownMoves({},0)];`);
  assert.deepEqual(result,["Learned: Jecht Shot","No learned techniques recorded","Learned techniques unavailable"]);
});
