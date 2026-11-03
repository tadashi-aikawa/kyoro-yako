# 梟楼夜航 — きょうろうやこう

owleryのメンバーが登場する、ブラウザ向けの弾幕シューティングです。

差出人のない招待状を手に、みみこが梟楼の弾幕祭りへ。
仲間たちとの本気の勝負を越え、最上階の天文台を目指します。

![梟楼夜航のタイトル画面](public/assets/title/ogp.webp)

[ブラウザで遊ぶ](https://tadashi-aikawa.github.io/kyoro-yako/) · [PVを見る](https://www.youtube.com/watch?v=7sD5zUuMwQQ)

## 遊び方

PCのブラウザで遊べます。Chromeで動作を確認しています。
キーボードが必要です。スマートフォン・タッチ操作には対応していません。

タイトルの「はじめる」から難易度を選んで開始します。

画像・BGM・動画の準備が必要なときは、読み込み画面が表示されます。
通信に失敗したときは、読み込み直すか、タイトルへ戻るかを選べます。
音声・動画だけの失敗なら、その素材を省略して続けることもできます。

| キー | 操作 |
| --- | --- |
| 矢印 | 移動、メニュー選択 |
| Shift | 低速移動、当たり判定表示 |
| Z | ショット、決定、会話送り |
| X | ボム、戻る |
| Esc | ポーズ |
| Ctrl | 会話早送り |

ネオの「ノーマルモードから逃がさない」の間だけ、移動は H←・J↓・K↑・L→ に切り替わります。

各階をクリアすると勝負の記録が集まります。
タイトルの「冒険ノート」から読み返せます。

## 素材とクレジット

- 画像: Codex内蔵のimagegenで生成しました。
    - 立ち絵
    - SDスプライト
    - 敵
    - カットイン
    - タイトル画面
    - スタッフロールの絵
- BGM: GeminiアプリのLyria 3.5で生成しました。
- ムービー: Geminiアプリの動画生成で生成しました。
- 制作: tadashi-aikawa とチームowleryのAIメンバー。
- 制作支援: Codex・Claude Code・Gemini。

迅雷の瞬間移動音は、[OtoLogic](https://otologic.jp/free/se/motion-agility01.html)の「Motion-Agility13-1(Mid)」を使用しています。
ライセンスは[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)です。
出典と再生時の無音区間の扱いは[音源クレジット](public/assets/audio/ATTRIBUTION.txt)に記載しています。

## 開発者向け

起動・公開・検証の手順は[開発ガイド](docs/development.md)を参照してください。

## ライセンス

コードはMITライセンスです。全文は[LICENSE](LICENSE)を参照してください。

以下は再配布・再利用できません。

- `public/assets/` 以下の画像・BGM・動画
- 次のファイル内のシナリオ文
    - `src/story.ts`
    - `src/dialogue.ts`
    - `src/render.ts`
    - `src/game.ts`
- キャラクター

OtoLogicの効果音は除きます(CC BY 4.0)。
