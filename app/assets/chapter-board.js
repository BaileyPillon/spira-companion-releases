"use strict";

const destinationAliases = [
  [/^Besaid/, "Besaid"], [/^Kilika/, "Kilika"], [/^(Luca|Stadium)/, "Luca"],
  [/^(Highroad|Mi'ihen)/, "Mi’ihen Highroad"], [/^(Youth League|Mushroom Rock)/, "Mushroom Rock"],
  [/^Djose/, "Djose"], [/^Moonflow/, "Moonflow"], [/^(Chateau|Guadosalam)/, "Guadosalam"],
  [/^(Lake Macalania|Macalania)/,"Macalania"], [/^(Highbridge|Bevelle|New Yevon)/, "Bevelle"],
  [/^Bikanel/,"Bikanel"], [/^(Calm Lands|Chamber of the Stolen Fayth)/,"Calm Lands"],
  [/^Gagazet/,"Mt. Gagazet"], [/^(Zanarkand|Dome)/,"Zanarkand"],
  [/Farplane/,"Farplane"]
];
const x2Board = {chapter:0,place:null,conditional:true,pending:false,open:false};

function sceneDestination(scene) {
  const location = scene.visit || scene.location;
  const region = destinationAliases.find(([pattern]) => pattern.test(location));
  return region?.[1] || location.split(" · ")[0].split(" (")[0];
}

function chapterDestinations(scenes, chapter, conditional) {
  const places = new Map();
  for (const scene of scenes) {
    if (chapter !== scene.chapter || (!conditional && scene.conditional)) continue;
    const name = sceneDestination(scene);
    if (!places.has(name)) places.set(name,[]);
    places.get(name).push(scene);
  }
  return [...places].map(([name,flags]) => ({
    name, flags, recorded:flags.filter(scene => scene.done).length
  })).sort((a,b) => Number(a.recorded === a.flags.length) - Number(b.recorded === b.flags.length) || a.name.localeCompare(b.name));
}

function showChapterBoard(current,scenes) {
  const board = element("details","chapter-board");
  board.open = x2Board.open;
  board.addEventListener("toggle",() => { x2Board.open = board.open; });
  const summary = element("summary","","Destination board");
  const overview = element("small");
  summary.append(overview);
  board.append(summary);
  const chapter = options("Destination board chapter",[[0,"Follow Chapter " + current.chapter],...[1,2,3,4,5].map(n=>[n,"Chapter " + n])],x2Board.chapter,value=>{
    x2Board.chapter = Number(value);
    x2Board.place = null;
    draw();
  });
  const label = element("label","goal-choice");
  const conditional = element("input");
  conditional.type = "checkbox";
  conditional.checked = x2Board.conditional;
  conditional.addEventListener("change",() => {
    x2Board.conditional = conditional.checked;
    draw();
  });
  label.append(conditional,document.createTextNode("Include conditional routes"));
  const tools = element("div","filters");
  const pendingLabel = element("label","goal-choice");
  const pending = element("input");
  pending.type = "checkbox";
  pending.checked = x2Board.pending;
  pending.addEventListener("change",() => { x2Board.pending = pending.checked; x2Board.place = null; draw(); });
  pendingLabel.append(pending,document.createTextNode("Only unfinished destinations"));
  tools.append(chapter,label,pendingLabel);
  const body = element("div","destination-body");
  board.append(tools,body);
  panel.append(board);
  function draw(focus = false) {
    const chosen = x2Board.chapter || current.chapter;
    const places = chapterDestinations(scenes,chosen,x2Board.conditional);
    const remaining = places.filter(p => p.recorded < p.flags.length);
    overview.textContent = "Chapter " + chosen + " · " + remaining.length + " of " + places.length + " destinations have unrecorded flags";
    const place = places.find(p => p.name === x2Board.place);
    body.replaceChildren();
    if (!place) {
      x2Board.place = null;
      const note = element("p","field-note","Bars count recorded scene flags at each destination. Some flags belong to different routes.");
      const list = element("div","destination-list");
      const visible = x2Board.pending ? remaining : places;
      for (const dest of visible) {
        const button = action(dest.name,() => { x2Board.place = dest.name; draw(true); });
        const meter = element("progress");
        meter.max = dest.flags.length;
        meter.value = dest.recorded;
        meter.setAttribute("aria-hidden","true");
        const count = dest.recorded === dest.flags.length ? "All " + dest.recorded + " recorded" :
          dest.recorded + " / " + dest.flags.length + " recorded";
        button.classList.toggle("destination-pending",dest.recorded < dest.flags.length);
        button.append(element("small","",count),meter);
        list.append(button);
      }
      if (!visible.length) list.append(element("p","field-note","Every flag in this selection is recorded."));
      body.append(note,list);
      return;
    }
    const back = action("All destinations",() => {
      x2Board.place = null;
      draw();
      [...body.querySelectorAll("button")].find(button=>button.firstChild.textContent === place.name)?.focus({preventScroll:true});
    });
    const name = element("h2","",place.name);
    name.tabIndex = -1;
    body.append(back,name,element("p","field-note","Chapter " + chosen + " · " + place.recorded + " of " + place.flags.length + " scene flags recorded here"));
    for (const group of x2GroupSceneChecks(place.flags)) {
      const section = element("details","destination-check");
      section.dataset.detailKey = "board-" + chosen + "-" + place.name + "-" + group.routeId;
      const title = element("summary","",group.name);
      const state = group.done ? "Recorded" : chosen > current.chapter ? "Later chapter" :
        chosen < current.chapter ? "Unrecorded · check recovery" : "Unrecorded";
      title.append(element("small","",state + (group.conditional ? " · Conditional" : "")));
      section.append(title,element("p","",group.action),element("p","field-note",group.location));
      if (group.visit) section.append(element("p","field-note","Start at " + group.visit));
      if (group.branch) section.append(element("p","field-note",group.branch === "league" ? "Youth League route" : "New Yevon route"));
      if (!group.done) section.append(element("p","field-note",group.flags.find(flag=>!flag.done).recovery));
      body.append(section);
    }
    if (focus) name.focus({preventScroll:true});
  }
  draw();
}
