"use strict";

const guideMarksKey="spira.guide.bookmarks.v1";
function readGuideMarks() {
  const stored=readCompanionSetting(guideMarksKey,[]);
  return Array.isArray(stored) ? [...new Set(stored.filter(id=>typeof id==="string" && id.length<=200))] : [];
}
function openGuideMarks() {
  dialogPage="bookmarks";
  dialogHeader("Walkthrough bookmarks");
  const save=action("Save current section",()=>sendGuide("bookmark-section"));
  save.id="bookmark-save"; save.disabled=!guideReady;
  const status=element("p","field-note"); status.id="bookmark-result"; status.setAttribute("role","status");
  const list=element("div","guide-marks"); list.id="guide-mark-list";
  shellDialog.append(save,status,list); drawGuideMarks();
  if (!shellDialog.open) shellDialog.showModal();
  save.focus({preventScroll:true});
}
function bookmarkTitle(id) {
  return id==="contents" ? "Walkthrough contents" : walkthroughHeadings.find(row=>row[0]===id)?.[1];
}
function drawGuideMarks() {
  const list=document.querySelector("#guide-mark-list");
  if (!list) return;
  document.querySelector("#bookmark-save").disabled=!guideReady;
  list.replaceChildren();
  for (const id of readGuideMarks()) {
    const title=bookmarkTitle(id);
    if (!title) continue;
    const row=element("div","library-line");
    const open=action(title,()=>{shellDialog.close();openGuideSection(id);});
    const remove=action("Remove",()=>{
      const remaining=readGuideMarks().filter(mark=>mark!==id);
      const saved=saveCompanionSetting(guideMarksKey,remaining);
      document.querySelector("#bookmark-result").textContent=saved ? "Removed "+title+"." : "Could not save the change.";
      if (saved) {drawGuideMarks();shellDialog.querySelector("button").focus({preventScroll:true});}
    });
    remove.setAttribute("aria-label","Remove bookmark for "+title);
    row.append(open,remove); list.append(row);
  }
  if (!list.childElementCount) list.append(element("p","field-note","Save the section you’re reading to return to it on this playthrough."));
}
function recordGuideMark(id) {
  if (dialogPage!=="bookmarks" || !shellDialog.open || !guideReady || tab!=="guide") return;
  const status=document.querySelector("#bookmark-result");
  const title=bookmarkTitle(id);
  if (!title) {status.textContent="Open a walkthrough section first.";return;}
  const marks=readGuideMarks();
  if (marks.includes(id)) {status.textContent=title+" is already saved.";return;}
  const saved=saveCompanionSetting(guideMarksKey,[id,...marks]);
  status.textContent=saved ? "Saved "+title+"." : "Could not save the bookmark.";
  if (saved) drawGuideMarks();
}
