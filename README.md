[English](README.md) · [中文](README.zh-CN.md)

# 识谱训练工具

Keyboard-first sight-reading practice. A line of notes is engraved on a staff; you answer each one from left to right on the computer keyboard, the on-screen piano, or a MIDI keyboard. Scoring uses pitch class (C♯ and D♭ are the same key) and ignores octave, so one octave of keys can name any staff position. Rhythm is not scored.

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
| Numpad `1`–`7` | the same white keys as the number row |
| `Q` `W` `R` `T` `Y` | C♯/D♭, D♯/E♭, F♯/G♭, G♯/A♭, A♯/B♭ |

`E` is unused: there is no black key between E and F. The map follows physical positions (`Digit1`, `Numpad1`, `KeyQ`, …), not the character the current input method would type.

- The staff shows a line of notes, by default 4–8 of them (configurable). Answer from left to right. The current note is highlighted; notes already answered stay green or red. When the line is finished, a new one appears. Each note or chord counts as one question toward the round.
- A single note is decided by the first new pitch class.
- A chord is correct when every pitch class has been played, in any order. An outside pitch class fails that note immediately.
- A correct answer moves on by itself. A wrong answer is stored in 错题记录 and also moves on after a short pause (default 0.5 seconds, configurable in 答错后停留). You do not have to play the right key first. After a timeout or “看答案”, press Enter or 下一题.
- Numpad 1–7 use `KeyboardEvent.code` values `Numpad1`–`Numpad7`. Num Lock does not matter: those codes stay on the physical numpad keys. If a browser reports a navigation code such as `Home` while Num Lock is off, it counts only when the event location is the numeric keypad, so the main arrow keys are left alone.
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

`PracticeRound` decides question, feedback, and summary. A snapshot keeps a cursor and a correct/wrong mark for each slot on the line. The hook only plays audio, writes `ProgressStore`, and auto-advances: 720ms after a correct answer, and `wrongAdvanceMs` (default 500) after a wrong one. `ExerciseGenerator.next(settings, rng)` is the extension point for new questions. It builds one line that shares a clef and a key. `AnswerChecker` only sees pitch classes, so keyboard, mouse, and MIDI stay on one path.

## Extending exercises

1. Add a preset object in `src/music/presets.ts`. Keep `sound` out of the preset; `PracticePresets.apply` preserves the current sound toggle.
2. To change what can be asked, edit `ExerciseGenerator`. It picks a key inside `minFifths`/`maxFifths`, a clef whose readable window overlaps the MIDI range, a line length inside `lineLengthMin`/`lineLengthMax`, then — for each slot — distinct pitch classes on distinct staff letters. `chromaticProbability` is the chance a chord tone leaves the key. Naturals mode never emits black keys and only uses C major. Pass a remaining-question count as the third argument when the last line of a round should be shorter.
3. A new clef needs a `Clef` union member, a window, bottom-line spelling, and label in `CLEF_INFO`, and a VexFlow clef name. `usesLedgerLine` reads the bottom line.
4. Rhythm is not scored. `StaffRenderer` draws each slot as a quarter note so the line has a left-to-right order; that duration is only spacing. A later mode can put a real duration on each slot and pass it to `StaveNote`. Keep `AnswerChecker` for pitch until there is a separate rhythm check.
5. Exact-octave grading would be a mode inside `AnswerChecker`. Do not fork the input handlers; they should keep reporting a pitch class or a MIDI note into that one checker.

Tests in `src/**/*.test.ts` cover spelling and ledger lines, seeded generation (every clef, key signatures, chords, printed accidentals), preset bounds, the practice round, chord scoring, the key map, staff SVG structure, and storage including a stats file from before 错题记录. Run them with `npm test`.
