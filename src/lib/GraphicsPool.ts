import { Graphics } from 'pixi.js';

export default class GraphicsPool {
  private pool: Graphics[] = [];
  private maxPoolSize: number;

  constructor(maxPoolSize: number = 500) {
    this.maxPoolSize = maxPoolSize;
  }

  get(): Graphics {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return new Graphics();
  }

  return(graphics: Graphics): void {
    graphics.clear();
    graphics.removeFromParent();

    if (this.pool.length < this.maxPoolSize) {
      this.pool.push(graphics);
      return;
    }

    graphics.destroy();
  }

  clear(): void {
    this.pool.forEach(graphics => graphics.destroy());
    this.pool = [];
  }

  get poolSize(): number {
    return this.pool.length;
  }
}