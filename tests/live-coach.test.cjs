const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const {createContext, runInContext} = require("node:vm");
const test = require("node:test");

function fixture(globals = {}, files = []) {
  const context = createContext(globals);
  runInContext(readFileSync(join(__dirname,"../app/assets/live-coach.js"),"utf8"),context);
  for (const file of files) runInContext(readFileSync(join(__dirname,"../app/assets",file),"utf8"),context);
  return code => JSON.parse(runInContext(`JSON.stringify((() => {${code}})())`,context));
}
const frame = {disc:"SLPS-25088",crc:"658597E2",timestamp:1000,room:205,story:2080,battles:100,battle:false};

test("Follow Game requires distinct stable frames and ignores UI re-renders", () => {
  const run = fixture({frame});
  assert.deepEqual(run(`const follower=createActivityFollower();
    return [follower.update(frame),follower.update({...frame,battle:true,timestamp:2000}),
      follower.update({...frame,battle:true,timestamp:2000}),follower.update({...frame,battle:true,timestamp:3199}),
      follower.update({...frame,battle:true,timestamp:3200})];`),[null,null,null,null,{kind:"activity",activity:"battle"}]);
});

test("transient battle states do not switch tools and manual navigation suppresses a pending takeover", () => {
  const run = fixture({frame});
  assert.deepEqual(run(`const f=createActivityFollower(); f.update(frame);
    f.update({...frame,battle:true,timestamp:2000});
    f.suppress();
    const suppressed=f.update({...frame,battle:true,timestamp:3300});
    f.update({...frame,timestamp:4000});
    const field=f.update({...frame,timestamp:5300});
    f.update({...frame,battle:true,timestamp:6000});
    f.update({...frame,timestamp:6200});
    return [suppressed,field,f.update({...frame,timestamp:8000})];`),[null,{kind:"activity",activity:"field"},null]);
});

test("disc switches, rewinds, long gaps and paused feeds cannot trigger stale automatic returns", () => {
  const run = fixture({frame});
  const result = run(`return [
    {...frame,disc:'SLUS-20672',timestamp:2000},
    {...frame,battles:99,timestamp:2000},
    {...frame,story:100,timestamp:2000},
    {...frame,timestamp:500},
    {...frame,timestamp:6000}
  ].map(next=>{const f=createActivityFollower();f.update(frame);return f.update(next);});`);
  assert.deepEqual(result,Array(5).fill({kind:"reset"}));
  assert.deepEqual(run(`const f=createActivityFollower();f.update(frame);
    return [f.update({...frame,paused:true,timestamp:2000}),f.update({...frame,battle:true,timestamp:4000})];`),[null,null]);
});

test("FFX Blitzball menu and pool are distinct while FFX-2 room IDs do not trigger Blitzball", () => {
  const run = fixture({frame});
  assert.deepEqual(run(`return [coachActivity({...frame,room:347}),coachActivity({...frame,room:62}),
    coachActivity({...frame,disc:'SLUS-20672',room:62}),coachActivity({...frame,room:347,battle:true})];`),
    ["blitz-menu","blitz-match","field","battle"]);
});

test("session focus promotes relevant work but never outranks critical recovery or a pickup deadline", () => {
  const run = fixture();
  assert.deepEqual(run(`return coachRank([
    {id:'capture',priority:75,category:'arena'}, {id:'deadline',priority:120,category:'completion'},
    {id:'recovery',priority:100,category:'battle'}, {id:'story',priority:90,category:'story'}
  ],'arena').map(x=>x.id);`),["deadline","recovery","capture","story"]);
});

test("Yunalesca's Zombie protection wins over generic recovery, and empty stock is never recommended", () => {
  const run = fixture({battleTactics:()=>[
    {name:"Holy Water",stock:4,targets:[["Auron","Zombie"]]},
    {name:"Phoenix Down",stock:0,targets:[["Tidus","KO"]]},
    {name:"Hi-Potion",stock:8,targets:[["Rikku","low HP"]]}],
    ffxBossAdvice:()=>["Keep one ally zombified","Zombie protects against Mega Death."]});
  const result = run(`return coachActions({disc:'SLPS-25088',game:'x',battle:true,
    enemies:[{id:129,maxHp:60000,hp:40000}]},'arena').map(x=>x.id);`);
  assert.deepEqual(result,["boss-130","recovery-Hi-Potion-Rikku:low HP"]);
});

test("Evrae's available party heal takes priority over a single-target recovery suggestion", () => {
  const run = fixture({battleTactics:()=>[{name:"Hi-Potion",stock:3,targets:[["Tidus","low HP"]]}],
    ffxBossAdvice:()=>["Use an Al Bhed Potion","Rikku can heal the front line."]});
  assert.deepEqual(run(`return coachActions({disc:'SLPS-25088',game:'x',battle:true,enemies:[{id:119,hp:20000}]}).map(x=>x.id);`),
    ["boss-119","recovery-Hi-Potion-Tidus:low HP"]);
});

test("Follow Game defaults off and a malformed preference cannot opt a user in", () => {
  assert.deepEqual(fixture({localStorage:{getItem:()=>'{"focus":"unknown","follow":"true"}'}})(`return [coachFocus,coachFollow];`),["story",false]);
  assert.deepEqual(fixture({localStorage:{getItem:()=>'{"focus":"arena","follow":true}'}})(`return [coachFocus,coachFollow];`),["arena",true]);
});

test("shared recovery preserves Yunalesca Zombie while allowing a specific poison cure", () => {
  const run = fixture({statusEffects:(game,actor)=>actor.effects,partyName:(game,actor)=>actor.name,
    catalog:{x:{recovery:{1:"Hi-Potion",10:"Antidote",14:"Holy Water",15:"Remedy"}}}},["battle-tactics.js"]);
  const result = run(`const current={game:'x',items:[[8193,5],[8202,2],[8206,3],[8207,4]],
    enemies:[{id:129,maxHp:60000,hp:100}],party:[{name:'Auron',active:true,hp:10,maxHp:5000,effects:'Zombie · Poison'}]};
    const protectedTip=battleTactics(current);
    const ordinary=battleTactics({...current,enemies:[]});
    const noAntidote=battleTactics({...current,items:[[8193,5],[8207,4]]});
    return [protectedTip,ordinary,noAntidote];`);
  assert.deepEqual(result[0],[{name:"Antidote",stock:2,targets:[["Auron","Poison"]]}]);
  assert.equal(result[1][0].name,"Holy Water");
  assert.equal(result[2][0].name,"Antidote");
  assert.equal(result[2][0].stock,0);
});

test("Evrae's group heal is not recommended while a front-line ally is zombified", () => {
  const run = fixture({number:new Intl.NumberFormat()},["story.js"]);
  assert.equal(run(`const current={items:[[8212,5]],party:[{id:6,active:true,hp:50,maxHp:1000,statusBits:2}],enemies:[]};
    return evraeAdvice(current,{hp:32000})[0];`),"Watch for Poison Breath");
});

test("dismissal scope changes for a new fight and resets on a save rewind", () => {
  const run = fixture({frame});
  const result = run(`observeCoachSession(frame);
    const battle={...frame,battle:true,timestamp:2000}; observeCoachSession(battle);
    const first=coachContext(battle); coachDismissed.add(first+'/recovery');
    observeCoachSession({...frame,timestamp:3000});
    observeCoachSession({...battle,timestamp:4000});
    const second=coachContext(battle);
    observeCoachSession({...frame,battles:99,timestamp:5000});
    return [first!==second,coachDismissed.size];`);
  assert.deepEqual(result,[true,0]);
});
