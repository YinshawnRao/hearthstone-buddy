export type TtsBackend = 'off' | 'command' | 'os-speech';

export interface TtsSettings {
  enabled: boolean;
  backend: TtsBackend;
  command: string;
  args: string[];
}

const BLOCKED = new Set(['cmd.exe', 'powershell.exe', 'pwsh.exe', 'bash', 'bash.exe', 'sh', 'cmd']);

export function sanitizeSpeechText(text: string): string {
  return text.replace(/\0/g, '').replace(/\s+/g, ' ').trim().slice(0, 280);
}

export function planCommandTts(settings: TtsSettings, text: string): { ok: true; command: string; args: string[] } | { ok: false; reason: string } {
  if (!settings.enabled || settings.backend !== 'command') return { ok: false, reason: '命令行语音没有打开。' };
  const spoken = sanitizeSpeechText(text);
  if (!spoken) return { ok: false, reason: '没有可朗读的文字。' };
  const command = settings.command.trim();
  const absolute = /^(?:[A-Za-z]:[\\/]|\\\\|\/)/.test(command);
  if (!command || command.includes('\0') || !absolute) {
    return { ok: false, reason: '请填写语音程序的绝对路径。' };
  }
  const base = command.split(/[/\\]/).pop()?.toLowerCase() ?? '';
  if (BLOCKED.has(base)) return { ok: false, reason: '开放语音后端不能调用系统 shell。系统语音请改用单独的操作系统语音选项。' };
  let replaced = false;
  const args = settings.args.map((arg) => {
    if (arg.includes('{{text}}')) {
      replaced = true;
      return arg.split('{{text}}').join(spoken);
    }
    return arg;
  });
  if (!replaced) return { ok: false, reason: '参数里需要单独一项 {{text}}，文字不会拼进 shell。' };
  if (args.some((arg) => arg.includes('\0'))) return { ok: false, reason: '参数无效。' };
  return { ok: true, command, args };
}

export function planOsSpeech(): { command: string; args: string[]; stdin: true; label: '操作系统语音，不是随应用打包的开源语音' } {
  return {
    command: 'powershell.exe',
    args: [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      'Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Speak([Console]::In.ReadToEnd())'
    ],
    stdin: true,
    label: '操作系统语音，不是随应用打包的开源语音'
  };
}
