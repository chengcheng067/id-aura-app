import { Confidence } from '../types/enums';

/**
 * 合同解析器对外类型（纯数据，无 IO 依赖）。
 */

/** 单字段候选值 */
export interface FieldCandidate {
  /** 归一化后的日期/金额/文本值（日期为 YYYY-MM-DD） */
  value: string;
  /** 原文匹配片段（供人工核对定位） */
  snippet: string;
  /** 在原文中的字符偏移 */
  offset: number;
}

/** 单字段的解析结论 */
export interface ParsedField {
  candidates: FieldCandidate[];
  confidence: Confidence;
  warnings: string[];
}

/** 付款条款挖掘出的阶段佐证线索 */
export interface PaymentClauseHint {
  text: string;
  percent: number | null;
  stageHintOrderIndex: number | null;
  stageHintName: string | null;
  matchedKeyword: string | null;
}

export interface ContractParseResult {
  signedDate: ParsedField | null;
  startDate: ParsedField | null;   // 开工/进场
  endDate: ParsedField | null;     // 竣工/完工/验收
  durationDays: number | null;
  durationUnit: 'calendar' | 'business' | null;
  paymentClauses: PaymentClauseHint[];
  warnings: string[];
}
