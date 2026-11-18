const assert = require("node:assert/strict");
const test = require("node:test");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const {createContext, runInContext} = require("node:vm");

function node(tag, css = "", text = "") {
  return {
    tag, textContent:text, children:[], value:"", events:{}, attributes:{}, isConnected:true,
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(event, callback) { this.events[event] = callback; },
    classList:{add() {}, toggle() {}},
  };
}

function fixture() {
  const selections = [];
  const context = createContext({
    localStorage:{getItem:() => null, setItem() {}},
    window:{}, panel:node("main"), element:node, signature:"", render() {},
    itemAmounts:items => new Map(items), number:new Intl.NumberFormat("en-US"),
    entry:(title, detail = "", text = "") => node("entry", "", [title,detail,text].join(" · ")),
    action:(text, callback) => Object.assign(node("button", "", text), {click:callback}),
  });
  for (const file of ["catalog", "ffx-data", "ffx", "ffx-progress", "ffx-challenges", "equip-compare",
    "battle-model-data", "battle-model", "butterfly-route-data", "butterfly-coach", "ffx-blitzball", "blitz-live", "fiend-journal"])
    runInContext(readFileSync(join(__dirname, "../app/assets", file + ".js"), "utf8"), context, {filename:file});
  context.options = (label, values, selected, callback) => {
    const select = Object.assign(node("select"), {label, value:String(selected), change:callback});
    selections.push(select);
    return select;
  };
  return {
    context, selections,
    run:code => JSON.parse(runInContext(`JSON.stringify(${code})`, context)),
    exec:code => runInContext(code, context),
  };
}

test("AP optimizer prefers Triple AP and ignores superseded AP and Overdrive multipliers", () => {
  const f = fixture();
  const result = f.run(`(() => {
    const ids = names => names.map(name => Number(Object.keys(ffxData.abilities).find(id => ffxData.abilities[id] === name)));
    const score = names => ffxEquipScore(ids(names), "ap");
    return [score(["Double AP"]), score(["Triple AP"]), score(["Triple Overdrive"]),
      score(["Overdrive -> AP","Triple AP","Triple Overdrive"]),
      score(["Overdrive -> AP","Double AP","Triple AP","Double Overdrive","Triple Overdrive"])];
  })()`);
  assert.ok(result[1] > result[0]);
  assert.equal(result[2], 0);
  assert.equal(result[3], result[4]);
});

test("Capture optimizer reports no match when the character owns no Capture weapon", () => {
  const f = fixture();
  const result = f.run(`ffxGearChange({gear:[{type:0,equipped:true,abilities:[0x800b]}]},0,"capture")`);
  assert.equal(result.best, null);
  assert.equal(result.worn.equipped, true);
});

test("FFX-2 accessory optimizer can equip a spare duplicate in the second slot", () => {
  const f = fixture();
  const result = f.run(`x2AccessoryChange({accessoryInfo:[
    ["Old","",[0,0,1,0,0,0,0,0,0,0]], ["Power","",[0,0,25,0,0,0,0,0,0,0]]],
    accessories:[[1,1]]}, {accessories:[0,1]}, 0, "physical")`);
  assert.equal(result.best, 1);
  assert.equal(result.delta[2], 24);
});

test("FFX-2 accessory comparison retains its goal and open state on a fresh live render", () => {
  const f = fixture();
  f.exec(`loadout={accessoryInfo:[["Old","",Array(10).fill(0)]],accessories:[]};member={accessories:[0,0]};
    showX2EquipCompare(loadout,member);`);
  f.selections.find(select => select.label === "Optimize for").change("magic");
  const details = f.context.panel.children[0];
  details.open = true;
  details.events.toggle();
  f.context.panel.replaceChildren();
  f.selections.length = 0;
  f.exec("showX2EquipCompare(loadout,member)");
  assert.equal(f.selections.find(select => select.label === "Optimize for").value, "magic");
  assert.equal(f.context.panel.children[0].open, true);
});

test("No Encounters recognizes equipped gear on a reserve character", () => {
  const f = fixture();
  f.exec(`gearName=()=>"Peaceful Bangle";
    showNoEncounters({party:[{id:5,active:false,gear:[{equipped:true,abilities:[0x801d]}]}],items:[]});`);
  const summary = f.context.panel.children[0].children[0].textContent;
  assert.equal(summary, "No Encounters equipped");
});

function battleFixture() {
  const f = fixture();
  f.exec(`user={battleId:0,battleAttributes:Array(8).fill(20),mp:100,hp:100,maxHp:1000,maxMp:100,
    gear:[{type:0,equipped:true,power:16,abilities:[]}],boosts:Array(6).fill(0)};
    target={...user,battleId:1,gear:[]};
    statusEffects=(_,actor)=>actor.effects||"";`);
  return f;
}

test("elemental-strike weapon forecasts honor the target's Nul effect", () => {
  const f = battleFixture();
  const result = f.run(`(() => {
    const fire = Number(Object.keys(ffxData.abilities).find(id => ffxData.abilities[id] === "Firestrike"));
    user.gear[0].abilities=[fire];target.effects="NulBlaze";
    return compareBattleAction({items:[]},user,target,0x3000);
  })()`);
  assert.equal(result.min, null);
  assert.match(result.issues.join(" "), /Nul effect/);
});

test("a dual-element weapon needs both corresponding Nul effects to block its forecast", () => {
  const f = battleFixture();
  const result = f.run(`(() => {
    user.gear[0].abilities=["Firestrike","Waterstrike"].map(name=>Number(Object.keys(ffxData.abilities).find(id=>ffxData.abilities[id]===name)));
    target.effects="NulBlaze";const partial=compareBattleAction({items:[]},user,target,0x3000);
    target.effects="NulBlaze · NulTide";return [partial,compareBattleAction({items:[]},user,target,0x3000)];
  })()`);
  assert.ok(Number.isFinite(result[0].min));
  assert.equal(result[1].min, null);
});

test("battle forecasts reject commands that the acting character cannot perform", () => {
  const f = battleFixture();
  const result = f.run(`(() => {
    const check=(effects,id)=>{user.effects=effects;return compareBattleAction({items:[[8192,1]]},user,target,id);};
    return [check("Sleep",0x3000),check("Petrify",0x3000),check("Confuse",0x3000),
      check("Berserk",8192),check("Berserk",0x3000)];
  })()`);
  for (const row of result.slice(0,4)) {
    assert.equal(row.min, null);
    assert.match(row.issues.join(" "), /cannot act|Berserk/);
  }
  assert.ok(Number.isFinite(result[4].min));
});

test("Butterfly route guidance ends when the course ends or its catch count rewinds", () => {
  const f = fixture();
  const result = f.run(`(() => {
    const course={room:241},run={room:241,index:12,last:100,active:true,caught:4};
    const frame=butterfly=>({room:241,butterfly});
    return [butterflySyncRun(run,frame({active:false,caught:4}),course),
      butterflySyncRun(run,frame({active:true,caught:0}),course),
      butterflySyncRun(run,frame({active:true,caught:5}),course)];
  })()`);
  assert.deepEqual(result.slice(0,2), [null,null]);
  assert.equal(result[2].index, 12);
  assert.equal(result[2].caught, 5);
});

test("Blitzball break choices clear on feed loss, clock rewind and carrier replacement", () => {
  const f = fixture();
  const result = f.run(`(() => {
    const match={carrier:0,elapsed:100,period:300,score:[0,0],players:[{slot:0,id:0},{slot:8,id:10}]};
    const current={disc:"SLPS-25088",timestamp:1000,blitzMatch:match};
    const seed=()=>{blitzLiveContext=null;syncBlitzBreakSlots(current);blitzBreakSlots.add(8);};
    seed();syncBlitzBreakSlots({...current,timestamp:1100});const stable=blitzBreakSlots.size;
    syncBlitzBreakSlots({...current,blitzMatch:null});const lost=blitzBreakSlots.size;
    seed();syncBlitzBreakSlots({...current,timestamp:1100,blitzMatch:{...match,elapsed:0}});const rewind=blitzBreakSlots.size;
    seed();syncBlitzBreakSlots({...current,timestamp:1100,blitzMatch:{...match,players:[{slot:0,id:4},{slot:8,id:10}]}});
    return [stable,lost,rewind,blitzBreakSlots.size];
  })()`);
  assert.deepEqual(result, [1,0,0,0]);
});

test("Blitzball break choices clear on a long gap, pause, halftime or changed score", () => {
  const f = fixture();
  const result = f.run(`(() => {
    const match={carrier:0,elapsed:100,period:300,half:1,score:[1,0],players:[{slot:0,id:0},{slot:8,id:10}]};
    const current={disc:"SLPS-25088",timestamp:1000,blitzMatch:match};
    const checks=[{...current,timestamp:4000},{...current,paused:true},
      {...current,blitzMatch:{...match,half:2}},{...current,blitzMatch:{...match,score:[0,0]}},
      {...current,blitzMatch:{...match,score:[2,0]}}];
    return checks.map(next=>{blitzLiveContext=null;syncBlitzBreakSlots(current);blitzBreakSlots.add(8);
      syncBlitzBreakSlots(next);return blitzBreakSlots.size;});
  })()`);
  assert.deepEqual(result, [0,0,0,0,0]);
});

test("Bestiary resolves the viewed foe against the current battle instead of its old snapshot", () => {
  const f = fixture();
  const result = f.run(`(() => {
    x2BestiaryTarget={slot:2,id:216,name:"Goon",maxHp:52,maxMp:12,level:2};
    const current={game:"x2",battle:true,enemies:[{...x2BestiaryTarget,hp:30,maxHp:80,level:3}]};
    return [x2LiveBestiaryTarget(current),x2LiveBestiaryTarget({...current,battle:false}),
      x2LiveBestiaryTarget({...current,enemies:[{...current.enemies[0],id:999,name:"Other fiend"}]}),
      x2LiveBestiaryTarget({...current,enemies:[{...current.enemies[0],hp:0}]})];
  })()`);
  assert.equal(result[0].maxHp, 80);
  assert.equal(result[0].level, 3);
  assert.deepEqual(result.slice(1), [null,null,null]);
});
