import { type BossPose, IDLE_STEP } from '../boss-motion';
import type { Reprise } from './minerva-reprise';

export const OWL_RELEASE_START = 105;
export const OWL_RELEASE_FRAMES = 120;
export const MINERVA_SOLO_SPRITES = ['base', 'idle', 'left', 'right', 'cast', 'prayer'].map(pose => `minerva-solo-${pose}`);
export const MINERVA_OWL_SPRITES = [0, 1, 2].map(frame => `minerva-owl-${frame}`);

export function minervaSoloSprite(pose: BossPose | 'prayer', frame: number): string {
  return `minerva-solo-${pose === 'idle' && Math.floor(frame / IDLE_STEP) % 2 === 0 ? 'base' : pose}`;
}

// 初回だけ離陸を待つ。再演の切替では頭上のフクロウがそのまま次の霊を呼ぶ。
export function reprisePrepare(reprise: Reprise): number { return reprise.cycle === 0 ? OWL_RELEASE_FRAMES + 60 : 60; }

export function summonOwl(frame: number, x: number, y: number): { x: number; y: number; progress: number; sprite: string } {
  const progress = Math.max(0, Math.min(1, (frame - OWL_RELEASE_START) / OWL_RELEASE_FRAMES));
  const ease = progress * progress * (3 - 2 * progress);
  return {
    x: x - 16 * (1 - ease),
    // 再演の上向き移動でも、羽がHPとボス名の帯を覆わない位置に留める。
    y: Math.max(43, y - 23 - 55 * ease + Math.sin(Math.max(0, frame - OWL_RELEASE_START) * 0.06) * ease * 1.5),
    progress,
    sprite: `minerva-owl-${[0, 1, 2, 1][Math.floor(frame / 9) % 4]}`,
  };
}
