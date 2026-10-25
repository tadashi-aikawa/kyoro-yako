// 本文は1行3秒、最後の行を読み切る時間を4秒取り、入力待ちを挟まない。
export const ENDING_LINE_GAP = 180;
export const ENDING_LINE_FADE = 60;
export const ENDING_READ_FRAMES = 240;
export const ENDING_EXIT_FRAMES = 60;

export const CREDITS_ART = ['invitations', 'library', 'tea', 'morning'] as const;
export const CREDITS_SCENE_FRAMES = 720;
export const CREDITS_CROSSFADE_FRAMES = 90;
export const CREDITS_ROLL_FRAMES = CREDITS_ART.length * CREDITS_SCENE_FRAMES;
export const CREDITS_HOLD_FRAMES = 180;
