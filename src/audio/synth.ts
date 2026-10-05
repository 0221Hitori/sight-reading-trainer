/**
 * 很小的 Web Audio 音色，用来确认音高，不是采样钢琴。
 * 频率按 A4 = MIDI 69 = 440Hz。必须在用户手势之后 resume，否则浏览器会挂起 AudioContext。
 */
export class PianoSynth {
  private context: AudioContext | null = null;

  get ready(): boolean {
    return this.context !== null;
  }

  resume(): void {
    const context = this.ensure();
    if (context.state === 'suspended') {
      void context.resume();
    }
  }

  play(midi: number, duration = 0.55, when = 0): void {
    const context = this.ensure();
    const start = context.currentTime + Math.max(0, when);
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, start);
    master.gain.exponentialRampToValueAtTime(0.2, start + 0.015);
    master.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    master.connect(context.destination);

    const fundamental = context.createOscillator();
    fundamental.type = 'triangle';
    fundamental.frequency.setValueAtTime(frequency, start);
    fundamental.connect(master);

    const partial = context.createOscillator();
    partial.type = 'sine';
    partial.frequency.setValueAtTime(frequency * 2, start);
    const partialGain = context.createGain();
    partialGain.gain.setValueAtTime(0.35, start);
    partial.connect(partialGain).connect(master);

    fundamental.start(start);
    partial.start(start);
    fundamental.stop(start + duration + 0.02);
    partial.stop(start + duration + 0.02);
  }

  playChord(midis: readonly number[]): void {
    midis.forEach((midi, index) => this.play(midi, 0.7, index * 0.015));
  }

  private ensure(): AudioContext {
    if (!this.context) this.context = new AudioContext();
    return this.context;
  }
}
