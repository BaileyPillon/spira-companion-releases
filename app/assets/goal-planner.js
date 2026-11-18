"use strict";

const journeyGoals = [
  ["anima","Recruit Anima"],["celestials","Power all Celestial Weapons"],
  ["ap","Set up Don Tonberry AP farming"],["dark","Prepare for and defeat the Dark Aeons"],
  ["penance","Prepare for and defeat Penance"],["captures","Capture ten of every Arena fiend"]
];
let journeySettings=readCompanionSetting("spira.journey.v1",{goals:["anima"],members:[0,4,6],items:[]});
function validJourney(value) {
  const list=key=>Array.isArray(value?.[key])?value[key]:[];
  return {goals:[...new Set(list("goals").filter(key=>journeyGoals.some(([id])=>id===key)))],
    members:[...new Set(list("members").filter(id=>Number.isInteger(id)&&id>=0&&id<7))],
    items:list("items").filter(row=>Array.isArray(row)&&ffxData.items[row[0]]&&Number.isInteger(row[1])&&row[1]>0&&row[1]<=99).slice(0,40)};
}
journeySettings=validJourney(journeySettings);

function buildJourney(current,settings) {
  settings=validJourney(settings);
  const steps=new Map(),captures=new Map(),materials=new Map(),inventory=itemAmounts(current.items || []);
  const creations=new Map(arenaGoals(current).flatMap(([,rows])=>rows.map(row=>[row.name,row])));
  const add=(id,name,area,detail,open,deps=[])=>{
    if(!steps.has(id))steps.set(id,{id,name,area,detail,open,deps:new Set(deps)});
    else for(const dep of deps)steps.get(id).deps.add(dep);
    return id;
  };
  function capture(name,target,reason) {
    const existing=captures.get(name)||{name,target:0,reasons:new Set()};
    existing.target=Math.max(existing.target,target);existing.reasons.add(reason);captures.set(name,existing);
    return "capture:"+name;
  }
  function creation(name,seen=new Set()) {
    const id="creation:"+name,goal=creations.get(name);
    if(!goal || goal.ready || arenaDefeated(current,name))return null;
    if(seen.has(name))return null;seen.add(name);
    let deps=[];
    if(goal.fiends)deps=goal.fiends.map(foe=>capture(foe,goal.target,name));
    for(const requirement of goal.pending||[])if(requirement.startsWith("Defeat ")){
      const foe=requirement.slice(7),unlock=creation(foe,new Set(seen));
      deps.push(add("defeat:"+foe,"Defeat "+foe,"Monster Arena","Required before "+name+" becomes available.",{type:"fiend",value:foe},unlock?[unlock]:[]));
    }
    if(goal.prerequisites) {
      const original=arenaOriginals.find(([title])=>title===name);
      const group=original?.[1]==="area"?areaCreations:speciesCreations.map(([title])=>title);
      const completed=group.filter(title=>creations.get(title)?.ready||arenaDefeated(current,title)).length;
      const remaining=Math.max(0,(original?.[2]||0)-completed);
      const scored=goal.prerequisites.slice().sort((a,b)=>{
        const need=g=>g.fiends.reduce((sum,f)=>sum+Math.max(0,g.target-(arenaCaptureCount(current,f)||0)),0);
        return need(a)-need(b);
      });
      deps=scored.slice(0,remaining).map(g=>creation(g.name,new Set(seen))).filter(Boolean);
    }
    return add(id,"Unlock "+name,"Monster Arena",goal.detail,{type:"creation",value:name},deps);
  }
  function needItem(item,quantity,reason) {
    const row=materials.get(item)||{item,needed:0,reasons:new Set()};
    row.needed+=quantity;row.reasons.add(reason);materials.set(item,row);return "material:"+item;
  }
  function armor(planId) {
    const plan=ffxPrepPlans[planId];if(!plan)return [];
    const dependencies=[];
    for(const member of current.party.filter(member=>settings.members.includes(member.id))) {
      const best=prepLoadout(member,plan,inventory);
      if(best && !best.missing.length)continue;
      const label=catalog.x.party[member.id]+" · "+plan.name;
      let missing=best?.fits?best.missing:plan.slots.map(([ability])=>prepRecipes[plan.type].get(ability)).filter(Boolean);
      const deps=missing.map(recipe=>needItem(recipe.item,recipe.cost,label));
      if(!best?.fits)deps.push(add("base:"+planId+":"+member.id,"Find an equipment base for "+catalog.x.party[member.id],"Equipment",
        `${plan.slots.length} compatible ability slots needed for ${plan.name}. Existing incompatible gear is kept.`,{type:"prep",value:planId}));
      dependencies.push(add("gear:"+planId+":"+member.id,"Prepare "+label,"Equipment",
        "Materials below are reserved for this build. Apply the listed customizations in the game.",{type:"prep",value:planId},deps));
    }
    return dependencies;
  }
  const expanded=new Set(settings.goals);
  if(expanded.has("penance"))expanded.add("dark");
  if(expanded.has("ap")){
    const deps=[creation("One-Eye"),creation("Don Tonberry"),...armor("ap")].filter(Boolean);
    if(deps.length)add("ap-farm","Finish the Don Tonberry setup","Monster Arena","Set Stoic on the attacker and Comrade on the other two. This setup goal completes once the required equipment and Arena unlocks are ready. Training itself is optional.",{type:"prep",value:"ap"},deps);
  }
  if(expanded.has("anima") && !(current.progress?.optionalAeons&1)){
    const deps=animaTreasures(current).filter(chest=>!chest.done).map(chest=>add("anima:"+chest.name,
      "Open the "+chest.name+" destruction treasure",chest.name,chest.state,{type:"collection",value:"anima"}));
    add("anima","Recruit Anima at Baaj Temple","Baaj Temple","Activate the six statues after collecting the temple treasures.",{type:"collection",value:"anima"},deps);
  }
  if(expanded.has("celestials")){
    const mirror=endgameRoute(current).find(step=>step.key==="mirror");
    const deps=mirror&&!mirror.done?[add("mirror",mirror.name,"Macalania",mirror.detail,{type:"collection",value:"celestials"})]:[];
    for(const weapon of ffxCollection(current,"celestials").filter(row=>!row.done))add("celestial:"+weapon.name,
      "Power "+weapon.name,"Celestial Weapons","Follow the weapon, crest and sigil checklist. Shared mirror work is included once.",{type:"collection",value:"celestials"},deps);
  }
  const darkDeps=[];
  if(expanded.has("dark")){
    const gear=armor("dark");
    for(let i=0;i<8;i++)if(!(current.progress?.darkAeons&(1<<i)))darkDeps.push(add("dark:"+i,
      "Defeat "+prepDarkAeons[i],prepDarkAeons[i],darkAeonTips[darkFightIds[i]],{type:"prep",value:"dark-"+darkFightIds[i]},gear));
  }
  if(expanded.has("penance")&&!arenaDefeated(current,"Penance"))add("penance","Defeat Penance","Airship",ffxPrepPlans.penance.advice,
    {type:"prep",value:"penance"},[...darkDeps,...armor("penance")]);
  if(expanded.has("captures"))for(const name of allArenaFiends)capture(name,10,"Ten of every fiend");
  for(const [item,quantity] of settings.items)needItem(item,quantity,"Stock target");
  const sourceIndex=itemSourceIndex();
  for(const row of materials.values()){
    row.owned=inventory.get(row.item)||0;row.short=Math.max(0,row.needed-row.owned);row.reasons=[...row.reasons];
    if(!row.short)continue;
    const farm=arenaFarms.find(([id])=>Number(id)===row.item);
    const sources=sourceIndex.get(ffxData.items[row.item])||[];
    row.sources=sources;
    const available=sources.filter(source=>!creations.has(source.name)||creations.get(source.name).ready||arenaDefeated(current,source.name));
    const chosen=available.find(source=>source.method==="Drop")||available[0]||sources[0];
    const foe=farm?.[2]||chosen?.name;
    const dep=foe?creation(foe):null;
    const area=foe&&creations.has(foe)?"Monster Arena":foe?(Object.keys(arenaRegions).find(region=>arenaRegions[region].includes(foe))||"Item sources"):"Item sources";
    add("material:"+row.item,`Gather ${row.short} ${ffxData.items[row.item]}`,area,
      `${row.owned} owned / ${row.needed} reserved. ${farm?`${farm[2]}: ${Math.ceil(row.short/farm[3])} common drops, or ${Math.ceil(row.short/(farm[3]*2))} Overkill drops. ${farm[4]}`:chosen?`${chosen.method} from ${chosen.name}; compare alternatives in item sources.`:"Open sources to choose an acquisition method."}`,
      {type:"item",value:ffxData.items[row.item]},dep?[dep]:[]);
  }
  // Creation requirements may add captures while material sources are expanded.
  for(const row of captures.values()){
    const count=arenaCaptureCount(current,row.name);row.count=count;row.reasons=[...row.reasons];
    if(count!=null&&count>=row.target)continue;
    row.area=Object.keys(arenaRegions).find(region=>arenaRegions[region].includes(row.name));
    add("capture:"+row.name,"Capture "+row.name,row.area,
      `${count==null?"Unknown":count} / ${row.target} · ${row.reasons.join(", ")}`,{type:"fiend",value:row.name});
  }
  // Stable topological order groups ready tasks by region; this is not a shortest-path claim.
  const pending=[...steps.values()],ordered=[],done=new Set();let lastArea="";
  while(pending.length){
    const ready=pending.filter(step=>[...step.deps].every(id=>!steps.has(id)||done.has(id)));
    if(!ready.length)throw Error("The goal plan contains a circular prerequisite.");
    ready.sort((a,b)=>Number(b.area===lastArea)-Number(a.area===lastArea)||a.area.localeCompare(b.area)||a.name.localeCompare(b.name));
    const next=ready[0];ordered.push({...next,deps:[...next.deps].filter(id=>steps.has(id))});done.add(next.id);lastArea=next.area;
    pending.splice(pending.indexOf(next),1);
  }
  return {steps:ordered,materials:[...materials.values()],captures:[...captures.values()]};
}
function openJourneyStep(open) {
  if(open.type==="prep")openPrep(open.value);
  else if(open.type==="creation")openArenaCreation(open.value);
  else if(open.type==="collection")choose("collections",open.value);
  else if(open.type==="item")openItemSources(open.value);
  else choose("bestiary",open.value);
}
function showJourney(current) {
  heading("Goal planner","Choose your goals. Shared captures, unlocks and materials are calculated together.");
  if(!current?.grid||current.disc!=="SLPS-25088"){panel.append(entry("Open FFX International to build a live plan"));return;}
  const configure=element("details","planner-config");configure.open=!journeySettings.goals.length;
  configure.append(element("summary","","Choose goals and party"));
  const choices=element("div","goal-choices");
  const persist=()=>{saveCompanionSetting("spira.journey.v1",journeySettings);signature="";render();};
  for(const [id,name] of journeyGoals){const label=element("label","goal-choice"),box=element("input");box.type="checkbox";box.checked=journeySettings.goals.includes(id);
    box.addEventListener("change",()=>{journeySettings.goals=box.checked?[...journeySettings.goals,id]:journeySettings.goals.filter(value=>value!==id);persist();});label.append(box,document.createTextNode(name));choices.append(label);}
  configure.append(choices,element("p","field-note","Build equipment for these characters:"));
  for(const member of current.party.filter(m=>m.id<7)){const label=element("label","goal-choice"),box=element("input");box.type="checkbox";box.checked=journeySettings.members.includes(member.id);
    box.addEventListener("change",()=>{journeySettings.members=box.checked?[...journeySettings.members,member.id]:journeySettings.members.filter(id=>id!==member.id);persist();});label.append(box,document.createTextNode(catalog.x.party[member.id]));configure.append(label);}
  panel.append(configure);
  const stock=element("details","planner-config");stock.append(element("summary","","Additional item targets"));
  const item=options("Item to gather",Object.entries(ffxData.items),8192,()=>{}),amount=element("input");amount.type="number";amount.min=1;amount.max=99;amount.value=10;amount.setAttribute("aria-label","Target quantity");
  stock.append(item,amount,action("Add stock target",()=>{if(!amount.checkValidity())return;journeySettings.items=journeySettings.items.filter(([id])=>id!==Number(item.value));journeySettings.items.push([Number(item.value),amount.valueAsNumber]);persist();}));
  for(const [id,count]of journeySettings.items)stock.append(action(`Remove ${ffxData.items[id]} ×${count}`,()=>{journeySettings.items=journeySettings.items.filter(([key])=>key!==id);persist();}));panel.append(stock);
  const plan=buildJourney(current,journeySettings);
  const first=plan.steps[0];
  if(first){const lead=element("section","journey-next");lead.append(element("h2","",first.name),element("p","",first.detail),action("Open next step",()=>openJourneyStep(first.open),true));panel.append(lead);}
  panel.append(element("p","field-note",`${plan.steps.length} remaining steps · grouped by area after prerequisites. Different armor builds reserve separate materials. Farming drop counts are estimates.`));
  const route=element("ol","journey-route");
  for(const step of plan.steps){const li=element("li");li.append(element("strong","",step.name),element("p","field-note",step.area),element("p","",step.detail),action("View details",()=>openJourneyStep(step.open)));route.append(li);}
  if(!plan.steps.length)panel.append(entry(journeySettings.goals.length||journeySettings.items.length?"Selected goals are satisfied":"Choose a goal to start"));
  panel.append(route);
  if(plan.materials.length){panel.append(element("h2","","Shared material ledger"));const sheet=element("div","sheet");for(const row of plan.materials)sheet.append(entry(ffxData.items[row.item],`${row.owned} owned · ${row.needed} reserved · ${row.short} missing`,row.reasons.join("; ")));panel.append(sheet);}
}
