'use client';
import { useState } from 'react';
import { api } from '../../lib/api';

export default function CmsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [title, setTitle] = useState('Ban tin toi');
  const [msg, setMsg] = useState('Nhap lieu -> Kiem duyet -> Xuat ban.');

  async function refresh(page = 1) {
    try {
      const res = await api(`/videos?page=${page}&limit=20`);
      setItems(res.data || res);
      setMeta(res.meta || null);
    } catch (e: any) {
      setMsg(`Loi: ${e?.message}`);
    }
  }

  async function create() {
    try {
      await api('/videos', { method: 'POST', body: JSON.stringify({ title }) });
      await refresh();
    } catch (e: any) {
      setMsg(`Loi: ${e?.message}`);
    }
  }

  async function act(id: string, action: 'submit' | 'publish' | 'reject') {
    try {
      await api(`/videos/${id}/${action}`, { method: 'POST' });
      await refresh();
    } catch (e: any) {
      setMsg(`Loi: ${e?.message}`);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>CMS - Duyet bai</h1>
      <p>{msg} {meta && `(tong ${meta.total})`}</p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: 320 }} />
      <button onClick={create}>Nhap lieu</button>
      <button onClick={() => refresh()}>Tai lai</button>
      <ul>
        {items.map((v) => (
          <li key={v.id}>
            {v.title} [{v.status}]
            <button onClick={() => act(v.id, 'submit')}>Trinh duyet</button>
            <button onClick={() => act(v.id, 'publish')}>Xuat ban</button>
            <button onClick={() => act(v.id, 'reject')}>Tu choi</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
