import type { AccidentalMode, Clef, PracticeSettings } from '@/music/types';
import { CLEFS } from '@/music/types';
import { MusicTheory } from '@/music/theory';
import type { MidiStatus } from '@/midi/midi-ports';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

interface SettingsPanelProps {
  settings: PracticeSettings;
  midi: MidiStatus;
  onChange: (patch: Partial<PracticeSettings>) => void;
  onConnectMidi: () => void;
}

const MODES: { id: AccidentalMode; label: string }[] = [
  { id: 'naturals', label: '自然音' },
  { id: 'sharps', label: '升号方向' },
  { id: 'flats', label: '降号方向' },
  { id: 'mixed', label: '升降混合' },
];

const FIFTHS = [
  { value: '0:0', label: '仅 C 大调' },
  { value: '-1:1', label: '至多 1 个升降号' },
  { value: '-2:2', label: '至多 2 个升降号' },
  { value: '-4:4', label: '至多 4 个升降号' },
];

const NOTE_CHOICES = MusicTheory.noteChoices(36, 84);

export function SettingsPanel({ settings, midi, onChange, onConnectMidi }: SettingsPanelProps) {
  const fifthsValue = `${settings.minFifths}:${settings.maxFifths}`;
  const fifthsOptions = FIFTHS.some((option) => option.value === fifthsValue)
    ? FIFTHS
    : [{ value: fifthsValue, label: `当前 ${settings.minFifths} 到 ${settings.maxFifths}` }, ...FIFTHS];

  const toggleClef = (clef: Clef) => {
    const has = settings.clefs.includes(clef);
    if (has && settings.clefs.length === 1) return;
    const clefs = has ? settings.clefs.filter((item) => item !== clef) : [...settings.clefs, clef];
    onChange({ clefs });
  };

  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="text-sm font-medium">设置</h2>
      <p className="mt-1 text-xs text-muted-foreground">改动从下一题生效，并记为自定义。</p>

      <fieldset className="mt-4">
        <legend className="text-xs text-muted-foreground">谱号</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {CLEFS.map((clef) => (
            <Button
              key={clef}
              type="button"
              size="sm"
              variant={settings.clefs.includes(clef) ? 'default' : 'outline'}
              aria-pressed={settings.clefs.includes(clef)}
              onClick={() => toggleClef(clef)}
            >
              {MusicTheory.clefShort(clef)}
            </Button>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-xs text-muted-foreground">
          最低音
          <select
            className="field-select"
            value={settings.lowestMidi}
            onChange={(event) => onChange({ lowestMidi: Number(event.target.value) })}
          >
            {NOTE_CHOICES.map((choice) => (
              <option key={choice.midi} value={choice.midi}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          最高音
          <select
            className="field-select"
            value={settings.highestMidi}
            onChange={(event) => onChange({ highestMidi: Number(event.target.value) })}
          >
            {NOTE_CHOICES.map((choice) => (
              <option key={choice.midi} value={choice.midi}>
                {choice.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 grid gap-1 text-xs text-muted-foreground">
        变音
        <select
          className="field-select"
          value={settings.accidentalMode}
          onChange={(event) => onChange({ accidentalMode: event.target.value as AccidentalMode })}
        >
          {MODES.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.label}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 grid gap-1 text-xs text-muted-foreground">
        调号
        <select
          className="field-select"
          value={fifthsValue}
          onChange={(event) => {
            const [min, max] = event.target.value.split(':').map(Number);
            onChange({ minFifths: min, maxFifths: max });
          }}
        >
          {fifthsOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 grid gap-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <Label htmlFor="chromatic">变化音</Label>
          <span>{Math.round(settings.chromaticProbability * 100)}%</span>
        </div>
        <Slider
          id="chromatic"
          min={0}
          max={80}
          step={5}
          value={[Math.round(settings.chromaticProbability * 100)]}
          onValueChange={(value) => onChange({ chromaticProbability: (value[0] ?? 0) / 100 })}
          aria-label="变化音比例"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-xs text-muted-foreground">
          最少音数
          <select
            className="field-select"
            value={settings.chordSizeMin}
            onChange={(event) => onChange({ chordSizeMin: Number(event.target.value) })}
          >
            {[1, 2, 3, 4].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          最多音数
          <select
            className="field-select"
            value={settings.chordSizeMax}
            onChange={(event) => onChange({ chordSizeMax: Number(event.target.value) })}
          >
            {[1, 2, 3, 4].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Label htmlFor="timed">限时</Label>
        <Switch id="timed" checked={settings.timed} onCheckedChange={(timed) => onChange({ timed })} />
      </div>
      <div className="mt-3 grid gap-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>每题秒数</span>
          <span>{Math.round(settings.timeoutMs / 1000)} 秒</span>
        </div>
        <Slider
          min={2}
          max={15}
          step={1}
          disabled={!settings.timed}
          value={[Math.round(settings.timeoutMs / 1000)]}
          onValueChange={(value) => onChange({ timeoutMs: (value[0] ?? 8) * 1000 })}
          aria-label="每题秒数"
        />
      </div>

      <label className="mt-4 grid gap-1 text-xs text-muted-foreground">
        每轮题数
        <select
          className="field-select"
          value={settings.sessionLength}
          onChange={(event) => onChange({ sessionLength: Number(event.target.value) })}
        >
          {[10, 20, 30, 40].map((length) => (
            <option key={length} value={length}>
              {length}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 border-t pt-3">
        <Button type="button" variant="outline" className="w-full" onClick={onConnectMidi}>
          连接 MIDI
        </Button>
        <p className="mt-2 text-xs text-muted-foreground" role="status">
          {midi.message}
        </p>
      </div>
    </section>
  );
}
