// VideoBackground.tsx — Seamless looping video background for BioSustain login
// Plays 3 video clips in sequence with crossfade, then loops infinitely.
// Uses a simpler approach: 2 video elements that alternate, each fully playing its clip.

'use client';

import { useState, useEffect, useRef } from 'react';

const CLIPS = [
  { src: '/videos/drone_fields.mp4', label: 'Campos sustentables' },
  { src: '/videos/larvae_macro.mp4', label: 'Bioconversión BSF' },
  { src: '/videos/seedlings_growth.mp4', label: 'Crecimiento orgánico' },
];

export function VideoBackground() {
  const [clipIndex, setClipIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const activeRef = useRef<HTMLVideoElement>(null);
  const inactiveRef = useRef<HTMLVideoElement>(null);
  const clipRef = useRef(0); // Track without re-render

  // Check if all videos exist
  useEffect(() => {
    const check = async (path: string) => {
      try { return (await fetch(path, { method: 'HEAD' })).ok; } catch { return false; }
    };
    Promise.all(CLIPS.map(c => check(c.src))).then(results => {
      if (!results.every(Boolean)) setHasError(true);
    });
  }, []);

  const handleEnded = () => {
    // Start crossfade
    setFading(true);

    // Prepare the inactive video with the next clip
    const nextIndex = (clipRef.current + 1) % CLIPS.length;
    const inactive = inactiveRef.current;
    if (inactive) {
      inactive.src = CLIPS[nextIndex].src;
      inactive.load();
      inactive.play().catch(() => {});
    }

    // After crossfade completes, swap active/inactive
    setTimeout(() => {
      clipRef.current = nextIndex;
      setClipIndex(nextIndex);
      setFading(false);

      // The old active (now inactive) will be ready for the next swap
      const oldActive = activeRef.current;
      if (oldActive) {
        const futureIndex = (nextIndex + 1) % CLIPS.length;
        oldActive.src = CLIPS[futureIndex].src;
        oldActive.load();
      }
    }, 2000);
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
      {/* Active video — currently playing */}
      <video
        ref={activeRef}
        autoPlay
        muted
        playsInline
        onEnded={handleEnded}
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover',
          opacity: fading ? 0 : 1,
          transition: 'opacity 2s ease-in-out',
        }}
      >
        <source src={CLIPS[0].src} type="video/mp4" />
      </video>

      {/* Inactive video — hidden, preloaded for next clip */}
      <video
        ref={inactiveRef}
        muted
        playsInline
        preload="auto"
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover',
          opacity: fading ? 1 : 0,
          transition: 'opacity 2s ease-in-out',
        }}
      />

      {/* Dark overlay for readability */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to bottom, rgba(6,10,6,0.75) 0%, rgba(6,10,6,0.55) 50%, rgba(6,10,6,0.9) 100%)',
      }} />

      {/* Caption */}
      <div style={{
        position: 'absolute', bottom: 40, left: 0, right: 0, textAlign: 'center',
        fontSize: 12, color: 'rgba(255,255,255,0.25)', letterSpacing: 2,
        textTransform: 'uppercase', fontFamily: "'Space Grotesk', sans-serif",
        opacity: fading ? 0.15 : 0.4,
        transition: 'opacity 2s',
        zIndex: 1,
      }}>
        {CLIPS[clipIndex].label}
      </div>
    </div>
  );
}