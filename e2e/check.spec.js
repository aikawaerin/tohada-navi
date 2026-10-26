import { expect, test } from "@playwright/test";

// 各質問で選ぶ選択肢のラベル（配列は複数選択）
const PATTERNS = {
  moisture: ["乾燥によるくすみ印象", "よく感じる", "ほとんどない", "あまりない", "状況に合わせて行っている", "あまり行っていない", "特に当てはまらない", "基本から見直したい"],
  strongIrritation: [["日焼けによる肌印象の変化"], "ほとんど感じない", "よくある", "ほぼ毎日ある", "忘れることが多い", "毎日、朝と夜", ["新しいアイテムを一度に複数取り入れた"], "手軽に続けたい"],
  manyUnknown: ["どのケアを優先するか分からない", "分からない", "分からない", "あまりない", "状況に合わせて行っている", "毎日、朝と夜", "特に当てはまらない", "相談して選びたい"],
};

async function answer(page, choice) {
  for (const label of [].concat(choice)) {
    await page.getByLabel(label, { exact: true }).click();
  }
  await page.getByRole("button", { name: /^(次へ|結果を見る)$/ }).click();
}

async function runAll(page, pattern) {
  await page.goto("/");
  await page.getByRole("link", { name: "無料で肌悩みをチェックする" }).click();
  for (const choice of pattern) await answer(page, choice);
}

test("8問に答えて結果まで到達し、回答が理由に引用される", async ({ page }) => {
  await runAll(page, PATTERNS.moisture);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("まずは、うるおいを守るケアから。");
  await expect(page.locator(".quotes")).toContainText("よく感じる");
  await expect(page.locator(".tips li")).toHaveCount(3);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,nofollow");
});

test("戻って回答を変えると結果に反映される", async ({ page }) => {
  await runAll(page, PATTERNS.moisture);
  await page.getByRole("button", { name: "回答を見直す" }).click();
  await expect(page.getByLabel("乾燥によるくすみ印象", { exact: true })).toBeChecked();
  // Q1〜Q3 はそのまま、Q4・Q5 を紫外線寄りに、Q6 を毎日朝夜に変更
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "次へ" }).click();
  await answer(page, "ほぼ毎日ある");
  await answer(page, "忘れることが多い");
  await answer(page, "毎日、朝と夜");
  await page.getByRole("button", { name: "次へ" }).click();
  await page.getByRole("button", { name: "結果を見る" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("まずは、紫外線対策を見直すところから。");
});

test("強い刺激感では新しいアイテムを勧めず、医療機関の案内が出る", async ({ page }) => {
  await runAll(page, PATTERNS.strongIrritation);
  await expect(page.locator(".theme-name")).toContainText(["刺激に配慮したケアの整理"]);
  await expect(page.getByText("新しいアイテムを増やす提案はしていません")).toBeVisible();
  await expect(page.getByText("外出の予定に合わせて日焼け止めを使う")).toHaveCount(0);
  await expect(page.locator(".tips li")).toHaveCount(2); // 手軽に続けたい → 2つ
  await expect(page.locator(".medical-note")).toBeVisible();
});

test("分からないが多い場合は D になり、相談の案内が先に出る", async ({ page }) => {
  await runAll(page, PATTERNS.manyUnknown);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("まずは、今のケアを整えて続けるところから。");
  await expect(page.getByText("「分からない」という回答が多かった")).toBeVisible();
  const order = await page.locator(".result > section h2").allTextContents();
  expect(order.indexOf("結果をもとに、次の一歩を選べます")).toBeLessThan(order.indexOf("今日から意識したいこと"));
});

test("相談先が未設定なら、相談・LINEのリンクを出さない", async ({ page }) => {
  await runAll(page, PATTERNS.moisture);
  await expect(page.getByRole("link", { name: "結果をもとにケアを相談する" })).toHaveCount(0);
  await expect(page.getByText("現在準備中です")).toBeVisible();
});

test("未回答で次へ進もうとすると案内が出る / Q1 は最大2つ / Q7 は排他", async ({ page }) => {
  await page.goto("/#/check/1");
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(page.getByRole("alert")).toHaveText("当てはまるものを1つ以上選んでください。");
  await page.getByLabel("日焼けによる肌印象の変化", { exact: true }).click();
  await page.getByLabel("乾燥によるくすみ印象", { exact: true }).click();
  await expect(page.getByLabel("ケア中の刺激感")).toBeDisabled();
  await page.getByRole("button", { name: "次へ" }).click();
  for (const c of ["よく感じる", "よくある", "ほぼ毎日ある", "忘れることが多い", "毎日、朝と夜"]) await answer(page, c);
  await page.getByLabel("スクラブや角質ケアを頻繁に行っている", { exact: true }).click();
  await page.getByLabel("特に当てはまらない", { exact: true }).click();
  await expect(page.getByLabel("スクラブや角質ケアを頻繁に行っている")).not.toBeChecked();
  await expect(page.getByLabel("特に当てはまらない")).toBeChecked();
});

test("質問を飛ばして結果URLを開くと未回答の質問に戻る", async ({ page }) => {
  await page.goto("/#/result");
  await expect(page).toHaveURL(/#\/check\/1$/);
});

test("計測イベントに回答内容を含めない", async ({ page }) => {
  await runAll(page, PATTERNS.moisture);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("まずは、うるおいを守るケアから。");
  const events = await page.evaluate(() => window.__tohadaEvents);
  const names = events.map((e) => e.event);
  for (const n of ["check_start", "question_answered", "check_complete", "result_view"]) expect(names).toContain(n);
  for (const e of events) expect(Object.keys(e).every((k) => ["event", "question_number"].includes(k))).toBe(true);
});

test("画面幅に収まり、質問画面ではトップ用の追従CTAが出ない", async ({ page }) => {
  await runAll(page, PATTERNS.moisture);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.goto("/#/check/1");
  await expect(page.locator("[data-sticky-cta]")).toBeHidden();
});
