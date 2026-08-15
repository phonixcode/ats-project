import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { extname } from 'path';
import { PDFParse } from 'pdf-parse';
import * as mammoth from 'mammoth';

@Injectable()
export class ResumeParserService {
  private readonly logger = new Logger(ResumeParserService.name);

  async parse(filePath: string): Promise<string> {
    const ext = extname(filePath).toLowerCase();
    const buffer = await readFile(filePath);

    if (ext === '.pdf') {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      const text = result.text?.trim();
      if (!text)
        throw new Error(
          'PDF contained no extractable text (likely scanned/image-based)',
        );
      return text;
    }

    if (ext === '.docx' || ext === '.doc') {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value?.trim();
      if (!text) throw new Error('Document contained no extractable text');
      return text;
    }

    throw new Error(`Unsupported file type: ${ext}`);
  }
}
