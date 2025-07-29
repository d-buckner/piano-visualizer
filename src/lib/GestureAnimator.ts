import { type Ticker } from 'pixi.js';

type AnimationTarget = {
  current: number;
  target: number;
};

type EasingConfig = {
  deltaPowtValue: number;
  deltaDivisor: number;
};

export default class GestureAnimator {
  private x: AnimationTarget = { current: 0, target: 0 };
  private easing: EasingConfig;
  private onPositionChange: (x: number) => void;

  constructor(config: {
    onPositionChange: (x: number) => void;
    easing?: Partial<EasingConfig>;
  }) {
    this.onPositionChange = config.onPositionChange;
    
    // Use same easing constants as original VIZ_CONFIG
    this.easing = {
      deltaPowtValue: 1.5,
      deltaDivisor: 600,
      ...config.easing,
    };
  }

  public setPosition(x: number): void {
    this.x.current = x;
    this.onPositionChange(x);
  }

  public setTarget(x: number): void {
    this.x.target = x;
  }

  public getCurrentPosition(): number {
    return this.x.current;
  }

  public getTargetPosition(): number {
    return this.x.target;
  }

  public animate(ticker: Ticker): void {
    const deltaX = this.x.target - this.x.current;
    
    if (deltaX === 0) {
      return;
    }

    if (Math.abs(deltaX) <= 1) {
      this.x.current = this.x.target;
      this.onPositionChange(this.x.current);
      return;
    }

    const easingStep = this.getEasingStep(deltaX, ticker.deltaMS);
    
    if (deltaX >= 1) {
      this.x.current += easingStep;
    } else if (deltaX <= -1) {
      this.x.current -= easingStep;
    }

    this.onPositionChange(this.x.current);
  }

  private getEasingStep(deltaX: number, deltaMS: number): number {
    return Math.max(
      (deltaMS * Math.pow(Math.abs(deltaX), this.easing.deltaPowtValue)) / this.easing.deltaDivisor,
      1
    );
  }
}