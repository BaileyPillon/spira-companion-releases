"use strict";

const coachFocusLabels = {story:"Story", arena:"Arena captures", blitzball:"Blitzball", completion:"Completion"};
let coachFocus = "story";
let coachFollow = false;
let coachOptionsOpen = false;
let coachMoreOpen = false;
let coachReturn = null;
let coachNavigating = false;
let coachLastInteraction = 0;
let coachEpisode = 0;
let coachLastFrame = null;
const coachDismissed = new Set();
try {
  const saved = JSON.parse(localStorage.getItem("spira.coach.v1") || "{}");
  if (Object.hasOwn(coachFocusLabels, saved.focus)) coachFocus = saved.focus;
  coachFollow = saved.follow === true;
} catch { /* Keep defaults when storage is unavailable. */ }

function coachActivity(current) {
  if (current.battle) return "battle";
  if (current.disc === "SLPS-25088") {
    if ([212,347].includes(current.room)) return "blitz-menu";
    if ([62,121,124,125,355,356].includes(current.room)) return "blitz-match";
  }
  return "field";
}

// Only distinct, consecutive live frames can confirm a change. UI clicks cannot advance the timer.
function createActivityFollower(delay = 1200) {
  let identity, stable, candidate, since, timestamp, battles, story, blocked;
  function reset() { identity = stable = candidate = since = timestamp = battles = story = blocked = undefined; }
  return {
    reset,
    suppress() { blocked = candidate || stable; },
    update(current) {
      if (!current || current.paused || !current.disc) { reset(); return null; }
      const id = `${current.disc}/${current.crc || ""}`;
      const activity = coachActivity(current);
      const time = current.timestamp;
      if (!Number.isFinite(time)) { reset(); return null; }
      const changedSave = identity && (id !== identity || current.battles < battles || current.story < story || time < timestamp);
      const gap = timestamp != null && time - timestamp > 4000;
      if (identity == null || changedSave || gap) {
        identity = id; stable = candidate = activity; since = timestamp = time;
        battles = current.battles; story = current.story; blocked = undefined;
        return changedSave || gap ? {kind:"reset"} : null;
      }
      if (time === timestamp) return null;
      timestamp = time; battles = current.battles; story = current.story;
      if (activity !== candidate) { candidate = activity; since = time; }
      if (candidate === stable || time - since < delay) return null;
      stable = candidate;
      if (blocked === stable) return null;
      blocked = undefined;
      return {kind:"activity", activity:stable};
    }
  };
}
const coachFollower = createActivityFollower();

function coachRank(actions, focus) {
  const score = action => action.priority >= 100 ? action.priority + 1000 :
    Math.min(99, action.priority + (action.category === focus ? 25 : 0));
  return [...actions].sort((a,b) => score(b) - score(a) || a.id.localeCompare(b.id));
}

function coachSection(selector) {
  if (tab !== "status") choose("status");
  const section = panel.querySelector(selector);
  if (!section) return;
  if (section.tagName === "DETAILS") section.open = true;
  section.scrollIntoView({block:"start"});
}

function coachActions(current, focus = coachFocus) {
  if (!current?.disc) return [];
  const actions = [];
  const add = (id, title, detail, label, open, priority, category) =>
    actions.push({id,title,detail,label,open,priority,category});
  if (current.battle) {
    const boss = current.game === "x" && current.enemies?.find(foe => foe.hp > 0 && [119,120,126,129,130,142].includes(foe.id));
    const bossId = boss?.id === 129 && boss.maxHp === 60000 ? 130 : boss?.id;
    const bossTip = boss && ffxBossAdvice(current, {...boss,id:bossId});
    // Zombie is protective against Yunalesca's Mega Death; generic recovery must not undo that strategy.
    for (const advice of battleTactics(current)) {
      const targets = advice.targets.filter(([,reason]) => !(bossId === 130 && reason === "Zombie"));
      if (!targets.length || !advice.stock) continue;
      const critical = targets.some(([,reason]) => ["KO","Petrify"].includes(reason));
      const hurt = targets.some(([,reason]) => reason === "low HP");
      add(`recovery-${advice.name}-${targets.map(pair => pair.join(":" )).join("/")}`, `${advice.name} can help ${targets.map(([name]) => name).join(" and ")}`,
        `${advice.stock} in stock. ${targets.map(([name,reason]) => `${name}: ${reason}`).join(" · ")}.`,
        "Show recovery options", () => coachSection(".battle-tactics"), critical ? 110 : hurt ? 100 : 65, "battle");
    }
    const phaseFight = bossId === 130 || bossId === 142;
    if (bossTip) add(`boss-${bossId}`, bossTip[0], bossTip[1], bossTip[0] === "Mix Sunburst" ? "Open Sunburst recipe" : phaseFight ? "Open story boss coach" : "Show fight details",
      () => bossTip[0] === "Mix Sunburst" ? choose("mix","Sunburst") : phaseFight ? openLiveBossCoach() : coachSection(".encounter-guide"),
      bossTip[0] === "Use an Al Bhed Potion" ? 115 : bossId === 130 ? 105 : 90, "battle");
    if (current.grid && hasCaptureData(current)) {
      const target = huntBattleTargets(current)[0];
      if (target && captureRoster(current).length) {
        const ready = captureRoster(current).filter(member => member.ready);
        add(`capture-${target.name}`, ready.length ? `Finish ${target.name} with Capture` : `Get a Capture weapon ready for ${target.name}`,
          `${target.count}/${arenaTarget} captured. ${ready.length ? `${ready.map(member => member.name).join(", ")} can make the finishing hit.` :
            "Your Capture weapon owners are unequipped, in reserve, or unable to act."}`,
          "Show Capture Assist", () => coachSection(".hunt-assist"), 75, "arena");
      }
    }
    if (!actions.length) {
      const selected = current.enemies?.find(foe => foe.hp > 0 && foe.targeted);
      if (selected) add("target", `Check ${battleEnemyName(current,selected)} before committing`,
        `${selected.hp.toLocaleString()} HP remaining. Review the selected target's effects and available reference information.`,
        "Show selected target", () => coachSection(".battle-targets"), 20, "battle");
    }
    return coachRank(actions,focus);
  }
  if (current.disc === "SLPS-25088") {
    for (const tip of guideSuggestionsFor(current, typeof lightningActivity === "undefined" ? null : lightningActivity)) {
      if (tip.key === "map" || tip.key.startsWith("map-")) continue;
      const category = /^(blitz|scout)/.test(tip.key) ? "blitzball" : /^(hunt|arena|capture)/.test(tip.key) ? "arena" : "completion";
      add(tip.key,tip.text,"Based on your current location and recorded progress.",tip.label,tip.open,
        tip.priority === guidePriority.deadline ? 120 : tip.priority * 17,category);
    }
    if (focus === "arena" && hasCaptureData(current)) {
      const tracked = trackedFiends[current.disc];
      const remaining = tracked && arenaCaptureCount(current,tracked.name);
      add("arena-focus", tracked ? `Hunt ${tracked.name}` : "Find the next captures for your Arena goal",
        tracked ? `${remaining ?? "?"}/${tracked.goal} recorded. Scout encounter spots and what the capture unlocks.` :
          `Compare encounter spots for your target of ${arenaTarget} captures per species.`,
        "Open encounter scout", () => openArenaHunt(tracked ? {focus:tracked.name} : {}), 55, "arena");
    }
    if (focus === "blitzball" && current.progress?.blitzball?.players) {
      const reward = blitzballProgress(current)?.find(row => !row.earned);
      add("blitz-focus", reward ? `Work toward ${reward.name}` : "Plan your next Blitzball lineup",
        reward ? `Next unearned reward in the ${reward.event.toLowerCase()} sequence. Check the saved prize list before committing to matches.` :
          "Compare your current roster with unsigned players at their saved levels.",
        reward ? "Check prizes" : "Build my team", () => openBlitzView(reward ? "rewards" : "team"), 55, "blitzball");
    }
    if (focus === "completion" && current.story >= 2900 && current.grid) {
      const next = endgameRoute(current).find(step => !step.done);
      if (next) add("completion-focus",next.name,next.detail,"Open completion step",next.open,55,"completion");
    }
  }
  if (current.game === "x2" && current.chapter) {
    if (current.disc === "SLUS-20672" && current.chapter === 5 && current.room === 249)
      add("new-cave-walls","Solve the next wall","Use your earlier codes and both on-screen clues.","Open wall solver",() => choose("plan-walls"),76,"completion");
    if(typeof x2SceneAudit==="function"&&[206,259].includes(current.room)){
      const rows=x2SceneAudit(current)?.filter(scene=>!scene.conditional&&scene.chapter===current.chapter);
      const pending=rows&&x2GroupSceneChecks(rows).filter(scene=>!scene.done);
      if(pending?.length)add("x2-scene-audit","Review scene checks before the next mission",
        `${pending.length} scene checks still have unrecorded flags. Review their locations and timing before advancing.`,"Review scenes",()=>{sceneAuditChapter=0;sceneAuditMissing=true;choose("chapter-checklist");panel.querySelector(".scene-audit")?.setAttribute("open","");},85,"completion");
    }
    const deadline = current.loadout && x2DressphereHunt(current).find(row => row.state === "Chapter deadline");
    if (deadline) add("x2-dressphere","Check dressphere deadlines before ending this chapter",
      "The current chapter still has an uncollected dressphere route to review.","Open Dressphere Hunt",openX2DressphereHunt,100,"completion");
  }
  const objective = typeof fieldObjective === "function" ? fieldObjective(current) : storyHint(current);
  if (objective) add("story","Continue the journey",objective,current.game === "x" ? "Open walkthrough" : "Open chapter checklist",
    () => current.game === "x" ? choose("guide") : openX2ChapterChecklist(),20,"story");
  return coachRank(actions,focus);
}

function observeCoachSession(current) {
  const before = coachLastFrame;
  if (!current || before && (current.disc !== before.disc || current.crc !== before.crc ||
      current.story < before.story || current.battles < before.battles || current.timestamp < before.timestamp ||
      current.timestamp - before.timestamp > 4000)) {
    coachDismissed.clear(); coachEpisode++;
  }
  if (current?.battle && !before?.battle) coachEpisode++;
  coachLastFrame = current;
}
function coachContext(current) {
  return `${current.disc}/${current.room}/${current.story}/${current.battle ? `${current.battles}-${coachEpisode}` : "field"}`;
}
function rememberCoachUi() {
  const settings = panel.querySelector(".coach-settings");
  const more = panel.querySelector(".coach-more");
  const fight = panel.querySelector("details.encounter-guide");
  if (settings) coachOptionsOpen = settings.open;
  if (more) coachMoreOpen = more.open;
  if (fight) battleReferenceOpen = fight.open;
}
function saveCoachSettings() {
  try { localStorage.setItem("spira.coach.v1",JSON.stringify({focus:coachFocus,follow:coachFollow})); }
  catch { /* Keep the session settings. */ }
}
function coachSettings() {
  const settings = element("details","coach-settings");
  settings.open = coachOptionsOpen;
  settings.append(element("summary","",`Live coach · ${coachFocusLabels[coachFocus]}${coachFollow ? " · Follow Game on" : ""}`));
  settings.addEventListener("toggle", () => { if (settings.isConnected) coachOptionsOpen = settings.open; });
  const label = element("label","coach-focus");
  label.append("What are you working on?", options("Live coach focus",Object.entries(coachFocusLabels),coachFocus,value => {
    coachFocus = value; saveCoachSettings(); signature = ""; render();
    panel.querySelector('[aria-label="Live coach focus"]')?.focus({preventScroll:true});
  }));
  const checkbox = element("input"); checkbox.type = "checkbox"; checkbox.checked = coachFollow;
  checkbox.addEventListener("change", () => {
    coachFollow = checkbox.checked; abandonCoachReturn(); coachFollower.reset();
    if (state === "live") coachFollower.update(frame);
    saveCoachSettings(); signature = ""; render();
  });
  const follow = element("label","prep-choice"); follow.append(checkbox,"Follow Game automatically");
  settings.append(label,follow,element("p","field-note",
    "Open live battle advice or FFX Blitzball tools when play changes, then return to your previous view. Choosing another tab cancels that return. Recent reading or input takes priority. Off by default."));
  return settings;
}

function showLiveCoach(current) {
  const section = element("section","live-coach");
  section.setAttribute("aria-label","Live coach");
  if (reconnecting || current.paused) {
    section.append(element("p","field-note",reconnecting ? "Waiting for a fresh frame before giving live advice." : "Game paused. Live coaching resumes with play."),coachSettings());
    panel.append(section); return;
  }
  const context = coachContext(current);
  const actions = coachActions(current).filter(item => !coachDismissed.has(`${context}/${item.id}`));
  const lead = actions[0];
  if (lead) {
    section.dataset.priority = lead.priority >= 100 ? "urgent" : "normal";
    section.append(element("h2","",lead.title),element("p","coach-reason",lead.detail));
    const buttons = element("div","filters");
    buttons.append(action(lead.label,lead.open,true),action("Hide this tip",() => {
      if (coachDismissed.size > 256) coachDismissed.clear();
      coachDismissed.add(`${context}/${lead.id}`); signature = ""; render();
    }));
    section.append(buttons);
    if (actions.length > 1) {
      const more = element("details","coach-more"); more.open = coachMoreOpen;
      more.append(element("summary","",`${Math.min(actions.length-1,3)} other ${actions.length === 2 ? "opportunity" : "opportunities"}`));
      more.addEventListener("toggle",() => { if (more.isConnected) coachMoreOpen = more.open; });
      for (const item of actions.slice(1,4)) {
        const row = entry(item.title,"",item.detail); row.append(action(item.label,item.open)); more.append(row);
      }
      section.append(more);
    }
  } else section.append(element("p","field-note","No new action to flag from the current feed. Your live details are below."));
  section.append(coachSettings());
  panel.append(section);
  return lead?.id;
}

function abandonCoachReturn() {
  const back = coachReturn;
  coachReturn = null;
  if (back?.ownsGuideDetour) {
    guideDetour = false; guideReturnPending = false;
    guideHost.classList.remove("guide-detour");
  }
}
function coachManualNavigation() {
  if (coachNavigating) return;
  abandonCoachReturn();
  coachFollower.suppress();
}
function coachNavigate(callback) {
  coachNavigating = true;
  try { callback(); } finally { coachNavigating = false; }
}
function coachRestore() {
  const back = coachReturn;
  coachReturn = null;
  if (!back) return;
  if (back.tab === "guide") guideReturnPending = back.fullscreen;
  if (back.tab === "blitzball") blitzView = back.blitzView;
  signature = "";
  coachNavigate(() => choose(back.tab));
  if (back.tab !== "guide") panel.scrollTop = back.scroll;
}

function updateLiveCoach(current) {
  observeCoachSession(current);
  if (!coachFollow) { coachFollower.reset(); return; }
  if (!current || current.paused) { abandonCoachReturn(); coachFollower.reset(); return; }
  if (tab === "glance" || (typeof shellDialog !== "undefined" && (shellDialog.open || focusTab))) {
    coachFollower.reset(); return;
  }
  const event = coachFollower.update(current);
  if (event?.kind === "reset") { abandonCoachReturn(); return; }
  if (!event || !current) return;
  if (Date.now() - coachLastInteraction < 1800 || tab === "guide" && (guideBusy || !guideFollowing) ||
      document.activeElement?.matches("input,select,textarea") || ["setup","cheats"].includes(tab)) {
    abandonCoachReturn(); return;
  }
  if (event.activity === "field") { coachRestore(); return; }
  const destination = event.activity === "battle" ? "status" : "blitzball";
  const destinationView = event.activity === "blitz-menu" ? "team" : "live";
  if (tab === destination && (destination === "status" || blitzView === destinationView)) return;
  if (!coachReturn) {
    coachReturn = {tab,scroll:panel.scrollTop,fullscreen:document.body.classList.contains("guide-fullscreen"),blitzView,
      ownsGuideDetour:tab === "guide" && !guideDetour};
    if (tab === "guide") { guideDetour = true; guideHost.classList.add("guide-detour"); }
  }
  if (destination === "status") coachNavigate(() => choose("status"));
  else coachNavigate(() => openBlitzView(destinationView));
}

function coachReturnAction() {
  if (!coachReturn) return;
  const label = nav.find(button => button.dataset.tab === coachReturn.tab)?.textContent || coachReturn.tab;
  const bar = element("div","coach-return");
  bar.append(element("span","", "Follow Game"),action(`Return to ${label}`,() => {
    coachFollower.suppress(); coachRestore();
  }),action("Stay here",() => { abandonCoachReturn(); coachFollower.suppress(); signature = ""; render(); }));
  panel.prepend(bar);
}

if (typeof document !== "undefined") {
  for (const event of ["pointerdown","keydown","wheel","touchmove"]) document.addEventListener(event,() => {
    coachLastInteraction = Date.now();
  },{passive:true});
}
