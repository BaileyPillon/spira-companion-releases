const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { createContext, runInContext } = require("node:vm");
const test = require("node:test");

test("a short feed interruption keeps the last live frame until recovery or timeout", () => {
  const connection = {dataset: {}};
  let now = 10000;
  const previousFrames = [];
  const next = timestamp => ({
    schema: 1, timestamp, status: "live", game: "x2", disc: "SLUS-20672",
    room: 221, gil: 300, battles: 0, party: [], items: [],
  });
  const context = createContext({
    updateHuntSession() {},
    document: {querySelector: () => connection, querySelectorAll: () => []},
    Date: {now: () => now},
    catalog: {x2: {}},
    window: {},
    rememberExit(previous) { previousFrames.push(previous); },
  });
  const code = readFileSync(join(__dirname, "../app/assets/spira.js"), "utf8");
  runInContext(readFileSync(join(__dirname, "../app/assets/workspace.js"), "utf8"), context);
  // Observe the selected frame and badge without a browser layout.
  runInContext(code.replace(/render\(\);\s*$/, "") + `
    render = () => showConnection(reconnecting ? "reconnecting" : state);
    window.current = () => frame;
  `, context);
  const update = context.window.Spira.update;
  update(next(now), false);
  assert.equal(connection.dataset.state, "live");

  now += 500;
  update(null, false);
  assert.equal(connection.dataset.state, "reconnecting");
  assert.equal(context.window.current().room, 221);

  now += 500;
  update(next(now), false);
  assert.equal(connection.dataset.state, "live");
  assert.equal(context.window.current().timestamp, now);
  assert.equal(previousFrames.at(-1), null, "A reconnect cannot establish which room exit was used");

  now += 3001;
  update(null, false);
  assert.equal(connection.dataset.state, "stale");
  assert.equal(context.window.current(), null);
});
