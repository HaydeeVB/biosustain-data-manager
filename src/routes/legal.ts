/**
 * legal.ts — Documentos legales públicos (política de privacidad y aviso).
 *
 * GET /api/v1/legal/privacidad → texto de política de privacidad
 * GET /api/v1/legal/terminos    → texto de términos de servicio
 *
 * Sirve HTML simple y legible para que la checkbox de registro tenga un enlace
 * real (objetivo de cumplimiento del checklist Post-XPRIZE).
 */
import { Router } from 'express';

const router = Router();

const PRIVACIDAD_TEXTO = `
<h2>Política de Privacidad — BioSustain Data-Manager</h2>
<p><em>Última actualización: septiembre 2026</em></p>
<p>En BioSustain Research Lab (Bio Morphix C.A.) protegemos los datos personales de nuestros usuarios.</p>
<h3>1. Datos que recopilamos</h3>
<ul>
  <li><strong>Datos de cuenta:</strong> nombre, correo electrónico, empresa, teléfono (según se proporcione en el registro).</li>
  <li><strong>Datos operativos:</strong> registro de lotes orgánicos, métricas de cesta (temperatura, humedad, biomasa) e información de telemetría de los sensores del usuario.</li>
  <li><strong>Datos de facturación:</strong> referencia de pago; no almacenamos credenciales de billeteras ni medios de pago.</li>
</ul>
<h3>2. Uso de los datos</h3>
<p>Utilizamos los datos para prestar el servicio: mostrar métricas en tiempo real, generar estimaciones ESG, emitir reportes preliminares y habilitar las proyecciones de biomasa. No vendemos datos personales a terceros.</p>
<h3>3. Compartir con terceros</h3>
<p>Las métricas anónimas/agregadas pueden usarse para investigación y mejora del modelo. Los datos de cada cuenta permanecen asociados a su propietario. No transferimos datos a terceros sin tu consentimiento, salvo obligación legal.</p>
<h3>4. Seguridad</h3>
<p>Aplicamos cifrado en tránsito (HTTPS) y controles de acceso por autenticación. Ningún sistema es 100% seguro; notificaremos incidentes relevantes según aplique.</p>
<h3>5. Retención y derechos</h3>
<p>Conservamos los datos mientras la cuenta esté activa o según exija la ley. Puedes solicitar acceso, corrección o eliminación de tus datos contactando a tu administrador de cuenta.</p>
<h3>6. Estimaciones, no certificaciones</h3>
<p>Los reportes ESG son <strong>estimaciones preliminares</strong> calculadas con metodologías IPCC; no constituyen certificación de terceros.</p>
<h3>7. Contacto</h3>
<p>BioSustain Research Lab (Bio Morphix C.A.) — Aragua, Venezuela.</p>
`;

const TERMINOS_TEXTO = `
<h2>Términos de Servicio — BioSustain Data-Manager</h2>
<p><em>Última actualización: septiembre 2026</em></p>
<p>Al acceder a la plataforma aceptas los siguientes términos.</p>
<h3>1. Uso del servicio</h3>
<p>La plataforma permite registrar lotes orgánicos, monitorear cestas y generar estimaciones de impacto ambiental. El uso se concede de forma no exclusiva y personal para el negocio registrado.</p>
<h3>2. Veracidad de los datos</h3>
<p>El usuario es responsable de la exactitud de los datos que ingresa (pesos, tipos de residuo, sustrato). Las proyecciones de biomasa, cosecha y ESG dependen de esos datos y son <strong>estimaciones</strong>.</p>
<h3>3. No certificación</h3>
<p>Los reportes ESG generados por la plataforma son estimaciones preliminares y <strong>no constituyen certificación de terceros</strong>. El usuario debe verificar cualquier uso regulatorio o de auditoría.</p>
<h3>4. Confidencialidad (NDA)</h3>
<p>Al usar el panel aceptas el Acuerdo de Confidencialidad (NDA) de la plataforma, que protege la propiedad intelectual de BioSustain y de sus clientes.</p>
<h3>5. Suscripciones y pagos</h3>
<p>Los planes se cobran según lo contratado (USDT u otros medios habilitados). Las renovaciones pueden cancelarse según los mecanismos del panel de facturación.</p>
<h3>6. Limitación de responsabilidad</h3>
<p>El servicio se ofrece "tal cual". BioSustain no garantiza resultados concretos y no será responsable por daños indirectos derivados del uso.</p>
<h3>7. Cambios a los términos</h3>
<p>Nos reservamos el derecho de actualizar estos términos; los cambios se publicarán en esta página.</p>
<h3>8. Contacto</h3>
<p>BioSustain Research Lab (Bio Morphix C.A.) — Aragua, Venezuela.</p>
`;

const wrapper = (title: string, body: string) => `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — BioSustain</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:760px;margin:0 auto;padding:40px 24px;line-height:1.6;color:#222;background:#fcfcf9}h1,h2,h3{color:#2d5f2d}em{color:#666}</style>
</head>
<body>${body}</body></html>`;

router.get('/privacidad', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(wrapper('Política de Privacidad', PRIVACIDAD_TEXTO));
});

router.get('/terminos', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(wrapper('Términos de Servicio', TERMINOS_TEXTO));
});

export default router;
