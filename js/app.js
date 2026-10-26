// 画面の切り替え（トップ / 質問 / 結果）と描画。回答はこのページのメモリ内だけで保持する。
import { QUESTIONS } from "./questions.js";
import { RULES } from "./rules.js";
import { classify } from "./scoring.js";
import { THEMES, RESULT_TEXT } from "./results.js";
import { track } from "./analytics.js";

const config = window.SITE_CONFIG;
const total = QUESTIONS.length;
/** @type {Record<string, string[]>} */
const answers = {};
let started = false;
let completed = false;

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null) node.append(c);
  return node;
};

const views = {
  top: $('[data-view="top"]'),
  quiz: $('[data-view="quiz"]'),
  result: $('[data-view="result"]'),
};
const baseTitle = document.title;
const robots = $('meta[name="robots"]');

/* ---------- 共通の表示設定 ---------- */
function applyConfig() {
  document.querySelectorAll("[data-brand]").forEach((n) => (n.textContent = config.brand.name));

  const time = $("[data-time-estimate]");
  if (config.timeEstimate) {
    time.textContent = `目安 ${config.timeEstimate}`;
    time.hidden = false;
  }

  const ul = $("[data-footer-links]");
  [
    ["運営者情報", config.operator && config.operator.url],
    ["プライバシーポリシー", config.privacyPolicyUrl],
    ["お問い合わせ", config.contactUrl],
  ].forEach(([label, url]) => {
    ul.append(el("li", {}, url ? el("a", { href: url, text: label }) : `${label}（準備中）`));
  });

  if (config.adDisclosure) {
    const ad = $("[data-ad-disclosure]");
    ad.textContent = config.adDisclosure;
    ad.hidden = false;
  }
}

/* ---------- ルーティング ---------- */
function firstUnanswered() {
  const i = QUESTIONS.findIndex((q) => !(answers[q.id] && answers[q.id].length));
  return i === -1 ? null : i + 1;
}

function route() {
  const hash = location.hash;
  const m = hash.match(/^#\/check\/(\d+)$/);
  if (m) {
    const n = Math.min(Math.max(parseInt(m[1], 10), 1), total);
    // 前の質問が未回答なら、そこまで戻す
    const gap = firstUnanswered();
    if (gap && gap < n) return go(`#/check/${gap}`, true);
    return showQuiz(n);
  }
  if (hash === "#/result") {
    const gap = firstUnanswered();
    if (gap) return go(`#/check/${gap}`, true);
    return showResult();
  }
  showTop(hash);
}

function go(hash, replace = false) {
  if (replace) history.replaceState(null, "", hash);
  else location.hash = hash;
  if (replace) route();
}

function setView(name, title) {
  for (const [k, v] of Object.entries(views)) v.hidden = k !== name;
  document.body.dataset.view = name;
  document.title = title ? `${title}｜${config.brand.name}` : baseTitle.replace("透肌ナビ", config.brand.name);
  // 個別の結果画面は検索エンジンに載せない
  robots.setAttribute("content", name === "result" ? "noindex,nofollow" : "index,follow");
}

function showTop(hash) {
  setView("top");
  if (hash && hash.length > 1 && !hash.startsWith("#/")) {
    const target = document.getElementById(hash.slice(1));
    if (target) requestAnimationFrame(() => target.scrollIntoView());
  } else {
    window.scrollTo(0, 0);
  }
}

/* ---------- 質問画面 ---------- */
function showQuiz(n) {
  const q = QUESTIONS[n - 1];
  setView("quiz", `質問 ${n} / ${total}`);
  if (!started) {
    started = true;
    track("check_start");
  }

  const root = views.quiz;
  root.replaceChildren();
  const selected = new Set(answers[q.id] || []);
  const inputType = q.type === "multi" ? "checkbox" : "radio";
  const errorId = `err-${q.id}`;
  const noteId = `note-${q.id}`;

  const status = el("p", { class: "option-status", "aria-live": "polite" });
  const error = el("p", { class: "form-error", id: errorId, role: "alert" });

  const optionNodes = q.options.map((o) => {
    const input = el("input", {
      type: inputType,
      name: q.id,
      value: o.id,
      checked: selected.has(o.id),
    });
    input.addEventListener("change", () => onChange(q, input, form, status, error));
    return el(
      "label",
      { class: "option" },
      input,
      el("span", { class: "option-mark", "aria-hidden": "true" }),
      el("span", { class: "option-text", text: o.label }),
    );
  });

  const form = el(
    "form",
    { class: "quiz-form", novalidate: true },
    el(
      "fieldset",
      { "aria-describedby": q.note ? `${noteId} ${errorId}` : errorId },
      el(
        "legend",
        { class: "q-title" },
        el("span", { class: "q-num", text: `Q${n}.` }),
        el("span", { text: q.title }),
      ),
      q.note ? el("p", { class: "q-note", id: noteId, text: q.note }) : null,
      el("div", { class: "options" }, optionNodes),
    ),
    status,
    error,
    el(
      "div",
      { class: "quiz-nav" },
      el("button", {
        type: "button",
        class: "btn btn-ghost",
        text: n === 1 ? "トップに戻る" : "前の質問に戻る",
        onclick: () => go(n === 1 ? "#" : `#/check/${n - 1}`),
      }),
      el("button", { type: "submit", class: "btn btn-primary", text: n === total ? "結果を見る" : "次へ" }),
    ),
  );

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const values = [...form.querySelectorAll("input:checked")].map((i) => i.value);
    if (!values.length) {
      error.textContent =
        q.type === "multi" ? "当てはまるものを1つ以上選んでください。" : "当てはまるものを1つ選んでください。";
      form.querySelector("input:not(:disabled)").focus();
      return;
    }
    answers[q.id] = values;
    track("question_answered", { question_number: n });
    if (n === total) {
      if (!completed) {
        completed = true;
        track("check_complete");
      }
      go("#/result");
    } else {
      go(`#/check/${n + 1}`);
    }
  });

  const progress = el(
    "div",
    { class: "progress" },
    el("p", { class: "progress-label" }, el("span", { class: "visually-hidden", text: "進行状況 " }), `${n} / ${total}`),
    el(
      "div",
      {
        class: "progress-bar",
        role: "progressbar",
        "aria-label": "セルフチェックの進行状況",
        "aria-valuemin": "1",
        "aria-valuemax": String(total),
        "aria-valuenow": String(n),
        "aria-valuetext": `${total}問中${n}問目`,
      },
      el("span", { style: `width:${(n / total) * 100}%` }),
    ),
  );

  root.append(el("div", { class: "container narrow quiz" }, progress, form));
  syncLimits(q, form, status);
  window.scrollTo(0, 0);
  $("legend", form).setAttribute("tabindex", "-1");
  $("legend", form).focus({ preventScroll: true });
}

function onChange(q, input, form, status, error) {
  error.textContent = "";
  if (q.type !== "multi") return;
  if (q.exclusive) {
    const inputs = [...form.querySelectorAll("input")];
    if (input.checked && input.value === q.exclusive) {
      const cleared = inputs.filter((i) => i !== input && i.checked);
      cleared.forEach((i) => (i.checked = false));
      if (cleared.length) status.textContent = "「特に当てはまらない」を選んだため、他の選択を外しました。";
    } else if (input.checked) {
      const ex = inputs.find((i) => i.value === q.exclusive);
      if (ex.checked) {
        ex.checked = false;
        status.textContent = "「特に当てはまらない」の選択を外しました。";
      }
    }
  }
  syncLimits(q, form, status);
}

function syncLimits(q, form, status) {
  if (!q.max) return;
  const inputs = [...form.querySelectorAll("input")];
  const count = inputs.filter((i) => i.checked).length;
  const full = count >= q.max;
  inputs.forEach((i) => {
    i.disabled = full && !i.checked;
    i.closest(".option").classList.toggle("is-disabled", i.disabled);
  });
  status.textContent = full ? `${q.max}つ選択済みです。変更する場合は、選んだ項目を外してください。` : "";
}

/* ---------- 結果画面 ---------- */
function labelOf(qid, optId) {
  const q = QUESTIONS.find((x) => x.id === qid);
  return { question: q.quoteLabel, answer: q.options.find((o) => o.id === optId).label };
}

function pickReasons(r) {
  const picked = [];
  const used = new Set();
  const add = (list) => {
    for (const c of [...list].sort((a, b) => (b.points || 0) - (a.points || 0))) {
      if (picked.length >= 3 || used.has(c.question)) continue;
      used.add(c.question);
      picked.push(c);
    }
  };
  if (r.main === "D") {
    if (r.manyUnknown) add(r.unknownAnswers);
    else add(["q6", "q5"].map((q) => ({ question: q, option: answers[q][0] })));
  } else {
    add(r.contributions[r.main]);
  }
  if (r.sub && picked.length < 3) add(r.contributions[r.sub] || []);
  return picked.slice(0, 3);
}

function pickTips(r) {
  const count = r.preference.tipCount;
  const tips = THEMES[r.main].tips.slice(0, count);
  if (r.sub && r.sub !== "D") tips[count - 1] = THEMES[r.sub].tips[0];
  if ((r.strongIrritation || r.preference.gentleFocus) && r.main !== "C" && !tips.some((t) => THEMES.C.tips.includes(t))) {
    tips[count - 1] = THEMES.C.tips[0];
  }
  return tips.map((t) => (r.strongIrritation && t.addsNewItem ? t.alt : t));
}

function ctaSection(r) {
  const c = config.consultation;
  const l = config.line;
  const children = [el("h2", { class: "result-h2", text: "結果をもとに、次の一歩を選べます" })];
  if (r.preference.consultFirst) children.push(el("p", { class: "muted", text: RESULT_TEXT.preferenceNotes.consult }));

  const actions = el("div", { class: "cta-actions" });
  if (c.url) {
    actions.append(
      el("a", {
        class: "btn btn-primary btn-lg",
        href: c.url,
        rel: "noopener",
        text: "結果をもとにケアを相談する",
        onclick: () => track("consultation_click"),
      }),
    );
  }
  if (l.url) {
    actions.append(
      el("a", {
        class: "btn btn-line",
        href: l.url,
        rel: "noopener",
        text: "LINEで相談の案内を受け取る",
        onclick: () => track("line_click"),
      }),
    );
  }
  actions.append(
    el("a", { class: "btn btn-ghost", href: "#tips", text: "自分でケアを見直す", onclick: scrollToTips }),
  );

  if (c.url || l.url) {
    const benefits = [...(c.url ? c.benefits : []), ...(l.url ? l.benefits : [])];
    if (benefits.length) {
      children.push(el("p", { class: "muted", text: "相談・登録で受け取れるもの" }), el("ul", { class: "benefits" }, benefits.map((b) => el("li", { text: b }))));
    }
    if (c.priceNote) children.push(el("p", { class: "muted", text: c.priceNote }));
  } else {
    children.push(el("p", { class: "notice", text: "相談窓口・LINEでのご案内は、現在準備中です。" }));
    if (config.showSetupNotices) {
      children.push(
        el("p", {
          class: "setup-note",
          text: "【制作メモ】公開前に js/config.js の consultation.url / line.url と、受け取れる内容（benefits）を設定してください。",
        }),
      );
    }
  }
  children.push(actions);
  return fixLabel(el("section", { class: "result-block cta-block" }, children), "cta-title");
}

function fixLabel(section, id) {
  const h = section.querySelector("h2");
  h.id = id;
  section.setAttribute("aria-labelledby", id);
  return section;
}

function scrollToTips(e) {
  e.preventDefault();
  const t = document.getElementById("tips");
  t.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  t.focus({ preventScroll: true });
}

function showResult() {
  const r = classify(answers, RULES);
  const main = THEMES[r.main];
  setView("result", "セルフチェックの結果");
  track("result_view");

  const themeCard = (key, label) =>
    el(
      "div",
      { class: "theme-card" },
      el("p", { class: "theme-label", text: label }),
      el("p", { class: "theme-name", text: THEMES[key].name }),
      el("p", { class: "theme-summary", text: THEMES[key].summary }),
    );

  const reasons = pickReasons(r);
  const reasonText =
    r.main === "D" ? (r.manyUnknown ? THEMES.D.reasonManyUnknown : THEMES.D.reason) : main.reason;
  const subReason = r.sub && r.main !== "D" ? THEMES[r.sub].reason.replace("優先テーマにしました", "あわせて意識したいテーマにしました") : null;

  const tips = pickTips(r);
  const q8 = (answers.q8 || [])[0];

  const tipsBlock = fixLabel(
    el(
      "section",
      { class: "result-block", id: "tips", tabindex: "-1" },
      el("h2", { class: "result-h2", text: "今日から意識したいこと" }),
      r.strongIrritation ? el("p", { class: "notice", text: RESULT_TEXT.strongIrritationNote }) : null,
      el(
        "ol",
        { class: "tips" },
        tips.map((t) => el("li", {}, el("p", { class: "tip-title", text: t.title }), el("p", { class: "tip-detail", text: t.detail }))),
      ),
      q8 && RESULT_TEXT.preferenceNotes[q8] && q8 !== "consult" ? el("p", { class: "muted", text: RESULT_TEXT.preferenceNotes[q8] }) : null,
      el("p", { class: "medical-note", role: "note", text: RESULT_TEXT.medicalNote }),
    ),
    "tips-title",
  );

  const memoBlock = fixLabel(
    el(
      "section",
      { class: "result-block memo" },
      el("h2", { class: "result-h2", text: "1週間のケア振り返りメモ" }),
      el("p", { class: "muted", text: RESULT_TEXT.memoNote }),
      el(
        "div",
        { class: "table-wrap" },
        el(
          "table",
          { class: "memo-table" },
          el("thead", {}, el("tr", {}, el("th", { scope: "col", text: "日" }), RESULT_TEXT.memoColumns.map((c) => el("th", { scope: "col", text: c })))),
          el(
            "tbody",
            {},
            Array.from({ length: 7 }, (_, i) =>
              el("tr", {}, el("th", { scope: "row", text: `${i + 1}日目` }), RESULT_TEXT.memoColumns.map(() => el("td", {}))),
            ),
          ),
        ),
      ),
    ),
    "memo-title",
  );

  const cta = ctaSection(r);

  const actions = el(
    "section",
    { class: "result-block result-actions", "aria-label": "結果の保存・やり直し" },
    el("button", { type: "button", class: "btn btn-ghost", text: "印刷する", onclick: () => window.print() }),
    el("button", { type: "button", class: "btn btn-ghost", text: "回答を見直す", onclick: () => go("#/check/1") }),
    el("button", { type: "button", class: "btn btn-ghost", text: "最初からやり直す", onclick: restart }),
    el("button", { type: "button", class: "btn btn-ghost", text: "このサイトを紹介する", onclick: share }),
    el("p", { class: "muted small", text: "紹介ではサイトのURLだけを共有し、回答や結果は共有されません。" }),
  );

  const content = el(
    "div",
    { class: "container narrow result" },
    el(
      "header",
      { class: "result-head" },
      el("p", { class: "eyebrow", text: "セルフチェックの結果" }),
      el("h1", { id: "result-title", tabindex: "-1", text: main.heading }),
      el("p", { class: "muted", text: RESULT_TEXT.lead }),
    ),
    el(
      "section",
      { class: "result-block", "aria-label": "あなたの優先テーマ" },
      el("div", { class: `theme-cards${r.sub ? " has-sub" : ""}` }, themeCard(r.main, RESULT_TEXT.mainLabel), r.sub ? themeCard(r.sub, RESULT_TEXT.subLabel) : null),
    ),
    fixLabel(
      el(
        "section",
        { class: "result-block" },
        el("h2", { class: "result-h2", text: "この結果になった理由" }),
        el("p", { text: "あなたが選んだ回答" }),
        el(
          "ul",
          { class: "quotes" },
          reasons.map((c) => {
            const { question, answer } = labelOf(c.question, c.option);
            return el("li", {}, el("span", { class: "quote-q", text: question }), el("span", { class: "quote-a", text: `「${answer}」` }));
          }),
        ),
        el("p", { text: reasonText }),
        subReason ? el("p", { text: subReason }) : null,
      ),
      "reason-title",
    ),
    r.preference.consultFirst ? cta : null,
    tipsBlock,
    memoBlock,
    r.preference.consultFirst ? null : cta,
    actions,
    el("p", { class: "disclaimer", text: RESULT_TEXT.disclaimer }),
  );

  views.result.replaceChildren(content);
  window.scrollTo(0, 0);
  $("#result-title").focus({ preventScroll: true });
}

function restart() {
  for (const k of Object.keys(answers)) delete answers[k];
  started = false;
  completed = false;
  go("#/check/1");
}

async function share() {
  const url = location.origin + location.pathname;
  const data = { title: config.brand.name, text: RESULT_TEXT.shareText, url };
  try {
    if (navigator.share) return await navigator.share(data);
    await navigator.clipboard.writeText(url);
    toast("サイトのURLをコピーしました。");
  } catch {
    /* 共有をキャンセルした場合は何もしない */
  }
}

let toastTimer;
function toast(msg) {
  const t = $("[data-toast]");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3000);
}

/* ---------- 追従CTA（トップページのみ） ---------- */
function setupSticky() {
  const sticky = $("[data-sticky-cta]");
  const visible = new Set();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
    sticky.classList.toggle("is-shown", visible.size === 0);
  });
  [$(".hero"), $(".final-cta")].forEach((t) => io.observe(t));
}

applyConfig();
setupSticky();
window.addEventListener("hashchange", route);
route();
