import type { BgmCue } from './bgm';

export type BossId = 'etokichi' | 'neo' | 'obsidia' | 'jinrai' | 'claudine' | 'chappy' | 'minerva';
export type PhaseKind = 'normal' | 'spell' | 'midboss' | 'survival';
export interface Phase { name: string; spell: boolean; duration: number; hp: number; pattern: string; kind: PhaseKind; }
export interface Stage { title: string; boss: BossId; mid: BossId; bgm: BgmCue; colors: [string, string, string]; phases: Phase[]; }

export const STAGE_DPS = [32.4, 48.6, 48.6, 64.8, 64.8] as const;
export const PHASE_SECONDS = { normal: 14, spell: 25, midboss: 18 } as const;
export const PHASE_LIMIT = { normal: 40, spell: 60, midboss: 45 } as const;
export function phaseHp(stage: number, kind: PhaseKind): number {
  return kind === 'survival' ? 1 : Math.round(STAGE_DPS[stage - 1] * PHASE_SECONDS[kind]);
}
function phase(stage: number, name: string, kind: PhaseKind, pattern: string, duration = kind === 'survival' ? 60 : PHASE_LIMIT[kind]): Phase {
  return { name, spell: kind !== 'normal', duration, hp: phaseHp(stage, kind), pattern, kind };
}
export const STAGES: Stage[] = [
  {
    title: '梟楼の門 〜 Owlery Gate', boss: 'neo', mid: 'etokichi', bgm: 'stage-gate', colors: ['#111d42', '#253c72', '#e8c974'],
    phases: [
      phase(1, '通常攻撃・はじめの一打', 'normal', 'neoTripleTap'),
      phase(1, '全画面キーバインド', 'spell', 'keyRain'),
      phase(1, '通常攻撃・ショートカット', 'normal', 'neoSyncopation'),
      phase(1, 'このキーボード、いいでしょ！', 'spell', 'keyInvite'),
      phase(1, '通常攻撃・次の設定', 'normal', 'neoTripleTap'),
      phase(1, 'dotfilesの沼', 'spell', 'dotfiles'),
      phase(1, 'Enterで一斉送信', 'spell', 'enter'),
    ],
  },
  {
    title: '知識の書庫 〜 Vault of Links', boss: 'obsidia', mid: 'obsidia', bgm: 'stage-archive', colors: ['#101436', '#413273', '#aa8add'],
    phases: [
      phase(2, '通常攻撃・書庫の巡回', 'normal', 'obsidiaShelves'),
      phase(2, '必要ないものは消す', 'spell', 'clean'),
      phase(2, '通常攻撃・索引の波', 'normal', 'obsidiaIndex'),
      phase(2, 'Wikiリンクの網', 'spell', 'link'),
      phase(2, '通常攻撃・書架の奥', 'normal', 'obsidiaShelves'),
      phase(2, 'タグの引力', 'spell', 'tags'),
      phase(2, 'ミニマリストの一掃', 'spell', 'sweep'),
    ],
  },
  {
    title: '梟楼の回廊 〜 Gallery of the Owlery', boss: 'claudine', mid: 'chappy', bgm: 'stage-top', colors: ['#3f3541', '#ac7a62', '#f9ddb0'],
    phases: [
      phase(3, '通常攻撃・整列', 'normal', 'claudinePetalArc'),
      phase(3, '削ぎ落とされた美', 'spell', 'trim'),
      phase(3, '通常攻撃・黄金比', 'normal', 'claudineQuietRings'),
      phase(3, 'タイポグラフィの雨', 'spell', 'type'),
      phase(3, '通常攻撃・最終調整', 'normal', 'claudinePetalArc'),
      phase(3, 'グリッドシステム', 'spell', 'grid'),
      phase(3, '通常攻撃・配色の準備', 'normal', 'claudineQuietRings'),
      phase(3, '補色の対比', 'spell', 'complement'),
      phase(3, 'ホワイトスペース', 'spell', 'whiteSpace'),
      phase(3, 'よろしければ、また', 'survival', 'final'),
    ],
  },
  {
    title: '忍び寄る夜桜 〜 Night of the Thunder', boss: 'jinrai', mid: 'jinrai', bgm: 'stage-sakura', colors: ['#101b40', '#5c325e', '#f3a5bd'],
    phases: [
      phase(4, '通常攻撃・忍び足', 'normal', 'jinraiRapidFan'),
      phase(4, '跳ね返る千本手裏剣', 'spell', 'jinraiBounce'),
      phase(4, '通常攻撃・夜風', 'normal', 'jinraiRapidRings'),
      phase(4, '夜桜の簪', 'spell', 'jinraiLaser'),
      phase(4, '通常攻撃・雷待ち', 'normal', 'jinraiRapidFan'),
      phase(4, '稲妻の予告線', 'spell', 'jinraiThunder'),
      phase(4, '通常攻撃・影走り', 'normal', 'jinraiRapidRings'),
      phase(4, '夜桜の舞', 'spell', 'jinraiSakura'),
      phase(4, '花吹雪', 'spell', 'jinraiPetal'),
      phase(4, '迅雷一閃', 'spell', 'jinraiDash'),
    ],
  },
  {
    title: '暁の天文台 〜 Owl of Minerva', boss: 'minerva', mid: 'neo', bgm: 'stage-dawn', colors: ['#642e4d', '#b86c67', '#ffe4ab'],
    phases: [
      phase(5, '通常攻撃・仮説の星図', 'normal', 'minervaStarFan'),
      phase(5, '七重の調査網', 'spell', 'sevenRings'),
      phase(5, '通常攻撃・観測の螺旋', 'normal', 'minervaStarRings'),
      phase(5, '矛盾を突く一手', 'spell', 'question'),
      phase(5, '通常攻撃・再検討', 'normal', 'minervaStarFan'),
      phase(5, '反証可能性', 'spell', 'hypothesis'),
      phase(5, '通常攻撃・観測の焦点', 'normal', 'minervaStarRings'),
      phase(5, '梟の目', 'spell', 'owlEye'),
      phase(5, '通常攻撃・引用の星列', 'normal', 'minervaStarFan'),
      phase(5, 'その結論、撤回します', 'spell', 'recall'),
      phase(5, '孫引きの連鎖', 'spell', 'citation'),
      phase(5, 'インタビューの間合い', 'spell', 'interview'),
      phase(5, '梟は暁に飛び立つ', 'survival', 'owlDawn'),
    ],
  },
];
export const MID_PHASE: Record<BossId, Phase> = {
  etokichi: phase(1, 'エトワールの輪', 'midboss', 'etoile'),
  neo: phase(5, '「最後」と言ってからが長い', 'midboss', 'neoEncore'),
  obsidia: phase(2, '書棚の呼吸', 'midboss', 'bookshelf'),
  jinrai: phase(4, '花影', 'midboss', 'jinraiClone'),
  chappy: phase(3, 'Codexへの丸投げ', 'midboss', 'codex'),
  claudine: phase(3, '整列', 'midboss', 'space'),
  minerva: phase(5, '予備の仮説', 'midboss', 'sevenRings'),
};
export const NAMES: Record<BossId, string> = {
  etokichi: 'エトキチ', neo: 'ネオ', obsidia: 'オブシディア', jinrai: '迅雷', claudine: 'クロディーヌ', chappy: 'チャッピー', minerva: 'ミネルヴァ',
};
