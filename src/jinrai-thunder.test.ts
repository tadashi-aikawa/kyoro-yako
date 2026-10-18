import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Game } from './game';
import { THUNDER_CALL, THUNDER_FADE, THUNDER_HOLD, THUNDER_PERIOD, THUNDER_STAGGER, type Thunderbolt, thunderGround, thunderHead, thunderHits, thunderHot, thunderPath, thunderScene } from './patterns/jinrai-thunder';

const listeners: Record<string, (event: { code: string; repeat: boolean; preventDefault: () => void }) => void> = {};
beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('window', { addEventListener: (kind: string, listener: typeof listeners[string]) => { listeners[kind] = listener; } });
  vi.stubGlobal('Image', class { src = ''; complete = true; naturalWidth = 0; });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function start(difficulty: Game['difficulty'] = 'normal'): Game {
  const game = new Game(); game.audio.volume = 0; game.difficulty = difficulty;
  game.startStage(4); game.startBoss(false, 5); game.phaseFrame = 104; game.invulnFrames = 0; game.update();
  return game;
}
function run(game: Game, frames: number): void { for (let i = 0; i < frames; i++) game.update(); }

it.each(['easy','normal','hard','lunatic'] as const)('%sは位置予告なしで印と2回の閃光を出し、0.8秒後から雷を時間差で落とす', (difficulty) => {
  const game = start(difficulty); game.invincible = true;
  const level = ['easy','normal','hard','lunatic'].indexOf(difficulty);
  const audio = vi.spyOn(game.audio, 'play').mockImplementation(() => {});
  const flashes: number[] = [];
  const position = game.bossPosition();
  for (let t = 0; t < THUNDER_CALL; t++) {
    const scene = thunderScene(game)!;
    expect(scene.charging).toBe(true);
    if (scene.flash > 0) flashes.push(t);
    expect(game.bossPosition()).toEqual(position);
    expect(game.jinraiBolts).toHaveLength(0);
    expect(game.jinraiThunderstorm!.lanes).toHaveLength(0);
    if (t < THUNDER_CALL - 1) game.update();
  }
  expect(flashes).toEqual([18,19,20,21,22,23,36,37,38,39,40,41]);
  game.update();
  expect(game.jinraiBolts).toHaveLength(1);
  expect(game.jinraiBolts[0].age).toBe(1);
  expect(thunderHead(game.jinraiBolts[0])).toBeLessThan(2);
  expect(thunderScene(game)!.charging).toBe(false);
  run(game, THUNDER_STAGGER[level] * ([2,3,4,5][level] - 1));
  expect(game.jinraiBolts).toHaveLength([2,3,4,5][level]);
  expect(audio.mock.calls.filter(([sound]) => sound === 'thunder')).toHaveLength([2,3,4,5][level]);
  expect(game.bullets.count).toBe(0);
});

it('先端より下は描画も判定もなく、伸びてきた雷の通過部分だけが当たる', () => {
  const bolt: Thunderbolt = { age: 20, speed: 8.5, width: 7, points: [[192,-12],[192,100],[192,200],[192,460]] };
  expect(thunderHead(bolt)).toBe(97);
  expect(thunderPath(bolt).at(-1)).toEqual([192,97]);
  expect(thunderHits(bolt,192,60)).toBe(true);
  expect(thunderHits(bolt,192,200)).toBe(false);
  expect(thunderHits(bolt,210,60)).toBe(false);
  bolt.age=40;
  expect(thunderHits(bolt,192,200)).toBe(true);
});

it('先頭を少し避けて止まった位置にも、2本目の追撃が来る', () => {
  const game = start(); game.invincible = true; run(game, THUNDER_CALL);
  const first = game.jinraiBolts[0];
  game.px = first.points[0][0] + 18;
  run(game, THUNDER_STAGGER[1]);
  const second = game.jinraiBolts[1];
  first.age = thunderGround(first);
  second.age = thunderGround(second);
  expect(thunderHits(second, game.px, game.py)).toBe(true);
  expect(thunderHits(first, game.px, game.py)).toBe(false);
});

it('折れた雷は同じ線分で描画と接触を判定する', () => {
  const bolt: Thunderbolt = { age: 30, speed: 8.5, width: 7, points: [[160,-12],[220,100],[160,200],[220,460]] };
  expect(thunderHits(bolt,220,100)).toBe(true);
  expect(thunderHits(bolt,160,100)).toBe(false);
});

it('先端の立ち上がりと消える余韻は無害で、余韻の後は回収する', () => {
  const game = start(); game.invincible = true; run(game,THUNDER_CALL);
  const bolt=game.jinraiBolts[0];
  expect(thunderHot(bolt)).toBe(false);
  bolt.age=thunderGround(bolt)+THUNDER_HOLD;
  expect(thunderHot(bolt)).toBe(false);
  bolt.age+=THUNDER_FADE-1; game.update();
  expect(game.jinraiBolts).not.toContain(bolt);
});

it.each([1,20,THUNDER_CALL+2])('詠唱・閃光・落雷中のフレーム%sでボムを使うと同じ周期の追撃も消える', (frame) => {
  const game=start(); game.invincible=true; run(game,frame);
  listeners.keydown({code:'KeyX',repeat:false,preventDefault:()=>{}});game.update();game.keys.delete('KeyX');
  expect(game.jinraiBolts).toHaveLength(0);expect(game.jinraiThunderstorm).toBeUndefined();
  const end=105+THUNDER_PERIOD[1]-1;
  while(game.phaseFrame<end)game.update();
  expect(game.jinraiBolts).toHaveLength(0);expect(thunderScene(game)).toBeUndefined();
});

it('ポーズ中は印と閃光の時計も落雷の先端も止まる', () => {
  const game=start();game.invincible=true;run(game,THUNDER_CALL+20);
  listeners.keydown({code:'Escape',repeat:false,preventDefault:()=>{}});game.update();game.keys.delete('Escape');
  const before=game.jinraiBolts.map((b)=>b.age),scene=thunderScene(game);
  run(game,90);expect(game.jinraiBolts.map((b)=>b.age)).toEqual(before);expect(thunderScene(game)).toEqual(scene);
});

it('次の技・面へ進むと詠唱と落雷を持ち越さない', () => {
  const game=start();game.invincible=true;run(game,THUNDER_CALL);
  game.skipPhase();expect(game.jinraiBolts).toHaveLength(0);expect(thunderScene(game)).toBeUndefined();
  game.startStage(5);expect(game.jinraiBolts).toHaveLength(0);expect(game.jinraiThunderstorm).toBeUndefined();
});
