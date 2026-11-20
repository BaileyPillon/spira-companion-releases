"use strict";

const journalKey = "spira.journal.v1";
const journeyBook = {};
const journalDraft = {};
let journalGame = "";
let journalSaved = true;

function validJournalFrame(row, game) {
  return row?.game === game && [row.room,row.battles,row.gil,row.timestamp].every(n=>Number.isSafeInteger(n) && n>=0) &&
    Number.isFinite(new Date(row.timestamp).getTime()) && typeof row.disc === "string";
}
function readJourneyBook() {
  const data = readCompanionSetting(journalKey,{});
  for (const game of ["x","x2"]) {
    const book = data?.[game];
    const mark = book?.mark;
    journeyBook[game] = {
      latest:validJournalFrame(book?.latest,game) ? book.latest : null,
      route:Array.isArray(book?.route) ? book.route.filter(row=>validJournalFrame(row,game)).slice(0,24) : [],
      mark:validJournalFrame(mark,game) && typeof mark.note === "string" ? {...mark,note:mark.note.slice(0,400)} : null
    };
  }
}
readJourneyBook();

function journalSnapshot(frame) {
  return {game:frame.game,disc:frame.disc,room:frame.room,story:frame.story ?? null,chapter:frame.chapter ?? null,
    gil:frame.gil,battles:frame.battles,timestamp:frame.timestamp};
}

function observeJourney(frame) {
  if (!frame || !((frame.game === "x" && frame.disc === "SLPS-25088") ||
      (frame.game === "x2" && frame.disc === "SLUS-20672"))) return;
  const next = journalSnapshot(frame);
  if (!validJournalFrame(next,next.game)) return;
  const book = journeyBook[next.game];
  const old = book.latest;
  // Refresh the last-seen time during long stays without writing on every emulator poll.
  if (old && next.timestamp >= old.timestamp && next.timestamp - old.timestamp < 60000 &&
      ["disc","room","story","chapter","gil","battles"].every(k=>old[k] === next[k])) return;
  if (!old || old.room !== next.room || old.disc !== next.disc) book.route = [next,...book.route].slice(0,24);
  book.latest = next;
  journalSaved = saveCompanionSetting(journalKey,journeyBook);
}

function journalDelta(mark,latest) {
  if (mark.disc !== latest.disc || latest.battles < mark.battles ||
      (mark.game === "x" && Number.isInteger(mark.story) && Number.isInteger(latest.story) && latest.story < mark.story) ||
      (mark.chapter != null && latest.chapter != null && latest.chapter < mark.chapter)) {
    return "These readings may be from different saves. Set a new checkpoint to compare from here.";
  }
  const battles = latest.battles - mark.battles, gil = latest.gil - mark.gil;
  return battles + (battles === 1 ? " battle" : " battles") + " · " +
    (gil>0?"+":"") + number.format(gil) + " gil compared with the checkpoint.";
}

function showJourneyBook(current) {
  const games = ["x","x2"].filter(game=>journeyBook[game].latest);
  const live = current && ["SLPS-25088","SLUS-20672"].includes(current.disc) && state === "live" && !sample;
  const game = live ? current.game : games.includes(journalGame) ? journalGame :
    games.sort((a,b)=>journeyBook[b].latest.timestamp-journeyBook[a].latest.timestamp)[0];
  heading("Journey journal");
  if (!game) { panel.append(element("p","field-note","Load a supported PS2 save to record your route.")); return; }
  const book = journeyBook[game];
  if (!live && games.length>1) panel.append(options("Journal game",games.map(g=>[g,catalog[g].title]),game,v=>{
    journalGame=v; signature=""; render();
  }));
  const place = roomName(book.latest);
  const date = t=>new Date(t).toLocaleString(undefined,{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});
  const summary = element("section","journey-recap");
  summary.append(element("h2","",place),element("p","sub",(live ? "Latest reading" : "Last observed") + " · " + date(book.latest.timestamp)));
  if (book.latest.chapter) summary.append(element("p","","Chapter " + book.latest.chapter));
  if (live) {
    const hint = storyHint(current);
    if (hint) summary.append(element("p","",hint));
    const mark = trackedFiends[current.disc];
    if (game === "x" && typeof mark?.name === "string") summary.append(action("Continue hunt · " + mark.name,()=>openArenaHunt({focus:mark.name})));
  }
  panel.append(summary);
  const checkpoint = element("section","journal-checkpoint");
  checkpoint.append(element("h2","","My checkpoint"));
  if (book.mark) {
    checkpoint.append(element("strong","",roomName(book.mark)),element("p","sub",date(book.mark.timestamp)),
      element("p","journal-note",book.mark.note),element("p","field-note",journalDelta(book.mark,book.latest)));
  }
  if (live) {
    const field = element("label","plan-field","Next time I play");
    const note = element("textarea");
    note.maxLength=400; note.rows=2;
    note.value=journalDraft[game] ?? book.mark?.note ?? "";
    note.setAttribute("aria-label","Next time I play");
    note.addEventListener("input",()=>{journalDraft[game]=note.value;});
    field.append(note);
    const message=element("p","field-note");
    message.setAttribute("role","status");
    const save=action(book.mark ? "Update checkpoint" : "Save checkpoint",()=>{
      const mark = {...book.latest,note:note.value.trim()};
      if (!saveCompanionSetting(journalKey,{...journeyBook,[game]:{...book,mark}})) {
        message.textContent="Could not save the checkpoint. Your note is still here."; return;
      }
      book.mark=mark;
      delete journalDraft[game];
      signature=""; render();
      panel.querySelector(".journal-checkpoint h2")?.focus({preventScroll:true});
    });
    if (book.mark) {
      const edit=element("details","grid-attributes");
      edit.dataset.detailKey="edit-journal-checkpoint";
      edit.append(element("summary","","Edit checkpoint"),field,save,message);
      checkpoint.append(edit);
    } else checkpoint.append(field,save,message);
  } else if (!book.mark) checkpoint.append(element("p","field-note","Open this game to leave a checkpoint."));
  checkpoint.querySelector("h2").tabIndex=-1;
  panel.append(checkpoint,element("h2","","Observed route"));
  const list=element("ol","journal-route");
  for (const row of book.route) {
    const item=element("li");
    item.append(element("strong","",roomName(row)),element("time","",date(row.timestamp)));
    list.append(item);
  }
  panel.append(list);
  if (!journalSaved) panel.append(element("p","field-note","Storage is unavailable. Recent changes are visible for this session."));
}
