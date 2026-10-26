// 回答から優先テーマを決める（画面に依存しない純粋な関数。tests/ でテストする）
const THEMES = ["A", "B", "C"];

/**
 * @param {Record<string, string[]>} answers 例: { q1: ["dull"], q2: ["often"], ... }
 * @param {typeof import("./rules.js").RULES} rules
 */
export function classify(answers, rules) {
  const scores = { A: 0, B: 0, C: 0 };
  let unknown = 0;
  const contributions = { A: [], B: [], C: [] };
  const unknownAnswers = [];

  for (const [qid, selected] of Object.entries(answers)) {
    for (const opt of selected || []) {
      const s = rules.scores[qid]?.[opt] || {};
      for (const t of THEMES) {
        if (s[t]) {
          scores[t] += s[t];
          contributions[t].push({ question: qid, option: opt, points: s[t] });
        }
      }
      if (s.unknown) {
        unknown += s.unknown;
        unknownAnswers.push({ question: qid, option: opt });
      }
    }
  }

  const rank = (t) => rules.tieOrder.indexOf(t);
  const qualified = THEMES.filter((t) => scores[t] >= rules.threshold).sort(
    (a, b) => scores[b] - scores[a] || rank(a) - rank(b),
  );

  const strongIrritation = rules.strongIrritation.some((r) =>
    (answers[r.question] || []).includes(r.option),
  );
  const manyUnknown = unknown >= rules.unknownThreshold;

  let main;
  let sub;
  if (manyUnknown) {
    main = "D";
    sub = qualified[0] || null;
  } else if (qualified.length === 0) {
    main = "D";
    sub = null;
  } else {
    main = qualified[0];
    sub = qualified[1] || null;
  }

  // 強い刺激感があれば、刺激への配慮を必ず主テーマか補助テーマに含める
  if (strongIrritation && main !== "C" && sub !== "C") sub = "C";

  const q8 = (answers.q8 || [])[0];
  const preference = rules.preferences[q8] || rules.defaultPreference;

  return { main, sub, scores, unknown, manyUnknown, strongIrritation, contributions, unknownAnswers, preference };
}
