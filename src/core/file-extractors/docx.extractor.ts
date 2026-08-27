/**
 * DOCX 文本抽取（mammoth 转 text/plain）。
 */

export async function extractDocxText(file: File | ArrayBuffer): Promise<string | null> {
  const mammoth = (await import('mammoth')) as unknown as {
    extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  };
  const buffer = file instanceof File ? await file.arrayBuffer() : file;
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  const text = (result?.value ?? '').trim();
  return text.length > 0 ? text : null;
}
