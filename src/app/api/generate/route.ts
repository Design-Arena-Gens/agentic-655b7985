import { NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

async function callOpenAI(prompt: string) {
  if (!OPENAI_API_KEY) {
    // Fallback stub content if no API key provided
    return `TITLE: Viral Video About ${new Date().toLocaleDateString()}
HOOK: You won't believe these insights.
\nSCENES:\n1) Caption: The problem.\n2) Caption: The twist.\n3) Caption: The solution.\n4) Caption: The proof.\n5) Caption: The call to action.`;
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an elite YouTube producer. Return a concise script with scenes.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8
    })
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return json.choices?.[0]?.message?.content || '';
}

async function researchWeb(query: string) {
  if (!TAVILY_API_KEY) return [];
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TAVILY_API_KEY}` },
    body: JSON.stringify({ query, max_results: 5 })
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.results || [];
}

async function generateImage(prompt: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    // Use a placeholder image
    return `https://images.unsplash.com/photo-1522199710521-72d69614c702?w=1280&q=80`;
  }
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1024' })
  });
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  const url = json.data?.[0]?.url;
  return url || `https://images.unsplash.com/photo-1522199710521-72d69614c702?w=1280&q=80`;
}

async function generateVoiceover(text: string): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'verse', input: text })
  });
  if (!res.ok) return null;
  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return `data:audio/mpeg;base64,${base64}`;
}

export async function POST(req: Request) {
  const body = await req.json();
  const { niche, style, duration, language } = body as { niche: string; style: string; duration: number; language: string };

  // 1) Research
  const research = await researchWeb(niche);

  // 2) Script
  const scriptPrompt = `Create a viral YouTube script in ${language}.\nStyle: ${style}.\nTarget duration: ${duration}s.\nTopic: ${niche}.\nUse strong hook, 5-9 concise scenes with captions, and CTA. Incorporate these sources when relevant: ${JSON.stringify(research)}.`;
  const script = await callOpenAI(scriptPrompt);

  // 3) Parse scenes (simple heuristic)
  const lines = script.split('\n').filter(Boolean);
  const sceneLines = lines.filter(l => /\d+\)/.test(l) || l.toLowerCase().startsWith('scene'));
  const approxSceneCount = Math.max(5, Math.min(9, sceneLines.length || 6));
  const perScene = Math.max(5, Math.floor(duration / approxSceneCount));

  const scenes = await Promise.all(Array.from({ length: approxSceneCount }).map(async (_, i) => {
    const raw = sceneLines[i] || `Scene ${i + 1}: ${niche}`;
    const caption = raw.replace(/^\d+\)\s?/, '').replace(/^scene\s?\d+[:\-]\s?/i, '');
    const image = await generateImage(`${style} style illustration for: ${caption}`);
    const sfx = i % 2 === 0 ? 'whoosh' : 'pop';
    return { caption, duration: perScene, image, sfx };
  }));

  // 4) Voiceover
  const voiceText = script.replace(/\n+/g, ' ');
  const voiceUrl = await generateVoiceover(voiceText);

  return NextResponse.json({
    title: lines.find(l => l.toLowerCase().startsWith('title')) || niche,
    hook: lines.find(l => l.toLowerCase().includes('hook')) || '',
    script,
    research,
    scenes,
    voiceUrl
  });
}
