"use strict";

const fiendPages = new Map();
const fiendsPerPage = 12;

function pageFiends(game, filter, rows, nameOf, redraw, sheet) {
  const state = fiendPages.get(game);
  const pages = Math.max(1,Math.ceil(rows.length / fiendsPerPage));
  const page = state?.filter === filter ? Math.min(state.page,pages-1) : 0;
  fiendPages.set(game,{filter,page});
  function jump(next) {
    fiendPages.set(game,{filter,page:next});
    redraw();
    const first = sheet.querySelector(".fiend-pager");
    if (first) {
      first.scrollIntoView({block:"start"});
      first.querySelector("select")?.focus({preventScroll:true});
    }
  }
  if (pages > 1) {
    const step = (label,n) => {
      const button = action(label,()=>jump(n));
      button.disabled = n < 0 || n >= pages;
      return button;
    };
    const nav = element("div","fiend-pager");
    const ranges = Array.from({length:pages},(_,i)=>{
      const first = i * fiendsPerPage, last = Math.min(rows.length,first+fiendsPerPage)-1;
      return [i,(first+1)+"–"+(last+1)+" · "+nameOf(rows[first])+" – "+nameOf(rows[last])];
    });
    nav.append(element("p","sub",rows.length+" matching fiends"),options("Fiend index page",ranges,page,v=>jump(Number(v))));
    const moves = element("div","filters");
    moves.append(step("Previous fiends",page-1),step("Next fiends",page+1));
    nav.append(moves);
    sheet.append(nav);
  }
  return rows.slice(page * fiendsPerPage,(page+1) * fiendsPerPage);
}
