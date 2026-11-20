"use strict";

// Results are ordered by FFX command ID, starting at 0x308B.
const mixEffects = [
  "Damage to all enemies.",
  "Damage and Armor Break to all enemies.",
  "Damage to all enemies.",
  "Damage to all enemies.",
  "Damage to all enemies.",
  "Damage to all enemies.",
  "Damage and status ailments to all enemies.",
  "Damage and status ailments to all enemies.",
  "Damage and status ailments to all enemies.",
  "Damage, Full Break, Slow, Poison, Darkness, Silence and Sleep to all enemies.",
  "Fire damage to all enemies.",
  "Fire damage to all enemies.",
  "Fire damage to all enemies.",
  "Fire damage and status ailments to all enemies.",
  "Fire damage and status ailments to all enemies.",
  "Ice damage to all enemies.",
  "Ice damage to all enemies.",
  "Ice damage to all enemies.",
  "Ice damage and status ailments to all enemies.",
  "Ice damage and status ailments to all enemies.",
  "Lightning damage to all enemies.",
  "Lightning damage to all enemies.",
  "Lightning damage to all enemies.",
  "Lightning damage and status ailments to all enemies.",
  "Lightning damage and status ailments to all enemies.",
  "Water damage to all enemies.",
  "Water damage to all enemies.",
  "Water damage to all enemies.",
  "Water damage and status ailments to all enemies.",
  "Water damage and status ailments to all enemies.",
  "Gravity damage equal to 75% of current HP.",
  "Gravity damage equal to 15/16 of current HP.",
  "Deals 19,998 fixed damage to all enemies.",
  "Fully restores party HP.",
  "Cures the party’s status ailments.",
  "Restores half of party HP and cures status ailments.",
  "Revives all KO’d allies at full HP.",
  "Revives KO’d allies and restores party HP to full.",
  "Fully restores one ally’s HP and MP.",
  "Fully restores party HP and MP.",
  "Fully restores party HP and MP and cures status ailments.",
  "Revives KO’d allies, restores party HP and MP and cures status ailments.",
  "Blocks fire, ice, lightning and water once each for one ally.",
  "Blocks fire, ice, lightning and water once each for the party.",
  "Blocks the four elements and adds Cheer and Focus to the party.",
  "Blocks the four elements and adds Cheer, Focus, Aim and Reflex.",
  "Protect and Shell for the party.",
  "Protect, Shell and Haste for the party.",
  "Protect, Shell, Haste and Regen for the party.",
  "Protect, Shell, Haste, Regen and Auto-Life for the party.",
  "Doubles one ally’s maximum HP.",
  "Doubles the party’s maximum HP.",
  "Doubles maximum HP and adds Cheer for the party.",
  "Doubles one ally’s maximum MP.",
  "Doubles the party’s maximum MP.",
  "Doubles maximum MP and adds Focus for the party.",
  "One ally’s abilities cost no MP.",
  "Party abilities cost no MP.",
  "One ally deals or heals at least 9,999 per hit.",
  "The party deals or heals at least 9,999 per hit.",
  "One ally’s eligible attacks always land critical hits.",
  "The party’s eligible attacks always land critical hits.",
  "Increases the party’s Overdrive charge rate.",
  "Greatly increases the party’s Overdrive charge rate."
];

function mixSearchText(value) {
  return value.toLowerCase().replace(/[’',]/g, "");
}

const mixResults = mixEffects.map((effect, index) => {
  const name = ffxData.commands[0x308b + index];
  return {index, name, effect, search: mixSearchText(name + " " + effect), recipes: []};
});
const mixItemNames = ffxMixRows.map((_, index) => ffxData.items[0x2000 + index]);
const mixItemSearch = mixItemNames.map(mixSearchText);
for (const [high, row] of ffxMixRows.entries()) {
  for (const [low, result] of row.entries()) mixResults[result].recipes.push([low, high]);
}
const mixSortedResults = [...mixResults].sort((a, b) => a.name.localeCompare(b.name));

function mixInventory(items) {
  const stock = new Array(mixItemNames.length).fill(0);
  for (const entry of items) {
    const index = entry?.[0] - 0x2000;
    if (Number.isInteger(index) && index >= 0 && index < stock.length && present(entry[1])) stock[index] += entry[1];
  }
  return stock;
}

function mixRecipeStock(stock, [first, second]) {
  return first === second ? Math.floor(stock[first] / 2) : Math.min(stock[first], stock[second]);
}

function mixForPair(first, second) {
  return mixResults[ffxMixRows[Math.max(first, second)]?.[Math.min(first, second)]];
}

const mixPinStorage = "spira.mix.pairs.v1";
const mixPins = new Set();
try {
  const stored = JSON.parse(localStorage.getItem(mixPinStorage) || "[]");
  for (const key of stored) {
    if (typeof key !== "string" || !/^\d{1,3}:\d{1,3}$/.test(key)) continue;
    const [first,second] = key.split(":").map(Number);
    if (first <= second && mixForPair(first,second)) mixPins.add(key);
  }
} catch { /* Local storage is optional. */ }

function mixMissingIngredients(stock, [first, second]) {
  if (first === second) return stock[first] < 2 ? [first] : [];
  return [first,second].filter(id => stock[id] < 1);
}
function mixUnitsShort(stock,[first,second]) {
  return first===second ? Math.max(0,2-stock[first]) : Number(!stock[first])+Number(!stock[second]);
}

let mixInStock = true;

function findMixResults(stock, query, ownedOnly) {
  const words = mixSearchText(query.trim()).split(/\s+/).filter(Boolean);
  return mixSortedResults.flatMap(mix => {
    const ingredients = words.filter(word => !mix.search.includes(word));
    const recipes = mix.recipes.filter(recipe => {
      if (ownedOnly && !mixRecipeStock(stock, recipe)) return false;
      const [first, second] = recipe;
      return ingredients.every(word => mixItemSearch[first].includes(word) || mixItemSearch[second].includes(word));
    });
    return recipes.length ? [{...mix, recipes}] : [];
  });
}

function mixReadiness(current) {
  if (!current.battle) return "Recipes update with your inventory";
  const rikku = current.party.find(member => member.id === 6);
  if (!rikku) return "Rikku is unavailable";
  if (!rikku.active) return "Rikku is in reserve";
  if (rikku.hp === 0 || (rikku.statusBits & 0x304) || (rikku.statusTimed & 1)) return "Rikku can’t act";
  if (!(rikku.overdriveMax > 0) || !present(rikku.overdrive) || rikku.overdrive > rikku.overdriveMax) {
    return "Waiting for Rikku’s Overdrive";
  }
  return rikku.overdrive === rikku.overdriveMax ? "Rikku’s Overdrive is ready" :
    `Rikku’s Overdrive · ${Math.floor(rikku.overdrive * 100 / rikku.overdriveMax)}%`;
}

const mixQuickPicks = [
  ["Sunburst","Damage"], ["Trio of 9999","Damage cap"], ["Super Mighty G","Party protection"],
  ["Ultra NulAll","Elemental protection"], ["Final Elixir","Recovery"], ["Eccentrick","Overdrive charge"]
];

function quickMixChoices(stock) {
  return mixQuickPicks.flatMap(([name, use]) => {
    const mix = mixResults.find(result => result.name.toLowerCase() === name.toLowerCase());
    if (!mix) return [];
    const recipe = mix.recipes.reduce((best, pair) => mixRecipeStock(stock, pair) >
      (best ? mixRecipeStock(stock, best) : 0) ? pair : best, null);
    return recipe ? [{mix,use,recipe}] : [];
  });
}

function showMix(current, initialQuery) {
  heading("Rikku’s Mix");
  const readiness = element("p", "sub");
  const controls = element("div", "filters mix-controls");
  const search = element("input");
  search.type = "search";
  search.placeholder = "Search Mix, effect or item";
  search.setAttribute("aria-label", search.placeholder);
  search.value = initialQuery;
  const filter = element("label", "mix-filter");
  const onlyOwned = element("input");
  onlyOwned.type = "checkbox";
  onlyOwned.checked = mixInStock;
  filter.append(onlyOwned, element("span", "", "In stock"));
  controls.append(search, filter);
  const results = element("div", "mix-results");
  const quick = element("section", "mix-quick");
  const pinned = element("section", "mix-pinned");
  const calculator = element("details", "mix-calculator");
  calculator.append(element("summary", "", "Check two ingredients"));
  const pairFields = element("div", "filters");
  const pairStock = element("p", "sub");
  const pairResult = element("div", "mix-pair-result");
  pairResult.setAttribute("aria-live", "polite");
  const ingredients = mixItemNames.map((name, id) => [String(id), name]).sort((a, b) => a[1].localeCompare(b[1]));
  const choices = [["", "Choose an item"], ...ingredients];
  const first = options("First ingredient", choices, "", renderPair);
  const second = options("Second ingredient", choices, "", renderPair);
  for (const [label, select] of [["First ingredient", first], ["Second ingredient", second]]) {
    const field = element("label");
    field.append(element("span", "", label), select);
    pairFields.append(field);
  }
  calculator.append(pairFields, pairResult, pairStock);
  const explorer = makeMixExplorer();
  panel.append(readiness, controls, explorer.host, quick, pinned, calculator, results);

  let stock;
  let previousStock = "";
  let hasQuickChoices = false;
  function recipeRow(recipe, showResult = false) {
    const [first, second] = recipe;
    const key = `${first}:${second}`;
    const row = element("li", "mix-recipe");
    const pair = first === second ? mixItemNames[first] + " ×2" : mixItemNames[first] + " + " + mixItemNames[second];
    const missing = mixMissingIngredients(stock, recipe);
    const amounts = first === second ? `${stock[first]} owned · 2 needed` : `${stock[first]} + ${stock[second]} owned`;
    const text = element("div", "mix-ingredients");
    if (showResult) text.append(element("strong", "", mixForPair(first,second).name));
    text.append(element("span", "", pair), element("small", missing.length ? "mix-missing" : "", amounts));
    const controls = element("div", "mix-recipe-actions");
    const pin = action("", () => {
      if (mixPins.has(key)) mixPins.delete(key);
      else mixPins.add(key);
      try { localStorage.setItem(mixPinStorage, JSON.stringify([...mixPins])); } catch { /* Keep the session pins. */ }
      refreshPin();
      renderPinned();
      if (showResult) pinned.querySelector("button")?.focus({preventScroll:true});
      for (const button of results.querySelectorAll(`[data-recipe="${key}"]`)) refreshPin(button);
    });
    function refreshPin(button = pin) {
      button.textContent = mixPins.has(key) ? "Unpin" : "Pin";
      button.setAttribute("aria-label", `${button.textContent} ${pair}`);
      button.setAttribute("aria-pressed", String(mixPins.has(key)));
    }
    pin.dataset.recipe = key;
    refreshPin();
    controls.append(pin);
    for (const id of missing) controls.append(action("Find " + mixItemNames[id], () => openItemSources(mixItemNames[id])));
    row.append(text, controls);
    return row;
  }
  function renderPinned() {
    pinned.replaceChildren();
    pinned.hidden = !mixPins.size;
    if (!mixPins.size) return;
    const list = element("ul", "mix-recipes sheet");
    for (const key of mixPins) list.append(recipeRow(key.split(":").map(Number), true));
    pinned.append(element("h2", "", "Pinned recipes"), list);
  }
  function renderQuick() {
    quick.replaceChildren();
    const choices = quickMixChoices(stock);
    hasQuickChoices = choices.length > 0;
    quick.hidden = !hasQuickChoices || Boolean(search.value.trim());
    if (!hasQuickChoices) return;
    const list = element("div", "filters");
    for (const {mix,use,recipe} of choices) {
      const [a,b] = recipe;
      const ingredients = a === b ? mixItemNames[a] + " ×2" : mixItemNames[a] + " + " + mixItemNames[b];
      const button = action(mix.name, () => {
        search.value = mixQuery = mix.name;
        quick.hidden = true;
        onlyOwned.checked = mixInStock = true;
        renderResults(String(mix.index));
        results.querySelector("details[open] summary")?.focus({preventScroll:true});
      });
      button.title = use + " · " + ingredients;
      list.append(button);
    }
    quick.append(element("h2", "", "Quick mixes in stock"), list);
  }
  function renderPair() {
    if (first.value === "" || second.value === "") {
      pairResult.replaceChildren();
      pairStock.textContent = "";
      return;
    }
    const recipe = [Number(first.value), Number(second.value)];
    const mix = mixForPair(...recipe);
    pairResult.replaceChildren(element("strong", "", mix.name), element("p", "mix-effect", mix.effect));
    updatePairStock();
  }
  function updatePairStock() {
    if (first.value === "" || second.value === "") return;
    const recipe = [Number(first.value), Number(second.value)];
    pairStock.textContent = mixRecipeStock(stock, recipe) ? "Both ingredients in stock" : "Missing ingredients";
  }
  function renderResults(openIndex) {
    const matches = findMixResults(stock, search.value, onlyOwned.checked);
    results.replaceChildren();
    if (!matches.length) {
      results.append(element("p", "empty", onlyOwned.checked ?
        "No matches in your inventory. Turn off In stock to see every recipe." : "No matches. Try a Mix, effect or item name."));
      return;
    }
    for (const mix of matches) {
      const disclosure = element("details", "mix-result");
      disclosure.name = "mix-recipes";
      disclosure.dataset.mix = mix.index;
      const summary = element("summary");
      const title = element("span");
      title.append(element("strong", "mix-name", mix.name), element("small", "mix-effect", mix.effect));
      const available = onlyOwned.checked ? mix.recipes.length :
        mix.recipes.filter(recipe => mixRecipeStock(stock, recipe)).length;
      const count = onlyOwned.checked ? `${available} ${available === 1 ? "recipe" : "recipes"}` :
        `${available} / ${mix.recipes.length} in stock`;
      summary.append(title, element("span", "mix-count", count));
      disclosure.append(summary);
      disclosure.addEventListener("toggle", () => {
        if (!disclosure.open || disclosure.childElementCount > 1) return;
        const recipes = element("ul", "mix-recipes");
        const ordered = [...mix.recipes].sort((a, b) => mixRecipeStock(stock, b) - mixRecipeStock(stock, a) ||
          mixUnitsShort(stock,a)-mixUnitsShort(stock,b));
        for (const recipe of ordered) recipes.append(recipeRow(recipe));
        disclosure.append(recipes);
      });
      results.append(disclosure);
      disclosure.open = String(mix.index) === openIndex || matches.length === 1;
    }
  }
  search.addEventListener("input", () => {
    mixQuery = search.value;
    quick.hidden = !hasQuickChoices || Boolean(search.value.trim());
    renderResults();
  });
  onlyOwned.addEventListener("change", () => {
    mixInStock = onlyOwned.checked;
    renderResults(results.querySelector("details[open]")?.dataset.mix);
  });
  return next => {
    const message = mixReadiness(next);
    if (readiness.textContent !== message) readiness.textContent = message;
    const inventory = mixInventory(next.items);
    const key = inventory.join(",");
    if (key === previousStock) return;
    stock = inventory;
    previousStock = key;
    explorer.update(stock);
    renderQuick();
    renderPinned();
    updatePairStock();
    const open = results.querySelector("details[open]");
    const focused = open?.querySelector("summary") === document.activeElement;
    renderResults(open?.dataset.mix);
    if (focused) results.querySelector("details[open] summary")?.focus({preventScroll:true});
  };
}
