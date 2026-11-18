const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const {createContext, runInContext} = require("node:vm");
const test = require("node:test");

function rewardStates(frame) {
  const context = createContext({frame});
  for (const file of ["ffx-progress.js", "ffx-blitzball.js"]) {
    runInContext(readFileSync(join(__dirname, "../app/assets", file), "utf8"), context);
  }
  return JSON.parse(runInContext("JSON.stringify(blitzballProgress(frame)?.map(({earned, listed}) => [earned, listed]) ?? null)", context));
}

test("Blitzball separates an earned reel from one listed in the right event", () => {
  const blitzball = {reels:1, league:[0xbc,0,0], tournament:[0xbb,0xbd,0]};
  const frame = {party:[], progress:{blitzball}};
  assert.deepEqual(rewardStates(frame), [[true,false],[false,true],[false,false],[false,false]]);
  assert.equal(rewardStates({party:[],progress:{}}), null);
});

test("Wakka’s sigil can be offered, held, or already applied", () => {
  const blitzball = {reels:7, league:[24,0,0], tournament:[0,0,0]};
  const frame = {party:[], progress:{blitzball}};
  assert.deepEqual(rewardStates(frame)[3], [false,true]);
  assert.deepEqual(rewardStates({...frame, progress:{blitzball,keyItems:"000000000020"}})[3], [true,false]);
  assert.deepEqual(rewardStates({...frame, party:[{id:4,gear:[{celestial:true,type:0,abilities:[0x8019]}]}]})[3], [true,false]);
});

test("watched recruits prefer free agents and still respect the active location", () => {
  const context = createContext({localStorage:{getItem: () => '["Nimrook","Jumal","unknown"]'}});
  runInContext(readFileSync(join(__dirname, "../app/assets", "ffx-blitzball.js"), "utf8"), context);
  const result = runInContext(`const players = Array.from({length:60}, () => [3,1,5]);
    players[24] = [2,7,1];
    players[50] = [-1,1,0];
    JSON.stringify([blitzWatchOpportunity(players),
      blitzWatchOpportunity(players, name => name === "Nimrook"), blitzWatchOpportunity(null)]);`, context);
  assert.deepEqual(JSON.parse(result), [{name:"Jumal",free:true},{name:"Nimrook",free:false},null]);
});

test("Techcopy targets use rival equipped slots and the learner's two known-technique pages", () => {
  const context = createContext();
  runInContext(readFileSync(join(__dirname, "../app/assets", "ffx-blitzball.js"), "utf8"), context);
  assert.deepEqual(JSON.parse(runInContext(`const blitz = {players:[[5,5,255],[1,10,3],[0,4,3]],
    techniques:[[2,2,[1]],[0,0,[59]],[0,0,[32]]]};
    const rows = blitzTechniqueRows(blitz,0);
    JSON.stringify([rows[0].known,rows[0].equipped,rows[30].known, rows[31].rivals,rows[58].rivals]);`, context)),
    [true,true,true,[{candidate:2,level:4}],[{candidate:1,level:10}]]);
});
