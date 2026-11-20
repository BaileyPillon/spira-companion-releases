"use strict";

let shadeTimer, lastShadeMode = "";
function resetGlanceShade() {
  clearTimeout(shadeTimer);
  if (tab !== "glance" || !displayPrefs.shade || shellDialog.open || document.hidden || !document.querySelector("#glance-shade").hidden) return;
  shadeTimer = setTimeout(shadeGlance,displayPrefs.shade * 1000);
}
function shadeGlance() {
  if (tab !== "glance" || shellDialog.open || document.hidden) return;
  const shade = document.querySelector("#glance-shade");
  shade.hidden = false; shade.focus({preventScroll:true});
  document.querySelector(".layout").inert = true;
  document.querySelector("#glance-toolbar").inert = true;
}
function wakeGlance(focus = true) {
  const shade = document.querySelector("#glance-shade");
  shade.hidden = true;
  document.querySelector(".layout").inert = false;
  document.querySelector("#glance-toolbar").inert = false;
  if (focus) document.querySelector("#glance-dim").focus({preventScroll:true});
  resetGlanceShade();
}
function syncGlanceShade(full) {
  document.querySelector("#glance-toolbar").hidden = !full;
  const mode = full ? String(displayPrefs.shade) : "";
  if (lastShadeMode === mode) return;
  lastShadeMode = mode;
  if (!full && !document.querySelector("#glance-shade").hidden) wakeGlance(false);
  resetGlanceShade();
}
function exitGlance() {
  const restore = shellCurrent?.game === glanceOrigin.game && availableShellTools(shellCurrent).some(row => row.tab === glanceOrigin.tab);
  const target = restore ? glanceOrigin.tab : "status";
  if (target === "guide" && guideDetour) guideReturnPending = true;
  choose(target);
  if (restore && target !== "guide") panel.scrollTop = glanceOrigin.scroll;
  if (target !== "guide") panel.focus({preventScroll:true});
}
function initGlanceControls() {
  document.querySelector("#glance-exit").addEventListener("click",exitGlance);
  document.querySelector("#glance-dim").addEventListener("click",shadeGlance);
  document.querySelector("#glance-shade").addEventListener("click",() => wakeGlance());
  document.addEventListener("pointerdown",resetGlanceShade,{passive:true});
  document.addEventListener("wheel",resetGlanceShade,{passive:true});
  document.addEventListener("visibilitychange",resetGlanceShade);
  document.addEventListener("keydown",event => {
    if (!document.querySelector("#glance-shade").hidden) {
      event.preventDefault(); event.stopImmediatePropagation(); wakeGlance(); return;
    }
    if (event.key === "Escape" && !shellDialog.open && (focusTab || tab === "glance")) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (focusTab) { focusTab = ""; syncDisplay(shellCurrent); } else exitGlance();
      return;
    }
    resetGlanceShade();
  },true);
}
function glanceSignature(current,retry) {
  if (!current) return null;
  return [retry,current.game,current.room,current.disc,current.story,current.chapter,current.battle,current.paused,
    current.progress?.wantz,current.turnOrder?.slice(0,4),current.enemies?.map(e => [e.id,e.slot,e.name,e.battleId,e.hp,e.maxHp,e.targeted]),
    current.party.filter(m => m?.active).map(m => [m.id,m.name,m.hp,m.maxHp,m.mp,m.maxMp,m.job,current.loadout?.dressphereInfo?.[m.job - 0x5000]?.[0],m.overdrive,m.overdriveMax,m.statusBits,m.statusTimed])];
}
function glanceParty(current) {
  const party = element("section","glance-party");
  party.append(element("h2","","Front line"));
  const roster = current.party.filter(m => m?.active && Number.isInteger(m.id));
  for (const m of roster) {
    const row = element("div","glance-member");
    const label = element("div","glance-name");
    label.append(element("strong","",partyName(current,m)));
    const effects = statusEffects(current.game,m);
    const detail = effects || (current.game === "x2" && Number.isInteger(m.job) ? x2JobName(current.loadout?.dressphereInfo,m.job) :
      m.overdriveMax > 0 && m.overdrive === m.overdriveMax ? "Overdrive ready" : "");
    if (detail) label.append(element("small",effects ? "glance-effect" : "",detail));
    row.append(label);
    for (const [key,max,title] of [["hp","maxHp","HP"],["mp","maxMp","MP"]]) {
      if (Number.isInteger(m[key]) && m[max] > 0) row.append(metric(title,m[key],m[max]));
    }
    party.append(row);
  }
  if (!roster.length) party.append(element("p","field-note","Waiting for the active party."));
  return party;
}
function glanceTurns(current) {
  const block = element("section","glance-turns");
  block.append(element("h2","","Turn order"));
  const list = element("ol");
  for (const [index,id] of current.turnOrder.slice(0,4).entries()) {
    const name = xTurnName(current,id);
    const item = element("li");
    item.append(element("small","",index === 0 ? "Now" : String(index + 1)),element("strong","",name));
    list.append(item);
  }
  block.append(list);
  return block;
}
function drawGlance(current,feedState) {
  const badge = document.querySelector("#glance-connection");
  badge.dataset.state = feedState; badge.textContent = states[feedState] || feedState;
  if (!current) {
    heading("Glance","Open a supported game to see the live party and location.");
    return;
  }
  const hero = element("section","glance-hero");
  hero.append(element("p","game-caption",catalog[current.game].title),
    element("h1","",roomName(current)),element("p","glance-context",current.battle ? "In battle" :
      current.game === "x2" && current.chapter ? "Chapter " + current.chapter : "Exploring"));
  panel.append(hero);
  if (current.battle) {
    const foes = (current.enemies || []).filter(e => e.hp > 0 && (current.game !== "x" || isFiend(ffxData.enemies[e.id])));
    const targets = foes.filter(isSelectedFoe);
    const shown = targets.length ? targets : foes.slice(0,1);
    if (shown.length) {
      const group = element("section","glance-target");
      group.append(element("h2","",targets.length ? "Selected target" + (targets.length > 1 ? "s" : "") : "Opponent"));
      for (const foe of shown) {
        const line = element("div","glance-enemy");
        line.append(element("strong","",battleEnemyName(current,foe)));
        if (foe.maxHp > 0) line.append(metric("HP",foe.hp,foe.maxHp));
        group.append(line);
      }
      panel.append(group);
    }
    if (current.game === "x" && current.turnOrder?.length) panel.append(glanceTurns(current));
  }
  panel.append(glanceParty(current));
  if (!current.battle) {
    const objective = fieldObjective(current);
    if (objective) {
      const next = element("section","glance-objective");
      next.append(element("h2","","Next objective"),element("p","",objective));
      panel.append(next);
    }
  }
}
