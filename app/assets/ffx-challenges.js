"use strict";

const lightningRooms = [140,162,332];
const ffxChallenges = [
  {id:"lightning", name:"Lightning Dodger", area:"Thunder Plains", rooms:[...lightningRooms,256,263,264], hero:5, sigil:"Lulu’s sigil"},
  {id:"chocobo", name:"Catcher Chocobo", area:"Calm Lands", rooms:[223,279], hero:0, sigil:"Tidus’s sigil"},
  {id:"butterflies", name:"Butterfly Catcher", area:"Macalania Woods", rooms:[241,242,329], hero:3, sigil:"Kimahri’s sigil"},
  {id:"cactuars", name:"Village of the Cactuars", area:"Bikanel", rooms:[129,136,137,138], hero:6, sigil:"Rikku’s sigil"}
];

const cactuarClues = [
  ["Tomay", "Look by the water at the Oasis."],
  ["Rovivea", "Enter Sanubia East from Central and check the path off to the west."],
  ["Chava", "Examine the second sign near the glyph in Sanubia West."],
  ["Alek and Aloja", "Look among the ruins northwest of the Save Sphere in Sanubia Central."],
  ["Vachella", "Examine the Save Sphere under the tent in Sanubia East and close its menu."],
  ["Robeya", "Open the chest in the southwest of Sanubia Central."],
  ["Isrra", "Look in the middle sand whirlpool in Sanubia West. Leave and re-enter the area if needed."],
  ["Elio", "Walk north of the Oasis pond, then approach it from the north to see Elio board the airship."],
  ["Flaile", "Return Elio’s sphere to the glyph. Flaile appears beside you."]
];

let challengeChoice = "";
let lightningRun = null;
let lightningInterrupted = false;
let catcherInputs = ["38", "1"];
const butterflyCourseStorage = "spira.butterfly-courses.v1";
let butterflyChests = 0;
try {
  butterflyChests = Number(localStorage.getItem(butterflyCourseStorage)) & 3;
} catch { /* Local storage is optional. */ }

function challengeHere(room) {
  return ffxChallenges.find(challenge => challenge.rooms.includes(room));
}

function challengeSigil(current, challenge) {
  const [,crest] = ffxCelestials[challenge.hero];
  const gear = current.party.find(member => member.id === challenge.hero)?.gear || [];
  const powered = gear.some(piece => piece.type === 0 && piece.celestial && piece.abilities.includes(0x8019));
  return powered ? "Applied" : ffxBit(current.progress.keyItems, crest + 1) ? "Claimed" : "Unclaimed";
}

function cactuarStep(stage) {
  if (stage === 25) return ["Elio", "Find Elio on the airship’s exterior deck."];
  if (stage === 17) return ["Flaile’s sphere", "Return to the glyph to remove the sandstorm."];
  if (stage === 18) return ["Village open", "Open the sigil chest in the valley below the glyph."];
  if (stage === 0) return ["Start the hunt", "After gaining free use of the airship, examine the glyph at the edge of Sanubia West’s sandstorm."];
  if (stage >= 1 && stage <= 16) {
    const index = Math.floor((stage - 1) / 2);
    return stage % 2 ? cactuarClues[index] : ["Return to the glyph", `Bring back the sphere from ${cactuarClues[index][0]} to continue.`];
  }
  return ["Check the glyph", "Read the stone in Sanubia West for your current clue."];
}

function catcherBalloonTarget(time, birds) {
  // A displayed time of exactly zero still misses the sigil.
  return Math.floor((time + 30 * birds) / 30) + 1;
}

function lightningRunAfter(run, current) {
  const stats = current?.progress?.challenges?.lightning;
  if (!run || !stats || current.battle || !lightningRooms.includes(current.room)) return null;
  if (current.room !== run.room || current.battles !== run.battles || stats.bolts < run.bolts ||
      stats.dodges < run.dodges || stats.best < run.best ||
      current.timestamp < run.timestamp || current.timestamp - run.timestamp > 3000) return null;
  const dodges = stats.dodges - run.dodges;
  const bolts = stats.bolts - run.bolts;
  if (bolts < dodges || (bolts > dodges && dodges > 0)) return null;
  return {...stats, timestamp:current.timestamp, room:current.room, battles:current.battles,
    count:bolts > dodges ? 0 : run.count + dodges};
}

function updateLightningTracking(current) {
  if (!lightningRun) return;
  lightningRun = lightningRunAfter(lightningRun, current);
  lightningInterrupted = !lightningRun;
}

function openChallenges(id = "") {
  challengeChoice = id;
  signature = "";
  choose("challenges");
}

function showChallenges(current) {
  heading("Challenges");
  const selected = ffxChallenges.find(challenge => challenge.id === challengeChoice) || challengeHere(current.room) || ffxChallenges[0];
  const controls = element("div", "filters challenge-selector");
  controls.append(options("Challenge", ffxChallenges.map(({id,name}) => [id,name]), selected.id, openChallenges));
  panel.append(controls);
  const sigil = challengeSigil(current, selected);
  panel.append(element("p", "detail challenge-location", `${selected.area} · ${selected.sigil} ${sigil.toLowerCase()}`));
  const data = current.progress.challenges;
  if (!data) return;
  if (selected.id === "lightning") showLightningChallenge(current, data.lightning, sigil);
  if (selected.id === "chocobo") showCatcherChallenge(data);
  if (selected.id === "butterflies") showButterflyChallenge(current, sigil);
  if (selected.id === "cactuars") showCactuarChallenge(data);
  if (selected.id !== "chocobo") showNoEncounters(current);
  panel.append(action("Celestial Weapons", () => choose("collections", "celestials")));
}

function showLightningChallenge(current, stats, sigil) {
  const summary = element("section", "sheet challenge-record");
  const inPlains = lightningRooms.includes(current.room) && !current.battle;
  const recorded = lightningRun?.count;
  const numberText = recorded == null ? `${stats.best} saved best streak` : `${recorded} / 200 estimated this run`;
  const progress = element("progress");
  progress.max = 200;
  progress.value = Math.min(200, recorded ?? stats.best);
  progress.setAttribute("aria-label", recorded == null ? "Best streak toward 200" : "Tracked run toward 200");
  const text = sigil === "Unclaimed" && stats.best >= 200 ? "200 recorded. Check the chest outside Rin’s Travel Agency." :
    `${stats.dodges} total dodges · ${Math.max(0,stats.bolts - stats.dodges)} hits · 200 in a row for the sigil`;
  summary.append(element("h2", "", numberText), progress, element("p", "", text));
  if (lightningInterrupted) summary.append(element("p", "field-note",
    "Run tracking stopped after a room change, battle, or uncertain game update."));
  if (recorded != null) summary.append(element("p", "field-note", `Saved best · ${stats.best}`));
  if (inPlains) {
    summary.append(action(recorded == null ? "Start tracking a fresh run" : "Restart tracking", () => {
      lightningRun = {...stats, room:current.room, timestamp:current.timestamp, battles:current.battles, count:0};
      lightningInterrupted = false;
      signature = "";
      render();
    }));
    summary.append(element("p", "field-note", "Start at zero in the game. Spira estimates this run from changes in the saved dodge and hit totals. After saving or reloading, restart tracking."));
  }
  panel.append(summary, element("h2", "", "Where to dodge"),
    element("p", "", "In the south, walk from a lightning tower toward the nearby crater and press the action button as the screen flashes. Loop back toward the tower and repeat. Pause in place if you need a break."));
}

function showCatcherChallenge(data) {
  const race=(frame||sample)?.catcher;
  if(race&&!reconnecting&&!(frame||sample)?.paused){
    const adjusted=(race.tenths-30*race.balloons+30*race.birds)/10;
    panel.append(entry(race.finished?"Race result":"Live Catcher Chocobo",`${(race.tenths/10).toFixed(1)} seconds · ${race.balloons} balloons · ${race.birds} bird hits`,
      `Adjusted time: ${adjusted.toFixed(1)} seconds. ${race.finished?(adjusted<0?"Sub-zero result — collect the reward from the trainer.":"A sub-zero result is needed for the sigil."):`At this race time, ${Math.max(0,catcherBalloonTarget(race.tenths,race.birds)-race.balloons)} more balloons would put the adjusted time below zero. The clock is still running.`}`));
  }
  const training = [[1,"Wobbly Chocobo"],[3,"Dodger Chocobo"],[4,"Hyper Dodger Chocobo"],[5,"Catcher Chocobo"]];
  const best = data.catcherBest;
  const time = best == null ? "No recorded Catcher time" :
    `${Math.floor(best / 600)}:${(best % 600 / 10).toFixed(1).padStart(4,"0")} saved best`;
  const record = element("section", "sheet challenge-record");
  record.append(element("h2", "", time), element("p", "", "The adjusted time must be below zero for Tidus’s sigil. The game displays sub-zero results as 0:00.0."));
  const courses = element("ul", "challenge-courses");
  for (const [bit,name] of training) {
    const cleared = !!(data.training & (1 << bit));
    courses.append(element("li", "", `${name} · ${cleared ? "Cleared" : "Remaining"}`));
  }
  record.append(courses);
  panel.append(record, element("h2", "", "Balloon target"));
  const calc = element("div", "filters challenge-calc");
  const inputs = [["Finish time (seconds)","0.1"],["Bird hits","1"]].map(([name,step], index) => {
    const label = element("label", "", name);
    const input = element("input");
    input.type = "number";
    input.min = "0";
    input.step = step;
    input.value = catcherInputs[index];
    label.append(input);
    calc.append(label);
    return input;
  });
  const result = element("p", "");
  result.setAttribute("role", "status");
  function updateTarget() {
    catcherInputs = inputs.map(input => input.value);
    const [time,birds] = inputs.map(input => input.valueAsNumber);
    result.textContent = Number.isFinite(time) && time > 0 && Number.isInteger(birds) && birds >= 0 ?
      `Aim for at least ${catcherBalloonTarget(Math.round(time * 10), birds)} balloons.` : "Enter a finish time and a whole number of bird hits.";
  }
  for (const input of inputs) input.addEventListener("input", updateTarget);
  updateTarget();
  panel.append(calc, result, element("p", "field-note", "Use the finish time before penalties and bonuses. Each balloon subtracts three seconds and each bird adds three. Time lost to the stun is already on the race clock."),
    element("h2", "", "Race plan"),
    element("p", "", "Use light D-pad taps. Pick up the balloons on your side of the opening stretch and try to reach the first turn ahead of the trainer. In the final stretch, avoid birds before chasing an extra balloon."));
}

function showButterflyChallenge(current, sigil) {
  if (typeof showButterflyRoute === "function") showButterflyRoute(current);
  const sheet = element("div", "sheet challenge-record");
  const courses = [
    [1,"Central",[241],"Find the multicolored starter by the path and follow the blue butterflies toward the far end. Avoid the red ones on the bends."],
    [2,"North",[242,329],"Turn back for the blue butterfly behind the start before running the rest of the course."]
  ];
  const count = element("p", "field-note");
  function refreshCount() {
    count.textContent = `${courses.filter(([bit]) => butterflyChests & bit).length} / 2 post-airship chests marked`;
  }
  refreshCount();
  for (const [bit,name,rooms,tip] of courses) {
    const row = entry(`${name} course`, rooms.includes(current.room) ? "Current area" : "", tip);
    if (sigil === "Unclaimed") {
      const label = element("label", "prep-choice");
      const check = element("input");
      check.type = "checkbox";
      check.checked = !!(butterflyChests & bit);
      check.addEventListener("change", () => {
        butterflyChests = check.checked ? butterflyChests | bit : butterflyChests & ~bit;
        try { localStorage.setItem(butterflyCourseStorage, String(butterflyChests)); } catch { /* Keep the session marks. */ }
        refreshCount();
      });
      label.append(check, element("span", "", `${name} chest opened`));
      row.append(label);
    }
    sheet.append(row);
  }
  if (sigil === "Unclaimed") {
    panel.append(count, sheet, element("p", "field-note",
      "After you gain free use of the airship, collect seven blue butterflies in each course and open its chest before leaving. Check off each chest here. Your marks are saved on this device."));
  } else {
    panel.append(sheet, element("p", "field-note", "Your save records Kimahri’s sigil from the two post-airship courses."));
  }
}

function showCactuarChallenge(data) {
  const [title, clue] = cactuarStep(data.cactuarStage);
  const sheet = element("div", "sheet challenge-record");
  sheet.append(entry(title, "Current step", clue));
  panel.append(sheet, element("p", "field-note", `${data.cactuarWins} successful rounds recorded. Return the sphere even if you lose a round to keep progressing toward the sigil.`));
  const route = element("details", "arena-pending");
  const list = element("ol");
  for (const [name, tip] of cactuarClues) list.append(element("li", "", `${name} · ${tip}`));
  route.append(element("summary", "", "All Cactuar locations"), list);
  panel.append(route);
}

function showNoEncounters(current) {
  const pieces = current.party.flatMap(member => (member.gear || []).filter(piece => piece.abilities.includes(0x801d))
    .map(piece => [member,piece]));
  const equipped = pieces.find(([member,piece]) => member.active && piece.equipped);
  const details = element("details", "arena-pending");
  details.append(element("summary", "", equipped ? "No Encounters equipped on your front line" :
    pieces.length ? "No Encounters gear in inventory" : "Find No Encounters gear"));
  for (const [member,piece] of pieces) {
    details.append(element("p", "", `${catalog.x.party[member.id]} · ${gearName(piece,member.id)}${piece.equipped ? " · equipped" : ""}`));
  }
  if (!pieces.length) {
    const stock = itemAmounts(current.items).get(0x203f) || 0;
    details.append(element("p", "", `Customize it onto armor with 30 Purifying Salts. You own ${stock}. Ghost can also drop the armor.`),
      action("Find Purifying Salt", () => choose("bestiary", "Purifying Salt")),
      action("Fafnir unlock requirements", () => openArenaCreation("Fafnir")));
  }
  panel.append(details);
}
