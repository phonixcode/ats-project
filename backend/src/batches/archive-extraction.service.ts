import { Injectable, Logger } from '@nestjs/common';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { basename, extname } from 'path';
import { resumeFilePath } from '../common/storage';

export const RESUME_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);
const MAX_TOTAL_UNCOMPRESSED_BYTES = 500 * 1024 * 1024; // 500MB cap for a whole batch
const MAX_FILE_COUNT = 1000; // sane ceiling for a personal batch

export interface ExtractedFile {
  originalName: string;
  path: string;
}

@Injectable()
export class ArchiveExtractionService {
  private readonly logger = new Logger(ArchiveExtractionService.name);

  async extractZip(zipPath: string, destDir: string): Promise<ExtractedFile[]> {
    const extracted: ExtractedFile[] = [];
    const skipped: string[] = [];
    let totalBytes = 0;
    let fileCount = 0;
    const zipName = basename(zipPath);

    const { Open } = await import('unzipper');
    const directory = await Open.file(zipPath);
    this.logger.log(
      `${zipName}: archive contains ${directory.files.length} entries`,
    );

    for (const entry of directory.files) {
      const entryPath = entry.path.replace(/\\/g, '/');

      if (entry.type !== 'File') continue;

      if (
        entryPath.includes('__MACOSX/') ||
        entryPath.split('/').pop().startsWith('._') ||
        entryPath.endsWith('.DS_Store')
      ) {
        continue;
      }

      const ext = extname(entryPath).toLowerCase();
      if (!RESUME_EXTENSIONS.has(ext)) {
        skipped.push(`${entryPath} (unsupported type)`);
        continue;
      }

      fileCount++;
      if (fileCount > MAX_FILE_COUNT) {
        this.logger.warn(
          `${zipName}: exceeded max file count (${MAX_FILE_COUNT}), stopping extraction`,
        );
        break;
      }

      totalBytes += entry.uncompressedSize;
      if (totalBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
        this.logger.warn(
          `${zipName}: exceeded max uncompressed size, stopping extraction`,
        );
        break;
      }

      const targetPath = resumeFilePath(destDir, entryPath);
      try {
        await pipeline(entry.stream(), createWriteStream(targetPath));
        extracted.push({ originalName: entryPath, path: targetPath });
      } catch (err) {
        this.logger.warn(
          `${zipName}: could not extract ${entryPath}: ${err.message}`,
        );
        skipped.push(`${entryPath} (extract failed)`);
      }
    }

    this.logger.log(
      `${zipName}: extracted ${extracted.length} resume(s), skipped ${skipped.length}`,
    );
    if (skipped.length) {
      this.logger.log(`${zipName}: skipped ${skipped.join(', ')}`);
    }
    return extracted;
  }
}
