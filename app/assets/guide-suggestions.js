"use strict";

const blitzballMenuRooms = new Set([212,347]);
const blitzballPoolRooms = new Set([62,121,124,125,355,356]);
const homePrimerRooms = {19:[276], 20:[275,286], 21:[280]};
const storyBosses = new Set([119,120,126,129,130,142]);
const guidePriority = {extra:1, activity:2, timely:3, watched:4, deadline:5};

function guideSuggestionsFor(current, lightningActivity = null) {
  if (current?.disc !== "SLPS-25088") return [];
  const suggestions = [];
  const add = (key, text, label, open, priority = guidePriority.extra, wait = 900) =>
    suggestions.push({key,text,label,open,priority,wait});
  const progress = current.progress;
  if (!current.battle && current.room === 290) {
    add("remiem-race", "Racing for a mirror or a chest prize? Your route is ready.", "Open race navigator",
      () => choose("plan-remiem"), guidePriority.activity);
  }
  const atBlitzMenu = !current.battle && blitzballMenuRooms.has(current.room);
  const watched = !current.battle && progress?.blitzball?.players &&
    blitzWatchOpportunity(progress.blitzball.players, (player, [team]) => atBlitzMenu ||
      (team === -1 && blitzRecruits.some(([name, , , , rooms]) =>
        name === player && rooms.includes(current.room) && (name !== "Brother" || current.story >= 2900))));
  if (watched) {
    add(`blitz-watch-${watched.name}-${watched.free ? "free" : "last"}`,
      watched.free ? `${watched.name} is a free agent.` : `${watched.name} has one match left on their contract.`,
      "Open Watchlist", () => openBlitzView("watch", watched.name), guidePriority.watched);
  }

  if (!current.battle && blitzballPoolRooms.has(current.room)) {
    const techniques = progress?.blitzball?.techniques;
    add("blitzball-match", current.blitzMatch ? "Live pool positions and match advice are ready." : techniques ? "See equipped techniques on the opposing teams." : "In the pool. See your roster and match tips.",
      "Open Blitzball", () => current.blitzMatch ? openBlitzView("live") : techniques ? openBlitzView("techniques") : openBlitzView("roster", "", true), guidePriority.timely);
    return suggestions;
  }
  if(!current.battle&&current.cloister){
    add("cloister-"+current.cloister.temple,"See the next move in "+current.cloister.temple+", including the destruction treasure.","Open Cloister companion",()=>{selectedCloister="";choose("trials");},guidePriority.timely,1600);
  }
  if (atBlitzMenu) {
    const prize = blitzballProgress(current)?.find(reward => reward.listed);
    const expiring = progress?.blitzball?.players?.findIndex(([team, , games]) => team === 5 && games === 1) ?? -1;
    const text = prize ? `${prize.name} is in the ${prize.event.toLowerCase()} prize list.` :
      expiring >= 0 ? `${blitzPlayers[expiring]} has one match left on their contract.` :
        "Blitzball is open. Check Wakka’s rewards and the current prize list.";
    add("blitzball-menu", text, "Open Blitzball",
      prize || expiring < 0 ? openBlitzRewards : () => openBlitzView("roster"), guidePriority.timely);
    return suggestions;
  }

  if (current.battle) {
    const foes = (current.enemies || []).filter(foe => foe.hp > 0);
    const boss = foes.find(foe => storyBosses.has(foe.id) || (current.grid && prepForFoe(foe)));
    if (boss) {
      const id = boss.id === 129 && boss.maxHp === 60000 ? 130 : boss.id;
      const advice = ffxBossAdvice(current, {...boss,id});
      if (advice?.[0] === "Mix Sunburst") {
        add("sunburst", "Rikku can Mix Sunburst with items you have.",
          "Show recipe", () => choose("mix", "Sunburst"), guidePriority.timely);
      } else if (id === 130 || id === 142) {
        add(`boss-${id}`, advice?.[0] || "Check your front line", "Open story boss coach",
          () => openLiveBossCoach(), guidePriority.activity);
      } else {
        add(`boss-${id}`, advice?.[0] || `Battle tips for ${enemyName(id)}`,
          "Open battle tips", () => choose("status"), guidePriority.activity);
      }
      return suggestions;
    }
    if (!current.grid) return suggestions;
    const {rages, captures} = battleOpportunities(current);
    if (current.party.some(member => member.id === 3 && member.active && member.hp > 0)) {
      for (const {name} of rages) {
        add(`rage-${name}`, `Learn ${name} with Kimahri’s Lancet.`,
          "Open battle tips", () => choose("status"), guidePriority.activity);
      }
    }
    const finishing = current.arena && captures.find(({name, region, count}) =>
      count === 0 && arenaRegions[region].every(foe => foe === name || arenaCaptureCount(current, foe) > 0));
    if (finishing) {
      const {name,region} = finishing;
      const creation = areaCreations[Object.keys(arenaRegions).indexOf(region)];
      add(`arena-finish-${region}`, `Capture ${name} to finish the ${region} requirement for ${creation}.`,
        "View Arena goal", () => openArenaCreation(creation), guidePriority.activity);
    } else if (current.arena && captures.length) {
      const capture = captures.find(({count}) => count === 0) || captures[0];
      const {name,count} = capture;
      const text = count === 0 ? `No ${name} captured yet. Finish it with a Capture weapon.` :
        `${name} is still needed for your Arena goal (${count}/${arenaTarget}).`;
      add(`capture-${name}`, text, "Open Capture Assist", () => choose("status"), guidePriority.extra, 2500);
    }
    return suggestions;
  }

  const mark = trackedFiends[current.disc];
  if (mark?.name && hasCaptureData(current) && arenaCaptureCount(current, mark.name) < mark.goal &&
      huntReports(current, "here", mark.name, mark.goal).some(({spot}) => spot[2].includes(current.room))) {
    add(`hunt-spot-${mark.name}-${current.room}`, `${mark.name} appears in this area. Compare encounter spots.`,
      "Scout fiends", () => openArenaHunt({focus:mark.name}), guidePriority.activity, 1600);
  }
  if (progress) {
    const nearby = ffxMissables.filter(record =>
      // An unknown completion flag is not evidence of an uncollected pickup.
      (record.primer ? Number.isInteger(progress.primers) :
        record.flag ? typeof progress[record.flag] === "boolean" :
        record.key ? /^[\da-f]+$/i.test(progress.keyItems || "") && progress.keyItems.length >= (1 + (record.key >> 3)) * 2 :
        record.jecht != null ? Number.isInteger(progress.jechtSpheres) :
        record.trial != null && Number.isInteger(progress.trials)) &&
      record.rooms.includes(current.room) && missableState(current, record) === "Check now");

    const home = nearby.filter(record => record.group === "Home");
    const atDock = current.room === 303;
    if (atDock && home.length) {
      const text = home.length === 1 ? `Last chance at Home: ${home[0].name} is still missing.` :
        `Last chance at Home: ${home.length} Al Bhed Primers are still missing.`;
      add("home-last-chance", text, "Check missables", () => choose("missables", home[0].name), guidePriority.deadline);
    }
    for (const record of nearby) {
      const exactHomeRoom = homePrimerRooms[record.primer]?.includes(current.room);
      if (record.group === "Home" && (!exactHomeRoom || atDock)) continue;
      if (record.name === "Sun Crest" && current.room === 318) continue;

      const atPrimer = record.primer === 22 && bevellePassage.includes(current.room);
      const ahead = (record.primer === 22 && !atPrimer) || (record.flag === "wantz" && current.room === 259);
      const priority = ahead ? guidePriority.extra :
        record.permanent || record.gate ? guidePriority.deadline : guidePriority.activity;
      const text = record.flag === "wantz" ? "Speak to Wantz before leaving Mt. Gagazet." :
        record.primer === 22 ? atPrimer ? "Al Bhed Primer XXII is by the stairs in the Priests’ Passage." :
          "Ahead in the Priests’ Passage: Al Bhed Primer XXII." :
        record.name === "Sun Crest" ? "After Yunalesca, take the far stairs to reveal the Sun Crest." :
        record.permanent ? `Pick up ${record.name} before leaving ${record.group}.` :
        `${record.name} is still uncollected.`;
      const phase = ahead ? "-ahead" : "";
      add(`missable-${record.name}${phase}`, text, "Check missables",
        () => choose("missables", record.name), priority);
    }

    const players = progress.blitzball?.players;
    if (players) {
      const recruit = blitzRecruits.find(([name, , , , rooms]) =>
        rooms.includes(current.room) && (name !== "Brother" || current.story >= 2900) &&
        players[blitzPlayers.indexOf(name)]?.[0] === -1);
      if (recruit) {
        const [name] = recruit;
        add(`scout-${name}`, `${name} is nearby and available to sign.`,
          "Scout player", () => openBlitzView("scout", name), guidePriority.activity, 2500);
      }
    }

    const challengeData = progress.challenges;
    if (current.grid && challengeData) {
      const cactuarStage = challengeData.cactuarStage;
      const challenge = challengeHere(current.room) ||
        (cactuarStage === 25 && current.story >= 2900 && [199,200,202,277].includes(current.room) &&
          ffxChallenges.find(({id}) => id === "cactuars"));
      if (challenge && challengeSigil(current, challenge) === "Unclaimed" &&
          (current.story >= 2900 || (challenge.id === "lightning" && current.room === lightningActivity))) {
        const activeLightning = challenge.id === "lightning" && current.room === lightningActivity;
        const text = {
          lightning:"See your lightning record and track a fresh run.",
          chocobo:"Check your race record and how many balloons you need.",
          butterflies:"See the routes and mark off the Butterfly Catcher chests.",
          cactuars:cactuarStep(cactuarStage)[1]
        }[challenge.id];
        const stage = challenge.id === "cactuars" ? "-" + cactuarStage : "";
        add(`challenge-${challenge.id}${stage}`, text, "Open Challenges", () => openChallenges(challenge.id),
          activeLightning || (stage && cactuarStage > 0) ? guidePriority.activity : guidePriority.extra, 2500);
      }
    }
  }
  if (current.room === 307 && current.arena) {
    add("arena", "At the Monster Arena. See your captures and unlocks.",
      "Open Arena", () => choose("arena"), guidePriority.activity);
  }
  for (const record of earlyPickupReminders(current)) {
    const text = record.name === "Jecht Shot" ? "Check the blitzball on deck for a chance to learn Jecht Shot." :
      "Before leaving Besaid, check the shopkeeper’s dog for Valefor’s Energy Blast.";
    add(`side-pickup-${record.name}`, text, "Check missables", () => choose("missables", record.name),
      guidePriority.activity, 1800);
  }
  if (current.grid && current.room === 194 && current.story >= 2900 &&
      !ffxBit(progress?.keyItems, 3)) {
    add("endgame-route", "Free to explore. Check your next step toward Celestial weapons and the Arena.",
      "Open Endgame Route", () => choose("collections", "endgame"), guidePriority.extra, 5000);
  }
  if (current.room === 194 && current.story >= 2900 && Number.isInteger(progress?.destinations)) {
    const hidden = airshipDiscoveryRows(progress.destinations).filter(row => !row.discovered);
    if (hidden.length) add("airship-secrets", `${hidden.length} hidden airship ${hidden.length === 1 ? "destination" : "destinations"} left to unlock.`,
      "Open Airship Secrets", () => choose("collections", "airship"), guidePriority.activity, 3000);
  }
  if (current.fieldMap && ffxRoomRoutes[current.room]?.length) {
    add(`map-${current.room}`, "See the route and exits for this area.",
      "Open Map", () => choose("map"), guidePriority.extra, 8000);
  }
  return suggestions;
}

function createGuideSuggestions() {
  const candidates = new Map();
  const seen = new Map();
  let active = null;
  let expires = 0;
  let lastActivity = -Infinity;
  let lastShown = -Infinity;

  return {
    update(next, now, reading) {
      const available = new Map(next.map(suggestion => [suggestion.key, suggestion]));
      for (const key of candidates.keys()) if (!available.has(key)) candidates.delete(key);
      for (const key of available.keys()) {
        if (!candidates.has(key)) candidates.set(key, {since:now, shown:false});
      }

      if (active) active = now < expires ? available.get(active.key) || null : null;
      for (const [key, until] of seen) if (until <= now) seen.delete(key);
      const eligible = next.filter(({key, priority, wait}) => {
        const candidate = candidates.get(key);
        if (candidate.shown || seen.has(key) || now - candidate.since < wait) return false;
        if (active && priority <= active.priority) return false;
        if (priority === guidePriority.deadline) return true;
        if (reading) return false;
        if (priority >= guidePriority.timely) return true;
        if (priority === guidePriority.activity) return now - lastActivity >= 10000;
        return now - lastShown >= 60000;
      });
      eligible.sort((a,b) => b.priority - a.priority);
      if (eligible.length) {
        active = eligible[0];
        candidates.get(active.key).shown = true;
        const deadline = active.priority === guidePriority.deadline;
        expires = now + (deadline ? 24000 : 14000);
        seen.set(active.key, now + 240000);
        lastShown = now;
        if (active.priority >= guidePriority.activity) lastActivity = now;
      }
      return active;
    },
    dismiss() { active = null; },
    clear() {
      candidates.clear();
      active = null;
    }
  };
}
