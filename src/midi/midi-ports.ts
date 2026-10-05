export type MidiConnectionState = 'idle' | 'connected' | 'denied' | 'unsupported' | 'empty';

export interface MidiStatus {
  state: MidiConnectionState;
  ports: number;
  message: string;
}

/**
 * Web MIDI 适配。Note-on 收成音级，和电脑键盘走同一条判分。
 * 状态字节高四位 0x90 且力度大于 0 才是按下；力度为 0 的 0x90 按松键处理。
 * 八度同样忽略。
 */
export class MidiPorts {
  private access: MIDIAccess | null = null;

  static supported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
  }

  static idleStatus(): MidiStatus {
    if (!this.supported()) {
      return { state: 'unsupported', ports: 0, message: '当前浏览器没有 Web MIDI' };
    }
    return { state: 'idle', ports: 0, message: 'MIDI 键盘未连接' };
  }

  async connect(onNoteOn: (pitchClass: number) => void): Promise<MidiStatus> {
    if (!MidiPorts.supported()) return MidiPorts.idleStatus();
    try {
      this.access = await navigator.requestMIDIAccess();
    } catch {
      return { state: 'denied', ports: 0, message: 'MIDI 权限被拒绝' };
    }
    const wire = () => {
      if (!this.access) return;
      for (const input of this.access.inputs.values()) {
        input.onmidimessage = (event) => {
          const data = event.data;
          if (!data || data.length < 2) return;
          const status = data[0] ?? 0;
          const note = data[1] ?? 0;
          const velocity = data[2] ?? 0;
          const command = status & 0xf0;
          const noteOn = command === 0x90 && velocity > 0;
          if (noteOn) onNoteOn(((note % 12) + 12) % 12);
        };
      }
    };
    wire();
    this.access.onstatechange = () => wire();
    const ports = this.access.inputs.size;
    if (ports === 0) return { state: 'empty', ports: 0, message: '已授权，但没有检测到 MIDI 输入' };
    return { state: 'connected', ports, message: `已连接 ${ports} 个 MIDI 输入` };
  }
}
