"use strict";

let gridBuilds=readCompanionSetting("spira.grid-builds.v1",[]);
if(!Array.isArray(gridBuilds))gridBuilds=[];
let activeGridBuild=null;
let gridSandboxView={zoom:1,x:null,y:null};
const newGridBuildId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,10);
const gridPlacementSpheres=new Map([[5,8279],[9,8280],[13,8281],[17,8282],[21,8283],[25,8286],[29,8284],[33,8285],[35,8277],[36,8278]]);
function gridCanReplace(type){return type===1||ffxData.types[type]?.[1]>0||/ \+\d+$/.test(ffxData.types[type]?.[0]||"");}
function validateGridBuild(value) {
  if(!value||value.version!==1||value.disc!=="SLPS-25088"||!["standard","expert"].includes(value.layout))throw Error("Choose a Spira Standard or Expert grid build.");
  const graph=ffxData[value.layout];
  if(typeof value.base?.grid!=="string"||!/^[0-9a-f]+$/i.test(value.base.grid)||value.base.grid.length%4||value.base.grid.length<graph.nodes.length*4||value.base.grid.length>4096)throw Error("The saved grid is incomplete.");
  if(!Array.isArray(value.base.party)||value.base.party.length>8||!Array.isArray(value.base.gridPositions))throw Error("The saved build has no valid party.");
  if(typeof value.name!=="string"||!value.name.trim()||value.name.length>80)throw Error("Use a build name between 1 and 80 characters.");
  if(value.id!=null&&(typeof value.id!=="string"||value.id.length>80))throw Error("Invalid build identity.");
  if(value.base.gridPositions.length!==7||value.base.gridPositions.some(n=>!Number.isInteger(n)||n<0||n>65535))throw Error("Invalid character positions.");
  if(typeof value.base.gridLinks!=="string"||!/^[0-9a-f]*$/i.test(value.base.gridLinks)||value.base.gridLinks.length%2||value.base.gridLinks.length<graph.links.length*2||value.base.gridLinks.length>1762)throw Error("The saved movement history is incomplete.");
  const ids=new Set();
  for(const m of value.base.party){
    if(!m||!Number.isInteger(m.id)||m.id<0||m.id>6||ids.has(m.id)||!Array.isArray(m.attributes)||m.attributes.length!==8||m.attributes.some(n=>!Number.isInteger(n)||n<0||n>255))throw Error("Invalid character attributes.");
    ids.add(m.id);
  }
  if(!ids.has(value.member))throw Error("This character is not in the captured party.");
  if(!Array.isArray(value.base.items)||value.base.items.length>256||value.base.items.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isInteger)||p[0]<0||p[0]>65535||p[1]<0||p[1]>255))throw Error("Invalid saved inventory.");
  if(!value.edits||typeof value.edits!=="object"||Array.isArray(value.edits)||Object.keys(value.edits).length>graph.nodes.length)throw Error("Invalid grid edits.");
  for(const [key,type]of Object.entries(value.edits))if(!/^\d+$/.test(key)||Number(key)>=graph.nodes.length||!Number.isInteger(type)||!(type===1||gridPlacementSpheres.has(type)))throw Error("A node edit is outside the supported grid.");
  for(const key of Object.keys(value.edits))if(!gridCanReplace(gridBytes(value.base,Number(key))[0]))throw Error("Command and ability nodes cannot be erased with a Clear Sphere.");
  if(!Array.isArray(value.waypoints)||value.waypoints.length>40||value.waypoints.some(id=>!Number.isInteger(id)||id<0||id>=graph.nodes.length))throw Error("Invalid route destinations.");
  if(!Number.isInteger(value.member)||value.member<0||value.member>6)throw Error("Choose one of the seven characters.");
  return value;
}
function newGridBuild(current,name="My grid plan") {
  const layout=liveGridLayout(current)===ffxData.expert?"expert":"standard";
  return {version:1,id:newGridBuildId(),disc:current.disc,layout,name,member:current.party.find(m=>m.id<7)?.id??0,edits:{},waypoints:[],
    base:{grid:current.grid,gridLinks:current.gridLinks,gridPositions:current.gridPositions.slice(),
      party:current.party.filter(m=>m.id<7).map(m=>({id:m.id,attributes:m.attributes?.slice(),sphereLevel:m.sphereLevel,maxHp:m.maxHp,maxMp:m.maxMp})),items:current.items.map(pair=>pair.slice())}};
}
function gridBuildPlan(build) {
  validateGridBuild(build);
  const graph=ffxData[build.layout],member=build.base.party.find(m=>m.id===build.member);
  const current={...build.base,grid:build.base.grid},bytes=Array.from({length:graph.nodes.length},(_,id)=>gridBytes(build.base,id));
  const costs=new Map(),add=(item,count=1)=>costs.set(item,(costs.get(item)||0)+count);
  for(const [key,type]of Object.entries(build.edits)){
    const id=Number(key),old=bytes[id][0];if(old===type)continue;
    const lock=ffxData.types[old]?.[1];
    if(lock)add(0x2050+lock);else if(old!==1)add(8287);
    if(type!==1)add(gridPlacementSpheres.get(type));
    bytes[id]=[type,0];
  }
  current.grid=bytes.map(([type,mask])=>type.toString(16).padStart(2,"0")+mask.toString(16).padStart(2,"0")).join("");
  let origin=current.gridPositions[build.member],cost=0;const path=[],unreachable=[];
  if(!Number.isInteger(origin)||origin<0||origin>=graph.nodes.length)throw Error("The captured character position is unavailable. Capture a new build from the live grid.");
  const links=Array.from({length:graph.links.length},(_,i)=>parseInt((current.gridLinks||"").slice(i*2,i*2+2),16)||0);
  for(const target of build.waypoints){
    const result=gridPath(graph,current,build.member,origin,target,true);
    if(!result.path.length){unreachable.push(target);continue;}
    cost+=result.cost;path.push(...result.path);
    for(const id of result.path){
      const [type,mask]=bytes[id],lock=ffxData.types[type]?.[1];
      if(lock){add(0x2050+lock);bytes[id]=[1,0];}
      else if(type!==1&&!(mask&(1<<build.member))){const sphere=gridActivationSphere(type);if(sphere)add(sphere);bytes[id][1]|=1<<build.member;}
    }
    for(let i=1;i<result.path.length;i++){
      const a=result.path[i-1],b=result.path[i];const link=graph.links.findIndex(([x,y])=>(x===a&&y===b)||(x===b&&y===a));
      if(link>=0)links[link]|=1<<build.member;
    }
    current.gridLinks=links.map(value=>value.toString(16).padStart(2,"0")).join("");
    current.grid=bytes.map(([type,mask])=>type.toString(16).padStart(2,"0")+mask.toString(16).padStart(2,"0")).join("");origin=target;
  }
  const changes=new Map();
  function contribute(type,sign){const match=ffxData.types[type]?.[0].match(/^(.+) \+(\d+)$/);if(match)changes.set(match[1],(changes.get(match[1])||0)+Number(match[2])*sign);}
  for(let i=0;i<bytes.length;i++){
    const [old,oldMask]=gridBytes(build.base,i),[type,mask]=bytes[i];
    if(oldMask&(1<<build.member))contribute(old,-1);if(mask&(1<<build.member))contribute(type,1);
  }
  const stats=gridAttributes.map((name,i)=>({name,before:member?.attributes?.[i],after:Number.isFinite(member?.attributes?.[i])?Math.max(0,Math.min(255,member.attributes[i]+(changes.get(name)||0))):null}));
  for(const [name,key,cap]of [["HP","maxHp",99999],["MP","maxMp",9999]])stats.unshift({name,before:member?.[key],after:Number.isFinite(member?.[key])?Math.max(0,Math.min(cap,member[key]+(changes.get(name)||0))):null});
  return {current,path:[...new Set(path)],cost,unreachable,stats,changes:[...changes],costs:[...costs].map(([item,needed])=>({item,needed}))};
}
function showGridSandbox(current) {
  if(!activeGridBuild){heading("Sphere Grid sandbox","Save and share a future build while your game continues unchanged.");
    if(current?.grid)panel.append(action("Copy current grid",()=>{activeGridBuild=newGridBuild(current);signature="";render();},true));
    else panel.append(entry("Open FFX International to copy your grid"));
  } else {
    const build=activeGridBuild;let plan;
    try{plan=gridBuildPlan(build);}catch(error){heading("Grid build needs attention");panel.append(entry(error.message),action("Close build",()=>{activeGridBuild=null;signature="";render();}));return;}
    heading("Sphere Grid sandbox",`${build.layout==="expert"?"Expert":"Standard"} · ${build.name}`);
    const controls=element("div","filters");
    const name=element("input");name.value=build.name;name.maxLength=80;name.setAttribute("aria-label","Build name");name.addEventListener("input",()=>build.name=name.value.trim()||"My grid plan");
    const member=options("Plan for character",build.base.party.map(m=>[m.id,catalog.x.party[m.id]]),build.member,id=>{build.member=Number(id);build.waypoints=[];signature="";render();});
    controls.append(name,member,action("Save build",()=>{
      build.id ||= newGridBuildId();const next=gridBuilds.filter(item=>item.id!==build.id);next.push(JSON.parse(JSON.stringify(build)));
      if(next.length>20){notice.textContent="Keep up to 20 builds. Export and remove an old build first.";return;}
      if(saveCompanionSetting("spira.grid-builds.v1",next)){gridBuilds=next;notice.textContent="Build saved in this playthrough profile.";}else notice.textContent="Could not save. Export this build before closing it.";
    }),action("Export build",()=>downloadCompanionFile("Spira-grid-build.json",JSON.stringify({format:"spira-grid-build",build},null,2))),
    action("Close build",()=>{activeGridBuild=null;signature="";render();}));
    const notice=element("p","field-note");notice.setAttribute("role","status");panel.append(controls,notice);
    const graph=ffxData[build.layout],nodeList=graph.nodes.map((_,i)=>[i,`${i+1} · ${ffxData.types[gridBytes(plan.current,i)[0]]?.[0]||"Unknown"}`]);
    const edit=element("div","filters");const node=options("Node to plan",nodeList,Math.max(0,selectedGridNode||0),value=>{selectedGridNode=Number(value);});
    const type=options("Replacement node",[["1","Empty Node"],...[...gridPlacementSpheres.keys()].map(id=>[id,ffxData.types[id][0]])],5,()=>{});
    edit.append(node,type,action("Change node in plan",()=>{if(!gridCanReplace(gridBytes(build.base,Number(node.value))[0])){notice.textContent="Command and ability nodes cannot be erased. Choose an empty, stat or locked node.";return;}build.edits[node.value]=Number(type.value);signature="";render();}),
      action("Undo this node edit",()=>{delete build.edits[node.value];signature="";render();}),
      action("Add route destination",()=>{if(build.waypoints.length<40)build.waypoints.push(Number(node.value));signature="";render();}));
    panel.append(edit,element("p","field-note","The route activates available nodes it passes. Clearing a node removes its old contribution; each character has separate activations. Plan edits apply to the shared grid."));
    const canvas=element("canvas","grid-canvas");canvas.setAttribute("aria-label","Planned grid. Gold nodes mark your route. Use the node selector to edit.");panel.append(canvas);
    const height=320,ctx=canvas.getContext("2d"),xs=graph.nodes.map(n=>n[0]),ys=graph.nodes.map(n=>n[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    gridSandboxView.x??=(minX+maxX)/2;gridSandboxView.y??=(minY+maxY)/2;
    let width,scale,drag,moved=false;
    const point=id=>[width/2+(graph.nodes[id][0]-gridSandboxView.x)*scale,height/2+(graph.nodes[id][1]-gridSandboxView.y)*scale];
    function paint(){width=canvas.clientWidth||500;const dpr=window.devicePixelRatio||1;canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.height=height+"px";ctx.scale(dpr,dpr);
      scale=Math.min((width-24)/(maxX-minX),(height-24)/(maxY-minY))*gridSandboxView.zoom;
      ctx.strokeStyle="#55757a";for(const [a,b]of graph.links){ctx.beginPath();ctx.moveTo(...point(a));ctx.lineTo(...point(b));ctx.stroke();}
      const route=new Set(plan.path);for(let i=0;i<graph.nodes.length;i++){ctx.fillStyle=route.has(i)?"#f4cc90":Object.hasOwn(build.edits,i)?"#a9bdf6":"#91e1cf";ctx.beginPath();ctx.arc(...point(i),Math.min(5,(route.has(i)?3:1.7)*Math.sqrt(gridSandboxView.zoom)),0,Math.PI*2);ctx.fill();}
      if(graph.nodes[Number(node.value)]){ctx.strokeStyle="#ffffff";ctx.lineWidth=2;ctx.beginPath();ctx.arc(...point(Number(node.value)),8,0,Math.PI*2);ctx.stroke();}
    }
    const zoom=element("div","controls");zoom.append(action("Zoom in",()=>{gridSandboxView.zoom=Math.min(12,gridSandboxView.zoom*1.6);paint();}),
      action("Zoom out",()=>{gridSandboxView.zoom=Math.max(1,gridSandboxView.zoom/1.6);paint();}),
      action("Fit grid",()=>{gridSandboxView={zoom:1,x:(minX+maxX)/2,y:(minY+maxY)/2};paint();}),
      action("Focus selected node",()=>{const [x,y]=graph.nodes[Number(node.value)];gridSandboxView={zoom:6,x,y};paint();}));canvas.before(zoom);
    panel.insertBefore(zoom,edit);panel.insertBefore(canvas,edit);
    canvas.style.touchAction="none";
    canvas.addEventListener("pointerdown",event=>{drag={x:event.clientX,y:event.clientY,panX:gridSandboxView.x,panY:gridSandboxView.y};moved=false;canvas.setPointerCapture(event.pointerId);});
    canvas.addEventListener("pointermove",event=>{if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(Math.hypot(dx,dy)>6)moved=true;if(moved){gridSandboxView.x=drag.panX-dx/scale;gridSandboxView.y=drag.panY-dy/scale;paint();}});
    canvas.addEventListener("pointerup",()=>drag=null);canvas.addEventListener("pointercancel",()=>drag=null);
    canvas.addEventListener("click",event=>{if(moved)return;const rect=canvas.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;let best=0,dist=Infinity;for(let i=0;i<graph.nodes.length;i++){const [nx,ny]=point(i),d=(nx-x)**2+(ny-y)**2;if(d<dist){best=i;dist=d;}}selectedGridNode=best;node.value=String(best);paint();});
    node.addEventListener("change",paint);
    const observer=new ResizeObserver(paint);observer.observe(canvas);releaseFieldMap=()=>observer.disconnect();paint();
    const destinations=element("ol","journey-route");build.waypoints.forEach((id,index)=>{const row=element("li","",nodeList[id][1]);row.append(action("Remove destination "+(index+1),()=>{build.waypoints.splice(index,1);signature="";render();}));destinations.append(row);});panel.append(destinations);
    panel.append(element("h2","",`Route cost · about ${plan.cost} Sphere Levels`));
    if(plan.unreachable.length)panel.append(entry("Unreachable destinations",plan.unreachable.map(id=>id+1).join(", ")));
    const stats=element("div","sheet");for(const stat of plan.stats)stats.append(entry(stat.name,`${stat.before??"Unknown"} → ${stat.after??"Unknown"}`));panel.append(stats);
    const costs=element("div","sheet"),stock=itemAmounts(current?.items||build.base.items);
    for(const {item,needed}of plan.costs){const row=entry(ffxData.items[item],`${needed} needed · ${stock.get(item)||0} owned · ${Math.max(0,needed-(stock.get(item)||0))} missing`);row.append(action("Find materials",()=>openItemSources(ffxData.items[item])));costs.append(row);}
    panel.append(element("h2","","Sphere bill"),costs);
  }
  panel.append(element("h2","","Saved builds"));
  for(const build of gridBuilds){const row=entry(build.name,build.layout);row.append(action("Open build",()=>{try{activeGridBuild=validateGridBuild(JSON.parse(JSON.stringify(build)));signature="";render();}catch(error){row.append(element("p","error",error.message));}}),action("Remove saved build",()=>{const next=gridBuilds.filter(item=>item!==build);if(saveCompanionSetting("spira.grid-builds.v1",next)){gridBuilds=next;signature="";render();}}));panel.append(row);}
  const upload=element("input");upload.type="file";upload.accept=".json,application/json";upload.setAttribute("aria-label","Import grid build");
  const error=element("p","error");error.setAttribute("role","status");
  upload.addEventListener("change",async()=>{try{const file=upload.files[0];if(!file)return;if(file.size>100000)throw Error("Choose a grid build smaller than 100 KB.");const data=JSON.parse(await file.text());if(data.format!=="spira-grid-build")throw Error("Choose a Spira grid build file.");activeGridBuild=validateGridBuild(data.build);activeGridBuild.id=newGridBuildId();signature="";render();}catch(e){error.textContent=e.message;}});panel.append(upload,error);
  if(window.SpiraSetup?.importCompanion)upload.replaceWith(action("Import grid build",()=>window.SpiraSetup.importCompanion("grid")));
}
