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
  // Generate PDF using Python reportlab (available in the Docker image)
  const tmpFile = path.join(os.tmpdir(), `biosustain_report_${Date.now()}.pdf`);
  const dataFile = path.join(os.tmpdir(), `biosustain_data_${Date.now()}.json`);

  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));

  const script = `
import json, sys
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.colors import HexColor, white

data = json.load(open('${dataFile}'))
styles = getSampleStyleSheet()
ts = ParagraphStyle('T', parent=styles['Title'], fontSize=16, textColor=HexColor('#2d5f2d'))
hs = ParagraphStyle('H', parent=styles['Heading2'], fontSize=12, textColor=HexColor('#2d5f2d'))
bs = ParagraphStyle('B', parent=styles['Normal'], fontSize=9, leading=12)

doc = SimpleDocTemplate('${tmpFile}', pagesize=letter, topMargin=0.7*inch, bottomMargin=0.7*inch, leftMargin=0.8*inch, rightMargin=0.8*inch)
s = []

s.append(Paragraph('BioSustain — Reporte ESG Certificado', ts))
s.append(Spacer(1, 0.15*inch))
s.append(Paragraph(f"Cliente: {data['client']['nombre']}", bs))
s.append(Paragraph(f"Empresa: {data['client']['empresa']}", bs))
s.append(Paragraph(f"Fecha: {data['fecha'][:10]}", bs))
s.append(Spacer(1, 0.2*inch))

s.append(Paragraph('Metricas de Bioconversion', hs))
m = data['metricas']
s.append(Paragraph(f"- Residuos procesados: {m['residuosProcesadosKg']:.2f} kg", bs))
s.append(Paragraph(f"- Biomasa producida: {m['biomasaProducidaKg']:.2f} kg", bs))
s.append(Paragraph(f"- Frass estimado: {m['frassEstimadoKg']:.2f} kg", bs))
s.append(Paragraph(f"- CO2e reducido: {m['co2eReducidoKg']:.2f} kg", bs))
s.append(Paragraph(f"- Metano evitado: {m['metanoEvitadoKg']:.2f} kg", bs))
s.append(Spacer(1, 0.2*inch))

s.append(Paragraph('Trazabilidad de Lotes', hs))
if data['lotes']:
    lotes_data = [['Lote', 'Cesta', 'Residuo', 'Peso (kg)', 'Sustrato', 'Biomasa (kg)', 'CO2e (kg)']]
    for l in data['lotes']:
        lotes_data.append([
            l['id'][:15], l['cesta'][:20], l['tipoResiduo'][:20],
            f"{l['pesoKg']:.1f}", l['sustrato'][:15],
            f"{l['biomasaKg']:.1f}", f"{l['co2eKg']:.1f}"
        ])
    t = Table(lotes_data, colWidths=[0.8*inch, 1*inch, 1*inch, 0.7*inch, 0.8*inch, 0.8*inch, 0.7*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), HexColor('#2d5f2d')),
        ('TEXTCOLOR', (0,0), (-1,0), white),
        ('FONTSIZE', (0,0), (-1,-1), 7),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor('#888')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [HexColor('#f5f5f5'), white]),
    ]))
    s.append(t)
else:
    s.append(Paragraph('No hay lotes registrados.', bs))

s.append(Spacer(1, 0.3*inch))
s.append(Paragraph('Certificacion', hs))
s.append(Paragraph('Este reporte fue generado automaticamente por la plataforma BioSustain. Las metricas se calculan segun metodologias IPCC para mitigacion de gases de efecto invernadero (GEI). Los datos provienen del registro de lotes organicos procesados por bioconversion con Hermetia illucens (BSF).', bs))
s.append(Spacer(1, 0.2*inch))
s.append(Paragraph('BioSustain Research Lab — Plataforma de bioconversion sostenible', bs))

doc.build(s)
print('PDF generated')
`;

  try {
    await execAsync(`python3 -c '${script.replace(/'/g, "'\\''")}'`, { timeout: 15000 });
    const buffer = fs.readFileSync(tmpFile);
    fs.unlinkSync(tmpFile);
    fs.unlinkSync(dataFile);
    return buffer;
  } catch (err: any) {
    console.error('[PDF] Generation error:', err.message);
    // Fallback: simple text report
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