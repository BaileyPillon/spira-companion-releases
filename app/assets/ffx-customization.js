"use strict";

let customizationType = "all";
let customizationQuery = "";
let customizationReady = false;

function normalizeGuideText(value) {
  return value.toLowerCase().replace(/[’']/g, "").replace(/→|->/g, " ");
}

function customizationRecipes(items, party) {
  const inventory = itemAmounts(items);
  const gear = party.flatMap(member => (member.gear || []).map(piece => ({member, piece})));
  return ffxCustomization.flatMap((recipes, type) => recipes.map(([ability, item, cost]) => {
    const owned = inventory.get(item) || 0;
    const bases = gear.filter(({piece}) => piece.type === type && !piece.celestial &&
      piece.abilities.includes(null) && !piece.abilities.includes(ability));
    return {ability, item, type, cost, owned, bases, missing:Math.max(0, cost - owned)};
  }));
}

function showCustomization(current) {
  panel.append(element("p", "field-note", "Check your supplies and open slots before spending materials in the game."));
  const controls = element("div", "filters guide-filters customization-filters");
  const query = element("input");
  query.type = "search";
  query.placeholder = "Search ability or material";
  query.setAttribute("aria-label", query.placeholder);
  query.value = customizationQuery;
  const ready = action("Can add now", () => {
    customizationReady = !customizationReady;
    ready.setAttribute("aria-pressed", String(customizationReady));
    redraw();
  });
  ready.setAttribute("aria-pressed", String(customizationReady));
  const types = options("Gear type", [["all","Any gear"],["0","Weapons"],["1","Armor"]], customizationType, value => {
    customizationType = value;
    redraw();
  });
  const sheet = element("div", "sheet guide-list customization-results");
  const recipes = customizationRecipes(current.items, current.party).sort((a, b) =>
    Number(!a.bases.length || a.missing > 0) - Number(!b.bases.length || b.missing > 0) ||
    ffxData.abilities[a.ability].localeCompare(ffxData.abilities[b.ability]));
  const redraw = () => {
    const search = normalizeGuideText(customizationQuery).trim().split(/\s+/).filter(Boolean);
    sheet.replaceChildren();
    const matching = recipes.filter(({ability, item, type, missing, bases}) =>
      (customizationType === "all" || Number(customizationType) === type) &&
      (!customizationReady || (!missing && bases.length)) &&
      search.every(word => normalizeGuideText(ffxData.abilities[ability] + " " + ffxData.items[item]).includes(word)));
    for (const {ability, item, type, cost, owned, missing, bases} of matching) {
      const material = ffxData.items[item];
      const state = missing ? missing + " short" : bases.length ? "Ready" : "Need an open slot";
      const row = entry(ffxData.abilities[ability], [type === 0 ? "Weapon" : "Armor", state].join(" · "),
        `${material} · ${owned} owned / ${cost} required`);
      const footer = element("div", "tracker-actions");
      if (bases.length) {
        const details = element("details", "arena-pending");
        const list = element("ul");
        details.append(element("summary", "", bases.length + " eligible " + (bases.length === 1 ? "piece" : "pieces")), list);
        for (const {member, piece} of bases) {
          const equipped = piece.equipped ? " · equipped" : "";
          const slots = piece.abilities.filter(id => id === null).length;
          list.append(element("li", "", `${catalog.x.party[member.id]} · ${gearName(piece, member.id)} · ${slots} free${equipped}`));
        }
        footer.append(details);
      }
      if (missing || search.length) footer.append(action("Find " + material, () => choose("bestiary", material)));
      if (footer.childElementCount) row.append(footer);
      sheet.append(row);
    }
    if (!matching.length) sheet.append(entry("No matching recipes", "", "Clear a filter or search for a different material."));
  };
  query.addEventListener("input", () => {
    customizationQuery = query.value;
    redraw();
  });
  controls.append(query, types, ready);
  panel.append(controls, sheet);
  redraw();
}
