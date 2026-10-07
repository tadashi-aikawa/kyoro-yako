export interface Pooled { active: boolean; }

export class Pool<T extends Pooled> {
  readonly objects: T[] = [];
  private cursor = 0;
  constructor(private readonly create: () => T, private readonly capacity: number) {}

  acquire(): T | undefined {
    const length = this.objects.length;
    if (length < this.capacity) {
      const object = this.create();
      object.active = true;
      this.objects.push(object);
      return object;
    }
    for (let n = 0; n < length; n++) {
      const index = (this.cursor + n) % length;
      const object = this.objects[index];
      if (!object.active) {
        object.active = true;
        this.cursor = (index + 1) % length;
        return object;
      }
    }
    return undefined;
  }

  clear(): void { for (const object of this.objects) object.active = false; }
  forEach(callback: (object: T) => void): void { for (const object of this.objects) if (object.active) callback(object); }
  get count(): number { let count = 0; this.forEach(() => { count++; }); return count; }
}
