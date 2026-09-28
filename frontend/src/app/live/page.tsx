'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';

export default function LivePage() {
  const [url, setUrl] = useState('');
  const [info, setInfo] = useState('Nhan Play de lay link TTL 10 phut. Session tu gia han.');
  const timer = useRef<any>(null);

  async function mint() {
    try {
      // api() tu login + refresh, gap 403 het han thi mint lai ngay.
      const t = await api('/playback/token', {
        method: 'POST',
        body: JSON.stringify({ type: 'live', slug: 'PHUTHO', ttlMinutes: 10 }),
      });
      setUrl(t.hls_url);
      clearTimeout(timer.current);
      timer.current = setTimeout(mint, (t.ttl_seconds * 1000 * 2) / 3);
      setInfo(`Da cap link, tu refresh sau ${Math.round((t.ttl_seconds * 2) / 3)}s.`);
    } catch (e: any) {
      if (String(e?.message).includes('forbidden')) {
        setInfo('Link het han giua chung - mint lai ngay.');
        await mint();
      } else {
        setInfo(`Loi: ${e?.message}`);
      }
    }
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>Live PHUTHO</h1>
      <p>{info}</p>
      <button onClick={mint}>Play</button>
      {url && <video src={url} controls autoPlay style={{ width: '100%', maxWidth: 720, marginTop: 12 }} />}
    </main>
  );
}
