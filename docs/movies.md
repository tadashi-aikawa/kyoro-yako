# ムービーの生成手順(Geminiアプリの動画生成)

Geminiアプリで動画を生成し、MP4で保存する。1本は最長10秒。

エンディングの原本3本は `_Unversioned/assets/movies/` に保存する。このフォルダはGit管理外で、配信対象にも含めない。

`sh scripts/build-ending.sh` で原本3本から通し用の `public/assets/movies/ending.mp4` を作る。別の保存先を使う場合は `sh scripts/build-ending.sh <原本ディレクトリ>` と指定する。

- 室内→塔: 1.5秒の白フェード
- 塔→屋上: 1秒の白フェード
- 冒頭: 0.75秒のフェードイン
- 終わり: 最後の空を2秒延長する。飛び去ったあとの余韻を残してから1.5秒かけて暗転し、エンディング本文へつなぐ
- 再生: 約29.5秒。動画音声は使わず、ゲームのエンディングBGMを流す
- 確認: `?movie=ending` で通し再生する。原本単体は保存先のMP4を動画プレイヤーで確認する

## 生成の設定

1. gemini.google.com を開き、入力欄の「ツール」から「動画を作成」を選ぶ
2. 横長(16:9)にする
3. 表の参照画像をアップロードし、プロンプトを貼って生成する
4. 顔や構図が崩れた版は捨てて作り直す。文字・字幕・ロゴが入った版も捨てる
    - みみこは立ち絵の絵柄に忠実な版だけ採る。本物のぬいぐるみの写真風・3D風・別の造形は捨てる
    - 教訓: 「PLUSH TOY」「felt」のような素材の言葉を書くと、ぬいぐるみの実写風に寄る。「参照画像とまったく同じ2Dアニメ絵・同じセル塗り」と書き、素材の言葉は使わない
    - 教訓: みみこを正面向きで描かせると案内役のように見える。後ろ姿か横向きで、カメラの方を向かない指定にする
        - 例外: ending-2はキービジュアルの正面寄りの向きを保つ。途中でカメラへ振り向かせない
    - 教訓: ending-2は冒頭から構図が組み直され、後ろ姿で始まったあと、背中に顔だけが現れる版が出た。最初のフレームから両目・くちばし・腹が見える正面寄りの向きと明記し、丸い全身を一体のまま移動させる
    - 教訓: 「calm」「composed」「floats」のような静かな言葉を戦闘場面に書くとキャラが棒立ちになる。戦闘は「darts」「teleports」「whipping」「motion blur」のような動きの言葉と、表情の変化(fierce→surprise→smile)を書く
    - 教訓: みみこの顔は「顔のほぼ全部が2つの大きな丸い白い目、その間に小さな黄色いくちばし」まで書く。「big white eyes」だけでは本物の梟の顔になる
    - 教訓: ミネルヴァの立ち絵の梟とみみこを同じ場面に出すと混ざる。みみこが出る場面ではミネルヴァの梟を「この場面にはいない。無視する」と明記し、梟は1体だけと書く
5. 保存したMP4を `public/assets/movies/` に、表のファイル名で置く
    - エンディング原本の例外: `ending-1.mp4`・`ending-2.mp4`・`ending-3.mp4` は `_Unversioned/assets/movies/` に置き、通し用動画を作る

- 動画の音を使うかは `src/movies.ts` の `MOVIE_SETTINGS` で1本ずつ指定する
    - 音ありの動画はBGMをクロスフェードで止め、動画の音を使う。音量はOptionのBGM音量に従う
    - 音なしの動画は無音にし、場面に合わせたBGMを流す
    - lastbossは無音で再生する。道中終了の白フェード開始から約1秒かけてstage-dawnを通常の35%へ下げ、動画・動画後の白フェード・白保持中も流し続ける
        - 動画終了・スキップ・失敗後は150フレームで白へ溶かし、白いっぱいの画面を60フレーム保つ。映像が無い場合は白を保ったまま同じ時計を進める
        - ミネルヴァの登場開始から120フレームで白を明け、同時にboss-minervaへ約1秒でクロスフェードする
        - boss-minervaは白保持中に先読み・デコードする
    - 動画の終了・スキップ・再生失敗後は次の場面のBGMへ切り替える
        - 例外: lastbossは白保持が終わり、登場が始まるまで下げた道中曲を保つ
    - 音あり動画の再生がautoplay制限で拒否された場合は、無音にして1回だけ再試行する
        - openingではstage-gateを流す
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
| 2 | `lastboss.mp4` | なし。白フェード・動画・白保持中は道中曲を通常の35%で継続。登場開始でボス曲へクロスフェード | 5面の道中が終わり、ミネルヴァの会話の前 | みみこ、ミネルヴァの立ち絵(キービジュアルは渡さない) |
| 6 | `jinrai-gift.mp4` | なし。白演出・動画中はボス曲を35%で継続 | 4面の最終撃破から白へ90f → 動画の白明け90f → 終了後の白フェード150f・保持60f → 対峙の白明け120f → 会話 → 餞別 → 退場60f。迅雷一閃の最後の攻防でみみこがとどめを刺す | 迅雷の立ち絵、みみこの立ち絵(みみこの形が崩れた版は捨てる) |
| 7 | `minerva-finale.mp4` | なし。白演出・動画中はボス曲を35%で継続 | 5面の最終撃破から白へ90f → 動画の白明け90f → 終了後の白フェード150f・保持60f → 対峙の白明け120f → 会話 → 退場60f。最終技の最後の攻防でみみこがとどめを刺す | ミネルヴァの立ち絵、みみこの立ち絵(造形が崩れた版は捨てる) |
| 8 | `ending.mp4` | なし | 5面クリア後、原本3本を白フェードでつないだ29.5秒の動画 | 原本3本から編集 |

以下の原本は `_Unversioned/assets/movies/` に保存する。

| 原本 | 内容 | 参照画像 |
|---|---|---|
| `ending-1.mp4` | エンディングの1本目 | みみこ |
| `ending-2.mp4` | キービジュアルをそのまま朝にして動かす | キービジュアルだけ。5人の顔が変わる、寄る、みみこが背を向ける、顔だけ回る版は不採用 |
| `ending-3.mp4` | エンディングの3本目 | キービジュアル、みみこ |

## 共通の指定

各プロンプトの末尾に、次の一文を付けている。

> Anime illustration style matching the reference image, soft painterly lighting, slow smooth camera movement, 16:9. No text, no letters, no captions, no subtitles, no logos, no watermark.

## プロンプト

### opening.mp4

```text
Night scene in front of a huge, ancient stone gate with carved owl ornaments and two warm lanterns, at the foot of an enormous tower. Low camera angle looking slightly upward: the gate fills the frame, the tower wall rises out of the top of the frame into the dark starry sky, and its top is never visible. Deep starry night, cherry petals drifting, ivy on the stone. A single sealed letter flutters in the wind and slips through the slowly opening gate. Mimiko, the character from the reference image, follows it. Draw Mimiko exactly as in the reference image: the same 2D anime illustration, the same design, colors and proportions, the same clean flat cel shading. Mimiko is a small round grey-green owl with big white eyes, a small yellow beak, short wings and a spotted light-grey belly. Do not reinterpret the design, do not render it as a photographic stuffed toy or a 3D render, do not change the proportions. Mimiko is seen mostly from behind and from the side, flying away from the camera after the letter, never turning to face the camera. It passes through the gate into the dim, lantern-lit ground floor hall of the tower. The camera slowly pushes forward toward the gate. No people, no other characters. 2D anime illustration style matching the reference image, soft painterly background, slow smooth camera movement, 16:9. No text, no letters, no captions, no subtitles, no logos, no watermark.
```

### lastboss.mp4

```text
A colossal double door slowly swings open to reveal a vast, cathedral-sized observatory at the top of an ancient owl tower: an enormous domed hall hundreds of meters across, the dome painted with constellations, a gigantic brass telescope rising many stories high in the center, star charts inlaid in the stone floor, towering pillars, and at the far end a huge arched window where the night sky is just beginning to pale into crimson and platinum before dawn. Floating dust and faint golden sparkles drift in the cold air. It is a place for a final battle, grand, solemn and intimidating. Mimiko, the character from the first reference image, slowly flies in through the door, hovering and gliding low in the air with gentle wing flaps, and stops just inside, tiny against the vast space, seen from behind. Mimiko never walks and never touches the floor. Draw Mimiko exactly as in the reference image: the same 2D anime illustration, the same design, colors and proportions, the same clean flat cel shading. Mimiko is a perfectly round ball-shaped owl, a sphere with no neck and no body below the head, grey-green, with big white eyes, a small yellow beak, two short stubby wings on the sides and a spotted light-grey belly. Mimiko has NO ear tufts, no feather horns and no pointed ears: the top of the head is smooth and round. Do not reinterpret the design, do not render it as a photographic stuffed toy or a 3D render. Mimiko never turns to face the camera and never approaches the far end. Far away, at the top of a long flight of stairs before the giant window, stands Minerva, the character from the second reference image, facing the camera, standing still and composed, reigning over the hall like a goddess. Her pose and costume follow the reference image exactly: very long wavy hair flowing down past her waist, a white flower ornament on the right side of her head, a long sleeveless Greek-style dress with a gold key-pattern hem and a gold belt, a long drape hanging from her left shoulder, a thick book held in her LEFT hand at her side, and a barn owl perched on her RIGHT hand, which is raised in front of her (because she faces the camera, the owl appears on the viewer's LEFT side of her body). She is strongly backlit by the dawn sky behind her, so she is rendered as a near-black silhouette: only her outline, the shape of her hair, the dress and the owl are readable against the light, with a thin rim light on the edges. No face, no eyes, no fabric details, no colors inside the silhouette. She stays small and distant. The camera slowly pushes forward through the door, rises slightly, and the final shot holds wide on the enormous hall with tiny Mimiko near the door in the foreground and the distant backlit figure at the window. No other characters. 2D anime illustration style matching the reference image, epic painterly background, slow smooth camera movement, 16:9. No text, no letters, no captions, no subtitles, no logos, no watermark.
```

### jinrai-gift.mp4

```text
The final clash of a high-speed duel in a moonlit Japanese garden at night, cherry petals torn through the air. Character A, from the first reference image: a beautiful, mature kunoichi with long black hair streaked with gold, gold hairpins and flowers, a black-and-gold off-shoulder kimono, crackling with golden lightning. Character B, from the second reference image: a small, perfectly round, chubby owl PLUSH TOY, grey-green felt body, two large flat white disc eyes with black pupils, a tiny yellow beak, stubby wings, a spotted grey belly. It must stay exactly this toy-like round shape in every frame: never a realistic owl, never a bird with feathers or a long body, never a stylized mascot with different proportions. The two blur past each other in rapid lightning-fast exchanges, A dashing with lightning trails, B darting and dodging as a round ball. Then time slows: B dives straight in and lands the decisive blow, a bright flash of light at the impact. A is struck and falls back gracefully, her hair fanning out; the final shot is a slow close-up of A lying defeated among the petals, one hand at her chest, with a sultry, amused half-smile and half-lidded eyes, as if saying she has been beaten and rather enjoyed it. B hovers above her, round and small. Stylish, intense, then sensual and calm. Anime illustration style matching the reference images, dramatic lighting with lightning flashes, dynamic then slow camera movement, 16:9. No text, no letters, no captions, no subtitles, no logos, no watermark.
```

### minerva-finale.mp4

```text
The final clash of the last battle inside a vast, cathedral-sized observatory at dawn: a dome painted with constellations, a gigantic brass telescope, star charts inlaid in the floor, and a huge arched window glowing crimson and gold. Character A, from the first reference image, drawn exactly as in that image with the same 2D anime illustration, design, colors and proportions: Minerva, a graceful goddess-like woman with very long wavy brown hair, a white flower ornament on the right side of her head, a long sleeveless white Greek-style dress with gold key-pattern trim and a gold belt, gold armlets, a thick book in her left hand, her right hand empty and free. IMPORTANT: the small brown barn owl that sits on her hand in the reference image is NOT in this scene at all; ignore it completely. There is exactly ONE owl-like character in the whole video, Mimiko, who is grey-green and round and looks nothing like a brown barn owl. This is the climax of a furious high-speed battle, not a calm scene: Minerva is fighting at full power. She darts and teleports across the hall in bursts of golden light, sweeping her free arm to hurl spiraling waves of glowing star-bullets and constellation lines, her long hair and dress whipping violently with each motion, her expression sharp, focused and fierce, eyes wide and intense. Character B, from the second reference image, drawn exactly as in that image: Mimiko, a perfectly round ball-shaped owl, a sphere with no neck and no body below the head, grey-green, with a face that is almost entirely two huge round flat white eyes with small black pupils and a tiny yellow beak between them, two short stubby wings and a spotted light-grey belly, NO ear tufts, smooth round head; the face must look exactly like the reference, never a realistic owl face, never a photographic stuffed toy, never a 3D render. Mimiko streaks through the storm of stars at high speed, dodging in sharp zigzags with motion blur, the camera whipping to follow. The two cross each other in rapid exchanges. Then time slows: Mimiko dives straight in and lands the decisive blow, a brilliant flash of white-gold light at the impact, the star vortex shattering into drifting sparks. Minerva's fierce expression breaks into wide-eyed surprise as she is thrown back through the air, her hair and dress flowing, the book slipping from her hand. She sinks softly down and comes to rest lying among the falling sparks. From here there is NO cut and NO change of scene: in one continuous shot the camera slowly pushes in on her face as she lies there, closer and closer until her mouth and eyes fill the frame, and over those seconds her surprise melts into a serene, knowing smile with half-closed eyes, as if she has found the answer she was looking for and is glad to be proven wrong. The video ends on that slow close-up of her smile. Mimiko hovers above her, round, grey-green and small, visible only before the camera closes in. Mimiko must stay grey-green with huge white eyes in every shot and must never turn brown or into a barn owl. Fast, intense and dramatic for the first two thirds, then quiet and tender. 2D anime illustration style matching the reference images, dramatic dawn lighting with golden flashes, dynamic then slow camera movement, 16:9. No text, no letters, no captions, no subtitles, no logos, no watermark.
```

### ending-1.mp4

```text
Morning sunlight slowly fills a vast, cathedral-sized observatory at the top of an ancient tower, pouring through a huge arched window over a gigantic brass telescope, star charts inlaid in the stone floor and a dome painted with constellations. Mimiko, the character from the reference image, hovers low in the air beside a small wooden desk in a warm sunbeam, seen from the side in a three-quarter view, never looking straight at the camera. Draw Mimiko exactly as in the reference image: the same 2D anime illustration, the same design, colors and proportions, the same clean flat cel shading. Mimiko is a perfectly round ball-shaped owl, a sphere with no neck and no body below the head, grey-green, with big white eyes, a small yellow beak, two short stubby wings on the sides and a spotted light-grey belly. Mimiko has NO ear tufts, no feather horns and no pointed ears: the top of the head is smooth and round. Do not reinterpret the design, do not render it as a photographic stuffed toy or a 3D render. With its two stubby wings Mimiko gently closes a small open notebook lying on the desk, then slowly turns its head up toward the light, calm and content. Dust motes glow in the sunbeam, the dawn sky outside turns gold. Calm, warm, peaceful, very slow. No other characters. 2D anime illustration style matching the reference image, soft painterly background, slow smooth camera movement, 16:9. No text, no letters, no captions, no subtitles, no logos, no watermark.
```

### ending-2.mp4

```text
Animate the reference image as it is: a wide exterior shot of the tall stone owl tower with its lit balconies, already at sunrise from the very first frame, the sky glowing orange and gold, cherry petals and loose pages drifting in the morning breeze. From the very first frame, Mimiko, the round grey-green owl in front of the tower, faces the viewer almost straight on, turned only slightly to the viewer's right, with both eyes, its beak and its spotted belly fully visible. It keeps this same orientation throughout the entire shot. Mimiko is a single perfectly round ball with no neck and no separate body below the head, a smooth round head with NO ear tufts or pointed ears, a face almost entirely made up of two huge round flat white eyes with small black pupils, a tiny yellow beak between them, short stubby wings and a spotted light-grey belly. Keep the reference design, colors, proportions and 2D illustration style. Its eyes, beak and belly stay fixed on the same front surface as it slowly floats straight upward past the balconies as one intact round shape, with only gentle flaps of its short wings. Mimiko does not turn or rotate. Keep the composition, the tower, the balconies and the five characters exactly where and how they are in the reference image: same faces, same hairstyles and hair colors, same outfits, same poses as the starting point. Each of the five simply looks up toward the brightening sky and smiles, with small natural movements: hair and clothes swaying in the breeze, one of them raising a hand slightly. They stay on their balconies at the same distance from the camera; their faces stay small, no close-ups, no one turns into a different character, no new characters appear. In one continuous shot, the camera slowly pulls straight back without orbiting, revealing the whole tower in the morning light. Joyful, warm, nostalgic, very gentle motion. 2D anime illustration style identical to the reference image, soft painterly lighting, slow smooth camera movement, 16:9. No text, no letters, no captions, no subtitles, no logos, no watermark.
```

### ending-3.mp4

差し替え用の新案は「屋上でみんなと合流する」。1・2本目は維持する。現行の3本目と通し用動画は、新しい生成結果を確認するまで差し替えない。

生成時に添付する画像は、次の順番の5枚。

| 順番 | パス | 役割 |
|---|---|---|
| 1 | `public/assets/title/key-visual.webp` | 塔の外観と、上からミネルヴァ・迅雷・クロディーヌ・オブシディア・ネオの外見。夜の色とバルコニーの配置は引き継がない |
| 2 | `public/assets/members/mimiko-stand.webp` | みみこの造形と配色。キービジュアルの羽や耳のような輪郭を引き継がない |
| 3 | `public/assets/members/chappy-stand.webp` | チャッピーの外見 |
| 4 | `public/assets/members/etokichi-stand.webp` | エトキチの星形の造形。手に持つ文字入りカードは出さない |
| 5 | `public/assets/members/mimiko-face.webp` | みみこの顔 |

- 舞台: 塔の天文台に隣接する最上部の石のテラス。背後にドームと尖塔があり、低い石の欄干と花のつるが続く
- 0〜3秒: 仲間は手前の欄干沿いに浅い弧で並び、中央を空けて待つ。みみこが真下からその隙間へ上昇してくる
- 3〜7秒: みみこが正面寄りの向きのまま、仲間と並ぶ高さでふわっと止まる。奥へ移動せず、その場所で迎えられる
- 7〜10秒: カメラが少しだけ引き、全員と朝日に照らされた塔を見せる。遠くの街は背景に控えめに入れる

生成の採用基準:

- 仲間は人間6人と星形のエトキチ。みみこを合わせて8人が重ならず見える
- 2本目と同じ金色の朝。始まりは上昇中で、再離陸や途中の着地は挟まない
- みみこは丸い全身で一緒に動き、背中に顔が現れない。耳の房や長い翼を付けない
- ティーカップ・テーブル・手紙・文字は出さない。ミネルヴァの手の梟も出さない
- 最後は全員が同じ屋上に残る。生成段階では白フェード・暗転を焼き込まない

新しいMP4を受け取ったら、旧3本目をGit管理外で保持してから差し替える。集合場面が不自然に2秒静止しないよう、最後の延長を短くするか暗転を早めて編集する。屋上の約束が叶った絵で終え、本文1行目の「夜明けの天文台に、みんなの足音が集まった。」へつなぐ。

```text
Create one continuous 10-second, 16:9, 2D anime ending shot: Mimiko rises to the owl tower's upper observation terrace and joins the friends waiting there. This follows a shot of Mimiko already floating upward beside the tower at golden sunrise. Keep that upward movement. Keep the low sun to the left, behind the tower, with warm orange-gold backlight and soft rim light; never return to night. The terrace is beside the existing observatory dome and its slender slate spire, not on top of a pointed roof. Preserve the same grey stone, low carved stone parapet and flowering vines.

Reference 1 identifies the stone tower and five people on its balconies: from top to bottom, Minerva, Jinrai, Claudine, Obsidia and Neo. Preserve their individual faces, hair, outfits and proportions, but place all five together on the terrace, not on separate balconies. Reference 2 is Mimiko's body design, reference 3 is Chappy, reference 4 is Etokichi, and reference 5 is Mimiko's face. References 2 and 5 take priority over the owl silhouette in reference 1. Keep Chappy's short dark-green bob, long white dress and small green book distinct from Neo's bright green hair, goggles and green scarf, and from Minerva's long brown hair, white flower and Greek dress. Etokichi is a small smiling gold five-pointed star mascot, never a human; omit its card and all writing. Omit the brown owl on Minerva's hand: Mimiko is the only owl-like character. Exactly eight friends in total: six human characters, one star mascot and Mimiko. No copies or extra characters.

0-3 seconds: a wide view from outside the terrace, with the camera slightly above the top of the parapet, looking almost level. All seven friends are already visible, standing along the front parapet in a shallow arc with a clear gap in the middle. The dome and slate spire are behind them. Mimiko is already rising straight up from the lower foreground toward that central gap, both eyes, beak and spotted belly visible in a front three-quarter view. Nobody appears suddenly or climbs from a lower balcony.

3-7 seconds: Mimiko rises straight up into the gap, coming to a gentle hover just above the parapet beside the friends. It never moves away from the camera and never turns its back. The friends look toward Mimiko with small relieved smiles; Neo makes one small welcoming wave. Everyone else remains in place with only slight hair and clothing movement. No hugs, no handshakes, no running, no complicated group choreography. Mimiko's whole round body moves together, without a twisting head or a face appearing on its back.

7-10 seconds: the camera pulls back only slightly and rises a little, holding all eight together on the terrace. Faces stay readable; do not pull out to an extreme-wide tower shot. Show just a little of the distant morning town around the tower. The reunion remains clearly visible at the end. Mimiko stays with the group, never takes off again or flies away. Hold the final composition gently, with no cut or fade.

Mimiko stays a nearly spherical grey-green character with two huge white eye patches, small black pupils, a tiny yellow beak, a pale grey spotted belly, tiny feet and no neck. No pointed ears, ear tufts, long bird wings or human arms. Preserve the illustrated reference designs, never photorealistic toys or 3D characters. A few cherry petals move in the warm breeze. Hopeful, affectionate, unhurried. No table, teacups, teapot, letters, cards, food, text, captions, logos or watermark. No dialogue. Do not render a storyboard or split screen. One finished moving scene only.
```

#### 現行版の生成プロンプト

差し替え前の原本 `ending-3.mp4` は、次の指定で生成した。参照はキービジュアルとみみこの立ち絵の2枚。新案の生成には上記の5枚を使う。

```text
The rooftop of the tall stone owl tower from the first reference image, bathed in bright morning light, with a small round table, teacups and a few fallen cherry petals. A sealed letter gently lands on the table. Then Mimiko, the character from the second reference image, lifts off from the rooftop, seen from behind and below, and flies up into the wide, clear morning sky. Draw Mimiko exactly as in the second reference image: the same 2D anime illustration, the same design, colors and proportions, the same clean flat cel shading. Mimiko is a perfectly round ball-shaped owl, a sphere with no neck and no body below the head, grey-green, with big white eyes, a small yellow beak, two short stubby wings on the sides and a spotted light-grey belly. Mimiko has NO ear tufts, no feather horns and no pointed ears: the top of the head is smooth and round. Do not reinterpret the design, do not render it as a photographic stuffed toy, a real bird or a 3D render. Mimiko never turns to face the camera. The camera follows it upward, the tower falling away below, ending on the bright morning sky with soft clouds. No people, no other characters. Hopeful and serene. 2D anime illustration style matching the reference images, soft painterly lighting, slow smooth camera movement, 16:9. No text, no letters, no captions, no subtitles, no logos, no watermark.
```
