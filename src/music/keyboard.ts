/**
 * 一个八度的电脑键盘映射。
 * 数字行是白键，黑键落在字母行：Q W，然后空过 E，再是 R T Y。
 * E 故意不用，因为 E 和 F 之间没有黑键。
 * 查找用 `event.code`（物理键），不看字符，避免中文输入法改掉键位。
 */
export interface PianoKey {
  pitchClass: number;
  legend: string;
  code: string;
  /** 小键盘上的同一白键。`KeyboardEvent.code` 在 Num Lock 开或关时都是 `Numpad1` 这种物理键名。 */
  numpadCode?: string;
  black: boolean;
  /** 画在第几对白键的右边界上。只有黑键使用。 */
  afterWhite?: number;
  name: string;
  alias: string;
}

/**
 * Num Lock 关闭时，个别浏览器会把小键盘的 `code` 报成导航键。
 * 只在 `location === 3`（小键盘）时才用这张表，避免主键盘的方向键被当成音名。
 */
const NUMPAD_NUMLOCK_OFF: Record<string, string> = {
  End: 'Numpad1',
  ArrowDown: 'Numpad2',
  PageDown: 'Numpad3',
  ArrowLeft: 'Numpad4',
  Clear: 'Numpad5',
  ArrowRight: 'Numpad6',
  Home: 'Numpad7',
};

/** DOM 规范里的小键盘位置。 */
const KEY_LOCATION_NUMPAD = 3;

/** 物理键位到音级。屏幕钢琴和键盘监听都读这一张表。 */
export class KeyboardMap {
  static readonly keys: readonly PianoKey[] = [
    { pitchClass: 0, legend: '1', code: 'Digit1', numpadCode: 'Numpad1', black: false, name: 'C', alias: '' },
    { pitchClass: 1, legend: 'Q', code: 'KeyQ', black: true, afterWhite: 1, name: 'C♯', alias: 'D♭' },
    { pitchClass: 2, legend: '2', code: 'Digit2', numpadCode: 'Numpad2', black: false, name: 'D', alias: '' },
    { pitchClass: 3, legend: 'W', code: 'KeyW', black: true, afterWhite: 2, name: 'D♯', alias: 'E♭' },
    { pitchClass: 4, legend: '3', code: 'Digit3', numpadCode: 'Numpad3', black: false, name: 'E', alias: '' },
    { pitchClass: 5, legend: '4', code: 'Digit4', numpadCode: 'Numpad4', black: false, name: 'F', alias: '' },
    { pitchClass: 6, legend: 'R', code: 'KeyR', black: true, afterWhite: 4, name: 'F♯', alias: 'G♭' },
    { pitchClass: 7, legend: '5', code: 'Digit5', numpadCode: 'Numpad5', black: false, name: 'G', alias: '' },
    { pitchClass: 8, legend: 'T', code: 'KeyT', black: true, afterWhite: 5, name: 'G♯', alias: 'A♭' },
    { pitchClass: 9, legend: '6', code: 'Digit6', numpadCode: 'Numpad6', black: false, name: 'A', alias: '' },
    { pitchClass: 10, legend: 'Y', code: 'KeyY', black: true, afterWhite: 6, name: 'A♯', alias: 'B♭' },
    { pitchClass: 11, legend: '7', code: 'Digit7', numpadCode: 'Numpad7', black: false, name: 'B', alias: '' },
  ];

  static pitchClassFromCode(code: string): number | null {
    const found = this.keys.find((key) => key.code === code || key.numpadCode === code);
    return found ? found.pitchClass : null;
  }

  /**
   * 主键盘和小键盘都看 `event.code`。
   * 小键盘 1–7 与数字行白键相同。Num Lock 关掉时，若浏览器仍报告 `Numpad1`–`Numpad7`，直接命中；
   * 若改报成 End、Home 等导航码，只有事件位置在小键盘上才还原，主键盘方向键不受影响。
   */
  static pitchClassFromKeyboardEvent(event: Pick<KeyboardEvent, 'code' | 'location'>): number | null {
    const direct = this.pitchClassFromCode(event.code);
    if (direct !== null) return direct;
    if (event.location !== KEY_LOCATION_NUMPAD) return null;
    const code = NUMPAD_NUMLOCK_OFF[event.code];
    return code ? this.pitchClassFromCode(code) : null;
  }

  static keyForPitchClass(pitchClass: number): PianoKey | undefined {
    return this.keys.find((key) => key.pitchClass === pitchClass);
  }

  static whiteKeys(): readonly PianoKey[] {
    return this.keys.filter((key) => !key.black);
  }

  static blackKeys(): readonly PianoKey[] {
    return this.keys.filter((key) => key.black);
  }
}
