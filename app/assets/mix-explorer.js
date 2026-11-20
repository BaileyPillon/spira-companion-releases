"use strict";

const mixFamilies = [["Damage",0,32],["Recovery",33,41],["Protection",42,49],["Enhancement",50,63]];
const mixWorkbench = {open:false, result:33, item:null, page:0, pairKey:null, via:null, parents:[]};

function mixWorkbenchRecipes(result, stock, via) {
  return result.recipes.filter(pair => via == null || pair.includes(via)).sort((a,b) =>
    mixRecipeStock(stock,b) - mixRecipeStock(stock,a) || mixUnitsShort(stock,a) - mixUnitsShort(stock,b));
}

function makeMixExplorer() {
  const host = element("details","mix-explorer");
  const state = mixWorkbench;
  host.open = state.open;
  host.append(element("summary","","Explore Mix by effect"));
  const body = element("div","mix-explorer-body");
  host.append(body);
  let stock;
  host.addEventListener("toggle",() => {
    state.open = host.open;
    if (host.open && stock) draw();
  });

  function visit(changes) {
    const {result,item,page,pairKey,via} = state;
    state.parents.push({result,item,page,pairKey,via});
    if (state.parents.length > 32) state.parents.shift();
    Object.assign(state,{page:0,pairKey:null},changes);
    draw(true);
  }

  function draw(moveFocus = false) {
    const focusKey = body.contains(document.activeElement) ? document.activeElement.dataset.workKey : "";
    body.replaceChildren();
    const back = action("Back one step",() => {
      Object.assign(state,state.parents.pop());
      draw(true);
    });
    back.disabled = !state.parents.length;
    back.dataset.workKey = "back";
    const heading = element("h2");
    heading.tabIndex = -1;
    body.append(heading);
    if (state.item != null) {
      const id = state.item;
      heading.textContent = mixItemNames[id];
      body.append(element("p","field-note",stock[id] + " owned · Choose a Mix to see partners for this ingredient."));
      const links = element("div","mix-crosslinks");
      for (const mix of mixSortedResults) {
        const pairs = mix.recipes.filter(pair => pair.includes(id));
        if (!pairs.length) continue;
        const link = action(mix.name,() => visit({item:null, via:id, result:mix.index}));
        const ready = pairs.filter(pair => mixRecipeStock(stock,pair)).length;
        link.append(element("small","",ready + " / " + pairs.length + " pairs in stock"));
        link.dataset.workKey = "result-" + mix.index;
        links.append(link);
      }
      const source = action("Find " + mixItemNames[id],() => openItemSources(mixItemNames[id]));
      body.append(back,source,links);
    } else {
      const mix = mixResults[state.result];
      const family = mixFamilies.find(([,lo,hi]) => mix.index >= lo && mix.index <= hi);
      const families = element("div","mix-family");
      for (const category of mixFamilies) {
        const button = action(category[0],() => visit({result:category[1],item:null,via:null}));
        button.setAttribute("aria-pressed",String(family === category));
        button.dataset.workKey = "family-" + category[1];
        families.append(button);
      }
      const select = options("Mix result", mixResults.slice(family[1],family[2]+1).map(m => [m.index,m.name]),mix.index,
        value => visit({result:Number(value),item:null,via:null}));
      select.dataset.workKey = "select";
      heading.textContent = mix.name;
      body.prepend(families,select);
      body.append(element("p","mix-effect",mix.effect));
      const recipes = mixWorkbenchRecipes(mix,stock,state.via);
      const held = state.pairKey == null ? -1 : recipes.findIndex(pair => pair.join("/") === state.pairKey);
      state.page = held >= 0 ? held : Math.min(state.page,recipes.length-1);
      const pair = recipes[state.page];
      const tiles = element("div","mix-equation");
      for (const [i,id] of pair.entries()) {
        const button = action(mixItemNames[id],() => { state.pairKey = pair.join("/"); visit({item:id,via:null}); });
        const needed = pair[0] === pair[1] ? 2 : 1;
        button.append(element("small","",stock[id] + " owned" + (needed === 2 ? " · need 2 total" : "")));
        button.dataset.workKey = "ingredient-" + i;
        tiles.append(button);
      }
      const count = mixRecipeStock(stock,pair);
      const status = element("p","mix-stock-line",count ? "Enough for " + count + (count === 1 ? " Mix" : " Mixes") : "Missing " +
        mixMissingIngredients(stock,pair).map(id => mixItemNames[id]).join(" and "));
      const pages = element("div","recipe-pager");
      function step(direction) {
        state.pairKey = recipes[state.page + direction].join("/");
        draw();
      }
      const before = action("Previous",() => step(-1));
      const after = action("Next",() => step(1));
      before.dataset.workKey = "previous";
      after.dataset.workKey = "next";
      before.disabled = state.page === 0;
      after.disabled = state.page === recipes.length-1;
      const ordinal = element("span","","Pair " + (state.page+1) + " of " + recipes.length);
      ordinal.setAttribute("aria-live","polite");
      pages.append(before,ordinal,after);
      if (state.via != null) body.append(element("p","field-note","Using " + mixItemNames[state.via]));
      body.append(tiles,status,pages);
      if (state.parents.length) body.append(back);
    }
    if (moveFocus) heading.focus({preventScroll:true});
    else if (focusKey) {
      const button = body.querySelector('[data-work-key="' + focusKey + '"]');
      (button?.disabled ? heading : button)?.focus({preventScroll:true});
    }
  }
  return {host,update(next) { stock = next; if (host.open) draw(); }};
}
