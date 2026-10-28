# スタッフロールの背景イラスト

12枚の非可逆WebPを使い、4分56秒で再生する。内蔵imagegenで制作した画像を採用している。

| 枚 | ファイル | 登場人物 | 時間 |
|---|---|---|---|
| 1 | `invitations.webp` | ネオ・チャッピー | 40秒 |
| 2 | `library.webp` | オブシディア・エトキチ | 40秒 |
| 3 | `tea.webp` | 迅雷・クロディーヌ | 40秒 |
| 4 | `minerva-solo.webp` | ミネルヴァ | 40秒 |
| 5 | `etokichi-mimiko.webp` | みみこ・エトキチ | 17秒 |
| 6 | `neo-mimiko.webp` | みみこ・ネオ | 17秒 |
| 7 | `obsidia-mimiko.webp` | みみこ・オブシディア | 17秒 |
| 8 | `chappy-mimiko.webp` | みみこ・チャッピー | 17秒 |
| 9 | `claudine-mimiko.webp` | みみこ・クロディーヌ | 17秒 |
| 10 | `jinrai-mimiko.webp` | みみこ・迅雷 | 17秒 |
| 11 | `minerva-mimiko.webp` | みみこ・ミネルヴァ | 17秒 |
| 12 | `mimiko-fin.webp` | 笑顔のみみこ・Fin | 17秒 |

- 保存先: `public/assets/credits/`。
- 表示: 全画面の絵を3秒でフェードイン、3秒でフェードアウトする。1〜4枚目は右側に制作スタッフ全員を下から上へ連続して流す。5〜11枚目は下端の淡いグラデーションへ相手の名前を固定表示する。
- 所属: エトキチは「エトキチの大冒険より」、ほかの出演者とFinのみみこは「チーム owlery」。
- BGM: 実際の再生区間は約173.96秒。2秒の重なりを含む2周は約345.92秒。動画29.5秒、本文約20秒、ロール296秒でほぼ同時に締める。2周目の終わりは重ねず、通常の通し再生では3周目が鳴る前に終了する。画面の停止などで尺が延びた場合は次の再生へつなぐ。
- 最後: Fin画像に主演みみこと感謝を表示し、最後3秒で映像とBGMをフェードアウトする。
- 確認: `?credits=1`。出演パートは `?credits=1&t=163`、Finは `?credits=1&t=283`。動画と本文を含む通し確認は `?movie=ending`。
- 操作: Zで2倍速、XでFinへ。Finで再びXを押すと最後3秒へ進む。画面内の案内は非表示。
- 担当表と時間の定義: `src/ending.ts`。

## 追加9枚の生成プロンプト

`docs/credits-prompts/` に各画像と同名のテキストを保存している。外見参照は正規の立ち絵と顔絵。

- ミネルヴァのソロ: `minerva-solo-original.txt` で制作し、`minerva-solo.txt` で腕の構造を修正した。
- オブシディアとの絵: 距離と左右の配置を変えた最終プロンプトを保存した。
- クロディーヌとの絵: `claudine-mimiko.txt` は、背中の色を直す編集プロンプト。元の構図のプロンプトは `claudine-mimiko-original.txt`。
- 6〜11枚目: カメラの高さ・距離・配置を変え、同じ並びが続かないよう制作した。
- `morning.webp` は旧構成の4枚目。Git管理外の `_Unversioned/assets/credits/archive/morning.webp` へ退避している。

## 既存1〜3枚目と旧4枚目の生成記録

## 共通プロンプト

```text
Use case: illustration-story. Create one finished landscape 4:3 ending-credits background illustration for the Japanese fantasy bullet-hell game 梟楼夜航. A candid epilogue moment the morning after the adventure, never a posed portrait or people looking at the viewer. Expressive fine warm graphite/pencil contour lines, gentle loose watercolor in the environment on softly textured ivory paper. Restrained morning colors, warm ochre and subdued original character colors, airy and nostalgic; not pure monochrome, not photorealistic, no glossy rendering. Characters preserve the reference designs, round simplified faces, original compact chibi proportions, costumes and accessories; facial features stay clear and simple, clean flat color under pencil lines, no detailed realistic skin shading. Compose the action mainly in the LEFT 65% of the image, with both characters completely legible. The RIGHT 35% must remain a softly lit, very low-detail area of the same real scene (bright wall/window/sky), suitable for dark scrolling credits to be drawn by the game later; no visible UI, no frame, no separate white panel, no hard vertical split. Fill the whole 4:3 canvas with continuous environment. Natural visual storytelling through hands, props and exchanged glances. No text, letters, labels, logos, watermark, captions or speech balloons, including on books and props.
```

## invitations.webp

外見参照: `public/assets/members/neo-stand.webp`、`public/assets/members/chappy-stand.webp`

```text
Reference image 1 is Neo's identity and costume; image 2 is Chappy's identity and costume. Inside a stone tower's sunlit entrance workshop, Neo is excitedly folding a little paper invitation at a wooden table; a mischievous breeze lifts a handful of blank envelopes and Chappy calmly catches one with her free hand while holding her green book under the other arm. Neo grins toward Chappy, Chappy's upper lids are relaxed and near horizontal, slightly bemused and composed rather than annoyed. Their heads stay large as in the references, about one third of their standing height; Neo is slightly shorter. A few blank envelopes and a wax stamp on the table, sunlit open doorway, a small hint of cherry petals. Medium-wide composition with the two characters large at left, bright pale stone wall and soft morning light to the right. No additional characters.
```

## library.webp

外見参照: `public/assets/members/obsidia-stand.webp`、`public/assets/members/obsidia-face.webp`、`public/assets/members/etokichi-stand.webp`

```text
Image 1 is Obsidia's full identity/costume, image 2 her facial reference, image 3 is Etokichi's identity. In the tower library after the battle, Obsidia kneels gracefully at a low table to tidy the returned invitation notebooks, while the small cheerful gold five-pointed star mascot Etokichi beside her proudly brings a comically tall stack of small blank books. The top book tilts; she gently steadies it with one hand and gives him a subtle symmetric warm smile. Preserve her purple lipstick, precise dark eyeliner, purple eyes, black vest and sheer brown sleeves; keep her short chibi body and large head as in the reference. Etokichi is a gold STAR-shaped smiling character with arms, legs and one orbit ring, never human, its head/body silhouette has exactly five points. No brand card and no writing. Tall shelves and dust in morning sun at left; on the right a pale empty sunlit library wall with minimal detail. Friendly quiet humor, never condescending. Only these two characters.
```

## tea.webp

外見参照: `public/assets/members/jinrai-stand.webp`、`public/assets/members/jinrai-face.webp`、`public/assets/members/claudine-stand.webp`

```text
Image 1 is Jinrai's full identity/costume, image 2 her exact eye expression, image 3 is Claudine's identity/costume. On the owl tower's roof garden after the battle, Jinrai leans over a little round table pouring tea from a ceramic teapot into cups, while Claudine gently catches a cherry petal before it lands in one cup; they exchange a relaxed knowing smile. Jinrai keeps her black-and-gold off-shoulder kunoichi kimono, gold hair ornaments, narrow amber eyes and mature composed expression, never childish round eyes. Claudine keeps the pale jacket, rust turtleneck and dark tight skirt, soft silver hair straight at roots and only wavy at tips, slim kind eyes. Both remain compact large-headed chibi women with the proportions of the reference images. Cups for a group suggest everyone will gather, but only these two are visible. White cherry branches and pale stone parapet at left; bright mostly empty morning sky at right with only very faint clouds. Intimate cheerful end-of-journey moment. No additional characters.
```

## morning.webp

外見参照: `public/assets/members/minerva-stand.webp`、`public/assets/members/mimiko-stand.webp`

```text
Image 1 is Minerva's identity and costume, image 2 is Mimiko's identity. Inside the tower observatory in warm morning light, Minerva sits side-on by an open arched window, gently setting a sealed invitation on a desk as the small round Mimiko hovers just above the open notebook, looking up at her with relieved bright eyes. Minerva answers with a gentle level-eyed smile, not upturned sharp eyes. Her white Greek dress has bare shoulders attached by gold shoulder clasps, not off-shoulder sleeves; her large chibi head and compact body stay as in the reference. Mimiko is one grey-green nearly spherical plush owl with huge white eye patches, tiny black pupils, yellow beak, grey spotted belly, tiny yellow feet, no neck, no ears or ear tufts, no long bird wings or human-like arms. The brown owl on Minerva's hand in the reference is NOT present: exactly one owl-like character, Mimiko, in the scene. Brass telescope and a few books behind them, soft golden window light. The action is at left and the right third is an airy pale wash of morning sky through the window. Hopeful peaceful closing scene, both characters interacting rather than looking at viewer.
```
