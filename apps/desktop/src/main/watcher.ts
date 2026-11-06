import { resolvePowerLog, snapshotFromRaw, type BoardSnapshot, type LogEnv, PowerParser } from '@hs-coach/parser';
import fs from 'node:fs';
import os from 'node:os';
import { StringDecoder } from 'node:string_decoder';

export interface LogUpdate {
  file: string | null;
  searched: string[];
  lines: number;
  board: BoardSnapshot | null;
  error: string | null;
}

function envFromProcess(): LogEnv {
  return {
    home: os.homedir(),
    localAppData: process.env.LOCALAPPDATA,
    programFiles: process.env.ProgramFiles,
    programFilesX86: process.env['ProgramFiles(x86)']
  };
}

/**
 * Tails the newest Power.log. Reads bytes only — it never writes to the game or sends input.
 */
export class LogWatcher {
  private timer: NodeJS.Timeout | null = null;
  private offset = 0;
  private current: string | null = null;
  private parser = new PowerParser();
  private decoder = new StringDecoder('utf8');
  private busy = false;
  private queued = false;

  constructor(
    private readonly explicitPath: () => string,
    private readonly onUpdate: (update: LogUpdate) => void
  ) {}

  start(): void {
    this.stop();
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private tick(): void {
    const resolved = resolvePowerLog(this.explicitPath(), process.platform, envFromProcess());
    if (resolved.file !== this.current) {
      this.current = resolved.file;
      this.offset = 0;
      this.parser.reset();
      this.decoder = new StringDecoder('utf8');
      if (!resolved.file) {
        this.onUpdate({ file: null, searched: resolved.searched, lines: 0, board: null, error: null });
        return;
      }
    }
    if (this.current) void this.read(this.current, resolved.searched);
  }

  private async read(file: string, searched: string[]): Promise<void> {
    if (this.busy) {
      this.queued = true;
      return;
    }
    this.busy = true;
    try {
      const stat = await fs.promises.stat(file);
      if (!stat.isFile()) return;
      if (stat.size < this.offset) {
        this.offset = 0;
        this.parser.reset();
        this.decoder = new StringDecoder('utf8');
      }
      if (stat.size > this.offset) {
        const handle = await fs.promises.open(file, 'r');
        try {
          const buf = Buffer.alloc(256 * 1024);
          let pos = this.offset;
          while (pos < stat.size && this.current === file) {
            const { bytesRead } = await handle.read(buf, 0, buf.length, pos);
            if (bytesRead <= 0) break;
            pos += bytesRead;
            this.parser.push(this.decoder.write(buf.subarray(0, bytesRead)));
          }
          this.offset = pos;
        } finally {
          await handle.close();
        }
      }
      if (this.current !== file) return;
      this.onUpdate({
        file,
        searched,
        lines: this.parser.linesParsed,
        board: snapshotFromRaw(this.parser.raw(), 'log'),
        error: null
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法读取日志';
      this.onUpdate({ file, searched, lines: this.parser.linesParsed, board: null, error: message });
    } finally {
      this.busy = false;
      if (this.queued) {
        this.queued = false;
        this.tick();
      }
    }
  }
}
