# 開発ガイド

## 起動

```sh
pnpm install
pnpm dev
```

`pnpm check` で型チェック、Biome、ユニットテスト、ビルドを実行します。

## GitHub Pagesでの公開

公開先は https://tadashi-aikawa.github.io/kyoro-yako/ です。

1. `public/assets/bgm/ending.mp3` を配置します。
2. タイトルからエンディングまで通しで確認します。
3. `pnpm check` を実行します。
4. `main` をGitHubへpushします。
5. GitHubの Settings → Pages → Build and deployment → Source で **GitHub Actions** を選びます。
6. Actionsの **Deploy to GitHub Pages** を開き、`main` を選んで **Run workflow** を実行します。
7. ワークフローの成功後、公開URLで画像・音楽・操作を確認します。

公開ワークフローは手動で実行します。push時には公開しません。

ローカルで公開用の配信パスを確認する場合は、次を実行します。

```sh
pnpm build:pages
pnpm exec vite preview --base=/kyoro-yako/ --host 127.0.0.1 --port 5198
```

`http://127.0.0.1:5198/kyoro-yako/` で確認できます。

- [ViteのGitHub Pages公開手順](https://v7.vite.dev/guide/static-deploy#github-pages)
- [GitHub Pagesのカスタムワークフロー](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 依存と公開処理の更新

- 直接依存はexactバージョン、間接依存はコミット済みのロックファイルで固定します。
- CIでは `pnpm install --frozen-lockfile` を使います。
- インストール時のスクリプト実行は `esbuild@0.28.2` だけを許可します。
    - 条件: 未確認のスクリプトが追加された場合はインストールを失敗させます。
- pnpmとCIのNode、Actionsの参照も固定します。
    - Actions: 公式リリースのフルコミットSHAを使い、コメントにバージョンを記載します。
- 更新時は差分をレビューし、`pnpm audit`・`pnpm check`・`pnpm build:pages` を実行します。
    - 限界: 固定と監査は、パッケージ自体の悪意や未公開の脆弱性を保証しません。

## デバッグ・仕様・素材

- [デバッグ用クエリと開発ビルドのAPI](spec.md#デバッグ検証用の口)
- [ステージ構成とボスの挙動](spec.md#ステージ構成)
- [敵素材の生成プロンプト](enemy-sprites-prompts.txt)

[READMEへ戻る](../README.md)
