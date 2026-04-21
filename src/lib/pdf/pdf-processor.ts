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
    const strings = content.items.map((item: any) => item.str);
    results.push({
      pageNumber: i,
      text: strings.join(' ')
    });
  }

  return results;
}

export function parseOciText(jsonStr: string): string {
  try {
    const data = JSON.parse(jsonStr);
    // Simple parser for common OCI Document Understanding JSON
    // Users might just paste text too, but if it's JSON, we handle it.
    if (data.pages) {
      return data.pages.map((p: any) => p.lines?.map((l: any) => l.text).join(' ')).join('\n');
    }
    return jsonStr; // fallback
  } catch (e) {
    return jsonStr; // Not a JSON, just return as is
  }
}
