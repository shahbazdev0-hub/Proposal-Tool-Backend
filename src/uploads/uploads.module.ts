import { Module } from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import { UploadsController, UPLOAD_DIR } from './uploads.controller';

// Multer will not create the destination itself — without this the first
// upload after a fresh deploy fails with ENOENT.
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

@Module({
  controllers: [UploadsController],
})
export class UploadsModule {}
