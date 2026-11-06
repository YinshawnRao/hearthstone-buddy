import { useCallback, useEffect, useState } from 'react';
import type { AppStatus, ViewState } from '../../shared/types';
import { AdvicePanel } from './components/AdvicePanel';
import { BoardView } from './components/BoardView';
import { CardInspect } from './components/HsCard';
import { SettingsDrawer } from './components/SettingsDrawer';

function clock(iso: string | null): string {
  if (!iso) return '尚无更新';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '尚无更新';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function shortPath(file: string): string {
  const parts = file.split(/[/\\]/).filter(Boolean);
  return parts.slice(-2).join('/');
}

function watchLabel(status: AppStatus): string {
  if (status.mode === 'demo') return '演示局面';
  if (status.logError) return '日志读取失败';
  if (status.watching && status.logPath) return `正在监视 · ${shortPath(status.logPath)}`;
  return '未找到 Power.log';
}

function modelLabel(status: AppStatus): string {
  if (status.llm === 'thinking') return '分析中';
  if (status.llm === 'ok') return `建议已更新 · ${status.modelLabel}`;
  if (status.llm === 'error') return '模型调用失败';
  if (status.llm === 'ready') return `模型就绪 · ${status.modelLabel}`;
  return '未配置模型';
}

export function App() {
  const [state, setState] = useState<ViewState | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [inspect, setInspect] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    const api = window.hsCoach;
    if (!api) {
      setBootError('界面没有连上桌面进程。请在仓库根目录运行 npm run dev。');
      return;
    }
    let alive = true;
    void api.getState().then((next) => {
      if (alive) setState(next);
    }).catch((error: unknown) => {
      if (alive) setBootError(error instanceof Error ? error.message : '无法读取应用状态');
    });
    const offState = api.onState((next) => setState(next));
    const offSettings = api.onOpenSettings(() => setDrawer(true));
    const offInspect = api.onInspect((cardId) => setInspect(cardId || null));
    return () => {
      alive = false;
      offState();
      offSettings();
      offInspect();
    };
  }, []);

  const openSettings = useCallback(() => setDrawer(true), []);
  const closeSettings = useCallback(() => setDrawer(false), []);

  if (bootError) {
    return (
      <main className="boot">
        <span className="seal">炉</span>
        <h1>hs-coach</h1>
        <p>{bootError}</p>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="boot">
        <span className="seal">炉</span>
        <h1>hs-coach</h1>
        <p>正在打开炉边…</p>
      </main>
    );
  }

  const { board, status, advice, settings } = state;
  const demo = status.mode === 'demo';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="seal">炉</span>
          <div>
            <strong>hs-coach</strong>
            <small>对局参谋</small>
          </div>
        </div>
        <div className="status">
          <span className={status.watching || demo ? 'chip on' : 'chip warn'}>{watchLabel(status)}</span>
          <span className="chip">更新 {clock(status.lastUpdate)}</span>
          <span className={status.llm === 'error' ? 'chip warn' : status.llm === 'ok' || status.llm === 'ready' ? 'chip on' : 'chip'}>
            {modelLabel(status)}
          </span>
        </div>
        <div className="top-actions">
          <button
            type="button"
            className={demo ? 'pill on' : 'pill'}
            onClick={() => {
              void window.hsCoach?.saveSettings({ ...settings, demoMode: !demo }).then(setState);
            }}
          >
            演示局面
          </button>
          <button type="button" className="pill" onClick={openSettings}>
            设置
          </button>
        </div>
      </header>

      <main className="layout">
        <BoardView board={board} onInspect={setInspect} />
        <AdvicePanel
          advice={advice}
          status={status}
          inGame={board.inGame}
          busy={status.llm === 'thinking'}
          onAnalyze={() => {
            void window.hsCoach?.analyze().then(setState);
          }}
          onOpenSettings={openSettings}
        />
      </main>

      <footer className="foot">
        <span>只分析，不代打</span>
        {status.mode === 'live' && status.linesParsed > 0 ? <span>已解析 {status.linesParsed} 行</span> : <span>Power.log · 启发式动作</span>}
        {status.logError ? <span>{status.logError}</span> : null}
      </footer>

      <SettingsDrawer
        open={drawer}
        settings={settings}
        searched={status.searched}
        onClose={closeSettings}
        onSave={(next) => {
          void window.hsCoach?.saveSettings(next).then((saved) => {
            setState(saved);
            setDrawer(false);
          });
        }}
      />
      {inspect ? <CardInspect cardId={inspect} onClose={() => setInspect(null)} /> : null}
    </div>
  );
}
