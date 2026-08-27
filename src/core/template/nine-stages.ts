import type { NineStagesTemplateFile } from '../../core/types/dto';
import rawTemplate from '../../../templates/nine-stages.default.json';

/**
 * templates/nine-stages.default.json 的强类型访问器（铁律 9）：
 * 模板默认值只存在于该 JSON，代码不得硬编码第二份。
 */

const template = rawTemplate as unknown as NineStagesTemplateFile;

/** 模板阶段定义（顺序按 orderIndex 升序） */
export function getTemplateStages(): NineStagesTemplateFile['stages'] {
  return [...template.stages].sort((a, b) => a.orderIndex - b.orderIndex);
}

/** 单段模板（找不到抛错——九段固定不可缺） */
export function getTemplateStage(orderIndex: number): NineStagesTemplateFile['stages'][number] {
  const found = template.stages.find((s) => s.orderIndex === orderIndex);
  if (!found) {
    throw new Error(`九阶段模板缺少 orderIndex=${orderIndex} 的定义（templates/nine-stages.default.json）`);
  }
  return found;
}

export function getTemplateVersion(): number {
  return template.version;
}

/** 模板占比合计自检（应恒为 100） */
export function validateTemplateRatios(): boolean {
  const total = template.stages.reduce((sum, s) => sum + s.ratioPercent, 0);
  return total === 100;
}
