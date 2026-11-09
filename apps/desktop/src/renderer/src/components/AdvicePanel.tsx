import type { Advice, BoardSnapshot } from '@hs-coach/parser';
import type { AppStatus } from '../../../shared/types';

export function AdvicePanel({
  advice,
  board,
  status,
  inGame,
  busy,
  onAnalyze,
  onOpenSettings
}: {
  advice: Advice | null;
  board: BoardSnapshot;
  status: AppStatus;
  inGame: boolean;
  busy: boolean;
  onAnalyze: () => void;
  onOpenSettings: () => void;
}) {
  const unconfigured = status.llm === 'unconfigured';
  const local = advice?.source === 'offline';
  return (
    <aside className="advice">
      <div className="scroll-cap" />
      <p className="eyebrow">军师笺 · 规则 {board.assessment.knowledgeVersion}</p>
      <h2>{advice?.summary ?? (unconfigured ? '可以先做本地分析' : inGame ? '局面已经就绪' : '等待对局')}</h2>
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
              ? '没有模型也会用本地规则和卡牌目录做一版建议。接上模型后，仍只允许合法动作编号。'
              : inGame
                ? '分析会带上规则范围、卡面文字和通用启发式。模型不能编造对手手牌。'
                : '打开演示局面，或等 Power.log 里出现一局进行中的对战。')}
        </p>
      )}
      {advice?.alternatives && advice.alternatives.length > 0 ? (
        <div>
          <p className="eyebrow">另一条</p>
          {advice.alternatives.map((step) => (
            <p key={step.text} className="lead">{step.text}</p>
          ))}
        </div>
      ) : null}
      {advice?.uncertainty ? (
        <p className="lead">{advice.uncertainty}</p>
      ) : null}
      {board.assessment.warnings.length > 0 && !advice ? (
        <ul className="warn-list">
          {board.assessment.warnings.slice(0, 3).map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {advice && !advice.fallback && advice.risk ? (
        <div className="risk">
          <p className="eyebrow">风险</p>
          <p>{advice.risk}</p>
        </div>
      ) : null}
      {advice?.fallback && advice.detail ? <p className="lead warn">{advice.detail}</p> : null}
      {local ? <p className="fine">{advice?.detail}</p> : null}
      <div className="advice-actions">
        <button type="button" className="primary" disabled={busy || !inGame} onClick={onAnalyze}>
          {busy ? '分析中…' : advice && !advice.fallback ? '重新分析' : unconfigured ? '本地分析' : '分析局面'}
        </button>
        {unconfigured ? (
          <button type="button" className="ghost" onClick={onOpenSettings}>
            打开设置
          </button>
        ) : null}
      </div>
      <p className="fine">只读分析。炉石 Buddy 不移动鼠标，也不向炉石进程注入操作。</p>
    </aside>
  );
}
