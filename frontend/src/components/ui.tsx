'use client';

/**
 * Shared presentational components + style constants for the BioSustain dashboard.
 * Extracted from src/app/page.tsx (DSA audit F1, 2026-08-16) to reduce the
 * 1075-line monolith. These are pure presentational — no state, no data fetching.
 */

// ── Shared styles ───────────────────────────────────────────────────
export const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500, color: '#9a9a9a', marginBottom: 6, fontFamily: "'Inter', sans-serif",
};

export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  border: '1px solid #1a2515', background: '#060a06', color: '#e8e8e8',
  fontSize: 14, fontFamily: "'Inter', sans-serif",
};

export const errorStyle: React.CSSProperties = {
  color: '#ff5a5a', fontSize: 13, marginTop: 16, padding: '10px 14px',
  background: 'rgba(255,90,90,0.08)', borderRadius: 10, border: '1px solid rgba(255,90,90,0.15)',
};

export const successStyle: React.CSSProperties = {
  color: '#3eb002', fontSize: 13, marginTop: 16, padding: '10px 14px',
  background: 'rgba(62,176,2,0.08)', borderRadius: 10, border: '1px solid rgba(62,176,2,0.15)',
};

// ── AuthInput ─────────────────────────────────────────────────────
export function AuthInput({ label, value, onChange, type = 'text', hint }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; hint?: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#9a9a9a', marginBottom: 6, fontFamily: "'Inter', sans-serif" }}>{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={hint || ''}
        style={{
          width: '100%', padding: '12px 14px', borderRadius: 10,
          border: '1px solid #1a2515', background: '#060a06', color: '#e8e8e8',
          fontSize: 14, fontFamily: "'Inter', sans-serif", transition: 'all 0.15s',
        }}
      />
    </div>
  );
}

// ── KpiCard ───────────────────────────────────────────────────────
export function KpiCard({ icon, label, value, color = '#e8e8e8', sub }: {
  icon: string; label: string; value: any; color?: string; sub?: string;
}) {
  return (
    <div style={{
      background: '#0c120c', borderRadius: 14, padding: 20, border: '1px solid #1a2515',
      transition: 'border 0.2s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 28 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginTop: 10, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "'Space Grotesk', sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────
export function Sparkline({ data, color, width = 100, height = 24 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── EmptyState ────────────────────────────────────────────────────
export function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: 64,
      background: '#0c120c', borderRadius: 16, border: '1px solid #1a2515',
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#9a9a9a', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: '#555' }}>{text}</div>
    </div>
  );
}
