[English](README.md) · [中文](README.zh-CN.md)

# 识谱训练工具

键盘优先的识谱练习。谱上刻一个音或一个和弦，用电脑键盘、屏幕钢琴或 MIDI 键盘作答。判分只看音级（C♯ 和 D♭ 是同一个键），不看八度，所以一个八度的键可以给任何谱位命名。

交互方式——难度标签、计题的一轮、数字行上的白键——参考 typepiano.org 的练习页。本项目不使用该站的代码、音频或图样。谱面用 [VexFlow](https://vexflow.com/) 绘制。

## 运行

需要 Node.js 22 或更新版本。

```bash
npm install
npm run dev
```

开发服务器是 http://127.0.0.1:43123。

```bash
npm test
npm run lint
npm run build
```

## 怎么练

| 按键 | 音 |
| --- | --- |
| `1` `2` `3` `4` `5` `6` `7` | C D E F G A B |
| `Q` `W` `R` `T` `Y` | C♯/D♭、D♯/E♭、F♯/G♭、G♯/A♭、A♯/B♭ |

`E` 不用：E 和 F 之间没有黑键。映射按物理 QWERTY 位置（`Digit1`、`KeyQ` 等），不看当前输入法打出来的字符。

- 单音由第一个新的音级决定对错。
- 和弦不限顺序，每个音级都按下才算对。按到目标以外的音级，这题立刻算错。
- 答对后自动进入下一题。答错、超时或点了「看答案」之后，按 Enter 或「下一题」。
- 预设有入门、简单、中等、困难、低音、中音，覆盖谱号（含中音与次中音）、音域、调号、和弦音数和计时。改任意一项会切到「自定义」，下一题才生效。点预设会立刻重开一轮。选「自然音」会把调锁在 C 大调，并禁用调号和变化音控件。
- 「声音」用一个很小的 Web Audio 合成器。答错时先响你按的音，再响谱上的和弦。「连接 MIDI」请求 Web MIDI，进来的音符走同一条音级判分。

设置和累计成绩存在 `localStorage`，键名是 `sightread.settings.v1` 和 `sightread.stats.v1`。「错题记录」保留最近十二条，刷新还在。更早的成绩文件里没有这份列表时，按空列表读取。

## 结构

只有前端。出题、判分和存储都是普通 TypeScript，这一版没有 Python 服务。

```
src/music/        MusicTheory、ExerciseGenerator、AnswerChecker、预设、键盘映射
src/notation/     StaffRenderer（VexFlow SVG）
src/audio/        PianoSynth
src/midi/         MidiPorts
src/storage/      ProgressStore
src/session/      PracticeRound（纯状态）和 usePracticeSession（声音、计时、存储）
src/components/   练习界面，React、Tailwind、shadcn/ui
```

`MusicTheory` 在调号里拼写音高，并决定要不要印变音记号。G 大调里的调内 F♯ 画在 F 上，不再另印升号；F♮ 会印还原号。`usesLedgerLine` 判断这个拼写是否落在加线上。`StaffRenderer` 把一道题画成 VexFlow 的 `StaveNote`（全音符，一个或多个符头），谱号可以是高音、低音、中音或次中音。和弦里的音不会共用同一个音名字母，所以不会把 C 和 C♯ 叠在一起。

`PracticeRound` 决定出题、反馈和本轮小结。Hook 只负责发声、写入 `ProgressStore`，以及答对后自动下一题。新题型从 `ExerciseGenerator.next(settings, rng)` 加。`AnswerChecker` 只看音级，键盘、鼠标和 MIDI 走同一条路。

## 怎样加题

1. 在 `src/music/presets.ts` 里加一个预设对象。预设里不要放 `sound`；`PracticePresets.apply` 会保留当前的声音开关。
2. 要改出什么题，改 `ExerciseGenerator`。它在 `minFifths` / `maxFifths` 里选调，再选一个可读窗口和 MIDI 音域有交集的谱号，然后抽不同音级、不同谱位字母的音。`chromaticProbability` 是某个和弦音离开调内的概率。自然音模式不出黑键，并且只用 C 大调。
3. 新谱号要在 `Clef` 联合类型里加一项，在 `CLEF_INFO` 里写窗口、最下方谱线的音名和标签，并给出 VexFlow 的谱号名。`usesLedgerLine` 读的就是这条底线。
4. 节奏目前不判分。以后可以在 `Exercise` 上加时值，传给 `StaveNote`，代替现在的 `w`。在单独做节奏判断之前，音高仍交给 `AnswerChecker`。
5. 若要按精确八度判分，做成 `AnswerChecker` 里的一种模式。不要把输入处理分叉；键盘和 MIDI 应继续把音级或 MIDI 音高交给这一个判断器。

`src/**/*.test.ts` 覆盖拼写和加线、带种子的出题（四种谱号、调号、和弦、印出来的变音记号）、预设边界、练习回合、和弦判分、键盘映射、谱面 SVG 结构，以及存储（含「错题记录」出现之前的旧成绩文件）。用 `npm test` 运行。
