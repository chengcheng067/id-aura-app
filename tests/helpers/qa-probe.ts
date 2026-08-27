/* QA 临时探测脚本（验收后删除）：校准补充测试的断言口径 */
import { parseContract } from '../../src/core/contract-parser';
import type { ParsedField } from '../../src/core/contract-parser/types';

const f = (pf: ParsedField | null): string =>
  pf ? `${pf.candidates.map((c) => c.value).join('|')}[${pf.confidence}]` : 'null';

const show = (label: string, t: string): void => {
  const r = parseContract(t);
  console.log(
    label,
    'signed=' + f(r.signedDate),
    'start=' + f(r.startDate),
    'end=' + f(r.endDate),
    'dur=' + r.durationDays + '/' + r.durationUnit,
    'warn=' + JSON.stringify(r.warnings),
  );
};

show('empty     :', '');
show('gibberish :', '@#$%^&*()!????____ random junk 12345 ###');
show('no-anchor :', '这里完全没有日期相关的词汇存在，就是一段平淡的描述文字而已。');
const noise = parseContract('本单据仅作为物料领用凭证。2025.03.05 前需使用完毕。与工程进度无关。');
console.log('noise-end:', JSON.stringify(noise.endDate), 'noise-start:', JSON.stringify(noise.startDate));

show('short-real:', '合同。2026年9月1日签订。');
