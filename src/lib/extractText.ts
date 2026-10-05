import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export async function extractText(file: File): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    try { return (await parser.getText()).text; } finally { await parser.destroy(); }
  }
  if (name.endsWith(".docx")) return (await mammoth.extractRawText({ buffer: buf })).value;
  if (name.endsWith(".txt")) return buf.toString("utf8");
  throw new Error("Unsupported file type. Upload a PDF, DOCX or TXT.");
}
