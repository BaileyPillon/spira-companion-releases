"use strict";

let blitzEditingSlot = null;
let blitzChallenger = null;

function openPositionBoard(container, slot, team, candidates, effectiveLocks, redraw) {
  container.replaceChildren();
  if (slot == null) return;
  const current = team[slot], role = blitzSlots[slot];
  const ranked = [...candidates].sort((a,b)=>blitzRoleScore(b.stats,role)-blitzRoleScore(a.stats,role) || a.name.localeCompare(b.name));
  const available = ranked.filter(player=>player.id !== current.id && !effectiveLocks.includes(player.id));
  const player = available.find(p=>p.id === blitzChallenger) || available[0];
  const title=element("h3","",blitzSlotNames[slot] + " · " + current.name);
  title.tabIndex=-1;
  container.append(title);
  if (player) {
    const optionsList=available.map(p=>[p.id,p.name]);
    const select=options("Try a substitute",optionsList,player.id,v=>{
      blitzChallenger=Number(v);
      openPositionBoard(container,slot,team,candidates,effectiveLocks,redraw);
      container.querySelector("select").focus({preventScroll:true});
    });
    const field=element("label","plan-field","Try a substitute");
    field.append(select);
    container.append(field);
    const stats = element("table","position-comparison");
    stats.createCaption().textContent = "Position stats";
    const top=stats.createTHead().insertRow();
    for (const label of ["Stat",current.name,player.name]) {
      const th=element("th","",label); th.scope="col"; top.append(th);
    }
    const body=stats.createTBody();
    for (const key of Object.keys(blitzRoles[role].weights)) {
      const row=body.insertRow();
      const label=element("th","",blitzStatLabels[blitzStatKeys.indexOf(key)]);
      label.scope="row"; row.append(label);
      row.insertCell().textContent=current.stats[key]; row.insertCell().textContent=player.stats[key];
    }
    const at=team.findIndex(p=>p.id===player.id);
    container.append(stats,element("p","field-note",blitzCandidateContract(player) + " · " + blitzReferenceLabel(player) +
      (at>=0 ? " · Currently suggested at " + blitzSlotNames[at].toLowerCase() : "")),
      action("Try " + player.name + " here",()=>{
        blitzTeamLocks[slot]=player.id;
        blitzChallenger=null;
        redraw();
        panel.querySelector(".position-workbench h3")?.focus({preventScroll:true});
      }));
  } else container.append(element("p","field-note","No other unlocked player in this pool."));
  if (effectiveLocks[slot]!=null) container.append(action("Let planner choose",()=>{
    blitzTeamLocks[slot]=null; redraw();
    panel.querySelector(".position-workbench h3")?.focus({preventScroll:true});
  }));
}

let masteryOpen=false, masteryUnfinished=false;
function masteryRows(current) {
  const ids = [...new Set(current.loadout.dresspheres.filter(([,qty])=>qty>0).map(([id])=>x2BaseJob(id-0x5000)))];
  return ids.filter(id=>x2DressphereAbilities[id]).map(id=>{
    const members=[0,1,2].map(member=>{
      const abilities=x2AbilityProgress(current.dressphereAp?.[member],id,member);
      if (!abilities.length) return null;
      const next=abilities.filter(a=>!a.done && a.ap>0).sort((a,b)=>(a.cost-a.ap)-(b.cost-b.ap))[0];
      return {learned:abilities.filter(a=>a.done).length,total:abilities.length,next};
    });
    return {id,name:x2JobName(current.loadout.dressphereInfo,id+0x5000),members};
  }).sort((a,b)=>a.name.localeCompare(b.name));
}
function showMasteryBoard(current) {
  const board=element("details","mastery-board grid-attributes");
  board.open=masteryOpen;
  board.addEventListener("toggle",()=>{if(board.isConnected) masteryOpen=board.open;});
  board.append(element("summary","","Party dressphere mastery"));
  const table=element("div","mastery-list");
  const filter=action("Unfinished jobs only",()=>{masteryUnfinished=!masteryUnfinished;draw();});
  board.append(element("p","field-note","Learned AP abilities for each owned, supported dressphere. Pick a character for the ability list."),filter,table);
  const jobs=masteryRows(current);
  function draw() {
    filter.setAttribute("aria-pressed",String(masteryUnfinished));
    table.replaceChildren();
    for (const job of jobs.filter(j=>!masteryUnfinished || j.members.some(m=>!m || m.learned<m.total))) {
      const row=element("section","mastery-job");
      row.append(element("h3","",job.name));
      const cells=element("div","mastery-characters");
      job.members.forEach((m,i)=>{
        const who=catalog.x2.party[i];
        const button=action("",()=>{
          x2Member=i; x2ApJob=job.id; x2ApOpen=true; signature=""; render();
          const select=panel.querySelector('[aria-label="AP dressphere"]');
          select?.scrollIntoView({block:"center"}); select?.focus({preventScroll:true});
        });
        button.disabled=!m;
        button.append(element("span","",who),element("strong","",m ? m.learned+" / "+m.total : "Unavailable"));
        button.setAttribute("aria-label",who+" · "+job.name+(m ? " · "+m.learned+" of "+m.total+" learned" : " · Unavailable"));
        if (m) {
          const meter=element("progress"); meter.max=m.total; meter.value=m.learned;
          meter.setAttribute("aria-hidden","true"); button.append(meter);
          if (m.next) button.title=m.next.name+" · "+(m.next.cost-m.next.ap)+" AP left";
        }
        cells.append(button);
      });
      row.append(cells); table.append(row);
    }
    if (!table.childElementCount) table.append(element("p","field-note",jobs.length ? "All mapped jobs are complete." : "No supported AP records."));
  }
  panel.append(board);
  draw();
}
