"use strict";

let blitzBreakSlots=new Set(),blitzLiveCarrier=null;
function blitzMatchAdvice(match,breakSlots=[]) {
  if(!match||!Array.isArray(match.players))return null;
  const carrier=match.players.find(p=>p.slot===match.carrier);
  if(!carrier)return {headline:"Ball in transition",detail:"Wait for a stable carrier before choosing a play.",players:match.players};
  const ours=carrier.slot<8,opponents=match.players.filter(p=>(p.slot<8)!==ours&&p.slot%8!==5)
    .map(p=>({...p,distance:Math.hypot(p.x-carrier.x,p.y-carrier.y)})).sort((a,b)=>a.distance-b.distance);
  const mates=match.players.filter(p=>(p.slot<8)===ours&&p.slot!==carrier.slot&&p.slot%8!==5)
    .map(p=>({...p,distance:Math.hypot(p.x-carrier.x,p.y-carrier.y),
      clearance:Math.min(...opponents.map(o=>Math.hypot(o.x-p.x,o.y-p.y)))})).sort((a,b)=>b.clearance-a.clearance);
  const marked=opponents.filter(p=>breakSlots.includes(p.slot)),remaining=opponents.filter(p=>!breakSlots.includes(p.slot));
  const minEndurance=carrier.stats.EN-marked.reduce((sum,p)=>sum+Math.ceil(p.stats.AT*1.5),0),
    maxEndurance=carrier.stats.EN-marked.reduce((sum,p)=>sum+Math.floor(p.stats.AT*.5),0);
  const keeper=match.players.find(p=>(p.slot<8)!==ours&&p.slot%8===5);
  let headline,detail;
  if(!ours){headline="Defend the passing lanes";detail=`${blitzPlayers[carrier.id]} has the ball. Watch the nearest defender’s AT against the carrier’s ${carrier.stats.EN} EN; bring support if one tackle is unlikely to stop them.`;}
  else if(marked.length&&maxEndurance<=0){headline="Avoid this break attempt";detail="Even the favorable base tackle range exhausts your endurance. Pass or shoot without taking these tackles, or draw fewer defenders.";}
  else if(marked.length&&minEndurance<=0){headline="Breaking through is risky";detail="The base tackle range can exhaust your endurance. Look for a pass to space before committing.";}
  else if(match.score?.[0]>match.score?.[1]&&match.period-match.elapsed<45){headline="Protect the lead";detail="Keep possession and use short passes to open teammates. A low-percentage shot gives the other team a chance to counter.";}
  else {headline=mates.length?`Look for ${blitzPlayers[mates[0].id]} in space`:"Create a clear passing lane";detail="The suggested teammate has the most space from defenders right now. Check the route of the pass and the defenders shown in the game’s encounter menu.";}
  return {headline,detail,carrier,ours,opponents,mates,keeper,marked,remaining,minEndurance,maxEndurance};
}
function showLiveBlitz(current) {
  const match=current.blitzMatch;
  if(!match||current.paused||reconnecting){
    panel.append(entry(current.paused?"Match paused":"Waiting for a live Blitzball match","",
      "The pool view reads the International match script in the Blitzball pool. It clears during transitions instead of retaining a previous play."));
    showBlitzMatchTips(true);return;
  }
  if(blitzLiveCarrier!==match.carrier){blitzLiveCarrier=match.carrier;blitzBreakSlots.clear();}
  const advice=blitzMatchAdvice(match,[...blitzBreakSlots]);
  const time=seconds=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`;
  panel.append(element("h2","",`${match.score[0]} – ${match.score[1]} · ${time(match.elapsed)} / ${time(match.period)}`));
  const hero=entry(advice.headline,"Live match advice",advice.detail);hero.classList.add("journey-next");panel.append(hero);
  const canvas=element("canvas","grid-canvas blitz-pool");canvas.setAttribute("aria-label","Live Blitzball pool. Circles: your team. Squares: opposition. Gold ring: ball carrier. Player details follow.");panel.append(canvas);
  const width=canvas.clientWidth||400,height=320,dpr=window.devicePixelRatio||1;canvas.width=width*dpr;canvas.height=height*dpr;canvas.style.height=height+"px";
  const ctx=canvas.getContext("2d");ctx.scale(dpr,dpr);const extent=Math.max(600,...match.players.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)])),scale=Math.min(width-48,height-48)/(extent*2);
  const point=p=>[width/2+p.x*scale,height/2-p.y*scale];
  ctx.strokeStyle="#55757a";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(width/2,height/2,580*scale,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(width/2,20);ctx.lineTo(width/2,height-20);ctx.stroke();
  for(const p of match.players){const [x,y]=point(p);ctx.beginPath();if(p.slot<8)ctx.arc(x,y,7,0,Math.PI*2);else ctx.rect(x-6,y-6,12,12);ctx.fillStyle=p.slot<8?"#91e1cf":"#a9bdf6";ctx.fill();
    if(p.slot===match.carrier){ctx.strokeStyle="#f4cc90";ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);ctx.stroke();}
    ctx.fillStyle="#eff5ef";ctx.font="11px sans-serif";ctx.textAlign="center";ctx.fillText(blitzPlayers[p.id],x,y-14);
  }
  panel.append(element("p","field-note","Circles: your team · squares: opponents · gold ring: confirmed ball carrier. Advice pauses while the ball is in flight or the carrier is uncertain."));
  if(advice.carrier){const p=advice.carrier;panel.append(entry(blitzPlayers[p.id],`${p.hp} HP · EN ${p.stats.EN} · PA ${p.stats.PA} · SH ${p.stats.SH}`,"Current match stats include the script’s adjustments."));}
  if(advice.ours){
    const details=element("details","planner-config");details.append(element("summary","","Compare a break attempt"),element("p","field-note","Select the defenders you would break through in the game. Nearby players are not automatically treated as engaged defenders."));
    for(const p of advice.opponents){const label=element("label","goal-choice"),check=element("input");check.type="checkbox";check.checked=blitzBreakSlots.has(p.slot);check.addEventListener("change",()=>{if(check.checked)blitzBreakSlots.add(p.slot);else blitzBreakSlots.delete(p.slot);signature="";render();});label.append(check,document.createTextNode(`${blitzPlayers[p.id]} · AT ${p.stats.AT} · BL ${p.stats.BL}`));details.append(label);}
    if(advice.marked.length)details.append(entry("Endurance after selected tackles",`${advice.minEndurance} to ${advice.maxEndurance}`,"Base ±50% stat variation. Techniques and status applications can change this range; this is not a success probability."));
    details.open=blitzBreakSlots.size>0;panel.append(details);
    if(advice.keeper)panel.append(entry("Shot check",`SH ${advice.carrier.stats.SH} vs ${blitzPlayers[advice.keeper.id]} · CA ${advice.keeper.stats.CA}`,"Swim closer before shooting. Travel, blocking defenders and techniques can reduce or alter the shot; this comparison excludes those losses."));
  }
  const roster=element("details","planner-config");roster.append(element("summary","","All players · current match stats"));
  for(const p of match.players)roster.append(entry(blitzPlayers[p.id],`${p.hp} HP · ${p.slot<8?"Your team":"Opponent"}`,Object.entries(p.stats).map(([key,value])=>`${key} ${value}`).join(" · ")));
  panel.append(roster);
}
