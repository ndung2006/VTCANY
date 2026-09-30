import { Module } from '@nestjs/common';
import { TvController } from './tv.controller';
import { TvService } from './tv.service';
import { PlaybackModule } from '../playback/playback.module';
import { ContentModule } from '../content/content.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PlaybackModule, ContentModule, AuthModule],
  controllers: [TvController],
  providers: [TvService],
  exports: [TvService],
})
export class TvModule {}
