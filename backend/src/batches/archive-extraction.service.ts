import { Injectable, Logger } from '@nestjs/common';
import * as unzipper from 'unzipper';
import { createReadStream, createWriteStream } from 'fs';
import { join, normalize, extname } from 'path';

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);
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
    let totalBytes = 0;
    let fileCount = 0;

    const directory = await unzipper.Open.file(zipPath);
    this.logger.debug(`Archive contains ${directory.files.length} entries`);

    for (const entry of directory.files) {
      this.logger.debug(`Entry: ${entry.path} (type: ${entry.type})`);

      if (entry.type !== 'File') {
        this.logger.debug(`Skipping non-file entry: ${entry.path}`);
        continue;
      }

      if (
        entry.path.includes('__MACOSX/') ||
        entry.path.split('/').pop().startsWith('._') ||
        entry.path.endsWith('.DS_Store')
      ) {
        this.logger.debug(`Skipping macOS metadata file: ${entry.path}`);
        continue;
      }

      const ext = extname(entry.path).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        this.logger.debug(
          `Skipping non-resume file: ${entry.path} (ext: ${ext})`,
        );
        continue;
      }

      const targetPath = normalize(join(destDir, entry.path));
      if (!targetPath.startsWith(normalize(destDir))) {
        this.logger.warn(`Blocked zip-slip attempt: ${entry.path}`);
        continue;
      }

      fileCount++;
      if (fileCount > MAX_FILE_COUNT) {
        this.logger.warn(
          `Batch exceeded max file count (${MAX_FILE_COUNT}), stopping extraction`,
        );
        break;
      }

      totalBytes += entry.uncompressedSize;
      if (totalBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
        this.logger.warn(
          `Batch exceeded max uncompressed size, stopping extraction`,
        );
        break;
      }

      await new Promise<void>((resolve, reject) => {
        entry
          .stream()
          .pipe(createWriteStream(targetPath))
          .on('finish', resolve)
          .on('error', reject);
      });

      this.logger.debug(`Extracted: ${entry.path}`);
      extracted.push({ originalName: entry.path, path: targetPath });
    }

    this.logger.debug(
      `Extraction complete: ${extracted.length} valid resume files`,
    );
    return extracted;
  }
}
