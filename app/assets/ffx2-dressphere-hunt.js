"use strict";

const x2DressphereRoutes = [
  [1,[],"Opening party","Yuna starts with Gunner."],
  [2,[1,2],"Moonflow","Escort the Hypello in Chapter 1. If Gun Mage is still missing in Chapter 2, make a profit selling Tobli’s tickets."],
  [3,[2,3,5],"Calm Lands","Recruit Clasko before leaving Chapters 1–2. Follow him to the old Monster Arena and finish Clean Sweep.",1],
  [4,[],"Opening party","Paine starts with Warrior."],
  [5,[3,5],"Kilika Temple","In Chapter 3, pick it up below the flames after the Daeva fight. In Chapter 5, check the Cloister of Trials chests after the episode."],
  [6,[2,3,5],"Bevelle Underground","Raise both sets of pillars in the three-lift room, then take the upper lift to the chest. In Chapter 3, access depends on your faction and hotspot progress."],
  [7,[3],"Lake Macalania Travel Agency","Win six fights in a row to clear the agency defense mission before the chapter ends."],
  [8,[],"Luca opening","Defeat Leblanc in the opening mission and collect the battle spoils."],
  [9,[1],"Celsius","Speak with Shinra after defeating Boris at the Floating Ruins."],
  [10,[1],"Besaid","Defeat Flame Dragon during the Chapter 1 mission."],
  [11,[],"Opening party","Rikku starts with Thief."],
  [12,[3],"Mt. Gagazet","Speak with Kimahri in Chapter 2 and give the second reply when asked. Return to him in Chapter 3 for Trainer.",2],
  [13,[3,5],"Luca","Beat Shinra in the Chapter 3 Sphere Break tournament or challenge him again in the stadium basement in Chapter 5."],
  [14,[5],"Celsius","Get Episode Complete across Spira in Chapter 5 and return to the Celsius. Finish Zanarkand before the final outstanding episode."],
  [15,[2],"Djose Highroad","Pick up Floral Fallal on the Highroad during the Syndicate uniform mission."],
  [18,[2],"Bikanel Oasis","Get Gippal’s Letter of Introduction, speak to Nhadala, then travel to the Oasis and pick up Machina Maw during the uniform search."],
  [21,[1,2],"Macalania Woods","Speak to Tromell four times at the northern spring. In Chapter 2, reunite the musicians to bring him back before you leave."]
];

let x2DressphereHuntOpen = false;
let x2DressphereHuntFilter = "missing";

function x2DressphereHunt(current) {
  const owned = new Map(current.loadout?.dresspheres || []);
  const chapter = current.chapter;
  return x2DressphereRoutes.map(([id,chapters,area,steps,prepare]) => {
    const code = 0x5000 + id;
    const quantity = owned.get(code) || 0;
    let state = "Later";
    if (quantity) state = "Owned";
    else if (!chapters.length) state = "Opening";
    else if (prepare && chapter === prepare) state = "Prepare now";
    else if (chapters.includes(chapter)) state = chapters.at(-1) === chapter && chapter < 5 ? "Chapter deadline" : "This chapter";
    else if (chapters.at(-1) < chapter) state = "Chapter passed";
    return {id, name:catalog.x2.jobs[code], area, chapters, steps, state, quantity};
  });
}

function openX2DressphereHunt() {
  x2DressphereHuntOpen = true;
  choose("equip");
  const hunt = panel.querySelector(".x2-dressphere-hunt");
  hunt?.querySelector("summary")?.focus({preventScroll:true});
  hunt?.scrollIntoView({block:"start"});
}

function showX2DressphereHunt(current) {
  const rows = x2DressphereHunt(current);
  const count = rows.filter(row => row.quantity).length;
  const details = element("details", "grid-attributes x2-dressphere-hunt");
  details.open = x2DressphereHuntOpen;
  details.addEventListener("toggle", () => { x2DressphereHuntOpen = details.open; });
  const controls = element("div", "filters");
  controls.append(options("Dressphere route filter", [["missing","Missing only"],["chapter","This chapter"],["all","All 17"]],
    x2DressphereHuntFilter, value => { x2DressphereHuntFilter = value; draw(); }));
  const sheet = element("div", "sheet guide-list");
  details.append(element("summary", "", `Dressphere Hunt · ${count}/17`), controls, sheet);
  panel.append(details);
  draw();

  function draw() {
    const order = ["Chapter deadline","Prepare now","This chapter","Opening","Later","Chapter passed","Owned"];
    const visible = rows.filter(row => x2DressphereHuntFilter === "all" ||
      !row.quantity && (x2DressphereHuntFilter === "missing" || order.indexOf(row.state) < 3))
      .sort((a,b) => order.indexOf(a.state) - order.indexOf(b.state));
    sheet.replaceChildren();
    for (const row of visible) {
      const chapter = row.chapters.length ? (row.chapters.length === 1 ? "Chapter " : "Chapters ") +
        row.chapters.join(", ") : "";
      const item = entry(row.name, [row.area, chapter].filter(Boolean).join(" · "));
      item.classList.toggle("completed", !!row.quantity);
      const status = row.quantity ? "Owned ×" + row.quantity : row.state;
      item.append(element("p", row.state === "Chapter deadline" || row.state === "Prepare now" ?
        "crimson-deadline" : "field-note", status));
      if (!row.quantity) {
        item.append(element("p", "", row.steps));
        if (row.id === 13) item.append(action("Sphere Break solver", () => openX2Challenge("sphere-break", current)));
        if (row.id === 14) item.append(action("Mascot episode board", () => choose("plan-mascot")));
        if (row.id === 3 && current.calmLands) item.append(action("Chocobo Ranch guide", () => openX2Challenge("ranch", current)));
      }
      sheet.append(item);
    }
    if (!visible.length) sheet.append(entry(x2DressphereHuntFilter === "chapter" ?
      "No missing dressphere routes listed for this chapter" : "All 17 dresspheres collected"));
  }
}
