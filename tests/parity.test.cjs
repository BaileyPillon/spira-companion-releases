const {readFileSync} = require("node:fs");
const {runInContext,createContext} = require("node:vm");
const assert = require("node:assert/strict");
const test = require("node:test");

const context = createContext({
  localStorage:{getItem() { return null; }, setItem() {}},
  roomName({room}) { return "Area " + room; },
  partyName(current, actor) { return ["Yuna","Rikku","Paine"][actor.id]; }
});
for (const file of ["catalog","ffx-data","ffx","equip-compare","battle-tactics","ffx-field-guide-data",
  "ffx2-field-guide","ffx2-bestiary-data","fiend-journal","ffx2-grid-data","ffx2-grid-plan"]) {
  runInContext(readFileSync(`app/assets/${file}.js`, "utf8"), context);
}
const read = expression => JSON.parse(runInContext(`JSON.stringify(${expression})`, context));

test("gear comparison preserves equipped ties and reports gained and lost abilities", () => {
  const result = read(`(() => {
    const id = name => Number(Object.keys(ffxData.abilities).find(id => ffxData.abilities[id] === name));
    const worn = {type:0,equipped:true,abilities:[id("Piercing")]};
    const candidate = {type:0,abilities:[id("Capture")]};
    const member = {gear:[candidate,worn]};
    return [ffxGearChange(member,0,"capture"), ffxGearChange(member,0,"speed")];
  })()`);
  assert.deepEqual(result[0].gained, ["Capture"]);
  assert.deepEqual(result[0].lost, ["Piercing"]);
  assert.equal(result[1].best.equipped, true);
});

test("accessory optimizer reports deltas against the chosen slot and only uses spare stock", () => {
  const [change,keep] = read(`(() => {
    const stats = (hp,str) => ["","",[hp,0,str,0,0,0,0,0,0,0]];
    const loadout = {accessoryInfo:[stats(20,0),stats(0,25),stats(0,50),stats(0,99)],
      accessories:[[2,1],[3,0]]};
    const member = {accessories:[0,1]};
    return [x2AccessoryChange(loadout,member,0,"physical"), x2AccessoryChange(loadout,member,0,"survival")];
  })()`);
  assert.equal(change.best, 2);
  assert.deepEqual(change.delta.slice(0,3), [-20,0,50]);
  assert.equal(keep.best, 0);
});

test("recovery suggestions account for actual stock and treat Zombie before HP", () => {
  const result = read(`battleTactics({game:"x",items:[[8207,3],[8199,1],[8193,5]],party:[
    {id:0,active:true,maxHp:1200,hp:100,statusBits:2},
    {id:1,active:true,maxHp:1000,hp:0},
    {id:2,active:false,maxHp:1000,hp:20}
  ]})`);
  assert.deepEqual(result, [
    {name:"Remedy", stock:3, targets:[["Yuna","Zombie"]]},
    {name:"Mega Phoenix", stock:1, targets:[["Rikku","KO"]]}
  ]);
});

test("map exploration cells cannot leak across the bounds of the terrain", () => {
  assert.equal(read("fieldExplorationCell({bounds:[0,0,24,24],step:1},{x:24,y:24})"), 575);
  assert.equal(read("fieldExplorationCell({bounds:[0,0,24,24],step:1},{x:-1,y:4})"), -1);
});

test("FFX-2 encounter history deduplicates poll frames and keeps each disc separate", () => {
  const [entries, other] = read(`(() => {
    const frame = {game:"x2",disc:"SLUS-20672",room:311,chapter:1,battle:true,
      enemies:[{name:"Goon",id:216,hp:10,maxHp:52,maxMp:12,level:2}]};
    rememberX2Encounter(frame);
    rememberX2Encounter(frame);
    return [observedFiends.length, x2BestiaryEntries({disc:"SLPM-65478"}).some(row => row.title === "Goon")];
  })()`);
  assert.equal(entries, 1);
  assert.equal(other, false);
});

test("Garment Grids plan the shortest walk through required colors and respect empty slots", () => {
  const result = read(`(() => {
    const healing = x2GarmentTopology[35];
    const home = x2GridRoute(healing,0,7,new Set(),0);
    const blocked = x2GridRoute(healing,0,7,new Set([1]),0);
    const every = Object.values(x2GarmentTopology).every(graph => {
      const mask = graph[1].reduce((mask,edge) => mask | edge[2], 0);
      return graph[0].every((_,i) => x2GridRoute(graph,i,mask));
    });
    return {home,blocked,every,count:Object.keys(x2GarmentTopology).length};
  })()`);
  assert.equal(result.home.nodes.length, 4);
  assert.equal(result.home.nodes.at(-1), 0);
  assert.equal(result.home.mask, 7);
  assert.equal(result.blocked, null);
  assert.equal(result.every, true);
  assert.equal(result.count, 60);
});

test("Garment Grid uses live cursor, job placement, and character-specific battle progress", () => {
  const result = read(`(() => {
    const grid = x2NativeGrid([
      [0,0,0,[1,3],13], [1,0,1,[0,2],0], [2,0,0,[1,3],11], [1,1,0,[0,2],13]
    ]);
    const member = {gridSlot:3,dressphere:0x500d};
    const changed = x2GridPosition(grid, member, {job:0x500b}, true);
    const colored = x2GridCrossed(grid.rows, (1 << 1) | (1 << 2));
    const shortest = x2GridRoute(grid.topology, changed, 1, new Set(), 2, {gates:colored});
    const transform = x2GridRoute(grid.topology, changed, 0, new Set(), null, {visitAll:true, slots:3});
    return {
      field:x2GridPosition(grid, member, null, false),
      duplicate:x2GridPosition(grid, {...member,gridSlot:1}, {job:0x500d}, true),
      absent:x2GridPosition(grid, member, null, true),
      changed, colored, shortest:shortest.nodes, special:transform.nodes,
      empty:x2GridRoute(grid.topology, changed, 0, new Set([0]), null, {visitAll:true})
    };
  })()`);
  assert.deepEqual(result, {
    field:2, duplicate:-1, absent:-1, changed:1, colored:1,
    shortest:[1,2], special:[1,2], empty:null,
  });
});

test("FFX-2 follows the enemy's form only when HP and MP identify it", () => {
  const result = read(`(() => {
    const current = {disc:"SLUS-20672"};
    const target = {name:"Yellow Elemental",maxHp:48,maxMp:120,level:2};
    return {
      match:x2TargetReference(current,target),
      mismatch:x2TargetReference(current,{...target,maxHp:999}),
      otherDisc:x2TargetReference({disc:"SLPM-65478"},target),
      normal:x2BestiaryEntries(current).find(entry => entry.title === "Yellow Elemental").forms[0].values[4],
      entries:x2BestiaryEntries(current).filter(entry => entry.forms.length).length
    };
  })()`);
  assert.match(result.match, /^Oversoul.*Water weak.*Lightning absorbs/);
  assert.equal(result.mismatch, "");
  assert.equal(result.otherDisc, "");
  assert.deepEqual(result.normal[1], ["Phoenix Down",1]);
  assert.ok(result.entries > 230);
});
