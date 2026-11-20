"use strict";

function garmentPracticePath(topology, start, blocked, steps, initialMask = 0) {
  const [nodes,edges] = topology;
  const path = {nodes:[],edges:[],mask:initialMask,moves:[]};
  if (!nodes[start] || blocked.has(start)) return path;
  path.nodes.push(start);
  for (const index of steps) {
    const edge = edges[index];
    if (!edge) break;
    const [a,b,mask] = edge;
    const at = path.nodes.at(-1);
    const to = a === at ? b : b === at ? a : -1;
    if (to < 0 || blocked.has(to)) break;
    path.nodes.push(to);
    path.edges.push(index);
    path.mask |= mask;
  }
  const at = path.nodes.at(-1);
  for (const [index,[a,b,mask]] of edges.entries()) {
    const to = a === at ? b : b === at ? a : -1;
    if (to >= 0 && !blocked.has(to)) path.moves.push({to,index,mask});
  }
  return path;
}

function garmentRehearsal(topology, rewards, plan, live, canvas) {
  const stage = element("div","garment-stage");
  const pins = element("div","garment-pins");
  stage.append(canvas,pins);
  const body = element("div","garment-practice");
  const toggle = action("Rehearse spherechanges",() => {
    plan.practicing = !plan.practicing;
    refresh();
  });
  let refresh;
  const name = i => live?.names[i] || "Slot " + (i+1);
  function show(start,blocked,initial,refreshPlan) {
    refresh = refreshPlan;
    body.hidden = pins.hidden = !plan.practicing;
    toggle.textContent = plan.practicing ? "Return to route" : "Rehearse spherechanges";
    toggle.setAttribute("aria-pressed",String(!!plan.practicing));
    if (!plan.practicing) return false;
    const key = JSON.stringify([start,live?.names]);
    if (plan.rehearsalOrigin !== key) {
      plan.rehearsalOrigin = key;
      plan.steps = [];
    }
    const path = garmentPracticePath(topology,start,blocked,plan.steps,initial);
    plan.steps = path.edges;
    const at = path.nodes.at(-1);
    const active = rewards.filter(([mask]) => mask && (mask & path.mask) === mask);
    const previousKey = document.activeElement?.dataset.practiceKey;
    const readout = element("div","rehearsal-readout");
    readout.setAttribute("role","status");
    readout.append(element("h3","",at == null ? "Starting slot unavailable" : "Practice · " + name(at)));
    if (at != null) {
      const colors = x2GateNames(path.mask).join(", ") || "None";
      readout.append(element("p","","Gates · " + colors));
      if (active.length) readout.append(element("p","practice-bonus","Bonuses · " + active.map(([,effect])=>effect).join(" · ")));
      if (initial) readout.append(element("p","field-note","Already crossed in battle · " + x2GateNames(initial).join(", ")));
    }
    const actions = element("div","filters practice-history");
    const undo = action("Undo step",() => { plan.steps.pop(); refresh(); });
    const reset = action("Start over",() => { plan.steps = []; refresh(); });
    undo.dataset.practiceKey = "undo";
    reset.dataset.practiceKey = "reset";
    undo.disabled = reset.disabled = !plan.steps.length;
    actions.append(undo,reset);
    const moves = element("div","practice-moves");
    pins.replaceChildren();
    const take = index => { plan.steps.push(index); refresh(); };
    for (const [i,[x,y]] of topology[0].entries()) {
      const choices = path.moves.filter(move => move.to === i);
      const pin = action(String(i+1),() => {
        if (choices.length === 1) take(choices[0].index);
        else moves.querySelector('[data-practice-key="move-' + choices[0].index + '"]')?.focus();
      });
      const closest = Math.min(...topology[0].filter((_,index) => index !== i)
        .map(([xx,yy]) => Math.max(Math.abs(x-xx),Math.abs(y-yy))));
      pin.style.setProperty("--pin-room",Math.min(100,100*closest/124) + "%");
      pin.replaceChildren(element("span","practice-pin-face",i+1));
      pin.disabled = !choices.length;
      pin.dataset.practiceKey = "pin-" + i;
      if (i === at) pin.classList.add("practice-current");
      pin.setAttribute("aria-label","Slot " + (i+1) + ", " + name(i) + (i === at ? ", current practice position" : ""));
      pin.style.left = (100*x/124) + "%";
      pin.style.top = (100*y/124) + "%";
      pins.append(pin);
    }
    for (const {to,index,mask} of path.moves) {
      const move = action((to+1) + " · " + name(to),() => take(index));
      move.dataset.practiceKey = "move-" + index;
      move.append(element("small","",mask ? x2GateNames(mask).join(" + ") + " gate" : "Open link"));
      moves.append(move);
    }
    if (!path.moves.length) moves.append(element("p","field-note","Choose an occupied starting slot or adjust Available slots."));
    const trail = element("p","practice-trail",path.nodes.map(i => name(i)).join(" → "));
    body.replaceChildren(readout,moves,actions,trail);
    drawX2Grid(canvas,topology,path,at,blocked,0);
    if (previousKey) {
      const button = stage.parentElement?.querySelector('[data-practice-key="' + previousKey + '"]');
      const target = button && !button.disabled ? button : moves.querySelector("button") || toggle;
      target.focus({preventScroll:true});
    }
    return true;
  }
  return {stage,toggle,body,show};
}
