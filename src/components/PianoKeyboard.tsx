import { KeyboardMap } from '@/music/keyboard';

interface PianoKeyboardProps {
  entered: readonly number[];
  held: readonly number[];
  wrongPitchClass: number | null;
  onPress: (pitchClass: number) => void;
}

/** 屏幕钢琴。错键用 `data-wrong`（朱色），已确认的和弦音用 `data-active`（绿色），两者不同时出现。 */
export function PianoKeyboard({ entered, held, wrongPitchClass, onPress }: PianoKeyboardProps) {
  const whites = KeyboardMap.whiteKeys();
  const blacks = KeyboardMap.blackKeys();

  return (
    <div className="piano" role="group" aria-label="答题键盘" data-testid="piano">
      <div className="piano-whites">
        {whites.map((key) => (
          <button
            key={key.code}
            type="button"
            className="piano-white"
            aria-label={`${key.name}，键盘 ${key.legend}`}
            aria-pressed={entered.includes(key.pitchClass) || held.includes(key.pitchClass)}
            data-active={wrongPitchClass !== key.pitchClass && (entered.includes(key.pitchClass) || held.includes(key.pitchClass))}
            data-wrong={wrongPitchClass === key.pitchClass}
            onClick={() => onPress(key.pitchClass)}
          >
            <span className="piano-name">{key.name}</span>
            <span className="piano-legend">{key.legend}</span>
          </button>
        ))}
      </div>
      <div className="piano-blacks">
        {blacks.map((key) => (
          <button
            key={key.code}
            type="button"
            className="piano-black"
            style={{ ['--after' as string]: String(key.afterWhite ?? 1) }}
            aria-label={`${key.name}，或 ${key.alias}，键盘 ${key.legend}`}
            aria-pressed={entered.includes(key.pitchClass) || held.includes(key.pitchClass)}
            data-active={wrongPitchClass !== key.pitchClass && (entered.includes(key.pitchClass) || held.includes(key.pitchClass))}
            data-wrong={wrongPitchClass === key.pitchClass}
            onClick={() => onPress(key.pitchClass)}
          >
            <span className="piano-name">{key.name}</span>
            <span className="piano-alias">{key.alias}</span>
            <span className="piano-legend">{key.legend}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
