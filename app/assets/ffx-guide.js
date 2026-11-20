"use strict";

// Anchors in the October 16 offline Jegged export. Nearby rooms with the
// same guide section share a target, so passage doors don't reset reading.
const guideRooms = new Map();
for (const [anchor, rooms] of [
  ["002--street", [134,191,366,367,368,370,371,376,389]],
  ["003--ruins-underwater-hall", [48,49,380]],
  ["003--ruins-corridor", [50,52,74]],
  ["003--ruins-hall", [51,63,196,298]],
  ["003--salvage-ship-deck", [71,113]],
  ["003--salvage-ship-underwater", [288]],
  ["003--underwater-ruins", [64,295]],
  ["004--besaid-beach", [19,70,252]],
  ["004--besaid-crossroads", [20]],
  ["004--besaid-valley", [21,41,67]],
  ["004--besaid-village-slope", [69]],
  ["005--besaid-waterfall-way", [22]],
  ["005", [17,60,68,83,100,133,142,143,144,145,337,386]],
  ["005--besaid-temple", [42,84,103,117,146,147,387]],
  ["043", [122]],
  ["006", [61,148,149,150,154,220,301,336]],
  ["007--docks", [16,43,98,139,282]],
  ["007--kilika-residential-area", [46,47,53,151,152,293,294]],
  ["007--kilika-woods", [18]],
  ["007--kilika-pilgrimage-road", [65]],
  ["007--kilika-temple", [44,45,78,96,118,155,156,166]],
  ["046", [108]],
  ["008", [94,165,167,168,169,185,237,302]],
  ["009--stadium-basement-a", [72]],
  ["009--stadium-basement-b", [73]],
  ["009--luca-stadium-main-gate", [123]],
  ["009--luca-number-1-dock", [85]],
  ["009--luca-number-2-dock", [86,267,335]],
  ["009--luca-number-5-dock", [88,89,268]],
  ["009--luca-number-4-dock", [87,299]],
  ["009--luca-bridge", [77]],
  ["009--theater", [157,158,170,184]],
  ["009--luca-square", [104,159,377]],
  ["009--luca-city-limits", [107,391]],
  ["009--blitzball-match", [55,57,62,121,124,125,250,355,356]],
  ["010--highroad-south-end", [95]],
  ["010--highroad-south", [120]],
  ["010--mi-ihen-highroad-central", [127]],
  ["011--highroad-agency-front-rin-s-travel-agency", [58,112,171,334,381]],
  ["011--highroad-newroad-south", [115]],
  ["011--highroad-newroad-north", [116]],
  ["011--highroad-north-end", [59]],
  ["012--mushroom-rock-valley", [92]],
  ["012--mushroom-rock-precipice", [128]],
  ["012--mushroom-rock-plateau", [79,254,289]],
  ["012--mushroom-rock-ridge", [119,247]],
  ["012--mushroom-rock-aftermath", [131]],
  ["013--djose-highroad", [93]],
  ["013--djose-pilgrimage-road", [76]],
  ["013--djose-temple", [81,82,90,91,160,161,210,245]],
  ["045", [214]],
  ["014--moonflow-south-bank-road", [75]],
  ["014--moonflow-south-bank", [99,105,333]],
  ["014--moonflow-south-wharf", [187,188,234,235,291]],
  ["014--moonflow-north-wharf", [109,189,190,236]],
  ["014--moonflow-north-bank-road", [97]],
  ["015", [135,172,173,174,243]],
  ["015--mansion-entrance", [163]],
  ["015--mansion-great-hall", [141,217]],
  ["015--road-to-farplane", [175]],
  ["015--the-farplane", [193,257,364]],
  ["016--thunder-plains-south", [140]],
  ["016--thunder-plains-agency", [256,263,264]],
  ["016--thunder-plains-north", [162,332]],
  ["017--macalania-woods-south", [110]],
  ["017--macalania-woods-central", [241]],
  ["017--macalania-woods-north", [242,329]],
  ["017--macalania-woods-lake-road", [221]],
  ["017--macalania-woods-spring", [206,248,338]],
  ["018--lake-macalania-agency-front", [102,164,215,331]],
  ["018--lake-macalania-crevasse", [192]],
  ["018--macalania-road", [153]],
  ["018--macalania-hall", [80,106,178,179,284,388]],
  ["047", [239]],
  ["018--lake-macalania-lake-bottom", [54,260,365]],
  ["019--oasis", [129]],
  ["019--sanubia-desert-east", [136]],
  ["019--sanubia-desert-central", [137]],
  ["019--sanubia-desert-west", [138]],
  ["020--home-entrance", [130,276]],
  ["020--home-main-corridor", [280]],
  ["020--living-quarters", [275]],
  ["020--living-quarters-2", [286]],
  ["020--home-environment-controls", [219]],
  ["020--home-airship-dock", [303]],
  ["022--bevelle-tower-of-light", [205,208,330]],
  ["022--bevelle-priests-passage", [180,181,182]],
  ["044", [226,227,306,390]],
  ["023", [198,207,253,287,305]],
  ["023--bevelle-via-purifico-underwater", [209]],
  ["023--highbridge", [195,339]],
  ["024--macalania-woods-campsite", [176,183,238,273]],
  ["024--macalania-woods-to-t-plains", [177,274]],
  ["025--calm-lands-central", [223]],
  ["025--calm-lands-near-bridge", [266,279]],
  ["030--monster-arena-initiation", [307]],
  ["074", [290,308,372]],
  ["058", [56,283]],
  ["026--gagazet-mountain-gate", [259]],
  ["026--gagazet-mountain-trail", [244,383]],
  ["026--gagazet-prominence", [285]],
  ["026--gagazet-fayth-cluster", [309]],
  ["027--gagazet-mountain-cave", [272]],
  ["027--gagazet-submerged-passage", [310]],
  ["027--gagazet-summit-region", [311,361]],
  ["027--road-to-the-zanarkand-ruins", [312,362]],
  ["028", [132,313,349,363]],
  ["028--zanarkand-ruins-overpass", [225]],
  ["028--dome", [314,315]],
  ["028--dome-interior", [222]],
  ["028--dome-corridor", [316]],
  ["028--dome-great-hall", [224,317]],
  ["028--dome-chamber-of-the-fayth", [318]],
  ["028--dome-the-beyond", [197,270]],
  ["048", [319,320]],
  ["072", [258,271]],
  ["031--sin-near-airship", [201,322]],
  ["031--sin-sea-of-sorrow", [203]],
  ["031--sin-garden-of-pain", [296]],
  ["032--sin-city-of-dying-dreams", [204]],
  ["032--sin-tower-of-the-dead", [327]],
  ["032--sin-the-nucleus", [324,341]],
  ["032--sin-dream-s-end", [325,326,384]]
]) {
  for (const room of rooms) guideRooms.set(room, "page-" + anchor);
}

function guideDestination(frame) {
  if (frame?.game !== "x" || frame.disc !== "SLPS-25088") return "";
  if (frame.battle && frame.enemies?.some(foe => foe.id === 120)) return "page-023--Evrae-Altana";
  const {room, story} = frame;
  if ([194,199,200,202,211,255,261,265,277,351,374,375,382].includes(room)) {
    if (story > 2040 && story < 2900) return "";
    if (story > 2040) return "page-029--airship-bridge";
    if ([199,200,202,277].includes(room)) return "page-021--Evrae";
    return [265,351].includes(room) ? "page-021--airship-corridor" : "page-021--airship-bridge";
  }
  return guideRooms.get(room) || "";
}

const guideHost = document.querySelector("#guide");
const guideOrigin = "https://guide.spira.invalid";
let guideFile = false;
let guideFrame;
let guideReady = false;
let guideFailed = false;
let guideFollowing = true;
let guideLatest = null;
let guideFeedState = "waiting";
let guideCandidate;
let guideStable;
let guideShown;
let guideLastSent;
let guideVisible = false;
let guideStatus;
let guideToggle;
let guideExpand;
let guideExit;
let guideResize;
let guideBusy = false;
let guideManualAnchor = null;
let guideWait;
let guideSuggestionBox;
let guideSuggestionsEnabled = true;
let guideDetour = false;
let guideReturnPending = false;
let lastSuggestionFrame;
let lightningActivity;
let shownGuideSuggestion;
const guideSuggestions = typeof createGuideSuggestions === "function" ? createGuideSuggestions() : null;
try {
  guideSuggestionsEnabled = localStorage.getItem("spira.guideSuggestions") !== "off";
} catch { /* Keep the default if storage is unavailable. */ }

function guideSuggestionSetting() {
  const checkbox = element("input");
  checkbox.type = "checkbox";
  checkbox.checked = guideSuggestionsEnabled;
  checkbox.addEventListener("change", () => {
    guideSuggestionsEnabled = checkbox.checked;
    try { localStorage.setItem("spira.guideSuggestions", checkbox.checked ? "on" : "off"); } catch { /* Keep the session preference. */ }
    clearGuideSuggestion();
  });
  const label = element("label", "prep-choice");
  label.append(checkbox, "Suggest relevant tabs in full-screen Guide");
  return label;
}

function clearGuideSuggestion() {
  guideSuggestions?.clear();
  hideGuideSuggestion();
}

function hideGuideSuggestion() {
  shownGuideSuggestion = null;
  if (guideSuggestionBox) guideSuggestionBox.hidden = true;
}

function refreshGuideSuggestion() {
  if (!guideSuggestionBox || !guideLatest || !guideSuggestionsEnabled || !guideVisible || !guideReady ||
      guideFeedState !== "live" || !document.body.classList.contains("guide-fullscreen")) {
    clearGuideSuggestion();
    return;
  }
  const current = guideLatest;
  const suggestions = guideSuggestionsFor(current, lightningActivity);
  const suggestion = guideSuggestions.update(suggestions, current.timestamp, guideBusy || !guideFollowing);
  if (!suggestion) {
    hideGuideSuggestion();
    return;
  }
  const previouslyShown = shownGuideSuggestion;
  shownGuideSuggestion = suggestion;
  if (previouslyShown?.key === suggestion.key) {
    const caption = guideSuggestionBox.querySelector("p");
    if (caption.textContent !== suggestion.text) caption.textContent = suggestion.text;
    return;
  }
  const caption = element("p", "", suggestion.text);
  caption.setAttribute("role", "status");
  const open = action(suggestion.label, () => {
    const selected = shownGuideSuggestion;
    if (!selected) return;
    guideDetour = true;
    guideHost.classList.add("guide-detour");
    clearGuideSuggestion();
    selected.open();
  });
  const dismiss = action("", () => {
    guideSuggestions.dismiss();
    hideGuideSuggestion();
  });
  dismiss.classList.add("guide-suggestion-dismiss");
  dismiss.setAttribute("aria-label", "Dismiss guide suggestion");
  guideSuggestionBox.replaceChildren(caption, open, dismiss);
  guideSuggestionBox.classList.toggle("urgent", suggestion.priority === guidePriority.deadline);
  guideSuggestionBox.hidden = false;
}

function guideReturnAction() {
  if (!guideDetour || tab === "guide") return;
  const button = action("Back to full-screen guide", () => {
    guideReturnPending = true;
    choose("guide");
  });
  button.classList.add("guide-return");
  panel.prepend(button);
}

function sendGuide(command, anchor) {
  guideFrame?.contentWindow.postMessage({command, anchor}, "*");
}
function syncReaderDisplay() {
  if (!guideReady || typeof displayPrefs === "undefined") return;
  sendGuide("reading-size",displayPrefs.size);
  sendGuide("reading-black",displayPrefs.theme === "black");
}

function refreshGuideControls() {
  if (!guideStatus) return;
  const message = !guideReady ? (guideFailed ? "Could not open the offline file" : "Opening the offline file…") :
    !guideFollowing ? "Browsing walkthrough" :
    guideLatest?.game === "x2" ? "Following is available for FFX International" :
    !guideLatest || guideFeedState === "reconnecting" ? "Waiting for FFX International" :
    guideStable?.anchor ? "Following · " + guideStable.name : "No matching section for this room";
  if (guideStatus.textContent !== message) guideStatus.textContent = message;
  guideToggle.textContent = guideFollowing ? "Pause follow" : "Back to game";
  guideToggle.disabled = !guideReady;
  guideExpand.disabled = !guideReady;
}

function setGuideFullscreen(expand, focus = true) {
  clearTimeout(guideResize);
  guideResize = null;
  document.body.classList.toggle("guide-fullscreen", expand);
  if (!expand) clearGuideSuggestion();
  else refreshGuideSuggestion();
  if (focus) (expand ? guideExit : guideExpand)?.focus({preventScroll:true});
}

function toggleGuideFullscreen() {
  if (!guideReady || guideResize != null) return;
  guideResize = setTimeout(applyGuideResize, 250);
  sendGuide("remember-position");
}

function applyGuideResize() {
  if (guideResize == null) return;
  setGuideFullscreen(!document.body.classList.contains("guide-fullscreen"));
}

function syncGuide() {
  if (guideReady && guideVisible && guideManualAnchor) {
    sendGuide("jump", guideManualAnchor);guideManualAnchor=null;refreshGuideControls();return;
  }
  refreshGuideControls();
  if (!guideReady || !guideVisible || !guideFollowing || guideBusy ||
      !guideLatest || guideFeedState === "reconnecting" || !guideStable?.anchor || guideStable.anchor === guideLastSent) return;
  guideLastSent = guideStable.anchor;
  sendGuide("jump", guideStable.anchor);
}

function openGuideSection(anchor) {
  guideFollowing=false;guideManualAnchor=anchor;choose("guide");syncGuide();
}

function openGuide() {
  if (typeof walkthroughHeadings !== "undefined") walkthroughHeadings = [];
  guideHost.replaceChildren();
  guideStatus = null;
  guideSuggestionBox = null;
  if (!guideFile) {
    const empty = element("div", "guide-empty");
    empty.append(element("h1", "", "Jegged walkthrough"),
      element("p", "", "Choose the complete offline walkthrough to follow your location in Final Fantasy X International."),
      action("Choose walkthrough", () => window.SpiraSetup?.pickGuide(), true),
      element("p", "guide-import-error"));
    empty.lastChild.setAttribute("role", "status");
    guideHost.append(empty);
    return;
  }
  const bar = element("div", "guide-bar");
  guideStatus = element("span", "guide-status");
  guideStatus.setAttribute("role", "status");
  const controls = element("div", "guide-actions");
  const contents = action("Contents", () => {
    if (!guideReady) return;
    guideFollowing = false;
    sendGuide("jump", "contents");
    refreshGuideControls();
  });
  guideToggle = action("Pause follow", () => {
    guideFollowing = !guideFollowing;
    if (guideFollowing) guideLastSent = null;
    syncGuide();
  }, true);
  guideExpand = action("Full screen", toggleGuideFullscreen);
  guideExit = action("Exit full screen", toggleGuideFullscreen);
  guideExit.classList.add("guide-exit");
  controls.append(contents, guideToggle, guideExpand);
  bar.append(guideStatus, controls);
  guideFrame = element("iframe", "guide-document guide-document-loading");
  guideFrame.title = "Offline Jegged walkthrough";
  guideFrame.setAttribute("sandbox", "allow-scripts");
  guideSuggestionBox = element("aside", "guide-suggestion");
  guideSuggestionBox.setAttribute("aria-label", "Companion suggestion");
  guideSuggestionBox.hidden = true;
  const footer = element("div","guide-full-actions");
  guideHost.append(bar, guideFrame, footer, guideSuggestionBox);
  const workspace = action("Workspace", openWorkspaceFromGuide);
  workspace.classList.add("guide-workspace");
  footer.append(workspace);
  const tools = action("All tools", () => openToolLibrary());
  tools.classList.add("guide-library");
  footer.append(tools,guideExit);
  refreshGuideControls();
  guideFrame.src = guideOrigin + "/walkthrough.html";
  clearTimeout(guideWait);
  guideWait = setTimeout(() => {
    if (guideReady) return;
    guideFailed = true;
    contents.replaceWith(action("Choose file", () => window.SpiraSetup?.pickGuide()));
    refreshGuideControls();
  }, 12000);
}

function updateGuide(visible, frame, feedState) {
  guideVisible = visible;
  guideLatest = frame;
  guideFeedState = feedState;
  if (feedState !== "live") {
    lightningActivity = lastSuggestionFrame = null;
  } else if (frame?.timestamp !== lastSuggestionFrame?.timestamp) {
    const dodges = frame?.progress?.challenges?.lightning?.dodges;
    const oldDodges = lastSuggestionFrame?.progress?.challenges?.lightning?.dodges;
    if (frame?.disc !== lastSuggestionFrame?.disc || frame?.room !== lastSuggestionFrame?.room ||
        frame?.battle || dodges < oldDodges) lightningActivity = null;
    else if (dodges > oldDodges) lightningActivity = frame.room;
    lastSuggestionFrame = frame;
  }
  const bossGuide = frame?.battle && frame.game === "x" && frame.enemies?.some(foe => foe.id === 119 || foe.id === 120);
  if (frame && (feedState === "live" || feedState === "paused") && (!frame.battle || !guideStable || bossGuide)) {
    const anchor = guideDestination(frame);
    const key = anchor || frame.game + "/" + frame.room;
    if (guideCandidate?.key !== key) guideCandidate = {key, since:frame.timestamp};
    // The timestamp is from distinct feed frames. UI clicks cannot confirm a transition.
    if (frame.timestamp - guideCandidate.since >= 850) {
      guideStable = {anchor, name:anchor ? roomName(frame) : ""};
    }
  } else {
    guideCandidate = null;
    if (!frame || frame.game !== "x") guideStable = null;
  }
  if (visible && guideDetour) {
    // Keep the passage visible before the detour, even if the game moved.
    guideDetour = false;
    if (guideStable?.anchor) guideLastSent = guideStable.anchor;
    if (guideReturnPending) setGuideFullscreen(true, false);
    guideHost.classList.remove("guide-detour");
    guideReturnPending = false;
  }
  if (guideHost.hidden !== !visible) guideHost.hidden = !visible;
  if (!visible) {
    if (document.body?.classList.contains("guide-fullscreen") || guideResize != null) setGuideFullscreen(false, false);
    return;
  }
  if (!guideHost.firstChild) openGuide();
  syncGuide();
  if (guideSuggestions) refreshGuideSuggestion();
}

window.addEventListener("message", event => {
  if (event.source !== guideFrame?.contentWindow || event.origin !== "null") return;
  const {kind} = event.data || {};
  if (kind === "index" && typeof walkthroughHeadings !== "undefined") {
    const rows = Array.isArray(event.data.rows) ? event.data.rows : [];
    walkthroughHeadings = rows.slice(0,2500).filter(row=>Array.isArray(row) && row.length===2 &&
      row.every(s=>typeof s==="string" && s.length>0 && s.length<=200));
    if (typeof dialogPage!=="undefined" && dialogPage==="index") drawFieldIndex();
  } else if (kind === "ready") {
    guideReady = true;
    syncReaderDisplay();
    guideFailed = false;
    clearTimeout(guideWait);
    syncGuide();
    guideFrame.classList.remove("guide-document-loading");
  } else if (kind === "browse") {
    guideFollowing = false;
    refreshGuideControls();
  } else if (kind === "game") {
    guideFollowing = true;
    guideLastSent = null;
    syncGuide();
  } else if (kind === "reading") {
    guideBusy = true;
  } else if (kind === "idle") {
    guideBusy = false;
    syncGuide();
  } else if (kind === "position-ready") {
    applyGuideResize();
  } else if (kind === "exit-fullscreen") {
    window.SpiraGuide.exitFullscreen();
  }
});

window.addEventListener("keydown", event => {
  if (event.key === "Escape" && window.SpiraGuide.exitFullscreen()) event.preventDefault();
});

window.SpiraGuide = {
  exitFullscreen() {
    if (!document.body.classList.contains("guide-fullscreen")) return false;
    toggleGuideFullscreen();
    return true;
  },
  fileChanged(available) {
    setGuideFullscreen(false, false);
    guideFile = available;
    guideReady = false;
    guideFailed = false;
    guideLastSent = null;
    guideBusy = false;
    if (guideVisible) openGuide();
    else guideHost.replaceChildren();
  },
  error(message) {
    const error = guideHost.querySelector(".guide-import-error");
    if (error) error.textContent = message;
    else if (guideStatus) guideStatus.textContent = message;
  }
};
