import { Module } from '@nestjs/common';
import { PlaybackController } from './playback.controller';
import { PlaybackService } from './playback.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PlaybackController],
  providers: [PlaybackService],
  exports: [PlaybackService],
})
export class PlaybackModule {}
