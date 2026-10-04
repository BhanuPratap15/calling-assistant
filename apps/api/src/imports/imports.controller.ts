import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import {
  ConfirmImportDto,
  ListImportRowsQueryDto,
  ListImportsQueryDto,
} from './dto/import.dto.js';
import { ImportRunner } from './import-runner.js';
import { ImportsService } from './imports.service.js';

/** Multer jo deta hai (sirf jo hume chahiye) */
interface UploadedImportFile {
  buffer: Buffer;
  originalname: string;
}

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB (~1 lakh rows CSV)

/** Bulk import — sirf Manager (aur Super Admin) */
@Roles('MANAGER')
@Controller('imports')
export class ImportsController {
  constructor(
    private readonly service: ImportsService,
    private readonly runner: ImportRunner,
  ) {}

  /** multipart/form-data, field "file" (.csv / .xlsx) → validate + preview (abhi customers NAHI bante) */
  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES, files: 1 } }),
  )
  upload(
    @UploadedFile() file: UploadedImportFile | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file)
      throw new BadRequestException(
        'Attach a .csv or .xlsx file in field "file"',
      );
    return this.service.preview(file, user);
  }

  @Get()
  findAll(@Query() query: ListImportsQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/rows')
  rows(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListImportRowsQueryDto,
  ) {
    return this.service.listRows(id, query);
  }

  /** Jo lines import nahi huin — CSV download (theek karke dobara upload) */
  @Get(':id/problems.csv')
  async problems(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.service.problemRowsCsv(id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="import-${id.slice(0, 8)}-problems.csv"`,
    );
    return '\uFEFF' + csv; // BOM → Excel UTF-8 (₹, Hindi naam) sahi padhe
  }

  @Post(':id/confirm')
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmImportDto,
    @CurrentUser() user: AuthUser,
  ) {
    const batch = await this.service.confirm(id, dto, user);
    await this.runner.enqueue(id);
    return batch;
  }

  @Post(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.cancel(id, user);
  }

  @Post(':id/retry')
  async retry(@Param('id', ParseUUIDPipe) id: string) {
    const batch = await this.service.retry(id);
    await this.runner.enqueue(id);
    return batch;
  }
}
