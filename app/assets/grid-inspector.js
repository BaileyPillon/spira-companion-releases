"use strict";

const gridGlyphs = {
  power: ["Power", "#ffb6a5"], mana: ["Mana", "#cdb9ff"],
  speed: ["Speed", "#95dcff"], fortune: ["Fortune", "#ffdc90"],
  ability: ["Ability", "#a8ebc9"], lock: ["Lock", "#e3e8f3"],
  empty: ["Empty", "#adbcca"], unknown: ["Unknown", "#adbcca"]
};
const gridViews = new Map();
const gridSearches = new Map();

function gridGlyph(type) {
  if (type === 1) return "empty";
  const sphere = gridActivationSphere(type);
  if (sphere >= 0x2051 && sphere <= 0x2054) return "lock";
  return ["power","mana","speed","ability","fortune"][sphere - 0x2046] || "unknown";
}

const gridOutlines = {
    power:[[-1,0],[0,-1],[1,0],[0,1]], mana:[[-1,.8],[0,-1],[1,.8]],
    speed:[[-1,-.7],[0,-.7],[1,0],[0,.7],[-1,.7],[-.25,0]],
    fortune:[[-1,-.3],[-.3,-.3],[-.3,-1],[.3,-1],[.3,-.3],[1,-.3],[1,.3],[.3,.3],[.3,1],[-.3,1],[-.3,.3],[-1,.3]],
    lock:[[-.85,-.85],[.85,-.85],[.85,.85],[-.85,.85]]
};

function drawGridGlyph(ctx, kind, x, y, size, ink) {
  ctx.save();
  ctx.translate(x,y);
  ctx.scale(size,size);
  ctx.beginPath();
  if (gridOutlines[kind]) {
    gridOutlines[kind].forEach(([dx,dy],i) => i ? ctx.lineTo(dx,dy) : ctx.moveTo(dx,dy));
    ctx.closePath();
  } else ctx.arc(0,0,.85,0,2*Math.PI);
  ctx.fillStyle = ctx.strokeStyle = ink;
  if (kind === "empty" || kind === "unknown") {
    ctx.lineWidth = .28;
    ctx.stroke();
  } else ctx.fill();
  ctx.restore();
}

function gridLegend() {
  const legend = element("details","node-legend");
  legend.dataset.detailKey = "grid-symbols";
  legend.append(element("summary","","Read the symbols"));
  const list = element("ul","node-symbols");
  for (const [kind,[label,ink]] of Object.entries(gridGlyphs)) {
    if (kind === "unknown") continue;
    const item = element("li");
    const icon = element("canvas");
    icon.width = icon.height = 40;
    icon.setAttribute("aria-hidden","true");
    drawGridGlyph(icon.getContext("2d"),kind,20,20,14,ink);
    item.append(icon,document.createTextNode(label));
    list.append(item);
  }
  legend.append(list,element("p","field-note","A gold ring marks the character. A white ring marks your selection. Filled centers with a dark dot have been activated by this character."));
  return legend;
}

// International adds Special and Skill commands after the standard magic rows.
function gridRemoteSphere(type) {
  if (!ffxData.types[type]?.[2]) return gridActivationSphere(type) != null && !ffxData.types[type]?.[1] ? 8267 : null;
  if (type >= 78 && type <= 99) return 8270;
  if (type >= 100 && type <= 118) return 8271;
  if ((type >= 58 && type <= 77) || type === 119 || type === 126) return 8268;
  return 8269;
}

function gridNodeInspector(graph, current, index, member, amounts) {
  const [type,mask] = gridBytes(current,index);
  const original = ffxData.types[graph.nodes[index][2]]?.[0] || "Unknown";
  const kind = gridGlyph(type);
  const inspector = element("section","node-inspector");
  inspector.append(element("h2","","Node " + (index + 1)));
  const values = element("dl","node-values");
  for (const [label,name] of [["Original layout",original],["In your save",ffxData.types[type]?.[0] || "Unknown"]]) {
    const cell = element("div");
    cell.append(element("dt","",label),element("dd","",name));
    values.append(cell);
  }
  const party = Object.entries(catalog.x.party).filter(([id]) => Number(id) < 7 && (mask & (1 << Number(id)))).map(([,name]) => name);
  const activation = kind === "empty" ? "Place a stat node before activation." : kind === "lock" ? "Unlock with the matching key sphere." :
    Number.isInteger(mask) ? "Activated by " + (party.length ? party.join(", ") : "no party members") + "." : "Activation data unavailable.";
  inspector.append(values,element("p","field-note",activation));
  const remote = gridRemoteSphere(type);
  if (remote != null && Number.isInteger(mask) && !(mask & (1 << member))) {
    const sources = element("details","node-remotes");
    sources.dataset.detailKey = "remote-" + index;
    sources.append(element("summary","","Activate from anywhere"));
    const choices = [[8272,"Any distance"]];
    if (mask & 0x7f) choices.unshift([remote,"Already activated by an ally"]);
    for (const [id,reason] of choices) {
      const row = element("div","remote-source");
      row.append(element("span","",reason + " · " + (amounts.get(id) || 0) + " owned"),
        action("Find " + ffxData.items[id],() => openItemSources(ffxData.items[id])));
      sources.append(row);
    }
    inspector.append(sources);
  }
  return inspector;
}
