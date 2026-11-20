"use strict";

// The tools in each row answer a related question when the game supplies their data.
const fieldSections = {
  status:["Journey", "journal","guide","party"], glance:["Journey","status","map","journal"],
  guide:["Journey","missables","chapter-checklist","trials","journal"], map:["Journey","guide","arena","journal","chapter-checklist"],
  journal:["Journey","status","guide","planner","chapter-checklist"], workspace:["Companion","profiles","journal","planner"],
  planner:["Completion","arena","collections","grid-lab"], "grid-lab":["Party and training","grid","planner"],
  "battle-lab":["Battle","prep","equip","party"], party:["Party and training","equip","grid","plan-lessons"],
  supplies:["Party and training","plan-ledger","mix","equip"], equip:["Party and training","party","prep","plan-workshop","plan-lessons"],
  mix:["Battle","supplies","bestiary","plan-reserves"], grid:["Party and training","grid-lab","supplies","party"],
  arena:["Fiends and fieldwork","plan-circuit","bestiary","planner"], bestiary:["Fiends and fieldwork","arena","plan-bribes","supplies"],
  "x2-bestiary":["Fiends and fieldwork","field-guide","plan-sweep","plan-bullets"],
  "field-guide":["Fiends and fieldwork","x2-bestiary","plan-bullets","plan-sweep"],
  missables:["Completion","guide","collections","trials"], collections:["Completion","missables","challenges","blitzball"],
  prep:["Battle","battle-lab","equip","plan-phase"], blitzball:["Sidequests","collections","map"],
  challenges:["Sidequests","collections","plan-remiem","plan-ciphers","plan-walls"],
  trials:["Journey","map","missables","guide"], "chapter-checklist":["Completion","plan-errands","plan-mascot","plan-bookmark"],
  setup:["Companion","profiles","status"], profiles:["Companion","workspace","journal","setup"],
  cheats:["Companion","setup","profiles"]
};
// Prefer the same verbs players see in each tool. Unavailable actions drop out on the current save.
const preferredLandmarks = {
  status:["Open walkthrough","Review scenes","Front line","Open field map"], glance:["Front line","Next objective","Turn order"],
  guide:["Contents","Pause follow","Choose walkthrough"], workspace:["Pinned","Playthrough notes","Search everything"],
  party:["Formation","Learned commands","Experience"], supplies:["Search inventory","Items and spheres","Inventory","Farming ledger"],
  equip:["Compare gear","Customize","Party dressphere mastery","Garment Grid gates"],
  prep:["Fight or goal","Materials for this party","Fight plan"], mix:["Explore Mix by effect","Pinned recipes","Check two ingredients"],
  grid:["Find an ability or node","Grid node","Read the symbols"], arena:["Capture atlas","Hunt","Creations"],
  bestiary:["Search fiend or item","Item sources","Gear Drops"], "x2-bestiary":["Search Bestiary","Encounter area","Fiend index page"],
  "field-guide":["Tracker","Gun Mage","Via Infinito floor sweep"], map:["Follow player","Exits","Previous area"],
  journal:["My checkpoint","Next time I play","Observed route"], setup:["The controller is on the wrong screen","Gameplay options","Playthrough profiles and backups"],
  missables:["Anima temple treasures"], collections:["Primer shelf","Read an Al Bhed phrase","Collection","Missing only"], blitzball:["Live match","Team Builder","Rewards"],
  challenges:["Challenge","Practice Sphere Break","Sphere Break","Chocobo Ranch","Remiem race navigator"], trials:["Temple","Open walkthrough"],
  "chapter-checklist":["Chapter review","Destination board","Missing-scene diagnosis and chapter exit check","Checklist chapter"],
  profiles:["Playthrough profile","Backup and restore"], cheats:["Cheat target","Set amount"],
  planner:["Choose goals and party","Open next step","Additional item targets"], "grid-lab":["Saved builds","Copy current grid"],
  "battle-lab":["Target","Battle comparison"], "plan-phase":["Fight","Battle stage"], "plan-remiem":["Race prize","Back to start"],
  "plan-walls":["Cave clear","Wall","Record checkpoint totals or a known code"], "plan-accuracy":["Opponent","Hit goal","Aim stacks"],
  "plan-mascot":["Show regions","Besaid outcome"], "plan-celestial":["Weapon owner"], "plan-ciphers":["Cipher door","Digit 1"],
  "plan-circuit":["Captures per species","Inspect hunting area"], "plan-errands":["Chapter to visit","Story branch"],
  "plan-workshop":["Auto-ability","Set quantity"], "plan-bribes":["Bribe item"], "plan-reserves":["Desired Mix","Ingredient to keep"],
  "plan-bookmark":["Bookmark this save"], "plan-bullets":["Gun Mage abilities"], "plan-sweep":["Starting floor","Ending floor"],
  "plan-lessons":["Training shortlist"], "plan-ledger":["Start comparison here"]
};
// Only these actions perform navigation directly. Other matches focus their real controls.
const indexNavigation = {
  status:["Open walkthrough","Review scenes","Open field map"], equip:["Compare gear","Customize"],
  arena:["Capture atlas","Hunt","Creations"], bestiary:["Item sources","Gear Drops"],
  blitzball:["Live match","Team Builder","Rewards"], challenges:["Sphere Break","Chocobo Ranch","Remiem race navigator"],
  supplies:["Farming ledger"], "field-guide":["Via Infinito floor sweep"], trials:["Open walkthrough"]
};
function sectionParent(key) { return fieldPlanFor(key)?.parent || key; }
function sectionRelations(key) {
  const parent = sectionParent(key);
  return [...new Set([...(parent !== key ? [parent] : []),...fieldPlans.filter(p=>p.parent===parent).map(p=>p.tab),
    ...(fieldSections[parent] || []).slice(1)])].filter(k=>k!==key);
}
let walkthroughHeadings = [];
const navigationTrail = [];
let historyGame = "";
let retracing = false;
// Keep the reading context of views reached from several different entry points.
// User edits, pins, tracking targets and the live frame stay outside history.
function restoreSectionFilters(key) {
  switch (key) {
    case "arena": {
      const values=[arenaView,arenaRegion,arenaCreation,arenaTarget,arenaMissingOnly,atlasPlace,atlasMissing,huntScope,huntFiend];
      return ()=>{[arenaView,arenaRegion,arenaCreation,arenaTarget,arenaMissingOnly,atlasPlace,atlasMissing,huntScope,huntFiend]=values;};
    }
    case "bestiary": {
      const values=[bestiaryMode,bestiaryQuery,bestiaryArea,bestiarySource,bestiaryBribeTarget];
      const page=fiendPages.get("x");
      return ()=>{[bestiaryMode,bestiaryQuery,bestiaryArea,bestiarySource,bestiaryBribeTarget]=values; fiendPages.set("x",page);};
    }
    case "x2-bestiary": {
      const values=[x2BestiaryArea,x2BestiaryQuery,x2BestiaryTarget];
      const page=fiendPages.get("x2");
      return ()=>{[x2BestiaryArea,x2BestiaryQuery,x2BestiaryTarget]=values; fiendPages.set("x2",page);};
    }
    case "field-guide": {
      const values=[x2FieldMode,x2FieldQuery,x2FieldMissing,x2ManualOnly,x2InfinitoFloor,x2BlueMember];
      return ()=>{[x2FieldMode,x2FieldQuery,x2FieldMissing,x2ManualOnly,x2InfinitoFloor,x2BlueMember]=values;};
    }
    case "blitzball": {
      const values=[blitzView,blitzSearch,focusedBlitzRecruit,blitzEditingSlot];
      return ()=>{[blitzView,blitzSearch,focusedBlitzRecruit,blitzEditingSlot]=values;};
    }
    case "equip": {
      const values=[equipmentView,ffxCharacter,x2Member,x2Collection,x2Search,x2ApJob];
      return ()=>{[equipmentView,ffxCharacter,x2Member,x2Collection,x2Search,x2ApJob]=values;};
    }
    case "collections": {
      const values=[collectionGroup,collectionMissingOnly];
      return ()=>{[collectionGroup,collectionMissingOnly]=values;};
    }
    case "grid": {
      const values=[ffxCharacter,selectedGridNode,gridFocus];
      return ()=>{[ffxCharacter,selectedGridNode,gridFocus]=values;};
    }
    default: return null;
  }
}
function rememberSection(previous,next,current) {
  if (retracing || previous === next || previous === "glance" || next === "glance") return;
  const game = current?.game || "";
  const details = [...panel.querySelectorAll("details[open]")].map(detailKey).filter(Boolean).slice(0,70);
  navigationTrail.push({tab:previous,game,scroll:panel.scrollTop,details,restore:restoreSectionFilters(previous)});
  if (navigationTrail.length>24) navigationTrail.shift();
}
function previousSection() {
  const rows = availableShellTools(shellCurrent);
  for (let i=navigationTrail.length-1;i>=0;i--) {
    const step=navigationTrail[i];
    if (step.tab!==tab && step.game===(shellCurrent?.game || "") && rows.some(r=>r.tab===step.tab)) return i;
  }
  return -1;
}
function syncPreviousSection() {
  if (shellCurrent?.game) {
    if (historyGame && historyGame !== shellCurrent.game) navigationTrail.length=0;
    historyGame=shellCurrent.game;
  }
  const back=document.getElementById("section-back");
  const i=previousSection();
  back.hidden=i<0;
  if (i>=0) back.title="Return to "+(workspaceTools.find(r=>r.tab===navigationTrail[i].tab)?.name || "previous tool");
}
function goToPreviousSection() {
  const i=previousSection();
  if (i<0) return;
  const step=navigationTrail[i];
  navigationTrail.splice(i);
  retracing=true;
  try {
    step.restore?.();
    if (step.tab==="guide" && guideDetour) guideReturnPending=true;
    choose(step.tab);
  } finally { retracing=false; }
  if (step.tab!=="guide") {
    const keys=new Set(step.details);
    for (const detail of panel.querySelectorAll("details")) if (keys.has(detailKey(detail))) detail.open=true;
    panel.scrollTop=step.scroll;
    panel.focus({preventScroll:true});
  }
  syncPreviousSection();
}

function pageLandmarks() {
  if (tab==="guide" && guideReady) return walkthroughHeadings.map(([id,label])=>({id,label}));
  const root=tab==="guide" ? guideHost : panel;
  const selector="h1,h2,h3,summary,.entry > strong,.visit > span,label > textarea,select[aria-label],input[aria-label],button";
  const counts=new Map();
  const rows=[];
  for (const node of root.querySelectorAll(selector)) {
    if (node.closest("[hidden]") || node.disabled || node.closest("canvas")) continue;
    const label=(node.getAttribute("aria-label") || node.textContent || "").replace(/\s+/g," ").trim();
    if (!label || label.length>185) continue;
    const forRow=node.closest(".entry");
    const source=forRow?.querySelector("strong")?.textContent.trim();
    const title=source && source!==label ? source+" · "+label : label;
    const kind=node.tagName;
    const base=kind+"/"+title;
    const ordinal=counts.get(base) || 0;
    counts.set(base,ordinal+1);
    const major=["H1","H2","H3","SUMMARY"].includes(kind);
    rows.push({id:base+"/"+ordinal,label:title,node,major});
  }
  return rows;
}
function jumpLandmark(id,activate=false) {
  const row=pageLandmarks().find(r=>r.id===id);
  if (!row) { drawFieldIndex(); return; }
  shellDialog.close();
  if (!row.node) { openGuideSection(id); return; }
  const node=row.node;
  for (let parent=node.parentElement;parent && parent!==panel;parent=parent.parentElement) {
    if (parent.tagName==="DETAILS") parent.open=true;
  }
  if (node.tagName==="SUMMARY") node.parentElement.open=true;
  if (activate && node.tagName==="BUTTON" && indexNavigation[tab]?.includes(row.label)) {
    node.click(); panel.focus({preventScroll:true}); return;
  }
  if (node.tabIndex<0) node.tabIndex=-1;
  node.focus({preventScroll:true});
  node.scrollIntoView({block:"center"});
}
let editingSectionShortcut=false;
function shortcutKey() { return "spira.section-jump."+(shellCurrent?.game || "companion")+"."+tab; }
function sectionShortcutControls(candidates) {
  const box=element("div","personal-jump");
  const saved=readCompanionSetting(shortcutKey(),null);
  const match=saved && candidates.find(r=>r.id===saved.id && r.label===saved.label);
  if (saved?.label && !editingSectionShortcut) {
    const jump=action("My shortcut · "+saved.label,()=>jumpLandmark(saved.id));
    jump.disabled=!match;
    jump.setAttribute("aria-label","My shortcut · "+saved.label);
    box.append(jump);
    if (!match) box.append(element("small","field-note","Available when this section is on the page."));
  }
  const edit=action(editingSectionShortcut ? "Cancel selection" : saved ? "Change shortcut" : "Set a shortcut",()=>{
    editingSectionShortcut=!editingSectionShortcut;
    document.querySelector("#field-index-query").value=""; drawFieldIndex();
    document.querySelector(".personal-jump .shortcut-edit")?.focus({preventScroll:true});
  });
  edit.classList.add("shortcut-edit"); box.append(edit);
  if (saved && editingSectionShortcut) box.append(action("Remove shortcut",()=>storeSectionShortcut(null)));
  return box;
}
function storeSectionShortcut(row) {
  const feedback=document.querySelector("#section-jump-feedback");
  if (!saveCompanionSetting(shortcutKey(),row ? {id:row.id,label:row.label} : null)) {
    feedback.textContent="Could not save the shortcut."; return;
  }
  editingSectionShortcut=false;
  document.querySelector("#field-index-query").value=""; drawFieldIndex();
  feedback.textContent=row ? "Shortcut saved." : "Shortcut removed.";
  document.querySelector(".personal-jump button")?.focus({preventScroll:true});
}
function drawFieldIndex() {
  const list=document.querySelector("#field-index-results");
  if (!list) return;
  const text=workspaceWords(document.querySelector("#field-index-query").value);
  const words=text.split(" ").filter(Boolean);
  const match=label=>words.every(w=>workspaceWords(label).includes(w));
  const candidates=pageLandmarks();
  const rows=candidates.filter(r=>match(r.label)).sort((a,b)=>Number(!!b.major)-Number(!!a.major));
  const seen=new Set();
  const personal=tab!=="guide" && tab!=="cheats";
  const saved=personal && !editingSectionShortcut ? readCompanionSetting(shortcutKey(),null) : null;
  const unique=rows.filter(row=>{
    if (!text && row.id===saved?.id && row.label===saved.label) return false;
    const key=row.node ? row.label : row.id;
    return !seen.has(key) && seen.add(key);
  });
  list.replaceChildren();
  if (personal) list.append(sectionShortcutControls(candidates));
  const tools=availableShellTools(shellCurrent);
  const related=sectionRelations(tab).map(id=>tools.find(r=>r.tab===id)).filter(Boolean)
    .filter(r=>match(r.name+" "+r.detail));
  const preferred=[];
  if (!text && !editingSectionShortcut) {
    for (const title of preferredLandmarks[tab] || []) {
      const row=unique.find(r=>r.label===title || r.node?.tagName==="SUMMARY" && r.label.startsWith(title+" "));
      if (row && !preferred.includes(row)) preferred.push(row);
    }
    if (preferred.length) {
      const shortcuts=element("div","related-links index-shortcuts");
      for (const row of preferred) shortcuts.append(action(row.label,()=>jumpLandmark(row.id,true)));
      list.append(element("h3","","Quick jumps"),shortcuts);
    }
  }
  const rest=unique.filter(r=>!preferred.includes(r));
  if (related.length && !editingSectionShortcut) {
    const links=element("div","related-links");
    for (const tool of related) links.append(action(tool.name,()=>openShellDestination(tool)));
    list.append(element("h3","","Related tools"),links);
  }
  list.append(element("h3","",editingSectionShortcut ? "Choose your shortcut" : tab==="guide" && guideReady ? "Walkthrough sections" : "On this screen"));
  const resultBox=element("div","section-links");
  let offset=0;
  const more=action("More results",()=>append(true));
  function append(focus) {
    const start=offset;
    for (const row of rest.slice(start,start+18)) resultBox.append(action(row.label,()=>{
      if (editingSectionShortcut) storeSectionShortcut(row); else jumpLandmark(row.id);
    }));
    offset=resultBox.children.length;
    more.hidden=offset>=rest.length;
    if (focus) resultBox.children[start]?.focus({preventScroll:true});
  }
  append(false);
  list.append(resultBox,more);
  if (!unique.length && (text || !saved)) list.append(element("p","field-note",text ? "No matching entry on this screen." : "The current view has no additional entries."));
}
function openFieldIndex() {
  editingSectionShortcut=false;
  dialogPage="index";
  dialogHeader("Page index");
  shellDialog.querySelector(".dialog-heading button").before(action("All tools",openToolLibrary));
  const input=element("input","workspace-search");
  input.id="field-index-query"; input.type="search"; input.placeholder="Find a section or control";
  input.setAttribute("aria-label","Find on this page");
  const list=element("div","tool-sections"); list.id="field-index-results";
  const feedback=element("p","field-note"); feedback.id="section-jump-feedback"; feedback.setAttribute("role","status");
  shellDialog.append(input,feedback,list);
  input.addEventListener("input",drawFieldIndex);
  drawFieldIndex();
  if (!shellDialog.open) shellDialog.showModal();
  shellDialog.querySelector(".dialog-heading button:last-child").focus({preventScroll:true});
}
function initFieldIndex() {
  document.getElementById("section-index").addEventListener("click",openFieldIndex);
  document.getElementById("glance-index").addEventListener("click",openFieldIndex);
  document.getElementById("section-back").addEventListener("click",goToPreviousSection);
}
