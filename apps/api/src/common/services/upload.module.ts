import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadService } from './upload.service';
import { ThumbnailService } from './thumbnail.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [UploadService, ThumbnailService],
  exports: [UploadService, ThumbnailService],
})
export class UploadModule {}
