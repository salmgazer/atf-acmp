import { Injectable } from "@nestjs/common";
import { PDFParse } from "pdf-parse";
import { extractRawText } from "mammoth";
import { UploadService } from "@/common/services/upload.service";

@Injectable()
export class DocumentExtractionService {
  constructor(private readonly uploads: UploadService) {}

  async extract(file: { url: string; name: string; type?: string }): Promise<{ name: string; type: string; content: string }> {
    const data = await this.uploads.readDocument(file.url);
    const extension = file.name.split(".").pop()?.toLowerCase();
    let content: string;
    if (extension === "pdf") {
      const parser = new PDFParse({ data: new Uint8Array(data) });
      try { content = (await parser.getText()).text; } finally { await parser.destroy(); }
    } else if (extension === "docx") content = (await extractRawText({ buffer: data })).value;
    else if (["txt", "csv", "md", "json"].includes(extension || "")) content = data.toString("utf8");
    else throw new Error(`Cannot evaluate unsupported document: ${file.name}. Upload PDF, DOCX, or text.`);
    if (!content.trim()) throw new Error(`Document contains no extractable text: ${file.name}`);
    return { name: file.name, type: file.type || extension || "document", content: content.slice(0, 40000) };
  }
}
