const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function fixture() {
  const store = new Map();
  const env = vm.createContext({
    atob,
    btoa,
    window: {},
    localStorage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => store.set(k, String(v))
    },
    itemAmounts: (items) => new Map(items),
    roomName: () => "Celsius",
    guideRooms: new Map()
  });
  const files = [
    "catalog",
    "ffx-data",
    "ffx",
    "ffx-progress",
    "ffx-arena",
    "ffx-encounter-data",
    "ffx-hunt",
    "ffx-customization-data",
    "ffx-mix-data",
    "ffx-mix",
    "ffx-rooms",
    "ffx-blitzball",
    "ffx-field-guide-data",
    "ffx2-story-data",
    "ffx2-scene-routes",
    "ffx2-ap-data",
    "ffx2",
    "ffx2-field-guide",
    "ffx2-scene-audit",
    "field-plans",
    "field-plans-x",
    "field-plans-x2",
    "workspace"
  ];
  for (const name of files)
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../app/assets", name + ".js"), "utf8"), env, {
      filename: name
    });
  return (code) => JSON.parse(vm.runInContext("JSON.stringify((" + String(code) + ")())", env));
}
test("a circuit covers distinct outstanding species at three mapped stops and skips scripted Omega", () => {
  const run = fixture();
  assert.deepEqual(
    run(() => {
      const c = { arena: "00".repeat(640), room: 110 };
      const { stops, remaining } = captureCircuit(c, 10);
      const names = stops.flatMap((s) => [...s.sightings.keys()]);
      return [
        stops.length,
        new Set(names).size === names.length,
        !stops.some((s) => s.spot[0] === "omega_ruins_upper"),
        remaining.size + names.length === new Set(allArenaFiends).size
      ];
    }),
    [3, true, true, true]
  );
  assert.equal(
    run(() => captureCircuit({ arena: "0a".repeat(640), room: 110 }, 10).stops.length),
    0
  );
});
test("the workshop combines repeated material requirements before subtracting inventory", () => {
  const run = fixture();
  assert.deepEqual(
    run(() => {
      const all = ffxCustomization.flat(),
        r = all.find((x) => all.filter((a) => a[1] === x[1]).length > 1),
        s = all.find((x) => x !== r && x[1] === r[1]);
      const bill = workshopBill(
        [
          [r[0], 2],
          [s[0], 1]
        ],
        new Map([[r[1], 1]])
      );
      return [bill.length, bill[0].short === 2 * r[2] + s[2] - 1];
    }),
    [1, true]
  );
});
test("bribe quote rounds whole encounters and covers the full conservative budget", () => {
  const run = fixture();
  assert.deepEqual(
    run(() => {
      const rows = itemSourceIndex().get("Chocobo Wing");
      const q = bribeShopping(rows, 80, 0);
      return [
        q.length > 0,
        q.every(
          (r) =>
            r.best > 0 &&
            r.worst >= r.best &&
            r.worst === Math.ceil(80 / r.range.min) * r.gil &&
            r.affordable === false
        ),
        bribeShopping(rows, 0, 0).every((r) => r.worst === 0)
      ];
    }),
    [true, true, true]
  );
});
test("Mix reserves handle duplicate ingredients and leave actual inventory intact", () => {
  const run = fixture();
  assert.deepEqual(
    run(() => {
      const stock = [4, 1];
      const usable = reserveStock(stock, [
        [0, 3],
        [1, 8]
      ]);
      return [stock, usable, mixRecipeStock(usable, [0, 0])];
    }),
    [[4, 1], [1, 0], 0]
  );
});
test("Mix shortages count units when both recipe slots use the same item", () => {
  const run=fixture();
  assert.deepEqual(run(()=>[[0,0],[0,1],[1,1]].map(pair=>mixUnitsShort([0,1],pair))),[2,1,1]);
});
test("closest Arena region ignores completed regions and handles unavailable capture data", () => {
  const run=fixture();
  assert.deepEqual(run(()=>{
    const counts=Array(640).fill(10), [region,names]=Object.entries(arenaRegions)[0];
    for (const id of arenaEnemyIds.get(names[0])) counts[id]=9;
    const arena=counts.map(n=>n.toString(16).padStart(2,"0")).join("");
    const current={game:"x",arena};
    const next=closestCaptureRegion(current,10);
    return [next.region===region,next.needed,closestCaptureRegion({},10),closestCaptureRegion(current,5)];
  }),[true,1,null,null]);
});
test("field plans refresh when native labels or Fiend Guide access arrive late", () => {
  const run=fixture();
  assert.deepEqual(run(()=>{
    globalThis.reconnecting=false;
    const a={game:"x2",disc:"SLUS-20672",blueBullets:[1,0,1],loadout:{dresspheres:[[0x5001,1]]}};
    const b={...a,oversoul:"00".repeat(64),loadout:{...a.loadout,dressphereInfo:{1:["Gunner"]}}};
    return ["lessons","bullets"].map(id=>JSON.stringify(fieldPlanSignature(id,a))!==JSON.stringify(fieldPlanSignature(id,b)));
  }),[true,true]);
});
test("ledger compares inventory in either direction including items that disappear", () => {
  const run = fixture();
  assert.deepEqual(
    run(() =>
      inventoryChanges(
        {
          items: [
            [8192, 4],
            [8193, 1]
          ]
        },
        {
          items: [
            [8192, 6],
            [8194, 1]
          ]
        }
      )
    ),
    [
      { id: 8192, before: 4, now: 6, delta: 2 },
      { id: 8193, before: 1, now: 0, delta: -1 },
      { id: 8194, before: 0, now: 1, delta: 1 }
    ]
  );
});
test("bookmarks use the latest matching live frame and reject a preview, disconnection or stale save", () => {
  const run=fixture();
  assert.deepEqual(run(() => {
    const displayed={game:"x2",disc:"SLUS-20672",crc:"48FE0C71"};
    globalThis.frame={...displayed,status:"live",timestamp:Date.now()};
    globalThis.state="live";globalThis.sample=null;globalThis.reconnecting=false;
    const fresh=canRecordPlan(displayed);
    globalThis.reconnecting=true;const disconnected=canRecordPlan(displayed);
    globalThis.reconnecting=false;globalThis.sample={};const preview=canRecordPlan(displayed);
    globalThis.sample=null;const differentDisc=canRecordPlan({...displayed,crc:"other"});
    frame.timestamp-=5000;
    return [fresh,disconnected,preview,differentDisc,canRecordPlan(displayed)];
  }),[true,false,false,false,false]);
});
test("chapter itinerary groups visits by destination, keeps branch choices and omits recorded flags", () => {
  const run = fixture();
  assert.deepEqual(
    run(() => {
      const row = {
        chapter: 2,
        name: "Speech",
        action: "Listen",
        conditional: true,
        done: false,
        routeId: 3,
        location: "Besaid · Village",
        branch: "league"
      };
      const rows = [
        row,
        { ...row, routeId: 4, branch: "yevon" },
        { ...row, routeId: 5, done: true },
        { ...row, routeId: 6, visit: "Celsius · CommSphere" }
      ];
      return [
        sceneItinerary(rows, 2, "league", true).map(([p, rs]) => [p, rs.length]),
        sceneItinerary(rows, 2, "league", false).length,
        sceneItinerary(rows, 3, "any", true).length
      ];
    }),
    [
      [
        ["Besaid", 1],
        ["Celsius · CommSphere", 1]
      ],
      0,
      0
    ]
  );
});
test("save bookmark compares identities rather than totals, including traded and removed flags", () => {
  const run = fixture();
  assert.deepEqual(
    run(() =>
      sceneChanges(
        ["1:2", "2:2"],
        [
          { key: "1:2", done: false },
          { key: "2:2", done: true },
          { key: "3:2", done: true }
        ]
      ).map((x) => [x.key, x.gained])
    ),
    [
      ["1:2", false],
      ["3:2", true]
    ]
  );
});
test("floor sweep handles any-floor entries, intersecting ranges, open ranges, bosses and manual checks", () => {
  const run = fixture();
  assert.deepEqual(
    run(() =>
      floorSweep(
        [
          ["Any", 1, "", "Any"],
          ["Skip", 2, "", "99+"],
          ["Boss", 3, "", "100 boss"],
          ["Bound", 4, "", "85-99"],
          ["Field", 5, "", ""]
        ],
        98,
        100,
        (n) => n === "Skip"
      ).map((r) => [r.name, r.start, r.end])
    ),
    [
      ["Bound", 98, 99],
      ["Any", 98, 100],
      ["Boss", 100, 100]
    ]
  );
});
test("AP shortlist orders only partially learned abilities on owned jobs for selected members", () => {
  const run = fixture();
  assert.deepEqual(
    run(() => {
      const ap = (a, b) => {
        const bytes = new Uint8Array(0x6a0);
        bytes[102] = a;
        bytes[104] = b;
        return btoa(String.fromCharCode(...bytes));
      };
      const c = {
        loadout: {
          dresspheres: [
            [0x5001, 1],
            [0x5002, 0]
          ]
        },
        dressphereAp: [ap(19, 10), ap(20, 29), ap(0, 0)]
      };
      return [apShortlist(c, "all").map((r) => [r.member, r.name, r.remaining]), apShortlist(c, "2").length];
    }),
    [
      [
        [0, "Potshot", 1],
        [1, "Cheap Shot", 1],
        [0, "Cheap Shot", 20]
      ],
      0
    ]
  );
});
test("search prioritizes names, expands established game abbreviations and browses a single category", () => {
  const run = fixture();
  assert.deepEqual(
    run(() => {
      const rows = [
        { name: "Auron", kind: "Fiend", detail: "auto haste" },
        { name: "Auto-Haste", kind: "Equipment ability", detail: "" },
        { name: "Break HP Limit", kind: "Equipment ability", detail: "" }
      ];
      return [
        searchWorkspace(rows, "Auto Haste").map((r) => r.name),
        searchWorkspace(rows, "bhpl")[0].name,
        searchWorkspace(rows, "", "Fiend").length,
        workspaceWords("Mi’ihen — Café")
      ];
    }),
    [["Auto-Haste", "Auron"], "Break HP Limit", 1, "miihen cafe"]
  );
});
test("saved pin priority is stable and shared tools belong to both games", () => {
  const run = fixture();
  assert.deepEqual(
    run(() => {
      const a = { key: "a", kind: "Tool", name: "A" },
        b = { key: "b", kind: "Tool", name: "B" };
      toggleWorkspacePin(a);
      toggleWorkspacePin(b);
      promoteWorkspacePin("b");
      return [
        JSON.parse(localStorage.getItem("spira.workspace.v1")).map((p) => p.key),
        toolSupportsGame("plan-circuit", "x2"),
        toolSupportsGame("plan-ledger", "x2")
      ];
    }),
    [["b", "a"], false, true]
  );
});
