"use strict";

// Arithmetic adapted from Grayfox96/FFX-RNG-tracker (MIT notice bundled).
// Results describe one command. Enemy AI, counters and subsequent choices are not simulated.
let battleCompareMember=0,battleCompareTarget="",battleCompareMode="commands";
function battleCtbDelay(agility,rank,haste=false,slow=false) {
  const bands=[[1,28],[2,26],[3,24],[4,20],[6,16],[9,15],[11,14],[14,13],[16,12],[18,11],[22,10],[28,9],[34,8],[43,7],[61,6],[97,5],[169,4],[255,3]];
  let ticks=(bands.find(([end])=>agility<=end)||bands.at(-1))[1]*Math.max(1,rank);
  if(haste)ticks=Math.floor(ticks/2);if(slow)ticks*=2;return Math.min(255,ticks);
}
function battleHighMultiply(a,b) {
  const product=BigInt(a)*BigInt(b),denominator=4294967295n;
  return Number(product/denominator-(product<0n&&product%denominator!==0n?1n:0n));
}
function battleActionElements(action, abilities) {
  const elements = new Set(action.elements);
  if (action.weapon) for (const [ability, element] of [["Firestrike","Fire"],["Icestrike","Ice"],
    ["Lightningstrike","Thunder"],["Waterstrike","Water"]]) {
    if (abilities.has(ability)) elements.add(element);
  }
  return [...elements];
}
function battleSingleDamage(action,user,target,roll,critical=false) {
  const status=actor=>new Set(statusEffects("x",actor).split(" · "));
  const us=status(user),ts=status(target),ua=user.battleAttributes,ta=target.battleAttributes;
  const gear=(user.gear||[]).filter(g=>g.equipped),weapon=gear.find(g=>g.type===0);
  const auto=new Set(gear.flatMap(g=>g.abilities).filter(id=>id!=null).map(id=>ffxData.abilities[id]));
  const targetAuto=new Set((target.gear||[]).filter(g=>g.equipped).flatMap(g=>g.abilities).filter(id=>id!=null));
  const ref=target.battleId>=20?battleModelData.monsters[target.id]:null;
  if(ref?.immune||(action.type==="Physical"&&ref?.physicalImmune)||(action.type==="Magical"&&ref?.magicImmune))return 0;
  const base=action.weapon?weapon.power:action.power;let damage=0;
  const f=action.formula;
  if(f==="Fixed")damage=Math.floor(base*50*(roll+240)/256);
  else if(f==="Fixed (no variance)")damage=base*50;
  else if(f.startsWith("Percentage"))damage=ref?.percentImmune?0:Math.floor((action.mpDamage?(f.includes("Current")?target.mp:target.maxMp):(f.includes("Current")?target.hp:target.maxHp))*base/16);
  else if(f==="CTB")damage=Math.floor((target.ctb||0)*base/16);
  else if(f!=="No Damage"){
    const physical=f.includes("Strength"),healing=f==="Healing";
    const offensive=ua[physical?0:2]+(user.boosts?.[physical?0:2]||0);
    const defense=healing||f.includes("Piercing")||ts.has(physical?"Armor Break":"Mental Break")?0:Math.max(1,ta[physical?1:3]);
    let power;
    if(physical||f==="Special Magic")power=Math.floor(offensive**3/32)+30;
    else if(healing)power=Math.floor((offensive+base)/2)*base;
    else power=Math.floor((battleHighMultiply(offensive**2,0x2aaaaaab)+base)*base/4);
    const mitigation=730-Math.floor(battleHighMultiply(defense*51-Math.floor(battleHighMultiply(defense**2,0x2e8ba2e9)/2),0x66666667)/4);
    const d1=power*mitigation,d2=battleHighMultiply(d1,-1282606671);
    const d3=Math.floor((d1+d2)/512)*(15-(target.boosts?.[physical?0:2]||0));
    damage=Math.floor((d3+battleHighMultiply(d3,-2004318071))/8);
    if(physical||f==="Special Magic")damage=Math.floor(damage*base/16);
    damage=Math.floor(damage*(roll+240)/256);
  }
  if(critical)damage*=2;
  const elements=battleActionElements(action,auto);
  const affinities=target.battleId>=20?ffxData.enemies[target.id]?.affinities||{}:{};
  if(!(target.battleId>=20))for(const name of ["Fire","Ice","Thunder","Water"]){
    const equipped=[...targetAuto].map(id=>ffxData.abilities[id]);const prefix=name==="Thunder"?"Lightning":name;
    if(equipped.includes(prefix+" Eater"))affinities[name]="Absorbs";
    else if(equipped.includes(prefix+"proof"))affinities[name]="Immune";
    else if(equipped.includes(prefix+" Ward"))affinities[name]="Resists";
  }
  let mods=[];for(const e of new Set(elements))mods.push(({Weak:1.5,Resists:.5,Immune:0,Absorbs:-1})[affinities[e]]??1);
  if(mods.length){const highest=Math.max(...mods);for(const mod of highest===1.5?mods.filter(m=>m===1.5):[highest])damage=Math.trunc(damage*mod);}
  if(action.type==="Physical"){
    if(ts.has("Protect"))damage=Math.floor(damage/2);
    if(us.has("Berserk"))damage=Math.floor(damage*1.5);
    if(us.has("Power Break"))damage=Math.floor(damage/2);
  } else if(action.type==="Magical"){
    if(auto.has("Magic Booster"))damage=Math.floor(damage*1.5);
    if(ts.has("Shell"))damage=Math.floor(damage/2);
    if(us.has("Magic Break"))damage=Math.floor(damage/2);
  }
  if(action.alchemy&&auto.has("Alchemy"))damage*=2;
  const physical=action.type==="Physical",magical=action.type==="Magical";
  if(physical||magical){
    const bonus=battleModelData.bonuses[physical?"STRENGTH_BONUSES":"MAGIC_BONUSES"];
    const defense=battleModelData.bonuses[physical?"DEFENSE_BONUSES":"MAGIC_DEF_BONUSES"];
    const boost=gear.flatMap(g=>g.abilities).reduce((n,id)=>n+(bonus[id]||0),0);
    damage+=Math.floor(damage*boost/100);damage-=Math.floor(damage*[...targetAuto].reduce((n,id)=>n+(defense[id]||0),0)/100);
  }
  if(action.armored&&ffxData.enemies[target.id]?.armored&&target.battleId>=20&&!auto.has("Piercing")&&!ts.has("Armor Break"))damage=Math.floor(damage/3);
  if(action.drains){if(us.has("Zombie"))damage*=-1;if(ts.has("Zombie"))damage*=-1;}
  damage=Math.min(damage,action.neverLimit?9999:action.alwaysLimit||auto.has("Break Damage Limit")?99999:9999);
  if(action.heals&&!ts.has("Zombie"))damage*=-1;
  return damage;
}
function compareBattleAction(current,user,target,id) {
  const action=battleModelData.actions[id];if(!action)return null;
  const us=new Set(statusEffects("x",user).split(" · ")),ts=new Set(statusEffects("x",target).split(" · "));
  const weapon=user.gear?.find(g=>g.type===0&&g.equipped),autos=new Set((user.gear||[]).filter(g=>g.equipped).flatMap(g=>g.abilities).map(id=>ffxData.abilities[id]));
  let mp=action.mp;if(mp&&autos.has("One MP Cost"))mp=1;else {if(action.magic&&autos.has("Magic Booster"))mp*=2;if(autos.has("Half MP Cost"))mp=Math.floor(mp/2);}
  const issues=[];
  if(!user.battleAttributes||!target.battleAttributes)issues.push("Live battle attributes are unavailable.");
  if(action.weapon&&(!weapon||!Number.isInteger(weapon.power)))issues.push("Weapon power is unavailable.");
  if(action.weapon&&weapon?.celestial)issues.push("Celestial weapon scaling is not modeled.");
  if(action.reflect&&ts.has("Reflect"))issues.push("Reflected target selection is not modeled.");
  const nulEffects={Fire:"NulBlaze",Ice:"NulFrost",Thunder:"NulShock",Water:"NulTide"};
  const requiredNuls=battleActionElements(action,autos).map(element=>nulEffects[element]).filter(Boolean);
  if(requiredNuls.length&&requiredNuls.every(effect=>ts.has(effect)))issues.push("A Nul effect can block this action.");
  const incapacitated=["KO","Petrify","Sleep","Confuse"].find(effect=>us.has(effect));
  if(user.hp<=0||incapacitated)issues.push("This character cannot act while "+(incapacitated||"KO")+" is active.");
  if(us.has("Berserk")&&action.name!=="Attack")issues.push("Berserk restricts this character to Attack.");
  if(action.magic&&us.has("Silence"))issues.push("This character is silenced.");
  if(user.mp<mp)issues.push("Not enough MP.");
  if(Number(id)<0x3000&&!(itemAmounts(current.items).get(Number(id))>0))issues.push("No stock remaining.");
  const supported=["No Damage","Strength","Piercing Strength","Magic","Piercing Magic","Healing","Fixed","Fixed (no variance)","Percentage Total","Percentage Current","CTB"];
  if(!supported.includes(action.formula))issues.push("This damage formula is not modeled.");
  const delay=user.battleAttributes?battleCtbDelay(user.battleAttributes[4],action.rank,us.has("Haste"),us.has("Slow")):null;
  const hits=action.hitFormula==="Always Hits"||ts.has("Sleep")||ts.has("Petrify")?100:null;
  let hit=hits;
  if(hit===null&&user.battleAttributes&&target.battleAttributes){
    const ua=user.battleAttributes,ta=target.battleAttributes;
    let accuracy=ua[7];if(action.hitFormula.includes("2.5"))accuracy=Math.floor(accuracy*2.5);else if(action.hitFormula.includes("1.5"))accuracy=Math.floor(accuracy*1.5);else if(action.hitFormula.includes("0.5"))accuracy=Math.floor(accuracy/2);
    let base=action.hitTable?[25,30,30,40,40,50,60,80,100][Math.min(8,Math.max(0,Math.floor(battleHighMultiply(accuracy*2,0x66666667)/2)-ta[6]+10))]:action.accuracy-ta[6];
    if(action.dark&&us.has("Darkness"))base=Math.floor(battleHighMultiply(base,0x66666667)/4);
    hit=Math.max(0,Math.min(101,base+Math.max(1,ua[5])-Math.max(1,ta[5])+(user.boosts?.[4]||0)+(target.boosts?.[5]||0)+10*((user.boosts?.[1]||0)-(target.boosts?.[3]||0))))/101*100;
  }
  const ref=target.battleId>=20?battleModelData.monsters[target.id]:null;
  const statuses=Object.entries(action.statuses).map(([name,chance])=>{
    const resistance=ref?.resists[name];
    return {name,chance:action.removes?null:resistance==null?null:chance===255?100:resistance===255?0:chance===254?100:Math.max(0,Math.min(101,chance-resistance))/101*100};
  });
  const rolls=issues.length?[]:Array.from({length:32},(_,roll)=>battleSingleDamage(action,user,target,roll));
  return {id:Number(id),name:action.name,mp,delay,hit,statuses,issues,buffs:action.buffs||{},pool:action.mpDamage?"MP":action.ctbDamage?"CTB":"HP",
    min:rolls.length?Math.min(...rolls):null,max:rolls.length?Math.max(...rolls):null,
    critical:!issues.length&&action.crit?battleSingleDamage(action,user,target,31,true):null};
}
function showApParticipation(current) {
  if(!current.battle||current.disc!=="SLPS-25088")return;
  const details=element("details","planner-config");details.append(element("summary","","AP participation"));
  const rows=current.party.filter(m=>m.id<7);
  for(const member of rows){const blocked=!!(member.statusBits&5);
    details.append(entry(catalog.x.party[member.id],member.apParticipated==null?"Not available":member.apParticipated?"Participation recorded":"Has not participated",
      blocked?"KO or Petrify currently prevents AP at victory. Recover before finishing.":"Victory status rules still apply. AP sharing, if enabled, can also set this flag."));}
  panel.append(details);
}
function showBattleComparison(current) {
  heading("Battle comparison","Compare supported commands using live attributes and reference enemy defenses. Damage ranges are estimates, not guarantees.");
  if(reconnecting||current?.paused){panel.append(entry("Waiting for a fresh battle frame","","Resume the game and reconnect before comparing actions."));return;}
  if(!current?.battle||current.disc!=="SLPS-25088"){panel.append(entry("Enter an FFX International battle to compare actions"));return;}
  const party=current.party.filter(m=>m.id<7&&m.active&&m.hp>0),foes=(current.enemies||[]).filter(m=>m.hp>0&&isFiend(ffxData.enemies[m.id]));
  if(!party.length||!foes.length){panel.append(entry("Waiting for the next stable battle frame"));return;}
  if(!party.some(m=>m.id===battleCompareMember))battleCompareMember=party[0].id;
  const targets=[...foes.map(m=>["enemy:"+m.slot,enemyName(m.id),m]),...party.map(m=>["ally:"+m.id,catalog.x.party[m.id],m])];
  if(!targets.some(([key])=>key===battleCompareTarget))battleCompareTarget=targets[0][0];
  const user=party.find(m=>m.id===battleCompareMember),target=targets.find(([key])=>key===battleCompareTarget)[2];
  const controls=element("div","filters");controls.append(options("Acting character",party.map(m=>[m.id,catalog.x.party[m.id]]),user.id,id=>{battleCompareMember=Number(id);signature="";render();}),
    options("Comparison target",targets.map(([key,name])=>[key,name]),battleCompareTarget,key=>{battleCompareTarget=key;signature="";render();}),
    options("Action category",[["commands","Commands"],["items","Items"]],battleCompareMode,mode=>{battleCompareMode=mode;signature="";render();}));panel.append(controls);
  const available=Object.entries(battleModelData.actions).filter(([id,a])=>battleCompareMode==="commands"?
    Number(id)>=0x3000&&(a.name==="Attack"||user.commands?.includes(Number(id))):Number(id)<0x2010&&itemAmounts(current.items).get(Number(id))>0)
    .sort((a,b)=>Number(b[1].name==="Attack")-Number(a[1].name==="Attack")||a[1].name.localeCompare(b[1].name));
  const sheet=element("div","sheet");
  if(!available.length)sheet.append(entry("No supported actions in this category","","Choose another character or category."));
  for(const [id]of available){const result=compareBattleAction(current,user,target,id),row=entry(result.name,`${result.mp} MP · ${result.delay??"?"} CTB ticks`);
    if(result.issues.length)row.append(element("p","field-note",result.issues.join(" ")));
    else {const heal=result.max<0;row.append(element("p","",result.min===0&&result.max===0?"No direct damage predicted":heal?`${Math.abs(result.max)}–${Math.abs(result.min)} ${result.pool} restored before the cap`:`${result.min}–${result.max} ${result.pool} damage on a successful noncritical hit`));
      if(result.hit!=null)row.append(element("p","field-note",`${result.hit.toFixed(1)}% estimated hit chance${result.critical!=null?` · up to ${result.critical} on a critical hit`:""}`));
      }
    for(const [name,stacks]of Object.entries(result.buffs))row.append(element("p","field-note",`${name}: +${stacks} stack, up to the game’s five-stack cap.`));
    for(const effect of result.statuses)row.append(element("p","field-note",`${effect.name}: ${effect.chance==null?"check target effects":effect.chance.toFixed(1)+"% base status chance if the hit lands"}`));sheet.append(row);}
  panel.append(sheet,element("p","field-note","CTB ticks are command recovery cost. Enemy affinities and status resistance use reference data; temporary immunity, Defend, weapon status effects, counters and scripted phase changes are not simulated. The existing turn list shows the game’s forecast for the command currently aimed."));
  showApParticipation(current);
}
