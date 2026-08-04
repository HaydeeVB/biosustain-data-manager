'use client';

import { useState, useEffect } from 'react';

import { VideoBackground } from './VideoBackground';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://biosustain-saas-683265952295.us-central1.run.app';

// ── Brand colors ───────────────────────────────────────────────────
const C = {
  bg: '#060a06',
  bg2: '#0a0f0a',
  card: '#0c120c',
  cardHover: '#0f1610',
  border: '#1a2515',
  borderHover: '#2a3520',
  green: '#3eb002',
  greenDim: '#2a8000',
  greenGlow: 'rgba(62, 176, 2, 0.12)',
  text: '#e8e8e8',
  text2: '#9a9a9a',
  text3: '#8a8a8a',
  warn: '#e8a000',
  danger: '#ff5a5a',
  font: "'Inter', -apple-system, sans-serif",
  fontDisplay: "'Space Grotesk', 'Inter', sans-serif",
};

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<'login' | 'register' | 'dashboard'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState<any>(null);
  const [esg, setEsg] = useState<any>(null);
  const [plans, setPlans] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [lotes, setLotes] = useState<any[]>([]);
  const [sparklines, setSparklines] = useState<Record<string, { temp: number[]; humedad: number[]; biomasa: number[] }>>({});
  const [publicStats, setPublicStats] = useState({ cestas: 0, eficiencia: 0, co2e: 0 });
  const [cliente, setCliente] = useState<any>(null);
  const [tab, setTab] = useState<'resumen' | 'cestas' | 'lotes' | 'esg' | 'facturacion' | 'ajustes'>('resumen');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // Fetch public stats for login screen
    fetch(`${API_URL}/api/v1/public/stats`).then(r => r.json()).then(d => setPublicStats(d)).catch(() => {});
    const saved = localStorage.getItem('biosustain_token');
    if (saved) {
      setToken(saved);
      setView('dashboard');
      loadDashboard(saved).catch(() => {
        // Token expired or invalid — clear and return to login
        localStorage.removeItem('biosustain_token');
        setToken(null);
        setView('login');
      });
    }
  }, []);

  const loadDashboard = async (t: string) => {
    try {
      const h = { Authorization: `Bearer ${t}` };
      const [dashRes, esgRes, plansRes, meRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/dashboard`, { headers: h }),
        fetch(`${API_URL}/api/v1/esg`, { headers: h }),
        fetch(`${API_URL}/api/v1/billing/plans`),
        fetch(`${API_URL}/api/v1/auth/me`, { headers: h }),
      ]);
      if (dashRes.ok) setDashboard(await dashRes.json());
      if (esgRes.ok) setEsg(await esgRes.json());
      if (plansRes.ok) setPlans(await plansRes.json());
      if (meRes.ok) { const me = await meRes.json(); setCliente(me.cliente || me); }
      const subRes = await fetch(`${API_URL}/api/v1/billing/subscription`, { headers: h });
      if (subRes.ok) setSubscription(await subRes.json());
      const lotesRes = await fetch(`${API_URL}/api/v1/lotes`, { headers: h });
      if (lotesRes.ok) { const lData = await lotesRes.json(); setLotes(lData.lotes || []); }
      const sparkRes = await fetch(`${API_URL}/api/v1/cestas/sparklines/all`, { headers: h });
      if (sparkRes.ok) { const sparkData = await sparkRes.json(); setSparklines(sparkData.sparklines || {}); }
    } catch (e) { console.error('Load error:', e); }
  };

  const handleLogin = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('biosustain_token', data.token);
        setToken(data.token); setCliente(data.cliente);
        setView('dashboard'); loadDashboard(data.token);
      } else { setError(data.error || 'Error al iniciar sesión'); }
    } catch { setError('No se pudo conectar al servidor'); }
    setLoading(false);
  };

  const handleRegister = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nombre: name, empresa }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('biosustain_token', data.token);
        setToken(data.token); setCliente(data.cliente);
        setView('dashboard'); loadDashboard(data.token);
      } else { setError(data.error || 'Error al registrarse'); }
    } catch { setError('No se pudo conectar al servidor'); }
    setLoading(false);
  };

  const handleSubscribe = async (plan: string) => {
    setLoading(true);
    try {
      await fetch(`${API_URL}/api/v1/billing/subscribe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan, provider: 'mock' }),
      });
      loadDashboard(token!);
    } catch {}
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('biosustain_token');
    setToken(null); setView('login'); setDashboard(null); setCliente(null);
  };

  // ═══════════════════════════════════════════════════════════════════
  // AUTH SCREEN — split layout with brand panel
  // ═══════════════════════════════════════════════════════════════════
  if (view !== 'dashboard') {
    return (
      <div style={{ minHeight: '100vh', position: 'relative', zIndex: 1, background: C.bg }}>
        {/* Full-screen video background */}
        <VideoBackground />

        {/* Content layer on top of video */}
        <div style={{ position: 'relative', zIndex: 2, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          {/* Brand section */}
          <div style={{ flex: '0 0 auto', padding: '48px 32px 32px' }}>
            <div style={{ position: 'relative', zIndex: 3 }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>🌱</div>
              <h1 style={{ fontFamily: C.fontDisplay, fontSize: 28, fontWeight: 700, color: C.text, lineHeight: 1.15, marginBottom: 12, textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}>
                Bioconversión <span style={{ color: C.green }}>inteligente</span> para el Sur del Lago
              </h1>
              <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.5, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
                Monitoreo en tiempo real, proyección de biomasa y reportes ESG certificados.
              </p>
              <div style={{ display: 'flex', gap: 20, marginTop: 20 }}>
                <div><div style={{ fontSize: 20, fontWeight: 700, color: C.green, fontFamily: C.fontDisplay }}>{publicStats.cestas}</div><div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cestas</div></div>
                <div><div style={{ fontSize: 20, fontWeight: 700, color: C.green, fontFamily: C.fontDisplay }}>{publicStats.eficiencia}%</div><div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Eficiencia</div></div>
                <div><div style={{ fontSize: 20, fontWeight: 700, color: C.green, fontFamily: C.fontDisplay }}>{publicStats.co2e.toFixed(2)}t</div><div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: 0.5 }}>CO₂e</div></div>
              </div>
            </div>
          </div>

          {/* Form section */}
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
            padding: '0 24px 48px',
          }}>
            <div style={{ width: '100%', maxWidth: 380, margin: '0 auto' }}>
              <div style={{
                display: 'flex', background: 'rgba(12,18,12,0.85)', backdropFilter: 'blur(20px)',
                borderRadius: 12, padding: 4, border: `1px solid ${C.border}`, marginBottom: 24,
              }}>
                <button onClick={() => setView('login')} style={authTab(view === 'login')}>Iniciar sesión</button>
                <button onClick={() => setView('register')} style={authTab(view === 'register')}>Registrarse</button>
              </div>

              {view === 'register' && (
                <>
                  <AuthInput label="Nombre completo" value={name} onChange={setName} />
                  <AuthInput label="Empresa (opcional)" value={empresa} onChange={setEmpresa} />
                </>
              )}
              <AuthInput label="Correo electrónico" type="email" value={email} onChange={setEmail} />
              <AuthInput label="Contraseña" type="password" value={password} onChange={setPassword} hint="Mínimo 8 caracteres" />

              {error && (
                <div style={{
                  color: C.danger, fontSize: 13, marginBottom: 16, padding: '10px 14px',
                  background: 'rgba(255,90,90,0.08)', borderRadius: 10, border: '1px solid rgba(255,90,90,0.15)',
                }}>⚠️ {error}</div>
              )}

              <button onClick={view === 'login' ? handleLogin : handleRegister} disabled={loading} style={{
                width: '100%', padding: 14, borderRadius: 12, border: 'none', cursor: loading ? 'wait' : 'pointer',
                background: C.green, color: '#060a06', fontSize: 15, fontWeight: 700, fontFamily: C.font,
                boxShadow: `0 4px 20px ${C.greenGlow}`, opacity: loading ? 0.6 : 1,
              }}>
                {loading ? 'Procesando...' : view === 'login' ? 'Entrar al panel' : 'Crear cuenta'}
              </button>

              <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: C.text3, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                BioSustain Research Lab · Aragua, Venezuela
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // DASHBOARD — sidebar layout
  // ═══════════════════════════════════════════════════════════════════
  const navItems = [
    { key: 'resumen', label: 'Resumen', icon: '📊' },
    { key: 'cestas', label: 'Cestas', icon: '📦' },
    { key: 'lotes', label: 'Lotes', icon: '🌱' },
    { key: 'esg', label: 'ESG', icon: '🌍' },
    { key: 'facturacion', label: 'Facturación', icon: '💳' },
    // Ajustes tab hidden until SEC-BS-006 is fixed (auth middleware not mounted)
    // { key: 'ajustes', label: 'Ajustes', icon: '⚙️' },
  ] as const;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', position: 'relative', zIndex: 1 }}>
      {/* Sidebar — hidden on mobile, toggle button shows it */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 20, display: 'block',
        }} />
      )}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} style={{
        width: 240, flexShrink: 0, background: C.bg2, borderRight: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column', height: '100vh',
      }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🌱</span>
            <span style={{ fontFamily: C.fontDisplay, fontSize: 20, fontWeight: 700, color: C.text }}>
              Bio<span style={{ color: C.green }}>Sustain</span>
            </span>
          </div>
          <div style={{ fontSize: 11, color: C.text3, marginTop: 6, marginLeft: 34 }}>
            {cliente?.empresa || cliente?.nombre || ''}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 12px' }}>
          {navItems.map((item) => (
            <button key={item.key} onClick={() => { setTab(item.key); setSidebarOpen(false); }} style={navItemStyle(tab === item.key)}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User & settings & logout */}
        <div style={{ padding: 20, borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: C.greenDim,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: C.text, flexShrink: 0,
            }}>
              {(cliente?.nombre?.[0] || 'U').toUpperCase()}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cliente?.nombre || 'Usuario'}</div>
              <div style={{ fontSize: 11, color: C.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cliente?.email || ''}</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setTab('ajustes' as any)} style={{
              flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
              background: 'transparent', color: C.text2, cursor: 'pointer', fontSize: 12, fontFamily: C.font,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>⚙️ Ajustes</button>
            <button onClick={handleLogout} style={{
              flex: 1, padding: '8px 10px', borderRadius: 8, border: `1px solid rgba(255,90,90,0.2)`,
              background: 'rgba(255,90,90,0.05)', color: C.danger, cursor: 'pointer', fontSize: 12, fontFamily: C.font,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>↩ Cerrar sesión</button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content" style={{ flex: 1, overflowY: 'auto' }}>
        {/* Mobile menu button */}
        <button className="menu-btn" onClick={() => setSidebarOpen(true)} style={{
          position: 'fixed', top: 16, left: 16, zIndex: 15,
          padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
          background: C.card, color: C.text, cursor: 'pointer', fontSize: 18, fontFamily: C.font,
          alignItems: 'center', justifyContent: 'center',
        }}>☰</button>

        {/* Page header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: C.fontDisplay, fontSize: 28, fontWeight: 700, color: C.text }}>
            {tab === 'resumen' && 'Panel de control'}
            {tab === 'cestas' && 'Mis cestas'}
            {tab === 'lotes' && 'Registro de lotes'}
            {tab === 'esg' && 'Métricas ESG'}
            {tab === 'facturacion' && 'Planes y suscripción'}
            {tab === 'ajustes' && 'Ajustes de cuenta'}
          </h1>
          <p style={{ fontSize: 14, color: C.text2, marginTop: 4 }}>
            {tab === 'resumen' && 'Estado general de tu operación de bioconversión'}
            {tab === 'cestas' && 'Monitoreo en tiempo real de tus unidades de bioconversión'}
            {tab === 'lotes' && 'Registra residuos orgánicos y obtén proyecciones automáticas'}
            {tab === 'esg' && 'Impacto ambiental calculado según metodologías IPCC'}
            {tab === 'facturacion' && 'Gestiona tu plan de suscripción'}
            {tab === 'ajustes' && 'Gestiona tu cuenta y contraseña'}
          </p>
        </div>

        {/* ── RESUMEN ── */}
        {tab === 'resumen' && dashboard && (
          <div className="animate-in">
            {/* KPI cards */}
            <div className="kpi-grid" style={{ display: 'grid', gap: 16, marginBottom: 32 }}>
              <KpiCard icon="📦" label="Cestas activas" value={dashboard.cestasActivas ?? 0} sub={`${dashboard.totalCestas ?? 0} total`} />
              <KpiCard icon="⚠️" label="Alertas" value={dashboard.alertas ?? 0} color={dashboard.alertas > 0 ? C.warn : C.green} sub={dashboard.alertas > 0 ? 'Requiere atención' : 'Todo en orden'} />
              <KpiCard icon="⚙️" label="Eficiencia" value={`${dashboard.eficiencia ?? 0}%`} color={C.green} sub="Promedio del sistema" />
              <KpiCard icon="🌱" label="Lotes activos" value={lotes.length} color={C.green} sub={`${lotes.reduce((s, l) => s + (l.pesoKg || 0), 0).toFixed(0)} kg procesados`} />
            </div>

            {/* Recent cestas */}
            {dashboard.cestas && dashboard.cestas.length > 0 && (
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 16, fontFamily: C.fontDisplay }}>Cestas recientes</h3>
                <div className="cesta-grid" style={{ display: 'grid', gap: 14 }}>
                  {dashboard.cestas.slice(0, 6).map((c: any) => (
                    <CestaCard key={c.id} cesta={c} sparkline={sparklines[c.id]} />
                  ))}
                </div>
              </div>
            )}

            {!dashboard.cestas?.length && (
              <EmptyState icon="📭" title="Sin cestas asignadas" text="Regístrate en un plan para comenzar a monitorear tus unidades de bioconversión." />
            )}
          </div>
        )}

        {/* ── CESTAS ── */}
        {tab === 'cestas' && dashboard && (
          <div className="animate-in">
            {dashboard.cestas?.length > 0 ? (
              <div className="cesta-grid" style={{ display: 'grid', gap: 16 }}>
                {dashboard.cestas.map((c: any) => (
                  <CestaCard key={c.id} cesta={c} detailed sparkline={sparklines[c.id]} />
                ))}
              </div>
            ) : (
              <EmptyState icon="📦" title="Sin cestas" text="No tienes cestas asignadas todavía." />
            )}
          </div>
        )}

        {/* ── LOTES ── */}
        {tab === 'lotes' && (
          <div className="animate-in">
            <LoteForm onCreated={() => loadDashboard(token!)} cestas={dashboard?.cestas || []} />

            {lotes.length > 0 ? (
              <div style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 16, fontFamily: C.fontDisplay }}>
                  Lotes registrados ({lotes.length})
                </h3>
                {lotes.map((l: any) => <LoteCard key={l.id} lote={l} />)}

                <button onClick={async () => {
                  const res = await fetch(`${API_URL}/api/v1/reports/esg`, { headers: { Authorization: `Bearer ${token}` } });
                  const blob = await res.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'BioSustain_Reporte_ESG.pdf'; a.click();
                }} style={{
                  padding: '12px 24px', borderRadius: 12, border: `1px solid ${C.green}`,
                  background: 'transparent', color: C.green, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: C.font, marginTop: 16,
                }}>📄 Exportar Reporte ESG (PDF)</button>
              </div>
            ) : (
              <EmptyState icon="🌱" title="Sin lotes registrados" text="Crea tu primer lote arriba para comenzar a generar métricas." />
            )}
          </div>
        )}

        {/* ── ESG ── */}
        {tab === 'esg' && esg && (
          <div className="animate-in">
            <div className="kpi-grid" style={{ display: 'grid', gap: 16, marginBottom: 24 }}>
              <KpiCard icon="♻️" label="Residuos reconvertidos" value={`${(esg.residuosReconvertidos ?? 0).toFixed(2)} t`} color={C.green} sub="Total acumulado" />
              <KpiCard icon="🌾" label="Frass certificado" value={`${(esg.frassCertificado ?? 0).toFixed(2)} t`} color={C.green} sub="Biofertilizer producido" />
              <KpiCard icon="🌍" label="CO₂e reducido" value={`${(esg.co2eReducido ?? 0).toFixed(2)} t`} color={C.green} sub="GEI mitigado" />
              <KpiCard icon="💨" label="Metano evitado" value={`${(esg.metanoEvitado ?? 0).toFixed(2)} t`} color={C.green} sub="CH₄ no emitido" />
            </div>
            <div style={{
              background: C.card, borderRadius: 16, padding: 24, border: `1px solid ${C.border}`,
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 12, fontFamily: C.fontDisplay }}>Metodología</h3>
              <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.7 }}>
                Las métricas se calculan según metodologías IPCC para mitigación de gases de efecto invernadero (GEI).
                Los datos provienen del registro de lotes orgánicos procesados por bioconversión con <em>Hermetia illucens</em> (BSF).
                Los reportes están listos para auditorías ambientales, certificaciones y solicitudes de financiamiento.
              </p>
            </div>
          </div>
        )}

        {/* ── FACTURACIÓN ── */}
        {tab === 'facturacion' && (
          <div className="animate-in">
            {subscription && subscription.plan && (
              <div style={{
                background: C.greenGlow, borderRadius: 16, padding: 20, marginBottom: 20,
                border: `1px solid ${C.green}`,
              }}>
                <div style={{ fontWeight: 700, color: C.green, fontSize: 15 }}>✓ Suscripción activa: {subscription.plan}</div>
                <div style={{ fontSize: 13, color: C.text2, marginTop: 4 }}>
                  Estado: {subscription.estado || 'activa'} · ${subscription.montoMensual || 0}/mes
                </div>
              </div>
            )}

            <div className="plan-grid" style={{ display: 'grid', gap: 16 }}>
              {plans && plans.planes && Object.entries(plans.planes).map(([key, p]: [string, any]) => (
                <div key={key} style={{
                  background: C.card, borderRadius: 16, padding: 28, position: 'relative',
                  border: key === 'pro' ? `2px solid ${C.green}` : `1px solid ${C.border}`,
                  boxShadow: key === 'pro' ? `0 0 30px ${C.greenGlow}` : 'none',
                }}>
                  {key === 'pro' && (
                    <div style={{
                      position: 'absolute', top: -11, right: 20, background: C.green, color: '#fff',
                      fontSize: 10, fontWeight: 700, padding: '4px 12px', borderRadius: 20, textTransform: 'uppercase',
                    }}>Más popular</div>
                  )}
                  <div style={{ fontSize: 11, color: C.text3, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, fontFamily: C.fontDisplay }}>{key}</div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: C.green, marginBottom: 4, fontFamily: C.fontDisplay }}>
                    ${p.precioMensual}<span style={{ fontSize: 16, color: C.text3, fontWeight: 400 }}>/mes</span>
                  </div>
                  {p.promoLanzamiento && (
                    <div style={{
                      fontSize: 12, color: C.green, marginBottom: 16, marginTop: 8,
                      background: C.greenGlow, padding: '8px 12px', borderRadius: 8, display: 'inline-block',
                    }}>🎉 {p.promoLanzamiento}</div>
                  )}
                  <ul style={{ listStyle: 'none', padding: 0, fontSize: 13, color: C.text2, lineHeight: 2, marginTop: 12 }}>
                    {p.features.map((f: string, i: number) => (
                      <li key={i} style={{ display: 'flex', gap: 8 }}><span style={{ color: C.green }}>✓</span> {f}</li>
                    ))}
                  </ul>
                  <button onClick={() => handleSubscribe(key)} disabled={loading} style={{
                    width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: key === 'pro' ? C.green : C.border, color: key === 'pro' ? '#fff' : C.text,
                    fontSize: 14, fontWeight: 600, fontFamily: C.font, marginTop: 16,
                  }}>Suscribirse</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* ── AJUSTES ── */}
        {tab === 'ajustes' && (
          <div className="animate-in">
            <SettingsPanel token={token} cliente={cliente} onUpdate={() => loadDashboard(token!)} />
          </div>
        )}
      </main>
    </div>
  );

  // ── Component styles ────────────────────────────────────────────────

  function authTab(active: boolean): React.CSSProperties {
    return {
      flex: 1, padding: '10px 0', border: 'none', borderRadius: 8, cursor: 'pointer',
      background: active ? C.green : 'transparent', color: active ? '#fff' : C.text2,
      fontSize: 14, fontWeight: 600, fontFamily: C.font, transition: 'all 0.15s',
    };
  }

  function navItemStyle(active: boolean): React.CSSProperties {
    return {
      display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 16px',
      border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: C.font, fontSize: 14,
      fontWeight: active ? 600 : 400, color: active ? C.green : C.text2,
      background: active ? C.greenGlow : 'transparent', marginBottom: 4,
      transition: 'all 0.15s', textAlign: 'left' as const,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function AuthInput({ label, value, onChange, type = 'text', hint }: {
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

function KpiCard({ icon, label, value, color = '#e8e8e8', sub }: {
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

function Sparkline({ data, color, width = 100, height = 24 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  const lastVal = data[data.length - 1];
  const lastX = width;
  const lastY = height - ((lastVal - min) / range) * height;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={2} fill={color} />
    </svg>
  );
}

function CestaCard({ cesta, detailed = false, sparkline }: { cesta: any; detailed?: boolean; sparkline?: { temp: number[]; humedad: number[]; biomasa: number[] } }) {
  const temp = cesta.ultimaTemp;
  const hum = cesta.ultimaHumedad;
  const hasAlert = (temp && temp > 32) || (hum && hum < 50);

  return (
    <div style={{
      background: '#0c120c', borderRadius: 14, padding: 18, border: `1px solid ${hasAlert ? '#3a2a10' : '#1a2515'}`,
      transition: 'border 0.2s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#e8e8e8', fontFamily: "'Space Grotesk', sans-serif" }}>{cesta.id}</div>
        <span style={{
          padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
          background: cesta.estado === 'activa' ? 'rgba(62,176,2,0.15)' : 'rgba(200,180,100,0.15)',
          color: cesta.estado === 'activa' ? '#3eb002' : '#cca',
        }}>{cesta.estado || 'activa'}</span>
      </div>
      <div style={{ fontSize: 12, color: '#9a9a9a', marginBottom: 14 }}>📍 {cesta.ubicacion || 'Sin ubicación'}</div>
      {(temp !== null || hum !== null) && (
        <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
          <div>
            <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase' }}>Temp</div>
            <div style={{ fontWeight: 600, color: temp > 32 ? '#e8a000' : '#3eb002' }}>{temp ? `${temp.toFixed(1)}°C` : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase' }}>Humedad</div>
            <div style={{ fontWeight: 600, color: hum < 50 ? '#e8a000' : '#3eb002' }}>{hum ? `${hum.toFixed(0)}%` : '—'}</div>
          </div>
          {detailed && cesta.ultimaBiomasa && (
            <div>
              <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase' }}>Biomasa</div>
              <div style={{ fontWeight: 600, color: '#3eb002' }}>{cesta.ultimaBiomasa.toFixed(1)} kg</div>
            </div>
          )}
        </div>
      )}
      {sparkline && (sparkline.temp.length > 1 || sparkline.humedad.length > 1) && (
        <div style={{ display: 'flex', gap: 12, marginTop: 10, paddingTop: 10, borderTop: '1px solid #1a2515' }}>
          {sparkline.temp.length > 1 && (
            <div>
              <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', marginBottom: 2 }}>Temp</div>
              <Sparkline data={sparkline.temp} color={temp > 32 ? '#e8a000' : '#3eb002'} width={80} height={20} />
            </div>
          )}
          {sparkline.humedad.length > 1 && (
            <div>
              <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', marginBottom: 2 }}>Humedad</div>
              <Sparkline data={sparkline.humedad} color={hum < 50 ? '#e8a000' : '#3eb002'} width={80} height={20} />
            </div>
          )}
          {detailed && sparkline.biomasa.length > 1 && (
            <div>
              <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', marginBottom: 2 }}>Biomasa</div>
              <Sparkline data={sparkline.biomasa} color="#3eb002" width={80} height={20} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LoteCard({ lote }: { lote: any }) {
  return (
    <div style={{
      background: '#0c120c', borderRadius: 14, padding: 18, marginBottom: 12,
      border: '1px solid #1a2515',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#e8e8e8', fontFamily: "'Space Grotesk', sans-serif" }}>{lote.tipoResiduo}</div>
        <span style={{
          padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
          background: lote.estado === 'activo' ? 'rgba(62,176,2,0.15)' : 'rgba(200,180,100,0.15)',
          color: lote.estado === 'activo' ? '#3eb002' : '#cca',
        }}>{lote.estado}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, fontSize: 13, color: '#9a9a9a' }}>
        <div>📍 {lote.cestaUbicacion || 'N/A'}</div>
        <div>⚖️ {lote.pesoKg} kg</div>
        <div>📦 {lote.tipoSustrato}</div>
        <div>🌱 {lote.biomasaEstimadaKg?.toFixed(1)} kg biomasa</div>
        <div>🌍 {lote.co2eReducidoKg?.toFixed(1)} kg CO₂e</div>
        <div>📅 {lote.fechaProyeccionCosecha ? new Date(lote.fechaProyeccionCosecha).toLocaleDateString('es-ES') : '—'}</div>
      </div>
    </div>
  );
}

function LoteForm({ onCreated, cestas }: { onCreated: () => void; cestas: any[] }) {
  const [tipoResiduo, setTipoResiduo] = useState('');
  const [pesoKg, setPesoKg] = useState('');
  const [cestaId, setCestaId] = useState('');
  const [tipoSustrato, setTipoSustrato] = useState('Diana (36% verde)');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async () => {
    setLoading(true); setError(''); setSuccess('');
    try {
      const token = localStorage.getItem('biosustain_token');
      const res = await fetch(`${API_URL}/api/v1/lotes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cestaId, tipoResiduo, pesoKg: parseFloat(pesoKg), tipoSustrato }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Lote registrado: ${data.lote.biomasaEstimadaKg} kg biomasa, ${data.lote.co2eReducidoKg} kg CO₂e reducido`);
        setTipoResiduo(''); setPesoKg(''); onCreated();
      } else { setError(data.error || 'Error al registrar lote'); }
    } catch { setError('No se pudo conectar al servidor'); }
    setLoading(false);
  };

  return (
    <div style={{
      background: '#0c120c', borderRadius: 16, padding: 24, border: '1px solid #1a2515',
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e8e8e8', marginBottom: 4, fontFamily: "'Space Grotesk', sans-serif" }}>Registrar nuevo lote</h3>
      <p style={{ fontSize: 13, color: '#9a9a9a', marginBottom: 20 }}>Ingresa los datos de tus residuos orgánicos. El sistema calcula proyección de cosecha, biomasa y CO₂e.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <label style={labelStyle}>Cesta</label>
          <select value={cestaId} onChange={e => setCestaId(e.target.value)} style={inputStyle}>
            <option value="">Selecciona...</option>
            {cestas.map((c: any) => <option key={c.id} value={c.id}>{c.id} — {c.ubicacion || ''}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Peso (kg)</label>
          <input type="number" value={pesoKg} onChange={e => setPesoKg(e.target.value)} placeholder="Ej. 250" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Tipo de residuo</label>
          <input value={tipoResiduo} onChange={e => setTipoResiduo(e.target.value)} placeholder="Ej. Residuos orgánicos municipales" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Sustrato</label>
          <select value={tipoSustrato} onChange={e => setTipoSustrato(e.target.value)} style={inputStyle}>
            <option>Diana (36% verde)</option>
            <option>Fibroso (60% verde)</option>
            <option>Rico (15% verde)</option>
          </select>
        </div>
      </div>

      {error && <div style={errorStyle}>⚠️ {error}</div>}
      {success && <div style={successStyle}>✓ {success}</div>}

      <button onClick={handleSubmit} disabled={loading || !tipoResiduo || !pesoKg || !cestaId} style={{
        padding: '12px 28px', borderRadius: 12, border: 'none', cursor: loading ? 'wait' : 'pointer',
        background: '#3eb002', color: '#060a06', fontSize: 14, fontWeight: 700, fontFamily: "'Inter', sans-serif",
        marginTop: 16, boxShadow: '0 4px 14px rgba(62,176,2,0.25)', opacity: loading ? 0.6 : 1,
      }}>
        {loading ? 'Registrando...' : 'Registrar lote'}
      </button>
    </div>
  );
}

function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
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

// ── Shared styles ───────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500, color: '#9a9a9a', marginBottom: 6, fontFamily: "'Inter', sans-serif",
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  border: '1px solid #1a2515', background: '#060a06', color: '#e8e8e8',
  fontSize: 14, fontFamily: "'Inter', sans-serif",
};

const errorStyle: React.CSSProperties = {
  color: '#ff5a5a', fontSize: 13, marginTop: 16, padding: '10px 14px',
  background: 'rgba(255,90,90,0.08)', borderRadius: 10, border: '1px solid rgba(255,90,90,0.15)',
};

const successStyle: React.CSSProperties = {
  color: '#3eb002', fontSize: 13, marginTop: 16, padding: '10px 14px',
  background: 'rgba(62,176,2,0.08)', borderRadius: 10, border: '1px solid rgba(62,176,2,0.15)',
};

// ═══════════════════════════════════════════════════════════════════
// SETTINGS PANEL
// ═══════════════════════════════════════════════════════════════════

function SettingsPanel({ token, cliente, onUpdate }: { token: string | null; cliente: any; onUpdate: () => void }) {
  const [section, setSection] = useState<'perfil' | 'password'>('perfil');
  const [nombre, setNombre] = useState(cliente?.nombre || '');
  const [empresa, setEmpresa] = useState(cliente?.empresa || '');
  const [email] = useState(cliente?.email || '');
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const cardStyle: React.CSSProperties = {
    background: '#0c120c', borderRadius: 16, padding: 24, border: '1px solid #1a2515', marginBottom: 16,
  };

  const handleSaveProfile = async () => {
    setLoading(true); setMsg(''); setErr('');
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/me`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nombre: nombre, empresa: empresa }),
      });
      if (res.ok) { setMsg('Perfil actualizado correctamente.'); onUpdate(); }
      else { const d = await res.json(); setErr(d.error || 'Error al actualizar.'); }
    } catch { setErr('No se pudo conectar al servidor.'); }
    setLoading(false);
  };

  const handleChangePassword = async () => {
    if (newPass !== confirmPass) { setErr('Las contraseñas no coinciden.'); return; }
    if (newPass.length < 8) { setErr('La contraseña debe tener al menos 8 caracteres.'); return; }
    setLoading(true); setMsg(''); setErr('');
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass }),
      });
      if (res.ok) { setMsg('Contraseña actualizada correctamente.'); setOldPass(''); setNewPass(''); setConfirmPass(''); }
      else { const d = await res.json(); setErr(d.error || 'Error al cambiar contraseña.'); }
    } catch { setErr('No se pudo conectar al servidor.'); }
    setLoading(false);
  };

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setSection('perfil')} style={settingsTab(section === 'perfil')}>Perfil</button>
        <button onClick={() => setSection('password')} style={settingsTab(section === 'password')}>Cambiar contraseña</button>
      </div>

      {/* Profile section */}
      {section === 'perfil' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e8e8e8', marginBottom: 16, fontFamily: "'Space Grotesk', sans-serif" }}>Información de la cuenta</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Nombre</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Empresa</label>
              <input value={empresa} onChange={e => setEmpresa(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>Correo electrónico</label>
            <input value={email} disabled style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }} />
            <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>El correo no se puede cambiar.</div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <button onClick={handleSaveProfile} disabled={loading} style={{
              padding: '10px 24px', borderRadius: 10, border: 'none', cursor: loading ? 'wait' : 'pointer',
              background: '#3eb002', color: '#060a06', fontSize: 14, fontWeight: 600, fontFamily: "'Inter', sans-serif",
              opacity: loading ? 0.6 : 1,
            }}>{loading ? 'Guardando...' : 'Guardar cambios'}</button>
          </div>

          {msg && <div style={{ ...successStyle, marginTop: 16 }}>✓ {msg}</div>}
          {err && <div style={{ ...errorStyle, marginTop: 16 }}>⚠️ {err}</div>}

          {/* Account details */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #1a2515' }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: '#9a9a9a', marginBottom: 12, fontFamily: "'Space Grotesk', sans-serif" }}>Detalles de la cuenta</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
              <div><span style={{ color: '#555' }}>ID:</span> <span style={{ color: '#9a9a9a' }}>{cliente?.id || '—'}</span></div>
              <div><span style={{ color: '#555' }}>Plan:</span> <span style={{ color: '#3eb002' }}>{cliente?.plan || 'Gratuito'}</span></div>
              <div><span style={{ color: '#555' }}>Cuenta creada:</span> <span style={{ color: '#9a9a9a' }}>{cliente?.creadoEn ? new Date(cliente.creadoEn).toLocaleDateString('es-ES') : '—'}</span></div>
              <div><span style={{ color: '#555' }}>Teléfono:</span> <span style={{ color: '#9a9a9a' }}>{cliente?.telefono || 'No definido'}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Password section */}
      {section === 'password' && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e8e8e8', marginBottom: 4, fontFamily: "'Space Grotesk', sans-serif" }}>Cambiar contraseña</h3>
          <p style={{ fontSize: 13, color: '#9a9a9a', marginBottom: 20 }}>Ingresa tu contraseña actual y la nueva.</p>

          <div>
            <label style={labelStyle}>Contraseña actual</label>
            <input type="password" value={oldPass} onChange={e => setOldPass(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Nueva contraseña</label>
            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Mínimo 8 caracteres" style={inputStyle} />
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Confirmar nueva contraseña</label>
            <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} style={inputStyle} />
          </div>

          <button onClick={handleChangePassword} disabled={loading || !oldPass || !newPass} style={{
            padding: '10px 24px', borderRadius: 10, border: 'none', cursor: loading ? 'wait' : 'pointer',
            background: '#3eb002', color: '#060a06', fontSize: 14, fontWeight: 600, fontFamily: "'Inter', sans-serif",
            marginTop: 20, opacity: loading ? 0.6 : 1,
          }}>{loading ? 'Actualizando...' : 'Cambiar contraseña'}</button>

          {msg && <div style={{ ...successStyle, marginTop: 16 }}>✓ {msg}</div>}
          {err && <div style={{ ...errorStyle, marginTop: 16 }}>⚠️ {err}</div>}
        </div>
      )}
    </div>
  );
}

function settingsTab(active: boolean): React.CSSProperties {
  return {
    padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
    fontSize: 14, fontWeight: active ? 600 : 400, color: active ? '#3eb002' : '#9a9a9a',
    background: active ? 'rgba(62,176,2,0.1)' : 'transparent',
  };
}