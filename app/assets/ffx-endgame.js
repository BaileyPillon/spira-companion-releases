"use strict";

function endgameRoute(current) {
  if (current.disc !== "SLPS-25088" || !current.progress || !current.grid) return [];
  const progress = current.progress;
  const party = current.party.filter(member => member.id < 7);
  const front = party.filter(member => member.active);
  const powered = ffxCollection(current, "celestials").filter(weapon => weapon.done).length;
  const hasTriple = member => member.gear?.some(piece => piece.type === 0 && piece.abilities.includes(0x8013));
  const hasApWeapon = member => member.gear?.some(piece =>
    piece.type === 0 && piece.abilities.includes(0x8013) && piece.abilities.includes(0x8011));
  const triple = front.filter(hasTriple).length;
  const apWeapons = front.filter(hasApWeapon).length;
  const anima = (progress.optionalAeons & 1) !== 0;
  const seals = animaTreasures(current).filter(chest => chest.done).length;
  const darkClears = [0,1,2,3,4,5,6,7].filter(bit => (progress.darkAeons || 0) & (1 << bit)).length;
  const goals = new Map(current.arena ? arenaGoals(current).flatMap(([, group]) => group.map(goal => [goal.name, goal])) : []);
  const hasCreation = name => goals.has(name) && (goals.get(name).ready || arenaDefeated(current, name));
  return [
    {key:"mirror", name:"Restore the Celestial Mirror", done:ffxBit(progress.keyItems, 3),
      detail:"Win the chocobo race at Remiem Temple for the Cloudy Mirror. Restore it at the altar in Macalania Woods.",
      open:() => choose("collections", "celestials")},
    {key:"celestials", name:"Power up a Celestial Weapon", done:powered > 0,
      detail:powered ? `${powered} Celestial Weapons fully powered.` :
        "Yuna and Rikku are good starting points. The weapon, crest and sigil checklist shows what you still need.",
      open:() => choose("collections", "celestials")},
    {key:"anima", name:"Recruit Anima", done:anima,
      detail:anima ? "Anima is in your party." :
        `${seals}/6 temple treasures opened. Check your missing chests, then visit the Baaj statues.`,
      open:() => choose("collections", "anima")},
    {key:"one-eye", name:"Unlock One-Eye", done:hasCreation("One-Eye"),
      detail:"Capture four of each eye fiend to open a source of Triple AP weapons.",
      open:() => openArenaCreation("One-Eye")},
    {key:"triple-ap", name:"Get Triple AP weapons", done:front.length > 0 && triple === front.length,
      detail:`${triple}/${front.length} active party members own one. If One-Eye is too tough, build a basic Overdrive → AP weapon first or try a strong aeon.`,
      open:() => openArenaFarm("ap")},
    {key:"don-unlock", name:"Unlock Don Tonberry", done:hasCreation("Don Tonberry"),
      detail:"Capture one of each fiend in the Cavern of the Stolen Fayth.",
      open:() => openArenaCreation("Don Tonberry")},
    {key:"ap", name:"Set up Don Tonberry AP", done:front.length > 0 && apWeapons === front.length,
      detail:`${apWeapons}/${front.length} active party members own a weapon with Triple AP and Overdrive → AP. Check Karma damage and Overdrive modes below.`,
      open:() => openPrep("ap")},
    {key:"dark", name:"Clear the Dark Aeons", done:darkClears === 8,
      detail:`${darkClears}/8 Dark Aeon encounters cleared. Check armor options from your inventory before each fight.`,
      open:() => choose("collections", "bosses")},
    {key:"penance", name:"Defeat Penance", done:!!current.arena && arenaDefeated(current, "Penance"),
      detail:"Clear all eight Dark Aeon encounters to unlock Penance. Check the armor plan and its material sources.",
      open:() => openPrep("penance")}
  ];
}

function showEndgameRoute(current, overview, sheet) {
  const route = endgameRoute(current);
  if (!route.length) {
    sheet.append(entry("Waiting for an FFX International save"));
    return;
  }
  const next = route.find(step => !step.done);
  overview.append(element("p", "field-note", current.story >= 2900 ?
    "Start with whichever goal fits your party. Spira checks your gear, captures and clears as you play." :
    "Open this route again after you gain free use of the airship. You can prepare for several steps during the story."));
  if (next && current.story >= 2900) {
    const row = entry("Start here", next.name, next.detail);
    row.append(action("View step", next.open, true));
    overview.append(row);
  }
  for (const step of route) {
    if (current.story >= 2900 && step === next) continue;
    if (collectionMissingOnly && step.done) continue;
    const row = entry(step.name, step.done ? "Complete" : "Still needed", step.detail);
    row.classList.toggle("completed", step.done);
    const button = action("View step", step.open);
    button.setAttribute("aria-label", "View step: " + step.name);
    row.append(button);
    sheet.append(row);
  }
  if (!sheet.childElementCount && !next) sheet.append(entry("Route complete"));
}
