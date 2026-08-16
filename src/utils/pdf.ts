/**
 * pdf.ts — Generador de reportes PDF para BioSustain.
 *
 * Usa reportlab (Python) via child_process, o jsPDF para Node.js.
 * Aquí usamos un enfoque simple: generar el PDF con el motor de Node.
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

interface ReportData {
  client: { nombre: string; empresa: string; email: string };
  fecha: string;
  metricas: {
    residuosProcesadosKg: number;
    biomasaProducidaKg: number;
    frassEstimadoKg: number;
    co2eReducidoKg: number;
    metanoEvitadoKg: number;
  };
  lotes: Array<{
    id: string;
    cesta: string;
    tipoResiduo: string;
    pesoKg: number;
    sustrato: string;
    fechaIngreso: string;
    fechaCosecha: string;
    biomasaKg: number;
    co2eKg: number;
  }>;
  telemetry: any;
}

export async function generateEsgReport(data: ReportData): Promise<Buffer> {
  // Generate PDF using reportlab. The Python script is written to a temp file and
  // run via `python3 <file>` — NOT inlined in a shell `-c '...'` — so Spanish
  // accents/UTF-8 survive (the old inline-shell approach stripped them and could
  // break on any field containing a single-quote). Table cells are Paragraphs so
  // values wrap instead of being clipped at fixed widths.
  const tmpFile = path.join(os.tmpdir(), `biosustain_report_${Date.now()}.pdf`);
  const dataFile = path.join(os.tmpdir(), `biosustain_data_${Date.now()}.json`);
  const scriptFile = path.join(os.tmpdir(), `biosustain_report_${Date.now()}.py`);

  fs.writeFileSync(dataFile, JSON.stringify(data));

  const script = `
# -*- coding: utf-8 -*-
import json, sys
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.colors import HexColor, white

data = json.load(open('${dataFile}', encoding='utf-8'))
styles = getSampleStyleSheet()
ts = ParagraphStyle('T', parent=styles['Title'], fontSize=16, textColor=HexColor('#2d5f2d'))
hs = ParagraphStyle('H', parent=styles['Heading2'], fontSize=12, textColor=HexColor('#2d5f2d'))
bs = ParagraphStyle('B', parent=styles['Normal'], fontSize=9, leading=12)
th = ParagraphStyle('TH', parent=styles['Normal'], fontSize=8, leading=10, textColor=white,
                    alignment=1, fontName='Helvetica-Bold')
tc = ParagraphStyle('TC', parent=styles['Normal'], fontSize=8, leading=10, alignment=0)

def P(text, style=tc):
    return Paragraph(str(text), style)

doc = SimpleDocTemplate('${tmpFile}', pagesize=letter, topMargin=0.7*inch, bottomMargin=0.7*inch, leftMargin=0.8*inch, rightMargin=0.8*inch)
s = []

s.append(Paragraph('BioSustain — Reporte ESG Certificado', ts))
s.append(Spacer(1, 0.15*inch))
s.append(Paragraph(f"Cliente: {data['client']['nombre']}", bs))
s.append(Paragraph(f"Empresa: {data['client']['empresa']}", bs))
s.append(Paragraph(f"Fecha: {data['fecha'][:10]}", bs))
s.append(Spacer(1, 0.2*inch))

s.append(Paragraph('Métricas de Bioconversión', hs))
m = data['metricas']
s.append(Paragraph(f"- Residuos procesados: {m['residuosProcesadosKg']:.2f} kg", bs))
s.append(Paragraph(f"- Biomasa producida: {m['biomasaProducidaKg']:.2f} kg", bs))
s.append(Paragraph(f"- Frass estimado: {m['frassEstimadoKg']:.2f} kg", bs))
s.append(Paragraph(f"- CO2e reducido: {m['co2eReducidoKg']:.2f} kg", bs))
s.append(Paragraph(f"- Metano evitado: {m['metanoEvitadoKg']:.2f} kg", bs))
s.append(Spacer(1, 0.2*inch))

s.append(Paragraph('Trazabilidad de Lotes', hs))
if data['lotes']:
    lotes_data = [
        [P('Lote', th), P('Cesta', th), P('Residuo', th), P('Peso (kg)', th),
         P('Sustrato', th), P('Biomasa (kg)', th), P('CO2e (kg)', th)],
    ]
    for l in data['lotes']:
        lotes_data.append([
            P(f"<b>{l['id'][-12:]}</b>"), P(l['cesta']), P(l['tipoResiduo']),
            P(f"{l['pesoKg']:.1f}"), P(l['sustrato']),
            P(f"{l['biomasaKg']:.1f}"), P(f"{l['co2eKg']:.1f}"),
        ])
    t = Table(lotes_data, colWidths=[0.9*inch, 1.1*inch, 1.3*inch, 0.7*inch, 1.1*inch, 0.9*inch, 0.8*inch], repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), HexColor('#2d5f2d')),
        ('TEXTCOLOR', (0,0), (-1,0), white),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor('#aaa')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [HexColor('#f5f5f5'), white]),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    s.append(t)
else:
    s.append(Paragraph('No hay lotes registrados.', bs))

s.append(Spacer(1, 0.3*inch))
s.append(Paragraph('Certificación', hs))
s.append(Paragraph('Este reporte fue generado automáticamente por la plataforma BioSustain. Las métricas se calculan según metodologías IPCC para mitigación de gases de efecto invernadero (GEI). Los datos provienen del registro de lotes orgánicos procesados por bioconversión con Hermetia illucens (BSF).', bs))
s.append(Spacer(1, 0.2*inch))
s.append(Paragraph('BioSustain Research Lab — Plataforma de bioconversión sostenible', bs))

doc.build(s)
print('PDF generated')
`;

  try {
    fs.writeFileSync(scriptFile, script, 'utf-8');
    await execAsync(`python3 ${scriptFile}`, { timeout: 15000 });
    const buffer = fs.readFileSync(tmpFile);
    [tmpFile, dataFile, scriptFile].forEach((f) => { try { fs.unlinkSync(f); } catch {} });
    return buffer;
  } catch (err: any) {
    console.error('[PDF] Generation error:', err.message);
    try { fs.unlinkSync(scriptFile); fs.unlinkSync(dataFile); } catch {}
    const textReport = generateTextReport(data);
    return Buffer.from(textReport);
  }
}

function generateTextReport(data: ReportData): string {
  const m = data.metricas;
  let report = `BioSustain — Reporte ESG\n\n`;
  report += `Cliente: ${data.client.nombre}\n`;
  report += `Empresa: ${data.client.empresa}\n`;
  report += `Fecha: ${data.fecha}\n\n`;
  report += `Metricas de Bioconversion:\n`;
  report += `- Residuos procesados: ${m.residuosProcesadosKg.toFixed(2)} kg\n`;
  report += `- Biomasa producida: ${m.biomasaProducidaKg.toFixed(2)} kg\n`;
  report += `- Frass estimado: ${m.frassEstimadoKg.toFixed(2)} kg\n`;
  report += `- CO2e reducido: ${m.co2eReducidoKg.toFixed(2)} kg\n`;
  report += `- Metano evitado: ${m.metanoEvitadoKg.toFixed(2)} kg\n\n`;
  report += `Lotes:\n`;
  data.lotes.forEach(l => {
    report += `- ${l.id}: ${l.tipoResiduo}, ${l.pesoKg} kg, biomasa ${l.biomasaKg} kg, CO2e ${l.co2eKg} kg\n`;
  });
  report += `\nBioSustain Research Lab — Metodologias IPCC`;
  return report;
}