/**
 * 置信度打分：锚点强度 × 格式规范性 × 候选多样性。
 * 产出 high/mid/low 三档；low 档 UI 一律置空呈现（宁可空值不输出看似确定的日期）。
 */

import { Confidence } from '../types/enums';
import type { ParsedField } from './types';

export interface ScoreInput {
  /** 锚点强度（anchors.ts 的 weight） */
  anchorWeight: number;
  /** 命中数（同一字段锚定的日期出现次数） */
  hits: number;
  /** 表述里是否含强限定词（如「须于…前」「不得晚于」） */
  hasQualifier: boolean;
}

export function scoreFieldConfidence(input: ScoreInput): Confidence {
  let score = input.anchorWeight;
  if (input.hits > 1) score += 0.15;
  if (input.hasQualifier) score += 0.1;
  // 单命中、弱锚点 → mid；无锚点或仅模式猜测 → low
  if (score >= 1.0 && input.hits >= 1) return Confidence.High;
  if (score >= 0.7) return Confidence.Mid;
  return Confidence.Low;
}

/** 组装 ParsedField：low 档仍保留候选供人工核对，但 UI 不默认带值 */
export function buildParsedField(
  candidates: import('./types').FieldCandidate[],
  confidence: Confidence,
  warnings: string[] = [],
): ParsedField {
  return {
    candidates,
    confidence,
    warnings,
  };
}
