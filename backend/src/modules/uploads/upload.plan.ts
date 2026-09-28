export type UploadStatus = 'pending' | 'uploaded' | 'processing' | 'done' | 'error';

export interface UploadRecord {
  id: string;
  filename: string;
  sizeBytes: number;
  contentType: string;
  videoId?: string;
  status: UploadStatus;
  chunks: number;
  createdAt: number;
}

export const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB/chunk theo blueprint
export const MAX_FILE_BYTES = 10 * 1024 * 1024 * 1024; // 10GB

export function chunkCount(sizeBytes: number): number {
  return Math.max(1, Math.ceil(sizeBytes / CHUNK_SIZE));
}

// Pure - co test bao ve, khong doi khi thay S3/MinIO that.
export function planUpload(filename: string, sizeBytes: number, contentType: string, videoId?: string): UploadRecord {
  if (!filename) throw new Error('filename required');
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) throw new Error('invalid size');
  if (sizeBytes > MAX_FILE_BYTES) throw new Error('file too large');
  return {
    id: `upl-${Date.now()}`,
    filename,
    sizeBytes,
    contentType: contentType || 'video/mp4',
    videoId,
    status: 'pending',
    chunks: chunkCount(sizeBytes),
    createdAt: Date.now(),
  };
}
