// 本文は1行3秒、最後の行を読み切る時間を4秒取り、入力待ちを挟まない。
export const ENDING_LINE_GAP = 180;
export const ENDING_LINE_FADE = 60;
export const ENDING_READ_FRAMES = 240;
export const ENDING_EXIT_FRAMES = 60;

export const CREDITS_SCENES = [
  {
    "art": "invitations",
    "seconds": 40
  },
  {
    "art": "library",
    "seconds": 40
  },
  {
    "art": "tea",
    "seconds": 40
  },
  {
    "art": "minerva-solo",
    "seconds": 40
  },
  {
    "art": "etokichi-mimiko",
    "seconds": 17,
    "cast": "エトキチ"
  },
  {
    "art": "neo-mimiko",
    "seconds": 17,
    "cast": "ネオ"
  },
  {
    "art": "obsidia-mimiko",
    "seconds": 17,
    "cast": "オブシディア"
  },
  {
    "art": "chappy-mimiko",
    "seconds": 17,
    "cast": "チャッピー"
  },
  {
    "art": "claudine-mimiko",
    "seconds": 17,
    "cast": "クロディーヌ"
  },
  {
    "art": "jinrai-mimiko",
    "seconds": 17,
    "cast": "迅雷"
  },
  {
    "art": "minerva-mimiko",
    "seconds": 17,
    "cast": "ミネルヴァ"
  },
  {
    "art": "mimiko-fin",
    "seconds": 17
  }
] as const;
export const CREDITS_ART = CREDITS_SCENES.map(scene => scene.art);
export const CREDITS_STAFF = [
  {
    "role": "企画・原案",
    "name": "タダシ"
  },
  {
    "role": "ディレクション・監修",
    "name": "タダシ"
  },
  {
    "role": "ゲームデザイン",
    "name": "タダシ・チャッピー・迅雷"
  },
  {
    "role": "プログラム",
    "name": "チャッピー"
  },
  {
    "role": "弾幕・ボス戦制作",
    "name": "タダシ・チャッピー・迅雷"
  },
  {
    "role": "ゲームバランス調整",
    "name": "タダシ"
  },
  {
    "role": "シナリオ・台詞",
    "name": "タダシ・チャッピー・迅雷"
  },
  {
    "role": "UIデザイン・実装",
    "name": "チャッピー"
  },
  {
    "role": "デザイン相談",
    "name": "クロディーヌ"
  },
  {
    "role": "キャラクター原案・原画",
    "name": "タダシ"
  },
  {
    "role": "ゲーム用画像・モーション",
    "name": "チャッピー"
  },
  {
    "role": "動画プロンプト・編集・組み込み",
    "name": "チャッピー"
  },
  {
    "role": "ムービー生成",
    "name": "タダシ"
  },
  {
    "role": "BGMプロンプト",
    "name": "チャッピー"
  },
  {
    "role": "BGM生成",
    "name": "タダシ"
  },
  {
    "role": "効果音・サウンド調整",
    "name": "タダシ・チャッピー"
  },
  {
    "role": "テスト・動作確認",
    "name": "タダシ・チャッピー・迅雷"
  },
  {
    "role": "背景・ステージ美術",
    "name": "チャッピー"
  },
  {
    "role": "道中・ステージ構成",
    "name": "チャッピー"
  }
] as const;
// 動画29.5秒＋本文約20秒＋ロール296秒で、実際のBGM区間2周の約346秒に合わせる。
export const ENDING_MUSIC_PLAYS = 2;
export const CREDITS_CROSSFADE_FRAMES = 360;
export const CREDITS_STAFF_FRAMES = CREDITS_SCENES.slice(0, 4).reduce((frames, scene) => frames + scene.seconds * 60, 0);
export const CREDITS_ROLL_FRAMES = CREDITS_SCENES.reduce((frames, scene) => frames + scene.seconds * 60, 0);
export const CREDITS_FIN_FRAME = CREDITS_ROLL_FRAMES - CREDITS_SCENES[CREDITS_SCENES.length - 1].seconds * 60;
export const CREDITS_FADE_FRAMES = 180;
export function creditsScene(frame: number) {
  let start = 0;
  for (let index = 0; index < CREDITS_SCENES.length; index++) {
    const scene = CREDITS_SCENES[index], frames = scene.seconds * 60;
    if (frame < start + frames || index === CREDITS_SCENES.length - 1) {
      const local = Math.max(0, frame - start);
      const halfFade = CREDITS_CROSSFADE_FRAMES / 2;
      const fade = Math.max(0, Math.min(1, local / halfFade, index === CREDITS_SCENES.length - 1 ? 1 : (frames - local) / halfFade));
      const alpha = fade * fade * (3 - 2 * fade);
      return { scene, index, local, progress: Math.min(1, local / frames), alpha };
    }
    start += frames;
  }
  throw new Error('スタッフロールの構成が空です');
}
export function creditsFade(frame: number): number { return Math.max(0, Math.min(1, (frame - CREDITS_ROLL_FRAMES + CREDITS_FADE_FRAMES) / CREDITS_FADE_FRAMES)); }
