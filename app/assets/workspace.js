"use strict";

function readCompanionSetting(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function saveCompanionSetting(key,value) {
  try { localStorage.setItem(key,JSON.stringify(value));return true; } catch { return false; }
}
function detailKey(details) {
  return details.dataset.detailKey || details.querySelector("summary")?.textContent;
}
function rememberExpansionUi() {
  if (panel.dataset.page !== tab || !(tab.startsWith("plan-") || ["workspace","planner","grid","grid-lab","mix","equip","battle-lab","trials","blitzball","chapter-checklist","arena","journal","collections","challenges"].includes(tab))) return null;
  const focused = panel.contains(document.activeElement) ? document.activeElement : null;
  return {
    scroll: panel.scrollTop,
    focus: focused?.getAttribute("aria-label"),
    start: focused?.selectionStart,
    end: focused?.selectionEnd,
    open: new Map(Array.from(panel.querySelectorAll("details"), details => [detailKey(details), details.open]))
  };
}
function restoreExpansionUi(saved) {
  panel.dataset.page = tab;
  if (!saved) return;
  for (const details of panel.querySelectorAll("details")) {
    const key = detailKey(details);
    if (saved.open.has(key)) details.open = saved.open.get(key);
  }
  const focused = saved.focus && Array.from(panel.querySelectorAll("[aria-label]"))
    .find(node => node.getAttribute("aria-label") === saved.focus);
  if (focused) {
    focused.focus({preventScroll:true});
    if (saved.start != null && focused.selectionStart != null) focused.setSelectionRange(saved.start, saved.end);
  }
  panel.scrollTop = saved.scroll;
}
let workspaceQuery = "";
let workspaceKind = "", workspaceLimit = 40;
let workspaceGamePins = readCompanionSetting("spira.workspace.game-pins",false) === true;
let workspacePins = readCompanionSetting("spira.workspace.v1",[]);
if (!Array.isArray(workspacePins)) workspacePins = [];
workspacePins=workspacePins.filter(p=>p&&typeof p.key==="string"&&typeof p.name==="string"&&typeof p.kind==="string").slice(0,40);
let workspaceNote = readCompanionSetting("spira.workspace.note.v1","");
const workspaceTools = [
  ["planner","Goal planner","Plan several goals from your save","x"],
  ["grid-lab","Grid sandbox","Build and compare hypothetical Sphere Grid routes","x"],
  ["battle-lab","Battle comparison","Compare supported actions against your target","x"],
  ["status","Status","Live party, battle and story guidance"],
  ["glance","Glance","Full-screen party vitals, current fight and field objective"],
  ["workspace","Workspace","Search the companion and open saved pins"],
  ["guide","Guide","Offline FFX Jegged walkthrough"],
  ["supplies","Items","Inventory, recovery supplies and spheres"],
  ["equip","Equipment","Gear, accessories, abilities and FFX-2 Garment Grid rehearsal"],
  ["party","Party","Formation, health and character progress"],
  ["mix","Rikku’s Mix","Explore Mix by effect, Overdrive recipes and ingredient partners","x"],
  ["grid","Sphere Grid","Node inspector, symbols, activation progress and routes","x"],
  ["arena","Monster Arena","Capture targets, hunts and creation rewards","x"],
  ["bestiary","Bestiary","Fiends, drops, steals and bribes","x"],
  ["x2-bestiary","Bestiary","Observed FFX-2 battle forms","x2"],
  ["field-guide","Fiend Guide","Oversouls and Gun Mage abilities","x2"],
  ["missables","Missables","Story deadlines and collectibles","x"],
  ["collections","Collections","Primers, Celestials and Aeons","x"],
  ["map","Map","Field map, player position and exits"],
  ["journal","Journal","Journey recap, observed route and personal checkpoint"],
  ["setup","Setup","Connections and companion preferences"],
  ["prep","Boss Prep","Armor, materials and AP farming","x"],
  ["blitzball","Blitzball","Team builder, rewards and techniques","x"],
  ["challenges","Challenges","Minigame records and live route guidance"],
  ["trials","Cloister guide","Temple routes and destruction sphere treasures","x"],
  ["chapter-checklist","Chapter Checklist","Destination board, chapter checks and missing scenes","x2"],
  ["profiles","Profiles","Separate playthroughs and portable backups"]
].map(([tab,name,detail,game]) => ({key:"tool:"+tab, kind:"Tool", tab, name, detail, game}));
if (typeof fieldPlans !== "undefined") for(const plan of fieldPlans) {
  workspaceTools.push({...plan,key:"tool:"+plan.tab,kind:"Tool"});
}
function toolSupportsGame(tab, game) {
  const required = workspaceTools.find(tool => tool.tab === tab)?.game;
  return !required || required === game;
}
function workspaceIndex(current) {
  const game = current?.game || "x";
  const rows = workspaceTools.filter(tool => (!tool.game || tool.game === game) &&
    (!current || workspaceToolAvailable(tool.tab,current)));
  const data = game === "x" ? ffxData : {items:Object.fromEntries(catalog.x2.recovery.map((name,i)=>[8192+i,name]))};
  for (const [id,value] of Object.entries(data.items || {})) {
    const name = typeof value === "string" ? value : value.name || value[0];
    if (name) rows.push({key:game+":item:"+id,kind:"Item",name,detail:"Inventory and acquisition sources",game,id:Number(id)});
  }
  if (game === "x") {
    if(current?.disc && typeof mixResults!=="undefined") for(const mix of mixResults) {
      rows.push({key:"x:mix:"+mix.index,kind:"Mix",name:mix.name,detail:mix.effect,game});
    }
    for (const [id,foe] of Object.entries(ffxData.enemies)) if (foe.name && foe.hp) rows.push({key:"x:fiend:"+id,kind:"Fiend",name:foe.name,detail:(foe.area || "")+" · Drops, steals and bribes",id:Number(id),game});
    for (const [id,value] of Object.entries(ffxData.abilities)) {
      const name = typeof value === "string" ? value : value.name || value[0];
      if (name) rows.push({key:"x:ability:"+id,kind:"Equipment ability",name,detail:"Customization materials",id:Number(id),game});
    }
    for (const [id,name] of blitzPlayers.entries()) rows.push({key:"x:recruit:"+id,kind:"Blitzball player",name,detail:"Scouting and stat comparison",id,game});
    for (const [id,name] of Object.entries(ffxRooms)) rows.push({key:"x:room:"+id,kind:"Location",name,detail:"Walkthrough section",id:Number(id),game,anchor:guideRooms.get(Number(id))});
    for (const [id,[name]] of Object.entries(ffxData.types)) if (ffxData.types[id][2]) rows.push({key:"x:node:"+id,kind:"Grid ability",name,detail:"Find on the current Sphere Grid",id:Number(id),game});
  }
  else if(current?.loadout){
    for(const [key,kind,table,owned]of [["accessories","Accessory",current.loadout.accessoryInfo,current.loadout.accessories.map(p=>p[0])],
      ["grids","Garment Grid",current.loadout.gridInfo,current.loadout.grids],
      ["jobs","Dressphere",current.loadout.dressphereInfo,current.loadout.dresspheres.map(p=>p[0]-0x5000)]]){
      for(const [id,info]of Object.entries(table||{}))if(info?.[0])rows.push({key:`x2:${key}:${id}`,kind,name:info[0],detail:info[1]||"",id:Number(id),game,collection:key,owned:owned.includes(Number(id))});
    }
  }
  if(game==="x2" && current?.oversoul) {
    for(const [i,[name,fiends,note]] of x2BlueBullets.entries())
      rows.push({key:"x2:blue:"+i,kind:"Blue Bullet",name,detail:[fiends.join(", "),note].filter(Boolean).join(" · "),id:i,game});
    for(const [name,,place,floor] of x2OversoulEntries)
      rows.push({key:"x2:oversoul:"+name,kind:"Oversoul",name,detail:[place,floor && "Via Infinito "+floor].filter(Boolean).join(" · "),game});
  }
  return rows;
}
function workspaceToolAvailable(tab,current) {
  if (["missables","collections"].includes(tab)) return !!current.progress;
  if (tab==="map" || tab==="x2-bestiary" || tab==="mix") return !!current.disc;
  if (tab==="field-guide") return !!current.oversoul;
  if (tab==="chapter-checklist") return !!current.chapter;
  if (tab==="equip") return !!(current.grid || current.loadout);
  if (["grid","arena","bestiary","prep","blitzball"].includes(tab)) return !!current.grid;
  return true;
}
function workspaceWords(text) {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[’']/g,"").replace(/[^a-z0-9]+/g," ").trim();
}
const workspaceAliases = new Map([["bhpl","break hp limit"],["bdl","break damage limit"],["od","overdrive"]]);
function searchWorkspace(rows,query,kind="") {
  const words=workspaceWords(query).split(/\s+/).filter(Boolean).map(word=>workspaceAliases.get(word) || word);
  if(!words.length)return rows.filter(row=>row.kind===(kind||"Tool"));
  const phrase=words.join(" "), matches=[];
  for(const row of rows) {
    if(kind && row.kind!==kind)continue;
    const name=workspaceWords(row.name), text=name+" "+workspaceWords(row.kind+" "+row.detail);
    if(words.every(word=>text.includes(word)))matches.push({row,rank:name===phrase?0:name.startsWith(phrase)?1:
      words.every(word=>name.includes(word))?2:3});
  }
  return matches.sort((a,b)=>a.rank-b.rank || a.row.name.localeCompare(b.row.name)).map(match=>match.row);
}
function openWorkspaceEntry(row) {
  if (row.kind === "Tool") { choose(row.tab);return; }
  if (row.kind === "Mix") { mixInStock=false;choose("mix",row.name);return; }
  if (row.kind === "Oversoul") { openX2FieldGuide("oversoul",0,row.name);return; }
  if (row.kind === "Blue Bullet") {
    const current=sample||frame, member=[0,1,2].find(id=>!x2BlueLearned(current,id,row.id))??0;
    openX2FieldGuide("blue",member,row.name);return;
  }
  if (row.kind === "Item") {
    if (row.game === "x") openItemSources(row.name);else { inventoryQuery=row.name;choose("supplies"); }
  } else if (row.kind === "Fiend") choose("bestiary",row.name);
  else if (row.kind === "Equipment ability") { equipmentView="customize";customizationQuery=row.name;customizationReady=false;choose("equip"); }
  else if (row.kind === "Blitzball player") { blitzCompareIds=[row.id===6?50:6,row.id];blitzView="compare";choose("blitzball"); }
  else if (row.kind === "Grid ability") {
    const current=frame || sample;
    if (!current?.grid) { choose("grid-lab");return; }
    const graph=liveGridLayout(current);selectedGridNode=graph.nodes.findIndex((_,i)=>gridBytes(current,i)[0]===row.id);
    if (selectedGridNode<0) selectedGridNode=null;choose("grid");
  } else if (row.kind === "Location") { if(row.anchor)openGuideSection(row.anchor); }
  else if(row.game==="x2"&&row.collection){x2Collection=row.collection;x2Search=row.name;choose("equip");}
}
function toggleWorkspacePin(row) {
  const index = workspacePins.findIndex(pin=>pin.key===row.key);
  const next = index < 0 ? [...workspacePins,row] : workspacePins.filter((_,i)=>i!==index);
  if (next.length > 40) return false;
  if (!saveCompanionSetting("spira.workspace.v1",next)) return false;
  workspacePins=next;
  if (typeof refreshShellPins === "function") refreshShellPins();
  return true;
}
function promoteWorkspacePin(key) {
  const pin=workspacePins.find(item=>item.key===key);
  if(!pin)return false;
  const next=[pin,...workspacePins.filter(item=>item.key!==key)];
  if(!saveCompanionSetting("spira.workspace.v1",next))return false;
  workspacePins=next;
  if (typeof refreshShellPins === "function") refreshShellPins();
  return true;
}
function openWorkspaceFromGuide() {
  guideDetour=true;guideHost.classList.add("guide-detour");clearGuideSuggestion();choose("workspace");
}
function showWorkspace(current) {
  heading("Workspace","Find a tool or keep the things you need within reach.");
  const active=SpiraProfiles.registry();
  panel.append(action(active.profiles.find(p=>p.id===active.active).name+" · Profiles",()=>choose("profiles")));
  const search=element("input","workspace-search");search.type="search";search.placeholder="Items, abilities, places, tools…";
  search.setAttribute("aria-label","Search companion");search.value=workspaceQuery;
  const results=element("div","sheet"),pins=element("div","sheet"),status=element("p","field-note");status.setAttribute("role","status");
  const index=workspaceIndex(current);
  const kinds=[...new Set(index.map(item=>item.kind))].sort();
  if(!kinds.includes(workspaceKind))workspaceKind="";
  const filter=options("Search category",[["","All categories"],...kinds.map(kind=>[kind,kind])],workspaceKind,value=>{
    workspaceKind=value;workspaceLimit=40;draw();
  });
  const pinFilter=element("label","goal-choice"),check=element("input");check.type="checkbox";check.checked=workspaceGamePins;
  pinFilter.append(check,document.createTextNode("Current game pins only"));
  check.addEventListener("change",()=>{
    if(!saveCompanionSetting("spira.workspace.game-pins",check.checked)){
      check.checked=workspaceGamePins;status.textContent="Could not save the pin filter.";return;
    }
    workspaceGamePins=check.checked;draw();
  });
  function row(item, available = true, canPromote = false) {
    const owned=item.kind==="Item" && current?.items ? itemAmounts(current.items).get(item.id) || 0 : null;
    const node=entry(item.name,item.kind+(owned==null?"":` · ${owned} owned`),item.detail);
    const open=action("Open "+item.name,()=>openWorkspaceEntry(item));
    open.disabled = !available;
    if(item.kind!=="Location"||item.anchor) node.append(open);
    if(item.collection&&!item.owned){open.disabled=true;node.append(element("p","field-note","Reference entry · not in your collection"));}
    const pinned=workspacePins.some(pin=>pin.key===item.key);
    node.append(action(pinned?"Unpin":"Pin",()=>{
      if(!toggleWorkspacePin(item)) {status.textContent="Could not save the pin. Keep up to 40 pins and check available storage.";return;}
      draw();
    }));
    if(canPromote)node.append(action("Move to first",()=>{
      if(!promoteWorkspacePin(item.key)){status.textContent="Could not save the pin order.";return;}
      draw();
    }));
    return node;
  }
  function draw(){
    results.replaceChildren();pins.replaceChildren();
    const matches=searchWorkspace(index,workspaceQuery,workspaceKind);
    status.textContent=workspaceQuery||workspaceKind?`${Math.min(workspaceLimit,matches.length)} of ${matches.length} results`:"";
    for(const item of matches.slice(0,workspaceLimit)) results.append(row(item));
    if(matches.length>workspaceLimit)results.append(action("Show more results",()=>{
      const start=workspaceLimit;workspaceLimit+=40;draw();
      results.children[start]?.querySelector("button")?.focus({preventScroll:true});
    }));
    if(!matches.length) results.append(entry("No matches","","Try an item name, an effect, or a tool such as Grid."));
    for (const pin of workspacePins) {
      const live = index.find(item => item.key === pin.key);
      if(workspaceGamePins && !live)continue;
      pins.append(row(live || pin, !!live, pins.childElementCount>0));
    }
    if(!workspacePins.length) pins.append(entry("Keep useful tools here","","Pin results below to build your own workspace."));
    else if(!pins.childElementCount)pins.append(entry("No available pins for this game"));
  }
  search.addEventListener("input",()=>{workspaceQuery=search.value;workspaceLimit=40;draw();});
  const noteLabel=element("label","plan-field","Playthrough notes");
  const note=element("textarea");note.rows=3;note.maxLength=10000;note.value=typeof workspaceNote==="string"?workspaceNote:"";
  note.setAttribute("aria-label", "Playthrough notes");
  note.addEventListener("input", () => {
    workspaceNote = note.value;
    if (!saveCompanionSetting("spira.workspace.note.v1", workspaceNote)) {
      status.textContent = "Notes could not be saved. Copy this text before leaving the page.";
    }
  });
  noteLabel.append(note);
  const searchBar=element("div","filters");searchBar.append(search,filter);
  panel.append(element("h2","","Pinned"),pinFilter,pins,noteLabel,element("h2","","Search everything"),searchBar,status,results);draw();
}
