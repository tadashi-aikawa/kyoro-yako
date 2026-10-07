import { afterEach, describe, expect, it, vi } from 'vitest';
import { autoCollect, bulletContact, bulletSpeed, circlesHit, deathbomb, density, newExtends, pointValue, safeLoad, safeSave } from './rules';

describe('衝突とグレイズ', () => {
  it('当たり判定半径を使い境界を含める', () => {
    expect(circlesHit(0, 0, 2.5, 6.5, 0, 4)).toBe(true);
    expect(circlesHit(0, 0, 2.5, 6.6, 0, 4)).toBe(false);
    expect(bulletContact(0, 0, 6, 0, 4, false)).toBe('hit');
  });
  it('同じ弾では一度だけグレイズする', () => {
    expect(bulletContact(0, 0, 15, 0, 4, false)).toBe('graze');
    expect(bulletContact(0, 0, 15, 0, 4, true)).toBe('none');
  });
});

describe('自機とアイテム', () => {
  it('喰らいボムは被弾から8フレーム未満でのみ有効', () => {
    expect(deathbomb(0, 1)).toBe(true);
    expect(deathbomb(7, 1)).toBe(true);
    expect(deathbomb(8, 1)).toBe(false);
    expect(deathbomb(3, 0)).toBe(false);
  });
  it('上端ラインで自動回収する', () => {
    expect(autoCollect(111)).toBe(true);
    expect(autoCollect(112)).toBe(false);
  });
  it('点アイテムは高い位置ほど高価値', () => {
    expect(pointValue(0, 10000)).toBe(10000);
    expect(pointValue(112, 10000)).toBeLessThan(10000);
    expect(pointValue(200, 10000)).toBeGreaterThan(pointValue(400, 10000));
  });
  it('エクステンド閾値を横断した数を返す', () => {
    expect(newExtends(9_999_999, 10_000_000)).toBe(1);
    expect(newExtends(9_000_000, 21_000_000)).toBe(2);
    expect(newExtends(10_000_000, 10_000_001)).toBe(0);
  });
});

describe('設定と難易度', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('localStorage失敗時には既定値で動く', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    expect(safeLoad('high', 0, Number)).toBe(0);
    expect(() => safeSave('high', '100')).not.toThrow();
  });
  it('難易度で弾数と速度を変える', () => {
    expect(density('easy', 20)).toBe(12);
    expect(density('lunatic', 20)).toBe(36);
    expect(bulletSpeed('hard', 2)).toBeGreaterThan(bulletSpeed('normal', 2));
    expect(bulletSpeed('lunatic', 2)).toBeLessThan(2.5);
  });
});
