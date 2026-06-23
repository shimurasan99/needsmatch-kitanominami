# ニーズマッチ 北のみなみ支部 Webアプリ

公式ホームページ、会員管理、定例会管理、自動テーブル割りを想定した Next.js / Supabase / Vercel 構成のプロジェクトです。

## ローカル起動

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

## 主な画面

- `/` トップページ
- `/about` 支部紹介・写真ギャラリー
- `/members` 会員紹介
- `/entry` 定例会参加申し込み
- `/join` 入会・退会案内
- `/member` 会員専用ページ
- `/admin` 運営専用ページ
- `/admin/meetings/[id]/table-assignments` 自動テーブル割り

## Supabase 設定

1. Supabase プロジェクトを作成します。
2. `supabase/migrations/001_initial_schema.sql` を SQL Editor で実行します。
3. `supabase/seed.sql` を実行して初期データを投入します。
4. `.env.example` を参考に環境変数を設定します。

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
MEMBER_SHARED_PASSWORD=admin
```

## 権限設計

- 管理者: 全機能
- 主催、幹事、準役員: 運営ページ、月例会、参加者、テーブル割り、ギャラリー、スレッド管理
- 一般会員: 会員専用ページのみ

Supabase Row Level Security はマイグレーションに含めています。公開会員は `is_visible = true` かつ `status = '在籍'` のみ表示します。

開発環境では会員専用ページと運営専用ページを共通パスワード `admin` で保護しています。変更する場合は `MEMBER_SHARED_PASSWORD` を設定してください。

## 自動テーブル割り

`lib/table-assignment/generator.ts` にスコアリング方式のロジックがあります。

- 1テーブル4〜5人を目標
- テーブルリーダー不在に大きなペナルティ
- 同じ大業種の重複にペナルティ
- 前回・前々回同卓にペナルティ
- 役員偏り、ゲスト配置も評価
- 複数回シャッフルして最小スコアの組み合わせを採用

## Vercel デプロイと仮URL確認

1. GitHub にリポジトリを作成して push します。
2. Vercel でリポジトリを Import します。
3. Environment Variables に Supabase の値を設定します。
4. main ブランチ以外に push すると Preview URL が発行されます。
5. Preview URL を運営陣に共有して確認できます。

## 今後の本番実装ポイント

- Supabase Auth のログイン UI とセッションガードを実装
- 管理画面の各フォームを Supabase CRUD に接続
- Supabase Storage へプロフィール画像とギャラリー画像をアップロード
- PDF出力、CSV出力を実データに接続
- 共通パスワード認証を Cookie ベースで実装
