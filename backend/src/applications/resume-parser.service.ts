import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { extname } from 'path';

@Injectable()
export class ResumeParserService {
  private readonly logger = new Logger(ResumeParserService.name);

  async parse(filePath: string): Promise<string> {
    const ext = extname(filePath).toLowerCase();
    const buffer = await readFile(filePath);

    if (ext === '.pdf') {
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText().finally(() => parser.destroy());
      const text = result.text?.trim();
      if (!text)
        throw new Error(
          'PDF contained no extractable text (likely scanned/image-based)',
        );
      return text;
    }

    if (ext === '.docx' || ext === '.doc') {
      const { extractRawText } = await import('mammoth');
      const result = await extractRawText({ buffer });
      const text = result.value?.trim();
      if (!text) throw new Error('Document contained no extractable text');
      return text;
    }

    throw new Error(`Unsupported file type: ${ext}`);
  }
}
