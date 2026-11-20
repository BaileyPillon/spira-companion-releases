"use strict";

// Hand-authored interaction labels for documented voice flags. The complete bit
// table remains the authority for presence; an absent flag alone proves no lockout.
const x2NamedScenes = new Map([
  ["87:32",["Meet Rikku","Speak with Rikku aboard the Celsius, or use Shinra’s dossier before Chapter 4."]],
  ["88:128",["Meet Paine","Speak with Paine aboard the Celsius, or use Shinra’s dossier before Chapter 4."]],
  ["89:32",["Meet Brother","Speak with Brother on the Celsius bridge."]],
  ["90:64",["Meet Shinra","Speak with Shinra on the Celsius bridge."]],
  ["90:128",["Meet Barkeep","Speak with Barkeep in the cabin. Check Shinra’s dossier if the introduction remains available."]],
  ["1275:8",["Comfort Brother after the Floating Ruins","Speak to Brother before asking Shinra to examine the recovered sphere."]],
  ["1287:64",["Examine the Floating Ruins sphere","Ask Shinra to show the recovered sphere after checking on Brother."]],
  ["2450:16",["Luca flashback: the Moogle encounter","This scene depends on touching the Moogle during the opening chase. Revisit Luca and complete the flashback."]],
  ["1589:4",["Invite Clasko to the Celsius","Return to Clasko after the Mushroom Rock mission and invite him aboard."]],
  ["1312:32",["Talk to Clasko in the cabin","After inviting Clasko aboard, speak to him in the Celsius cabin before completing the Chapter 2 Highroad mission."]],
  ["1638:2",["Begin Maechen’s history","Speak to Maechen at Youth League Headquarters and let him finish."]],
  ["1644:8",["Hear Maechen’s handshake request","Stay through Maechen’s entire account without ending the conversation early."]],
  ["1644:64",["Accept Maechen’s handshake","Agree to the handshake when Maechen finishes speaking at Youth League Headquarters."]],
  ["1887:128",["Speak with Tromell","Find Tromell at Macalania’s spring and continue speaking with him."]],
  ["1888:16",["Continue Tromell’s account","Speak with Tromell again at the spring."]],
  ["1889:32",["Finish Tromell’s conversation","Continue talking to Tromell through his final conversation to obtain Paine’s special dressphere."]],
  ["1338:16",["Visit O’aka aboard the Celsius","After inviting O’aka aboard, speak with him in the cabin."]],
  ["6651:8",["See the Experiment before all three stats reach level 5","Visit Djose while at least one assembly level is below 5."]],
  ["6664:4",["See the level-5 Experiment scene","Visit the Experiment when Attack, Defense and Special have all reached level 5."]]
]);
let sceneAuditChapter=0,sceneAuditQuery="",sceneAuditMissing=true;
let sceneAuditIncludeConditional = true;
function x2SceneAudit(current) {
  if(current?.disc!=="SLUS-20672"||!x2StoryProgress(current.storyFlags))return null;
  const bytes=atob(current.storyFlags);
  return x2StoryEvents.map(([chapter,offset,mask,place],index)=>{
    const key=offset+":"+mask,route=x2SceneRouteFor[index];
    const named=x2NamedScenes.get(key),done=!!(bytes.charCodeAt(offset)&mask),location=x2StoryPlaces[place]||"Location not mapped";
    const earlier=chapter<current.chapter,future=chapter>current.chapter;
    const dossier=location.includes("Dossiers");
    return {key,chapter,location,done,name:named?.[0]||route.title,named:true,routeId:named?key:route.id,branch:route.branch,conditional:route.conditional||index===121,visit:route.visit,
      action:named?.[1]||route.action,
      state:done?"Recorded":future?"Later chapter":earlier?"Earlier chapter · recovery must be checked":"Not recorded this chapter",
      recovery:done?"This scene flag is present in the loaded save.":earlier?
        (dossier?"A dossier replay may still be available. Check the deadline in the location name.":"Check an earlier save or the corresponding route on New Game Plus. This flag alone does not prove the scene is permanently lost."):
        future?"Keep this for the later chapter; it is not a current omission.":"Check this before advancing. Some flags belong to alternate branches and are not required together."};
  });
}
function x2GroupSceneChecks(rows) {
  const groups=new Map();
  for(const scene of rows){
    const key=scene.chapter+":"+scene.routeId;
    if(!groups.has(key))groups.set(key,{...scene,flags:[],locations:new Set()});
    const group=groups.get(key);group.flags.push(scene);group.locations.add(scene.location);
  }
  return [...groups.values()].map(group=>({...group,location:[...group.locations].join(" · "),done:group.flags.every(flag=>flag.done)}));
}
function showX2SceneAudit(current) {
  const scenes=x2SceneAudit(current);if(!scenes)return;
  showChapterBoard(current,scenes);
  const section=element("details","planner-config scene-audit");section.append(element("summary","","Missing-scene diagnosis and chapter exit check"));
  const controls=element("div","filters");
  const chapter=options("Scene audit chapter",[[0,"Current chapter"],...[1,2,3,4,5].map(n=>[n,"Chapter "+n])],sceneAuditChapter,value=>{sceneAuditChapter=Number(value);draw();});
  const search=element("input","scene-audit-search");search.type="search";search.placeholder="Search scenes or places";search.setAttribute("aria-label","Find an interaction or location");search.value=sceneAuditQuery;
  search.addEventListener("input",()=>{sceneAuditQuery=search.value;draw();});
  const label=element("label","goal-choice"),missing=element("input");missing.type="checkbox";missing.checked=sceneAuditMissing;
  missing.addEventListener("change",()=>{sceneAuditMissing=missing.checked;draw();});label.append(missing,document.createTextNode("Unrecorded only"));
  const branchLabel = element("label", "goal-choice");
  const branchCheck = element("input");
  branchCheck.type = "checkbox";
  branchCheck.checked = sceneAuditIncludeConditional;
  branchCheck.addEventListener("change", () => {
    sceneAuditIncludeConditional = branchCheck.checked;
    draw();
  });
  branchLabel.append(branchCheck, document.createTextNode("Include conditional routes"));
  controls.append(chapter,search,label,branchLabel);const summary=element("p","field-note"),sheet=element("div","sheet");
  function draw(){
    const chosen=sceneAuditChapter||current.chapter,all=scenes.filter(row=>row.chapter===chosen),pending=all.filter(row=>!row.done);
    const groups=x2GroupSceneChecks(all);
    summary.textContent=`${all.length-pending.length} / ${all.length} mapped flags recorded · ${groups.filter(group=>!group.done).length} scene checks with unrecorded flags. Some checks apply only to one route.`;
    sheet.replaceChildren();const query=sceneAuditQuery.trim().toLowerCase();
    const shown=groups.filter(row=>(branchCheck.checked||!row.conditional)&&(!sceneAuditMissing||!row.done)&&(!query||`${row.name} ${row.location} ${row.visit||""} ${row.action}`.toLowerCase().includes(query)));
    const missingInView=shown.reduce((sum,group)=>sum+group.flags.filter(flag=>!flag.done).length,0);
    summary.textContent+=" Current selection shows "+shown.length+" of "+groups.length+" checks and "+missingInView+" unrecorded "+(missingInView===1?"flag.":"flags.");
    for(const scene of shown){
      const faction=scene.branch==="league"?"Youth League route":scene.branch==="yevon"?"New Yevon route":scene.conditional?"Conditional scene":"";
      const row=entry(scene.name,[scene.done?"Recorded":scene.flags.find(flag=>!flag.done).state,faction].filter(Boolean).join(" · "),scene.action);
      row.append(element("p","field-note",scene.visit?`Where to start: ${scene.visit}`:scene.location));
      const reference=element("details");reference.append(element("summary","",`Save details · ${scene.flags.filter(flag=>flag.done).length}/${scene.flags.length} flags recorded`));
      for(const flag of scene.flags)reference.append(element("p","field-note",`${flag.done?"Recorded":"Unrecorded"} · ${flag.location} · ${flag.key}`));
      reference.dataset.detailKey = "scene:" + scene.chapter + ":" + scene.routeId;
      reference.append(element("p","field-note",scene.flags.find(flag=>!flag.done)?.recovery||scene.recovery));row.append(reference);sheet.append(row);
    }
    if(!sheet.childElementCount)sheet.append(entry("No scenes match this filter"));
  }
  const exit=action("Review before leaving this chapter",()=>{sceneAuditChapter=0;sceneAuditQuery="";sceneAuditMissing=true;chapter.value="0";search.value="";missing.checked=true;section.open=true;draw();});
  section.append(element("p","field-note","Recorded flags come from your current game. Some scenes require a specific faction, an earlier choice or a later visit. Check the instructions before treating a scene as missed."),controls,exit,summary,sheet);
  panel.append(section);draw();
}
