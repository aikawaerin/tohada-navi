// サイト全体の設定。ブランド名・外部リンク・運営者情報はここだけを書き換える。
// 未確定の項目は null / 空文字のままにする（架空の値で埋めない）。
window.SITE_CONFIG = {
  brand: {
    name: "透肌ナビ",
    tagline: "肌悩みをひも解いて、自分に合うケアの始め方を見つける。",
  },
  // 実測した所要時間（例: "約2分"）。未計測の間は null にして表示しない
  timeEstimate: null,

  // 相談・LINE。url が空の間はボタンを出さず「準備中」と表示する
  consultation: {
    url: "",
    // 相談すると受け取れるもの（確定した内容だけを書く）
    benefits: [],
    // 料金表示（無料・有料が確定した場合のみ。例: "相談は無料です"）
    priceNote: null,
  },
  line: {
    url: "",
    benefits: [],
  },

  operator: null, // 運営者情報 { name: "...", url: "..." }（未設定）
  privacyPolicyUrl: "", // プライバシーポリシー（未設定）
  contactUrl: "", // お問い合わせ（未設定）
  adDisclosure: null, // 広告・アフィリエイトを含む場合の表示文（未設定なら非表示）

  // 計測: enabled のとき window.dataLayer にイベント名だけを送る（回答内容は送らない）
  analytics: { enabled: false },

  // 制作中だけ true。未設定項目の注意書き（制作メモ）を画面に出す
  showSetupNotices: true,
};
