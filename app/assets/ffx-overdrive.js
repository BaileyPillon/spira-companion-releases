"use strict";

// Indexed by the PS2 character record's counter and learned bit.
const xOverdriveModeGuide = [
  ["Warrior","hits","Damage enemies with this character."],
  ["Comrade","ally hits","Keep this character on the front line while another ally takes damage."],
  ["Stoic","hits taken","Take damage with this character. Stoic is available from the start."],
  ["Healer","heals","Restore another ally’s missing HP during battle."],
  ["Tactician","status effects","Successfully inflict a status effect or break on an enemy."],
  ["Victim","status effects taken","Have an enemy inflict a negative status on this character."],
  ["Dancer","dodges","Evade enemy attacks."],
  ["Avenger","ally KOs","Stay in battle while another ally is knocked out."],
  ["Slayer","finishing blows","Finish enemies with this character. Capture finishing blows can advance this during Arena hunts."],
  ["Hero","high-damage finishes","Defeat enemies with a sufficiently powerful finishing blow. Break Damage Limit helps."],
  ["Rook","defended hits","Use defensive effects to reduce or prevent enemy attacks."],
  ["Victor","wins","Be in the active party when you win a battle."],
  ["Coward","escapes","Escape successfully with this character or use Tidus’s Flee."],
  ["Ally","turns","Take turns in battle. Defending counts."],
  ["Sufferer","turns with a status","Take turns while affected by a negative status."],
  ["Daredevil","turns at critical HP","Take turns while this character’s HP is yellow."],
  ["Loner","turns alone","Take turns as the only remaining active fighter."]
];

let xOverdriveOpen = false;
let xOverdriveMember = 0;
let xOverdriveFilter = "near";

function xOverdriveRows(member) {
  return xOverdriveModeGuide.map(([name,unit,hint],id) => {
    const counter = member.overdriveRemaining?.[id];
    const remaining = Number.isInteger(counter) && counter >= 0 && counter < 65535 ? counter : null;
    const equipped = member.overdriveMode === id;
    return {id,name,unit,hint,remaining,equipped,learned:equipped || !!(member.overdriveModes & (1 << id))};
  });
}

function xOverdriveStatus(mode) {
  if (mode.equipped) return "Equipped";
  if (mode.learned) return "Learned";
  if (mode.remaining == null) return "Locked";
  return mode.remaining === 1 ? "1 action left" : `${mode.remaining} ${mode.unit} left`;
}

function openXOverdriveModes(member) {
  xOverdriveMember = member;
  xOverdriveOpen = true;
  choose("party");
  const modes = panel.querySelector(".overdrive-modes");
  modes?.querySelector("summary")?.focus({preventScroll:true});
  modes?.scrollIntoView({block:"start"});
}

function showXOverdriveModes(current) {
  const members = current.party.filter(member => member.id < 7 && member.overdriveRemaining);
  if (!members.length) return;
  let member = members.find(actor => actor.id === xOverdriveMember) || members[0];
  const details = element("details", "grid-attributes overdrive-modes");
  details.open = xOverdriveOpen;
  details.addEventListener("toggle", () => { xOverdriveOpen = details.open; });
  const controls = element("div", "filters");
  const results = element("div", "sheet guide-list");
  controls.append(options("Overdrive character", members.map(actor => [actor.id,partyName(current, actor)]),
    member.id, id => {
      xOverdriveMember = Number(id);
      member = members.find(actor => actor.id === xOverdriveMember);
      draw();
    }));
  controls.append(options("Overdrive mode order", [["near","Closest to unlock"],["all","All modes"]], xOverdriveFilter, value => {
    xOverdriveFilter = value;
    draw();
  }));
  details.append(element("summary", "", "Overdrive modes"), controls, results);
  panel.append(details);
  draw();

  function draw() {
    const rows = xOverdriveRows(member);
    const learned = rows.filter(mode => mode.learned).length;
    const equipped = rows.find(mode => mode.equipped);
    const overview = entry(`${learned}/17 learned`, equipped ? equipped.name + " equipped" : "");
    const meter = element("progress");
    meter.max = rows.length;
    meter.value = learned;
    meter.setAttribute("aria-label", "Overdrive modes learned");
    overview.append(meter);
    results.replaceChildren(overview);
    const missing = rows.filter(mode => !mode.learned)
      .sort((a,b) => (a.remaining ?? Infinity) - (b.remaining ?? Infinity));
    for (const mode of xOverdriveFilter === "near" ? missing : rows) {
      const row = entry(mode.name, xOverdriveStatus(mode), mode.hint);
      row.classList.toggle("completed", mode.learned);
      results.append(row);
    }
    if (!missing.length && xOverdriveFilter === "near") results.append(entry("All modes learned"));
  }
}
