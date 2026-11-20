"use strict";

const remiemPrizes = ["Cloudy Mirror","Elixir","Megalixir","Wings to Discovery ×30","Pendulum ×30","Three Stars ×60"];
const remiemChests = [
  ["A","Outer track","Follow the upper path to the northwest dead end. Open the chest to jump to a ramp."],
  ["B","Double back","Climb that ramp, turn back along the neighboring dead end and open the chest. You land at the same ramp."],
  ["C","Past the ramp","Climb again. This time keep going along the upper track to the southwest chest. It sends you to the lower track."],
  ["D","Lower track","Stay on the lower track toward the southeast chest. Opening it carries you across the gap."],
  ["E","Second ramp","Pass the first ramp after the jump. Take the second one uphill to the chest. It drops you near the goal."]
];
function remiemRoute(tier) {
  const finish = ["Goal","Center of the course", tier === 5 ? "After the last drop, turn toward the central spiral and cross the finish." :
    tier === 0 ? "From the start, take the descending branches toward the center. Skip the chests and beat the other bird there." :
    "Leave the remaining chests closed. Take the descending route to the central spiral and beat the other bird to the finish."];
  return [...remiemChests.slice(0, tier),finish];
}
function drawRemiemRace(current, view) {
  const key = routeNotesKey(current, "remiem");
  const stored = readCompanionSetting(key, {}) || {};
  const tier = Number.isInteger(stored.tier) && stored.tier >= 0 && stored.tier <= 5 ? stored.tier : 0;
  const steps = remiemRoute(tier);
  const leg = Math.max(0, Math.min(Number.isInteger(stored.leg) ? stored.leg : 0, steps.length - 1));
  const claimed = Array.isArray(stored.claimed) ? [...new Set(stored.claimed.filter(n => Number.isInteger(n) && n >= 0 && n <= 5))] : [];
  const update = change => {
    if (saveCompanionSetting(key, {...stored, ...change})) planRefresh();
    else view.message.textContent = "Could not save your race notes.";
  };
  planSelect(view.controls, "Race prize", remiemPrizes.map((prize,n) => [n,prize + (n ? " · " + planCount(n,"chest") : " · first win")]), tier, value => update({tier:Number(value),leg:0}));
  view.message.textContent = (current.room === 290 ? "At Remiem Temple · " : "") +
    (claimed.includes(tier) ? "Prize marked collected." : tier ? "Win with exactly " + planCount(tier,"chest") + " and avoid every pole." : "Your first win awards the mirror, even with zero chests.");
  const celestial = current.progress?.keyItems && ffxBit(current.progress.keyItems,3);
  if (celestial) view.message.textContent += " Your save has the upgraded Celestial Mirror.";
  else if (tier && !claimed.includes(0)) view.message.textContent += " If you have never won, this run awards the Cloudy Mirror. Win once before chasing this prize.";
  const route = element("ol","race-route");
  route.setAttribute("aria-label","Route landmarks");
  for (const [index, [marker,title,detail]] of steps.entries()) {
    const item = element("li");
    const step = action(marker + " · " + title, () => update({leg:index}));
    if (index === leg) step.setAttribute("aria-current","step");
    step.setAttribute("aria-label","Show " + title);
    item.append(step, element("p","",detail));
    route.append(item);
  }
  const controls = element("div","tracker-actions");
  const next = action(leg === steps.length - 1 ? "Back to start" : "Next landmark",() => update({leg:leg === steps.length - 1 ? 0 : leg + 1}),true);
  controls.append(next);
  if (leg > 0) controls.append(action("Previous landmark",() => update({leg:leg - 1})));
  const currentStep = entry(steps[leg][1], "Landmark " + (leg + 1) + " of " + steps.length, steps[leg][2]);
  if (tier > 0) {
    const ribbon = element("div","race-landmarks");
    ribbon.setAttribute("aria-label","Jump to a landmark");
    for (const [i,[marker,title]] of steps.entries()) {
      const jump = action(marker,() => update({leg:i}));
      jump.setAttribute("aria-label","Jump to " + title);
      if (i === leg) jump.setAttribute("aria-current","step");
      ribbon.append(jump);
    }
    currentStep.prepend(ribbon);
  }
  currentStep.append(controls);
  view.list.append(currentStep, route);
  const notes = entry("Prize record", claimed.length + "/6 marked", "Mark the prize when you receive it. Each chest tier pays once. To start racing, inspect the sphere on the west side of the temple and mount the bird on the east side.");
  notes.append(action(claimed.includes(tier) ? "Undo collected mark" : "Mark " + remiemPrizes[tier] + " collected", () =>
    update({claimed:claimed.includes(tier) ? claimed.filter(n => n !== tier) : [...claimed,tier]})));
  view.list.append(notes);
}
