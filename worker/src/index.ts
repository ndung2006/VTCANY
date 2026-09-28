import { JobQueue } from './queue';

// Phase 1.1: worker chay doc lap, dieu phoi ve cum FFmpeg cu (FFMPEG_API_URL).
// Khong POST file qua backend - CMS lay pre-signed URL, worker chi nhan job.
const queue = new JobQueue();
const job = queue.enqueue('s3://vtc-any-raw/sample.mp4');
queue.mark(job.id, 'processing');
queue.mark(job.id, 'done');
// eslint-disable-next-line no-console
console.log('worker Phase 1.1 ready, demo job:', queue.get(job.id));
