const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const test = require("node:test");

const context = vm.createContext({});
for (const path of ["ffx-field-guide-data", "ffx2-field-guide", "ffx-yojimbo"]) {
  vm.runInContext(fs.readFileSync(`app/assets/${path}.js`, "utf8"), context);
}
const {
  x2OversoulEntries, x2OversoulSeen, x2BlueBullets, x2BlueEncounters, x2BlueOpportunity, x2MatchesFloor,
  x2FieldChecks, x2BlueKey, zanmatoRolls, zanmatoQuote, zanmatoFoes
} = vm.runInContext(`({
  x2OversoulEntries, x2OversoulSeen, x2BlueBullets, x2BlueEncounters, x2BlueOpportunity, x2MatchesFloor,
  x2FieldChecks, x2BlueKey, zanmatoRolls, zanmatoQuote, zanmatoFoes
})`, context);

test("Shinra's auto-fill checks the correct little-endian bit and leaves unmapped entries manual", () => {
  assert.equal(x2OversoulEntries.length, 131);
  const mapped = x2OversoulEntries.filter(([,bit]) => bit != null);
  assert.equal(mapped.length, 95);
  assert.equal(new Set(mapped.map(([,bit]) => bit)).size, mapped.length);
  assert.ok(mapped.every(([,bit]) => bit >= 0x180 && bit < 0x200));
  const data = Buffer.alloc(64);
  data[0x183 >> 3] = 1 << (0x183 % 8);
  const hex = data.toString("hex");
  assert.equal(mapped.find(([name]) => name === "Barbuta")[1], 0x183);
  assert.ok(x2OversoulSeen(hex, 0x183));
  assert.ok(!x2OversoulSeen(hex, 0x184));
  assert.ok(!x2OversoulSeen(hex, null));
  assert.ok(!x2OversoulSeen("08", 0x183));
  assert.ok(x2MatchesFloor("81+", 98));
  assert.ok(!x2MatchesFloor("81+", 80));
  assert.ok(x2MatchesFloor("Any", 1));
  assert.ok(x2MatchesFloor("100 boss", 100));
  assert.ok(!x2MatchesFloor("", 100));
});

test("Blue Bullet opportunities match a living target and follow each able Gun Mage", () => {
  assert.equal(x2BlueBullets.length, 16);
  const current = {battle:true, enemies:[{name:"Coeurl", hp:1}, {name:"Gippal", hp:0}], party:[
    {id:0, hp:20, job:0x5001}, {id:1, hp:0, job:0x5002}, {id:2, hp:15, job:0x5002}
  ]};
  assert.deepEqual([...x2BlueEncounters(current).keys()], ["White Wind","Blaster"]);
  assert.equal(x2BlueEncounters(current).get("White Wind"), "Coeurl");
  const opportunity = x2BlueOpportunity(current);
  assert.equal(opportunity.member, 2);
  x2FieldChecks.add(x2BlueKey(2, "White Wind"));
  assert.deepEqual([...x2BlueOpportunity(current).names], ["Blaster"]);
  x2FieldChecks.add(x2BlueKey(2, "Blaster"));
  assert.equal(x2BlueOpportunity(current), null);
  current.enemies = [{name:"Garik", hp:10}];
  assert.deepEqual([...x2BlueEncounters(current).keys()], ["Mighty Guard"]);
  assert.equal(x2BlueOpportunity({...current, battle:false}), null);
});

test("Zanmato odds respect gil brackets, live targeting, and affordable offers", () => {
  assert.equal(zanmatoRolls(255, 6, 1, true), zanmatoRolls(255, 6, 7, true));
  assert.equal(zanmatoRolls(255, 6, 8, true), 15);
  assert.equal(zanmatoRolls(255, 6, 8, false), 0);
  assert.equal(zanmatoRolls(255, 1, 32768, true), 64);
  assert.equal(zanmatoRolls(255, 1, 0, true), 0);
  const plan = zanmatoQuote(255, 6, 5000, true, 16384);
  assert.equal(plan.tier, 4096);
  assert.equal(plan.next, 8192);
  assert.equal(plan.half, 16384);
  assert.equal(plan.ninety, undefined);
  assert.equal(plan.bestPayment, 16384);
  assert.equal(zanmatoQuote(255, 6, 1, true, 0).best, 0);
  assert.deepEqual([...zanmatoFoes({enemies:[{id:2,hp:0,targeted:true},{id:7,hp:5},{id:8,hp:3,targeted:true}]})], [8,7,8]);
});
