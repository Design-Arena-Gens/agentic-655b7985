"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

export function VideoRenderer({ bundle }: { bundle: any }) {
  const ffmpegRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const f = createFFmpeg({ log: false, corePath: undefined });
    f.setProgress(({ ratio }) => setProgress(Math.round(ratio * 100)));
    ffmpegRef.current = f;
    (async () => {
      if (!f.isLoaded()) await f.load();
      setReady(true);
    })();
  }, []);

  const render = async () => {
    if (!ready) return;
    setRendering(true);
    setUrl(null);
    const ffmpeg = ffmpegRef.current;

    // Voiceover
    if (bundle.voiceUrl) {
      const voiceArrayBuffer = await fetch(bundle.voiceUrl).then(r => r.arrayBuffer());
      ffmpeg.FS('writeFile', 'voice.mp3', new Uint8Array(voiceArrayBuffer));
    }

    // Images to sequential clips
    const sceneDurations: number[] = [];
    for (let i = 0; i < bundle.scenes.length; i++) {
      const scene = bundle.scenes[i];
      const img = await fetch(scene.image).then(r => r.arrayBuffer());
      ffmpeg.FS('writeFile', `img${i}.jpg`, new Uint8Array(img));
      sceneDurations.push(scene.duration);
      // create a simple video from image
      await ffmpeg.run(
        '-loop','1','-t', String(scene.duration), '-i', `img${i}.jpg`,
        '-vf', 'scale=1280:720,format=yuv420p',
        '-r','30', `clip${i}.mp4`
      );
    }

    // Concatenate clips
    const list = bundle.scenes.map((_: any, i: number) => `file clip${i}.mp4`).join('\n');
    ffmpeg.FS('writeFile','concat.txt', new TextEncoder().encode(list));
    await ffmpeg.run('-f','concat','-safe','0','-i','concat.txt','-c','copy','video.mp4');

    // Mix voiceover if present
    if (bundle.voiceUrl) {
      await ffmpeg.run('-i','video.mp4','-i','voice.mp3','-c:v','copy','-c:a','aac','-shortest','output.mp4');
    } else {
      await ffmpeg.run('-i','video.mp4','-c','copy','output.mp4');
    }

    const data = ffmpeg.FS('readFile', 'output.mp4');
    const blob = new Blob([data.buffer], { type: 'video/mp4' });
    const outUrl = URL.createObjectURL(blob);
    setUrl(outUrl);
    setRendering(false);
  };

  return (
    <div>
      <button className="button" onClick={render} disabled={rendering || !ready}>
        {rendering ? `Rendering? ${progress}%` : ready ? 'Render MP4' : 'Loading?'}
      </button>
      {url && (
        <div style={{ marginTop: 12 }}>
          <video src={url} controls style={{ width: '100%', borderRadius: 8, border: '1px solid #1f2a3a' }} />
          <a className="button" style={{ display: 'inline-block', marginTop: 8 }} href={url} download={`video-${Date.now()}.mp4`}>Download</a>
        </div>
      )}
    </div>
  );
}
