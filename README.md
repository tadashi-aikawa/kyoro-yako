# 梟楼夜航 — きょうろうやこう

owleryのメンバーが登場する、ブラウザ向けの弾幕シューティングです。

消えた朝の約束を、みみこの手でつなぎ直す夜の冒険。
五つの階で記録の断片を集め、夜明けの天文台へ届けます。

タイトルの読みは「きょうろうやこう」です。

## 夜の梟楼

- 各階のクリアで記録の断片を獲得します。タイトルの「集めた記録を読む」から読み返せます。
- 門の小鳥、書庫の本、回廊の折り紙、夜桜の提灯、天文台の星狐が道中に登場します。
    - 演出: 通常・発射前・被弾の姿を切り替えます。
- 床と建築が異なる速さで流れ、門・書架・回廊・夜桜を通り抜けて朝焼けの天文台へ進みます。
- 道中は10種の編隊が登場します。左右からの挟み込み、蛇行、旋回、V字隊列が加わり、各階と前後半で順序が変わります。
- 必殺技は各メンバーの個性に合わせた自由な名前です。

敵素材の生成プロンプトは [docs/enemy-sprites-prompts.txt](docs/enemy-sprites-prompts.txt) に収録しています。

## 起動

```sh
pnpm install
pnpm dev
```

`pnpm check` で型チェック、Biome、ユニットテスト、ビルドを実行します。

## GitHub Pagesでの公開

公開先は `https://tadashi-aikawa.github.io/kyoro-yako/` を予定しています。

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

## ステージ

| Stage | 中ボス | ボス |
| --- | --- | --- |
| 1 | エトキチ | ネオ |
| 2 | オブシディア | オブシディア |
| 3 | チャッピー | クロディーヌ |
| 4 | 迅雷 | 迅雷 |
| 5 | ネオ | ミネルヴァ |

## 操作

| キー | 操作 |
| --- | --- |
| 矢印 | 移動、メニュー選択 |
| Shift | 低速移動、当たり判定表示 |
| Z | ショット、決定、会話送り |
| X | ボム、戻る |
| Esc | ポーズ |
| Ctrl | 会話早送り |

## デバッグ用クエリ

- `?stage=1`：指定ステージの道中から開始。値は1〜5。
- `?boss=2&phase=1`：指定ボスのフェーズから開始。値は1〜5。フェーズは0始まり。
- `?player=mimiko&difficulty=hard`：自機と難易度を指定。自機は`mimiko`のみ。難易度は`easy`、`normal`、`hard`、`lunatic`。
- `?invincible=1`：無敵。
- `?autoshot=1`：ショットを常時発射。
- `?power=4&lives=5&bombs=3`：開始時のPower(0〜4)・残機(0〜8)・ボム数(0〜8)を指定。
- `?ending=mimiko`：エンディングから開始。

開発ビルドでは `window.__owlery.state()` で状態を取得し、`window.__owlery.skipPhase()` で現在のボスフェーズを進められます。
