import { execFile } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';

function hasFfmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('ffmpeg', ['-version'], (err) => resolve(!err));
  });
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, (err) => (err ? reject(err) : resolve()));
  });
}

// Cat 1 khung hinh lam poster/thumbnail tu dong. Thu o giay 1, video qua
// ngan thi lui ve khung dau. Loi poster khong duoc lam hong job transcode.
async function extractPoster(rawPath: string, posterPath: string): Promise<void> {
  const args = (ss: string) => ['-y', '-ss', ss, '-i', rawPath, '-frames:v', '1', '-vf', 'scale=720:-2', '-q:v', '3', posterPath];
  try {
    await runFfmpeg(args('1'));
  } catch {
    await runFfmpeg(args('0'));
  }
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
    // Poster tu dong: ghi thang vao storage/images (chung volume voi backend)
    // de backend phuc vu cong khai tai /images/thumb-<uploadId>.jpg va CMS
    // tu dien lam thumbnail khi noi dung chua co anh rieng.
    try {
      const imagesDir = join(dirname(hlsDir), '..', 'images');
      mkdirSync(imagesDir, { recursive: true });
      await extractPoster(rawPath, join(imagesDir, `thumb-${basename(hlsDir)}.jpg`));
    } catch {
      // Bo qua: thieu poster khong phai loi transcode.
    }
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
