"use strict";

const huntRegions = Object.keys(arenaRegions);
const captureAbility = 0x807a;
const huntPercent = new Intl.NumberFormat(undefined, {style:"percent", maximumFractionDigits:1});
const huntFrequencies = new Intl.NumberFormat(undefined, {maximumFractionDigits:2});
let huntScope = "here";
let huntFiend = "";
let huntExpanded = new Set();
let huntSession = null;
let huntJournalOpen = false;

function hasCaptureData(current) {
  return current?.game === "x" && typeof current.arena === "string" && current.arena.length >= 1024;
}

function captureRoster(current) {
  return current.party.filter(member => member.id >= 0 && member.id < 7).flatMap(member => {
    const weapons = (member.gear || []).filter(piece =>
      piece.type === 0 && piece.abilities?.includes(captureAbility));
    if (!weapons.length) return [];
    const equipped = weapons.find(piece => piece.equipped);
    const effects = statusEffects("x", member).split(" · ");
    const blocked = member.hp === 0 ? "KO" : effects.find(effect =>
      ["KO", "Petrify", "Sleep", "Confuse", "Berserk"].includes(effect));
    const position = current.turnOrder?.indexOf(member.id) ?? -1;
    return [{name:catalog.x.party[member.id], weapon:gearName(equipped || weapons[0], member.id),
      ready:!!equipped && !!member.active && !blocked, equipped:!!equipped, active:member.active,
      blocked, position}];
  }).sort((a,b) => Number(b.ready) - Number(a.ready) || (a.position < 0 ? Infinity : a.position) -
    (b.position < 0 ? Infinity : b.position));
}

function huntBattleTargets(current, target = arenaTarget) {
  if (!hasCaptureData(current) || !current.battle || current.room === 307) return [];
  return (current.enemies || []).flatMap(foe => {
    if (foe.hp <= 0) return [];
    const name = enemyName(foe.id);
    if (!ffxCaptureRegions.has(name)) return [];
    const count = arenaCaptureCount(current, name);
    return count != null && count < target ? [{name, count, foe}] : [];
  }).sort((a,b) => Number(!!b.foe.targeted) - Number(!!a.foe.targeted) || a.foe.hp - b.foe.hp);
}

function showCaptureAssist(current, targets) {
  const roster = captureRoster(current);
  if (!targets.length || (!roster.length && !huntSession)) return;
  const section = element("section", "hunt-assist");
  section.append(element("h2", "", "Capture Assist"));
  const ready = roster.filter(member => member.ready);
  if (ready.length) {
    const choices = ready.map(member => member.name + (member.position === 0 ? " (now)" :
      member.position > 0 ? " (turn " + (member.position + 1) + ")" : ""));
    section.append(element("p", "hunt-ready", "Capture equipped · " + choices.join(", ")));
  } else {
    section.append(element("p", "hunt-warning", roster.length ?
      "No active character can use their Capture weapon right now." : "No Capture weapons found in your inventory."));
    const choices = roster.map(member => member.name + " · " +
      (!member.active ? "reserve" : member.blocked || (member.equipped ? "equipped" : "unequipped")));
    if (choices.length) section.append(element("p", "field-note", choices.join(" / ")));
  }
  const list = element("ul", "hunt-list");
  for (const {name, count, foe} of targets) {
    const row = element("li");
    const info = element("div");
    info.append(element("strong", "", battleEnemyName(current, foe)),
      element("small", "", [foe.targeted ? "Selected" : "", ffxData.enemies[foe.id]?.armored ? "Armored" : "",
        `${count} / ${arenaTarget} captured`].filter(Boolean).join(" · ")));
    row.append(info, element("span", "hunt-numeric", `${number.format(foe.hp)} HP`));
    list.append(row);
  }
  section.append(list, element("p", "field-note", "Land the finishing blow with a Capture weapon."));
  const actions = element("div", "tracker-actions");
  actions.append(action("Open Hunt", () => openArenaHunt()),
    action("Check Capture gear", () => {
      equipmentView = "gear";
      gearFocus = "capture";
      choose("equip");
    }));
  section.append(actions);
  panel.append(section);
}

function huntSpotReport(spot, remaining, focus = "") {
  const table = spot[4];
  const sightings = new Map();
  let fights = 0;
  let targets = 0;
  for (const formation of table) {
    const useful = new Map();
    for (const id of formation) {
      const name = enemyName(id);
      if ((focus && name !== focus) || !(remaining.get(name) > 0)) continue;
      useful.set(name, (useful.get(name) || 0) + 1);
    }
    if (useful.size) fights++;
    for (const [name, count] of useful) {
      sightings.set(name, (sightings.get(name) || 0) + 1);
      targets += Math.min(count, remaining.get(name));
    }
  }
  return {spot, sightings, fights, targets, slots:table.length};
}

function localHuntSpots(room) {
  return ffxHuntSpots.filter(spot => spot[2].includes(room));
}

function huntRemaining(current, target) {
  return new Map(allArenaFiends.map(name => [name, Math.max(0, target - (arenaCaptureCount(current, name) ?? target))]));
}

function huntReports(current, scope, focus = "", target = arenaTarget) {
  const remaining = huntRemaining(current, target);
  const local = localHuntSpots(current.room);
  const candidates = scope === "all" || scope === "here" && !local.length ? ffxHuntSpots :
    scope === "here" ? local : ffxHuntSpots.filter(spot => huntRegions[spot[1]] === scope);
  return candidates.map(spot => ({...huntSpotReport(spot, remaining, focus), scripted:
    spot[0] === "omega_ruins_upper" && !arenaDefeated(current, "Omega Weapon")})).filter(report => report.fights)
    .sort((a,b) => Number(a.scripted) - Number(b.scripted) ||
      b.fights / b.slots - a.fights / a.slots || b.targets / b.slots - a.targets / a.slots ||
      Number(local.includes(b.spot)) - Number(local.includes(a.spot)));
}

function openArenaHunt({focus = "", scope = focus ? "all" : "here"} = {}) {
  if (huntFiend !== focus || huntScope !== scope) huntExpanded.clear();
  huntFiend = focus;
  huntScope = scope;
  arenaView = "hunt";
  arenaCreation = "";
  signature = "";
  choose("arena");
}

function huntSnapshot(current) {
  return new Map(allArenaFiends.map(name => [name, arenaCaptureCount(current, name)]));
}

function updateHuntSession(current) {
  if (!huntSession) return;
  const log = huntSession;
  if (!hasCaptureData(current) || current.disc !== log.disc || current.crc !== log.crc) {
    log.field = null;
    log.fight = null;
    log.returned = false;
    return;
  }
  if (current.paused) return;
  const counts = huntSnapshot(current);
  const last = log.field;
  const consecutive = last && last.room === current.room && last.story === current.story &&
    current.battles >= last.battles && current.battles <= last.battles + 1 &&
    [...counts].every(([name, count]) => count >= last.counts.get(name));
  if (!consecutive || current.room === 307) {
    log.fight = null;
    log.returned = false;
  }
  if (current.battle) {
    if (!consecutive || current.room === 307 || log.returned) {
      log.field = null;
      log.fight = null;
      log.returned = false;
      return;
    }
    const fight = log.fight ??= new Map();
    for (const [index, foe] of (current.enemies || []).entries()) {
      const name = enemyName(foe.id);
      if (ffxCaptureRegions.has(name)) fight.set(foe.slot ?? foe.battleId ?? index, name);
    }
    return;
  }
  if (log.fight?.size) {
    // PINE reads the Arena counters before it reads the battle state. Give
    // counters from the last battle another field frame to settle.
    if (!log.returned) {
      log.returned = true;
      return;
    }
    const seen = new Map();
    for (const name of log.fight.values()) seen.set(name, (seen.get(name) || 0) + 1);
    const changes = [...counts].flatMap(([name,count]) => {
      const delta = count - last.counts.get(name);
      return delta > 0 ? [[name,delta]] : [];
    });
    if (changes.every(([name,delta]) => delta <= (seen.get(name) || 0))) {
      log.fights++;
      log.caught += changes.reduce((sum, [,delta]) => sum + delta, 0);
      const milestones = [...new Set(changes.map(([name]) => ffxCaptureRegions.get(name)))]
        .filter(region => arenaRegions[region].every(name => counts.get(name) >= log.goal) &&
          arenaRegions[region].some(name => last.counts.get(name) < log.goal));
      log.rows.unshift({room:current.room, seen:[...seen], changes, milestones});
      log.rows.length = Math.min(log.rows.length, 12);
    }
  }
  log.fight = null;
  log.returned = false;
  log.field = {room:current.room, story:current.story, battles:current.battles, counts};
}

function showHuntSession(current) {
  const section = element("section", "hunt-log");
  section.append(element("h2", "", "Hunt journal"));
  const log = huntSession?.disc === current.disc && huntSession?.crc === current.crc ? huntSession : null;
  if (!log) {
    section.append(element("p", "field-note", "Record the fiends you encounter and the captures the game counts. The journal lasts until Spira closes."));
    const start = action("Start hunt journal", () => {
      huntSession = {disc:current.disc, crc:current.crc, goal:arenaTarget, field:null, fight:null, fights:0, caught:0, rows:[]};
      huntJournalOpen = true;
      updateHuntSession(frame);
      signature = "";
      render();
    });
    start.disabled = !!current.battle || !!current.paused || reconnecting;
    section.append(start);
  } else {
    const label = `${log.caught} captured · ${log.fights} encounters observed · ${log.goal} per species`;
    const details = element("details", "hunt-log-details");
    details.open = huntJournalOpen;
    details.addEventListener("toggle", () => { huntJournalOpen = details.open; });
    details.append(element("summary", "hunt-ready", label));
    if (!log.rows.length) details.append(element("p", "field-note", "Return to the field after a fiend encounter to see the first entry."));
    const list = element("ul", "hunt-list");
    for (const row of log.rows) {
      const item = element("li");
      const info = element("div");
      const summary = pairs => pairs.map(([name, count]) => count > 1 ? `${name} ×${count}` : name).join(", ");
      info.append(element("strong", "", row.changes.length ? summary(row.changes) : "No captures registered"),
        element("small", "", roomName({game:"x", room:row.room}) + " · Saw " + summary(row.seen)));
      for (const region of row.milestones) {
        info.append(element("small", "hunt-ready", `${region} · ${log.goal} per species reached`));
      }
      item.append(info);
      list.append(item);
    }
    details.append(list, action("End hunt journal", () => {
      huntSession = null;
      signature = "";
      render();
    }));
    section.append(details);
  }
  panel.append(section);
}

function showArenaHunt(current) {
  if (!hasCaptureData(current)) {
    panel.append(element("p", "empty", "Waiting for Arena capture counts."));
    return;
  }
  const controls = element("div", "filters hunt-controls");
  controls.append(options("Hunt area", [["here","Follow current room"],["all","All hunting spots"],
    ...huntRegions.map(region => [region,region])], huntScope, value => {
    huntScope = value;
    huntExpanded.clear();
    signature = "";
    render();
  }), options("Hunt target", [["","Any needed fiend"], ...[...allArenaFiends].sort((a,b) => a.localeCompare(b))
    .map(name => [name,name])], huntFiend, value => {
    huntFiend = value;
    huntScope = value ? "all" : "here";
    huntExpanded.clear();
    signature = "";
    render();
  }), options("Capture goal", [[1,"1 per species"],[5,"5 per species"],[10,"10 per species"]], arenaTarget, value => {
    arenaTarget = Number(value);
    signature = "";
    render();
  }));
  panel.append(controls);
  const local = localHuntSpots(current.room);
  const reports = huntReports(current, huntScope, huntFiend);
  const place = huntScope === "here" ? (local.length ? roomName(current) + " · Following your room" :
      "No encounter table for " + roomName(current) + ". Showing spots across Spira.") : huntScope === "all" ? "Spots across Spira" : huntScope;
  const lead = huntFiend ? `${arenaCaptureCount(current, huntFiend)} / ${arenaTarget} captured · ${place}` : place;
  const title = huntFiend || "Where to hunt";
  panel.append(element("h2", "", title), element("p", "hunt-caption", lead));
  if (huntFiend || current.fieldMap && !current.battle) {
    const actions = element("div", "tracker-actions");
    if (huntFiend) actions.append(trackFiendButton(current, huntFiend, ffxCaptureRegions.get(huntFiend), arenaTarget));
    if (current.fieldMap && !current.battle) actions.append(action("Open current map", () => choose("map")));
    panel.append(actions);
  }
  if (current.battle) showCaptureAssist(current, huntBattleTargets(current));
  if (!reports.length) {
    panel.append(element("p", "empty", huntFiend && arenaCaptureCount(current, huntFiend) >= arenaTarget ?
      "Capture goal reached for this fiend." : "No remaining targets in these encounter tables."));
  }
  if (reports.length) {
    const list = element("div", "hunt-spots");
    const best = element("div", "hunt-spots");
    for (const {spot, sightings, fights, targets, slots, scripted} of reports) {
      const [key,region,rooms,label] = spot;
      const details = element("details", "hunt-spot");
      details.open = huntExpanded.has(key);
      details.addEventListener("toggle", () => {
        if (details.open) huntExpanded.add(key);
        else huntExpanded.delete(key);
      });
      const summary = element("summary");
      const where = element("span");
      where.append(element("strong", "", label),
        element("small", "", rooms.includes(current.room) ? "Current room" : huntRegions[region]));
      summary.append(where, element("span", "hunt-odds", scripted ? "Platform fights" : huntPercent.format(fights / slots)));
      details.append(summary);
      const rows = element("ul", "hunt-list");
      for (const [name,chance] of [...sightings].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
        const row = element("li");
        row.append(action(name, () => openArenaHunt({focus:name})), element("span", "hunt-numeric",
          `${arenaCaptureCount(current, name)} / ${arenaTarget}${scripted ? "" : " · " + huntPercent.format(chance / slots)}`));
        rows.append(row);
      }
      details.append(element("p", "field-note", scripted ? "Platform encounters before Omega Weapon. Check the lower caverns for repeatable random fights." :
        `${fights} of ${slots} encounter slots with a needed fiend · ${huntFrequencies.format(targets / slots)} needed fiends per fight on average`), rows);
      (best.childElementCount ? list : best).append(details);
    }
    panel.append(element("p", "field-note hunt-caption", "Percent of encounter slots with a needed fiend. Some tables share a room."), best);
    showHuntSession(current);
    if (list.childElementCount) panel.append(element("h2", "", "Other hunting spots"), list);
  } else {
    showHuntSession(current);
  }
}
