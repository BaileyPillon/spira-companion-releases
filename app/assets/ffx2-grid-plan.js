"use strict";

const x2GateColors = ["Red","Green","Yellow","Blue"];
const x2GatePaint = ["#f69894","#a8e0ad","#f5d88b","#a9bff6"];

function x2GateNames(mask) {
  return x2GateColors.filter((_, index) => mask & (1 << index));
}

function x2NativeGrid(rows) {
  const xs = rows.map(row => row[0]), ys = rows.map(row => row[1]);
  const width = Math.max(...xs) - Math.min(...xs), height = Math.max(...ys) - Math.min(...ys);
  const scale = 100 / Math.max(1, width, height);
  const left = Math.min(...xs) + width / 2, top = Math.min(...ys) + height / 2;
  const points = rows.map(([x,y]) => [62 + (x - left) * scale, 62 + (y - top) * scale]);
  const ids = [], slots = new Map();
  for (const [id,[,,type]] of rows.entries()) {
    if (type === 0) {
      slots.set(id, ids.length);
      ids.push(id);
    }
  }
  const edges = [];
  for (const [a,id] of ids.entries()) {
    for (const next of rows[id][3]) connect(a, next, []);
  }
  return {topology:[ids.map(id => points[id]),edges], ids, jobs:ids.map(id => rows[id][4]), rows};

  function connect(a, node, via) {
    const b = slots.get(node);
    if (b != null) {
      if (b > a) {
        const gates = via.map(id => [id,rows[id][2] - 1,points[id]]);
        const mask = gates.reduce((all, [,color]) => all | (1 << color), 0);
        edges.push([a,b,mask,via.map(id => points[id]),gates]);
      }
      return;
    }
    if (via.includes(node)) return;
    for (const next of rows[node][3]) connect(a, next, [...via,node]);
  }
}

function x2GridPosition(layout, member, fighter, battle) {
  const equipped = (battle ? fighter?.job : member.dressphere) - 0x5000;
  // Trainer and Mascot use character-specific battle job IDs but share one grid icon.
  const job = [12,12,14,14][equipped - 26] ?? equipped;
  if (!(job > 0)) return -1;
  const matching = layout.jobs.flatMap((value, slot) => value === job ? [slot] : []);
  const saved = layout.ids.indexOf(member.gridSlot);
  if (matching.includes(saved)) return saved;
  return matching.length === 1 ? matching[0] : -1;
}

function x2GridCrossed(rows, bits) {
  return rows.reduce((mask, [,,type], id) => type && (bits & (1 << id)) ? mask | (1 << (type - 1)) : mask, 0);
}

function x2GridRoute(topology, start, required, blocked = new Set(), end = null,
    {gates = 0, slots = 0, visitAll = false} = {}) {
  const [nodes, edges] = topology;
  if (!nodes[start] || blocked.has(start) || (end != null && (!nodes[end] || blocked.has(end)))) return null;
  if (visitAll && blocked.size) return null;
  const slotBit = slot => visitAll ? 16 << slot : 0;
  const goal = required | (visitAll ? ((1 << nodes.length) - 1) << 4 : 0);
  const initial = gates | (visitAll ? slots << 4 : 0) | slotBit(start);
  const queue = [{nodes:[start], edges:[], mask:initial}];
  const visited = new Set([start + "/" + initial]);
  for (const route of queue) {
    const slot = route.nodes.at(-1);
    if ((route.mask & goal) === goal && (end == null || slot === end)) return route;
    for (const [index,[a,b,gates]] of edges.entries()) {
      const next = a === slot ? b : b === slot ? a : -1;
      if (next < 0 || blocked.has(next)) continue;
      const mask = route.mask | gates | slotBit(next);
      const key = next + "/" + mask;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({nodes:[...route.nodes,next], edges:[...route.edges,index], mask});
    }
  }
  return null;
}

function drawX2Grid(canvas, topology, route, start, blocked, crossed) {
  const [nodes, edges] = topology;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.clearRect(0, 0, 124, 124);
  for (const [index,[a,b,mask,bends,gates]] of edges.entries()) {
    const onRoute = route?.edges.includes(index);
    const points = [nodes[a], ...bends, nodes[b]];
    const edge = new Path2D();
    edge.moveTo(...points[0]);
    for (const point of points.slice(1)) edge.lineTo(...point);
    ctx.strokeStyle = onRoute ? "#91e1cf" : blocked.has(a) || blocked.has(b) ? "#344c55" : "#759199";
    ctx.lineWidth = onRoute ? 2.1 : 1.3;
    ctx.lineCap = "round";
    ctx.stroke(edge);
    if (!mask) continue;
    const center = bends[Math.floor(bends.length / 2)] ||
      [(nodes[a][0] + nodes[b][0]) / 2, (nodes[a][1] + nodes[b][1]) / 2];
    for (const [id,color,[x,y]] of gates || [[-1,Math.log2(mask),center]]) {
      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = x2GatePaint[color] || "#f3eee1";
      ctx.fillRect(-3.2,-3.2,6.4,6.4);
      if (id >= 0 && (crossed & (1 << id))) {
        ctx.fillStyle = "#172a32";
        ctx.fillRect(-1.5,-1.5,3,3);
      }
      ctx.restore();
      if (color >= 0 && color < x2GateColors.length) {
        ctx.save();
        ctx.font = "bold 5px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = id >= 0 && (crossed & (1 << id)) ? "#fff" : "#13212a";
        ctx.fillText(x2GateColors[color][0],x,y+.25);
        ctx.restore();
      }
    }
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "650 8px Roboto, sans-serif";
  for (const [index,[x,y]] of nodes.entries()) {
    ctx.beginPath();
    ctx.arc(x,y,6.4,0,Math.PI * 2);
    ctx.fillStyle = start === index ? "#91e1cf" : blocked.has(index) ? "#101e25" : "#213e48";
    ctx.fill();
    ctx.strokeStyle = route?.nodes.includes(index) ? "#91e1cf" : "#759199";
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.fillStyle = start === index ? "#101e25" : blocked.has(index) ? "#a0b2b3" : "#eff5ef";
    ctx.fillText(String(index + 1),x,y + .25);
  }
}

function showX2GridPlan(host, topology, gates, plan, live, special) {
  const [nodes, edges] = topology;
  const rewards = gates.filter(([mask]) => mask > 0);
  const allGates = edges.reduce((mask, edge) => mask | edge[2], 0);
  const slots = nodes.map((_,index) => [index,live?.labels[index] || "Slot " + (index + 1)]);
  const blocked = new Set(slots.map(([index]) => index).filter(index =>
    plan.slots.get(index) ?? live?.empty.has(index)));
  const usable = slots.filter(([index]) => !blocked.has(index));
  const current = live?.position >= 0 && !blocked.has(live.position) ? live.position : null;
  const starts = current == null ? slots : [["live","Current · " + live.names[current]],...slots];
  const surface = element("div", "sheet garment-route");
  const controls = element("div", "filters garment-route-controls");
  const canvas = element("canvas", "garment-diagram");
  canvas.width = canvas.height = 248;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Garment Grid slots and gate connections");
  const text = element("div", "garment-route-description");
  text.setAttribute("aria-live", "polite");
  const goals = rewards.length ? [["all","All gates"], ...rewards.map(([,effect],index) => [index,effect])] : [["","Route only"]];
  if (special) goals.push(["special","Use " + special]);
  const reward = rewards.length || special ? options("Gate reward", goals,
    goals.some(([id]) => String(id) === plan.reward) ? plan.reward : rewards.length ? 0 : "", value => {
    plan.reward = value;
    update();
  }) : null;
  const startValue = starts.some(([value]) => String(value) === plan.start) ? plan.start :
    current == null ? (usable[0] || slots[0])[0] : "live";
  const start = options("Starting slot", starts, startValue, value => {
    plan.start = value;
    update();
  });
  const end = options("Ending slot", [["","Any slot"],...slots], plan.end ?? "", value => {
    plan.end = value;
    update();
  });
  const occupied = element("details", "arena-pending garment-route-slots");
  occupied.open = plan.slotsOpen;
  occupied.addEventListener("toggle", () => { plan.slotsOpen = occupied.open; });
  occupied.append(element("summary", "", "Available slots"));
  const checks = element("div", "filters");
  for (const [index,label] of slots) {
    const field = element("label", "mix-filter", label);
    const check = element("input");
    check.type = "checkbox";
    check.checked = !blocked.has(index);
    check.addEventListener("change", () => {
      plan.slots.set(index, !check.checked);
      if (check.checked) blocked.delete(index);
      else blocked.add(index);
      update();
    });
    field.prepend(check);
    checks.append(field);
  }
  occupied.append(checks);
  const fields = [[start,"Start"],[end,"Finish"]];
  if (reward) fields.unshift([reward,"Goal"]);
  for (const [input,label] of fields) {
    const field = element("label", "", label);
    field.append(input);
    controls.append(field);
  }
  const practice = garmentRehearsal(topology,rewards,plan,live,canvas);
  surface.append(practice.toggle, controls, occupied, practice.stage, practice.body, text);
  host.append(surface);
  update();

  function update() {
    const follow = start.value === "live";
    const first = follow ? current : Number(start.value);
    const last = end.value === "" ? null : Number(end.value);
    const visitAll = reward?.value === "special";
    const required = reward?.value === "all" ? allGates :
      visitAll || !reward?.value ? 0 : rewards[Number(reward.value)][0];
    const crossed = live?.crossed;
    const already = crossed == null ? 0 : x2GridCrossed(live.rows, crossed);
    const practicing = practice.show(first,blocked,follow ? already : 0,update);
    text.hidden = practicing;
    if (reward) reward.parentElement.hidden = practicing;
    end.parentElement.hidden = practicing;
    if (practicing) return;
    const visited = follow ? live.ids.reduce((mask, id, slot) =>
      crossed & (1 << id) ? mask | (1 << slot) : mask, 0) : 0;
    const route = x2GridRoute(topology, first, required, blocked, last,
      {gates:follow ? already : 0, slots:visited, visitAll});
    drawX2Grid(canvas, topology, route, first, blocked, crossed);
    const connections = edges.map(([a,b,mask]) => `${a+1} to ${b+1}${mask ? " via " + x2GateNames(mask).join(" and ") : ""}`);
    canvas.setAttribute("aria-label", "Garment Grid connections. " + connections.join(". ") +
      (already ? ". Crossed " + x2GateNames(already).join(", ") : ""));
    if (!route) {
      text.replaceChildren(element("p", "", visitAll && blocked.size ?
        `Fill ${blocked.size} empty slot${blocked.size === 1 ? "" : "s"} to use ${special}.` :
        "No route with these slots. Check the start, finish, and connecting dresspheres."));
      return;
    }
    const count = route.edges.length;
    const path = route.nodes.map(slot => live?.names[slot] || slot + 1).join(" → ");
    const colors = route.edges.flatMap((index, step) => {
      const [a,,mask,,gates] = edges[index];
      if (!gates) return x2GateNames(mask);
      const names = gates.map(([,color]) => x2GateColors[color]);
      return route.nodes[step] === a ? names : names.reverse();
    });
    const extra = visitAll ? count ? "Visit every dressphere on the grid." :
      follow && crossed != null ? `${special} unlocked. In Spherechange, press R1, then ×.` : "" :
      colors.length ? "Cross " + colors.join(" → ") :
      count ? "" : follow && required ? "Reward gates already crossed." : "Choose a reward or finishing slot to plan a route.";
    text.replaceChildren(element("strong", "", `${count} spherechange${count === 1 ? "" : "s"}`),
      element("p", "", path));
    if (extra) text.append(element("p", "field-note", extra));
    if (follow && crossed != null && allGates) {
      text.append(element("p", "field-note", already ? "Crossed · " + x2GateNames(already).join(", ") : "No gates crossed yet."));
    }
  }
}
