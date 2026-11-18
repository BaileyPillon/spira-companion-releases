const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInContext, createContext } = require("node:vm");
const test = require("node:test");

const context = createContext({
  atob,
  localStorage: {getItem: () => null}, number: new Intl.NumberFormat("en-US"),
  roomName: ({room}) => String(room),
  itemAmounts: items => new Map(items),
  catalog: {x:{party:["Tidus","Yuna","Auron","Kimahri","Wakka","Lulu","Rikku"]}}
});
for (const file of ["ffx-data.js", "ffx.js", "ffx-progress.js", "ffx-arena.js", "ffx-hunt.js",
  "ffx-customization-data.js", "ffx-customization.js", "ffx-collections.js", "ffx-prep.js", "ffx-endgame.js", "ffx2-story-data.js", "ffx2-ap-data.js", "ffx2.js", "story.js"]) {
  runInContext(readFileSync(resolve(__dirname, "../app/assets", file), "utf8"), context);
}
const evaluate = code => JSON.parse(JSON.stringify(runInContext(code, context)));

test("endgame route checks the mirror and counts AP abilities on the same weapon", () => {
  const result = evaluate(`(() => {
    const frame = {disc:"SLPS-25088",grid:"01",progress:{keyItems:"08", optionalAeons:1},
      party:[{id:0,active:true,gear:[{type:0,abilities:[0x8013]}, {type:0,abilities:[0x8011]}]}]};
    const states = () => endgameRoute(frame).filter(step => step.done).map(step => step.key);
    const separate = states();
    frame.party[0].gear[0].abilities.push(0x8011);
    return [separate,states(),endgameRoute({...frame,disc:"SLUS-20672"})];
  })()`);
  assert.deepEqual(result, [["mirror","anima","triple-ap"],["mirror","anima","triple-ap","ap"],[]]);
});

test("FFX-2 cabin checks are independent for each chapter and keep the finale separate", () => {
  assert.deepEqual(evaluate(`[1,2,3,4,5].map(chapter => x2TasksForChapter(chapter)[0].key)`),
    ["1/rest","2/rest","3/rest","4/rest","5/cabin-scene"]);
  assert.deepEqual(evaluate("x2TasksForChapter(0)"), []);
});

test("FFX-2 counts individual story flags and groups them by chapter and location", () => {
  const flags = Buffer.alloc(0x2868);
  flags[25] = 0x84;
  flags[10250] = 2;
  context.encodedStory = flags.toString("base64");
  assert.deepEqual(evaluate(`(() => {
    const story = x2StoryProgress(encodedStory);
    return [story.credited, [...story.chapters[1].values()][0].done,
      [...story.chapters[5].values()].find(region => region.name === "Vegnagun").done,
      x2StoryProgress("AAAA"), new Set(x2StoryEvents.map(([,i,mask]) => i + ":" + mask)).size];
  })()`), [3, 2, 1, null, 525]);
});

test("CommSphere totals exclude the main Chapter 4 scenes", () => {
  const flags = Buffer.alloc(0x2868,255);
  context.allFlags = flags.toString("base64");
  assert.equal(evaluate("[...x2StoryProgress(allFlags).commspheres.values()].reduce((n,c) => n + c.done,0)"), 39);
  assert.equal(evaluate("[...x2StoryProgress(allFlags).chapters[4].values()].reduce((n,c) => n + c.done,0)"), 79);
});

test("FFX-2 AP counts stay independent per character and mark an ability learned at its threshold", () => {
  const ap = Buffer.alloc(0x6a0);
  ap.writeUInt16LE(19,0x66);
  context.partialAp = ap.toString("base64");
  ap.writeUInt16LE(20,0x66);
  context.fullAp = ap.toString("base64");
  assert.deepEqual(evaluate("x2AbilityProgress(partialAp,1)[0]"), {name:"Potshot",cost:20,ap:19,done:false});
  assert.deepEqual(evaluate("x2AbilityProgress(fullAp,1)[0]"), {name:"Potshot",cost:20,ap:20,done:true});
  assert.deepEqual(evaluate("x2AbilityProgress(fullAp,99)"), []);
});

test("airship search and password destinations have independent save flags", () => {
  assert.deepEqual(evaluate("airshipDiscoveryRows((1 << 0) | (1 << 5)).filter(row => row.discovered).map(row => row.code)"),
    ["X14, Y57","GODHAND"]);
});

test("stat targets use unactivated live nodes before buying more +4 spheres", () => {
  assert.deepEqual(evaluate(`gridStatPlan({grid:"050104001500"}, {nodes:[[],[],[]]},
    {id:0,attributes:[12,10,10,10,10,10,10,10]}, 0, 24)`),
  {currentStat:12,growth:3,activations:1,newNodes:3,sphere:8279,activationSphere:0x2046});
  assert.deepEqual(evaluate("gridStatSpheres.slice(-2).map(id => ffxData.items[id])"),
    ["Evasion Sphere","Accuracy Sphere"]);
});

test("item-first lookup preserves different acquisition methods", () => {
  const sources = evaluate(`itemSourceIndex().get("Healing Spring").filter(row => row.name === "Achelous" || row.name === "Kottos")`);
  assert.ok(sources.some(row => row.name === "Kottos" && row.method === "Drop" && row.count === 20));
  assert.ok(sources.some(row => row.name === "Achelous" && row.method === "Bribe" && row.gil === 127500));
});

test("Sphere Grid completion separates empty and locked nodes from activatable nodes", () => {
  const result = evaluate(`gridCompletion({nodes:[[],[],[],[],[],[]]}, {grid:"02010400010328010001ff00"}, 0)`);
  assert.deepEqual(result, {states:["active","inactive","empty","locked","locked","unknown"],
    counts:{active:1, inactive:1, empty:1, locked:2, unknown:1}});
});

test("Sphere Grid identifies activation spheres and keys by node type", () => {
  assert.deepEqual(evaluate("[1,2,10,18,22,35,36,39,40,43].map(gridActivationSphere)"),
    [null,0x2046,0x2047,0x2048,0x204a,0x2046,0x2047,0x2051,0x2052,0x2049]);
});

test("Optional Aeons, Dark Aeons, and encounter clears read independent save flags", () => {
  const result = evaluate(`(() => {
    const arena = '00'.repeat(576 + (344 >> 3)) + '01';
    const frame = {arena, progress:{optionalAeons:5, darkAeons:32}};
    return [ffxCollection(frame,'aeons'), ffxCollection(frame,'bosses')].map(rows => rows.filter(row => row.done).map(row => row.name));
  })()`);
  assert.deepEqual(result, [["Anima", "Magus Sisters"], ["Dark Yojimbo", "Penance"]]);
});

test("Anima identifies chest flags and distinguishes guarded returns from the mandatory Bevelle chest", () => {
  const result = evaluate(`(() => {
    const frame = {room:205, story:2500, progress:{trials:14}};
    return [animaTreasures(frame).map(({name,state}) => [name,state]),
      animaTreasures({...frame, story:2900, progress:{trials:63}}).filter(({done}) => done).length,
      animaTreasures({...frame, progress:{}})];
  })()`);
  assert.deepEqual(result, [[["Besaid","Dark Valefor guards the return"], ["Kilika","Chest opened"],
    ["Djose","Chest opened"], ["Macalania","Chest opened"], ["Bevelle","Required during the story"],
    ["Zanarkand Dome","Return after getting the airship"]], 6, []]);
});

test("International bribe odds use max HP and saturate at 25 times max HP", () => {
  assert.deepEqual(evaluate("[0,49000,49766,98000,147000,196000,244999,245000,300000].map(gil => bribeEstimate(gil, 9800, 2).odds)"),
    [0,0,100/256,25,50,75,25500/256,100,100]);
  assert.deepEqual(evaluate("bribeEstimate(180000,18000,60)"), {odds:25,min:24,max:37});
  assert.deepEqual(evaluate("bribeEstimate(450000,18000,60)"), {odds:100,min:48,max:73});
  assert.deepEqual(evaluate("bribeEstimate(2500000,18000,60)"), {odds:100,min:99,max:99});
});

test("Arena farm projections use the live shortage, rounded up for normal and Overkill drops", () => {
  assert.deepEqual(evaluate("arenaFarmNeeds(18,99,20)"), {missing:81, wins:5, overkills:3});
  assert.deepEqual(evaluate("arenaFarmNeeds(18,12,20)"), {missing:0, wins:0, overkills:0});
  const supported = evaluate(`(() => {
    const goals = new Set(arenaGoals({}).flatMap(([,rows]) => rows.map(({name}) => name)));
    return arenaFarms.every(([id,item,foe,quantity]) => {
      if (!goals.has(foe)) return false;
      if (id === "ap") return true;
      const matchesDrop = arenaEnemyIds.get(foe).some(enemyId =>
        ffxData.enemies[enemyId].drops.some(([name,count]) => name === item && count === quantity));
      return ffxData.items[id] === item && (foe === "Kottos" || matchesDrop);
    });
  })()`);
  assert.equal(supported, true);
});

test("live collection flags identify individual pickups and Celestial upgrades", () => {
  const collection = evaluate(`(() => {
    const current = {progress:{primers:1 << 21, bushido:1, jechtSpheres:1, ronsoRages:5, keyItems:""},
      party:[{id:0,gear:[{type:0,celestial:true,abilities:[0x8014,0x800e,null,null]}]}]};
    return [ffxCollection(current,"primers").filter(p => p.done).map(p => p.name),
      ffxCollection(current,"spheres").filter(p => p.done).map(p => p.name),
      ffxCollection(current,"rages").filter(p => p.done).map(p => p.name),
      ffxCollection(current,"celestials")[0].parts.map(([,state]) => state)];
  })()`);
  assert.deepEqual(collection, [["Primer XXII"], ["Macalania Woods · Spring","Besaid Village"],
    ["Jump","Seed Cannon"], ["Owned","Applied","Check location"]]);
});

test("customization requires a usable slot, excludes Celestials, and links the correct material", () => {
  const result = evaluate(`(() => {
    const gear = [{type:1,abilities:[null]}, {type:1,abilities:[0x8056,null]},
      {type:1,abilities:[]}, {type:1,celestial:true,abilities:[null]}];
    const recipes = customizationRecipes([[0x2037,79]], [{id:0,gear}]);
    const haste = recipes.find(recipe => recipe.ability === 0x8056);
    return [recipes.length, new Set(recipes.map(recipe => recipe.ability)).size,
      recipes.every(({ability,item}) => !!ffxData.abilities[ability] && !!ffxData.items[item]),
      haste.missing, haste.bases.length, ffxData.items[haste.item]];
  })()`);
  assert.deepEqual(result, [125,125,true,1,1,"Chocobo Wing"]);
});

test("battle opportunities clear after a Rage is learned or a target is defeated", () => {
  const result = evaluate(`(() => {
    const id = arenaEnemyIds.get("Great Malboro")[0];
    const current = {party:[{id:0,active:true,hp:1,gear:[{equipped:true,type:0,abilities:[0x807a]}]}],
      progress:{ronsoRages:0}, enemies:[{id,hp:100}], arena:"00".repeat(640)};
    const initial = battleOpportunities(current);
    return [initial.rages[0].name, initial.captures[0].count,
      battleOpportunities({...current, progress:{ronsoRages:1 << 9}}).rages.length,
      battleOpportunities({...current, enemies:[{id,hp:0}]}).captures.length];
  })()`);
  assert.deepEqual(result, ["Bad Breath",0,0,0]);
});

test("missables use live pickup bits and distinguish a closed pickup from a guarded return", () => {
  const states = evaluate(`(() => {
    const [primer, , , bevelle, wantz, besaid] = ffxMissables;
    const current = {game:"x", room:276, story:1980, progress:{primers:0,trials:0,keyItems:""}};
    return [
      missableState(current, primer),
      missableState({...current, story:2000}, primer),
      missableState({...current, progress:{primers:1 << 18}}, primer),
      missableState({...current, room:205, story:2080}, bevelle),
      missableState({...current, room:306, story:2100}, bevelle),
      missableState({...current, room:244, story:2530}, wantz),
      missableState({...current, room:17, story:2300, progress:{darkValefor:true}}, besaid),
      ffxExitGate({...current, room:69, story:2300}, 17),
      ffxExitGate({...current, room:69, story:2300, progress:{darkValefor:true}}, 17)
    ];
  })()`);
  assert.deepEqual(states, [
    "Check now", "Pickup window closed", "Collected", "Check now", "Pickup window closed",
    "Check now", "Guardian defeated · can revisit", "Dark Valefor guards this route", ""
  ]);
});

test("Evrae advises from the forecast and other guides respond to battle state", () => {
  const titles = evaluate(`(() => {
    const evrae = {id:119, battleId:20, hp:12002, statusTimed:1 << 11};
    const frame = {items:[[0x2006, 2]], party:[{id:6,active:true,hp:1716,maxHp:1716}],
      enemies:[evrae, {id:149,battleId:21}], turnOrder:[6,20,21]};
    return [
      ffxBossAdvice(frame, evrae)[0],
      ffxBossAdvice({...frame, turnOrder:[6,21,20]}, evrae)[0],
      ffxBossAdvice(frame, {id:120})[0],
      ffxBossAdvice({...frame,party:[{active:true,hp:1000,statusBits:2}]}, {id:142})[0]
    ];
  })()`);
  assert.deepEqual(titles, ["Evrae acts before Cid", "Cid moves before Evrae",
    "Use Phoenix Downs on Evrae Altana", "Cure Zombie before Full-Life"]);
});

test("Arena rules resolve every capture slot and distinguish a met goal from a defeated creation", () => {
  const summary = evaluate(`(() => {
    const bytes = new Uint8Array(640);
    for (const name of arenaRegions.Besaid) bytes[arenaEnemyIds.get(name)[0]] = 1;
    const frame = () => ({arena:Array.from(bytes, b => b.toString(16).padStart(2,"0")).join("")});
    const goals = arenaGoals(frame());
    const stratoavis = arenaEnemyIds.get("Stratoavis")[0];
    bytes[576 + (stratoavis >> 3)] = 1 << (stratoavis & 7);
    return [allArenaFiends.length, allArenaFiends.every(name => arenaEnemyIds.has(name)),
      goals.map(([,group]) => group.length), goals[0][1][0].ready,
      goals[0][1][1].ready, arenaDefeated(frame(), "Stratoavis")];
  })()`);
  assert.deepEqual(summary, [102, true, [13, 14, 8], true, false, true]);
});

test("Sphere Grid estimates movement and names the key spheres on a locked route", () => {
  const routes = evaluate(`(() => {
    const graph = {nodes:[[],[],[],[],[]],links:[[0,1],[1,2],[2,3],[3,4]]};
    const current = {grid:"01000100000001000100", gridLinks:"01010000"};
    return [gridPath(graph,current,0,0,4), gridPath(graph,current,0,0,4,true),
      gridPath(graph,{...current,grid:"0100".repeat(5),gridLinks:"01".repeat(4)},0,0,4)];
  })()`);
  assert.deepEqual(routes, [{path:[],cost:null,locks:[]},
    {path:[0,1,2,3,4],cost:4,locks:[3]}, {path:[0,1,2,3,4],cost:1,locks:[]}]);
});
