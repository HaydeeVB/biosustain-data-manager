// VideoBackground.tsx — Seamless looping video background for BioSustain login
// Plays 3 video clips in sequence with a single crossfade, then loops infinitely.
// Ping-pong two layers: whichever is "front" is visible; the hidden layer preloads
// the next clip. Fixes the prior index-desync / double-crossfade / no-self-heal bugs
// (handoff 2026-08-16).

'use client';

import { useState, useEffect, useRef } from 'react';

const CLIPS = [
  { src: '/videos/drone_fields.mp4', label: 'Campos sustentables' },
  { src: '/videos/larvae_macro.mp4', label: 'Bioconversión BSF' },
  { src: '/videos/seedlings_growth.mp4', label: 'Crecimiento orgánico' },
];
const FADE_MS = 1800;

export function VideoBackground() {
  const layers = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)];
  const [front, setFront] = useState(0);      // which layer is visible (0|1)
  const [clipIdx, setClipIdx] = useState(0);   // index of the clip on the front layer
  const [hasError, setHasError] = useState(false);
  const clipRef = useRef(0);
  const frontRef = useRef(0);
  const swapping = useRef(false);

  const safePlay = (v: HTMLVideoElement | null) => v?.play().catch(() => {});

  // Check if all videos exist (gradient fallback if any 404)
  useEffect(() => {
    const check = async (path: string) => {
      try { return (await fetch(path, { method: 'HEAD' })).ok; } catch { return false; }
    };
    Promise.all(CLIPS.map(c => check(c.src))).then(results => {
      if (!results.every(Boolean)) setHasError(true);
    });
  }, []);

  // Initial: layer 0 plays clip 0, layer 1 preloads clip 1. Self-heal on visibility/interaction.
  useEffect(() => {
    const a = layers[0].current, b = layers[1].current;
    if (!a || !b) return;
    a.src = CLIPS[0].src; a.load(); safePlay(a);
    b.src = CLIPS[1].src; b.load();           // preload="auto" makes this ready
    const resume = () => safePlay(layers[frontRef.current].current);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('pointerdown', resume, { once: true });
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('pointerdown', resume);
    };
  }, [layers]);

  const handleEnded = (layerIndex: number) => {
    if (layerIndex !== frontRef.current || swapping.current) return; // ignore the hidden layer
    swapping.current = true;
    const nextClip = (clipRef.current + 1) % CLIPS.length;
    const back = 1 - frontRef.current;
    const incoming = layers[back].current!;
    const outgoing = layers[frontRef.current].current!;
    incoming.currentTime = 0;
    safePlay(incoming);
    // Flip visibility: incoming becomes front, single CSS crossfade
    frontRef.current = back; clipRef.current = nextClip;
    setFront(back); setClipIdx(nextClip);
    setTimeout(() => {
      // outgoing (now hidden) preloads the clip after next
      outgoing.pause();
      outgoing.src = CLIPS[(nextClip + 1) % CLIPS.length].src;
      outgoing.load();
      swapping.current = false;
    }, FADE_MS);
  };

  if (hasError) {
    return (
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden',
        background: 'linear-gradient(135deg, #060a06 0%, #0a120a 50%, #060a06 100%)',
      }}>
        <div style={{
          position: 'absolute', top: '-20%', right: '-10%', width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(62,176,2,0.15), transparent 70%)',
          borderRadius: '50%', filter: 'blur(60px)',
          animation: 'pulse 8s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '-15%', left: '-5%', width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(34,139,34,0.08), transparent 70%)',
          borderRadius: '50%', filter: 'blur(70px)',
          animation: 'pulse 10s ease-in-out infinite reverse',
        }} />
      </div>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden', background: '#060a06' }}>
      {[0, 1].map(i => (
        <video
          key={i}
          ref={layers[i]}
          muted
          playsInline
          preload="auto"
          onEnded={() => handleEnded(i)}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover',
            opacity: front === i ? 1 : 0,
            transition: `opacity ${FADE_MS}ms ease-in-out`,
          }}
        />
      ))}

      {/* Dark overlay for readability */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(6,10,6,0.75) 0%, rgba(6,10,6,0.55) 50%, rgba(6,10,6,0.9) 100%)',
      }} />

      {/* Caption — always matches the visible clip */}
      <div style={{
        position: 'absolute', bottom: 40, left: 0, right: 0, textAlign: 'center',
        fontSize: 12, color: 'rgba(255,255,255,0.25)', letterSpacing: 2,
        textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif",
        opacity: 0.4,
        transition: 'opacity 2s',
        zIndex: 1,
      }}>
        {CLIPS[clipIdx].label}
      </div>
    </div>
  );
}
