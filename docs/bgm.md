# BGMの生成手順(Lyria 3.5)

GeminiアプリのLyria 3.5で12曲を生成し、MP3で保存する。

## 生成の設定

1. gemini.google.com を開く
2. 入力欄の「ツール」から「音楽を作成」を選ぶ
3. モデルを「Pro」にする
4. 長さは「フル(約2〜3分)」、ボーカルは「なし(インスト)」にする
5. 下のプロンプトを1曲ずつ貼って生成し、気に入った版をMP3で保存する
6. 保存したMP3を `public/assets/bgm/` に、表のファイル名で置く

- プロンプトは英語で書いている
    - 理由: ジャンルや楽器の指定は英語のほうが通りやすいため
- 実在の作曲者名・作品名は書かない
    - 指定: 梟楼の夜と各メンバーの性格を、楽器と曲調で表す
- ループの継ぎ目と音量はゲーム側で調整するので、曲の終わり方は気にしなくてよい
    - 先頭と末尾の無音は、読み込み時に自動で検出して除く

## 共通の指定

各プロンプトの末尾に、次の一文を付けている。

> Instrumental only, no vocals. Fast-paced Japanese bullet-hell shooting game music with a catchy, memorable melody, a bright synth trumpet and piano lead, a driving bass line and energetic drums.

## 曲リスト

| # | ファイル名 | 使う場面 | 曲の狙い |
|---|---|---|---|
| 1 | `title.mp3` | タイトル・メニュー | 夜の梟楼。静かな期待感 |
| 2 | `stage-gate.mp3` | 1面道中「梟楼の門」 | 冒険の始まり。軽快でわくわく |
| 3 | `boss-neo.mp3` | ネオ戦 | 元気でグイグイ来る。キーボードの打鍵感 |
| 4 | `stage-archive.mp3` | 2面道中「知識の書庫」 | 夜の書庫の神秘 |
| 5 | `boss-obsidia.mp3` | オブシディア戦 | 上品で冷ややかなお嬢様。ゴシック |
| 6 | `stage-sakura.mp3` | 4面道中「忍び寄る夜桜」 | 夜桜と和の気配 |
| 7 | `boss-jinrai.mp3` | 迅雷戦 | 花魁の色気と、くノ一の鋭さ・雷 |
| 8 | `stage-top.mp3` | 3面道中「梟楼の回廊」 | 夜明けへ駆け上がる高揚 |
| 9 | `boss-claudine.mp3` | クロディーヌ戦 | 洗練された美しさと壮大さ |
| 10 | `stage-dawn.mp3` | 5面道中「暁の天文台」 | 朝焼けの空。最終面の緊張と荘厳さ |
| 11 | `boss-minerva.mp3` | ミネルヴァ戦(ラスボス) | 知性と神秘。最後の検証 |
| 12 | `ending.mp3` | エンディング・スタッフロール | 朝の光。穏やかな余韻 |

## プロンプト

### title.mp3

```text
Title screen theme for a game set in a mysterious owl tower under a starry night sky. Calm but full of anticipation, starting with a delicate music box and piano melody, then strings and a soft synth pad join. Minor key, around 90 BPM, dreamy and slightly melancholic. Instrumental only, no vocals. Japanese bullet-hell shooting game music with a catchy, memorable melody.
```

### stage-gate.mp3

```text
Stage 1 theme, "Owlery Gate": the start of an adventure at the gate of a tall owl tower on a clear starry night, golden stars twinkling. Light, bouncy and exciting, playful glockenspiel and piano riffs, major key with a hint of mystery, around 145 BPM, the easiest and friendliest stage. Instrumental only, no vocals. Fast-paced Japanese bullet-hell shooting game music with a catchy, memorable melody, a bright synth trumpet and piano lead, a driving bass line and energetic drums.
```

### boss-neo.mp3

```text
Boss theme for a cheerful, energetic girl engineer with goggles who loves keyboards and never stops talking about them. Upbeat, pushy and fun, rapid mechanical-keyboard-like percussive clicks, chiptune arpeggios mixed with rock guitar, major key, around 170 BPM, bright and relentless. Instrumental only, no vocals. Fast-paced Japanese bullet-hell shooting game music with a catchy, memorable melody, a bright synth trumpet and piano lead, a driving bass line and energetic drums.
```

### stage-archive.mp3

```text
Stage 2 theme, "Vault of Links": flying through an endless magical library at night, glowing books and threads of light connecting them. Mysterious and curious mood, sparkling piano arpeggios and harpsichord, minor key, around 150 BPM. Instrumental only, no vocals. Fast-paced Japanese bullet-hell shooting game music with a catchy, memorable melody, a bright synth trumpet and piano lead, a driving bass line and energetic drums.
```

### boss-obsidia.mp3

```text
Boss theme for an elegant, aristocratic young lady who is a strict minimalist librarian. Gothic and refined, cold and sharp, pipe organ and violin lead over a relentless beat, dramatic minor key, around 160 BPM, grand and noble. Instrumental only, no vocals. Fast-paced Japanese bullet-hell shooting game music with a catchy, memorable melody, a bright synth trumpet and piano lead, a driving bass line and energetic drums.
```

### stage-sakura.mp3

```text
Stage 3 theme, "Night of the Thunder": a moonlit Japanese garden with cherry blossoms falling at night, something lurking in the shadows. Koto and shakuhachi melodies blended with modern synths, pentatonic minor, around 155 BPM, graceful yet tense. Instrumental only, no vocals. Fast-paced Japanese bullet-hell shooting game music with a catchy, memorable melody, a bright synth trumpet and piano lead, a driving bass line and energetic drums.
```

### boss-jinrai.mp3

```text
Boss theme for a seductive Kyoto courtesan who is secretly a lethal ninja wielding thunder. Starts alluring and playful, then turns fierce and cold. Shamisen and taiko drums with distorted electric guitar and thunder-like synth stabs, Japanese scale, around 175 BPM, intense and flashy. Instrumental only, no vocals. Fast-paced Japanese bullet-hell shooting game music with a catchy, memorable melody, a bright synth trumpet and piano lead, a driving bass line and energetic drums.
```

### stage-top.mp3

```text
Stage 4 theme, "Top of the Owlery": climbing the final floors of a tall owl tower as the night sky turns to dawn. Uplifting and soaring, golden brass and fast piano runs, modulating toward a major key, around 160 BPM, hopeful and determined. Instrumental only, no vocals. Fast-paced Japanese bullet-hell shooting game music with a catchy, memorable melody, a bright synth trumpet and piano lead, a driving bass line and energetic drums.
```

### boss-claudine.mp3

```text
Boss theme for a graceful, sophisticated designer who wants to tidy up the world beautifully. Elegant and beautiful but overwhelming, full orchestral strings, choir pads, piano and a heroic synth trumpet lead, dramatic key changes, around 170 BPM, a stylish and refined showdown just before the finale. Instrumental only, no vocals. Fast-paced Japanese bullet-hell shooting game music with a catchy, memorable melody, a bright synth trumpet and piano lead, a driving bass line and energetic drums.
```

### stage-dawn.mp3

```text
Final stage theme, "Owl of Minerva": flying through an ancient observatory at the very top of the owl tower as the sky burns crimson and platinum at daybreak. Majestic and tense, the last push before the final battle, soaring strings, bells and fast piano, minor key rising to heroic major, around 165 BPM. Instrumental only, no vocals. Fast-paced Japanese bullet-hell shooting game music with a catchy, memorable melody, a bright synth trumpet and piano lead, a driving bass line and energetic drums.
```

### boss-minerva.mp3

```text
Final boss theme for a wise, calm and curious scholar who is the owl goddess of wisdom, testing the hero's record of the night. Intellectual, mysterious and overwhelming, cathedral organ, harpsichord and full orchestra with a heroic synth trumpet lead, complex shifting rhythms, dramatic minor key, around 175 BPM, the true climax of the game. Instrumental only, no vocals. Fast-paced Japanese bullet-hell shooting game music with a catchy, memorable melody, a bright synth trumpet and piano lead, a driving bass line and energetic drums.
```

### ending.mp3

エンディングムービー(約30秒)・エンディングの文・スタッフロールの3段に合わせ、静かな導入からメロディが開いて余韻へ向かう構成を指定している。

```text
Ending theme for a Japanese bullet-hell shooting game, played over the ending movie, the epilogue text and the staff roll, after a long night spent climbing a tall owl tower. Structure: a quiet, gentle intro of about 30 seconds with solo piano and soft strings, like morning sunlight slowly filling an old observatory; then the main melody blooms, warm and nostalgic, with a bright synth trumpet and piano lead over lush strings and light drums, friends reunited at dawn; finally it settles into a calm, lingering outro. Major key, around 95 BPM, 2 to 3 minutes long. Instrumental only, no vocals. A catchy, memorable melody that echoes the heroic style of the stage themes.
```
