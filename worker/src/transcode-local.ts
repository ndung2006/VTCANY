import { execFile } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

function hasFfmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('ffmpeg', ['-version'], (err) => resolve(!err));
  });
}

// Phase 1 local: doc file raw tai cho, xuat HLS vao storage/hls/<jobId>/.
// Co ffmpeg that: chay preset p480/p720. Khong co: ghi playlist SIMULATED
// de player/CMS test luong end-to-end (len Coolify cai ffmpeg that).
export async function transcodeLocal(rawPath: string, hlsDir: string): Promise<{ simulated: boolean; playlist: string }> {
  mkdirSync(hlsDir, { recursive: true });
  if (!existsSync(rawPath)) throw new Error(`raw not found: ${rawPath}`);
  if (await hasFfmpeg()) {
    await new Promise<void>((resolve, reject) => {
      execFile(
        'ffmpeg',
        ['-y', '-i', rawPath, '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', '-hls_time', '6', '-hls_list_size', '0', join(hlsDir, 'master.m3u8')],
        (err) => (err ? reject(err) : resolve()),
      );
    });
    return { simulated: false, playlist: join(hlsDir, 'master.m3u8') };
  }
  const playlist = join(hlsDir, 'master.m3u8');
  writeFileSync(
    playlist,
    '#EXTM3U\n# Phase 1 SIMULATED playlist - cai ffmpeg that tren Coolify\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n#EXTINF:6.0,\nseg-0.ts\n#EXT-X-ENDLIST\n',
  );
  writeFileSync(join(hlsDir, 'seg-0.ts'), 'SIMULATED');
  return { simulated: true, playlist };
}
