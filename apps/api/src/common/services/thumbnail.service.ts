import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

export interface ThumbnailResult {
  buffer: Buffer;
  width: number;
  height: number;
}

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);

  /**
   * Generate a thumbnail from a video buffer using FFmpeg
   * @param videoBuffer - The video file buffer
   * @param options - Thumbnail generation options
   * @returns Buffer containing the thumbnail image (JPEG)
   */
  async generateThumbnail(
    videoBuffer: Buffer,
    options: {
      timestamp?: string; // Time to capture frame (default: '00:00:01')
      width?: number; // Output width (default: 640)
      height?: number; // Output height (default: -1 for auto)
      quality?: number; // JPEG quality 1-31, lower is better (default: 5)
    } = {},
  ): Promise<Buffer> {
    const {
      timestamp = '00:00:01',
      width = 640,
      height = -1,
      quality = 5,
    } = options;

    // Create temp files for input and output
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `video-${uuidv4()}`);
    const outputPath = path.join(tempDir, `thumb-${uuidv4()}.jpg`);

    try {
      // Write video buffer to temp file
      await fs.promises.writeFile(inputPath, videoBuffer);

      // Generate thumbnail using FFmpeg
      await this.runFFmpeg(inputPath, outputPath, {
        timestamp,
        width,
        height,
        quality,
      });

      // Read the generated thumbnail
      const thumbnailBuffer = await fs.promises.readFile(outputPath);

      this.logger.log(`Generated thumbnail: ${thumbnailBuffer.length} bytes`);

      return thumbnailBuffer;
    } catch (error) {
      this.logger.error(`Failed to generate thumbnail: ${error.message}`, error.stack);
      throw error;
    } finally {
      // Cleanup temp files
      await this.cleanupFile(inputPath);
      await this.cleanupFile(outputPath);
    }
  }

  /**
   * Run FFmpeg to extract a frame from video
   */
  private runFFmpeg(
    inputPath: string,
    outputPath: string,
    options: {
      timestamp: string;
      width: number;
      height: number;
      quality: number;
    },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const { timestamp, width, height, quality } = options;

      // FFmpeg arguments:
      // -ss: seek to timestamp
      // -i: input file
      // -vframes 1: extract only 1 frame
      // -vf scale: resize with aspect ratio preservation
      // -q:v: JPEG quality (1-31, lower is better)
      // -y: overwrite output file
      const args = [
        '-ss', timestamp,
        '-i', inputPath,
        '-vframes', '1',
        '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
        '-q:v', quality.toString(),
        '-y',
        outputPath,
      ];

      this.logger.debug(`Running FFmpeg with args: ${args.join(' ')}`);

      const ffmpeg = spawn('ffmpeg', args);

      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          this.logger.error(`FFmpeg exited with code ${code}: ${stderr}`);
          reject(new Error(`FFmpeg failed with code ${code}`));
        }
      });

      ffmpeg.on('error', (error) => {
        this.logger.error(`FFmpeg spawn error: ${error.message}`);
        reject(error);
      });
    });
  }

  /**
   * Cleanup a temporary file
   */
  private async cleanupFile(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      // Ignore errors if file doesn't exist
      if (error.code !== 'ENOENT') {
        this.logger.warn(`Failed to cleanup temp file ${filePath}: ${error.message}`);
      }
    }
  }
}
