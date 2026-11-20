"use strict";

const bossLessons = {
  yunalesca: [
    ["First form", "Watch the counter", "Physical attacks can draw Darkness and spells can draw Silence. Let an unaffected ally attack while you restore the character who needs to act."],
    ["Second form", "Leave a survivor zombified", "Hellbiter inflicts Zombie on the front line. Before dealing the last hit of this form, keep one living ally zombified or in Deathproof armor. Heal the others. Dispel Regen if it is draining a zombified ally."],
    ["Third form", "Survive the opening Mega Death", "Keep a protected survivor on the field when forms change. Revive the fallen afterward. Mega Death returns during this form, so keep that protection ready. Mind Blast can also confuse the party."]
  ],
  flux: [
    ["Opening", "Break the Lance and Full-Life combo", "Watch whom Lance of Atrophy hits. If there is a party turn before Full-Life, cure Zombie with Holy Water or Remedy. Poison on Seymour keeps working while you recover."],
    ["Charging", "Read Mortiorchis’s warning", "Watch for Auto-Attack Mode, then Ready to Annihilate. Restore HP and apply Shell before Mortiorchis acts. Check the turn order before summoning a shield: Seymour can Banish your aeon before the blast."],
    ["After the blast", "Recover before the next charge", "Revive a fallen ally, restore HP and reapply Shell. Watch Mortiorchis for another warning. Dispel Seymour’s Reflect before directing spells at him."]
  ]
};
const phaseBossNames = {yunalesca:"Yunalesca", flux:"Seymour Flux"};

function phaseEncounter(current) {
  if (!current.battle) return null;
  for (const enemy of current.enemies || []) {
    if (enemy.hp <= 0) continue;
    if (enemy.id === 142) return {key:"flux", enemy};
    if (enemy.id === 130 || (enemy.id === 129 && enemy.maxHp === 60000)) return {key:"yunalesca", enemy};
  }
  return null;
}
function yunalescaForm(maxHp) {
  return [24000,48000,60000].indexOf(maxHp);
}
function openLiveBossCoach() {
  fieldChoices.storyBoss = "live";
  delete fieldChoices["bossStage.yunalesca"];
  delete fieldChoices["bossStage.flux"];
  choose("plan-phase");
}
function deathproof(member) {
  return member.gear?.some(piece => piece.type === 1 && piece.equipped &&
    piece.abilities?.some(id => ffxData.abilities[id] === "Deathproof"));
}
function phaseDefense(member, key) {
  if (member.hp <= 0) return "KO";
  if (member.statusBits & 4) return "Petrified";
  if (key === "yunalesca" && deathproof(member)) return "Deathproof equipped";
  if (!Number.isInteger(member.statusBits)) return "Status unavailable";
  if (member.statusBits & 2) return key === "flux" ? "Zombie · cure before Full-Life" : "Zombie · protected from Mega Death";
  if (key === "yunalesca") return Array.isArray(member.gear) ? "Exposed to Mega Death" : "No Zombie · check armor";
  if (!Number.isInteger(member.statusTimed)) return "Shell status unavailable";
  return member.statusTimed & 8 ? "Shell active" : "No Shell";
}
function phasePriority(current, key, enemy) {
  const standing = (current.party || []).filter(m => m.active && m.id < 7 && m.hp > 0 && !(m.statusBits & 4));
  const names = members => members.map(m => partyName(current,m)).join(", ");
  const zombies = standing.filter(m => m.statusBits & 2);
  if (key === "flux") {
    if (zombies.length) {
      const bag = new Map(current.items || []);
      const cure = bag.get(0x200e) > 0 ? "Holy Water" : bag.get(0x200f) > 0 ? "Remedy" : "";
      return ["Full-Life threatens " + names(zombies), cure ? "Use " + cure + " before Full-Life if you have a turn." :
        "No Zombie cure is visible in the bag. If Full-Life lands, be ready to revive the target."];
    }
    if (enemy.statusTimed & 32) return ["Seymour has Reflect", "Dispel it before casting a targeted spell at him."];
    if (enemy.hp <= 35000) {
      const exposed = standing.filter(m => Number.isInteger(m.statusTimed) && !(m.statusTimed & 8));
      return ["Watch Mortiorchis for the charge", exposed.length ? "Missing Shell: " + names(exposed) + ". The warning on the game screen signals when to prepare." :
        "Keep HP up and watch for Ready to Annihilate on the game screen."];
    }
  } else if ([1,2].includes(yunalescaForm(enemy.maxHp))) {
    const protectedParty = standing.filter(m => (m.statusBits & 2) || deathproof(m));
    if (protectedParty.length) return [protectedParty.length === 1 ? "Keep " + names(protectedParty) + " on the field" : "Keep one protected ally on the field",
      "Protected: " + names(protectedParty) + ". " + (zombies.length ? "Avoid curing your last protective Zombie before Mega Death." : "Their equipped armor protects against Mega Death.")];
    return ["Prepare a survivor for Mega Death", "Keep a Hellbiter Zombie in the front line or switch in a living ally wearing Deathproof."];
  }
  return null;
}
function drawPhaseCoach(current, view) {
  const encounter = phaseEncounter(current);
  const selection = fieldChoices.storyBoss || "live";
  const key = selection === "live" ? encounter?.key || "yunalesca" : selection;
  const live = encounter?.key === key ? encounter.enemy : null;
  planSelect(view.controls, "Fight", [["live","Follow current fight"], ...Object.entries(phaseBossNames)], selection, value => {
    fieldChoices.storyBoss = value; planRefresh();
  });
  const forms = bossLessons[key];
  const detected = key === "yunalesca" && live ? yunalescaForm(live.maxHp) : -1;
  const choiceKey = "bossStage." + key;
  const choice = fieldChoices[choiceKey] || "auto";
  const stage = choice === "auto" ? detected >= 0 ? detected : 0 : Number(choice);
  const autoLabel = detected >= 0 ? "Follow live form" : "Overview";
  planSelect(view.controls, "Battle stage", [["auto",autoLabel],...forms.map(([label],i) => [i,label])], choice, value => {
    fieldChoices[choiceKey] = value; planRefresh();
  });
  view.message.textContent = (live ? (reconnecting ? "Last reading" : current.paused ? "Paused" : "Current encounter") : "Fight preview") +
    " · " + phaseBossNames[key] + (live ? " · " + number.format(live.hp) + " HP" : "");
  let guidance = "";
  if (live && key === "yunalesca") {
    guidance = detected < 0 ? "This HP reading does not identify a form. Select the form you see in game." :
      forms[detected][0] + " on screen · " + number.format(live.hp) + (detected < 2 ? " HP to the next form." : " HP remaining.");
  } else if (live) {
    guidance = live.hp <= 35000 ? "Below half health. Watch for the charge message on the top screen." : "Watch for Lance of Atrophy on the top screen.";
  }
  if (guidance) view.list.append(entry(guidance));
  for (const i of choice === "auto" && detected < 0 ? [0,1,2] : [stage]) {
    view.list.append(entry(forms[i][1], forms[i][0], forms[i][2]));
  }
  if (live) {
    const members = (current.party || []).filter(m => m.active && m.id >= 0 && m.id < 7);
    const row = entry("Your front line");
    const list = element("ul", "hunt-list");
    for (const member of members) {
      const li = element("li");
      li.append(element("strong","",partyName(current,member)),element("span","",phaseDefense(member,key)));
      list.append(li);
    }
    if (members.length) row.append(list);
    else row.append(element("p","","Waiting for party status."));
    view.list.prepend(row);
    const priority = phasePriority(current,key,live);
    if (priority) view.list.prepend(entry(priority[0],"",priority[1]));
    if (current.turnOrder?.length) showXTurnOrder(current);
  }
  const counts = new Map(current.items || []);
  if (Array.isArray(current.items)) view.list.append(entry("Recovery in your bag", [0x200e,0x200f,0x2006].map(id =>
    catalog.x.recovery[id - 0x2000] + " ×" + (counts.get(id) || 0)).join(" · "),
    key === "flux" ? "Use a Phoenix Down after a KO if you miss the turn to cure Zombie." : "A normal heal hurts a zombified ally. Keep track of who can receive the heal."));
}
