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
- `--source-ref <commit>`で撮影する本体のコミットを固定できる。
  - 方法: 指定コミットの`src/`を一時ディレクトリへ展開し、撮影専用Viteの参照先を切り替える。作業中の`src/`は変更しない。
  - 範囲: 固定するのは本体コード。絵コンテ・合成コード・画像・音楽は作業ディレクトリを使う。
  - 再現性確認: 同じコミットを指定して2回実行する。レポートの`source.pinned`と`source.head`に記録する。
  - 未指定時: 撮影中に`src/`の変更を検出したら、本編を置き換える前に停止する。
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

既定の絵コンテは`storyboard.json`。

- 冒頭の題字に`genreText`を重ねる。
  - 時刻: 題字のフェード開始3秒から1.5秒遅れて、左下にジャンル紹介が現れる。
  - 文言: 句読点を付けず、「弾幕」の前で改行する。
- 13.74秒に手紙、16.93秒に上階への物語、20.12秒にみみこの紹介を置く。
  - 物語: みみこを左、セリフを右へ置く。手紙の開始から2秒で鍵絵を黒へ落とし、次の物語も黒を維持する。
  - みみこの紹介: ステージ1道中を背景に、名前と本体のセリフを表示する。
- 26.50〜52.02秒は、ネオ・エトキチ・オブシディア・チャッピーを各6.38秒紹介する。
- 52.02・53.61・55.21秒にステージ2・3・4の道中を中央へ大きく表示する。
  - 表示: 立ち絵と合成文字なし。カット頭の3フレームを白フラッシュにする。
- 56.80〜58.39秒の`cutin-trio`は、上・中・下の360pxの3段に絵だけを表示する。
  - 時刻: クロディーヌ56.80秒、迅雷57.33秒、ミネルヴァ57.86秒。
  - 動き: 左・右・左から0.18秒で滑り込み、止まったら静止する。
  - 切り出し: 各素材の顔を含む横長の領域を縦横比を保って段の高さへ縮める。
  - 中央: 素材内の顔の中心`faceX`が画面のx=960へ来るように置く。
- サビはクロディーヌ・迅雷・ミネルヴァの順で、各人の通常技と最終技を見せる。
  - 表示: `presentationStart`を通常技の開始時刻にそろえ、技の切り替えで立ち絵と文字を再登場させない。
  - 接続: サビ頭に0.12秒の白フラッシュを入れる。
- `kind: character`の合成文字は名前とセリフだけ。
  - 補足: `spell`はゲーム内のフェーズ照合にも使うため、データには残す。
- カット間は小節頭の0.3秒前からクロスフェードし、小節頭で次の絵へ切り替え終える。
  - 撮影: 次のカットを18フレーム早く撮り始め、そのまま進行させる。末尾の静止画を引き延ばさない。
  - 例外: 道中3連打と3段カットインの接続にはクロスフェードを掛けない。
  - 通常技から最終技: プレイフィールドだけをクロスフェードし、人物側を維持する。
- キャラの立ち絵は外側から0.4秒で入る。
  - 名前: 立ち絵の停止後に、1.08倍から等倍へ0.3秒で縮小しながらフェードインする。
  - セリフ: 名前の開始から0.2秒遅れて、下24pxから0.3秒で上昇しながらフェードインする。
  - 基準: 登場演出もクロスフェードの開始時刻から進める。
- みみこを含む8人の立ち絵は、透明余白を除いた高さ800pxで上下中央に置く。
  - 測定: alphaが12/255を超える範囲を素材ごとに取得し、縦横比を維持する。元画像は編集しない。
- 紹介のフィールドは、384×448の全体と枠線の周囲2pxを高さ984pxへ縮め、上下48pxの余白を置く。
  - 四辺: 本体の枠線はFIELDの外側へ1px張り出すため、その部分も撮影に含める。
- ミネルヴァの最終技は`capture.prayer: { cycle: 12, frame: 0 }`で最後の祈りを撮る。
  - 準備: 離陸後までwarmupし、本体のHP境界を順に通して指定のサイクルへ入る。
  - 本気区間: 宣言と補給の演出がある場合は、本体の更新で終了するまで待ってから次のHP境界へ進める。
  - 維持: 祈りの準備以降は自動ショットを止める。クロスフェード分の18フレームを含め、溜めから連射、休みへ進む305フレームを撮影する。
- チャッピーは撮影中だけ`capture.holdHp`でHPを保持する。
  - 理由: 元のwarmupとショットを保ったまま6.38秒の尺を確保する。

```sh
caffeinate -dimsu node tools/pv/export.mjs --clean
caffeinate -dimsu node tools/pv/export.mjs --verify
```

各段の差し込み完了フレームは`review/trio-top.webp`・`trio-middle.webp`・`trio-bottom.webp`、3段そろった代表フレームは`review/trio.webp`へ書き出す。

- `review/opening-genre.webp`: ジャンル紹介が現れた題字画面。
- `review/rush.webp`: 道中3カットを左からステージ2・3・4の順に並べる。
- `review/slide-in.webp`: ネオの登場開始から0.0・0.1・0.2・0.3・0.4秒を左から並べる。
- `review/story.webp`: 手紙の鍵絵が黒へ落ちた状態。
- `review/field-fit.webp`: ネオの紹介。フィールドの四辺を含む。
- `review/portrait-heights.webp`: みみこ・ネオ・エトキチ・オブシディア・チャッピー・クロディーヌ・迅雷・ミネルヴァの順で人物側を並べる。
- `review/name-motion.webp`: ネオの名前の登場開始から0.1秒刻みで5枚を並べる。

| フィールド | 内容 |
|---|---|
| `duration` | 動画全体の秒数 |
| `cuts[].start` | そのカットへの切り替えが完了する小節頭の秒数 |
| `cuts[].review` | カット内の代表フレームを切り出す秒数 |
| `cuts[].kind` | 導入、物語、キャラ、戦闘などのカット種別 |
| `cuts[].layout` | キャラごとの組み方。下表参照 |
| `text`, `name`, `quote` | 表示する文言 |
| `spell` | 撮影フェーズの照合用。キャラ紹介には描かない |
| `presentationStart`, `flashIn` | 通常技のstartを指定して人物の再登場を抑止、カット頭の白フラッシュ秒数 |
| `effects` | 各演出の既定値。下表参照 |
| `presentation.fieldHeight`, `fieldMargin`, `portraitHeight` | 紹介フィールドの高さ984px、画面の左右端から24px、立ち絵の実体の高さ800px |
| `cuts[].transition`, `crossfade` | `flash`または`none`でクロスフェードを除外。`crossfade`で秒数を上書き |
| `members[].start`, `direction`, `faceX`, `cropY`, `cropHeight` | 3段カットインの開始秒、入場方向、素材内の顔の中心X座標、切り出し位置と高さ |
| `portrait`, `keyVisual` | Viteの公開パスで指定する画像 |
| `capture.stage`, `phase`, `midboss` | 面、0始まりのフェーズ、中ボス指定 |
| `capture.warmup` | 撮影前に進めるゲーム更新回数。単位はフレーム |
| `capture.difficulty`, `seed` | 難易度と乱数seed |
| `capture.power`, `maxform` | 省略時Power4。最高形態はPower5とtrueを指定 |
| `capture.defeatAt` | カット内の指定フレームからボスHPを1へ下げる |
| `capture.holdHp` | 撮影中はwarmup終了時のHPを各更新前に復元する |
| `capture.prayer` | stage 5・phase 10限定の祈り指定。`cycle`は3・8・12、`frame`は祈り内の0〜359 |
| `music.path`, `segments`, `fadeOut`, `volume` | 音楽のパス、原曲の区間`[{from,to}, …]`、末尾フェード秒、音量 |
| `music.crossfade` | 前区間の末尾を延長し、指数フェードアウトして重ねる秒数。既定0.2秒。0ならconcatで直結 |
| `music.spliceFadeIn` | 後続区間の先頭の直線フェードイン秒数。既定0.001秒、上限0.005秒。44.1kHzの整数サンプルへ切り捨てる |
| `music.segments[].cut` | 音楽区間に対応するカットID。`pvStart`とカットの`start`が異なれば警告 |
| `music.offset` | 旧形式の開始秒。`segments`があればそちらを優先 |
| `ending.path`, `offset`, `duration` | 朝空の動画素材、開始秒、切り出し秒数 |

秒数は60fpsのフレーム境界へ丸める。カット開始は昇順で指定する。

| effectsのフィールド | 既定値 |
|---|---|
| `crossfade` | 0.3秒 |
| `portraitSlide`, `portraitDistance` | 0.4秒、1000px |
| `nameDelay`, `nameDuration`, `nameScale` | 立ち絵の停止から0秒遅延、0.3秒、1.08倍から等倍 |
| `quoteDelay`, `quoteDuration`, `quoteDistance` | 名前から0.2秒遅延、0.3秒、下24pxから上昇 |
| `storyFade` | 手紙の開始から2秒で黒へフェード |
| `trioSlide` | 0.18秒 |
| `rushFlash`, `chorusFlash` | 0.05秒、0.12秒 |
| `titleAt`, `titleFade` | 3秒から、3秒でフェード |
| `genreDelay`, `genreFade` | 題字から1.5秒遅延、1秒でフェード |

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
| `obsidia` | フィールド右、左に立ち絵、その下側に横書きの名前とセリフ |
| `chappy` | フィールド左、右上へ横組みの名前、人物パネルの左下に細いセリフ段、右に全身 |
| `claudine` | フィールド右、左の立ち絵の下端を暗幕に沈めて横組みの名前 |
| `jinrai` | フィールド左、名前とセリフを立ち絵の両脇へ縦組み |
| `etokichi` | フィールド右、左側の上に名前、中央に丸い立ち絵、下にセリフ |
| `minerva` | フィールド左、右に大きな立ち絵、右端に縦組みの名前、下端を暗幕に沈めてセリフ |
| `field-left`, `field-right` | フィールドの左右を指定し、反対側へ上下中央の立ち絵と名前・セリフ |
| `field-center` | 道中3連打用。高さ1080pxのフィールドを中央に置き、両脇を夜空にする |

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
  - 本編: 削除されたgenre・conversation・個別カットイン・旧battle・gold・defeatの代表画像も掃除する。
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
  - 例外: 指定の祈りは自動ショットを止め、HPの進行を止める。
- 描画: Rendererはpixel ratio 3。論理`384×448`のフィールドだけを高さ1080pxに拡大する。
  - 再現性: Canvasは`willReadFrequently: true`で作り、GPU描画の履歴による微小な画素差を避ける。
  - 補助Canvas: Chromeの`--disable-accelerated-2d-canvas`で弾画像などもCPU描画へ統一する。
  - 合成: フレームごとに`reset()`し、前の描画状態を引き継がない。
  - 表示: 撮影専用Vite設定で開発用FPS表示を無効にする。
- 専用カットイン: 本編の`drawUltimateCutin`を縦横比を維持した別レイヤーへ描く。
  - 理由: 本編では640px幅の演出なので、フィールド幅で切り出すと技名が欠ける。
  - パネル: このレイヤーには冒険ノートを含まない。
- エンコード: CanvasのRGBA画素をWebCodecsへ渡してH.264 Annex Bを生成し、ffmpegでBT.709・YUV420・limited rangeに統一してMP4へ保存する。
  - 入力: RGBAとfull rangeを明示し、描画内容による色レンジの変化を防ぐ。
  - 再現性: WebCodecsは`prefer-software`、仕上げのlibx264は1スレッドへ固定する。
  - 監査: 各カットの小節頭・クロスフェード開始から12フレームずつと、代表フレームのRGBA画素ハッシュをレポートの`rgbaSha256`へ記録する。
  - 仕上げ: libx264の`veryfast / CRF 18`を使用する。
  - 詳細: [W3C AVC WebCodecs Registration](https://www.w3.org/TR/webcodecs-avc-codec-registration/)
- 朝空: ffmpegで固定時刻のフレームへデコードし、cwebpでWebPへ変換する。

撮影監査は被弾表示・指定フェーズの継続・文字のセーフエリア・動画仕様をチェックする。`overlapFrames`は通常弾との幾何学的な接触候補を数える。専用ギミックの当たり判定全体を置き換える値ではない。

最終確認には`review/`の静止画とMP4を使う。Chrome・ffmpeg・フォントが異なる環境間のMP4のバイト一致は保証しない。
