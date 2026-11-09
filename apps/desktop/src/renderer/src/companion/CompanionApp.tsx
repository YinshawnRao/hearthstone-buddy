import { useEffect, useState } from 'react';
import type { ViewState } from '../../../shared/types';
import { boardKey } from '@hearthstone-buddy/parser';
import { decideBubble, type Expression } from '../../../shared/bubble';
import { findCharacter } from '../../../shared/characters';
import { Cheng } from './Cheng';
import './companion.css';

function useTypewriter(text: string, enabled: boolean): { shown: string; done: boolean; skip: () => void } {
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(!enabled);
  useEffect(() => {
    setCount(0);
    setDone(!enabled || text.length === 0);
  }, [text, enabled]);
  useEffect(() => {
    if (!enabled || count >= text.length) return;
    const timer = window.setTimeout(() => {
      const next = count + 1;
      setCount(next);
      if (next >= text.length) setDone(true);
    }, 28);
    return () => window.clearTimeout(timer);
  }, [count, enabled, text]);
  return { shown: enabled ? text.slice(0, count) : text, done: done || count >= text.length, skip: () => { setCount(text.length); setDone(true); } };
}

export function CompanionApp() {
  const [state, setState] = useState<ViewState | null>(null);
  const [openDetail, setOpenDetail] = useState(false);
  const [forced, setForced] = useState(false);
  useEffect(() => {
    const api = window.hsCoach;
    if (!api) return;
    void api.getState().then(setState);
    return api.onState(setState);
  }, []);
  useEffect(() => {
    const root = document.querySelector('.companion-root');
    const move = (event: MouseEvent) => {
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      const interactive = Boolean(hit?.closest('[data-interactive]'));
      void window.hsCoach?.setClickThrough(!interactive);
    };
    window.addEventListener('mousemove', move);
    return () => {
      window.removeEventListener('mousemove', move);
      root?.classList.remove('hot');
    };
  }, []);
  const decision = state
    ? decideBubble({
        mode: forced ? 'coach' : state.settings.companionMode,
        boardKey: boardKey(state.board),
        advice: state.advice,
        thinking: state.status.llm === 'thinking',
        now: Date.now()
      })
    : null;
  const typed = useTypewriter(decision?.text ?? '', Boolean(state && decision?.show && !state.settings.lowMotion));
  if (!state || !decision) return <main className="companion-root" />;
  const character = findCharacter(state.settings.characterId);
  const expression: Expression = decision.expression;
  const preview = new URLSearchParams(window.location.search).get('preview') === '1';
  return (
    <main className={preview ? 'companion-root preview' : 'companion-root'}>
      <div className="companion-stack" data-interactive="true">
        <div className="drag-handle" />
        {decision.show || forced ? (
          <section className="bubble" data-interactive="true" onClick={() => !typed.done && typed.skip()}>
            <p className="who">{character.name} · {state.settings.companionMode === 'quiet' ? '安静' : state.settings.companionMode === 'companion' ? '陪伴' : '参谋'}</p>
            <p>{typed.shown}</p>
            {openDetail ? <p className="detail">{decision.detail}</p> : null}
            <div className="bubble-actions">
              {!typed.done ? <button type="button" onClick={typed.skip}>跳过</button> : null}
              <button type="button" onClick={() => setOpenDetail((value) => !value)}>{openDetail ? '收起' : '展开理由'}</button>
            </div>
          </section>
        ) : null}
        <div data-interactive="true" onClick={() => setForced(true)}>
          <Cheng expression={expression} lowMotion={state.settings.lowMotion} />
        </div>
        <div className="companion-controls" data-interactive="true">
          <button type="button" onClick={() => void window.hsCoach?.cycleMode()}>模式</button>
          <button type="button" onClick={() => void window.hsCoach?.replayAdvice()}>再说</button>
          <button type="button" onClick={() => void window.hsCoach?.showLauncher()}>启动器</button>
          <button type="button" onClick={() => void window.hsCoach?.hideCompanion()}>隐藏</button>
          <button type="button" onClick={() => void window.hsCoach?.quit()}>退出</button>
        </div>
      </div>
    </main>
  );
}
