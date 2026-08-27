/**
 * 文件抽取注册表：按扩展名分发至具体抽取器。
 * 失败/扫描件图片型一律返回 null —— 上游引导 ManualFallbackForm（永不阻断建档）。
 */

export interface ExtractOutcome {
  text: string | null;
  /** 失败原因（供 UI 降级提示），成功时为空 */
  failureReason?: string;
}

const TEXT_EXTENSIONS = ['.txt', '.md'];

function extensionOf(fileName: string): string {
  const idx = fileName.lastIndexOf('.');
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : '';
}

export async function extractFromFile(file: File): Promise<ExtractOutcome> {
  const ext = extensionOf(file.name);
  try {
    if (ext === '.pdf') {
      const { extractPdfText } = await import('./pdf.extractor');
      const result = await extractPdfText(file);
      if (!result || result.trim().length < 10) {
        return {
          text: null,
          failureReason: '该 PDF 未检测到可复制文本（可能是扫描件/图片型）。请改用粘贴文本或手动建档。',
        };
      }
      return { text: result };
    }
    if (ext === '.docx') {
      const { extractDocxText } = await import('./docx.extractor');
      const result = await extractDocxText(file);
      if (!result || result.trim().length < 10) {
        return { text: null, failureReason: 'DOCX 内容为空或无法解析。' };
      }
      return { text: result };
    }
    if (TEXT_EXTENSIONS.includes(ext)) {
      const result = await file.text();
      if (result.trim().length < 10) {
        return { text: null, failureReason: '文本内容过短。' };
      }
      return { text: result };
    }
    return {
      text: null,
      failureReason: `暂不支持 ${ext || '(无扩展名)'} 格式。支持 PDF / DOCX / TXT，或将文本直接粘贴进输入框。`,
    };
  } catch (err) {
    return {
      text: null,
      failureReason: `文件解析失败：${err instanceof Error ? err.message : String(err)}。可粘贴文本或手动建档兜底。`,
    };
  }
}
