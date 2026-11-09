import { useEffect, useState } from 'react';
import type { ProviderId, Settings } from '../../../shared/types';

const PROVIDERS: { id: ProviderId; title: string; hint: string }[] = [
  { id: 'openai', title: 'OpenAI 兼容', hint: 'OpenAI、DeepSeek、本地代理' },
  { id: 'anthropic', title: 'Anthropic', hint: 'Claude 官方接口' },
  { id: 'ollama', title: 'Ollama', hint: '本机模型，无需密钥' }
];

export function SettingsDrawer({
  open,
  settings,
  searched,
  onClose,
  onSave
}: {
  open: boolean;
  settings: Settings;
  searched: string[];
  onClose: () => void;
  onSave: (settings: Settings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (open) setDraft(settings);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const patch = (partial: Partial<Settings>): void => setDraft((current) => ({ ...current, ...partial }));
  const keyValue = draft.provider === 'anthropic' ? draft.anthropicApiKey : draft.openaiApiKey;

  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <aside className="drawer" role="dialog" aria-labelledby="settings-title" onClick={(event) => event.stopPropagation()}>
        <header className="drawer-head">
          <div>
            <p className="eyebrow">Settings</p>
            <h2 id="settings-title">设置</h2>
          </div>
          <button type="button" className="ghost tiny" onClick={onClose}>
            关闭
          </button>
        </header>
        <div className="drawer-scroll">
        <section>
          <h3>模型来源</h3>
          <div className="provider-grid">
            {PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                type="button"
                className={draft.provider === provider.id ? 'provider on' : 'provider'}
                onClick={() => patch({ provider: provider.id })}
              >
                <strong>{provider.title}</strong>
                <span>{provider.hint}</span>
              </button>
            ))}
          </div>

          {draft.provider === 'openai' ? (
            <>
              <label>
                接口地址 Base URL
                <input
                  value={draft.openaiBaseUrl}
                  spellCheck={false}
                  onChange={(event) => patch({ openaiBaseUrl: event.target.value })}
                />
              </label>
              <p className="fine">包含 /v1。DeepSeek 可用 https://api.deepseek.com/v1 。本地代理或 Codex 风格网关也填这里。</p>
              <label>
                模型名
                <input value={draft.openaiModel} spellCheck={false} onChange={(event) => patch({ openaiModel: event.target.value })} />
              </label>
            </>
          ) : null}

          {draft.provider === 'anthropic' ? (
            <>
              <label>
                接口地址 Base URL
                <input
                  value={draft.anthropicBaseUrl}
                  spellCheck={false}
                  onChange={(event) => patch({ anthropicBaseUrl: event.target.value })}
                />
              </label>
              <label>
                模型名
                <input
                  value={draft.anthropicModel}
                  spellCheck={false}
                  onChange={(event) => patch({ anthropicModel: event.target.value })}
                />
              </label>
            </>
          ) : null}

          {draft.provider === 'ollama' ? (
            <>
              <label>
                接口地址 Base URL
                <input
                  value={draft.ollamaBaseUrl}
                  spellCheck={false}
                  onChange={(event) => patch({ ollamaBaseUrl: event.target.value })}
                />
              </label>
              <p className="fine">默认 http://127.0.0.1:11434/v1 。不需要 API Key。模型名与 ollama list 里的名称一致。</p>
              <label>
                模型名
                <input value={draft.ollamaModel} spellCheck={false} onChange={(event) => patch({ ollamaModel: event.target.value })} />
              </label>
            </>
          ) : null}

          {draft.provider !== 'ollama' ? (
            <label>
              API Key
              <span className="key-row">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={keyValue}
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(event) => {
                    const value = event.target.value;
                    if (draft.provider === 'anthropic') patch({ anthropicApiKey: value });
                    else patch({ openaiApiKey: value });
                  }}
                />
                <button type="button" className="ghost tiny" onClick={() => setShowKey((value) => !value)}>
                  {showKey ? '隐藏' : '显示'}
                </button>
              </span>
            </label>
          ) : null}
          <p className="fine">密钥写入本机用户目录的 config.json，权限 600。不会提交到仓库。</p>
        </section>

        <section>
          <h3>Power.log</h3>
          <label>
            日志路径
            <input
              value={draft.logPath}
              placeholder="留空则自动寻找最新的 Power.log"
              spellCheck={false}
              onChange={(event) => patch({ logPath: event.target.value })}
            />
          </label>
          <div className="row-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => {
                void window.hsCoach?.chooseLog().then((next) => {
                  setDraft((current) => ({ ...current, logPath: next.settings.logPath, demoMode: next.settings.demoMode }));
                });
              }}
            >
              浏览文件
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                void window.hsCoach?.useAutoLog().then((next) => {
                  setDraft((current) => ({ ...current, logPath: next.settings.logPath }));
                });
              }}
            >
              恢复自动
            </button>
          </div>
          {searched.length > 0 ? (
            <details>
              <summary>自动探测过的目录</summary>
              <ul className="path-list">
                {searched.slice(0, 8).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          ) : (
            <p className="fine">Windows 默认在 %LOCALAPPDATA%\Blizzard\Hearthstone\Logs 下找最新的 Power.log。</p>
          )}
        </section>

        <section>
          <h3>陪伴与语音</h3>
          <label>
            说话方式
            <select value={draft.companionMode} onChange={(event) => patch({ companionMode: event.target.value as Settings['companionMode'] })}>
              <option value="coach">参谋：先说下一手</option>
              <option value="companion">陪伴：短句加下一手</option>
              <option value="quiet">安静：不主动开口</option>
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={draft.lowMotion} onChange={(event) => patch({ lowMotion: event.target.checked })} />
            <span><strong>减少动作</strong><small>关闭眨眼和呼吸动画。</small></span>
          </label>
          <label className="check">
            <input type="checkbox" checked={draft.ttsEnabled} onChange={(event) => patch({ ttsEnabled: event.target.checked })} />
            <span><strong>朗读气泡</strong><small>默认关闭。文字始终可用。</small></span>
          </label>
          <label>
            语音后端
            <select value={draft.ttsBackend} onChange={(event) => patch({ ttsBackend: event.target.value as Settings['ttsBackend'] })}>
              <option value="off">关闭</option>
              <option value="command">本机开源程序（填写绝对路径）</option>
              <option value="os-speech">操作系统语音（不是随应用打包的开源语音）</option>
            </select>
          </label>
          <label>
            语音程序
            <input value={draft.ttsCommand} spellCheck={false} placeholder="例如 C:\Tools\espeak-ng\espeak-ng.exe" onChange={(event) => patch({ ttsCommand: event.target.value })} />
          </label>
          <label>
            参数（一项一行，必须包含一行 {'{{text}}'}）
            <textarea value={draft.ttsArgs.join('\n')} spellCheck={false} onChange={(event) => patch({ ttsArgs: event.target.value.split(/\r?\n/).filter(Boolean) })} />
          </label>
          <label className="check">
            <input type="checkbox" checked={draft.autoAnalyze} onChange={(event) => patch({ autoAnalyze: event.target.checked })} />
            <span>
              <strong>场面变化时自动分析</strong>
              <small>会消耗接口额度或本机算力。默认关闭。</small>
            </span>
          </label>
        </section>
        </div>

        <button type="button" className="primary wide" onClick={() => onSave(draft)}>
          保存设置
        </button>
      </aside>
    </div>
  );
}
