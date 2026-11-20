"use strict";

const practiceExample = {core:"4",entry:"1235",border:"201630280415",mode:"count",previous:"3"};
let practiceOpen=false;
let spherePractice=null;

function makeSpherePractice(round,source) {
  const moves=sphereBreakMoves(round.core,round.entry,round.border,round.mode,Number(round.previous));
  if (!moves) return null;
  return {source,core:Number(round.core),values:Array.from(round.entry+round.border,Number),
    mode:round.mode,previous:Number(round.previous),plan:moves[0]?.coins || [],picks:[]};
}

function practiceSum(board) { return board.picks.reduce((sum,id)=>sum+board.values[id],0); }
function practiceFinished(board) { return board.picks.length>0 && practiceSum(board)%board.core===0; }
function practiceLegal(board,id) {
  return Number.isInteger(id) && id>=0 && id<16 && board.values[id]>0 && !board.picks.includes(id) &&
    !practiceFinished(board) && (board.picks.length>0 || id<4);
}

// After a free choice, find a short continuation that ends on its first multiple.
function practiceHint(board) {
  if (practiceFinished(board)) return null;
  if (board.picks.every((id,i)=>id===board.plan[i]) && board.plan.length>board.picks.length) return board.plan[board.picks.length];
  const used=board.picks.reduce((mask,id)=>mask | (1<<id),0);
  const queue=[{mask:used,sum:practiceSum(board),first:null}];
  const visited=new Set([used]);
  for (let head=0;head<queue.length;head++) {
    const row=queue[head];
    for (let id=0;id<16;id++) {
      const bit=1<<id;
      if (row.mask & bit || !board.values[id] || (!row.mask && id>=4)) continue;
      const mask=row.mask|bit, sum=row.sum+board.values[id], first=row.first ?? id;
      if (sum % board.core===0) return first;
      if (!visited.has(mask)) { visited.add(mask); queue.push({mask,sum,first}); }
    }
  }
  return null;
}

function spherePracticePanel() {
  spherePractice ??= makeSpherePractice(practiceExample,"Example board");
  const box=element("details","sphere-practice");
  box.dataset.detailKey="sphere-practice"; box.open=practiceOpen;
  box.append(element("summary","","Practice Sphere Break"));
  box.addEventListener("toggle",()=>{if (box.isConnected) practiceOpen=box.open;});
  const label=element("h3"), tally=element("p","practice-tally");
  const board=element("div","practice-board"); board.setAttribute("role","group"); board.setAttribute("aria-label","Practice coins");
  const path=element("p","practice-path");
  const hint=element("p","field-note"); hint.setAttribute("role","status");
  const cells=new Map();
  const core=element("strong","practice-core");
  const position=id=>{
    const i=sphereBreakBoard.indexOf(id);
    return String.fromCharCode(65+i%5)+(1+Math.floor(i/5));
  };
  board.append(element("span"));
  for (const letter of "ABCDE") { const col=element("small","practice-axis",letter); col.setAttribute("aria-hidden","true"); board.append(col); }
  for (const [slot,id] of sphereBreakBoard.entries()) {
    if (slot%5===0) { const row=element("small","practice-axis",String(1+Math.floor(slot/5))); row.setAttribute("aria-hidden","true"); board.append(row); }
    if (id==null) {board.append(element("span"));continue;}
    if (id===16) {board.append(core);continue;}
    const button=action("",()=>{
      if (!practiceLegal(spherePractice,id)) {
        hint.textContent=practiceFinished(spherePractice) ? "This turn is complete. Undo or start again." :
          !spherePractice.picks.length && id>=4 ? "Start with one of the four entry coins." : "Choose an unused coin with a value.";
        return;
      }
      spherePractice.picks.push(id); draw();
    });
    button.dataset.coin=String(id); button.classList.add(id<4 ? "practice-entry" : "practice-border");
    cells.set(id,button); board.append(button);
  }
  const undo=action("Undo coin",()=>{spherePractice.picks.pop();draw();});
  const reset=action("Restart turn",()=>{spherePractice.picks=[];draw();});
  const next=action("Show next coin",()=>{
    const id=practiceHint(spherePractice);
    for (const btn of cells.values()) btn.removeAttribute("data-hint");
    if (id==null) {hint.textContent="No break from here. Undo a coin to try another route.";return;}
    cells.get(id).dataset.hint="true";
    hint.textContent="Try "+position(id)+" · "+(id<4?"entry":"border")+" "+spherePractice.values[id]+".";
  });
  const use=action("Practice calculator board",()=>{
    const selected=makeSpherePractice(sphereBreakRound,"Calculator board");
    if (!selected) {hint.textContent="Enter the core, four entry coins and twelve border digits in the calculator first.";return;}
    spherePractice=selected; draw();
  });
  const example=action("Load example",()=>{spherePractice=makeSpherePractice(practiceExample,"Example board");draw();});
  const actions=element("div","filters"); actions.append(next,undo,reset);
  const sources=element("div","filters"); sources.append(use,example);
  box.append(label,tally,board,path,actions,hint,sources);
  function draw() {
    const game=spherePractice, sum=practiceSum(game), finished=practiceFinished(game);
    label.textContent=game.source+" · Core "+game.core;
    core.textContent=String(game.core); core.setAttribute("aria-label","Core "+game.core);
    const target=(Math.floor(sum/game.core)+1)*game.core;
    tally.textContent=finished ? "Break at "+sum+" · "+sum/game.core+"× core" : "Sum "+sum+" · Next multiple "+target;
    for (const [id,btn] of cells) {
      const value=game.values[id], step=game.picks.indexOf(id)+1;
      btn.replaceChildren(element("strong","",value ? String(value) : "—"));
      if (step) btn.append(element("small","","#"+step));
      btn.setAttribute("aria-pressed",String(!!step)); btn.removeAttribute("data-hint");
      btn.disabled=!value;
      btn.setAttribute("aria-label",position(id)+" · "+(id<4?"entry":"border")+" "+value+(step?" · pick "+step:""));
    }
    path.textContent=game.picks.length ? game.picks.map(id=>position(id)+" ("+game.values[id]+")").join(" → ") : "Start with an entry coin beside the core.";
    const count=game.picks.length, silver=game.picks.filter(id=>id>=4).length;
    const echo=game.previous>0 && (game.mode==="count" && game.core!==1 && count===game.previous || game.mode==="multiple" && sum/game.core===game.previous);
    hint.textContent=finished ? count+" coins · "+silver+" border"+(echo?" · Echo matched":"") : "";
    undo.disabled=reset.disabled=!count; next.disabled=finished;
  }
  draw(); return box;
}
