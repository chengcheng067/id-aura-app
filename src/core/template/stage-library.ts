import type {
  StagePreset,
  StageTemplateItem,
  StageTemplateLibraryFile,
} from '../types/dto';
import rawLibrary from '../../../templates/stage-library.json';

/**
 * templates/stage-library.json 的强类型访问器（铁律 9）：
 * 阶段模板默认值只存在于该 JSON，代码不得硬编码第二份。
 *
 * 与 nine-stages.ts 的分工：
 *   - nine-stages.ts 仍是「固定九段」的回归锚点（过渡期保留）；
 *   - 本文件是阶段模板库的唯一出口（阶段项 + 套餐），供建档选择、取色、看板分桶使用。
 */

const library = rawLibrary as unknown as StageTemplateLibraryFile;

/** 全部阶段项（按 JSON 声明顺序：室内 → 景观 → 建筑） */
export function getStageLibraryItems(): StageTemplateItem[] {
  return library.items;
}

/** 单个阶段项（找不到抛错——阶段项 key 一旦落库即不可缺失） */
export function getStageLibraryItem(key: string): StageTemplateItem {
  const found = library.items.find((item) => item.key === key);
  if (!found) {
    throw new Error(`阶段模板库缺少 key=${key} 的定义（templates/stage-library.json）`);
  }
  return found;
}

/** 全部阶段套餐（按 JSON 声明顺序） */
export function getPresets(): StagePreset[] {
  return library.presets;
}

/** 单个套餐（找不到返回 null） */
export function getPreset(key: string): StagePreset | null {
  return library.presets.find((p) => p.key === key) ?? null;
}

/** 套餐的阶段项列表（按 itemKeys 顺序返回；未知 key 一律跳过，不抛错） */
export function getPresetItems(presetKey: string): StageTemplateItem[] {
  const preset = getPreset(presetKey);
  if (!preset) return [];
  const byKey = new Map(library.items.map((item) => [item.key, item]));
  return preset.itemKeys
    .map((key) => byKey.get(key))
    .filter((item): item is StageTemplateItem => Boolean(item));
}

/** 阶段模板库版本（Project.stageTemplateVersion 的取值来源） */
export function getStageLibraryVersion(): number {
  return library.version;
}
