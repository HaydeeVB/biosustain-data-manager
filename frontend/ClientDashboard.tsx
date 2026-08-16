/**
 * ClientDashboard.tsx — Dashboard del cliente para BioSustain SaaS.
 *
 * Mobile-first, Spanish language, read-only access to cesta data.
 * No operator controls — clients see their data, not the PLC.
 *
 * Funciona con el backend SaaS en /api/v1/.
 */
import React, { useState, useEffect } from 'react';

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface Cesta {
  id: string;
  ubicacion: string;
  fechaInstalacion: string;
  activa: boolean;
}

interface DashboardData {
  clienteId: string;
  resumen: {
    totalCestas: number;
    cestasActivas: number;
    cestasInactivas: number;
  };
  metricas: {
    biomasaTotalKg: number;
    sustratoRemanenteKg: number;
    eficienciaPromedio: number;
    mortalidadPromedio: number;
  };
  alertas: Array<{ tipo: string; mensaje: string; timestamp: string }>;
  ultimaActualizacion: string;
}

interface EsgData {
  metricas: {
    residuosReconvertidosTon: number;
    frassCertificadoTon: number;
    reduccionCO2eTon: number;
    eficienciaConversion: number;
  };
}

// ── Componente ─────────────────────────────────────────────────────────────────

export const ClientDashboard: React.FC = () => {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [cestas, setCestas] = useState<Cesta[]>([]);
  const [esg, setEsg] = useState<EsgData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'resumen' | 'cestas' | 'esg'>('resumen');

  // Token guardado en localStorage (post-login)
  const token = localStorage.getItem('biosustain_token') || '';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [dashRes, cestasRes, esgRes] = await Promise.all([
        fetch('/api/v1/dashboard', { headers }),
        fetch('/api/v1/cestas', { headers }),
        fetch('/api/v1/esg', { headers }),
      ]);

      if (!dashRes.ok) throw new Error('Error cargando dashboard');
      if (!cestasRes.ok) throw new Error('Error cargando cestas');

      setDashboard(await dashRes.json());
      setCestas((await cestasRes.json()).cestas || []);
      setEsg(await esgRes.json());
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <p className="text-lg">Cargando su panel...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">{error}</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="bg-emerald-500 hover:bg-emerald-600 px-6 py-2 rounded-lg"
          >
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-6">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-emerald-400">
          BioSustain Data-Manager
        </h1>
        <p className="text-sm text-slate-400">Panel de su granja de bioconversión</p>
      </header>

      {/* Navigation tabs */}
      <nav className="flex gap-2 mb-6 overflow-x-auto">
        <TabButton active={view === 'resumen'} onClick={() => setView('resumen')}>
          📊 Resumen
        </TabButton>
        <TabButton active={view === 'cestas'} onClick={() => setView('cestas')}>
          📦 Mis Cestas
        </TabButton>
        <TabButton active={view === 'esg'} onClick={() => setView('esg')}>
          🌱 ESG
        </TabButton>
      </nav>

      {/* Content */}
      {view === 'resumen' && dashboard && (
        <div className="space-y-4">
          {/* Cards de resumen */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Total Cestas" value={dashboard.resumen.totalCestas} unit="" />
            <MetricCard label="Activas" value={dashboard.resumen.cestasActivas} unit="" />
            <MetricCard label="Biomasa Total" value={dashboard.metricas.biomasaTotalKg} unit="kg" />
            <MetricCard label="Eficiencia" value={dashboard.metricas.eficienciaPromedio} unit="%" />
          </div>

          {/* Alertas */}
          <div className="bg-slate-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-3">Alertas Recientes</h2>
            {dashboard.alertas.length === 0 ? (
              <p className="text-slate-400 text-sm">Sin alertas. Todo operando normalmente.</p>
            ) : (
              <ul className="space-y-2">
                {dashboard.alertas.map((alert, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-yellow-400">⚠️</span>
                    <span>{alert.mensaje}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Última actualización */}
          <p className="text-xs text-slate-500 text-center">
            Última actualización: {new Date(dashboard.ultimaActualizacion).toLocaleString('es-VE')}
          </p>
        </div>
      )}

      {view === 'cestas' && (
        <div className="space-y-3">
          {cestas.length === 0 ? (
            <div className="bg-slate-800 rounded-lg p-6 text-center">
              <p className="text-slate-400">No tiene cestas registradas.</p>
              <p className="text-sm text-slate-500 mt-2">
                Contacte a BioSustain para adquirir su kit de cestas inteligentes.
              </p>
            </div>
          ) : (
            cestas.map(cesta => (
              <div key={cesta.id} className="bg-slate-800 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-emerald-400">{cesta.id}</h3>
                    <p className="text-sm text-slate-400">{cesta.ubicacion}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    cesta.activa ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                  }`}>
                    {cesta.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Instalada: {new Date(cesta.fechaInstalacion).toLocaleDateString('es-VE')}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {view === 'esg' && esg && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <MetricCard label="Residuos Reconvertidos" value={esg.metricas.residuosReconvertidosTon} unit="ton" />
            <MetricCard label="Frass Certificado" value={esg.metricas.frassCertificadoTon} unit="ton" />
            <MetricCard label="Reducción CO₂e" value={esg.metricas.reduccionCO2eTon} unit="ton" />
            <MetricCard label="Eficiencia Conversión" value={esg.metricas.eficienciaConversion} unit="%" />
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-2">Economía Circular</h2>
            <p className="text-sm text-slate-400">
              Su operación desvía residuos orgánicos de vertederos, los transforma en proteína
              mediante larvas de Hermetia illucens, y produce biofertilizante (frass) que
              regenera suelos. Cada tonelada procesada evita emisiones de metano y CO₂.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Componentes auxiliares ─────────────────────────────────────────────────────

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active, onClick, children
}) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
      active ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
    }`}
  >
    {children}
  </button>
);

const MetricCard: React.FC<{ label: string; value: number; unit: string }> = ({ label, value, unit }) => (
  <div className="bg-slate-800 rounded-lg p-4">
    <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
    <p className="text-2xl font-bold mt-1">
      {value.toLocaleString('es-VE')}
      <span className="text-sm text-slate-400 ml-1">{unit}</span>
    </p>
  </div>
);

export default ClientDashboard;