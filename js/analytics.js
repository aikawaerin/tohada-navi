// 計測イベント。回答・肌悩み・個人情報は送らず、イベント名と質問番号だけを扱う。
// 相談申込みの完了・LINE 登録の完了は、遷移先（フォームの完了ページ等）で別途計測する。
export const EVENTS = [
  "check_start",
  "question_answered",
  "check_complete",
  "result_view",
  "consultation_click",
  "line_click",
];

const ALLOWED_PARAMS = ["question_number"];

export function track(name, params = {}) {
  if (!EVENTS.includes(name)) return;
  const safe = {};
  for (const k of ALLOWED_PARAMS) if (k in params) safe[k] = params[k];
  const payload = { event: name, ...safe };

  // テスト・確認用（このページの中だけに残る）
  (window.__tohadaEvents ||= []).push(payload);

  if (window.SITE_CONFIG?.analytics?.enabled) {
    (window.dataLayer ||= []).push(payload);
  }
}
