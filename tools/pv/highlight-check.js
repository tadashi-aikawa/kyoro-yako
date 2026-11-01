import { Capture } from './capture.js';
import { weatherAt, WEATHER_NAMES } from '/src/patterns/claudine-weather-grid.ts';
import { bloomArena, bloomLayout, finaleTime } from '/src/patterns/claudine-finale.ts';
import { issenScene, ISSEN_RECOVERY, ISSEN_FADE } from '/src/patterns/jinrai-issen.ts';

// 本体の時計・弾・エリアを読み、撮影した区間内に見せ場があることを測る。
export async function inspectHighlights(pv) {
  const results = [];
  for (const id of ['claudine', 'claudine-ult', 'jinrai-ult']) {
    const board = pv.board, index = board.cuts.findIndex(c => c.id === id), cut = board.cuts[index];
    const first = Math.round(cut.start * board.fps) - pv.incomingFrames(index);
    const count = Math.round(board.cuts[index + 1].start * board.fps) - first;
    const capture = new Capture(board.pixelRatio);
    await capture.begin(cut);
    const events = [], marks = {}, phaseFrames = [];
    let previousWeather, previousHopping = false, previousCharging = false;
    const mark = (name, frame, extra = {}) => {
      if (marks[name] !== undefined) return;
      marks[name] = frame;
      events.push({ name, frame, timelineFrame: first + frame, phaseFrame: capture.game.phaseFrame, ...extra });
    };
    for (let frame = 0; frame < count; frame++) {
      capture.step();
      capture.drawTo(document.querySelector('#pv').getContext('2d'), 0);
      const g = capture.game;
      phaseFrames.push(g.phaseFrame);
      if (id === 'claudine') {
        const weather = weatherAt(g.phaseFrame - 105);
        if (weather !== previousWeather) { mark(WEATHER_NAMES[weather], frame); previousWeather = weather; }
      } else if (id === 'claudine-ult') {
        const time = finaleTime(g), layout = bloomLayout(time), arena = bloomArena(time);
        if (g.bullets.objects.some(b => b.active && b.motion === 'bloomRocket' && b.dashWave === 2)) mark('grandLaunch', frame);
        if (g.bullets.objects.some(b => b.active && b.motion === 'bloomSpark' && b.dashWave === 2)) mark('grandBurst', frame);
        if (layout.progress > 0 && layout.progress < 1) mark('morphStart', frame, { arena });
        if (marks.morphStart !== undefined && layout.progress === 1) mark('morphComplete', frame, { arena });
      } else {
        const scene = issenScene(g), state = g.jinraiIssen;
        if (scene.charging && !previousCharging) mark('charge', frame, { cycle: state.cycle });
        if (scene.moving) mark('attack', frame);
        if (marks.attack !== undefined && g.bullets.count > 0) mark('ripple', frame);
        if (marks.ripple !== undefined && g.bullets.count === 0) mark('clear', frame);
        if (marks.attack !== undefined && scene.hopping && !previousHopping) mark('warp', frame);
        if (marks.warp !== undefined && !scene.hopping && scene.elapsed >= ISSEN_RECOVERY + ISSEN_FADE) mark('arrived', frame);
        if (marks.arrived !== undefined && g.bossCastFrame === g.phaseFrame) mark('kunaiPose', frame);
        previousHopping = scene.hopping; previousCharging = scene.charging;
      }
    }
    const samples = id === 'claudine' ? [marks['台風'] - 24, marks['台風'] + 36]
      : id === 'claudine-ult' ? [marks.grandBurst + 45, marks.morphComplete]
      : [marks.charge + 30, marks.attack + 3, marks.clear, marks.warp + 8, marks.kunaiPose + 2];
    const errors = [];
    if (samples.some(f => !Number.isInteger(f) || f < 0 || f >= count)) errors.push('必要な見せ場が撮影区間内にありません');
    if (id === 'claudine' && Math.abs(marks['台風'] / count - 1 / 3) > 0.02) errors.push('台風への切替が前半1/3付近ではありません');
    if (id === 'jinrai-ult' && samples.at(-1) >= count - pv.incomingFrames(index + 1)) errors.push('クナイの構えが次カットのフェードに隠れています');
    if (capture.stats.visibleHitFrames || capture.stats.overlapFrames) errors.push('被弾表示または通常弾接触候補があります');
    results.push({ id, phase: cut.capture.phase, warmup: cut.capture.warmup, first, count,
      phaseRange: [phaseFrames[0], phaseFrames.at(-1)], events, samples: samples.map(f => first + f), stats: capture.stats, errors });
  }
  return results;
}
