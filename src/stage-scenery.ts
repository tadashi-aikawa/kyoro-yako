import type { Game } from './game';
import { FIELD } from './rules';

const TAU = Math.PI * 2;

// 世界座標のタイル番号を保つことで、継ぎ目でも同じ物体が連続して移動する。
function tiles(distance: number, speed: number, height: number, draw: (y: number, index: number) => void): void {
  const offset = distance * speed;
  for (let index = Math.floor(-offset / height) - 1; index <= Math.ceil((FIELD.h - offset) / height); index++) draw(index * height + offset, index);
}

// 床・遠景・手前の構造を別々の速度で流す。弾と予告より暗く描く。
export function drawScenery(c: CanvasRenderingContext2D, game: Game): void {
  const distance = game.sceneryDistance;
  c.save(); c.lineWidth = 1;
  // 中央だけ抽象空間にせず、端の建築と同じ素材・色で一枚の道を描く。
  const floors = ['#18272b', '#231f2f', '#202b30', '#252633', '#202c3a'];
  const joints = ['#8c9e8730', '#99837324', '#90aaa52c', '#b299ab25', '#859eb02c'];
  c.fillStyle = floors[game.stage - 1]; c.fillRect(0, 0, FIELD.w, FIELD.h);
  tiles(distance, 1, 96, (y, index) => {
    for (let row = 0; row < 3; row++) {
      const stagger = (row + index * 3) % 2 ? 24 : 0;
      for (let column = -1; column < 9; column++) {
        const x = column * 48 + stagger;
        c.fillStyle = game.stage === 1 ? ['#1e2d2f', '#223231', '#243331'][Math.abs(index + row + column) % 3] : floors[game.stage - 1];
        c.fillRect(x + 1, y + row * 32 + 1, 45, 29);
        c.strokeStyle = joints[game.stage - 1]; c.strokeRect(x + 1, y + row * 32 + 1, 45, 29);
      }
    }
  });
  if (game.stage !== 1) {
    tiles(distance, 0.8, 64, (y, index) => {
      c.strokeStyle = '#9cabb91c';
      c.beginPath(); c.moveTo(46, y); c.lineTo(338, y); c.stroke();
      for (const x of [46, 118, 192, 266, 338]) {
        c.beginPath(); c.moveTo(x + (index % 2 ? 18 : 0), y);
        c.lineTo(x + (index % 2 ? 18 : 0), y + 54); c.stroke();
      }
      c.fillStyle = '#b6aa8320'; c.fillRect(188, y + 22, 8, 16);
    });
  }
  if (game.stage === 1) {
    // 門を画面上部へ重ねない。石畳・壁・柱が一緒に通り過ぎる参道にする。
    tiles(distance, 1.1, 192, (y, index) => {
      for (const side of [0, 1]) {
        c.save(); if (side) { c.translate(FIELD.w, 0); c.scale(-1, 1); }
        c.fillStyle = '#152329'; c.fillRect(0, y, 48, 184);
        c.fillStyle = '#2b3a38'; c.fillRect(0, y + 3, 44, 178);
        c.strokeStyle = '#78937a33';
        for (let row = 0; row < 6; row++) {
          c.strokeRect(-18 + row % 2 * 22, y + row * 30 + 5, 40, 26);
          c.strokeRect(24 + row % 2 * 22, y + row * 30 + 5, 40, 26);
        }
        c.fillStyle = '#101e25'; c.fillRect(29, y + 22, 18, 29);
        c.fillStyle = '#536154'; c.fillRect(30, y + 20, 18, 4);
        c.fillStyle = index % 2 ? '#bd975f55' : '#b9a27155'; c.fillRect(34, y + 28, 8, 13);
        c.fillStyle = '#35453e'; c.fillRect(33, y + 53, 13, 9);
        c.restore();
      }
    });
  } else if (game.stage === 2) {
    for (const speed of [0.45, 1.05]) tiles(distance, speed, 156, (y, index) => {
      for (const side of [0, 1]) {
        c.save(); if (side) { c.translate(FIELD.w, 0); c.scale(-1, 1); }
        const width = speed < 1 ? 87 : 53;
        c.fillStyle = speed < 1 ? '#171426' : '#211c2a'; c.fillRect(0, y, width, 136);
        c.strokeStyle = '#88725244'; c.strokeRect(2, y + 3, width - 4, 130);
        for (const shelf of [57, 119]) {
          c.fillStyle = '#65503c88'; c.fillRect(0, y + shelf, width, 4);
          for (let book = 0; book < Math.floor(width / 11); book++) {
            const h = 22 + Math.abs(index * 11 + book * 7) % 24;
            c.fillStyle = ['#58416a99', '#705b4999', '#425e6999'][Math.abs(book + index) % 3];
            c.fillRect(4 + book * 11, y + shelf - h, 8, h);
            c.fillStyle = '#c3b69044'; c.fillRect(6 + book * 11, y + shelf - h + 5, 4, 2);
          }
        }
        c.restore();
      }
    });
  } else if (game.stage === 3) {
    tiles(distance, 1.1, 170, (y, index) => {
      for (const x of [8, 337]) {
        c.fillStyle = '#202737'; c.fillRect(x, y, 39, 134);
        c.strokeStyle = '#8eaaa266'; c.strokeRect(x + 4, y + 15, 31, 78);
        c.fillStyle = '#aab7a228'; c.fillRect(x + 10, y + 27, 19, 52);
        c.strokeStyle = '#aab7a244'; c.beginPath(); c.arc(x + 20, y + 52, 9 + Math.abs(index % 3), 0, TAU); c.stroke();
        c.fillStyle = '#394b4866'; c.fillRect(x + 3, y + 108, 33, 8);
      }
    });
    tiles(distance, 0.45, 240, (y, index) => {
      c.save(); c.translate(85 + Math.abs(index * 77) % 213, y + 40); c.rotate(index * 0.36);
      c.fillStyle = '#d4ccb918'; c.fillRect(-13, -19, 26, 38); c.restore();
    });
    gates(c, distance, '#233134', '#a9c3ad44');
  } else if (game.stage === 4) {
    for (const speed of [0.45, 1.15]) tiles(distance, speed, 260, (y, index) => {
      for (const side of [0, 1]) {
        c.save(); if (side) { c.translate(FIELD.w, 0); c.scale(-1, 1); }
        c.translate(speed < 1 ? -18 : 0, y);
        c.strokeStyle = '#24273c'; c.lineWidth = 12;
        c.beginPath(); c.moveTo(5, 232); c.quadraticCurveTo(32, 138, 10, 20); c.stroke(); c.lineWidth = 4;
        for (let branch = 0; branch < 3; branch++) {
          const by = 47 + branch * 64;
          c.beginPath(); c.moveTo(17, by + 26); c.quadraticCurveTo(49, by + 18, 93, by); c.stroke();
          for (let petal = 0; petal < 8; petal++) {
            c.fillStyle = petal % 2 ? '#ad668344' : '#f6bbcf38';
            c.beginPath(); c.ellipse(31 + petal * 8, by + Math.sin(petal * 2 + index) * 13, 5, 3, petal, 0, TAU); c.fill();
          }
        }
        c.restore();
      }
    });
    tiles(distance, 0.65, 96, (y, index) => {
      const x = (Math.abs(index * 83) + Math.sin(distance * 0.006 + index) * 22 + 384) % 384;
      c.fillStyle = '#eb9acb38'; c.beginPath(); c.ellipse(x, y, 3, 1.5, distance * 0.01 + index, 0, TAU); c.fill();
    });
    gates(c, distance, '#282135', '#cd94af55', true);
  } else {
    const dawn = c.createLinearGradient(0, 0, 0, FIELD.h);
    dawn.addColorStop(0, '#1a203c'); dawn.addColorStop(0.6, '#604359'); dawn.addColorStop(1, '#cc856c');
    const finale = game.boss === 'minerva' ? Math.max(0, Math.min(1, (game.phaseIndex + game.phaseFrame / 3600) / 13)) : 0;
    c.globalAlpha = Math.min(1, game.stageFrame / 6000) * 0.2 + finale * 0.22;
    c.fillStyle = dawn; c.fillRect(0, 0, FIELD.w, FIELD.h); c.globalAlpha = 1;
    tiles(distance, 0.25, 240, (y, index) => {
      const x = 78 + Math.abs(index * 71) % 205;
      c.strokeStyle = '#d2c1a338'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(x, y + 14); c.lineTo(x + 30, y + 81); c.lineTo(x - 22, y + 124); c.stroke();
    });
    tiles(distance, 1.1, 220, (y) => {
      for (const side of [0, 1]) {
        c.save(); if (side) { c.translate(FIELD.w, 0); c.scale(-1, 1); }
        c.fillStyle = '#172236'; c.fillRect(0, y, 33, 178);
        c.strokeStyle = '#71898655'; c.lineWidth = 5;
        c.beginPath(); c.moveTo(25, y + 168); c.quadraticCurveTo(25, y + 34, 192, y + 12); c.stroke();
        c.lineWidth = 1; c.strokeRect(5, y + 44, 18, 93); c.restore();
      }
    });
  }
  c.restore();
}

// 扉も通り過ぎる。視界へ入る前に開き、中央を塞がない。
function gates(c: CanvasRenderingContext2D, distance: number, fill: string, border: string, paper = false): void {
  tiles(distance, 1, 960, (y) => {
    const opening = Math.max(0, Math.min(1, (y + 180) / 160));
    for (const side of [0, 1]) {
      const x = side ? 192 + opening * 140 : 112 - opening * 140;
      c.fillStyle = fill; c.globalAlpha = 0.5; c.fillRect(x, y, 80, 150); c.globalAlpha = 1;
      c.strokeStyle = border; c.strokeRect(x, y, 80, 150);
      if (paper) {
        for (let row = 1; row < 5; row++) { c.beginPath(); c.moveTo(x, y + row * 30); c.lineTo(x + 80, y + row * 30); c.stroke(); }
        c.beginPath(); c.moveTo(x + 40, y); c.lineTo(x + 40, y + 150); c.stroke();
      } else { c.beginPath(); c.roundRect(x + 15, y + 16, 50, 110, 22); c.stroke(); }
    }
  });
}
