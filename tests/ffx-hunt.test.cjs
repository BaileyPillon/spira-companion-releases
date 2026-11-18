const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {resolve} = require("node:path");
const {createContext, runInContext} = require("node:vm");
const test = require("node:test");

function evaluate(expression) {
  const context = createContext({
    catalog:{x:{party:["Tidus","Yuna","Auron","Kimahri","Wakka","Lulu","Rikku"]}},
    localStorage:{getItem:() => null}
  });
  for (const name of ["ffx-data","ffx-rooms","ffx","ffx-arena","ffx-progress","ffx-collections","ffx-encounter-data","ffx-hunt"]) {
    runInContext(readFileSync(resolve(__dirname, `../app/assets/${name}.js`), "utf8"), context);
  }
  runInContext(`
    const idFor = name => arenaEnemyIds.get(name)[0];
    const foe = (name, slot, hp = 100) => ({id:idFor(name),hp,slot});
    const snapshot = (captures = {}, patch = {}) => {
      const counts = new Uint8Array(640);
      for (const [name, count] of Object.entries(captures)) counts[idFor(name)] = count;
      const arena = Array.from(counts, n => n.toString(16).padStart(2, "0")).join("");
      return {game:"x",disc:"SLPS-25088",crc:"658597E2",arena,story:2000,room:21,battles:50,party:[],...patch};
    };
  `, context);
  return JSON.parse(JSON.stringify(runInContext(expression, context)));
}

test("the generated Arena data includes all species and uses known field rooms", () => {
  const result = evaluate(`(() => {
    const found = new Set(ffxHuntSpots.flatMap(spot => spot[4].flat().map(enemyName)));
    return [allArenaFiends.filter(name => !found.has(name)), ffxHuntSpots.flatMap(spot => spot[2]).filter(room => !ffxRooms[room])];
  })()`);
  assert.deepEqual(result, [[], []]);
});

test("encounter odds preserve repeat slots and cap the value of duplicate targets", () => {
  const result = evaluate(`(() => {
    const id = idFor("Dingo");
    const spot = ["test", 0, [21], "Test", [[id,id], [id,id], [id], [idFor("Condor")]]];
    const {fights, targets, slots, sightings} = huntSpotReport(spot, new Map([["Dingo",1],["Condor",0]]));
    const focused = huntReports(snapshot({}, {room:56}), "here", "Tonberry");
    const completed = huntReports(snapshot({Tonberry:10}), "all", "Tonberry");
    const crossArea = huntReports(snapshot({}, {room:93}), "here", "Funguar");
    return [fights,targets,slots,[...sightings],focused.map(report => [report.spot[0],report.fights,report.slots]),completed,
      crossArea.some(report => report.spot[0] === "djose_highroad_back_half")];
  })()`);
  assert.deepEqual(result, [3,3,4,[["Dingo",3]],[["cave_green_zone",1,10]],[],true]);
});

test("Capture Assist follows the equipped weapon, status, CTB, enemy seats and cap", () => {
  const result = evaluate(`(() => {
    const weapon = equipped => ({type:0,equipped,abilities:[captureAbility]});
    const party = [{id:0,hp:100,active:true,gear:[weapon(true)]},
      {id:4,hp:100,active:true,statusTimed:1,gear:[weapon(true)]},
      {id:5,hp:100,active:true,gear:[weapon(false)]},
      {id:6,hp:100,active:false,gear:[weapon(true)]}];
    const targets = [foe("Dingo",0,70), {...foe("Dingo",1,90), targeted:true}, foe("Condor",2), foe("Water Flan",3,0)];
    const data = snapshot({Condor:10}, {battle:true,party,turnOrder:[20,0],enemies:targets});
    return [captureRoster(data).filter(member => member.ready).map(member => [member.name,member.position]),
      huntBattleTargets(data).map(({foe}) => foe.slot),huntBattleTargets({...data,room:307})];
  })()`);
  assert.deepEqual(result, [[["Tidus",1]],[1,0],[]]);
});

test("Hunt journal counts only observed fights and rebases on unrelated changes or reloads", () => {
  const result = evaluate(`(() => {
    const before = {Condor:1,"Water Flan":1};
    const battle = {battle:true,battles:51,enemies:[foe("Dingo",0),foe("Dingo",1)]};
    huntSession = {disc:"SLPS-25088",crc:"658597E2",goal:1,rows:[],fights:0,caught:0};
    updateHuntSession(snapshot(before));
    updateHuntSession(snapshot(before, battle));
    updateHuntSession(snapshot({...before,Dingo:1}, battle));
    updateHuntSession(snapshot({...before,Dingo:1}, {battles:51}));
    updateHuntSession(snapshot({...before,Dingo:2}, {battles:51}));
    updateHuntSession(snapshot({...before,Dingo:2}, {battles:51}));
    updateHuntSession(snapshot({...before,Dingo:2}, {...battle,battles:52}));
    updateHuntSession(snapshot({...before,Dingo:3,Tonberry:1}, {battles:52}));
    updateHuntSession(snapshot({...before,Dingo:3,Tonberry:1}, {battles:52}));
    updateHuntSession(snapshot(before, {battles:50}));
    updateHuntSession(snapshot(before, battle));
    updateHuntSession(null);
    updateHuntSession(snapshot({...before,Dingo:1}, {battles:51}));
    return [huntSession.fights,huntSession.caught,huntSession.rows];
  })()`);
  assert.deepEqual(result, [1,2,[{room:21,seen:[["Dingo",2]],changes:[["Dingo",2]],milestones:["Besaid"]}]]);
});
