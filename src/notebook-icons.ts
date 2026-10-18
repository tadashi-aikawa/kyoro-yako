// HUDとドロップで同じ形を使い、拾ったものと増える表示を結び付ける。
export function notebookStar(c: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4 - Math.PI / 2; const r = i % 2 ? radius * 0.28 : radius;
    if (!i) c.moveTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
    else c.lineTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  }
  c.closePath(); c.fillStyle = color; c.fill();
}

export function notebookBomb(c: CanvasRenderingContext2D, x: number, y: number, radius: number, active = true): void {
  c.strokeStyle = active ? '#c6e2c0' : '#40516d'; c.lineWidth = 0.9;
  c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.arc(x, y, radius * 4 / 7, 0, Math.PI * 2); c.stroke();
  if (active) notebookStar(c, x, y, radius * 2.3 / 7, '#dce9c8');
}

export function notebookFeather(c: CanvasRenderingContext2D, x: number, y: number, scale: number, amount = 1, collectible = false): void {
  c.save(); c.translate(x, y); c.scale(scale, scale);
  const shape = () => {
    c.beginPath(); c.moveTo(-7, 13);
    c.bezierCurveTo(-13, -3, -5, -12, 8, -15);
    c.bezierCurveTo(10, -9, 9, -6, 8, -3);
    c.lineTo(3, -2); c.lineTo(7, 0);
    c.bezierCurveTo(5, 8, 0, 12, -7, 13); c.closePath();
  };
  shape(); c.fillStyle = '#263b43'; c.fill(); c.strokeStyle = collectible ? '#291b29' : '#658078'; c.lineWidth = collectible ? 2.6 : 0.7; c.stroke();
  if (amount > 0) {
    c.save(); c.beginPath(); c.rect(-14, 13 - 28 * amount, 28, 28 * amount); c.clip();
    shape(); c.fillStyle = collectible ? '#f47c86' : amount >= 1 ? '#c6a0a9' : '#7d6b7c'; c.fill(); c.restore();
  }
  if (collectible) {
    shape(); c.strokeStyle = '#291b29'; c.lineWidth = 1.2 / scale; c.stroke();
  }
  c.strokeStyle = collectible ? '#6d3043' : amount >= 1 ? '#7c5e72' : '#6a8580'; c.lineWidth = collectible ? 0.7 / scale : 0.8;
  c.beginPath(); c.moveTo(-13, 22); c.lineTo(6, -11);
  c.moveTo(-4, 5); c.lineTo(5, 2); c.moveTo(0, -2); c.lineTo(-4, -7); c.stroke();
  c.restore();
}

export function notebookOwl(c: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number): void {
  const height = width * 272 / 360;
  if (image.complete && image.naturalWidth) {
    // 自機素材の透明余白を除く。384px角の原画で実測した梟の範囲。
    c.drawImage(image, image.naturalWidth * 12 / 384, image.naturalHeight * 64 / 384, image.naturalWidth * 360 / 384, image.naturalHeight * 272 / 384, x - width / 2, y - height / 2, width, height);
  } else {
    // 読み込み中も残り回数と1UPの姿を残す。画像が読めた次の描画で置き換わる。
    c.fillStyle = '#86a69b'; c.beginPath(); c.ellipse(x, y, width / 2, height / 2, 0, 0, Math.PI * 2); c.fill();
    for (const side of [-1, 1]) {
      c.fillStyle = '#fff4d8'; c.beginPath(); c.arc(x + side * width * 0.2, y - height * 0.1, width * 0.17, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#203532'; c.beginPath(); c.arc(x + side * width * 0.2, y - height * 0.1, width * 0.075, 0, Math.PI * 2); c.fill();
    }
  }
}

export function notebookBookmark(c: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string): void {
  c.fillStyle = color;
  c.beginPath(); c.moveTo(x - width / 2, y - height / 2); c.lineTo(x + width / 2, y - height / 2);
  c.lineTo(x + width / 2, y + height / 2); c.lineTo(x, y + height / 3); c.lineTo(x - width / 2, y + height / 2); c.closePath(); c.fill();
}

export function notebookPage(c: CanvasRenderingContext2D, x: number, y: number, active: boolean): void {
  c.fillStyle = active ? '#b9d8b9' : '#243941'; c.strokeStyle = active ? '#d6e8c9' : '#496065'; c.lineWidth = 0.8;
  c.beginPath(); c.moveTo(x - 6, y - 9); c.lineTo(x + 2, y - 9); c.lineTo(x + 6, y - 5);
  c.lineTo(x + 6, y + 9); c.lineTo(x - 6, y + 9); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(x + 2, y - 9); c.lineTo(x + 2, y - 5); c.lineTo(x + 6, y - 5); c.stroke();
  c.strokeStyle = active ? '#57766b' : '#496065';
  c.beginPath(); c.moveTo(x - 3, y); c.lineTo(x + 3, y); c.moveTo(x - 3, y + 4); c.lineTo(x + 2, y + 4); c.stroke();
}
