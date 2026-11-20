const assert = require("node:assert/strict");
const {createContext,runInContext} = require("node:vm");
const {readFileSync} = require("node:fs");
const {resolve} = require("node:path");
const test = require("node:test");

const ctx = createContext({atob, number:new Intl.NumberFormat("en-US"),
  readCompanionSetting:()=>({}), saveCompanionSetting:()=>true});
for (const file of ["ffx2-ap-data","ffx2","journey-journal"]) {
  runInContext(readFileSync(resolve(__dirname,"../app/assets",file+".js"),"utf8"),ctx);
}
const run = s => runInContext(s,ctx);

test("Trainer and Mascot read the correct ability names and independent AP slots for each Gullwing",()=>{
  const bytes = Buffer.alloc(0x6a0);
  bytes.writeUInt16LE(80,424); // Ghiki Gag
  bytes.writeUInt16LE(20,442); // Poison Flurry, partway to 40
  bytes.writeUInt16LE(80,540); // Cactling Gun
  ctx.ap = bytes.toString("base64");
  assert.equal(run("x2AbilityProgress(ap,12,1).find(a=>a.name==='Ghiki Gag').done"),true);
  assert.equal(run("x2AbilityProgress(ap,12,2).find(a=>a.name==='Poison Flurry').ap"),20);
  assert.equal(run("x2AbilityProgress(ap,12,0).some(a=>a.name==='Ghiki Gag' || a.done)"),false);
  assert.equal(run("x2AbilityProgress(ap,14,2).find(a=>a.name==='Cactling Gun').done"),true);
  assert.equal(run("x2AbilityProgress(ap,14,1).some(a=>a.name==='Moogle Beam')"),false);
  assert.equal(run("x2AbilityProgress(ap,14,0).some(a=>a.name==='Swordplay')"),true);
  assert.equal(run("x2AbilityProgress('bad',14,1).length"),0);
});

test("a journal checkpoint reports changes conservatively across backwards loads",()=>{
  ctx.mark={game:"x",disc:"SLPS-25088",story:2500,battles:200,gil:30400};
  assert.match(run("journalDelta(mark,{...mark,battles:201,gil:30420})"),/1 battle · \+20 gil/);
  assert.match(run("journalDelta(mark,{...mark,story:2000,battles:209})"),/different saves/);
  assert.match(run("journalDelta(mark,{...mark,battles:12})"),/different saves/);
  assert.match(run("journalDelta({...mark,game:'x2',chapter:5},{...mark,chapter:1})"),/different saves/);
});

test("only supported live room observations enter the persistent per-game route",()=>{
  const next=(game,room,disc)=>({game,room,disc,battles:1,gil:4,story:42,timestamp:5000});
  ctx.fx=next("x",18,"SLPS-25088"); ctx.sequel=next("x2",17,"SLUS-20672");
  run("observeJourney({...fx,disc:'unsupported'});observeJourney(fx);observeJourney({...fx,gil:8});observeJourney(sequel)");
  assert.equal(run("journeyBook.x.route.length"),1);
  assert.equal(run("journeyBook.x.latest.gil"),8);
  assert.equal(run("journeyBook.x2.latest.room"),17);
  run("observeJourney({...fx,gil:8,timestamp:80000})");
  assert.equal(run("journeyBook.x.latest.timestamp"),80000);
  run("observeJourney({...fx,game:'x2',room:99})");
  assert.equal(run("journeyBook.x2.latest.room"),17);
  for (let i=0;i<30;i++) run("observeJourney({...fx,room:"+i+"})");
  assert.equal(run("journeyBook.x.route.length"),24);
  assert.equal(run("journeyBook.x.route[0].room"),29);
});
