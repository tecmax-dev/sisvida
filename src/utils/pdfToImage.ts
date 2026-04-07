/**
 * Converts the first page of a PDF file to a base64 PNG image
 * using pdfjs-dist for rendering on a canvas.
 */
export async function pdfToImageBase64(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  
  // Set the worker source
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // Render first page at high resolution for AI readability
  const page = await pdf.getPage(1);
  const scale = 2.0; // 2x for better quality
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Failed to get canvas context");

  await page.render({ canvasContext: context, viewport }).promise;

  // Convert to base64 PNG data URI
  const dataUrl = canvas.toDataURL("image/png");

  // Cleanup
  pdf.destroy();

  return dataUrl;
}
