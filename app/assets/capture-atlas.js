"use strict";

let atlasPlace = "";
let atlasMissing = false;

function captureRegionsAt(current, goal) {
  return Object.entries(arenaRegions).map(([region,names]) => {
    const species = names.map(name => ({name,count:hasCaptureData(current) ? arenaCaptureCount(current,name) : null}));
    const known = species.filter(s => s.count != null);
    const remaining = known.reduce((sum,s) => sum + Math.max(0,goal-s.count),0);
    return {region,species,remaining,unknown:species.length-known.length,met:known.filter(s => s.count >= goal).length};
  }).sort((a,b) => Number(a.met === a.species.length)-Number(b.met === b.species.length) ||
    a.unknown-b.unknown || a.remaining-b.remaining || a.region.localeCompare(b.region));
}

function showCaptureAtlas(current) {
  const host = element("section","capture-atlas");
  const controls = element("div","filters");
  const goal = options("Atlas capture goal",[1,5,10].map(n=>[n,n+" of each"]),arenaTarget,value=>{
    arenaTarget = Number(value); draw();
  });
  const scope = action("Unfinished only",() => { atlasMissing = !atlasMissing; draw(); });
  const body = element("div");
  controls.append(goal,scope);
  host.append(element("h2","","Capture atlas"),controls,body);
  panel.append(host);
  function draw() {
    const rows = captureRegionsAt(current,arenaTarget);
    const selected = rows.find(row=>row.region === atlasPlace);
    scope.setAttribute("aria-pressed",String(atlasMissing));
    body.replaceChildren();
    if (selected) {
      const back = action("All regions",() => { atlasPlace = ""; draw(); body.querySelector('[aria-label^="'+selected.region+' ·"]')?.focus(); });
      const title = element("h3","",selected.region);
      title.tabIndex = -1;
      body.append(back,title,element("p","sub",selected.met + " of " + selected.species.length + " species at goal"));
      const list = element("div","atlas-fiends");
      for (const {name,count} of selected.species.filter(s => !atlasMissing || s.count == null || s.count < arenaTarget)) {
        const row = element("div","atlas-species");
        const dossier = action(name,() => choose("bestiary",name));
        const stock = element("span","",count == null ? "Unknown" : count+" / "+arenaTarget);
        row.append(dossier,stock);
        if (count != null && count < arenaTarget) row.append(action("Hunt",() => openArenaHunt({focus:name})));
        list.append(row);
      }
      if (!list.childElementCount) list.append(element("p","field-note","Every species here has reached this goal."));
      body.append(list);
      return;
    }
    const list = element("div","atlas-regions");
    for (const row of rows.filter(row=>!atlasMissing || row.met < row.species.length)) {
      const button = action("",() => { atlasPlace = row.region; draw(); body.querySelector("h3").focus({preventScroll:true}); });
      const count = row.unknown ? row.unknown+" unknown" : row.remaining ? row.remaining+" catches left" : "Goal met";
      button.setAttribute("aria-label",row.region+" · "+count);
      button.append(element("strong","",row.region),element("small","",count));
      const strip = element("span","atlas-strip");
      strip.setAttribute("aria-hidden","true");
      for (const {count:n} of row.species) {
        const cell = element("i");
        cell.dataset.state = n == null ? "unknown" : n >= arenaTarget ? "met" : n ? "started" : "empty";
        strip.append(cell);
      }
      button.append(strip);
      list.append(button);
    }
    body.append(element("p","field-note","Each segment is one species. Select a region for names, exact counts and hunting spots."),list);
    if (!list.childElementCount) body.append(element("p","","Every region has reached this goal."));
  }
  draw();
}

function captureDossier(current,name) {
  const regions = Object.entries(arenaRegions).filter(([,fiends]) => fiends.includes(name));
  if (!regions.length || !hasCaptureData(current)) return null;
  const count = arenaCaptureCount(current,name);
  const details = element("details","capture-dossier");
  details.dataset.detailKey = "capture-" + name;
  details.append(element("summary","","Arena dossier · " + (count == null ? "Unknown count" : count + " / 10 captured")),
    element("p","",regions.map(([region])=>region).join(" · ")));
  const openers = element("div","filters");
  openers.append(action("Find hunting spots",() => openArenaHunt({focus:name})),
    trackFiendButton(current,name,regions[0][0],arenaTarget));
  const goals = [...regions.map(([region])=>[areaCreations[Object.keys(arenaRegions).indexOf(region)],1]),
    ...speciesCreations.filter(([, ,names])=>names.split("|").includes(name)).map(([creation,target])=>[creation,target])];
  for (const [creation,target] of goals) openers.append(action(creation + " · " + target + " each",() => openArenaCreation(creation)));
  details.append(openers);
  return details;
}
