import { test } from "node:test";
import assert from "node:assert/strict";
import { classify } from "../js/scoring.js";
import { RULES } from "../js/rules.js";
import { QUESTIONS } from "../js/questions.js";

const base = { q1: ["unsure"], q2: ["rarely"], q3: ["rarely"], q4: ["rarely"], q5: ["situational"], q6: ["both"], q7: ["none"], q8: ["basics"] };
const run = (over) => classify({ ...base, ...over }, RULES);

test("ルールの選択肢 id が質問データとすべて一致する", () => {
  for (const q of QUESTIONS) {
    const ids = q.options.map((o) => o.id);
    for (const id of Object.keys(RULES.scores[q.id])) assert.ok(ids.includes(id), `${q.id}.${id}`);
  }
});

test("A: つっぱり・保湿頻度が主テーマになる", () => {
  const r = run({ q2: ["often"], q6: ["rarely"] });
  assert.equal(r.main, "A");
  assert.equal(r.sub, null);
});

test("B: 屋外機会と紫外線対策", () => {
  const r = run({ q4: ["daily"], q5: ["forget"] });
  assert.equal(r.main, "B");
});

test("C: 刺激感とケアの重ねすぎ", () => {
  const r = run({ q3: ["sometimes"], q7: ["newItems", "scrub"] });
  assert.equal(r.main, "C");
  assert.equal(r.strongIrritation, false);
});

test("D: 顕著な回答がなければ D、補助テーマなし", () => {
  const r = run({ q1: ["sun"] });
  assert.equal(r.main, "D");
  assert.equal(r.sub, null);
});

test("D: 分からないが多ければ D（他に候補があれば補助テーマ）", () => {
  const r = run({ q1: ["unsure"], q2: ["unknown"], q3: ["unknown"], q4: ["daily"], q5: ["forget"] });
  assert.equal(r.manyUnknown, true);
  assert.equal(r.main, "D");
  assert.equal(r.sub, "B");
});

test("同点は C → A → B の順で主テーマを決め、補助テーマも出す", () => {
  const r = run({ q2: ["often"], q4: ["daily"] }); // A=2, B=2
  assert.equal(r.scores.A, 2);
  assert.equal(r.scores.B, 2);
  assert.equal(r.main, "A");
  assert.equal(r.sub, "B");
});

test("強い刺激感は必ず C を主か補助に含める", () => {
  const r = run({ q2: ["often"], q6: ["rarely"], q4: ["daily"], q5: ["forget"], q3: ["often"] });
  assert.equal(r.strongIrritation, true);
  assert.ok(r.main === "C" || r.sub === "C");
});

test("強い刺激感 + 分からない多数でも C が補助テーマに入る", () => {
  const r = run({ q1: ["unsure"], q2: ["unknown"], q5: ["unsure"], q3: ["often"] });
  assert.equal(r.main, "D");
  assert.equal(r.sub, "C");
});

test("Q8 は深刻度ではなく提案量だけを変える", () => {
  const a = run({ q2: ["often"], q8: ["easy"] });
  const b = run({ q2: ["often"], q8: ["basics"] });
  assert.equal(a.main, b.main);
  assert.deepEqual(a.scores, b.scores);
  assert.equal(a.preference.tipCount, 2);
  assert.equal(b.preference.tipCount, 3);
});
