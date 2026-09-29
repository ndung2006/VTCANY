import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { ContentModule } from './modules/content/content.module';
import { PlaybackModule } from './modules/playback/playback.module';
import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { AuditModule } from './modules/audit/audit.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { LayoutModule } from './modules/layout/layout.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    AuditModule,
    ContentModule,
    PlaybackModule,
    TelemetryModule,
    UploadsModule,
    LayoutModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
