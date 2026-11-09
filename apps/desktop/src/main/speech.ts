import { spawn, type ChildProcess } from 'node:child_process';
import { planCommandTts, planOsSpeech, sanitizeSpeechText, type TtsSettings } from '../shared/tts';

let current: ChildProcess | null = null;
let generation = 0;

export function cancelSpeech(): void {
  generation += 1;
  if (current && !current.killed) current.kill();
  current = null;
}

export async function speakText(settings: TtsSettings, text: string): Promise<{ ok: boolean; message: string }> {
  const spoken = sanitizeSpeechText(text);
  if (!settings.enabled || settings.backend === 'off') return { ok: false, message: '语音关闭。' };
  if (!spoken) return { ok: false, message: '没有可朗读的文字。' };
  cancelSpeech();
  const token = generation;
  if (settings.backend === 'os-speech') {
    if (process.platform !== 'win32') return { ok: false, message: '操作系统语音只在 Windows 上尝试，这里不会假装已经出声。' };
    const plan = planOsSpeech();
    return runChild(plan.command, plan.args, spoken, token);
  }
  const plan = planCommandTts(settings, spoken);
  if (!plan.ok) return { ok: false, message: plan.reason };
  return runChild(plan.command, plan.args, '', token);
}

function runChild(command: string, args: string[], stdin: string, token: number): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve) => {
    let child: ChildProcess;
    try {
      child = spawn(command, args, { shell: false, windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    } catch (error) {
      resolve({ ok: false, message: error instanceof Error ? error.message : '无法启动语音程序。' });
      return;
    }
    current = child;
    let failed = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      failed = `${failed}${chunk.toString('utf8')}`.slice(0, 240);
    });
    child.once('error', (error) => {
      if (token !== generation) return;
      resolve({ ok: false, message: error.message });
    });
    child.once('exit', (code) => {
      if (token !== generation) {
        resolve({ ok: false, message: '已取消朗读。' });
        return;
      }
      if (code === 0) resolve({ ok: true, message: '语音程序已结束。这不保证扬声器一定出声。' });
      else resolve({ ok: false, message: failed || `语音程序退出码 ${code ?? '未知'}。已退回纯文字。` });
    });
    if (stdin) child.stdin?.end(stdin);
    else child.stdin?.end();
  });
}
