import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAdvice } from '../src/index.js';

test('parseAdvice accepts fenced JSON and ignores extra prose', () => {
  const advice = parseAdvice(
    '好的，建议如下：\n```json\n{"summary":"先解场","steps":[{"actionId":"atk-10-t-30","text":"用水元素攻击银背族长"},{"text":"保留寒冰箭"}],"risk":"有奥秘"}\n```'
  );
  assert.equal(advice.summary, '先解场');
  assert.equal(advice.fallback, false);
  assert.equal(advice.steps.length, 2);
  assert.equal(advice.steps[0]?.actionId, 'atk-10-t-30');
  assert.equal(advice.steps[1]?.actionId, null);
  assert.equal(advice.risk, '有奥秘');
});

test('parseAdvice rejects a response without the required fields', () => {
  assert.throws(() => parseAdvice('{"summary":"只有一句话"}'));
  assert.throws(() => parseAdvice('这不是 JSON'));
});
