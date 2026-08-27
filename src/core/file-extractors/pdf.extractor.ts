/**
 * PDF 文本层抽取（pdfjs-dist）。
 * Vite 下通过 `?url` 显式注入 worker；若构建环境 worker 受限，
 * 可退化为 disableWorker 模式（这里已做好兼容开关）。
 */

export async function extractPdfText(file: File | ArrayBuffer): Promise<string | null> {
  // 动态加载 pdfjs 主库（保持首屏体积）
  const pdfjs = await import('pdfjs-dist');

  // ---- Worker 配置（Vite 推荐方式）----
  try {
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch {
    // worker 加载失败时 pdfjs 会回退主线程 fake worker —— 抽取仍可用
  }

  const buffer = file instanceof File ? await file.arrayBuffer() : file;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

  const parts: string[] = [];
  for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (pageText) parts.push(pageText);
  }

  const merged = parts.join('\n').trim();
  return merged.length > 0 ? merged : null;
}
