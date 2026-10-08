/**
 * Plain text from an uploaded PDF, DOCX or TXT. Parsers are loaded only when needed, and the PDF reader is one
 * built for serverless hosts (no canvas or DOM required).
 */
export async function extractText(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await pdfText(pdf, { mergePages: false });
    return (Array.isArray(text) ? text : [text]).join("\n");
  }
  if (name.endsWith(".docx")) {
    const mammoth = (await import("mammoth")).default;
    return (await mammoth.extractRawText({ buffer: buf })).value;
  }
  if (name.endsWith(".txt")) return buf.toString("utf8");
  throw new Error("Unsupported file type. Upload a PDF, DOCX or TXT.");
}
