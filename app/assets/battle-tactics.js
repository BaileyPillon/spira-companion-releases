"use strict";

function battleTactics(current) {
  const stock = new Map(current.items);
  const inStock = id => stock.get(0x2000 + id) || 0;
  const advice = new Map();
  const front = current.party.filter(actor => actor.active && actor.maxHp > 0);
  const preserveZombie = current.game === "x" && current.enemies?.some(foe => foe.hp > 0 &&
    (foe.id === 130 || foe.id === 129 && foe.maxHp === 60000));
  function suggest(items, actor, reason) {
    const id = items.find(item => inStock(item)) ?? items[0];
    if (!advice.has(id)) advice.set(id, {name:catalog[current.game].recovery[id], stock:inStock(id), targets:[]});
    advice.get(id).targets.push([partyName(current, actor), reason]);
  }
  for (const actor of front) {
    const effects = statusEffects(current.game, actor).split(" · ");
    const zombie = effects.includes("Zombie");
    const statusCure = item => preserveZombie && zombie ? [item] : [item,15];
    if (actor.hp === 0) suggest([6,7], actor, "KO");
    else if (effects.includes("Petrify")) suggest([11,15], actor, "Petrify");
    else if (zombie && !preserveZombie) suggest([14,15], actor, "Zombie");
    else if (!zombie && actor.hp * 3 <= actor.maxHp) {
      const missing = actor.maxHp - actor.hp;
      const healing = missing > 1000 ? [2,1,0] : missing > 200 ? [1,2,0] : [0,1,2];
      suggest(healing, actor, "low HP");
    } else if (effects.includes("Poison")) suggest(statusCure(10), actor, "Poison");
    else if (effects.includes("Silence")) suggest(statusCure(13), actor, "Silence");
    else if (effects.includes("Darkness")) suggest(statusCure(12), actor, "Darkness");
  }
  return [...advice.values()];
}

function showBattleTactics(current) {
  const advice = battleTactics(current);
  if (!advice.length) return;
  const details = element("details", "grid-attributes battle-tactics");
  details.open = battleTacticsOpen;
  details.addEventListener("toggle", () => { battleTacticsOpen = details.open; });
  details.append(element("summary", "", "Battle tactics · Recovery"));
  const sheet = element("div", "sheet");
  for (const {name,stock,targets} of advice) {
    const targetList = targets.map(([target, reason]) => `${target} · ${reason}`).join(" / ");
    sheet.append(entry(name, stock ? `×${stock} available` : "0 in stock", targetList));
  }
  details.append(sheet);
  panel.append(details);
}

let battleTacticsOpen = false;
