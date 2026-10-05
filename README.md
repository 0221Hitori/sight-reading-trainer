[English](README.md) · [中文](README.zh-CN.md)

# 识谱训练工具

Keyboard-first sight-reading practice. A note or a chord is engraved on a staff; you answer on the computer keyboard, the on-screen piano, or a MIDI keyboard. Scoring uses pitch class (C♯ and D♭ are the same key) and ignores octave, so one octave of keys can name any staff position.

The interaction — difficulty chips, a counted round, white keys on the number row — follows the practice pattern at typepiano.org. This project does not reuse that site’s code, audio, or artwork. Notation is drawn with [VexFlow](https://vexflow.com/).

## Run

Node.js 22 or newer.

```bash
npm install
npm run dev
```

The dev server is http://127.0.0.1:43123.

```bash
npm test
npm run lint
npm run build
```

## How to practice

| Keys | Notes |
| --- | --- |
| `1` `2` `3` `4` `5` `6` `7` | C D E F G A B |
| `Q` `W` `R` `T` `Y` | C♯/D♭, D♯/E♭, F♯/G♭, G♯/A♭, A♯/B♭ |

`E` is unused: there is no black key between E and F. The map follows physical QWERTY positions (`Digit1`, `KeyQ`, …).

- A single note is decided by the first new pitch class.
- A chord is correct when every pitch class has been played, in any order. An outside pitch class fails the question immediately.
- A correct answer moves on by itself. After a miss, a timeout, or “看答案”, press Enter or 下一题.
- Presets 入门, 简单, 中等, 困难, 低音, and 中音 cover clef sets (including alto and tenor), range, key signatures, chord size, and a timer. Editing any control switches to 自定义 and applies on the next question. Choosing a preset starts a new round. 自然音 locks the key to C major and disables the signature and chromatic controls.
- 声音 uses a small Web Audio synth. A miss plays the key you pressed, then the printed chord. 连接 MIDI asks for Web MIDI and feeds the same pitch-class answers.

Settings and lifetime stats stay in `localStorage` under `sightread.settings.v1` and `sightread.stats.v1`. 错题记录 is the last twelve misses and survives a refresh. Older stats files without that list load as empty.

## Architecture

The app is client-only. Generation, scoring, and persistence are ordinary TypeScript, so there is no Python service in this slice.

```
src/music/        MusicTheory, ExerciseGenerator, AnswerChecker, presets, keyboard map
src/notation/     StaffRenderer (VexFlow SVG)
src/audio/        PianoSynth
src/midi/         MidiPorts
src/storage/      ProgressStore
src/session/      PracticeRound (pure state) and usePracticeSession (sound, timer, storage)
src/components/   practice screen, built with React, Tailwind, and shadcn/ui
```

`MusicTheory` spells pitches in a key signature and decides which accidental glyph to print. A diatonic F♯ in G major is drawn on F with no extra accidental; F♮ prints a natural. `usesLedgerLine` reports whether a spelling sits on a ledger line. `StaffRenderer` turns an exercise into a VexFlow `StaveNote` (whole note, one or more noteheads) on the treble, bass, alto, or tenor clef. Chord tones never share a staff letter, so C and C♯ are not stacked.

`PracticeRound` decides question, feedback, and summary. The hook only plays audio, writes `ProgressStore`, and auto-advances a correct answer. `ExerciseGenerator.next(settings, rng)` is the extension point for new questions. `AnswerChecker` only sees pitch classes, so keyboard, mouse, and MIDI stay on one path.

## Extending exercises

1. Add a preset object in `src/music/presets.ts`. Keep `sound` out of the preset; `PracticePresets.apply` preserves the current sound toggle.
2. To change what can be asked, edit `ExerciseGenerator`. It picks a key inside `minFifths`/`maxFifths`, a clef whose readable window overlaps the MIDI range, then distinct pitch classes on distinct staff letters. `chromaticProbability` is the chance a chord tone leaves the key. Naturals mode never emits black keys and only uses C major.
3. A new clef needs a `Clef` union member, a window, bottom-line spelling, and label in `CLEF_INFO`, and a VexFlow clef name. `usesLedgerLine` reads the bottom line.
4. Rhythm is not scored. A later mode can put a duration on `Exercise` and pass it to `StaveNote` instead of `w`. Keep `AnswerChecker` for pitch until there is a separate rhythm check.
5. Exact-octave grading would be a mode inside `AnswerChecker`. Do not fork the input handlers; they should keep reporting a pitch class or a MIDI note into that one checker.

Tests in `src/**/*.test.ts` cover spelling and ledger lines, seeded generation (every clef, key signatures, chords, printed accidentals), preset bounds, the practice round, chord scoring, the key map, staff SVG structure, and storage including a stats file from before 错题记录. Run them with `npm test`.
