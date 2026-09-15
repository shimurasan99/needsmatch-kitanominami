# ニーズマッチ 北のみなみ支部 Webアプリ

Next.js / React / Supabase / Vercel による、会員紹介・会員管理・月例会・出欠回答・テーブル割りのアプリです。

## ローカル起動

Node.js 20以上を使用します。依存関係は `package-lock.json` に固定されています。

```bash
npm ci
npm run dev
```

[ローカルサイト](http://localhost:3000) を開きます。共有データの読み書きには、下記の環境設定またはテスト用サーバーが必要です。

## 環境変数とSupabase

`.env.local` に設定し、Vercelでは対象の環境（Production / Preview）にも同じ項目を登録します。実際の秘密鍵やパスワードをリポジトリへ保存しないでください。

| 変数 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseプロジェクトURL。共有データAPIに必須 |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバー専用の保存用キー。ブラウザへ渡さない |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | クライアント用Supabase設定。管理APIの保存権限には使用しない |
| `NEXT_PUBLIC_SITE_URL` | サイトURL。ローカル例：`http://localhost:3000` |
| `MEMBER_PAGE_PASSWORD` | 会員共通パスワード。旧設定 `MEMBER_SHARED_PASSWORD` より優先 |
| `ADMIN_SHARED_PASSWORD` | 運営共通パスワード。運営者全員が同じ管理機能を使用可能 |
| `AUTH_SESSION_SECRET` | 署名付きセッション用の長いランダム文字列。未設定時はサーバー内で `SUPABASE_SERVICE_ROLE_KEY` を使用 |

本番では会員・運営パスワードを明示的に設定してください。`.env.example` とコードにある初期値をそのまま運用しないでください。

`supabase/migrations` のSQLを番号順に適用します。既存環境には未適用のものだけを適用してください。

- `001_initial_schema.sql`：初期スキーマ
- `002_attendance_responses.sql`：共有出欠・ゲスト情報
- `003_managed_meetings.sql`：実際に使用する月例会データ
- `004_shared_site_state.sql`：会員編集・商談・写真・掲示板・テーブル割りの共有保存

`supabase/seed.sql` は旧スキーマ向けのサンプルデータです。既存会員を削除するSQLを含むため、本番データがある環境では実行しないでください。現在の画面は旧 `members` / `meetings` テーブルをそのまま表示する構成ではありません。

## 現在の保存先

| 情報 | 保存先 |
| --- | --- |
| 会員の追加・変更・削除 | `shared_site_state` の `members`。リポジトリ内の基礎会員データに適用 |
| 商談・ギャラリー・スレッド | `shared_site_state` の `deals` / `gallery` / `threads` |
| 月例会 | `managed_meetings` |
| 会員別出欠 | `attendance_responses` |
| ゲスト | `attendance_snapshots` |
| 運営が保存したテーブル割り | `shared_site_state` の `table-assignment-drafts` |
| 会員向け公開テーブル割り | `shared_site_state` の `table-assignments` |

保存の成功はサーバー応答後に表示します。通信・認証・保存先設定の不備はエラーとして表示されます。複数運営者の編集では更新時刻を確認し、競合時は最新データへ変更を適用し直すか、再読み込みを案内します。

ブラウザ保存はキャッシュとテーブル割りの作業途中の復元に使用します。「保存」前のテーブル変更は同じ端末内の下書きであり、他の運営者には共有されません。画像選択時は縮小した画像データを共有レコードに保存します。Supabase Storageへの画像アップロード方式ではありません。

## ログインと権限

`/member/login?redirect=/member` が会員用、`/member/login?redirect=/admin` が運営用です。運営・会員は別の共通パスワードを使用します。現在の権限判定は署名付きCookieであり、Supabase Authや `users` / `roles` テーブルの個人別ログインではありません。

- 運営セッション：管理画面および管理用保存APIを使用可能
- 会員セッション：会員ページ、公開テーブル割り、出欠回答などを使用可能。管理用保存APIは不可
- 未ログイン：公開ページを閲覧可能。管理用データの変更は不可

CookieはHttpOnly、有効期間は12時間です。本番HTTPSではSecureも設定します。旧形式の `ok` Cookieは無効になるため、この変更を反映した後は再ログインしてください。署名用秘密鍵を変更した場合も再ログインが必要です。共通パスワードだけの変更では発行済みセッションは失効しないため、即時失効が必要な場合は署名用秘密鍵も更新します。

SupabaseではRLSを有効にし、サーバーがservice-roleキーで読み書きします。そのため管理権限の検証は各APIでも行います。共通パスワード方式には、個人別の本人確認や操作履歴の識別はありません。

## 運営の操作

1. `/admin` へログインします。ダッシュボードは保存済み会員・次回月例会の出欠・今後の確定月例会を集計します。
2. `/admin/members` で会員登録・編集を行い、保存します。会員番号の重複は保存時に確認します。
3. `/admin/meetings` で日程・会場を設定し、対象月例会の参加者画面で出欠・ゲストを保存します。
4. 対象月例会の「自動テーブル割り」で人数設定を選び、自動生成します。移動・並べ替えで調整した後、「保存」で運営間に共有します。
5. 保存後に「保存済みの内容を公開する」を押すと会員画面へ反映されます。未保存の編集内容は公開されません。
6. 「過去データ管理」から過去の月例会の参加状況・テーブル割りを確認・修正できます。会員側でも公開済みの過去の割り当てを閲覧できます。

PDF出力はブラウザの印刷画面からPDF保存を行います。CSV出力は編集中のテーブル割りをダウンロードします。

## 自動テーブル割り

1テーブルの設定は4〜8人です。参加者数に応じて人数を分散し、実際の開催日順で直前2回の保存済みテーブル割りを参照します。現在の月例会や未来の履歴、固定サンプルを過去履歴として扱いません。

過去の同席ペアの重複を最優先で減らし、リーダー・業種・役員・ゲストの配置も評価します。探索には上限があるため、人数や過去の組み合わせによって重複ゼロを保証するものではありません。残った重複は警告に表示します。対象の過去履歴が未保存の場合も日付付きで案内します。

生成はボタン操作時だけ行います。参加者の再取得や画面内の更新によって、編集中の割り当てを自動生成し直すことはありません。

## 自動テスト

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

`npm test` は `tests/*.test.cjs` を実行します。署名付き認証、APIの保存と競合、会員更新、月例会・出欠、画像処理、テーブル生成・編集・履歴表示などを対象にしています。APIテストは実際のルート処理とメモリ内のSupabase代替実装を使います。本番DBを変更せず、実ブラウザですべての操作を検証したことを意味するものではありません。

個別の実行例：

```bash
node --test tests/integration.test.cjs
node --test tests/table-assignment-editor.test.cjs
```

## 本番データを使わないブラウザ確認

ターミナル1：

```bash
node tests/fixture-server.cjs
```

ターミナル2：

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:5440 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only-anon \
SUPABASE_SERVICE_ROLE_KEY=fixture-only-key \
AUTH_SESSION_SECRET=fixture-only-session-secret \
MEMBER_PAGE_PASSWORD=fixture-member \
ADMIN_SHARED_PASSWORD=fixture-admin \
npm run dev -- --port 3100
```

[確認用サイト](http://localhost:3100) を開きます。会員用パスワードは `fixture-member`、運営用は `fixture-admin` です。テストサーバーは `127.0.0.1:5440` のみで待ち受け、会員・月例会・出欠・過去テーブル割りのテストデータをメモリに保持します。停止すると変更は消えます。再起動時に古い端末内下書きが不要なら、確認用サイトのブラウザ保存も削除してください。

[テストサーバーの状態](http://127.0.0.1:5440/__fixture/status) では件数とリクエストの種類・結果を確認できます。これはPostgRESTの一部を再現するテスト用実装で、実際のSupabase環境での確認に代わるものではありません。

## Vercelへの反映

対象環境のSupabaseマイグレーションと環境変数を確認し、Git連携またはVercel CLIでデプロイします。環境変数を変更した場合は再デプロイが必要です。反映後は運営として再ログインし、保存・再読み込み・別端末での表示と公開テーブル割りを確認してください。デプロイ時に `seed.sql` を自動実行しないでください。
