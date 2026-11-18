const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const {createContext, runInContext} = require("node:vm");
const test = require("node:test");

const code = readFileSync(join(__dirname, "../app/assets/ffx-guide.js"), "utf8");
function fixture() {
  const context = createContext({
    document:{querySelector:() => ({hidden:false, firstChild:{}})},
    window:{addEventListener() {}},
    roomName:({room}) => "Room " + room
  });
  runInContext(code, context);
  return (script) => runInContext(script, context);
}

test("reused rooms use story context and puzzle anchors", () => {
  const run = fixture();
  const destination = (room, story) => run(`guideDestination({game:"x",disc:"SLPS-25088",room:${room},story:${story}})`);
  assert.equal(destination(205,2080), "page-022--bevelle-tower-of-light");
  assert.equal(destination(180,2110), "page-022--bevelle-priests-passage");
  assert.equal(destination(306,2110), "page-044");
  assert.equal(destination(277,2040), "page-021--Evrae");
  assert.equal(destination(194,2950), "page-029--airship-bridge");
  assert.equal(destination(194,2410), "");
  assert.equal(destination(212,950), "");
  assert.equal(run('guideDestination({game:"x2",disc:"SLUS-20672",room:205,story:2080})'), "");
});

function suggestionFixture() {
  const opened = [];
  const context = createContext({
    choose: (...args) => opened.push(args),
    openBlitzRewards: () => opened.push(["rewards"]),
    openBlitzView: (...args) => opened.push(args),
    openArenaCreation: name => opened.push([name]),
    blitzWatchOpportunity: () => null,
    blitzballProgress: frame => frame.prizes || [],
    battleOpportunities: frame => frame.opportunities,
    trackedFiends: {},
    arenaTarget: 10,
    arenaCaptureCount: (frame, foe) => frame.captured[foe],
    arenaRegions: {Besaid: ["Dingo", "Condor", "Water Flan"]},
    areaCreations: ["Stratoavis"]
  });
  for (const file of ["ffx-progress.js","guide-suggestions.js"]) {
    runInContext(readFileSync(join(__dirname, "../app/assets",file), "utf8"), context);
  }
  runInContext(`const testFrame = {disc:"SLPS-25088",story:1990,progress:{primers:0}};
    const blitzPlayers = [...Array(51)].fill("Other");
    blitzPlayers[50] = "Jumal";
    const blitzRecruits = [["Jumal", "Goalkeeper", "Luca", "By the bench", [104]]];`, context);
  const run = script => runInContext(script, context);
  const at = (room, extra = "") => run(`guideSuggestionsFor({...testFrame,room:${room}${extra}})`);
  return {at, run, opened};
}

test("Blitzball suggestions distinguish matches, prize menus, contracts, and an available nearby recruit", () => {
  const {at, opened} = suggestionFixture();
  assert.equal(at(55).length, 0);
  assert.equal(at(62)[0].key, "blitzball-match");
  at(62)[0].open();
  at(347, ', prizes:[{name:"Attack Reels", event:"Tournament", listed:true}]')[0].open();
  assert.match(at(347, ', progress:{blitzball:{players:Array(51).fill([-1,1,0]).map((p,i) => i === 50 ? [5,1,1] : p)}}')[0].text, /Jumal has one match left/);
  const scout = at(104, ', progress:{blitzball:{players:Array(51).fill([-1,1,0])}}')[0];
  assert.equal(scout.key, "scout-Jumal");
  scout.open();
  assert.equal(at(104, ', progress:{blitzball:{players:Array(51).fill([2,1,3])}}').length, 0);
  assert.equal(at(347, ', disc:"SLUS-20672"').length, 0);
  assert.deepEqual(opened, [["roster","",true], ["rewards"], ["scout","Jumal"]]);
});

test("pickups distinguish near the chest, approaching it, and a last chance before leaving Home", () => {
  const {at, opened} = suggestionFixture();
  assert.equal(at(275)[0].key, "missable-Al Bhed Primer XX");
  assert.equal(at(286)[0].key, "missable-Al Bhed Primer XX");
  assert.equal(at(280)[0].key, "missable-Al Bhed Primer XXI");
  assert.equal(at(219).length, 0);
  assert.match(at(303, ", progress:{primers:0x180000}")[0].text, /Last chance.*Primer XIX/);
  assert.match(at(303)[0].text, /3 Al Bhed Primers/);
  at(303, ", progress:{primers:0x180000}")[0].open();
  assert.deepEqual(opened, [["missables","Al Bhed Primer XIX"]]);
  assert.equal(at(303, ", progress:{primers:0x1c0000}").length, 0);
  assert.equal(at(303, ", progress:{}").length, 0);
  assert.equal(at(303, ", story:2000").length, 0);
  assert.equal(at(318).some(({text}) => text.includes("Sun Crest")), false);
  assert.equal(at(197, ', progress:{keyItems:"zzzzzzzzzz"}').length, 0);
  const [ahead] = at(205, ", story:2080");
  const [atPickup] = at(180, ", story:2110");
  assert.match(ahead.text, /Ahead/);
  assert.ok(atPickup.priority > ahead.priority);
  assert.notEqual(ahead.key, atPickup.key);
});

test("a final first capture deep-links to its creation and outranks another needed capture", () => {
  const {at, opened} = suggestionFixture();
  const frame = `, battle:true, grid:true, arena:"01", party:[],
    opportunities:{rages:[],captures:[{name:"Condor",region:"Besaid",count:1},{name:"Dingo",region:"Besaid",count:0}]},
    captured:{Condor:1,"Water Flan":1}`;
  const [hint] = at(17, frame);
  assert.match(hint.text, /Dingo.*Stratoavis/);
  hint.open();
  assert.deepEqual(opened, [["Stratoavis"]]);
  assert.equal(at(17, frame.replace('"Water Flan":1', '"Water Flan":0'))[0].key, "capture-Dingo");
});

test("suggestions wait for stable activity and yield to reading except for a pickup deadline", () => {
  const {run} = suggestionFixture();
  run(`const tips = createGuideSuggestions();
    const map = {key:"map",priority:guidePriority.extra,wait:8000};
    const activity = {key:"activity",priority:guidePriority.activity,wait:900};
    const prize = {key:"prize",priority:guidePriority.timely,wait:900};
    const primer = {key:"primer",priority:guidePriority.deadline,wait:900};`);
  assert.equal(run("tips.update([map],1000,false)"), null);
  assert.equal(run("tips.update([map],9000,true)"), null);
  assert.equal(run("tips.update([map],9100,false).key"), "map");
  assert.equal(run("tips.update([map,activity],9200,false).key"), "map");
  assert.equal(run("tips.update([map,activity],10100,false).key"), "activity");
  assert.equal(run("tips.update([activity,prize],10200,true).key"), "activity");
  assert.equal(run("tips.update([activity,prize],11200,true).key"), "activity");
  assert.equal(run("tips.update([activity,prize,primer],11300,true).key"), "activity");
  assert.equal(run("tips.update([activity,prize,primer],12300,true).key"), "primer");
  run("tips.dismiss()");
  assert.equal(run("tips.update([activity,prize,primer],12400,true)"), null);
  assert.equal(run("tips.update([activity,prize,primer],13000,false).key"), "prize");
  assert.equal(run("tips.update([activity,prize,primer],38000,false)"), null);
  assert.equal(run("tips.update([activity,prize,primer],450000,false)"), null);
});

test("leaving clears expired context and a dismissed hint does not block other opportunities", () => {
  const {run} = suggestionFixture();
  run(`const tips = createGuideSuggestions();
    const menu = {key:"menu",priority:guidePriority.timely,wait:900};
    const pool = {...menu,key:"pool"};
    const pickup = {key:"pickup",priority:guidePriority.deadline,wait:900};`);
  assert.equal(run("tips.update([menu],1000,false)"), null);
  assert.equal(run("tips.update([menu],2000,false).key"), "menu");
  run("tips.dismiss()");
  assert.equal(run("tips.update([menu],2100,false)"), null);
  assert.equal(run("tips.update([pool],2300,false)"), null);
  assert.equal(run("tips.update([pool],3300,false).key"), "pool");
  assert.equal(run("tips.update([pickup],3400,false)"), null);
  assert.equal(run("tips.update([pickup],4400,false).key"), "pickup");
  run("tips.clear()");
  assert.equal(run("tips.update([menu],7000,false)"), null);
  assert.equal(run("tips.update([menu],8000,false)"), null);
  assert.equal(run("tips.update([menu],250000,false).key"), "menu");
});

test("follow debounces a destination, stays put in battles, and pauses during a feed gap", () => {
  const run = fixture();
  run(`const sent = [];
    const updateTest = (room,timestamp, feed="live", battle=false) =>
      updateGuide(true,{game:"x",disc:"SLPS-25088",room,story:2080,timestamp,battle},feed);
    guideFrame = {contentWindow:{postMessage:m => sent.push(m.anchor)}};
    guideReady = true;`);
  run("updateTest(205,0); updateTest(208,900)");
  assert.equal(run("sent.join()"), "page-022--bevelle-tower-of-light");
  run("updateTest(180,1050); updateTest(205,1700); updateTest(205,2600)");
  assert.equal(run("sent.length"), 1);
  run("guideBusy = true; updateTest(180,2700); updateTest(181,3700)");
  assert.equal(run("sent.length"), 1);
  run('guideBusy = false; updateTest(181,3700,"reconnecting")');
  assert.equal(run("sent.length"), 1);
  run("updateTest(181,4100); updateTest(181,5100); updateTest(205,6100,'live',true); updateTest(205,7100,'live',true)");
  assert.equal(run("sent.join()"),
    "page-022--bevelle-tower-of-light,page-022--bevelle-priests-passage");
  run("guideFollowing = false; updateTest(306,7200); updateTest(306,8200)");
  assert.equal(run("sent.length"), 2);
  run("guideFollowing = true; guideLastSent = null; syncGuide()");
  assert.equal(run("sent[2]"), "page-044");
});
