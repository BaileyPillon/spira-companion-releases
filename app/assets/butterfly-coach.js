"use strict";

let butterflyRouteChoice="north",butterflyRouteRun=null,butterflyLastRoom=null;
function butterflySyncRun(run,current,course) {
  if(!run||current.room!==course.room||run.room!==course.room)return null;
  const state=current.butterfly;
  if(!state)return run.active==null?run:null;
  if(run.active&&!state.active||Number.isInteger(run.caught)&&state.caught<run.caught)return null;
  return {...run,active:state.active,caught:state.caught};
}
function butterflyAdvance(run,point,course,now) {
  if(!run||!point||run.room!==course.room||now-run.last>2500||now<run.last)return null;
  if(now===run.last)return run;
  let index=run.index;
  // Only near-future waypoints are eligible; crossing a later loop cannot skip the route.
  const end=Math.min(course.path.length,index+4);
  for(let i=index;i<end;i++){
    const target=course.path[i];if(Math.hypot(point.x-target[0],point.y-target[1])<=12)index=i+1;
  }
  return {...run,index,last:now};
}
function showButterflyRoute(current) {
  const here=Object.entries(butterflyRouteData).find(([,course])=>course.room===current.room);
  if(here&&butterflyLastRoom!==current.room)butterflyRouteChoice=here[0];
  butterflyLastRoom=current.room;
  const course=butterflyRouteData[butterflyRouteChoice];
  const matching=current.room===course.room,postAirship=current.story>=2900;
  const live=matching&&postAirship&&!current.battle&&!current.paused&&!reconnecting&&!!current.fieldPlayer;
  butterflyRouteRun=live?butterflySyncRun(butterflyRouteRun,current,course):null;
  panel.append(element("h2","","Butterfly route"));
  if(matching&&current.butterfly)panel.append(entry(current.butterfly.active?`${current.butterfly.caught} / 7 butterflies caught`:"Course inactive","Read from the current course script"));
  const controls=element("div","filters");controls.append(options("Butterfly route",Object.entries(butterflyRouteData).map(([key,value])=>[key,value.name]),butterflyRouteChoice,key=>{butterflyRouteChoice=key;butterflyRouteRun=null;signature="";render();}));
  const start=action("Start route guidance",()=>{
    const first=course.landmarks[0][0];butterflyRouteRun={room:course.room,index:first,last:current.timestamp||Date.now(),
      active:current.butterfly?.active,caught:current.butterfly?.caught};paint();
  },true);start.disabled=!live;controls.append(start,action("Reset route guidance",()=>{butterflyRouteRun=null;paint();}));
  panel.append(controls,element("p","field-note",live?"Your triangle is live. The numbered route is for the post-airship course. Route progress follows your position; collected butterflies are counted by the game.":
    "Post-airship route reference. Enter this course after gaining free airship travel to show your live position. Other course layouts use different butterfly placements."));
  const canvas=element("canvas","grid-canvas butterfly-route");canvas.setAttribute("aria-label",course.name+" route. Triangle: live player. Square: start. Diamond: chest. Numbered circles: route landmarks.");
  const note=element("p","field-note");note.setAttribute("role","status");panel.append(canvas,note);
  const legend=element("p","field-note","Triangle: you · square: start · diamond: chest · numbered circles: route landmarks. Live blue butterflies are circles; visible red hazards are crosses. Invisible collision zones are not mapped.");panel.append(legend);
  const list=element("ol","journey-route");for(const [index,label]of course.landmarks){const row=element("li","",label);row.append(element("p","field-note",`Route point ${index+1}`));list.append(row);}panel.append(list);
  let player=live?current.fieldPlayer:null;
  const unit=matching&&Number.isFinite(current.fieldMap?.unit)&&current.fieldMap.unit>0?current.fieldMap.unit:1;
  const terrain=matching?fieldTerrain(current):null;
  const xs=course.path.map(p=>p[0]),ys=course.path.map(p=>p[1]);
  const bounds=[Math.min(...xs)-25,Math.min(...ys)-25,Math.max(...xs)+25,Math.max(...ys)+25];
  function paint(){
    const width=canvas.clientWidth||400,height=340,dpr=window.devicePixelRatio||1;
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.height=height+"px";
    const ctx=canvas.getContext("2d");ctx.scale(dpr,dpr);
    const scale=Math.min((width-28)/(bounds[2]-bounds[0]),(height-28)/(bounds[3]-bounds[1]));
    const x0=(width-(bounds[2]-bounds[0])*scale)/2,y0=(height-(bounds[3]-bounds[1])*scale)/2;
    const point=([x,y])=>[x0+(x-bounds[0])*scale,y0+(y-bounds[1])*scale];
    if(terrain){ctx.save();ctx.translate(x0-bounds[0]*scale,y0-bounds[1]*scale);ctx.scale(scale*unit,scale*unit);ctx.fillStyle="#325b67";ctx.fill(terrain.path);ctx.restore();}
    ctx.lineWidth=2;ctx.strokeStyle="#a9bdf6";ctx.beginPath();course.path.forEach((p,i)=>{const [x,y]=point(p);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.stroke();
    if(live)for(const marker of (frame||current).butterfly?.actors||[]){const [x,y]=point([marker.x,marker.y]);ctx.lineWidth=2;ctx.beginPath();
      if(marker.kind==="blue"){ctx.fillStyle="#9bcfff";ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();}
      else{ctx.strokeStyle="#ff9e9e";ctx.moveTo(x-5,y-5);ctx.lineTo(x+5,y+5);ctx.moveTo(x+5,y-5);ctx.lineTo(x-5,y+5);ctx.stroke();}}
    course.landmarks.forEach(([index,label],i)=>{const [x,y]=point(course.path[index]);ctx.fillStyle="#142831";ctx.strokeStyle="#91e1cf";ctx.lineWidth=2;
      ctx.beginPath();if(i===0)ctx.rect(x-7,y-7,14,14);else if(i===course.landmarks.length-1){ctx.moveTo(x,y-9);ctx.lineTo(x+9,y);ctx.lineTo(x,y+9);ctx.lineTo(x-9,y);ctx.closePath();}else ctx.arc(x,y,9,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle="#eff5ef";ctx.font="bold 11px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(String(i+1),x,y);
    });
    if(player){const raw={x:player.x*unit,y:player.y*unit};
      butterflyRouteRun=butterflySyncRun(butterflyRouteRun,frame||current,course);
      if(butterflyRouteRun)butterflyRouteRun=butterflyAdvance(butterflyRouteRun,raw,course,(frame||current).timestamp||Date.now());
      const [x,y]=point([raw.x,raw.y]);ctx.fillStyle="#f4cc90";ctx.strokeStyle="#101e25";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,y-8);ctx.lineTo(x+7,y+6);ctx.lineTo(x-7,y+6);ctx.closePath();ctx.fill();ctx.stroke();
      if(butterflyRouteRun&&butterflyRouteRun.index<course.path.length){const next=course.path[butterflyRouteRun.index],p=point(next);ctx.strokeStyle="#f4cc90";ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(...p);ctx.stroke();ctx.setLineDash([]);}
    }
    note.textContent=butterflyRouteRun?butterflyRouteRun.index>=course.path.length?"Route complete. Check the game’s result and open the chest before leaving.":`Next route point ${butterflyRouteRun.index+1} / ${course.path.length}. Keep checking the game’s butterfly count.`:"Start guidance at the marked start. A feed gap stops route progress.";
  }
  updateFieldMarker=next=>{player=live?next:null;if(!player)butterflyRouteRun=null;paint();};
  const observer=new ResizeObserver(paint);observer.observe(canvas);releaseFieldMap=()=>observer.disconnect();paint();
}
