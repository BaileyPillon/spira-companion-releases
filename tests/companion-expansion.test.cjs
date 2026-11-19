const assert=require("node:assert/strict");
const test=require("node:test");
const {readFileSync}=require("node:fs");
const {join}=require("node:path");
const {createContext,runInContext}=require("node:vm");

function fixture(extra={}) {
  const storage=new Map();
  const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k),key:i=>[...storage.keys()][i],get length(){return storage.size;}};
  const context=createContext({atob,btoa,Blob,window:{},localStorage,number:new Intl.NumberFormat("en-US"),
    itemAmounts:items=>new Map(items),roomName:({room})=>String(room),guideRooms:new Map(),...extra});
  for(const file of ["catalog.js","ffx-data.js","ffx.js","ffx-progress.js","ffx-arena.js","ffx-hunt.js",
    "ffx-customization-data.js","ffx-customization.js","ffx-collections.js","ffx-prep.js","ffx-endgame.js",
    "ffx2-story-data.js","ffx2-scene-routes.js","ffx2-ap-data.js","ffx2.js","story.js","ffx-blitzball.js","ffx-blitz-team.js",
    "profiles.js","workspace.js","goal-planner.js","grid-sandbox.js","ffx2-scene-audit.js",
    "battle-model-data.js","battle-model.js","boss-odds.js","ffx2-route-tools.js","butterfly-route-data.js","butterfly-coach.js","blitz-live.js","cloister-live.js"])
    runInContext(readFileSync(join(__dirname,"../app/assets",file),"utf8"),context,{filename:file});
  return {context,storage,run:code=>JSON.parse(runInContext(`JSON.stringify(${code})`,context)),exec:code=>runInContext(code,context)};
}

test("profile round trips keep separate notes and exclude cheat settings",()=>{
  const {run,storage}=fixture();storage.set("spira.workspace.note.v1",'"Original notes"');storage.set("spira.cheats.enabled","true");
  assert.deepEqual(run(`(()=>{const backup=SpiraProfiles.backup(),id=SpiraProfiles.create("Second");SpiraProfiles.activate(id);
    const empty=SpiraProfiles.capture();localStorage.setItem("spira.workspace.note.v1",'"Second notes"');SpiraProfiles.activate("original");
    const original=SpiraProfiles.capture();const imported=SpiraProfiles.importBackup(backup);SpiraProfiles.activate(imported);
    return [empty,original,SpiraProfiles.capture(),JSON.parse(backup).data];})()`),[{},...Array(3).fill({"spira.workspace.note.v1":'"Original notes"'})]);
  assert.equal(storage.get("spira.cheats.enabled"),"true");
});
test("profile files enforce the same UTF-8 byte limit on export and import", () => {
  const {exec, storage} = fixture();
  storage.set("spira.workspace.note.v1", "界".repeat(1_500_000));
  assert.throws(() => exec("SpiraProfiles.backup()"), /too large|backup limit/);
  assert.throws(() => exec('SpiraProfiles.importBackup("界".repeat(1_500_000))'), /4 MB/);
  assert.equal(storage.size, 1);
});

test("profile imports reject foreign data without changing active preferences",()=>{
  const {exec,storage}=fixture();storage.set("spira.workspace.note.v1",'"Keep this"');
  for(const data of [{token:"secret"},{"spira.cheats.token":"secret"},{"spira.workspace.note.v1":{x:1}},[]]) {
    assert.throws(()=>exec(`SpiraProfiles.importBackup(${JSON.stringify(JSON.stringify({format:"spira-companion-profile",version:1,name:"Bad",data}))})`));
    assert.equal(storage.get("spira.workspace.note.v1"),'"Keep this"');
  }
});
test("profile switching rolls back both data and registry on a storage failure",()=>{
  const f=fixture();f.storage.set("spira.workspace.note.v1",'"Keep"');
  f.exec(`testProfile=SpiraProfiles.create("Second",{"spira.workspace.note.v1":'"Other"'});oldSet=localStorage.setItem;
    localStorage.setItem=(k,v)=>{if(k==="spira.profiles.v1"&&!failed){failed=true;throw Error("quota");}return oldSet(k,v);};failed=false;`);
  assert.throws(()=>f.exec("SpiraProfiles.activate(testProfile)"));assert.equal(f.storage.get("spira.workspace.note.v1"),'"Keep"');
  assert.equal(f.run("SpiraProfiles.registry().active"),"original");
});
test("journey input handles malformed arrays and drops invalid goals and quantities",()=>{
  assert.deepEqual(fixture().run('validJourney({goals:"anima",members:{},items:[[8192,-1],[8192,20]]})'),{goals:[],members:[],items:[[8192,20]]});
});
test("multi-goal journey deduplicates captures, subtracts stock once and orders prerequisites",()=>{
  const f=fixture();
  const result=f.run(`(()=>{const current={game:"x",disc:"SLPS-25088",room:223,story:3000,grid:"01",arena:"00".repeat(640),
    progress:{trials:0,optionalAeons:0,keyItems:"00".repeat(16),darkAeons:0},items:[[8192,9]],party:[{id:0,gear:[]}]};
    const plan=buildJourney(current,{goals:journeyGoals.map(g=>g[0]),members:[0],items:[[8192,20]]});
    return {unique:plan.steps.length===new Set(plan.steps.map(s=>s.id)).size,
      validOrder:plan.steps.every((s,i)=>s.deps.every(id=>plan.steps.findIndex(p=>p.id===id)<i)),
      stock:plan.materials.find(m=>m.item===8192),targets:[...new Set(plan.captures.map(c=>c.target))]};})()`);
  assert.equal(result.unique,true);assert.equal(result.validOrder,true);assert.equal(result.stock.short,11);assert.deepEqual(result.targets,[10]);
});
function prepareGrid(f,layout="standard"){
  f.exec(`gridInput={disc:"SLPS-25088",grid:ffxData.${layout}.nodes.map(n=>n[2].toString(16).padStart(2,"0")+"00").join("").padEnd(4096,"0"),
    gridLinks:"00".repeat(881),gridPositions:[0,0,0,0,0,0,0],party:[{id:0,attributes:Array(8).fill(20),sphereLevel:10,maxHp:1000,maxMp:100}],items:[]};
    build=newGridBuild(gridInput);build.layout="${layout}";`);
}
test("grid sandbox accepts real 2048-byte grids on Standard and Expert",()=>{
  for(const layout of ["standard","expert"]){const f=fixture();prepareGrid(f,layout);assert.equal(f.run("validateGridBuild(build).layout"),layout);}
});
test("grid edits charge a Clear Sphere and subtract the replaced activated stat",()=>{
  const f=fixture();prepareGrid(f);
  const r=f.run(`(()=>{const id=ffxData.standard.nodes.findIndex(n=>n[2]===5);build.base.grid=build.base.grid.slice(0,id*4)+"0501"+build.base.grid.slice(id*4+4);build.edits[id]=1;
    const plan=gridBuildPlan(build);return [plan.costs,plan.stats.find(s=>s.name==="Strength")];})()`);
  assert.deepEqual(r,[[{item:8287,needed:1}],{name:"Strength",before:20,after:16}]);
});
test("grid imports reject invalid nodes, missing members and malformed movement history",()=>{
  const f=fixture();prepareGrid(f);
  for(const edit of ['x.edits={"99999":5}','x.member=6','x.base.gridLinks="zz"','x.base.party[0].attributes[0]=999'])
    assert.throws(()=>f.exec(`{const x=JSON.parse(JSON.stringify(build));${edit};validateGridBuild(x);}`));
});
test("scene audit gives all mapped flags a route and avoids false lockouts",()=>{
  const f=fixture();const r=f.run(`(()=>{const rows=x2SceneAudit({disc:"SLUS-20672",chapter:2,storyFlags:btoa("\\0".repeat(0x2868))});
    return [rows.length,rows.filter(r=>r.named).length,rows.find(r=>r.key==="1275:8")];})()`);
  assert.equal(r[0],525);assert.equal(r[1],525);assert.equal(r[2].name,"Comfort Brother after the Floating Ruins");
  assert.match(r[2].recovery,/does not prove/);
});
test("battle model shows MP draining separately and fails closed without live attributes",()=>{
  const f=fixture();const r=f.run(`(()=>{const actor={battleAttributes:Array(8).fill(20),mp:100,hp:100,maxHp:1000,maxMp:100,gear:[],boosts:Array(6).fill(0)};
    const id=Object.keys(battleModelData.actions).find(id=>battleModelData.actions[id].name==="Osmose");
    return [compareBattleAction({items:[]},actor,actor,id).pool,compareBattleAction({items:[]},{...actor,battleAttributes:null},actor,id).issues];})()`);
  assert.equal(r[0],"MP");assert.match(r[1].join(" "),/attributes are unavailable/);
});
test("CTB agility bands and Haste use integer recovery ticks",()=>{
  assert.deepEqual(fixture().run("[battleCtbDelay(20,3),battleCtbDelay(20,3,true),battleCtbDelay(20,3,false,true),battleCtbDelay(170,3)]"),[30,15,60,9]);
});
test("damage arithmetic matches independent RNG tracker vectors across all 32 rolls",()=>{
  const vectors=JSON.parse(readFileSync(join(__dirname,"fixtures/battle-oracle.json"),"utf8"));const f=fixture();
  for(const v of vectors){f.context.vector=v;
    const result=f.run(`(()=>{const action=Object.values(battleModelData.actions).find(a=>a.name===vector.name);return Array.from({length:32},(_,n)=>battleSingleDamage(action,vector.user,vector.target,n));})()`);
    assert.deepEqual(result,v.rolls,v.name);
  }
});
test("grid sandbox refuses Clear Sphere edits on ability nodes and can start without Tidus",()=>{
  const f=fixture();prepareGrid(f);f.exec('build.edits[ffxData.standard.nodes.findIndex(n=>ffxData.types[n[2]]?.[2])]=1');
  assert.throws(()=>f.exec('validateGridBuild(build)'),/cannot be erased/);
  f.exec('gridInput.party[0].id=1');assert.equal(f.run('newGridBuild(gridInput).member'),1);
});
test("butterfly route cannot advance twice on the same frame or through a feed gap",()=>{
  const f=fixture();assert.deepEqual(f.run(`(()=>{const course={room:241,path:[[0,0],[1,0],[2,0],[3,0],[4,0]]},run={room:241,index:0,last:100};
    const next=butterflyAdvance(run,{x:0,y:0},course,200);return [next.index,butterflyAdvance(next,{x:0,y:0},course,200).index,butterflyAdvance(next,{x:0,y:0},course,3000)];})()`),[4,4,null]);
});
test("Blitzball never treats the opponent as a suggested passing teammate",()=>{
  const f=fixture();f.context.match={carrier:0,elapsed:280,period:300,score:[1,0],players:[
    {slot:0,id:6,x:0,y:0,stats:{EN:10,SH:20}},{slot:1,id:0,x:150,y:0,stats:{}},{slot:8,id:10,x:10,y:0,stats:{AT:25,BL:10}},{slot:13,id:15,x:500,y:0,stats:{CA:10}}]};
  assert.deepEqual(f.run("[blitzMatchAdvice(match).headline,blitzMatchAdvice(match,[8]).headline,blitzMatchAdvice(match).mates.map(p=>p.slot),blitzMatchAdvice({...match,carrier:-1}).headline]"),
    ["Protect the lead","Avoid this break attempt",[1],"Ball in transition"]);
});
test("Besaid guidance distinguishes the first Glyph door from the hidden chamber",()=>{
  assert.deepEqual(fixture().run(`(()=>{const s={temple:"Besaid",held:2,phases:[0,0,0,0,0],sockets:[{id:39,value:0},{id:40,value:0}]};
    return [cloisterNext(s,false).target,cloisterNext({...s,phases:[1,0,0,0,0]},false).target,cloisterNext(s,true).target,
      cloisterNext({...s,held:0,sockets:[{id:38,value:2},{id:42,value:1}]},true).target];})()`),[39,40,39,38]);
});

test("FFX-2 groups shared scene flags without treating alternate outcomes as compulsory",()=>{
  const r=fixture().run(`(()=>{const flags=new Uint8Array(0x2868);flags[25]=4;
    const rows=x2SceneAudit({disc:"SLUS-20672",chapter:1,storyFlags:btoa(String.fromCharCode(...flags))});
    const groups=x2GroupSceneChecks(rows);return {bits:groups.reduce((n,g)=>n+g.flags.length,0),
      concert:groups.find(g=>g.name==="Opening concert").flags.map(f=>f.done),
      alternate:groups.filter(g=>g.name.includes("Alternate Farplane farewell")||g.name.includes("Episode Concluded variant")).map(g=>g.conditional),
      crossChapter:x2SceneRoutes.some(([a,b])=>x2StoryEvents[a][0]!==x2StoryEvents[b][0])};})()`);
  assert.deepEqual(r,{bits:525,concert:[true,false],alternate:[true,true],crossChapter:false});
});

test("Kilika distinguishes the Glyph Sphere, Destruction Sphere and dropped pedestal",()=>{
  assert.deepEqual(fixture().run(`(()=>{const s=(held,dropped,values,done=false,doors=1)=>cloisterNext({temple:"Kilika",held,
      puzzle:{doors,dropped},sockets:Object.entries(values).map(([id,value])=>({id:+id,value}))},done);
    const glyph=s(4,false,{31:0});
    return [glyph.held,glyph.target,s(0,false,{31:4,26:1,33:3}).target,s(0,true,{31:4,26:0,33:3}).target,
      s(6,true,{31:4,33:0,34:3}).target,s(0,true,{33:6,34:3},true,3).target,s(2,false,{28:1,30:4,26:0,31:0,29:0}).target,
      s(0,true,{30:4,31:0,32:6,33:0,34:3}).target];})()`),
    ["Glyph Sphere",31,26,33,33,34,26,30]);
});

test("Djose only guides the pit crossing after a floating platform and gates the upper chest",()=>{
  assert.deepEqual(fixture().run(`(()=>{const f=(held,p,slots,done=false)=>cloisterNext({temple:"Djose",held,puzzle:p,
    sockets:Object.entries({43:1,44:1,...slots}).map(([id,value])=>({id:+id,value}))},done);
    return [f(0,{door:true,pit:false},{49:1,50:1}).title,f(0,{door:true,pit:true},{49:1,50:1}).title,
      f(0,{elevator:true,stage:1,glyph:1},{51:10}).title,f(0,{elevator:true,stage:1,glyph:2},{51:10}).target,
      f(10,{elevator:true,stage:1,glyph:2},{51:0,52:0}).target,f(0,{elevator:true,stage:0,upper:5},{},true).title];})()`),
    ["Push the loaded pedestal into the electrified pit","Cross the electrified pit and press the far pedestal","Open the secret glyph on the lower floor",51,52,"Push the upper pedestals · 2/5"]);
});

test("Macalania restores the ramp and uses current bridge pieces after collecting the treasure",()=>{
  assert.deepEqual(fixture().run(`(()=>{const f=(held,m,slots,done)=>cloisterNext({temple:"Macalania",held,puzzle:{pedestal:m,bridgeSeen:true,lifted:true},
    sockets:Object.entries(slots).map(([id,value])=>({id:+id,value}))},done);
    return [f(10,0,{33:0},false).target,f(10,0,{33:4},false).target,f(0,4,{34:4,35:4,39:4},true).title,
      f(0,3,{34:4,35:4,39:4},true).target,f(11,3,{34:0,37:0},false).target,
      f(0,0,{34:10,33:4,32:4},true).title];})()`),[34,36,"Cross the ice bridge and climb the stairs",34,37,"Recall and exchange the pedestal sphere"]);
});

test("Bevelle separates the corridor key from the exit and supports a sphere aboard the pedestal",()=>{
  assert.deepEqual(fixture().run(`(()=>{const f=(held,slots,exitBridge=false)=>cloisterNext({temple:"Bevelle",held,
    puzzle:{firstBridge:true,exitBridge},sockets:Object.entries(slots).map(([id,value])=>({id:+id,value}))},false);
    return [f(2,{8:1,11:0}).target,f(3,{8:1,11:2,7:0}).target,f(0,{8:1,3:3}).target,f(1,{8:0,10:0},true).target,
      f(0,{2:1,3:1,8:0,10:0},true).target];})()`),[11,7,3,10,3]);
});

test("Bevelle guides recovery from an unpowered pedestal and stops prompting for collected Knight Lance",()=>{
  assert.deepEqual(fixture().run(`(()=>{const f=(held,slots,puzzle,done)=>cloisterNext({temple:"Bevelle",held,puzzle,
    sockets:Object.entries(slots).map(([id,value])=>({id:+id,value}))},done);
    return [f(1,{2:0,3:0}, {firstBridge:false},false).target,
      f(1,{2:2,3:0}, {firstBridge:false},false).target,
      f(0,{2:1,3:1}, {firstBridge:true},false).target,
      f(0,{2:1,10:1}, {firstBridge:true,exitBridge:true,knightLance:true},false).title,
      f(0,{2:1,10:1}, {firstBridge:true,exitBridge:true,knightLance:true},true).title];})()`),
    [2,5,3,"Open the HP Sphere chest before leaving","Leave through the exit on the right"]);
});

test("Zanarkand story tile counts cannot reveal the post-airship sphere",()=>{
  assert.deepEqual(fixture().run(`(()=>{const f=(phase,white,held,sockets=[])=>cloisterNext({temple:"Zanarkand",held,
    puzzle:{phase,white,solved:0,small:0,large:0},sockets},false);
    return [f(0,8,0).pattern.count,f(5,6,0).pattern.tiles.length,f(5,8,0,[{id:12,value:3}]).target,f(5,8,3).target];})()`),[5,7,12,10]);
});

test("Zanarkand resumes after the story puzzle when the save has reset the local counters",()=>{
  assert.deepEqual(fixture().run(`(()=>{const state={temple:"Zanarkand",held:0,sockets:[],
    puzzle:{phase:0,solved:0,small:0,large:0,white:0}};
    return [cloisterNext(state,false,2725).pattern.count,cloisterNext(state,false,2775).title,
      cloisterNext(state,false,2795).title,cloisterNext({...state,puzzle:{...state.puzzle,phase:5}},false,3250).pattern.count];})()`),
    [5,"Save and enter the large chamber","Continue through the Dome",7]);
});

test("Dark Mindy thresholds distinguish 100 winning rolls from all 101, including Aim", () => {
  const f = fixture();
  const run = (luck, aim, goal, accuracy) => f.run(`bossHitPlan([0,0,0,0,0,${luck},0,${accuracy}],battleModelData.monsters[343].stats,${aim},${goal})`);
  assert.equal(run(205, 0, 100, 255).rolls, 100);
  assert.equal(run(205, 0, 100, 10).targetLuck, 206);
  assert.equal(run(156, 5, 100, 10).rolls, 101);
  assert.equal(run(156, 0, 100, 10).requiredAim, 5);
  assert.equal(run(201, 0, 95, 255).targetLuck, 201);
  assert.equal(f.run("bossHitPlan([], [], 5, 100)"), null);
});

test("Celestial power follows each owner's resource and rejects missing data", () => {
  const f = fixture();
  const factors = f.run(`Array.from({length:7},(_,id)=>celestialPower({id,hp:100,maxHp:100,mp:0,maxMp:100}).multiplier)`);
  assert.deepEqual(factors, [1, 1/11, .5, 1, 1, 1/11, 1]);
  assert.equal(f.run("celestialPower({id:2,hp:70,maxHp:100}).multiplier"), 1);
  assert.equal(f.run("celestialPower({id:2,hp:1,maxHp:1000}).multiplier"), (130 - .1)/60);
  assert.equal(f.run("celestialPower({id:1,hp:100,maxHp:100})"), null);
});

test("Celestial strikes bypass Defense, retain Armored penalties, and leave spells alone", () => {
  const f = fixture();
  const [light, heavy, armored, broken, ordinary, magicCelestial, magicOrdinary] = f.run(`(() => {
    const member = {id:0, hp:100, maxHp:100, mp:50, maxMp:50, battleAttributes:[42,20,35,16,22,20,8,17], gear:[{type:0,equipped:true,celestial:true,power:16,abilities:[]}]};
    const target = {battleId:20,id:Number(Object.keys(ffxData.enemies).find(k=>ffxData.enemies[k].armored && !battleModelData.monsters[k]?.immune && !battleModelData.monsters[k]?.physicalImmune)), hp:999,maxHp:999, battleAttributes:[20,220,20,20,10,1,0,0]};
    const attack = battleModelData.actions[0x3000], spell = Object.values(battleModelData.actions).find(a => a.name==="Flare");
    const roll = (a, u, t) => battleSingleDamage(a,u,t,16);
    const plain = {...target,battleId:0};
    const regular = {...member,gear:[{...member.gear[0],celestial:false}]};
    return [roll(attack,member,{...plain,battleAttributes:Array(8).fill(2)}), roll(attack,member,plain),
      roll(attack,member,target),roll(attack,member,{...target,statusBits:1<<6}),roll(attack,regular,plain),
      roll(spell,member,plain),roll(spell,regular,plain)];
  })()`);
  assert.equal(light,heavy);
  assert.equal(armored,Math.floor(heavy/3));
  assert.equal(broken,heavy);
  assert.ok(heavy > ordinary);
  assert.equal(magicCelestial,magicOrdinary);
});

test("Besaid's notebooks distinguish an unseen digit from zero and reject malformed backups", () => {
  const f = fixture();
  assert.deepEqual(f.run('cipherSlots([{digit:"0",unsure:true},{digit:"7"},{digit:0},{digit:"12"}])'),
    [{digit:"0",unsure:true},{digit:"7",unsure:false},{digit:"",unsure:false},{digit:"",unsure:false}]);
  assert.equal(f.run("new Set(mascotRegions.map(r=>r[0])).size"),15);
});
