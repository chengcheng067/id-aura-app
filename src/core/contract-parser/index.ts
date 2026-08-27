/**
 * parseContract() 编排出口：
 *   rawText → normalize → anchors → date.parser → duration.parser
 *           → payment-clauses → confidence ⇒ ContractParseResult
 * 纯函数、零 IO（架构 §1c）：给定字符串永远得到相同结果。
 */

import { extractSnippet, findAnchors, normalizeText, dedupeCandidates } from './anchors';
import { scoreFieldConfidence, buildParsedField } from './confidence';
import { extractDateHits, hitsToCandidates } from './date.parser';
import { extractDurationHits } from './duration.parser';
import { extractPaymentClauses } from './payment-clauses';
import type { ContractParseResult, FieldCandidate, ParsedField } from './types';

/** 带限定词判定：命中片段前后窗口出现强约束词 */
function hasQualifierNear(snippet: string): boolean {
  return /须于|不得晚于|之前完成|前完成|截止|最迟/.test(snippet);
}

/** 在锚点附近的日期命中中筛选（窗口 ±window 字符），支持多关键词并列取并集 */
function hitsNearAnchor<T extends { offset: number; length: number }>(
  text: string,
  anchorKeys: string[],
  hits: T[],
  window = 40,
): T[] {
  const anchors = findAnchors(text, anchorKeys);
  if (anchors.length === 0) return [];
  return hits.filter((h) =>
    anchors.some((a) => h.offset >= a.index - window && h.offset <= a.index + window),
  );
}

/** 签订日期锚点词族（覆盖签订/签署/订立/立约四类合同惯用表述） */
const SIGNED_ANCHOR_KEYS = ['签订', '签署', '订立', '立约'];

export function parseContract(rawText: string): ContractParseResult {
  const text = normalizeText(rawText);
  const warnings: string[] = [];

  if (text.trim().length < 20) {
    warnings.push('文本过短，识别可能不可靠，请人工核对或改用手动建档。');
  }

  const dateHits = extractDateHits(text);

  /* ---------------------------- 签订日期 ---------------------------- */
  const signedHits = hitsNearAnchor(text, SIGNED_ANCHOR_KEYS, dateHits, 50);
  const signedCands: FieldCandidate[] = dedupeCandidates(hitsToCandidates(text, signedHits));
  const signedConfidence =
    signedHits.length > 0 ? scoreFieldConfidence({ anchorWeight: 1.0, hits: signedHits.length, hasQualifier: false }) : undefined;
  const signedDate: ParsedField | null =
    signedHits.length > 0 && signedConfidence !== undefined
      ? buildParsedField(signedCands, signedConfidence)
      : null;

  /* -------------------------- 开工/进场日期 ------------------------- */
  let startHits = [...hitsNearAnchor(text, ['开工'], dateHits), ...hitsNearAnchor(text, ['进场'], dateHits)];
  startHits.sort((a, b) => a.offset - b.offset);
  startHits = startHits.filter((h, i) => i === 0 || h.offset - startHits[i - 1].offset > 4);
  const startCands: FieldCandidate[] = dedupeCandidates(hitsToCandidates(text, startHits));
  const startDate: ParsedField | null =
    startHits.length > 0
      ? buildParsedField(
          startCands,
          scoreFieldConfidence({
            anchorWeight: 1.0,
            hits: startHits.length,
            hasQualifier: hasQualifierNear(startCands[0]?.snippet ?? ''),
          }),
        )
      : null;

  /* ------------------------ 竣工/完工/验收日期 ----------------------- */
  const endRawHits = [
    ...hitsNearAnchor(text, ['竣工'], dateHits, 60),
    ...hitsNearAnchor(text, ['完工', '完成'], dateHits, 60),
    ...hitsNearAnchor(text, ['验收'], dateHits, 60),
  ].sort((a, b) => a.offset - b.offset);
  const endHits = endRawHits.filter((h, i) => i === 0 || h.offset - endRawHits[i - 1].offset > 4);
  const endCands: FieldCandidate[] = dedupeCandidates(hitsToCandidates(text, endHits));
  const endDate: ParsedField | null =
    endHits.length > 0
      ? buildParsedField(
          endCands,
          scoreFieldConfidence({
            anchorWeight: 0.85,
            hits: endHits.length,
            hasQualifier: hasQualifierNear(endCands[0]?.snippet ?? ''),
          }),
        )
      : null;

  /* ------------------------------ 工期条款 --------------------------- */
  const durations = extractDurationHits(text);
  const primaryDuration = durations[0] ?? null;

  if (durations.length === 0) {
    warnings.push('未识别到工期条款；若合同仅有日期表述请人工确认竣工日。');
  }
  if (startHits.length === 0) {
    warnings.push('未识别到开工/进场日期锚点。');
  }
  if (endHits.length === 0 && durations.length === 0) {
    warnings.push('未识别到竣工日期与工期条款，终止日期需人工填写。');
  }

  return {
    signedDate,
    startDate,
    endDate,
    durationDays: primaryDuration?.days ?? null,
    durationUnit: primaryDuration?.unit ?? null,
    paymentClauses: extractPaymentClauses(text),
    warnings,
  };
}

/** 导出内部工具供测试复用 */
export { normalizeText, extractDateHits, extractDurationHits };
