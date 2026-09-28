'use client';
import { useState } from 'react';
import { api } from '../lib/api';
import { HlsPlayer } from '../components/hls-player';

export default function Home() {
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('Phase 1: login 1 lan, session tu gia han.');

  async function play() {
    try {
      const tokenRes = await api('/playback/token', {
        method: 'POST',
        body: JSON.stringify({ type: 'live', slug: 'PHUTHO', ttlMinutes: 10 }),
      });
      setUrl(tokenRes.hls_url);
      setMsg(`Token TTL ${tokenRes.ttl_seconds}s - refresh o 2/3 TTL, gap 403 thi mint lai.`);
    } catch (e: any) {
      setMsg(`Loi: ${e?.message}`);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>VTC ANY - Phase 1 Live</h1>
      <p>{msg}</p>
      <button onClick={play}>Lay link Live PHUTHO</button>
      {url && (
        <>
          <p style={{ wordBreak: 'break-all' }}>{url}</p>
          <HlsPlayer key={url} src={url} />
        </>
      )}
    </main>
  );
}
