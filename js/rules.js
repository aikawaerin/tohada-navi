// 分類ルール。回答（questions.js）と分けて管理し、配点やしきい値はここで調整する。
// A: 保湿ケアを見直す / B: 紫外線対策を見直す / C: 刺激に配慮してケアを整理する / D: 今のケアを整えて続ける
export const RULES = {
  // この点数以上のテーマを「優先テーマの候補」とする
  threshold: 2,
  // 「分からない」系の回答がこの数以上なら D を主テーマにする
  unknownThreshold: 3,
  // 同点のときの優先順（刺激への配慮 → 保湿 → 紫外線）
  tieOrder: ["C", "A", "B"],

  // 選択肢ごとの配点。unknown は「分からない」系の回答数
  scores: {
    q1: { sun: { B: 1 }, dull: { A: 1 }, texture: { A: 1 }, irritation: { C: 1 }, unsure: { unknown: 1 } },
    q2: { often: { A: 2 }, sometimes: { A: 1 }, rarely: {}, unknown: { unknown: 1 } },
    q3: { often: { C: 3 }, sometimes: { C: 1 }, rarely: {}, unknown: { unknown: 1 } },
    q4: { daily: { B: 2 }, weekly: { B: 1 }, rarely: {}, varies: { B: 1 } },
    q5: { situational: {}, outing: { B: 1 }, forget: { B: 2 }, unsure: { B: 2, unknown: 1 } },
    q6: { both: {}, once: { A: 1 }, whenDry: { A: 1 }, rarely: { A: 2 } },
    q7: { newItems: { C: 2 }, scrub: { C: 2 }, gentle: {}, simple: {}, none: {} },
    q8: {},
  },

  // 強い刺激感とみなす回答。該当時は新しいアイテムを増やす提案をしない
  strongIrritation: [{ question: "q3", option: "often" }],

  // Q8 は深刻度ではなく、提案の量と相談導線の調整にだけ使う
  preferences: {
    easy: { tipCount: 2, consultFirst: false, gentleFocus: false },
    gentle: { tipCount: 3, consultFirst: false, gentleFocus: true },
    basics: { tipCount: 3, consultFirst: false, gentleFocus: false },
    consult: { tipCount: 2, consultFirst: true, gentleFocus: false },
  },
  defaultPreference: { tipCount: 3, consultFirst: false, gentleFocus: false },
};
