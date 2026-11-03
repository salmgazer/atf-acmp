import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { ThumbnailService } from './thumbnail.service';

import sharp from 'sharp';

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
  contentType: string;
  size: number;
}

export interface VideoUploadResult extends UploadResult {
  durationSeconds?: number;
  thumbnailUrl?: string;
  thumbnailKey?: string;
}

export interface ImageUploadOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

const DEFAULT_IMAGE_OPTIONS: ImageUploadOptions = {
  maxWidth: 400,
  maxHeight: 400,
  quality: 85,
  format: 'jpeg',
};

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly s3Client: S3Client;
  private readonly signingClient: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly publicUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly thumbnailService: ThumbnailService,
  ) {
    // Support both AWS S3 and S3-compatible storage (MinIO)
    const s3Endpoint = this.configService.get<string>('S3_ENDPOINT');
    const s3AccessKey = this.configService.get<string>('S3_ACCESS_KEY');
    const s3SecretKey = this.configService.get<string>('S3_SECRET_KEY');
    const s3Bucket = this.configService.get<string>('S3_BUCKET');
    const s3Region = this.configService.get<string>('S3_REGION');
    const s3PublicUrl = this.configService.get<string>('S3_PUBLIC_URL');

    // Fallback to legacy AWS config if S3_ vars not set
    const awsConfig = this.configService.get('aws');

    this.region = s3Region || awsConfig?.region || 'us-east-1';
    this.bucket = s3Bucket || awsConfig?.s3Bucket || '';

    // Build S3 client config
    const s3Config: any = {
      region: this.region,
    };

    // If custom endpoint provided (MinIO), use it
    if (s3Endpoint) {
      s3Config.endpoint = s3Endpoint;
      s3Config.forcePathStyle = true; // Required for MinIO
      this.logger.log(`Using S3-compatible storage at: ${s3Endpoint}`);
    }

    // Set credentials
    if (s3AccessKey && s3SecretKey) {
      s3Config.credentials = {
        accessKeyId: s3AccessKey,
        secretAccessKey: s3SecretKey,
      };
    } else if (awsConfig?.accessKeyId && awsConfig?.secretAccessKey) {
      s3Config.credentials = {
        accessKeyId: awsConfig.accessKeyId,
        secretAccessKey: awsConfig.secretAccessKey,
      };
    }

    this.s3Client = new S3Client(s3Config);
    this.signingClient = s3Endpoint && s3PublicUrl
      ? new S3Client({ ...s3Config, endpoint: new URL(s3PublicUrl).origin })
      : this.s3Client;

    // Set public URL for accessing files
    // For MinIO: http://localhost:9000/bucket-name
    // For AWS S3: https://bucket.s3.region.amazonaws.com
    this.publicUrl = s3PublicUrl || `https://${this.bucket}.s3.${this.region}.amazonaws.com`;

    this.logger.log(`S3 configured - Bucket: ${this.bucket}, Public URL: ${this.publicUrl}`);
  }

  /**
   * Get the public URL for an uploaded file
   */
  private getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`;
  }

  async signResponseUrls(value: any): Promise<any> {
    if (typeof value === 'string') {
      const key = this.extractKeyFromUrl(value);
      if (!key) return value;
      return getSignedUrl(this.signingClient, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: 900 });
    }
    if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) return value;
    if (Array.isArray(value)) return Promise.all(value.map(item => this.signResponseUrls(item)));
    return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await this.signResponseUrls(item)])));
  }

  async readDocument(url: string): Promise<Buffer> {
    const key = this.extractKeyFromUrl(url);
    if (!key) throw new BadRequestException('Document must be uploaded to this application');
    const result = await this.s3Client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body || !result.ContentLength || result.ContentLength > 25 * 1024 * 1024) throw new BadRequestException('Document is missing or exceeds the extraction limit');
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async validateSubmissionDocuments<T extends { url: string; name: string; type: string; size: number }>(files: T[], teamId: string, maxMB = 25, allowedTypes: string[] = []): Promise<T[]> {
    return Promise.all(files.map(async file => {
      const key = this.extractKeyFromUrl(file.url);
      if (!key?.startsWith(`submissions/${teamId}/documents/`)) throw new BadRequestException('Document must be uploaded by this team');
      const stored = await this.s3Client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key })).catch(() => { throw new BadRequestException('Document could not be verified'); });
      const extension = key.split('.').pop()?.toLowerCase() || '';
      if (!stored.ContentLength || stored.ContentLength > Math.min(maxMB, 25) * 1024 * 1024) throw new BadRequestException('Document exceeds the stage size limit');
      if (allowedTypes.length && !allowedTypes.map(type => type.toLowerCase().replace(/^\./, '')).includes(extension)) throw new BadRequestException('Document type is not allowed for this stage');
      return { ...file, url: this.getPublicUrl(key), size: stored.ContentLength, type: stored.ContentType || 'application/octet-stream' };
    }));
  }

  async validateSubmissionVideo(url: string | undefined, teamId: string, maxMB?: number, maxSeconds?: number): Promise<void> {
    if (!url) return;
    const key = this.extractKeyFromUrl(url);
    if (!key) {
      if (maxMB || maxSeconds) throw new BadRequestException('Upload the video so its size and duration can be verified');
      return;
    }
    if (!key.startsWith(`submissions/${teamId}/videos/`)) throw new BadRequestException('Video must be uploaded by this team');
    const stored = await this.s3Client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key })).catch(() => { throw new BadRequestException('Video could not be verified'); });
    if (!stored.ContentType?.startsWith('video/') || !stored.ContentLength || stored.ContentLength > Math.min(maxMB || 100, 100) * 1024 * 1024) throw new BadRequestException('Video exceeds the stage size limit or is invalid');
    const duration = Number(stored.Metadata?.['duration-seconds']);
    if (maxSeconds && (!Number.isFinite(duration) || duration <= 0 || duration > maxSeconds)) throw new BadRequestException('Video exceeds the stage duration limit or could not be measured');
  }

  /**
   * Upload and compress an image file
   */
  async uploadImage(
    file: Express.Multer.File,
    folder: string,
    options: ImageUploadOptions = {},
  ): Promise<UploadResult> {
    const opts = { ...DEFAULT_IMAGE_OPTIONS, ...options };

    // Validate file type
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }

    // Validate file size (max 10MB before compression)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('Image file is too large. Maximum size is 10MB.');
    }

    try {
      // Process image with Sharp
      let sharpInstance = sharp(file.buffer);

      // Get metadata to maintain aspect ratio
      const metadata = await sharpInstance.metadata();

      // Resize while maintaining aspect ratio
      sharpInstance = sharpInstance.resize({
        width: opts.maxWidth,
        height: opts.maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      });

      // Convert to specified format with quality
      let processedBuffer: Buffer;
      let contentType: string;

      switch (opts.format) {
        case 'png':
          processedBuffer = await sharpInstance
            .png({ quality: opts.quality, compressionLevel: 9 })
            .toBuffer();
          contentType = 'image/png';
          break;
        case 'webp':
          processedBuffer = await sharpInstance
            .webp({ quality: opts.quality })
            .toBuffer();
          contentType = 'image/webp';
          break;
        case 'jpeg':
        default:
          processedBuffer = await sharpInstance
            .jpeg({ quality: opts.quality, mozjpeg: true })
            .toBuffer();
          contentType = 'image/jpeg';
          break;
      }

      // Generate unique filename
      const extension = opts.format === 'jpeg' ? 'jpg' : opts.format;
      const key = `${folder}/${uuidv4()}.${extension}`;

      // Upload to S3
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: processedBuffer,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000', // 1 year cache
        }),
      );

      const url = this.getPublicUrl(key);

      this.logger.log(
        `Uploaded image: ${key} (${file.size} -> ${processedBuffer.length} bytes)`,
      );

      return {
        url,
        key,
        bucket: this.bucket,
        contentType,
        size: processedBuffer.length,
      };
    } catch (error) {
      this.logger.error(`Failed to upload image: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to process and upload image');
    }
  }

  /**
   * Upload a profile picture with standard sizing
   */
  async uploadProfilePicture(
    file: Express.Multer.File,
    entityType: 'mentors' | 'participants' | 'organizations' | 'users',
    entityId?: string,
  ): Promise<UploadResult> {
    const folder = `${entityType}/profile-pictures`;

    return this.uploadImage(file, folder, {
      maxWidth: 400,
      maxHeight: 400,
      quality: 85,
      format: 'jpeg',
    });
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      this.logger.log(`Deleted file: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${key}: ${error.message}`);
      // Don't throw - deletion failure shouldn't break the flow
    }
  }

  /**
   * Upload a video file with optional thumbnail generation
   */
  async uploadVideo(
    file: Express.Multer.File,
    folder: string,
    generateThumbnail: boolean = false,
  ): Promise<VideoUploadResult> {
    // Validate file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Video must be MP4, WebM, or MOV format');
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      throw new BadRequestException('Video file is too large. Maximum size is 100MB.');
    }

    try {
      // Generate unique filename
      const extension = file.mimetype === 'video/mp4' ? 'mp4' 
        : file.mimetype === 'video/webm' ? 'webm' 
        : 'mov';
      const videoId = uuidv4();
      const key = `${folder}/${videoId}.${extension}`;
      const durationSeconds = folder.startsWith('submissions/') ? await this.thumbnailService.getVideoDuration(file.buffer) : undefined;

      // Upload video to S3
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ...(durationSeconds ? { Metadata: { 'duration-seconds': String(durationSeconds) } } : {}),
          CacheControl: 'public, max-age=31536000', // 1 year cache
        }),
      );

      const url = this.getPublicUrl(key);

      this.logger.log(`Uploaded video: ${key} (${file.size} bytes)`);

      const result: VideoUploadResult = {
        durationSeconds,
        url,
        key,
        bucket: this.bucket,
        contentType: file.mimetype,
        size: file.size,
      };

      // Generate and upload thumbnail if requested
      if (generateThumbnail) {
        try {
          const thumbnailBuffer = await this.thumbnailService.generateThumbnail(
            file.buffer,
            {
              timestamp: '00:00:01', // Capture at 1 second
              width: 640,
              quality: 5,
            },
          );

          const thumbnailKey = `${folder}/thumbnails/${videoId}.jpg`;

          await this.s3Client.send(
            new PutObjectCommand({
              Bucket: this.bucket,
              Key: thumbnailKey,
              Body: thumbnailBuffer,
              ContentType: 'image/jpeg',
              CacheControl: 'public, max-age=31536000',
            }),
          );

          result.thumbnailUrl = this.getPublicUrl(thumbnailKey);
          result.thumbnailKey = thumbnailKey;

          this.logger.log(`Uploaded thumbnail: ${thumbnailKey} (${thumbnailBuffer.length} bytes)`);
        } catch (thumbnailError) {
          // Log but don't fail the video upload if thumbnail generation fails
          this.logger.warn(`Failed to generate thumbnail: ${thumbnailError.message}`);
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to upload video: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to upload video');
    }
  }

  /**
   * Upload a brief video with thumbnail generation
   */
  async uploadBriefVideo(
    file: Express.Multer.File,
    briefId?: string,
  ): Promise<VideoUploadResult> {
    const folder = 'briefs/videos';
    return this.uploadVideo(file, folder, true); // Enable thumbnail generation
  }

  /**
   * Extract S3 key from URL
   */
  extractKeyFromUrl(url: string): string | null {
    if (!url) return null;

    try {
      const urlObj = new URL(url);
      const base = new URL(this.publicUrl);
      const prefix = base.pathname.replace(/\/$/, '') + '/';
      if (urlObj.origin !== base.origin || !urlObj.pathname.startsWith(prefix)) return null;
      const key = decodeURIComponent(urlObj.pathname.slice(prefix.length));
      if (!key || key.split('/').some(segment => segment === '..' || segment === '.')) return null;
      return key;
    } catch {
      return null;
    }
  }

  /**
   * Upload a document file (PDF, DOC, DOCX, etc.)
   */
  async uploadDocument(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadResult> {
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
    ];
    
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV'
      );
    }

    // Validate file size (max 25MB)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (file.size > maxSize) {
      throw new BadRequestException('Document file is too large. Maximum size is 25MB.');
    }

    try {
      // Generate unique filename preserving original extension
      const originalExt = file.originalname.split('.').pop() || 'pdf';
      const key = `${folder}/${uuidv4()}.${originalExt}`;

      // Upload to S3
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ContentDisposition: `inline; filename="${file.originalname}"`,
          CacheControl: 'public, max-age=31536000', // 1 year cache
        }),
      );

      const url = this.getPublicUrl(key);

      this.logger.log(`Uploaded document: ${key} (${file.size} bytes)`);

      return {
        url,
        key,
        bucket: this.bucket,
        contentType: file.mimetype,
        size: file.size,
      };
    } catch (error) {
      this.logger.error(`Failed to upload document: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to upload document');
    }
  }

  /**
   * Upload a brief resource document
   */
  async uploadBriefResource(file: Express.Multer.File): Promise<UploadResult> {
    return this.uploadDocument(file, 'briefs/resources');
  }

  /**
   * Upload a brief resource image (PNG, JPG, JPEG)
   */
  async uploadBriefResourceImage(file: Express.Multer.File): Promise<UploadResult> {
    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Allowed: PNG, JPG, JPEG');
    }

    // Use existing uploadImage method with brief resources folder
    return this.uploadImage(file, 'briefs/resources/images', {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 90,
      format: file.mimetype === 'image/png' ? 'png' : 'jpeg',
    });
  }

  /**
   * Upload a brief resource video (MP4)
   */
  async uploadBriefResourceVideo(file: Express.Multer.File): Promise<VideoUploadResult> {
    // Validate file type - only MP4
    if (file.mimetype !== 'video/mp4') {
      throw new BadRequestException('Invalid file type. Only MP4 videos are allowed.');
    }

    // Use existing uploadVideo method
    return this.uploadVideo(file, 'briefs/resources/videos', false);
  }
}
