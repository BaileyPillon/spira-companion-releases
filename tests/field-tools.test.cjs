const test = require("node:test");
const assert = require("node:assert/strict");
const {readFileSync} = require("node:fs");
const {resolve} = require("node:path");
const {createContext,runInContext} = require("node:vm");
const ctx=createContext({});
for (const name of ["primer-desk","ffx2-scene-audit","chapter-board","ffx2-sphere-break","sphere-practice"]) {
  runInContext(readFileSync(resolve(__dirname,"../app/assets/"+name+".js"),"utf8"),ctx);
}
const run=code=>runInContext(code,ctx);

test("English primer volumes decode only the letters their mask teaches",()=>{
  assert.equal(run("alBhedAlphabet.length"),26);
  assert.equal(run("new Set(alBhedAlphabet).size"),26);
  assert.equal(run("decipherPrimerPhrase('Rammu! 12',0,false)"),"·····! 12");
  assert.equal(run("decipherPrimerPhrase('Rammu! 12',1<<7,false)"),"H····! 12");
  assert.equal(run("decipherPrimerPhrase('Rammu! 12',0,true)"),"Hello! 12");
  assert.equal(run("decipherPrimerPhrase('wW',1<<25,false)"),"zZ");
});
test("a chapter counts a multi-flag scene once and keeps alternate routes separate",()=>{
  ctx.scenes=[
    {chapter:1,routeId:"talk",done:true}, {chapter:1,routeId:"talk",done:false},
    {chapter:1,routeId:"optional",done:true,conditional:true}, {chapter:2,routeId:"talk",done:true}
  ];
  assert.equal(run("chapterReviewRows(scenes,false).length"),5);
  assert.equal(run("chapterReviewRows(scenes,false)[0].total"),1);
  assert.equal(run("chapterReviewRows(scenes,false)[0].recorded"),0);
  assert.equal(run("chapterReviewRows(scenes,true)[0].recorded"),1);
  assert.equal(run("chapterReviewRows(scenes,false)[1].recorded"),1);
});
test("Sphere Break practice enforces entry-first, blank slots and the first multiple",()=>{
  run("globalThis.board=makeSpherePractice(practiceExample,'demo')");
  assert.equal(run("practiceLegal(board,4)"),false);
  assert.equal(run("practiceLegal(board,-1)"),false);
  run("board.picks.push(0)");
  assert.equal(run("practiceLegal(board,0)"),false);
  assert.equal(run("practiceLegal(board,5)"),false);
  assert.equal(run("practiceLegal(board,2)"),true);
  run("board.picks.push(2)");
  assert.equal(run("practiceSum(board)"),4);
  assert.equal(run("practiceFinished(board)"),true);
  assert.equal(run("practiceLegal(board,1)"),false);
  assert.equal(run("practiceHint(board)"),null);
});
test("next-coin guidance follows the solver then adapts to a player's own route",()=>{
  run("globalThis.board=makeSpherePractice(practiceExample,'demo')");
  assert.equal(run("practiceHint(board)"),run("board.plan[0]"));
  run("board.picks.push([0,1,2,3].find(id=>id!==board.plan[0]))");
  let steps=0;
  while (!run("practiceFinished(board)") && steps++<16) {
    const id=run("practiceHint(board)"); assert.ok(Number.isInteger(id));
    assert.equal(run("practiceLegal(board,"+id+")"),true);run("board.picks.push("+id+")");
  }
  assert.equal(run("practiceFinished(board)"),true);
  assert.equal(run("makeSpherePractice({core:'',entry:'1235',border:''},'bad')"),null);
  run("globalThis.dead=makeSpherePractice({core:'9',entry:'1111',border:'000000000000'},'empty border')");
  assert.equal(run("practiceHint(dead)"),null);
});
