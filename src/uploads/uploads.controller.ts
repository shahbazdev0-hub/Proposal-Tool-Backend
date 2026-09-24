import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomBytes } from 'crypto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

/**
 * Images are written under <project root>/uploads and served back as static
 * files. process.cwd() is the Nest project root whether running from src or
 * dist, matching how EmailService already resolves its logo.
 */
export const UPLOAD_DIR = join(process.cwd(), 'uploads');

/**
 * PDFKit can only decode JPEG and PNG, so accepting anything else would let an
 * admin upload an image that renders fine in the browser and silently vanishes
 * from the generated PDF.
 */
const ALLOWED_MIME = ['image/png', 'image/jpeg'];
const MAX_BYTES = 5 * 1024 * 1024;

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('uploads')
export class UploadsController {
  @Roles(Role.ADMIN)
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          // Random name: the original could collide, contain path separators,
          // or carry a misleading double extension.
          const ext =
            extname(file.originalname).toLowerCase() === '.png'
              ? '.png'
              : '.jpg';
          cb(null, `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`);
        },
      }),
      limits: { fileSize: MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.includes(file.mimetype)) {
          cb(
            new BadRequestException('Only PNG and JPEG images are supported.'),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadImage(@UploadedFile() file?: Express.Multer.File): { url: string } {
    if (!file) {
      throw new BadRequestException('No file received.');
    }
    // Relative path — the frontend resolves it against the API origin, so the
    // stored value survives a domain change.
    return { url: `/uploads/${file.filename}` };
  }
}
