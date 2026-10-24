# ムービーの生成手順(Geminiアプリの動画生成)

Geminiアプリの動画生成で5本を作り、MP4で保存する。1本は最長10秒。つなぎの編集は要らず、ゲーム側が順に再生する。

## 生成の設定

1. gemini.google.com を開き、入力欄の「ツール」から「動画を作成」を選ぶ
2. 横長(16:9)にする
3. 表の参照画像をアップロードし、プロンプトを貼って生成する
4. 顔や構図が崩れた版は捨てて作り直す。文字・字幕・ロゴが入った版も捨てる
5. 保存したMP4を `public/assets/movies/` に、表のファイル名で置く

- 動画の音を使うかは `src/movies.ts` の `MOVIE_SETTINGS` で1本ずつ指定する
    - 音ありの動画はBGMをクロスフェードで止め、動画の音を使う。音量はOptionのBGM音量に従う
    - 音なしの動画は無音にし、場面に合わせたBGMを流す。lastbossはBGMも無音にする
    - 動画の終了・スキップ・再生失敗後は次の場面のBGMへ切り替える
    - 音あり動画の再生がautoplay制限で拒否された場合は、無音にして1回だけ再試行し、BGMを流す
    - `?bgm=0` では動画の音も鳴らさない
- 文字は極力入れない。全プロンプトの末尾で文字・字幕・ロゴを禁じている
- 画面比は16:9。ゲームの4:3の画面には上下に帯を付けて収める

## 参照画像

| 画像 | パス | 用途 |
|---|---|---|
| キービジュアル | `public/assets/title/key-visual.webp` | 塔の外観と5人の配置、絵柄 |
| みみこの立ち絵 | `public/assets/members/mimiko-stand.webp` | みみこの姿 |

## 本リスト

| # | ファイル名 | 音 | 流す場面 | 参照画像 |
|---|---|---|---|---|
| 1 | `opening.mp4` | あり | 難易度を選んだ直後、ステージ1の前 | みみこ(キービジュアルは渡さない。塔の全容と他のメンバーが映り込むため) |
| 2 | `lastboss.mp4` | なし。BGMも無音。ミネルヴァの登場開始でボス曲を再生 | 5面の道中が終わり、ミネルヴァの会話の前 | みみこ、ミネルヴァの立ち絵(キービジュアルは渡さない) |
| 6 | `jinrai-gift.mp4` | なし | 4面で迅雷を倒した直後、撃破後の会話の前。迅雷一閃の最後の攻防でみみこがとどめを刺す | 迅雷の立ち絵、みみこの立ち絵(みみこの形が崩れた版は捨てる) |
| 3 | `ending-1.mp4` | なし | 5面クリア後、エンディングの1本目 | みみこ |
| 4 | `ending-2.mp4` | なし | エンディングの2本目 | キービジュアル |
| 5 | `ending-3.mp4` | なし | エンディングの3本目 | キービジュアル、みみこ |

## 共通の指定

各プロンプトの末尾に、次の一文を付けている。

> Anime illustration style matching the reference image, soft painterly lighting, slow smooth camera movement, 16:9. No text, no letters, no captions, no subtitles, no logos, no watermark.

## プロンプト

### opening.mp4

```text
Night scene in front of a huge, ancient stone gate with carved owl ornaments and two warm lanterns, at the foot of an enormous tower. Low camera angle looking slightly upward: the gate fills the frame, the tower wall rises out of the top of the frame into the dark starry sky, and its top is never visible. Deep starry night, cherry petals drifting, ivy on the stone. A single sealed letter flutters in the wind and slips through the slowly opening gate. A small round grey-green owl plush with a yellow beak, the same character as the reference image, flaps after the letter and passes through the gate into the dim, lantern-lit ground floor hall of the tower. The camera slowly pushes forward toward the gate. No people, no other characters. Anime illustration style matching the reference image, soft painterly lighting, slow smooth camera movement, 16:9. No text, no letters, no captions, no subtitles, no logos, no watermark.
```

### lastboss.mp4

```text
Inside the top floor of an ancient owl tower, a huge ornate double door of an old observatory slowly swings open toward the camera. Beyond the door: a great brass telescope, star charts, bookshelves, and a tall window where the night sky is just beginning to pale into crimson and platinum before dawn. Floating dust and faint golden sparkles in the air. A small round grey-green owl plush with a yellow beak, the same character as the reference image, flies slowly through the opening door toward the window, seen from behind. In front of the tall window stands a single tall woman with long wavy hair and a long flowing dress, the same character as the second reference image, seen only as a dark backlit silhouette against the dawn sky, her back to the camera, a small owl perched on her raised hand. Her face and details are never visible. No other characters. The camera slowly pushes forward through the opening door after the plush. Anime illustration style matching the reference image, soft painterly lighting, slow smooth camera movement, 16:9. No text, no letters, no captions, no subtitles, no logos, no watermark.
```

### jinrai-gift.mp4

```text
The final clash of a high-speed duel in a moonlit Japanese garden at night, cherry petals torn through the air. Character A, from the first reference image: a beautiful, mature kunoichi with long black hair streaked with gold, gold hairpins and flowers, a black-and-gold off-shoulder kimono, crackling with golden lightning. Character B, from the second reference image: a small, perfectly round, chubby owl PLUSH TOY, grey-green felt body, two large flat white disc eyes with black pupils, a tiny yellow beak, stubby wings, a spotted grey belly. It must stay exactly this toy-like round shape in every frame: never a realistic owl, never a bird with feathers or a long body, never a stylized mascot with different proportions. The two blur past each other in rapid lightning-fast exchanges, A dashing with lightning trails, B darting and dodging as a round ball. Then time slows: B dives straight in and lands the decisive blow, a bright flash of light at the impact. A is struck and falls back gracefully, her hair fanning out; the final shot is a slow close-up of A lying defeated among the petals, one hand at her chest, with a sultry, amused half-smile and half-lidded eyes, as if saying she has been beaten and rather enjoyed it. B hovers above her, round and small. Stylish, intense, then sensual and calm. Anime illustration style matching the reference images, dramatic lighting with lightning flashes, dynamic then slow camera movement, 16:9. No text, no letters, no captions, no subtitles, no logos, no watermark.
```

### ending-1.mp4

```text
Morning sunlight slowly fills an old observatory at the top of a tower, pouring through a tall window over a brass telescope and star charts. On a wooden desk sits a small round grey-green owl plush with a yellow beak, the same character as the reference image. It gently closes a small notebook with both wings and looks up toward the light, content. Dust motes glow in the sunbeam. Calm, warm, peaceful. Anime illustration style matching the reference image, soft painterly lighting, slow smooth camera movement, 16:9. No text, no letters, no captions, no subtitles, no logos, no watermark.
```

### ending-2.mp4

```text
Wide exterior shot of the tall owl tower from the reference image at sunrise, the sky glowing orange and gold, cherry petals and loose pages drifting in the morning breeze. On the balconies of the tower, the five girls from the reference image lean out and wave and laugh toward the camera, seen from a distance so their faces stay small. The camera slowly drifts upward and back, revealing the whole tower in the morning light. Joyful, warm, nostalgic. Anime illustration style matching the reference image, soft painterly lighting, slow smooth camera movement, 16:9. No text, no letters, no captions, no subtitles, no logos, no watermark.
```

### ending-3.mp4

```text
A sealed letter gently lands on a small round table on the rooftop of the owl tower from the reference image, bathed in bright morning light, with teacups and a few fallen cherry petals around it. Then a small round grey-green owl plush with a yellow beak, the same character as the reference image, lifts off from the rooftop and flies up into the wide, clear morning sky. The camera follows it upward, the tower falling away below, ending on the bright sky with soft clouds. Hopeful and serene. Anime illustration style matching the reference image, soft painterly lighting, slow smooth camera movement, 16:9. No text, no letters, no captions, no subtitles, no logos, no watermark.
```
