export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export async function extractTextFromPdf(file: File, startPage: number = 1, endPage?: number): Promise<ExtractedPage[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  const results: ExtractedPage[] = [];
  const start = Math.max(1, startPage);
  const end = endPage ? Math.min(pdf.numPages, endPage) : Math.min(pdf.numPages, start + 19); // Default max 20 pages from start if no endPage specified

  for (let i = start; i <= end; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = (content.items as { str: string }[]).map((item) => item.str);
    results.push({
      pageNumber: i,
      text: strings.join(' ')
    });
  }

  return results;
}

interface OciLine {
  text: string;
}

interface OciPage {
  lines?: OciLine[];
}

interface OciData {
  pages?: OciPage[];
}

export function parseOciText(jsonStr: string): string {
  try {
    const data = JSON.parse(jsonStr) as OciData;
    // Simple parser for common OCI Document Understanding JSON
    // Users might just paste text too, but if it's JSON, we handle it.
    if (data.pages) {
      return data.pages.map((p) => p.lines?.map((l) => l.text).join(' ') || '').join('\n');
    }
    return jsonStr; // fallback
  } catch {
    return jsonStr; // Not a JSON, just return as is
  }
}
