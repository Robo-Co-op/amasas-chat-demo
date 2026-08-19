// 対話できるAMASAS: Gemini function calling + Supabase読み取り専用RPC (SSEストリーミング)
const SUPABASE_URL = "https://ugddjjnldavwrhfwtxwa.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnZGRqam5sZGF2d3JoZnd0eHdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MzExODMsImV4cCI6MjA5OTAwNzE4M30.6QjQLfc4wmJeP7sh1u6jF4yna6HtdvIWvDhORTtrSGc";

// データ層の切替: amasas(現行・L1.5直接) | ai(共有層L1経由) | l4(ai層+knowledge文脈注入)。A/B比較用
const DATA_LAYER = ["ai", "l4"].includes(process.env.DATA_LAYER) ? process.env.DATA_LAYER : "amasas";
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Preview環境限定: リクエスト単位でモデル・データ層を切替可能(検証用)。本番では常にenv既定が使われる
const IS_PREVIEW = process.env.VERCEL_ENV !== "production";
const ALLOWED_MODELS = ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.1-flash-lite", "gemini-2.5-flash"];
const ALLOWED_LAYERS = ["amasas", "ai", "l4"];

const SYSTEM_PROMPT_TEMPLATE = `あなたは「AMASAS」の対話窓口です。海士町のオープンデータそのものに話しかけるように、誰でも町の現状を数字で確かめられるようにします。相手は町職員・関係人口・島留学生など様々です。

## 役割
質問に対してAMASASの実データを参照し、出典付きで分かりやすく答える。事業立案や政策理解の材料を提供する（判断や提案の主体はあくまで相手）。

## 会話
- 挨拶や雑談には普通に短く応じる（データ照会は不要）
- 曖昧・広い質問（「最近の町の様子は?」等）は、まず select * from amasas.v_town_overview を1回実行して概観を2〜3の要点で紹介し、「人口・ふるさと納税・観光・農業・高齢者福祉・総合戦略などどこを詳しく見ますか?」と関心を聞く
- 直前のやりとりで取得済みのデータで答えられるなら再照会しない
- 回答は簡潔に会話的に。求められたら深く。表が有効なときはMarkdown表

## データ台帳（この一覧から選ぶ）
- 概観: v_town_overview（全分野の最新代表値。広い質問はまずこれ）
- 人口: population_by_age_district（年×月×地区×性別×5歳階級, 2010-2026。集計は v_population_long）
- 人口動態: life_stage_trends（事由別純増減） / migration_schooling・migration_employment・migration_job_change・migration_retirement_family / migration_household_composition
- 出生・結婚: births_by_parity / fertility_parity_ratio / married_couples_by_age
- ふるさと納税: furusato_donations_annual / furusato_donations_monthly / furusato_top5_categories / furusato_top10_items / furusato_top5_categories_monthly / furusato_donations_by_prefecture / furusato_target_achievement / furusato_donations_by_business
- 教育: school_district_child_population / elementary_enrollment_projection（将来推計2026-2032）
- 産業: business_owner_age_distribution / business_owner_age_trend
- 農業: farmland_status_by_district（v_farmland_long） / farmers_age_composition / farmers_age_by_district（v_farmers_age_long） / cultivated_area_by_age_district（v_cultivated_area_long）
- 高齢者: elderly_function_decline / elderly_function_decline_by_category / elderly_function_survey_responses（個票） / elderly_life_survey_responses（個票） / 対応表2種
- 観光: tourist_visitors_by_spot / inbound_visitors_monthly / inbound_country_map
- 地域通貨: haan_pay_usage（ハーンPay 2024-2025）
- 総合戦略: strategy_kpi（判定は v_strategy_kpi_progress）
- 補助: amasas.data_cards（テーブルの注意点。複数は in句でまとめて） / amasas.reference_queries（定型SQL） / amasas.data_dictionary（列の意味）

## スキーマ（全テーブル・ビューの実在列。DBから自動取得。この列名のみ使用し推測で書かない）
{{SCHEMA}}

## SQLエラー時の規律
エラー応答のexisting_columnsに実在列一覧が入っている。それを見て1回で書き直す。同じ推測を繰り返さない

## データの規律（違反禁止）
1. 出典必須: 数値には必ず出典を付す（例:「住民生活課・住民基本台帳によると」）
2. n<10抑制: 10未満の値から傾向や属性を断定しない。個票テーブルは必ず集計して使い、個人を推測しない
3. KPIの未集計扱い: strategy_kpiのactual_valueがNULLは「未集計」。ゼロでも未達でもない（第3期2025-2030は大半が未集計）
4. 住基/国調差: 人口の数値は住民基本台帳ベースであり国勢調査とは一致しない旨を人口関連の回答に付す
5. データにないことは推測で埋めず「AMASASにはこのデータがない」と正直に言い、代わりに何が分かるかを示す
6. ふるさと納税系は金額と件数が混在するため code_name で必ずフィルタ。結果は最大500行に切られるため大きな集計はSQL側でgroup by
7. 回答文にテーブルID（英語名）を一切書かない。括弧での併記も禁止。データセットは正式日本語名だけで呼ぶ。悪い例:「地区別農地の状況（farmland_status_by_district）」→ 良い例:「地区別農地の状況」`;

const SYSTEM_PROMPT_TEMPLATE_AI = `あなたは「AMASAS」の対話窓口です。海士町のオープンデータそのものに話しかけるように、誰でも町の現状を数字で確かめられるようにします。相手は町職員・関係人口・島留学生など様々です。

## 役割
質問に対してAMASASの実データを参照し、出典付きで分かりやすく答える。事業立案や政策理解の材料を提供する（判断や提案の主体はあくまで相手）。

## 会話
- 挨拶や雑談には普通に短く応じる（データ照会は不要）
- 曖昧・広い質問（「最近の町の様子は?」等）は、まず select * from ai.town_overview_latest を1回実行して概観を2〜3の要点で紹介し、関心のある分野を聞き返す
- 直前のやりとりで取得済みのデータで答えられるなら再照会しない
- 回答は簡潔に会話的に。求められたら深く。表が有効なときはMarkdown表

## データの入り口（aiスキーマのみ参照可能）
- ai.catalog — オブジェクト一覧と使い方・注意点（迷ったらまず読む）
- ai.facts — 全時系列データの統一形。列: dataset/metric/year/period_label/month/district/gender/age_group/category/subcategory/item/value/unit/source。当てがなければ select distinct dataset, metric from ai.facts で確認
- ai.population_trend — 人口の年次推移（総人口・高齢化率・若年比率）。推移や高齢化の質問はまずこれ
- ai.town_overview_latest — 町の概観（最新値のみ。推移には使わない）
- ai.kpis — 総合戦略KPI。target_metがnull=「未集計」（ゼロでも未達でもない）
- ai.districts / ai.codebooks / ai.elderly_life_summary（高齢者アンケート集計。10人未満セルは自動非表示）

## データの規律（違反禁止）
1. 出典必須: 数値には必ず出典を付す（facts.source列、各ビューのコメント参照）
2. n<10抑制: 10未満の値から傾向や属性を断定しない
3. KPIの未集計扱い: null実績は必ず「未集計」と表現する（特に第3期2025-2030は大半が未集計）
4. 住基/国調差: 人口の数値は住民基本台帳ベースであり国勢調査とは一致しない旨を人口関連の回答に付す
5. データにないことは推測で埋めず「AMASASにはこのデータがない」と正直に言い、代わりに何が分かるかを示す
6. 結果は最大500行に切られるため大きな集計はSQL側でgroup byする
7. 回答文にSQL・テーブルID・列名・datasetやmetricの英語コードを一切書かない。括弧での併記も禁止。データは正式日本語名だけで呼ぶ。悪い例:「観光入込客数（tourist_arrivals）」「SELECT year, SUM(value)...で集計しました」→ 良い例:「観光入込客数」。SQLはユーザーが明示的に見せてと言った場合のみ示す

## スキーマ（実在列。DBから自動取得。この列名のみ使用し推測で書かない）
{{SCHEMA}}

## SQLエラー時の規律
エラー応答のexisting_columnsに実在列一覧が入っている。それを見て1回で書き直す。同じ推測を繰り返さない`;

// l4層(v4・公式版): ai層プロンプトの末尾に追記するknowledge文脈ブロック（{{KNOWLEDGE}}にknowledge 7テーブルを注入）
const L4_PROMPT_ADDENDUM = `あなたは海士町のデータに詳しい「町の一員」として話します。
回答は【回答の組み立て方】の手順で組み立てます。【町の文脈】は公式計画(第3期海士町創生
総合戦略ほか公式公開文書23件)と公的統計に基づく検証済みの内容です(2026-08-02更新)。

【利用者(前提)】
- 主な利用者は海士町オフィシャルアンバサダーなど、すでに海士町と関わりを持つ関係人口。
  相手は「すでに仲間」という前提で話す。
- 次の一歩の既定の方向は「海士町に来よう・もっと関わろう」(来島・滞在・現地参加・共創・応援)。
  「アンバサダーになろう/登録しよう」を既定のCTAにしない(相手が未登録と分かった場合のみ
  入口として案内する)。

【回答の組み立て方(reading_playbookの使い方)】
- どの質問も次の手順で組み立てる:
  ①patternから質問類型に合う型を選ぶ → ②observationの手順(構成・集中・フロー分解・
  単位切替・正規化・閾値照合・先行指標・最悪事態からの逆算・二段目標の読みなど)で
  データを読む → ③interpretationで町の文脈に置く(物差し宣言・機能再定義・逆算・
  人口方程式・転換係数・縮充・需給ペア・計画間整合・ガードレール) → ④4段構成で返す。
- 4段構成: ①数字(出典付き) → ②町にとっての意味(公式戦略の地図上の位置) →
  ③あなたの関わりしろ(involvement_pathsから具体の制度名) → ④次の一歩。
- 「何ができるか」「提案してほしい」と言われたら辞退しない。
  決めるのは相手だが、選択肢と根拠は全部出す。

【公式フレーム(意味づけの順序)】
- 町の最上位計画は「第3期海士町創生総合戦略 地域経営人口プラン〜みんなでしゃばる
  まちづくり2.0〜」(令和7年4月策定・令和8年3月31日更新)。公式公開文書なので
  文書名を出して語ってよい。個別計画(国土強靱化・エンゼルプラン・景観・森林・農振・
  県産木材・橋梁・下水道・離島広域活性化)も同様に公式。
- 意味づけはまず「未来に残したい島の風景」3要素(伝統文化・祭り/里山里海の原風景/
  子どもからお年寄りまでの笑顔)のどれに関わる話かを判定し、基本目標3本→12戦略の
  どれに当たるかを示す。
- 人口は「地域経営人口」(定住+滞在+関係の3層)で語る。2030年目標は国勢調査ベース
  2,376人[2025年度予測2,337人]で、定義は「住民基本台帳の登録人口+3ヶ月以上滞在して
  いる人口」(公式)。これは公式文書で確認済みなので言い切ってよい(定義を添えること)。
- 人口方程式: 自然減▲30人/年に対し出生+15人/年・社会増+15人/年・滞在人口+30人/5年。
  滞在→定住は「1年間滞在する者の1割が毎年定住」の公式係数で推計する。
- 公式ガードレール: 「守るべきもの(残したい島の風景)が明確であればあるほど、
  新しい技術や人の受け入れが可能になる」。開放の前に保全の明確化。

【広い質問の第一声(最重要)】
- 「最近どう?」「どんな町?」等の広い質問は、概観SQLの数字を並べる前に、町の良い変化の事実から始める:
  ①国調速報2,347人・+80人・島根県内で唯一の増加 ②15〜39歳比率18.3%→23.7%(2010→2023)
  ③国調と住基の差約140人=島留学生など住民票を移さない滞在者の厚み。公式戦略も国調目標の
  定義に滞在人口を含めており、この差は公式の人口観と一致する。
- 住基の概観(総人口・高齢化率)はその後に「実務の物差しでは」と添える。
  高齢化率や人口減を第一声にしない。
- 町の近況を聞かれて総合戦略KPIの進捗を持ち出さない(KPIはKPIを聞かれたときに使う)。

【物差しのルール】
- 人口の第一声は国勢調査(令和7年県速報2,347人・+80人)。ただし国の確定値で変わりうる。
- ai/amasasの人口テーブルは住民基本台帳ベース。必ず「住基台帳ベース」とラベルし、
  国勢調査の数字と混ぜない。
- 2025〜2026年の一部数値は将来推計。必ず「推計」とラベルする。
- 数字の確からしさはmeasuresのverificationで言い分ける:
  verified=一次ソース照合済み / partially_verified=部分照合 / unverified=未照合 /
  internal=町内部データ。断定の強さをこれに合わせる。
- 目標は二段構えに注意: 総枠と年次(例: アンバサダー総枠2,500人と年間登録700人)、
  現状[ ]と2030年目標を混同しない。

【空間の質問(図の参照)】
- 「どこにあるか」「どの地区に多いか」「範囲は?」等の空間質問は、町の文脈の
  map_assets(地図・図面の読み)で答える。数値は実データで裏取りする。
- public_urlがある図は、回答の末尾にMarkdown画像としてそのまま提示する:
  ![図のタイトル](public_url)。画像URLの提示は内部名禁止の対象外。
- 図の読みは目視読み取りの概況であり「正確な区域は原典の図面参照」と添える。

【旧・検討資料の扱い(重要)】
- 旧「産業戦略の検討資料(仮)」由来の枠組み・数値(守る/稼ぐ/残す/生むの4分類、
  就業者421/350/163人、町内総生産の独自区分と108.7億円シナリオ、経営者年齢55.5%、
  宿泊25,000人泊、戦略財源6.0億円、新設合同会社など)は公式版への入れ替えに伴い
  削除済み。これらを記憶や推測で答えない。聞かれたら「現在は公式の第3期総合戦略に
  基づいてお答えしています」と説明する。宿泊目標は公式の2万人泊[1.5万]。
- 耐震改修促進計画は「計画は存在するが、町サイトのリンク切れで原本未入手」と正直に言う。

【ガードレール】
- 既存事業者の仕事を奪う提案はしない。承継・共同・複業の形を優先する。
- 動きのない指標から無理に示唆を捻り出さない。データが語らないときは
  語らないと言う(沈黙は捏造より良い)。
- knowledge層の内容は「町の公式方針・考え方」、ai/amasas層の数字は「観測された事実」。
  回答では両者を言い分ける。
- 回答文には、knowledge層・データ層の英語の内部名(テーブル名・列名・キー・制度コード)や
  SQLを一切出さない。制度やデータは日本語の正式名称だけで呼ぶ。
  例外: map_assetsのpublic_url(画像URL)はMarkdown画像として提示してよい。

【町の文脈】
{{KNOWLEDGE}}`;

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "amasas_query",
        description:
          "海士町AMASASデータベースに読み取り専用SQL(SELECT/WITHのみ・単一文)を実行しJSON配列で結果を得る。複数の照会が必要なら並列に複数回呼んでよい",
        parameters: {
          type: "OBJECT",
          properties: {
            query: { type: "STRING", description: "実行するSQL" },
          },
          required: ["query"],
        },
      },
    ],
  },
];

// 進行表示用: SQLから対象分野を推定
const LABELS = [
  ["town_overview", "町の概観"],
  ["population_trend", "人口推移"],
  ["facts", "統合データ"],
  ["catalog", "データ目録"],
  ["restructuring_kpis", "産業再編KPI"],
  ["kpis", "総合戦略KPI"],
  ["elderly_life_summary", "高齢者アンケート集計"],
  ["v_town_overview", "町の概観"],
  ["population", "人口"],
  ["migration", "人口動態"],
  ["life_stage", "人口動態"],
  ["birth", "出生"],
  ["married", "結婚"],
  ["furusato", "ふるさと納税"],
  ["school", "教育"],
  ["elementary", "教育"],
  ["business_owner", "産業"],
  ["farm", "農業"],
  ["cultivated", "農業"],
  ["elderly", "高齢者福祉"],
  ["tourist", "観光"],
  ["inbound", "観光"],
  ["haan", "地域通貨"],
  ["strategy_kpi", "総合戦略"],
  ["data_cards", "データの注意書き"],
  ["reference_queries", "定型クエリ"],
  ["data_dictionary", "列の定義"],
  ["datasets", "データ台帳"],
];
function labelFor(sql) {
  const s = (sql || "").toLowerCase();
  for (const [k, v] of LABELS) if (s.includes(k)) return v;
  return "データ";
}

// スキーマをDBから取得(1時間キャッシュ)。手書きの列一覧を持たない=実在との乖離が起きない
// メタ情報の取得はai_queryの参照制限を受けないよう常にamasas_query経由
async function metaQuery(query) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/amasas_query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) return { error: await r.text() };
  return await r.json();
}

const schemaCache = { amasas: { text: "", ts: 0 }, ai: { text: "", ts: 0 } };
async function getSchemaText(layer) {
  const cache = schemaCache[layer];
  if (cache.text && Date.now() - cache.ts < 3600 * 1000) return cache.text;
  const sql = layer === "ai"
    ? "select c.table_name, null as name_ja, string_agg(c.column_name, ', ' order by c.ordinal_position) as cols " +
      "from information_schema.columns c where c.table_schema = 'ai' group by c.table_name order by c.table_name"
    : "select c.table_name, d.name_ja, string_agg(c.column_name, ', ' order by c.ordinal_position) as cols " +
      "from information_schema.columns c left join amasas.datasets d on d.table_name = c.table_name " +
      "where c.table_schema = 'amasas' group by c.table_name, d.name_ja order by c.table_name";
  const result = await metaQuery(sql);
  let text = "";
  if (Array.isArray(result) && result.length) {
    text = result
      .map((r) => `- ${r.table_name}${r.name_ja ? `（${r.name_ja}）` : ""}: ${r.cols}`)
      .join("\n");
  }
  // ai層: factsの実在するdataset×metric一覧も注入(値の創作を防ぐ)
  if (text && layer === "ai") {
    const metrics = await metaQuery(
      "select dataset, metric, unit, coalesce(min(year)::text, min(period_label)) as y0, coalesce(max(year)::text, max(period_label)) as y1 " +
      "from ai.facts group by dataset, metric, unit order by dataset, metric"
    );
    if (Array.isArray(metrics) && metrics.length) {
      text += "\n\n## ai.factsに実在するデータ一覧（dataset / metric [単位] 年範囲。この値だけを使い、推測で書かない）\n" +
        metrics.map((m) => `- ${m.dataset} / ${m.metric} [${m.unit}] ${m.y0}${m.y0 !== m.y1 ? "〜" + m.y1 : ""}`).join("\n");
    }
  }
  if (text) { cache.text = text; cache.ts = Date.now(); }
  return cache.text || "（スキーマ取得に失敗。列名は select * from 対象 limit 1 で確認すること）";
}

// l4用: knowledge 7テーブル(公式版102行+地図台帳10行)を一括取得しプロンプト注入用テキストに整形(24hキャッシュ)
// knowledgeスキーマはai_queryの参照制限外のため、メタ情報と同じくamasas_query経由で読む
// 公式版換装(2026-08-02): town_factsは全行fact。map_assets(図の読み+画像URL)を追加注入
const KNOWLEDGE_SQL =
  "select 'measures(物差し・出典台帳)' as block, jsonb_agg(m order by m.priority) as rows from knowledge.measures m " +
  "union all select 'town_facts(公式事実)', jsonb_agg(t order by t.priority) from knowledge.town_facts t " +
  "union all select 'strategy_frames(公式フレーム)', jsonb_agg(f) from knowledge.strategy_frames f " +
  "union all select 'strategy_pillars(公式12戦略)', jsonb_agg(p order by p.pillar_no) from knowledge.strategy_pillars p " +
  "union all select 'involvement_paths(関わりしろ)', jsonb_agg(i) from knowledge.involvement_paths i " +
  "union all select 'map_assets(地図・図面の読みと画像URL)', jsonb_agg(a order by a.asset_key) from knowledge.map_assets a " +
  "union all select 'reading_playbook(回答の組み立ての型)', jsonb_agg(r order by r.priority) from knowledge.reading_playbook r";
const knowledgeCache = { text: "", ts: 0 };
async function getKnowledgeText() {
  if (knowledgeCache.text && Date.now() - knowledgeCache.ts < 24 * 3600 * 1000) return knowledgeCache.text;
  const result = await metaQuery(KNOWLEDGE_SQL);
  if (Array.isArray(result) && result.length) {
    const text = result
      .map((b) => `### ${b.block}\n` + (b.rows || []).map((r) => JSON.stringify(r)).join("\n"))
      .join("\n\n");
    knowledgeCache.text = text;
    knowledgeCache.ts = Date.now();
  }
  return knowledgeCache.text || "（町の文脈の取得に失敗。knowledge層に基づく断定は避け、データの参照窓口として答えること）";
}

async function amasasQuery(query, layer) {
  const rpcName = layer === "amasas" ? "amasas_query" : "ai_query";
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${rpcName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) return { error: await r.text() };
  return await r.json();
}

async function logToDb(path, rows) {
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!key) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "return=representation,resolution=merge-duplicates",
      },
      body: JSON.stringify(rows),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callGeminiOnce(model, sysText, contents, useTools) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const body = {
    system_instruction: { parts: [{ text: sysText }] },
    contents,
  };
  if (useTools) body.tools = TOOLS;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) {
    const e = new Error(data.error?.message || `Gemini error ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return data.candidates?.[0];
}

// 混雑(429/503)は自動リトライ→それでもだめなら代替モデルに切替
async function callGemini(model, sysText, contents, useTools, onStatus) {
  const fallback = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await callGeminiOnce(model, sysText, contents, useTools);
    } catch (e) {
      const transient = e.status === 429 || e.status === 503 || /high demand|overloaded/i.test(String(e.message));
      if (!transient) throw e;
      if (attempt < 2) {
        if (onStatus) onStatus("混み合っています。少し待って再試行中…");
        await sleep(1500 * (attempt + 1));
      }
    }
  }
  if (onStatus) onStatus("混雑のため代替モデルで応答します…");
  return await callGeminiOnce(fallback, sysText, contents, useTools);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if ((req.headers["x-passcode"] || "") !== process.env.APP_PASSCODE)
    return res.status(401).json({ error: "合言葉が違います" });

  const { messages, sessionId, roleTag, nickname, model: reqModel, dataLayer: reqLayer } = req.body || {};
  if (!Array.isArray(messages) || !messages.length || !sessionId)
    return res.status(400).json({ error: "bad request" });

  // Preview環境のみ、ホワイトリスト内の値に限りリクエスト側の指定を採用(検証用)
  const model = IS_PREVIEW && ALLOWED_MODELS.includes(reqModel) ? reqModel : DEFAULT_MODEL;
  const layer = IS_PREVIEW && ALLOWED_LAYERS.includes(reqLayer) ? reqLayer : DATA_LAYER;

  // SSE開始
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  const onStatus = (text) => send({ type: "status", text });
  // l4はai層のスキーマ・SQL面を共用し、knowledge文脈をプロンプト末尾に加算する
  let sysText = (layer === "amasas" ? SYSTEM_PROMPT_TEMPLATE : SYSTEM_PROMPT_TEMPLATE_AI)
    .replace("{{SCHEMA}}", await getSchemaText(layer === "l4" ? "ai" : layer));
  if (layer === "l4")
    sysText += "\n\n" + L4_PROMPT_ADDENDUM.replace("{{KNOWLEDGE}}", await getKnowledgeText());

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const sqlLog = [];
  let answer = null;

  try {
    for (let round = 0; round < 10; round++) {
      const cand = await callGemini(model, sysText, contents, true, onStatus);
      const parts = cand?.content?.parts || [];
      const calls = parts.filter((p) => p.functionCall);

      if (calls.length) {
        contents.push(cand.content);
        send({
          type: "status",
          text:
            [...new Set(calls.map((c) => labelFor(c.functionCall.args?.query)))].join("・") +
            "のデータを確認しています…",
        });
        // 全ツール呼び出しを並列実行(取りこぼしなし)
        const results = await Promise.all(
          calls.map(async (c) => {
            const q = c.functionCall.args?.query || "";
            const result = await amasasQuery(q, layer);
            sqlLog.push({
              query: q,
              rows: Array.isArray(result) ? result.length : null,
              error: result?.error || null,
            });
            return { name: c.functionCall.name, result };
          })
        );
        contents.push({
          role: "user",
          parts: results.map((r) => ({
            functionResponse: { name: r.name, response: { result: r.result } },
          })),
        });
        continue;
      }
      answer = parts.map((p) => p.text || "").join("");
      break;
    }

    // 上限到達時: エラーにせず、ここまでの結果で誠実に部分回答を合成
    if (answer == null) {
      contents.push({
        role: "user",
        parts: [
          {
            text: "（システム: 照会回数の上限に達しました。ここまでに取得できたデータだけで誠実に答え、確認しきれなかった点は正直にその旨を明示してください。追加で調べられる方向も1つ提案してください）",
          },
        ],
      });
      send({ type: "status", text: "ここまでの結果をまとめています…" });
      const cand = await callGemini(model, sysText, contents, false, onStatus);
      answer =
        (cand?.content?.parts || []).map((p) => p.text || "").join("") ||
        "すみません、うまく処理できませんでした。質問を少し変えてもう一度お試しください。";
    }
  } catch (e) {
    const friendly = /high demand|overloaded|429|503/i.test(String(e.message))
      ? "ただいまAIが混み合っています。1分ほど待ってからもう一度お試しください。"
      : "処理中にエラーが発生しました。もう一度お試しください。（詳細: " + String(e.message || e) + "）";
    send({ type: "error", text: friendly });
    return res.end();
  }

  // ログ記録(失敗しても回答は返す)
  let messageId = null;
  await logToDb("amasas_chat_sessions?on_conflict=id", [
    { id: sessionId, role_tag: roleTag || null, nickname: nickname || null },
  ]);
  const turn = messages.length;
  await logToDb("amasas_chat_messages", [
    {
      session_id: sessionId,
      turn: turn - 1,
      role: "user",
      content: messages[messages.length - 1].content,
      data_layer: layer,
      model,
    },
  ]);
  const saved = await logToDb("amasas_chat_messages", [
    { session_id: sessionId, turn, role: "assistant", content: answer, sql_log: sqlLog, data_layer: layer, model },
  ]);
  if (saved && saved[0]) messageId = saved[0].id;

  send({ type: "done", answer, messageId, sqlCount: sqlLog.length, model, dataLayer: layer });
  res.end();
}
