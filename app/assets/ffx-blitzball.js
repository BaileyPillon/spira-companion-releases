"use strict";

// Prize IDs are the FFX International save values. The English name of
// Wakka’s sigil varies by release, so use its owner rather than its planet.
const blitzRewards = [
  {name:"Attack Reels", event:"Tournament", prize:0xbb, bit:1, battles:0},
  {name:"Status Reels", event:"League", prize:0xbc, bit:2, battles:250},
  {name:"Aurochs Reels", event:"Tournament", prize:0xbd, bit:4, battles:450},
  {name:"Wakka’s Sigil", event:"League", prize:24, battles:0}
];
const blitzRecruits = [
  ["Wedge", "Forward", "Luca · Stadium main gate", "Strong shot at low levels. Recruit him beside Biggs.", [123]],
  ["Zev Ronso", "Midfield", "Luca · Dock 5", "An early midfielder with good passing and endurance.", [89]],
  ["Zalitz", "Defense", "Luca · Sphere Theater entrance", "High starting attack makes him a good early defender.", [157,158,170,184]],
  ["Jumal", "Goalkeeper", "Luca · Square", "A strong starting keeper. Look for him on the bench.", [104]],
  ["Ropp", "Defense", "Mi’ihen Highroad · Travel Agency", "Good tackling and passing. Scout him at the counter.", [58,112,171,334,381]],
  ["Kyou", "Defense", "Djose · Pilgrimage Road", "An early defender who can also cover goal. Look by the temple bridge.", [76,82]],
  ["Miyu", "Goalkeeper", "Moonflow · North Wharf", "A good early alternative to Jumal. Look for her on the bench.", [109,189,190,236]],
  ["Brother", "Midfield", "Airship · Bridge", "Once you have free use of the airship, his speed lets you draw defenders away before passing.", [194,255,261,374]],
  ["Nimrook", "Goalkeeper", "Airship · Corridor", "The Al Bhed Psyches’ keeper. Scout him when his contract runs out to see if he becomes a free agent.", [265,351]]
];

// Player IDs and team slot order are documented by Farplane and match the PS2 data.
const blitzPlayers = ["Tidus","Wakka","Datto","Letty","Jassu","Botta","Keepa","Bickson","Abus","Graav","Doram","Balgerda","Raudy",
  "Larbeight","Isken","Vuroja","Kulukan","Deim","Nizarut","Eigaar","Blappa","Berrik","Judda","Lakkam","Nimrook",
  "Basik Ronso","Argai Ronso","Gazna Ronso","Nuvy Ronso","Irga Ronso","Zamzi Ronso","Giera Guado","Zazi Guado","Nav Guado",
  "Auda Guado","Pah Guado","Noy Guado","Rin","Tatts","Kyou","Shuu","Nedus","Biggs","Wedge","Ropp","Linna","Mep","Zalitz",
  "Naida","Durren","Jumal","Svanda","Vilucha","Shaami","Zev Ronso","Yuma Guado","Kiyuri","Brother","Mifurey","Miyu"];
const blitzTeams = ["Luca Goers","Kilika Beasts","Al Bhed Psyches","Ronso Fangs","Guado Glories","Besaid Aurochs"];
const blitzTechniqueNames = [
  "Jecht Shot","Jecht Shot 2","Sphere Shot","Invisible Shot","Venom Shot","Venom Shot 2","Venom Shot 3",
  "Nap Shot","Nap Shot 2","Nap Shot 3","Wither Shot","Wither Shot 2","Wither Shot 3",
  "Venom Pass","Venom Pass 2","Venom Pass 3","Nap Pass","Nap Pass 2","Nap Pass 3","Wither Pass","Wither Pass 2",
  "Wither Pass 3","Volley Shot","Volley Shot 2","Volley Shot 3","Venom Tackle","Venom Tackle 2","Venom Tackle 3",
  "Nap Tackle","Nap Tackle 2","Nap Tackle 3","Wither Tackle","Wither Tackle 2","Wither Tackle 3","Drain Tackle",
  "Drain Tackle 2","Drain Tackle 3","Tackle Slip","Tackle Slip 2","Anti-Venom","Anti-Venom 2","Anti-Nap",
  "Anti-Nap 2","Anti-Wither","Anti-Wither 2","Anti-Drain","Anti-Drain 2","Spin Ball","Grip Gloves","Elite Defense",
  "Brawler","Pile Venom","Pile Wither","Regen","Good Morning!","Hi-Risk","Golden Arm","Gamble","Super Goalie","Aurochs Spirit"
];
let blitzTechniquePlayer = 0;
let blitzTechniqueFilter = "targets";

function knowsBlitzTechnique(data, technique) {
  return !!(data?.[technique <= 30 ? 0 : 1] & (1 << (technique <= 30 ? technique : technique - 30)));
}

function blitzTechniqueRows(blitz, player) {
  const selected = blitz?.techniques?.[player];
  if (!selected) return [];
  return blitzTechniqueNames.map((name,index) => {
    const id = index + 1;
    const rivals = blitz.players.flatMap(([team,level], candidate) =>
      team >= 0 && team < 5 && blitz.techniques[candidate]?.[2]?.includes(id) ? [{candidate,level}] : []);
    return {name, known:knowsBlitzTechnique(selected,id), equipped:selected[2].includes(id), rivals};
  });
}

function showBlitzTechniques(blitz) {
  if (!blitz?.techniques?.length) {
    panel.append(entry("Waiting for Blitzball roster", "", "Initialize Blitzball from a save sphere to see techniques."));
    return;
  }
  const roster = blitz.players.flatMap(([team], id) => team === 5 ? [[id,blitzPlayers[id]]] : []);
  if (!roster.length) return;
  if (!roster.some(([id]) => id === blitzTechniquePlayer)) blitzTechniquePlayer = roster[0][0];
  const controls = element("div", "filters");
  const sheet = element("div", "sheet guide-list");
  controls.append(options("Technique learner", roster, blitzTechniquePlayer, value => { blitzTechniquePlayer = Number(value); draw(); }),
    options("Technique filter", [["targets","Opponent targets"],["learned","Learned"],["all","All techniques"]], blitzTechniqueFilter,
      value => { blitzTechniqueFilter = value; draw(); }));
  panel.append(element("p", "field-note",
    "Before kickoff, mark a rival who has the move equipped. Press confirm when Techcopy flashes. The game still decides which moves your player can copy."),
    controls, sheet);
  function draw() {
    sheet.replaceChildren();
    const rows = blitzTechniqueRows(blitz, blitzTechniquePlayer);
    const level = blitz.players[blitzTechniquePlayer][1];
    for (const row of rows) {
      if (blitzTechniqueFilter === "learned" && !row.known) continue;
      if (blitzTechniqueFilter === "targets" && (row.known || !row.rivals.length || ["Jecht Shot","Jecht Shot 2","Aurochs Spirit"].includes(row.name))) continue;
      const sources = row.rivals.map(({candidate,level:rivalLevel}) =>
        `${blitzPlayers[candidate]} · Lv. ${rivalLevel}${rivalLevel > level ? " (higher level)" : ""}`);
      sheet.append(entry(row.name, row.equipped ? "Equipped" : row.known ? "Learned" :
        sources.length ? "Equipped by an opponent" : "No equipped rival found", sources.join(" / ")));
    }
    if (!sheet.childElementCount) sheet.append(entry("No techniques match this filter"));
  }
  draw();
}

function blitzContract(player) {
  if (!player || player[0] === -1) return "Free agent";
  const [team, , games] = player;
  return `${blitzTeams[team]} · ${games === 255 ? "Permanent" : games === 0 ? "Contract expired" :
    `${games} ${games === 1 ? "game" : "games"} left`}`;
}

function blitzballProgress(current) {
  const data = current.progress?.blitzball;
  if (!data) return null;
  const weapon = current.party.find(member => member.id === 4)?.gear?.find(piece => piece.celestial && piece.type === 0);
  const sigil = ffxBit(current.progress.keyItems, 45) || !!weapon?.abilities.includes(0x8019);
  return blitzRewards.map(reward => {
    const earned = reward.bit ? !!(data.reels & reward.bit) : sigil;
    const prizes = reward.event === "League" ? data.league : data.tournament;
    const listed = !earned && prizes?.[0] === reward.prize;
    return {...reward, earned, listed};
  });
}

let blitzRole = "";
let blitzRoster = "5";
let blitzView = "rewards";
let blitzSearch = "";
let focusedBlitzRecruit = "";
let blitzMatchHelp = false;
const watchedBlitzPlayers = new Set();
const blitzWatchStorage = "spira.blitzWatch.v1";
try {
  const saved = JSON.parse(localStorage.getItem(blitzWatchStorage) || "[]");
  if (Array.isArray(saved)) for (const name of saved) if (blitzPlayers.includes(name)) watchedBlitzPlayers.add(name);
} catch { /* Keep session choices when storage is unavailable. */ }

function blitzWatchOpportunity(players, eligible = () => true) {
  if (!players) return null;
  const watched = [...watchedBlitzPlayers].map(name => [name, players[blitzPlayers.indexOf(name)]])
    .filter(([name, player]) => player && eligible(name, player));
  const free = watched.find(([, [team]]) => team === -1);
  const last = watched.find(([, [team, , games]]) => team >= 0 && games === 1);
  const upcoming = free || last;
  if (!upcoming) return null;
  return {name: upcoming[0], free: Boolean(free)};
}

function blitzWatchButton(name, redraw) {
  const button = action(watchedBlitzPlayers.has(name) ? "Unwatch" : "Watch", () => {
    if (!watchedBlitzPlayers.delete(name)) watchedBlitzPlayers.add(name);
    try { localStorage.setItem(blitzWatchStorage, JSON.stringify([...watchedBlitzPlayers])); }
    catch { /* Keep session choices when storage is unavailable. */ }
    redraw();
    const replacement = [...panel.querySelectorAll("[data-watch-player]")].find(node => node.dataset.watchPlayer === name);
    replacement?.focus({preventScroll:true});
  });
  button.dataset.watchPlayer = name;
  button.setAttribute("aria-label", button.textContent + " " + name);
  return button;
}

function openBlitzView(view, player = "", matchHelp = false) {
  blitzView = view;
  focusedBlitzRecruit = player;
  blitzMatchHelp = matchHelp;
  if (view === "roster") {
    blitzRoster = "5";
    blitzSearch = "";
  } else if (view === "scout" && player) {
    blitzRole = "";
  }
  signature = "";
  choose("blitzball");
}

function openBlitzRewards() {
  openBlitzView("rewards");
}

function showBlitzball(current) {
  heading("Blitzball");
  const players = current.progress?.blitzball?.players;
  const views = element("div", "filters blitz-views");
  for (const [id,label] of [["live","Live match"],["rewards","Rewards"],["team","Team Builder"],["compare","Compare"],["roster","Roster & contracts"],["scout","Scout"],["watch","Watchlist"],["techniques","Techniques"]]) {
    const button = action(label, () => {
      if (typeof coachManualNavigation === "function") coachManualNavigation();
      blitzView = id;
      blitzMatchHelp = false;
      panel.scrollTop = 0;
      signature = "";
      render();
    });
    button.setAttribute("aria-pressed", String(id === blitzView));
    views.append(button);
  }
  panel.append(views);
  if (blitzView === "live") { showLiveBlitz(current); return; }
  if (blitzView === "team" || blitzView === "compare") {
    (blitzView === "team" ? showBlitzTeam : showBlitzCompare)(current.progress?.blitzball);
    return;
  }
  if (blitzView === "techniques") {
    showBlitzTechniques(current.progress?.blitzball);
    return;
  }
  if (blitzView === "watch") {
    const sheet = element("div", "sheet");
    panel.append(sheet);
    function drawWatchlist() {
      sheet.replaceChildren();
      if (!watchedBlitzPlayers.size) {
        sheet.append(entry("Watch a player from the roster or Scout", "", "Their live contract and recruiting location will appear here."));
        return;
      }
      const focus = name => Number(name === focusedBlitzRecruit);
      const rank = name => {
        const player = players?.[blitzPlayers.indexOf(name)];
        return player?.[0] === -1 ? 0 : player?.[2] === 1 ? 1 : 2;
      };
      const names = [...watchedBlitzPlayers].sort((a,b) => focus(b) - focus(a) || rank(a) - rank(b) || a.localeCompare(b));
      for (const name of names) {
        const player = players?.[blitzPlayers.indexOf(name)];
        const row = entry(name, player ? blitzContract(player) : "Waiting for roster data", blitzRecruitLocation(name));
        row.append(blitzWatchButton(name, drawWatchlist));
        sheet.append(row);
      }
    }
    drawWatchlist();
    return;
  }
  if (blitzView === "roster") {
    if (blitzMatchHelp) showBlitzMatchTips(true);
    showBlitzRoster(players, current.progress?.blitzball);
    return;
  }
  const rewards = blitzballProgress(current);
  if (rewards && blitzView === "rewards") {
    const completed = rewards.filter(reward => reward.earned).length;
    const next = rewards.find(reward => !reward.earned);
    const list = element("ol", "blitz-rewards");
    list.setAttribute("aria-label", "Blitzball reward order");
    for (const reward of rewards) {
      const result = reward.earned ? "Earned" : reward.listed ? "In saved prize list" : reward === next ? "Next reward" : "";
      const detail = [reward.event, result].filter(Boolean).join(" · ");
      const body = reward === next && !reward.listed && reward.battles ?
        `${number.format(current.battles)} total battles recorded · ${reward.battles} target` : "";
      const row = element("li", "blitz-reward");
      if (reward === next) row.setAttribute("aria-current", "step");
      row.append(entry(reward.name, detail, body));
      list.append(row);
    }
    panel.append(element("h2", "", `Reels and Sigil · ${completed} / ${rewards.length}`), list);
    if (next) {
      panel.append(element("p", "field-note", next.battles && !next.listed ?
        "Compare the save’s overall battle count with the target, then check the in-game prize list." :
        `Check first place in the ${next.event.toLowerCase()} prize list before playing.`));
    }
    const weapon = current.party.find(member => member.id === 4)?.gear?.some(piece => piece.type === 0 && piece.celestial);
    const weaponText = weapon ? "World Champion is in your equipment." :
      "After five Blitzball wins, bring the Celestial Mirror to the bartender in Luca.";
    const controls = element("div", "filters");
    controls.append(action("Build a team for the next match", () => openBlitzView("team")),
      action("World Champion and other Celestials", () => choose("collections", "celestials")));
    panel.append(element("p", "field-note", weaponText), controls);
    return;
  }
  panel.append(element("h2", "", "Recruit shortlist"));
  const filter = element("div", "filters guide-filters");
  const sheet = element("div", "sheet guide-list");
  function drawRecruits() {
    sheet.replaceChildren();
    const recruits = [...blitzRecruits].sort(([a], [b]) =>
      Number(b === focusedBlitzRecruit) - Number(a === focusedBlitzRecruit));
    for (const [name, role, location, tip, rooms] of recruits) {
      if (blitzRole && role !== blitzRole) continue;
      const nearby = rooms.includes(current.room) && !(name === "Brother" && current.story < 2900);
      const contract = players?.[blitzPlayers.indexOf(name)];
      const row = entry(name, [role, location, nearby ? "Nearby" : ""].filter(Boolean).join(" · "), tip);
      if (contract) row.append(element("p", "", blitzContract(contract)));
      row.append(blitzWatchButton(name, drawRecruits));
      sheet.append(row);
    }
  }
  filter.append(options("Position", [["","All positions"], ...["Forward","Midfield","Defense","Goalkeeper"].map(role => [role,role])],
    blitzRole, value => { blitzRole = value; drawRecruits(); }));
  panel.append(filter, sheet);
  drawRecruits();
  showBlitzMatchTips();
}

function showBlitzMatchTips(expanded = false) {
  const tips = element("details", "arena-pending");
  tips.open = expanded;
  tips.append(element("summary", "", "Match tips"),
    element("p", "", "Switch movement to Manual A when you have possession. Draw defenders toward your midfielder, pass to Tidus, then shoot close to goal. Jecht Shot can take two defenders out of the play."));
  panel.append(tips);
}

function showBlitzRoster(players, blitz) {
  if (!players) {
    panel.append(element("p", "empty", "Roster data will appear when Blitzball is initialized in this save."));
    return;
  }
  const controls = element("div", "filters guide-filters");
  const teamFilter = options("Roster", [["all","All players"], ...blitzTeams.map((name,id) => [id,name]),
    ["free","Free agents"],["expiring","Contracts ending in 1–3 games"]], blitzRoster, value => {
    blitzRoster = value;
    draw();
  });
  const search = element("input");
  search.type = "search";
  search.placeholder = "Find a Blitzball player";
  search.setAttribute("aria-label", search.placeholder);
  search.value = blitzSearch;
  search.addEventListener("input", () => { blitzSearch = search.value; draw(); });
  controls.append(search, teamFilter);
  const sheet = element("div", "sheet");
  panel.append(controls, sheet);
  function draw() {
    sheet.replaceChildren();
    const query = blitzSearch.trim().toLowerCase();
    for (const [id, player] of players.entries()) {
      const [team, level, games] = player;
      if (!blitzPlayers[id].toLowerCase().includes(query)) continue;
      if (blitzRoster === "free" ? team >= 0 : blitzRoster === "expiring" ? team < 0 || games < 1 || games > 3 :
        blitzRoster !== "all" && team !== Number(blitzRoster)) continue;
      const state = blitzContract(player);
      const spot = blitzRecruitLocation(blitzPlayers[id]);
      const row = entry(blitzPlayers[id], `Lv. ${level} · ${state}`, spot);
      row.append(action("Compare stats", () => openBlitzComparison(id, null, null, blitz)), blitzWatchButton(blitzPlayers[id], draw));
      sheet.append(row);
    }
    if (!sheet.childElementCount) sheet.append(entry("No matching players"));
  }
  draw();
}
