"use client";

import { useState } from 'react';
import useSWR from 'swr';
import { z } from 'zod';
import { VideoRenderer } from '@/components/VideoRenderer';
import { saveAs } from '@/lib/saveAs';

const fetcher = (url: string, options?: RequestInit) => fetch(url, options).then(async r => {
  if (!r.ok) throw new Error(await r.text());
  return r.json();
});

const inputSchema = z.object({
  niche: z.string().min(2),
  style: z.enum(["education", "top10", "story", "news", "meme"]),
  duration: z.number().min(30).max(600),
  language: z.string().default('en')
});

export default function Home() {
  const [niche, setNiche] = useState("");
  const [style, setStyle] = useState("education");
  const [duration, setDuration] = useState(120);
  const [language, setLanguage] = useState("en");
  const [loading, setLoading] = useState(false);
  const [bundle, setBundle] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onGenerate = async () => {
    setLoading(true);
    setError(null);
    setBundle(null);
    const parsed = inputSchema.safeParse({ niche, style: style as any, duration, language });
    if (!parsed.success) {
      setError("Please fill in valid inputs.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data) });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setBundle(json);
    } catch (e: any) {
      setError(e.message || 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
        <span className="badge">Agentic YouTube Automation</span>
      </div>
      <h1 className="title">One-click Viral Video Generator</h1>
      <p className="subtitle">Deep research, script, images, SFX, voiceover and MP4 render.</p>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="label">Niche or Topic</div>
          <input className="input" placeholder="e.g., AI tools to try this week" value={niche} onChange={e => setNiche(e.target.value)} />
        </div>
        <div className="card">
          <div className="label">Style</div>
          <select className="select" value={style} onChange={e => setStyle(e.target.value)}>
            <option value="education">Educational</option>
            <option value="top10">Top 10</option>
            <option value="story">Storytelling</option>
            <option value="news">News</option>
            <option value="meme">Meme/Shorts</option>
          </select>
        </div>
        <div className="card">
          <div className="label">Duration (seconds)</div>
          <input className="input" type="number" min={30} max={600} value={duration} onChange={e => setDuration(Number(e.target.value))} />
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="label">Language</div>
          <input className="input" value={language} onChange={e => setLanguage(e.target.value)} />
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'end' }}>
          <button className="button" onClick={onGenerate} disabled={loading || !niche}>
            {loading ? 'Generating?' : 'One Click Generate'}
          </button>
        </div>
      </div>

      {error && <div className="card" style={{ borderColor: '#ef4444' }}>{error}</div>}

      {bundle && (
        <div className="card">
          <div className="section-title">Project Bundle</div>
          <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 24 }}>
            <div>
              <div className="section-title">Script</div>
              <pre style={{ whiteSpace: 'pre-wrap', background: '#0b1320', padding: 12, borderRadius: 8, border: '1px solid #1f2a3a' }}>{bundle.script}</pre>
              <div className="section-title">Scenes</div>
              <div className="grid grid-2">
                {bundle.scenes?.map((s: any, i: number) => (
                  <div key={i} className="card">
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Scene {i + 1} ? {s.duration}s</div>
                    <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>{s.caption}</div>
                    {s.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image} alt={s.caption} style={{ width: '100%', borderRadius: 8, border: '1px solid #1f2a3a' }} />
                    )}
                    {s.sfx && <div className="badge" style={{ marginTop: 8 }}>SFX: {s.sfx}</div>}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="section-title">Render</div>
              <VideoRenderer bundle={bundle} />
            </div>
          </div>
        </div>
      )}

      <hr className="hr" />
      <div style={{ fontSize: 12, color: '#94a3b8' }}>
        Tip: Provide OPENAI_API_KEY (and optional TAVILY_API_KEY) in Vercel env vars.
      </div>
    </div>
  );
}
