"use strict";

const x2CrimsonSpheres = [
  [1,[3],"Bevelle Underground","When Djose becomes a hotspot, return to Bahamut’s chamber. Defeat the Malboro and pick up the sphere before finishing Djose.",true],
  [2,[3],"Farplane","Complete the Djose Temple mission and continue through the scene with Gippal and Nooj."],
  [3,[3],"Farplane","Gippal and Nooj give you this alongside Crimson Sphere 2 after the Djose Temple mission."],
  [4,[3,5],"Chateau Leblanc","Climb the crates in the room where you fought Leblanc’s gang and open the chest on the upper ledge."],
  [5,[4],"Celsius · Engine Room","After the concert, talk to Leblanc in the engine room before you speak to Shinra on the bridge.",true],
  [6,[5],"Bevelle · Via Infinito","Follow the Kinderguardians into Via Infinito and pick up the sphere near the entrance."],
  [7,[2],"Mushroom Rock · Ravine","After the Mi’ihen Highroad chocobo mission, speak to Nooj outside the Den of Woe before advancing the chapter.",true],
  [8,[5],"Bevelle · Via Infinito · Cloister 20","Defeat Aranea on Cloister 20 and pick up the sphere before going deeper."],
  [9,[1],"Mushroom Rock · Ravine","During Foggy Fiend Frenzy, follow Logos and Ormi into the ravine and pick up the sphere by the Den of Woe.",true],
  [10,[2,3],"Chateau Leblanc","Enter Logos’s room in the hideout after the disguise mission and look for the treasure-sphere scene."]
];

let x2CrimsonOpen = false;
let x2CrimsonMissing = false;

function x2CrimsonProgress(current) {
  if (!Number.isInteger(current.crimsonSpheres)) return null;
  const {chapter, crimsonSpheres} = current;
  return x2CrimsonSpheres.map(([id, chapters, area, steps, timed]) => {
    const owned = !!(crimsonSpheres & (1 << (id - 1)));
    const window = owned ? "Collected" : chapters.includes(chapter) ?
      timed ? "Chapter deadline" : "This chapter" :
      chapters.at(-1) < chapter ? "Chapter passed" : "Later";
    return {id, chapters, area, steps, owned, window};
  });
}

function showX2CrimsonRoute(current) {
  const records = x2CrimsonProgress(current);
  if (!records) return;
  const count = records.filter(record => record.owned).length;
  const details = element("details", "grid-attributes crimson-route");
  details.open = x2CrimsonOpen;
  details.addEventListener("toggle", () => { x2CrimsonOpen = details.open; });
  const content = element("div", "sheet guide-list");
  const next = records.find(record => record.window === "Chapter deadline");
  const candidates = records.filter(record => record.window === "This chapter");
  const missed = records.filter(record => record.window === "Chapter passed");
  const meter = element("progress");
  meter.max = 10;
  meter.value = count;
  meter.setAttribute("aria-label", "Crimson Spheres collected");
  const overview = element("div", "entry collection-overview");
  const directive = count === 10 && current.chapter === 5 ? "Head to the Den of Woe in Mushroom Rock Ravine." :
    next ? `Get #${next.id} before leaving Chapter ${current.chapter}.` :
    candidates.length ? `Next stop · ${candidates[0].area}` :
    missed.length ? "One or more collection windows have passed." : "Collect all ten to enter the Den of Woe in Chapter 5.";
  overview.append(element("strong", "", "Den of Woe"), element("p", "", directive), meter);
  overview.append(element("p", "field-note", "Play collected records at Shinra’s station to check for story credit."));
  const filter = element("label", "mix-filter", "Missing only");
  const missing = element("input");
  missing.type = "checkbox";
  missing.checked = x2CrimsonMissing;
  filter.prepend(missing);
  const result = element("div", "crimson-sphere-list");
  details.append(element("summary", "", `Crimson Spheres · ${count}/10`), content);
  content.append(overview, filter, result);
  panel.append(details);
  missing.addEventListener("change", () => { x2CrimsonMissing = missing.checked; draw(); });
  draw();

  function draw() {
    const stages = ["Chapter deadline","This chapter","Later","Chapter passed","Collected"];
    const visible = records.filter(row => !missing.checked || !row.owned);
    visible.sort((a,b) => stages.indexOf(a.window) - stages.indexOf(b.window));
    result.replaceChildren(...visible.map(row => {
      const chapters = row.chapters.length > 1 ? "Chapters " + row.chapters.join(" and ") : "Chapter " + row.chapters[0];
      const card = entry(`Crimson Sphere ${row.id}`, `${row.area} · ${chapters}`);
      card.classList.toggle("completed", row.owned);
      const status = element("p", row.window === "Chapter deadline" ? "crimson-deadline" : "field-note", row.window);
      card.append(status);
      if (!row.owned) card.append(element("p", "", row.steps));
      return card;
    }));
    if (!visible.length) result.append(entry("All ten spheres collected"));
  }
}

function openX2CrimsonRoute() {
  x2CrimsonOpen = true;
  openX2ChapterChecklist();
  panel.querySelector(".crimson-route > summary")?.focus({preventScroll:true});
  panel.querySelector(".crimson-route")?.scrollIntoView({block:"start"});
}
