import { MOTION_SPRITES } from './boss-motion';
import { CREDITS_ART } from './ending';
import { ENEMY_ROOMS } from './enemy-design';
import type { MediaAssets, MediaKey } from './media-assets';
import { REPRISES } from './patterns/minerva-reprise';
import { MINERVA_OWL_SPRITES, MINERVA_SOLO_SPRITES } from './patterns/minerva-summon';
import { NAMES, STAGES } from './stages';
import { ULTIMATE_CUTINS } from './ultimate-cutin';

export const IMAGE_FILES: Record<string, string> = { title: 'title/key-visual.webp' };
for (const id of ['mimiko', ...Object.keys(NAMES)]) {
  for (const form of ['face', 'stand']) IMAGE_FILES[`${id}-${form}`] = `members/${id}-${form}.webp`;
  IMAGE_FILES[`${id}-sprite`] = `sprites/${id}.webp`;
}
const SPECIAL_SPRITES = ['claudine-bloom-closed', 'minerva-prayer', 'jinrai-seal', 'jinrai-kiss', 'obsidia-sweep'];
for (const id of [...MOTION_SPRITES, ...MINERVA_SOLO_SPRITES, ...MINERVA_OWL_SPRITES, ...SPECIAL_SPRITES]) IMAGE_FILES[`${id}-sprite`] = `sprites/${id}.webp`;
for (const room of ENEMY_ROOMS) IMAGE_FILES[`enemy-${room}`] = `enemies/${room}.webp`;
for (const [boss, spec] of Object.entries(ULTIMATE_CUTINS)) IMAGE_FILES[`${boss}-ultimate`] = `cutins/${spec.id}.webp`;
for (const id of CREDITS_ART) IMAGE_FILES[`credits-${id}`] = `credits/${id}.webp`;

const keys = (ids: string[]): MediaKey[] => [...new Set(ids)].map((id): MediaKey => `image:${id}`);
const LOADING_IMAGES = MINERVA_OWL_SPRITES.map(id => `${id}-sprite`);
export const TITLE_IMAGES = keys(['title', 'mimiko-face', 'mimiko-stand', 'mimiko-sprite', ...LOADING_IMAGES]);
export const CREDITS_IMAGES = keys(CREDITS_ART.map(id => `credits-${id}`));
export const ENDING_IMAGES = [...CREDITS_IMAGES, ...keys(['mimiko-stand', ...LOADING_IMAGES])];

export function stageImages(stage: number): MediaKey[] {
  const definition = STAGES[stage - 1];
  if (!definition) return [];
  const members = new Set(['mimiko', definition.boss, definition.mid]);
  const ids = Object.keys(IMAGE_FILES).filter(id => [...members].some(member => id.startsWith(`${member}-`)));
  // 最終面では、再演元の顔と召喚するキャラの構えも描く。
  if (stage === 5) for (const { boss } of REPRISES) ids.push(`${boss}-face`, `${boss}-stand`, `${boss}-sprite`, `${boss}-cast-sprite`);
  return keys([...ids, `enemy-${ENEMY_ROOMS[stage - 1]}`, ...LOADING_IMAGES]);
}

interface PreparedImage { image: HTMLImageElement; promise: Promise<void>; cancel: () => void; ready: boolean; }

export class GameImages {
  readonly elements: Record<string, HTMLImageElement> = {};
  private readonly prepared = new Map<MediaKey, PreparedImage>();

  constructor(private readonly assets?: MediaAssets, private readonly decodeMs = 15_000) {
    for (const [id, file] of Object.entries(IMAGE_FILES)) {
      const image = new Image();
      this.elements[id] = image;
      // ロジックだけを扱うGameは非同期の準備待ちを注入しない。
      if (!assets) image.src = `${import.meta.env.BASE_URL}assets/${file}`;
    }
  }

  ready(key: MediaKey): boolean { return !!this.prepared.get(key)?.ready; }
  get count(): number { return [...this.prepared.values()].filter(entry => entry.ready).length; }

  prepare(key: MediaKey): Promise<void> {
    const cached = this.prepared.get(key);
    if (cached) return cached.promise;
    const id = key.slice(6);
    const url = this.assets?.objectUrl(key);
    if (!IMAGE_FILES[id] || !url) return Promise.reject(new Error('Image unavailable'));
    const image = new Image();
    this.elements[id] = image;
    let cancel!: () => void;
    let timer: ReturnType<typeof setTimeout>;
    const stopped = new Promise<never>((_, reject) => {
      cancel = () => reject(new DOMException('Image released', 'AbortError'));
      timer = setTimeout(() => reject(new Error('Image decode timeout')), this.decodeMs);
    });
    const entry: PreparedImage = { image, cancel, ready: false, promise: Promise.resolve() };
    this.prepared.set(key, entry);
    image.src = url;
    entry.promise = Promise.race([image.decode(), stopped]).then(() => {
      if (this.prepared.get(key) !== entry || !image.complete || !image.naturalWidth) throw new Error('Image not drawable');
      entry.ready = true;
    }).catch(error => {
      if (this.prepared.get(key) === entry) {
        this.release(key);
        // 壊れたBlobやデコーダーを再利用せず、次の試行で通信からやり直す。
        this.assets?.remove(key);
      }
      throw error;
    }).finally(() => clearTimeout(timer));
    return entry.promise;
  }

  retain(keys: readonly MediaKey[]): void {
    const allowed = new Set(keys);
    for (const key of this.prepared.keys()) if (!allowed.has(key)) this.release(key);
  }

  private release(key: MediaKey): void {
    const entry = this.prepared.get(key);
    if (!entry) return;
    this.prepared.delete(key);
    entry.cancel();
    entry.image.src = '';
    this.elements[key.slice(6)] = new Image();
  }
}
