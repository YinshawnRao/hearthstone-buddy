import type { Advice } from '@hs-coach/parser';
import type { AppStatus } from '../../../shared/types';

export function AdvicePanel({
  advice,
  status,
  inGame,
  busy,
  onAnalyze,
  onOpenSettings
}: {
  advice: Advice | null;
  status: AppStatus;
  inGame: boolean;
  busy: boolean;
  onAnalyze: () => void;
  onOpenSettings: () => void;
}) {
  const unconfigured = status.llm === 'unconfigured';
  return (
    <aside className="advice">
      <div className="scroll-cap" />
      <p className="eyebrow">军师笺</p>
      <h2>{advice?.summary ?? (unconfigured ? '先接上一个模型' : inGame ? '局面已经就绪' : '等待对局')}</h2>
      {advice && !advice.fallback && advice.steps.length > 0 ? (
        <ol className="steps">
          {advice.steps.map((step, index) => (
            <li key={`${step.actionId ?? 'x'}-${index}`}>
              <span>{index + 1}</span>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="lead">
          {advice?.detail ||
            (unconfigured
              ? '演示场面可以先看。要出建议，请在设置里填写 OpenAI 兼容接口，或改用本机 Ollama。密钥只留在这台电脑上。'
              : inGame
                ? '把当前场面和候选动作发给模型。模型只返回文字建议，不会替你出牌。'
                : '打开演示局面，或等 Power.log 里出现一局进行中的对战。')}
        </p>
      )}
      {advice && !advice.fallback && advice.risk ? (
        <div className="risk">
          <p className="eyebrow">风险</p>
          <p>{advice.risk}</p>
        </div>
      ) : null}
      {advice?.fallback && advice.detail && advice.summary !== '先接上一个模型' ? <p className="lead warn">{advice.detail}</p> : null}
      <div className="advice-actions">
        <button type="button" className="primary" disabled={busy || !inGame || unconfigured} onClick={onAnalyze}>
          {busy ? '分析中…' : advice && !advice.fallback ? '重新分析' : '分析局面'}
        </button>
        {unconfigured ? (
          <button type="button" className="ghost" onClick={onOpenSettings}>
            打开设置
          </button>
        ) : null}
      </div>
      <p className="fine">只读分析。hs-coach 不移动鼠标，也不向炉石进程注入操作。</p>
    </aside>
  );
}
