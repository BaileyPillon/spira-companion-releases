"use strict";

const x2CampaignGoals = [
  ["Open Air","openAir",400,"openAirCredits"],
  ["Argent","argent",400,"argentCredits"],
  ["Matrimony","matrimony",70]
];

let x2Challenge = "sphere-break";
let x2CampaignChapter = 0;
let x2CampaignLocation = "";
let x2CampaignKind = "both";
let x2RanchWatch = null;

function x2CampaignRegion(current) {
  const place = roomName(current);
  if (/^(Luca|Stadium)\b/i.test(place)) return "Luca";
  return Object.keys(x2CampaignContacts).find(area => place.startsWith(area)) || "";
}

function x2CampaignAnswers(chapter, area, kind) {
  const locations = area ? [[area, x2CampaignContacts[area] || []]] : Object.entries(x2CampaignContacts);
  return locations.map(([place, rows]) => [place, rows.filter(([chapters,,,marriage]) =>
    chapters.includes(String(chapter)) && (kind !== "matrimony" || marriage))])
    .filter(([, rows]) => rows.length);
}

function x2RanchProgress(dispatches) {
  const levels = dispatches.map((count, index) => ({level:index + 1, count, need:Math.max(0, 3 - count)}));
  return {levels, remaining:levels.reduce((total, row) => total + row.need, 0)};
}

function updateX2RanchWatch(current) {
  if (!x2RanchWatch || !current) return;
  if (current.game !== "x2" || current.disc !== x2RanchWatch.disc ||
      current.chapter !== x2RanchWatch.chapter || current.battles < x2RanchWatch.last ||
      current.calmLands?.dispatches.join(",") !== x2RanchWatch.returns) {
    x2RanchWatch = null;
  } else {
    x2RanchWatch.last = current.battles;
  }
}

function openX2Challenge(name, current) {
  x2Challenge = name;
  if (name === "publicity") {
    x2CampaignChapter = 0;
    x2CampaignLocation = x2CampaignRegion(current);
  }
  choose("challenges");
}

function showX2Challenges(current) {
  if (!current.calmLands) {
    showX2SphereBreak();
    return;
  }
  if (x2Challenge === "publicity") showX2Campaigns(current);
  else if (x2Challenge === "ranch") showX2Ranch(current);
  else if (x2Challenge === "experiment" && current.experiment) showX2Experiment(current);
  else if (x2Challenge === "towers" && current.towers) showX2Towers(current);
  else showX2SphereBreak();
  const picker = element("div", "filters x2-challenge-picker");
  picker.setAttribute("role", "group");
  picker.setAttribute("aria-label", "FFX-2 challenges");
  const views = [["sphere-break","Sphere Break"],["publicity","Publicity & Matrimony"],["ranch","Chocobo Ranch"]];
  if (current.experiment) views.push(["experiment","The Experiment"]);
  if (current.towers) views.push(["towers","Tower Calibration"]);
  for (const [id, title] of views) {
    const button = action(title, () => {
      if (x2Challenge === id) return;
      x2Challenge = id;
      signature = "";
      render();
      panel.querySelector(".x2-challenge-picker [aria-pressed='true']")?.focus({preventScroll:true});
    });
    button.setAttribute("aria-pressed", String(x2Challenge === id));
    picker.append(button);
  }
  panel.prepend(picker);
}

function showX2Campaigns(current) {
  heading("Publicity & Matrimony", "Calm Lands");
  const scoreboard = element("div", "sheet x2-campaign-score");
  for (const [name,key,goal,credit] of x2CampaignGoals) {
    const score = current.calmLands[key];
    const left = Math.max(0, goal - score);
    const row = entry(name, left === 0 ? "Threshold met" : `${left} point${left === 1 ? "" : "s"} left`);
    row.classList.add("x2-quest-stat");
    const measure = element("div", "x2-quest-measure");
    const meter = element("progress");
    meter.max = goal;
    meter.value = score;
    meter.setAttribute("aria-label", name + " progress");
    measure.append(element("strong", "", `${score.toLocaleString()} / ${goal}`), meter);
    row.append(measure);
    if (credit) row.append(element("p", "field-note", `${current.calmLands[credit].toLocaleString()} game credits`));
    scoreboard.append(row);
  }
  const best = Math.max(current.calmLands.openAir, current.calmLands.argent);
  const guide = best >= 400 && current.chapter === 5 ?
    "The publicity target is met. Visit the Calm Lands for the Chapter 5 scene." :
    "Reach 400 publicity points with one company for Episode Complete. Matrimony’s 70-point goal is for the Speed Bracer.";
  panel.append(scoreboard, element("p", "field-note x2-quest-note", guide));

  const controls = element("div", "filters");
  const results = element("div", "x2-campaign-results");
  controls.append(
    options("Campaign chapter", [[0,"Follow current chapter"], ...[1,2,3,4,5].map(id => [id,`Chapter ${id}`])],
      x2CampaignChapter, value => { x2CampaignChapter = Number(value); draw(); }),
    options("Campaign area", [["","All areas"], ...Object.keys(x2CampaignContacts).map(area => [area,area])],
      x2CampaignLocation, value => { x2CampaignLocation = value; draw(); }),
    options("Campaign answers", [["both","Both campaigns"],["publicity","Publicity"],["matrimony","Matrimony"]],
      x2CampaignKind, value => { x2CampaignKind = value; draw(); })
  );
  const basics = element("details", "grid-attributes");
  basics.append(element("summary", "", "How to join and earn points"), entry("Calm Lands Travel Agency", "",
    "Sign up with Open Air or Argent near the agency. Speak to the man by the save point about matrimony. Press □ near an eligible NPC and select the numbered reply for the chosen campaign. You can also earn publicity by spending credits on your company’s minigames."));
  panel.append(element("h2", "", "NPC answers"), controls, results, basics);
  draw();

  function draw() {
    const chapter = x2CampaignChapter || current.chapter || 1;
    const groups = x2CampaignAnswers(chapter, x2CampaignLocation, x2CampaignKind);
    results.replaceChildren();
    for (const [location, rows] of groups) {
      const place = element("details", "grid-attributes");
      place.open = !!x2CampaignLocation;
      const sheet = element("div", "sheet guide-list");
      for (const [,name,pr,marriage,timing] of rows) {
        const answers = [x2CampaignKind !== "matrimony" && "Publicity " + pr,
          x2CampaignKind !== "publicity" && marriage && "Matrimony " + marriage].filter(Boolean);
        const note = timing?.startsWith(`Chapter ${chapter}`) ? timing.split(" · ")[1] : "";
        sheet.append(entry(name, answers.join(" · "), note));
      }
      place.append(element("summary", "", `${location} · ${rows.length}`), sheet);
      results.append(place);
    }
    if (!groups.length) results.append(element("p", "empty", `No listed contacts for that selection in Chapter ${chapter}.`));
  }
}

function showX2Ranch(current) {
  heading("Chocobo Ranch", "Ruin Depths");
  const {levels, remaining} = x2RanchProgress(current.calmLands.dispatches);
  const sheet = element("div", "sheet quest-steps");
  const lead = remaining ? `${remaining} successful returns still needed` :
    current.chapter === 5 ? "Return quotas met" : "Return quotas met for Chapter 5";
  const guidance = remaining ? "Log three successful dispatches at each level. Keep runners at that level until its row is complete." :
    "Set four level 5 Choco-Runners, then leave and re-enter the ranch in Chapter 5 to trigger the opening scene.";
  sheet.append(entry(lead, "", guidance));
  for (const row of levels) {
    const entryRow = entry("Level " + row.level, row.need ? `${row.need} to go` : "Complete");
    entryRow.classList.add("x2-quest-stat", "x2-ranch-level");
    entryRow.classList.toggle("completed", row.need === 0);
    const meter = element("progress");
    meter.max = 3;
    meter.value = row.count;
    meter.setAttribute("aria-label", `Level ${row.level} successful returns`);
    const measure = element("div", "x2-quest-measure");
    measure.append(element("strong", "", `${Math.min(row.count, 3)} / 3`), meter);
    entryRow.append(measure);
    sheet.append(entryRow);
  }
  panel.append(sheet);

  const counter = element("div", "sheet x2-ranch-counter");
  panel.append(counter);
  drawCounter();
  const route = element("details", "grid-attributes");
  route.append(element("summary", "", "Unlock and dispatch guide"),
    entry("Open the ranch", "", "Invite Clasko aboard, then follow him to the old Arena in the Calm Lands and finish Clean Sweep."),
    entry("Prepare your runners", "", "Catch and keep Chocobos that can reach level 5 for the final lineup. Restore their Heart before sending them out. You can use other birds for the return quotas."),
    entry("Count successful trips", "", "Send Choco-Runners to the Calm Lands for a reliable route. Fight seven battles, then speak to Clasko to check their returns. A runner that flees doesn’t count."),
    entry("Open Ruin Depths", "", "Once every level is complete, set four level 5 runners and re-enter the ranch in Chapter 5. Finish the dungeon to earn the Higher Power Garment Grid."));
  panel.append(route);

  function drawCounter() {
    const battles = x2RanchWatch ? current.battles - x2RanchWatch.start : null;
    const row = entry(battles == null ? "Dispatch battle count" : `${Math.min(7, battles)} / 7 battles since dispatch`,
      battles >= 7 ? "Return to Clasko" : "", battles == null ? "Start after sending your runners out." : "");
    row.append(action(battles == null ? "Start battle count" : "Clear battle count", () => {
      x2RanchWatch = x2RanchWatch ? null :
        {start:current.battles, last:current.battles, chapter:current.chapter, disc:current.disc,
          returns:current.calmLands.dispatches.join(",")};
      drawCounter();
      counter.querySelector("button")?.focus({preventScroll:true});
    }));
    counter.replaceChildren(row);
  }
}
