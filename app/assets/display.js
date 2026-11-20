"use strict";

const displayThemes = {auto:"Match the game",x:"Besaid blue",x2:"Gullwing rose",black:"OLED black",classic:"Original slate"};
const typeScales = [90,100,120,140,160,200];
const shadeDelays = [0,30,60,120];
const displayKey = "spira.display.v1";
const primaryViews = ["status","glance","guide","workspace"];
function displayPreferences(value) {
  return {
    theme:Object.hasOwn(displayThemes,value?.theme) ? value.theme : "auto",
    size:typeScales.includes(value?.size) ? value.size : 100,
    rail:value?.rail === "all" ? "all" : "short",
    wide:value?.wide === true,
    shade:shadeDelays.includes(value?.shade) ? value.shade : 0
  };
}
let displayPrefs = displayPreferences(readCompanionSetting(displayKey,{}));
let shellGame = "", lastPaletteGame = "x", shellCurrent = null, railSignature = "", dialogPage = "";
let focusTab = "", lastLayoutTab = "", glanceOrigin = {tab:"status",scroll:0}, recentViews = [];
const shellDialog = document.querySelector("#shell-dialog");
function canFocusTool(key) { return key !== "guide" && key !== "glance"; }
function recentKey(game) { return "spira.recent-tools." + game + ".v1"; }
function shellTheme(game) { return displayPrefs.theme === "auto" ? game || lastPaletteGame : displayPrefs.theme; }
function syncDisplay(current) {
  const game = current?.game || "";
  shellCurrent = current;
  if (game) lastPaletteGame = game;
  if (game !== shellGame) {
    shellGame = game;
    const stored = readCompanionSetting(recentKey(game),[]);
    recentViews = Array.isArray(stored) ? stored.filter(id => typeof id === "string" && id !== "cheats").slice(0,5) : [];
  }
  const root = document.documentElement;
  root.dataset.palette = shellTheme(game);
  root.dataset.game = game;
  root.toggleAttribute("data-large-type",displayPrefs.size >= 140);
  root.style.setProperty("--reading-scale",String(displayPrefs.size / 100));
  const full = tab === "glance";
  document.body.classList.toggle("glance-open",full);
  if (lastLayoutTab !== tab) {
    focusTab = displayPrefs.wide && canFocusTool(tab) ? tab : "";
    lastLayoutTab=tab;
  }
  document.body.classList.toggle("visual-focus",!!focusTab);
  const focus = document.querySelector("#focus-view");
  focus.hidden = !canFocusTool(tab);
  document.querySelector("#focus-index").hidden = !focusTab;
  document.querySelector(".identity span").textContent = focusTab ? workspaceTools.find(row=>row.tab===tab)?.name || (tab==="cheats" ? "Cheats" : "Spira Companion") : "Spira Companion";
  focus.textContent = focusTab ? "Exit focus" : "Focus";
  focus.setAttribute("aria-pressed",String(!!focusTab));
  syncGlanceShade(full);
}
function setDisplayPreference(name,value,message) {
  const next = displayPreferences({...displayPrefs,[name]:value});
  if (!saveCompanionSetting(displayKey,next)) {
    message.textContent = "Could not save the display preference.";
    return false;
  }
  if (name==="wide") lastLayoutTab="";
  displayPrefs = next;
  syncDisplay(shellCurrent);
  refreshShellPins();
  if (typeof syncReaderDisplay === "function") syncReaderDisplay();
  return true;
}
function availableShellTools(current) {
  const visible = new Map(nav.filter(button => !button.hidden).map(button => [button.dataset.tab,button]));
  const tools = workspaceTools.filter(tool => {
    if (visible.has(tool.tab)) return true;
    if (nav.some(button => button.dataset.tab === tool.tab)) return false;
    if (tool.tab === "profiles") return true;
    if (!current || !toolSupportsGame(tool.tab,current.game)) return false;
    const plan = fieldPlanFor(tool.tab);
    if (plan) return (!plan.game || plan.game === current.game) && (plan.parent === "supplies" || visible.has(plan.parent));
    return !!current.disc && current.game === "x";
  });
  if (visible.has("cheats")) tools.push({tab:"cheats",name:"Cheats",detail:"Optional live edits"});
  return tools;
}
function visitShellTool(previous,next,current) {
  if (next === previous) return;
  rememberSection(previous,next,current);
  if (next === "glance") glanceOrigin = {tab:previous,scroll:panel.scrollTop,game:current?.game,parent:fieldPlanOrigin};
  if (focusTab) focusTab = "";
  if (current?.game && next !== "cheats" && workspaceTools.some(tool => tool.tab === next)) {
    const choices = [next,...recentViews.filter(id => id !== next)].slice(0,5);
    if (saveCompanionSetting(recentKey(current.game),choices)) recentViews = choices;
  }
}
function syncToolRail(current) {
  const rows = availableShellTools(current);
  const pins = workspacePins.filter(pin => pin.kind === "Tool").map(pin => rows.find(row => row.key === pin.key)).filter(Boolean);
  const key = JSON.stringify([shellGame,tab,displayPrefs.rail,rows.map(row => row.tab),pins.map(row => row.tab)]);
  if (key === railSignature) return;
  syncPreviousSection();
  railSignature = key;
  const rail = document.querySelector("nav");
  rail.dataset.layout = displayPrefs.rail;
  const active = rows.find(row => row.tab === tab);
  const shortcuts = [...new Map([...pins.slice(0,4),...(active ? [active] : [])].map(row => [row.tab,row])).values()];
  for (const button of nav) {
    button.toggleAttribute("data-rail",primaryViews.includes(button.dataset.tab) || shortcuts.some(row => row.tab === button.dataset.tab));
  }
  rail.querySelectorAll("[data-extra-tool]").forEach(button => button.remove());
  for (const row of shortcuts.filter(row => !nav.some(button => button.dataset.tab === row.tab))) {
    const button = action(row.name,() => choose(row.tab));
    button.dataset.extraTool = row.tab;
    if (row.tab === tab) button.setAttribute("aria-current","page");
    rail.append(button);
  }
  if (dialogPage === "tools") drawToolResults();
  if (dialogPage === "index") drawFieldIndex();
}
function refreshShellPins() {
  railSignature = "";
  syncToolRail(shellCurrent);
}
function openShellDestination(row) {
  if (document.body.classList.contains("guide-fullscreen") && row.tab !== "guide") {
    guideDetour = true; guideHost.classList.add("guide-detour"); clearGuideSuggestion();
  }
  shellDialog.close();
  choose(row.tab);
  if (row.tab !== "guide") panel.focus({preventScroll:true});
}
function dialogHeader(name) {
  shellDialog.replaceChildren();
  const bar = element("div","dialog-heading");
  const title = element("h2","",name); title.id = "shell-dialog-title";
  bar.append(title,action("Close",() => shellDialog.close()));
  shellDialog.append(bar);
}
function openDisplayDialog() {
  dialogPage = "display";
  dialogHeader("Display");
  const message = element("p","field-note"); message.setAttribute("role","status");
  const fields = element("div","display-fields");
  const preview = element("div","display-preview");
  const updatePreview = () => {
    preview.dataset.preview = shellTheme(shellGame);
    const gameName = shellCurrent ? catalog[shellCurrent.game].title : "Spira Companion";
    const place = shellCurrent ? roomName(shellCurrent) : "Besaid Island";
    preview.replaceChildren(element("small","",gameName),element("strong","",place));
  };
  const option = (label,key,values,convert) => {
    const select = planSelect(fields,label,values,displayPrefs[key],v => {
      if (!setDisplayPreference(key,convert(v),message)) select.value = displayPrefs[key];
      updatePreview();
    });
    return select;
  };
  option("Menu palette","theme",Object.entries(displayThemes),String);
  option("Text size","size",typeScales.map(n => [n,n + "%"]),Number);
  option("Navigation","rail",[["short","Short menu and pins"],["all","Show all tabs"]],String);
  option("When opening a tool","wide",[[false,"Show navigation"],[true,"Use full width"]],v=>v==="true");
  option("Shade Glance after","shade",shadeDelays.map(n => [n,n ? n + " seconds without a touch" : "Manual only"]),Number);
  updatePreview();
  shellDialog.append(preview,fields,message);
  if (!shellDialog.open) shellDialog.showModal();
}
function openToolLibrary() {
  dialogPage = "tools";
  dialogHeader("All tools");
  const display = action("Display",openDisplayDialog);
  shellDialog.querySelector(".dialog-heading .action").before(action("Page index",openFieldIndex),display);
  const search = element("input","workspace-search"); search.type = "search"; search.placeholder = "Find a tool";
  search.id = "shell-search"; search.setAttribute("aria-label","Find a tool");
  const list = element("div","tool-sections"); list.id = "shell-results";
  const message = element("p","field-note"); message.id = "pin-feedback"; message.setAttribute("role","status");
  shellDialog.append(search,message,list);
  search.addEventListener("input",drawToolResults);
  drawToolResults();
  if (!shellDialog.open) shellDialog.showModal();
  // Keep the software keyboard closed until a reader taps the search field.
  shellDialog.querySelector(".dialog-heading button:last-child").focus({preventScroll:true});
}
function drawToolResults() {
  const list = document.querySelector("#shell-results");
  if (!list) return;
  const query = document.querySelector("#shell-search").value.trim();
  const rows = availableShellTools(shellCurrent);
  const byId = new Map(rows.map(row => [row.tab,row]));
  const pinned = new Set(workspacePins.map(pin => pin.key));
  const seen = new Set(), fragment = document.createDocumentFragment();
  const previousFocus = document.activeElement?.dataset.shellKey;
  const scroll = list.scrollTop;
  function group(title,items) {
    const unique = items.filter(row => row && !seen.has(row.tab));
    if (!unique.length) return;
    const section = element("section");
    section.append(element("h3","",title));
    for (const row of unique) {
      seen.add(row.tab);
      const line = element("div","library-line");
      const open = action(row.name,() => openShellDestination(row));
      open.dataset.shellKey = "open-" + row.tab;
      if (row.tab === tab) open.setAttribute("aria-current","page");
      line.append(open);
      if (row.key) {
        const isPinned = pinned.has(row.key);
        const pin = action(isPinned ? "Unpin" : "Pin",() => {
          if (!toggleWorkspacePin(row)) document.querySelector("#pin-feedback").textContent = "Could not save the pin. Workspace holds up to 40 pins.";
        });
        pin.setAttribute("aria-label",(isPinned ? "Unpin " : "Pin ") + row.name);
        pin.dataset.shellKey = "pin-" + row.tab; line.append(pin);
      }
      section.append(line);
    }
    fragment.append(section);
  }
  if (query) group("Matches",rows.filter(row => workspaceWords(query).split(" ").filter(Boolean).every(word => workspaceWords(row.name + " " + (row.detail || "")).includes(word))));
  else {
    group("Pinned",workspacePins.map(pin => rows.find(row => row.key === pin.key)));
    group("Recently opened",recentViews.map(id => byId.get(id)));
    for (const shelf of ["Journey","Battle","Party and training","Fiends and fieldwork","Completion","Sidequests"]) {
      group(shelf,rows.filter(row=>fieldSections[sectionParent(row.tab)]?.[0]===shelf));
    }
    group("Companion",rows);
  }
  if (!seen.size) fragment.append(element("p","","No matching tool for this game."));
  list.replaceChildren(fragment); list.scrollTop = scroll;
  if (previousFocus) Array.from(list.querySelectorAll("[data-shell-key]")).find(b => b.dataset.shellKey === previousFocus)?.focus({preventScroll:true});
}
function initDisplay() {
  document.querySelector("#display-settings").addEventListener("click",openDisplayDialog);
  document.querySelector("#tool-library").addEventListener("click",openToolLibrary);
  document.querySelector("#focus-view").addEventListener("click",() => { focusTab = focusTab ? "" : tab; syncDisplay(shellCurrent); });
  document.querySelector("#focus-index").addEventListener("click",openFieldIndex);
  shellDialog.addEventListener("close",() => { if (!shellDialog.open) dialogPage = ""; resetGlanceShade(); });
  initGlanceControls();
  initFieldIndex();
}
