import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { KeyboardMap } from '@/music/keyboard';

/** 键位说明。对话框打开时，练习页看到 role=dialog 就不再把按键当成答案。 */
export function HelpDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          怎么弹
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>键盘与 MIDI</DialogTitle>
          <DialogDescription>
            练习按音名记分。C4 和 C5 都按 C。谱号和加线告诉你音高在哪里，键盘只回答音名。
          </DialogDescription>
        </DialogHeader>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
          {KeyboardMap.keys.map((key) => (
            <li key={key.code}>
              <span className="font-medium">{key.legend}</span>
              <span className="text-muted-foreground"> {key.name}{key.alias ? ` / ${key.alias}` : ''}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>谱上是一行音，从左到右答。当前音会高亮，答过的音留下对或错的颜色。这一行答完就换新的一行。</p>
          <p>小键盘 1–7（Numpad1–Numpad7）和主键盘数字行一样，对应 C D E F G A B。按的是物理键，Num Lock 开或关都可以。</p>
          <p>和弦要找齐每一个音。按错一个，这一音就结束，并留下正确答案。</p>
          <p>答对会自动进入下一个音。答错会记入错题，稍等片刻后也自动前进，不必再补按正确答案。超时或看答案后，按 Enter 或点「下一题」。</p>
          <p>MIDI 键盘走同一套音名判断。浏览器需要支持 Web MIDI，并允许访问设备。</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
