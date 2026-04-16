export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export async function extractTextFromPdf(file: File, maxPages: number = 20): Promise<ExtractedPage[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  const results: ExtractedPage[] = [];
  const pageCount = Math.min(pdf.numPages, maxPages);

  for (let i = 1; i <= pageCount; i++) {
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
