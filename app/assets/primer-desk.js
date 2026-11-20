"use strict";

// Volume I teaches English A. Each index holds the Al Bhed letter used in its place.
const alBhedAlphabet = "YPLTAVKREZGMSHUBXNCDIJFQOW";
let selectedPrimer = null;
const primerReading = {phrase:"",reveal:false,open:false};

function decipherPrimerPhrase(phrase, mask, reveal) {
  return phrase.replace(/[a-z]/gi, letter => {
    const index = alBhedAlphabet.indexOf(letter.toUpperCase());
    if (!reveal && !(mask & (1 << index))) return "·";
    const english = String.fromCharCode(65 + index);
    return letter === letter.toLowerCase() ? english.toLowerCase() : english;
  });
}

function primerReader(mask) {
  const box = element("details","primer-reader");
  box.dataset.detailKey = "primer-reader";
  box.open = primerReading.open;
  box.addEventListener("toggle",()=>{ if (box.isConnected) primerReading.open=box.open; });
  box.append(element("summary","","Read an Al Bhed phrase"));
  const label = element("label","plan-field","Al Bhed text");
  const input = element("textarea");
  input.rows=2; input.maxLength=300; input.value=primerReading.phrase;
  input.placeholder="Rammu!"; input.setAttribute("aria-label","Al Bhed text");
  label.append(input);
  const check = element("input"); check.type="checkbox"; check.checked=primerReading.reveal;
  const mode = element("label","goal-choice");
  mode.append(check,document.createTextNode("Use the full alphabet"));
  const output = element("output","primer-translation");
  const describe = element("p","field-note","Type the original Al Bhed letters. Each dot is a letter your primers haven’t taught you.");
  function translate() {
    primerReading.phrase=input.value; primerReading.reveal=check.checked;
    output.textContent=decipherPrimerPhrase(input.value,mask,check.checked);
  }
  input.addEventListener("input",translate); check.addEventListener("change",translate);
  box.append(label,mode,output,describe); translate();
  return box;
}

function showPrimerShelf(current, records, overview, sheet) {
  const mask=current.progress.primers;
  const indexed=records.map((record,i)=>({...record,i}));
  const oneTime=indexed.filter(row=>row.i>=18 && row.i<=21 && !row.done);
  const visible=indexed.filter(row=>!collectionMissingOnly || !row.done);
  const title=element("h2","","Primer shelf");
  const grid=element("div","primer-shelf");
  grid.setAttribute("role","group"); grid.setAttribute("aria-label","Primer volumes");
  const detail=element("section","primer-detail");
  const inspect=(row)=>{
    selectedPrimer=row.i;
    for (const button of grid.children) button.setAttribute("aria-pressed",String(Number(button.value)===row.i));
    detail.replaceChildren(element("h3","",row.name+" · "+row.place),
      element("p","primer-state",row.state+" · "+alBhedAlphabet[row.i]+" → "+String.fromCharCode(65+row.i)),
      element("p","",row.detail));
    if (row.state==="Pickup window closed") detail.append(element("p","field-note","A compilation sphere can import volumes owned on another compatible save."));
  };
  overview.append(title);
  if (oneTime.length) {
    const urgent=element("div","primer-deadlines");
    urgent.append(element("strong","","One-time pickups"));
    for (const row of oneTime) urgent.append(action(primerNumbers[row.i]+" · "+row.place,()=>{
      inspect(row);
      const button=grid.querySelector('[value="'+row.i+'"]');
      button?.focus({preventScroll:true}); detail.scrollIntoView({block:"nearest"});
    }));
    overview.append(urgent);
  }
  for (const row of visible) {
    const button=action("",()=>inspect(row));
    button.value=String(row.i);
    button.dataset.owned=String(row.done);
    button.setAttribute("aria-label",row.name+" · "+row.place+" · "+row.state);
    button.append(element("strong","",primerNumbers[row.i]),element("small","",row.done ? "Owned" : "Missing"));
    grid.append(button);
  }
  sheet.append(grid);
  if (visible.length) {
    sheet.append(detail);
    inspect(visible.find(r=>r.i===selectedPrimer) || visible.find(r=>r.state==="Check now") || visible.find(r=>!r.done) || visible[0]);
  } else sheet.append(element("p","field-note","All 26 primers collected."));
  sheet.append(primerReader(mask));
}
