# 梟楼夜航のPV書き出し

`storyboard.json`を編集して、1920×1080・60fpsのMP4を再生成する。

## 実行

必要なものはNode.js、Google Chrome、ffmpeg、ffprobe、cwebp。本体の`node_modules`もインストール済みであること。

```sh
npm --prefix /Users/tadashi-aikawa/work/owlery-danmaku/tools/pv ci --ignore-scripts
node /Users/tadashi-aikawa/work/owlery-danmaku/tools/pv/export.mjs
```

- 出力: `_Unversioned/pv/kyoro-yako-pv.mp4`
- 検分用静止画: `_Unversioned/pv/review/<cut-id>.webp`
  - 素材: 完成したMP4から切り出す。
- 撮影条件・フレーム数・ffprobe・所要時間: `_Unversioned/pv/kyoro-yako-pv.report.json`
- 朝空キャッシュ: `_Unversioned/pv/ending/`
- H.264中間データは成功・失敗を問わず既定で削除する。
  - 保存: `--keep-intermediate`を付ける。
- MP4は一時パスで生成・検証してから正式パスへリネームする。
- `--name`または部分書き出しの静止画は`review/<name>/`へ保存する。
  - 理由: 正式版の代表フレームを上書きしないため。

Viteを`127.0.0.1:5391`で自動起動する。終了時にはそのポートを停止する。

- ポートが使用中なら、`--port 5392`などで空きポートを指定する。
- Chromeは`channel: 'chrome', headless: true`で起動する。
- Playwright付属Chromiumのインストールは不要。
- 本体の`pnpm-workspace.yaml`に`packages: ['.']`を明示して、`tools/pv`を除外する。
  - 理由: 未指定のままでは`verifyDepsBeforeRun`がPV専用依存を検出し、本体のスクリプトを停止する。
  - 確認: 本体で`pnpm lint`と`pnpm check`が通り、本体の`package.json`と`pnpm-lock.yaml`に差分がないこと。
- PV専用の依存はこのディレクトリの`package-lock.json`で固定する。

## 絵コンテ

変更先は`storyboard.json`の1ファイル。

| フィールド | 内容 |
|---|---|
| `duration` | 動画全体の秒数 |
| `cuts[].start` | カット開始秒。次のカットの開始秒が終了秒になる |
| `cuts[].review` | カット内の代表フレームを切り出す秒数 |
| `cuts[].kind` | 導入、物語、キャラ、戦闘などのカット種別 |
| `cuts[].layout` | キャラごとの組み方。下表参照 |
| `text`, `name`, `quote`, `spell`, `stageTitle` | 表示する文言 |
| `portrait`, `keyVisual` | Viteの公開パスで指定する画像 |
| `capture.stage`, `phase`, `midboss` | 面、0始まりのフェーズ、中ボス指定 |
| `capture.warmup` | 撮影前に進めるゲーム更新回数。単位はフレーム |
| `capture.difficulty`, `seed` | 難易度と乱数seed |
| `capture.power`, `maxform` | 省略時Power4。最高形態はPower5とtrueを指定 |
| `capture.defeatAt` | カット内の指定フレームからボスHPを1へ下げる |
| `music.path`, `segments`, `fadeOut`, `volume` | 音楽のパス、原曲の区間`[{from,to}, …]`、末尾フェード秒、音量 |
| `music.crossfade` | 前区間の末尾を延長し、指数フェードアウトして重ねる秒数。既定0.2秒。0ならconcatで直結 |
| `music.spliceFadeIn` | 後続区間の先頭の直線フェードイン秒数。既定0.001秒、上限0.005秒。44.1kHzの整数サンプルへ切り捨てる |
| `music.segments[].cut` | 音楽区間に対応するカットID。`pvStart`とカットの`start`が異なれば警告 |
| `music.offset` | 旧形式の開始秒。`segments`があればそちらを優先 |
| `ending.path`, `offset`, `duration` | 朝空の動画素材、開始秒、切り出し秒数 |

秒数は60fpsのフレーム境界へ丸める。カット開始は昇順で指定する。

- 音楽ファイルがあればAACとして合成する。
  - 初期パス: `_Unversioned/assets/pv/pv-theme.mp3`
  - PVの尺が区間合計より長い場合: 末尾に無音を足す。
  - 取得範囲が原曲の長さを超える場合: 描画を始める前にエラーで停止する。
- 音楽がなければ音声トラックを含まないMP4になる。
- ゲームの音声・動画素材の音声は合成しない。
- B案の初期値: 原曲0〜83.91秒と152.48〜170秒、映像101.4秒。
  - 接続: 1区間目を原曲84.11秒まで追加取得し、83.91〜84.11秒の延長部分だけを指数フェードアウトする。2区間目は83.91秒から始め、最初の44サンプルだけ直線フェードインする。
  - 補正: 44サンプルは約0.998ms。その後の2区間目のゲインは1。全体へのリミッターや追加の音量低下は行わない。
  - 尺: 音楽の合計101.43秒を映像の101.4秒へ切り詰める。重なりによる短縮や末尾無音の追加はない。
  - 同期: 原曲152.48秒の一打を、`dawn`の開始指定と同じPV83.91秒へ置く。
- 原曲の`from`の音が、その区間のPV上の開始時刻`pvStart`に鳴る。
  - 開始時刻: 先行区間の`to - from`の合計。最初の区間はPV0秒から始まる。
  - 重なり: 最後以外の区間は`to + crossfade`まで追加取得する。後続区間の開始は前倒ししない。
  - 素材: 原曲には各`to`の後ろに延長分の音が必要。
  - フェード曲線: FFmpegの`afade`で直線`tri`と指数`exp`を指定する。仕様は[公式ドキュメント](https://ffmpeg.org/ffmpeg-filters.html#afade-1)を参照。
  - レポート: `audio.sourceRanges`に実際の取得範囲と`pvStart`を記録する。
- 部分書き出しでは、結合済みの音楽から同じ時刻を切り出す。
  - フェード: `--from`/`--to`による部分書き出しには末尾フェードを付けない。
- `spell`は撮影する技の名前とも照合する。
  - 条件: 表示文言だけの変更で技名が実装と異なった場合は停止する。

| レイアウト | 組み方 |
|---|---|
| `neo` | フィールド左、右に大きな立ち絵、足元へ大きな横組みの名前 |
| `obsidia` | フィールド右、左に立ち絵、余白の右端に縦組みの名前 |
| `chappy` | フィールド左、右上へ横組みの名前、左下に細いセリフ段、右に小さめの全身 |
| `claudine` | フィールド右、左の大きな立ち絵をトリミング、下端を暗幕に沈めて横組みの名前 |
| `jinrai` | フィールド左、名前とセリフを立ち絵の両脇へ縦組み |
| `etokichi` | フィールド右、左側の上に名前、中央に丸い立ち絵、下にセリフ |
| `minerva` | フィールド左、右に大きな立ち絵、右端に縦組みの名前、下端を暗幕に沈めてセリフ |
| `field-left`, `field-right` | 物語とサビ用。フィールドの左右を指定し、余白に大きな立ち絵 |

## 短い試写と受入

```sh
# 全区間の代表フレームをCanvasから直接生成する。
node /Users/tadashi-aikawa/work/owlery-danmaku/tools/pv/export.mjs --review-only

# サビだけを書き出す。完成版のMP4を上書きしない。
node /Users/tadashi-aikawa/work/owlery-danmaku/tools/pv/export.mjs --from 60 --to 80

# 同じフレームの再現性、区切りの時刻と文言の変更を検証する。
node /Users/tadashi-aikawa/work/owlery-danmaku/tools/pv/export.mjs --verify

# 撮影可能な長さと余裕だけを検査する。
node /Users/tadashi-aikawa/work/owlery-danmaku/tools/pv/export.mjs --preflight-only

# 完成後に古い試写・検証ファイルと旧H.264中間物を片づける。
node /Users/tadashi-aikawa/work/owlery-danmaku/tools/pv/export.mjs --clean

# 音楽結合・部分書き出しの音位置を実際のPCMで検証する。
node --test /Users/tadashi-aikawa/work/owlery-danmaku/tools/pv/audio-check.mjs

# 別の絵コンテで書き出す。
node /Users/tadashi-aikawa/work/owlery-danmaku/tools/pv/export.mjs --board /absolute/path/storyboard.json

# 別名で保存する。
node /Users/tadashi-aikawa/work/owlery-danmaku/tools/pv/export.mjs --board /absolute/path/storyboard.json --name alternate
```

`--review-only`の静止画は保存先の`source/`へ置く。代表フレームの一覧`contact.webp`も自動生成する。

- `audio-check.mjs`はNode専用の検証ファイル。本体のVitestが拾わない名前にする。
- `--clean`は旧中間物に加え、`review/source/`、`review/announcement/`、`review/fix1-preview/`と告知・fix1試写を掃除する。
  - 例外: 今回指定した出力名と入力絵コンテは保護する。
- 実時間が15分を超えた場合は警告を出す。正常な動画は保存する。

すべての書き出しで、先に全カットを実ゲームでシミュレーションする。

- 必要フレーム数に加え、最大300フレーム先まで余裕を調べる。
- フェーズ終了・専用カットイン終了・動画遷移が必要尺より早ければ、MP4生成前に停止する。
- 撃破カットは指定尺だけを検査する。
- レポートには事前検査、`src/`のコミット・未コミット差分、音源SHA-256、ffmpegバージョンも記録する。

合成ページのAPI:

```js
await window.pv.configure(storyboard);
await window.pv.renderFrame(1920); // 動画の32秒地点
window.pv.snapshot();             // WebPのdata URL
window.pv.state;                  // ゲーム時計・弾数・撮影監査
```

Vite起動中の`/tools/pv/index.html?bgm=0&frame=1920`でも同じフレームを表示できる。

## 撮影の仕組み

GameとRendererを直接importし、`game.update()`を60fpsで進める。フレーム時刻に実時間は使わない。

- 乱数: カットごとにseed付きMulberry32へ差し替える。
- 自動回避: 受入ハーネスの18候補探索を基に、未来の弾位置・書庫のグラフ・迅雷のレーザーを評価する。
- 自機: 無敵、常時ショット、開始時の無敵点滅なし。
- 描画: Rendererはpixel ratio 3。論理`384×448`のフィールドだけを高さ1080pxに拡大する。
  - 再現性: Canvasは`willReadFrequently: true`で作り、GPU描画の履歴による微小な画素差を避ける。
  - 合成: フレームごとに`reset()`し、前の描画状態を引き継がない。
  - 表示: 撮影専用Vite設定で開発用FPS表示を無効にする。
- 専用カットイン: 本編の`drawUltimateCutin`を縦横比を維持した別レイヤーへ描く。
  - 理由: 本編では640px幅の演出なので、フィールド幅で切り出すと技名が欠ける。
  - パネル: このレイヤーには冒険ノートを含まない。
- エンコード: CanvasのRGBA画素をWebCodecsへ渡してH.264 Annex Bを生成し、ffmpegでBT.709・YUV420・limited rangeに統一してMP4へ保存する。
  - 入力: RGBAとfull rangeを明示し、描画内容による色レンジの変化を防ぐ。
  - 仕上げ: libx264の`veryfast / CRF 18`を使用する。
  - 詳細: [W3C AVC WebCodecs Registration](https://www.w3.org/TR/webcodecs-avc-codec-registration/)
- 朝空: ffmpegで固定時刻のフレームへデコードし、cwebpでWebPへ変換する。

撮影監査は被弾表示・指定フェーズの継続・文字のセーフエリア・動画仕様をチェックする。`overlapFrames`は通常弾との幾何学的な接触候補を数える。専用ギミックの当たり判定全体を置き換える値ではない。

最終確認には`review/`の静止画とMP4を使う。ハードウェアエンコーダーやフォントが異なる環境間のMP4のバイト一致は保証しない。
