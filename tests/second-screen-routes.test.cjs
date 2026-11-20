const {test} = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const context = vm.createContext({partyName:(_,m) => m.name, ffxData:{abilities:{10:"Deathproof"}}});
const load = name => fs.readFileSync(path.join(__dirname,"../app/assets",name + ".js"),"utf8");
for (const file of ["story-boss-coach","remiem-race","cave-walls"]) vm.runInContext(load(file),context);
const run = expression => JSON.parse(vm.runInContext("JSON.stringify(" + expression + ")",context));

test("only the intended living encounter and form HP pools activate the phase coach", () => {
  for (const [id,maxHp,expected] of [[129,52000,null],[129,60000,"yunalesca"],[130,24000,"yunalesca"],[142,70000,"flux"],[143,4000,null]]) {
    assert.equal(run(`phaseEncounter({battle:true,enemies:[{id:${id},maxHp:${maxHp},hp:1}]})?.key ?? null`),expected);
    assert.equal(run(`phaseEncounter({battle:false,enemies:[{id:${id},hp:1}]})`),null);
    assert.equal(run(`phaseEncounter({battle:true,enemies:[{id:${id},hp:0}]})`),null);
  }
  assert.deepEqual(run("[24000,48000,60000,132000,4100].map(yunalescaForm)"),[0,1,2,-1,-1]);
});
test("the same Zombie changes the recommended action with the boss and actual stock", () => {
  const f = "{party:[{id:0,name:'Tidus',active:true,hp:20,statusBits:2}],items:[[8207,1]]}";
  assert.match(run(`phasePriority(${f},'flux',{hp:65000})`)[1],/Remedy/);
  assert.match(run(`phasePriority(${f},'yunalesca',{maxHp:48000})`)[0],/Keep Tidus/);
  assert.match(run(`phasePriority({... ${f},items:[]},'flux',{hp:1000})`)[1],/No Zombie cure/);
  assert.match(run("phasePriority({party:[]},'flux',{hp:1000})")[1],/watch/i);
});
test("Deathproof requires worn armor and a living, present survivor", () => {
  for (const [equipped,type,active,hp,bits,expected] of [[true,1,true,100,0,true],[false,1,true,100,0,false],[true,0,true,100,0,false],[true,1,false,100,0,false],[true,1,true,0,0,false],[true,1,true,100,4,false]]) {
    const member = {id:0,name:"Tidus",active,hp,statusBits:bits,gear:[{equipped,type,abilities:[10]}]};
    assert.equal(run(`phasePriority({party:[${JSON.stringify(member)}]},'yunalesca',{maxHp:60000})`)[0].includes("Keep Tidus"),expected);
  }
});
test("each Remiem prize has exactly the selected number of chests and a finish", () => {
  assert.equal(run("remiemPrizes.length"),6);
  for (let i = 0; i <= 5; i++) {
    assert.deepEqual(run(`remiemRoute(${i}).map(step=>step[0])`),[..."ABCDE".slice(0,i),"Goal"]);
  }
});
test("all 16 cave walls accept explicit confirmations including zero, in visit order", () => {
  const order = run("caveOrder");
  assert.equal(new Set(order).size,16);
  const rows = {};
  for (const wall of order) {
    assert.equal(run(`caveNext(${JSON.stringify(rows)})`),wall);
    rows[wall] = {code:0};
  }
  assert.equal(run(`caveNext(${JSON.stringify(rows)}) ?? null`),null);
});
test("wall clues add repeated earlier codes, zero and cumulative checkpoint differences", () => {
  const rows = {3:{code:12,battles:2,gil:30},10:{code:8,battles:11,gil:104},11:{battles:13,gil:109}};
  for (const [left,right,code] of [["0","0",0],["W3 + W3","W10",32],["g(3,10) + 7","b(0,11) + W10",102],["B(3,10)","G(10,11)",14]]) {
    assert.equal(run(`caveCalculate(${JSON.stringify({left,right})},${JSON.stringify(rows)},11)`).code,code);
  }
});
test("a missing clue or skipped, future, malformed or reversed interval never yields a code", () => {
  const rows = {3:{battles:5},10:{battles:2}};
  for (const left of ["","W1","W3","W11","B(3,10)","B(10,3)","G(3,10)","B(0,0)","4+","x6","-3","1e3"]) {
    assert.equal(run(`caveCalculate(${JSON.stringify({left,right:"2"})},${JSON.stringify(rows)},11)`).code,undefined,left);
  }
});
