import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { ContentModule } from '../content/content.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [AuthModule, AuditModule, ContentModule, UploadsModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
