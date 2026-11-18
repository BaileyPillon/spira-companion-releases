"use strict";

const blitzStatKeys = ["HP", "SP", "EN", "AT", "PA", "BL", "SH", "CA"];
const blitzStatLabels = ["HP", "Speed", "Endurance", "Attack", "Pass", "Block", "Shot", "Catch"];
// Transparent base-stat priorities, not a win probability. Techniques remain a separate decision.
const blitzRoles = {
  forward: {label:"Forward", weights:{SH:60, EN:25, SP:15}},
  midfield: {label:"Midfield", weights:{PA:35, SP:25, EN:20, AT:10, BL:10}},
  defense: {label:"Defense", weights:{AT:45, BL:25, PA:20, SP:10}},
  keeper: {label:"Goalkeeper", weights:{CA:100}}
};
const blitzSlots = ["forward", "forward", "midfield", "defense", "defense", "keeper"];
const blitzSlotNames = ["Left forward", "Right forward", "Midfielder", "Left defender", "Right defender", "Goalkeeper"];
let blitzTeamPool = "roster";
let blitzTeamLevel = 0;
let blitzTeamLocks = Array(6).fill(null);
let blitzTeamChoicesOpen = false;
let blitzCompareIds = [6, 50];
let blitzRankRole = "keeper";

function blitzStatsAt(name, requestedLevel, preview = false) {
  const samples = blitzStatReference[name]?.samples;
  if (!samples || !Number.isInteger(requestedLevel) || requestedLevel < 1 || requestedLevel > 99) return null;
  // A preview may request a level below a recruit's starting level. Never fabricate live values there.
  if (requestedLevel < samples[0][0] && !preview) return null;
  const level = Math.max(requestedLevel, samples[0][0]);
  const upper = samples.findIndex(row => row[0] >= level);
  if (upper < 0) return null;
  const high = samples[upper], low = samples[Math.max(0, upper - 1)];
  const exact = high[0] === level;
  const stats = Object.fromEntries(blitzStatKeys.map((key, i) => [key, exact ? high[i + 1] :
    Math.round(low[i + 1] + (high[i + 1] - low[i + 1]) * (level - low[0]) / (high[0] - low[0]))]));
  return {level, estimated:!exact, minimum:level !== requestedLevel, stats};
}

function blitzRoleScore(stats, role) {
  return Object.entries(blitzRoles[role].weights).reduce((total, [key, weight]) => total + stats[key] * weight / 100, 0);
}

function blitzTeamCandidates(blitz, pool, previewLevel = 0) {
  return blitzPlayers.flatMap((name, id) => {
    const saved = blitz?.players?.[id];
    const player = saved && Number.isInteger(saved[0]) && saved[0] >= -1 && saved[0] <= 5 ? saved : null;
    if (!player && !(previewLevel && pool === "all")) return [];
    if (pool === "roster" && player?.[0] !== 5 || pool === "free" && ![-1,5].includes(player?.[0])) return [];
    const reference = blitzStatsAt(name, previewLevel || player?.[1], !!previewLevel);
    return reference ? [{id, name, player, ...reference}] : [];
  });
}

// Assign each player at most once. A 64-mask dynamic program maximizes the sum across six positions.
function blitzBuildTeam(candidates, locks = []) {
  const valid = locks.map(id => candidates.some(player => player.id === id) ? id : null);
  const reserved = new Set(valid.filter(id => id !== null));
  let states = new Map([[0, {score:0, team:Array(6).fill(null)}]]);
  for (const candidate of candidates) {
    const next = new Map(states);
    for (const [mask, state] of states) for (let slot = 0; slot < 6; slot++) {
      if (mask & (1 << slot) || valid[slot] != null && valid[slot] !== candidate.id ||
          reserved.has(candidate.id) && valid[slot] !== candidate.id) continue;
      const updated = mask | (1 << slot);
      const score = state.score + blitzRoleScore(candidate.stats, blitzSlots[slot]);
      if (!next.has(updated) || score > next.get(updated).score) {
        const team = [...state.team];
        team[slot] = candidate;
        next.set(updated, {score, team});
      }
    }
    states = next;
  }
  return states.get(63)?.team || null;
}

function blitzReferenceLabel(player) {
  return `Lv. ${player.level}${player.minimum ? " (starting level)" : ""} · ${player.estimated ? "Estimated stats" : "Reference stats"}`;
}

function blitzRecruitLocation(name) {
  return blitzRecruits.find(([recruit]) => recruit === name)?.[2] || blitzStatReference[name]?.location || "";
}

function blitzStatSummary(player, role) {
  return Object.keys(blitzRoles[role].weights).map(key => `${key} ${player.stats[key]}`).join(" · ");
}

function blitzKnownMoves(blitz, id) {
  const data = blitz?.techniques?.[id];
  if (!data) return "Learned techniques unavailable";
  const known = blitzTechniqueNames.filter((_, index) => knowsBlitzTechnique(data, index + 1));
  return known.length ? `Learned: ${known.join(", ")}` : "No learned techniques recorded";
}

function blitzLabeledSelect(label, values, selected, onChange) {
  const wrapper = element("label", "blitz-select");
  wrapper.append(element("span", "", label), options(label, values, selected, onChange));
  return wrapper;
}

function blitzCandidateContract(player) {
  return player.player ? blitzContract(player.player) : "Contract unknown · load your roster";
}

function blitzBestRole(player, pool) {
  return Object.keys(blitzRoles).sort((a,b) =>
    pool.filter(p => blitzRoleScore(p.stats,a) > blitzRoleScore(player.stats,a)).length -
    pool.filter(p => blitzRoleScore(p.stats,b) > blitzRoleScore(player.stats,b)).length)[0];
}

function openBlitzComparison(id, other = null, role = null, blitz = null) {
  const pool = blitzTeamCandidates(blitz, "all", blitzTeamLevel);
  const player = pool.find(p => p.id === id);
  blitzRankRole = role || (player ? blitzBestRole(player,pool) : "keeper");
  const baseline = pool.filter(p => p.id !== id && p.player?.[0] === 5)
    .sort((a,b) => blitzRoleScore(b.stats,blitzRankRole) - blitzRoleScore(a.stats,blitzRankRole))[0];
  blitzCompareIds = [other ?? baseline?.id ?? (id === 6 ? 50 : 6), id];
  openBlitzView("compare");
}

function showBlitzTeam(blitz) {
  const controls = element("div", "filters blitz-team-controls");
  const content = element("div", "blitz-team-content");
  controls.append(blitzLabeledSelect("Player pool", [["roster","My roster"],["free","Roster + free agents"],["all","All players · planning"]],
    blitzTeamPool, value => { blitzTeamPool = value; draw(); }),
    blitzLabeledSelect("Levels", [[0,"Save levels"], ...[1,5,10,20,30,50,70,99].map(n => [n, `Preview Lv. ${n}`])],
      blitzTeamLevel, value => { blitzTeamLevel = Number(value); draw(); }));
  panel.append(element("h2", "", "Build your starting six"), controls,
    element("p", "field-note", "Save mode uses your recorded levels and contracts. Stats use reference samples; values between samples are estimates. This planner does not change your team in the game."), content);
  const method = element("details", "arena-pending");
  method.append(element("summary", "", "How the lineup is chosen"), element("p", "",
    "The planner maximizes the six players’ combined position scores without using anyone twice. Techniques and tactics can outweigh base stats: use Keep favorite players in position to reserve their places."));
  for (const role of Object.values(blitzRoles)) method.append(element("p", "",
    `${role.label}: ${Object.entries(role.weights).map(([key, value]) => `${key} ${value}%`).join(" · ")}`));
  method.append(element("p", "", "Free agent means unsigned in this save, not necessarily reachable at this point in the story. Reference data: theadamantium/BlitzballAppv2. Preview levels are hypothetical; learned techniques stay save-backed."));
  panel.append(method);
  function draw() {
    content.replaceChildren();
    const candidates = blitzTeamCandidates(blitz, blitzTeamPool, blitzTeamLevel);
    const effectiveLocks = blitzTeamLocks.map((id, i) => candidates.some(p => p.id === id) && blitzTeamLocks.indexOf(id) === i ? id : null);
    const team = blitzBuildTeam(candidates, effectiveLocks);
    if (!team) {
      content.append(element("p", "empty", "Six valid players are needed. Open Blitzball at a save sphere to load your roster, or include free agents. Choose All players and a preview level to plan without a roster."));
      return;
    }
    const recruits = team.filter(player => player.player?.[0] !== 5);
    const counts = [["Aurochs",team.filter(p => p.player?.[0] === 5).length],
      ["free agents",team.filter(p => p.player?.[0] === -1).length],
      ["signed rivals",team.filter(p => p.player && p.player[0] >= 0 && p.player[0] < 5).length],
      ["contracts unknown",team.filter(p => !p.player).length]].filter(([,count]) => count);
    content.append(element("p", "field-guide-count", `${blitzTeamLevel ? "Preview" : "Suggested lineup"} · ${counts.map(([label,n]) => `${n} ${label}`).join(" · ")}`));
    if (recruits.length) content.append(element("p", "field-note", "Check story access before traveling. A signed rival must leave their team before you can recruit them."));
    if (!blitz?.players) content.append(element("p", "field-note", "Load your Blitzball roster to see contracts and learned techniques."));
    const lineup = element("ol", "blitz-lineup");
    lineup.setAttribute("aria-label", "Suggested starting six");
    const choices = element("details", "arena-pending");
    choices.open = blitzTeamChoicesOpen;
    choices.append(element("summary", "", "Keep favorite players in position"));
    choices.addEventListener("toggle", () => { if (choices.isConnected) blitzTeamChoicesOpen = choices.open; });
    const positionControls = element("div", "filters blitz-team-controls");
    for (const [slot, player] of team.entries()) {
      const row = element("li", "blitz-lineup-player");
      row.dataset.slot = String(slot);
      row.append(element("span", "blitz-position", blitzSlotNames[slot]), element("strong", "", player.name),
        element("small", "blitz-availability", player.player?.[0] === 5 ? "On your roster" : blitzCandidateContract(player)),
        element("span", "blitz-stats", blitzStatSummary(player, blitzSlots[slot])),
        element("small", "", blitzReferenceLabel(player)));
      const select = blitzLabeledSelect(`Keep at ${blitzSlotNames[slot].toLowerCase()}`,
        [["auto","Auto"], ...(blitzTeamLocks[slot] != null && effectiveLocks[slot] == null ?
          [[blitzTeamLocks[slot],`${blitzPlayers[blitzTeamLocks[slot]]} · unavailable in pool`]] : []),
          ...candidates.map(p => [p.id,p.name])], blitzTeamLocks[slot] ?? "auto", value => {
          const id = value === "auto" ? null : Number(value);
          blitzTeamLocks = blitzTeamLocks.map(old => old === id ? null : old);
          blitzTeamLocks[slot] = id;
          draw();
          content.querySelector(`select[aria-label="Keep at ${blitzSlotNames[slot].toLowerCase()}"]`)?.focus({preventScroll:true});
        });
      positionControls.append(select);
      lineup.append(row);
    }
    content.append(lineup);
    choices.append(positionControls);
    if (blitzTeamLocks.some(id => id !== null)) choices.append(action("Clear position choices", () => { blitzTeamLocks.fill(null); draw(); }));
    content.append(choices);
    const rosterSize = blitz?.players?.filter(p => p[0] === 5).length;
    if (rosterSize && recruits.length) {
      const releases = Math.max(0, rosterSize + recruits.length - 8);
      content.append(element("p", "field-note", `Roster: ${rosterSize}/8 players. ${releases ?
        `Release ${releases} ${releases === 1 ? "player" : "players"} before completing this recruiting plan.` : "There is room for these recruits."}`));
    }
    const sheet = element("div", "sheet blitz-team-details");
    const own = blitzTeamCandidates(blitz, "roster", blitzTeamLevel);
    for (const [slot, player] of team.entries()) {
      const role = blitzSlots[slot];
      const row = entry(player.name, `${blitzSlotNames[slot]} · ${blitzCandidateContract(player)}`, blitzRecruitLocation(player.name));
      const moves = element("details", "blitz-moves");
      moves.append(element("summary", "", "Learned techniques"), element("p", "", blitzKnownMoves(blitz, player.id)));
      const compare = [...own].filter(p => p.id !== player.id).sort((a,b) => blitzRoleScore(b.stats,role) - blitzRoleScore(a.stats,role))[0];
      const actions = element("div", "filters");
      actions.append(action(compare ? `Compare with ${compare.name}` : "Compare player", () => openBlitzComparison(player.id, compare?.id, role, blitz)),
        blitzWatchButton(player.name, draw));
      row.append(moves, actions);
      sheet.append(row);
    }
    content.append(element("h2", "", recruits.length ? "Recruiting plan and techniques" : "Player details and techniques"), sheet);
  }
  draw();
}

function showBlitzCompare(blitz) {
  const controls = element("div", "filters blitz-team-controls");
  const content = element("div");
  const names = blitzPlayers.map((name,id) => [id,name]);
  for (let index = 0; index < 2; index++) controls.append(blitzLabeledSelect(index ? "Challenger" : "Compare against", names,
    blitzCompareIds[index], value => { blitzCompareIds[index] = Number(value); draw(); }));
  controls.append(blitzLabeledSelect("Comparison levels", [[0,"Save levels"], ...[1,5,10,20,30,50,70,99].map(n => [n,`Preview Lv. ${n}`])],
    blitzTeamLevel, value => { blitzTeamLevel = Number(value); draw(); }));
  panel.append(element("h2", "", "Compare players"), controls, content);
  function draw() {
    content.replaceChildren();
    const all = blitzTeamCandidates(blitz, "all", blitzTeamLevel);
    const pair = blitzCompareIds.map(id => all.find(player => player.id === id));
    if (pair.some(player => !player)) {
      content.append(element("p", "empty", "A selected player has no valid saved level in the reference data. Choose a preview level to compare reference stats now, or open Blitzball in the game to load saved levels."));
      return;
    }
    content.append(element("p", "field-note", `${blitzTeamLevel ? "Hypothetical level preview" : "Saved levels"}. Reference stats; between-sample values are estimates. Positive changes favor the challenger.`));
    if (!blitz?.players) content.append(element("p", "field-note", "Load your Blitzball roster to see contracts and learned techniques."));
    const table = element("table", "blitz-comparison");
    const caption = element("caption", "", `${pair[0].name} vs ${pair[1].name}${blitzTeamLevel ? " · Preview" : ""}`);
    const head = element("thead"), header = element("tr");
    for (const label of ["Stat", ...pair.map(player => `${player.name} · Lv. ${player.level}${player.estimated ? " ~" : ""}`), "Change"]) {
      const cell = element("th", "", label); cell.scope = "col"; header.append(cell);
    }
    head.append(header);
    const body = element("tbody");
    blitzStatKeys.forEach((key,index) => {
      const row = element("tr");
      const label = element("th", "", blitzStatLabels[index]); label.scope = "row"; row.append(label);
      for (const player of pair) row.append(element("td", "", String(player.stats[key])));
      const diff = pair[1].stats[key] - pair[0].stats[key];
      row.append(element("td", diff > 0 ? "blitz-gain" : diff < 0 ? "blitz-loss" : "", `${diff > 0 ? "+" : ""}${diff}`));
      body.append(row);
    });
    table.append(caption, head, body);
    content.append(table);
    const details = element("div", "sheet");
    for (const player of pair) {
      const row = entry(player.name, `${blitzReferenceLabel(player)} · ${blitzCandidateContract(player)}`, blitzRecruitLocation(player.name));
      const moves = element("details", "blitz-moves");
      moves.append(element("summary", "", "Learned techniques"), element("p", "", blitzKnownMoves(blitz, player.id)));
      row.append(moves, blitzWatchButton(player.name, draw)); details.append(row);
    }
    content.append(details, element("h2", "", `${blitzRoles[blitzRankRole].label} shortlist`),
      element("p", "field-note", "Ranked by base stats across all teams. Check contracts and techniques before recruiting. Scoring weights are explained in Team Builder."));
    content.append(blitzLabeledSelect("Rank position", Object.entries(blitzRoles).map(([key,role]) => [key,role.label]),
      blitzRankRole, value => { blitzRankRole = value; draw(); content.querySelector('select[aria-label="Rank position"]')?.focus({preventScroll:true}); }));
    const ranked = [...all].sort((a,b) => blitzRoleScore(b.stats,blitzRankRole) - blitzRoleScore(a.stats,blitzRankRole)).slice(0,6);
    const ranking = element("div", "sheet");
    for (const [index, player] of ranked.entries()) {
      const row = entry(`${index + 1}. ${player.name}`, `${blitzReferenceLabel(player)} · ${blitzCandidateContract(player)}`, blitzStatSummary(player,blitzRankRole));
      row.append(action(`Compare ${player.name}`, () => {
        blitzCompareIds[1] = player.id;
        controls.querySelector('select[aria-label="Challenger"]').value = String(player.id);
        draw();
        panel.scrollTop = 0;
      }));
      ranking.append(row);
    }
    content.append(ranking);
  }
  draw();
}
