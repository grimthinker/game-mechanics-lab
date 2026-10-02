export interface FPSStats {
  current: number;
  avg: number;
  min: number;
  history: number[];
}

export class FPSMonitor {
  private history: number[] = [];
  private readonly maxHistory: number = 70;
  private currentFPS: number = 60;
  private avgFPS: number = 60;
  private minFPS: number = 60;
  private updateTimer: number = 0;
  private frameCount: number = 0;
  private timeAccumulator: number = 0;

  public update(dt: number): void {
    if (dt <= 0) return;
    const instantFPS = Math.min(240, Math.max(1, 1 / dt));

    this.history.push(instantFPS);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.frameCount++;
    this.timeAccumulator += dt;
    this.updateTimer += dt;

    // Обновляем текстовые показатели каждые 150мс, чтобы значения не мелькали хаотично
    if (this.updateTimer >= 0.15) {
      this.currentFPS = Math.round(this.frameCount / this.timeAccumulator);
      this.frameCount = 0;
      this.timeAccumulator = 0;
      this.updateTimer = 0;

      if (this.history.length > 0) {
        let sum = 0;
        let min = Infinity;
        for (let i = 0; i < this.history.length; i++) {
          const val = this.history[i];
          sum += val;
          if (val < min) min = val;
        }
        this.avgFPS = Math.round((sum / this.history.length) * 10) / 10;
        this.minFPS = Math.round(min * 10) / 10;
      }
    }
  }

  public getStats(): FPSStats {
    return {
      current: this.currentFPS,
      avg: this.avgFPS,
      min: this.minFPS,
      history: this.history,
    };
  }
}
