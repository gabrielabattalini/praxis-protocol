import PDFDocument from "pdfkit";
import type { WeeklyReport, WeeklyReportActivity } from "@/lib/weekly-report";

/**
 * Geração do PDF do Relatório Semanal (Fase 2).
 *
 * Recebe o WeeklyReport já calculado pelo motor (lib/weekly-report.ts)
 * e devolve o buffer do PDF. Pura função IO-bound (sem dependência de
 * React/DOM); roda em Node serverless. Usada pela rota de download da
 * página /relatorios e pelo dispatch semanal automático.
 *
 * Não envolve fontes externas — pdfkit usa Helvetica embutida. Sem
 * imagens. Layout simples: header, KPIs, dia a dia (tabela), módulos
 * (tabela), top atividades, ficou pra trás.
 */

const COLOR_ACCENT = "#fb923c";
const COLOR_OK = "#4ade80";
const COLOR_BAD = "#f87171";
const COLOR_TEXT = "#1f2937";
const COLOR_MUTED = "#6b7280";
const COLOR_BORDER = "#e5e7eb";

function colorForPercent(percent: number) {
  if (percent >= 80) return COLOR_OK;
  if (percent >= 50) return COLOR_ACCENT;
  return COLOR_BAD;
}

export async function generateWeeklyReportPdf(
  report: WeeklyReport,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title: `Relatório Semanal — ${report.rangeLabel}`,
      Author: "Praxis Protocol",
      Subject: "Relatório semanal de disciplina",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const ready = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  /* ── Header ───────────────────────────────────────────── */
  doc
    .fillColor(COLOR_ACCENT)
    .fontSize(10)
    .font("Helvetica-Bold")
    .text("PRAXIS PROTOCOL · RELATÓRIO SEMANAL", { characterSpacing: 1 });

  doc
    .moveDown(0.3)
    .fillColor(COLOR_TEXT)
    .fontSize(22)
    .font("Helvetica-Bold")
    .text(report.rangeLabel);

  if (report.isCurrentWeek) {
    doc
      .fillColor(COLOR_MUTED)
      .fontSize(10)
      .font("Helvetica-Oblique")
      .text("(semana em andamento)");
  }

  /* ── Resumo ───────────────────────────────────────────── */
  doc
    .moveDown(0.8)
    .fillColor(COLOR_TEXT)
    .fontSize(11)
    .font("Helvetica")
    .text(report.summary, { width: 495, align: "left" });

  /* ── KPIs (4 cards) ───────────────────────────────────── */
  doc.moveDown(1.2);
  drawKpiRow(doc, report);

  /* ── Dia a dia ────────────────────────────────────────── */
  doc.moveDown(1.5);
  sectionHeader(doc, "DIA A DIA", "Como foi cada dia da semana");
  doc.moveDown(0.6);
  drawDaysGrid(doc, report);

  /* ── Por módulo ───────────────────────────────────────── */
  doc.moveDown(1.5);
  sectionHeader(doc, "POR MÓDULO", "Aderência de cada área");
  doc.moveDown(0.6);
  if (report.modules.length === 0) {
    drawEmpty(doc, "Nenhuma atividade nesta semana.");
  } else {
    drawModulesTable(doc, report);
  }

  /* ── Atividades ──────────────────────────────────────── */
  doc.moveDown(1.5);
  sectionHeader(doc, "ATIVIDADES", "Tudo que foi executado");
  doc.moveDown(0.6);
  if (report.activities.length === 0) {
    drawEmpty(doc, "Nada agendado nesta semana.");
  } else {
    drawActivitiesTable(doc, report.activities);
  }

  /* ── Ficou pra trás / o que melhorar ────────────────── */
  doc.moveDown(1.5);
  sectionHeader(doc, "FOCO PRA PRÓXIMA SEMANA", "O que ficou pra trás");
  doc.moveDown(0.6);
  if (report.topToImprove.length === 0) {
    drawEmpty(
      doc,
      report.overall.total === 0
        ? "Nenhuma atividade caiu nesta semana."
        : "Nenhuma pendência — você fechou tudo. Excelente.",
    );
  } else {
    drawTopToImprove(doc, report.topToImprove);
  }

  doc.end();
  return ready;
}

/* ── Helpers visuais ──────────────────────────────────── */

function sectionHeader(
  doc: PDFKit.PDFDocument,
  label: string,
  subtitle: string,
) {
  doc
    .fillColor(COLOR_ACCENT)
    .fontSize(9)
    .font("Helvetica-Bold")
    .text(label, { characterSpacing: 1 });
  doc
    .moveDown(0.15)
    .fillColor(COLOR_TEXT)
    .fontSize(15)
    .font("Helvetica-Bold")
    .text(subtitle);
}

function drawEmpty(doc: PDFKit.PDFDocument, text: string) {
  doc
    .fillColor(COLOR_MUTED)
    .fontSize(10)
    .font("Helvetica-Oblique")
    .text(text);
}

function drawKpiRow(doc: PDFKit.PDFDocument, report: WeeklyReport) {
  const startX = doc.page.margins.left;
  const startY = doc.y;
  const colWidth = 122;
  const gap = 5;

  const cells: Array<{ label: string; value: string; sub: string; color: string }> = [
    {
      label: "DISCIPLINA",
      value: `${report.overall.percent}%`,
      sub: `${report.overall.completed}/${report.overall.total} atividades`,
      color: colorForPercent(report.overall.percent),
    },
    {
      label: "VS. SEMANA ANTERIOR",
      value: report.trend
        ? `${report.trend.delta > 0 ? "+" : ""}${report.trend.delta} pts`
        : "—",
      sub: report.trend
        ? `Antes: ${report.trend.previousPercent}%`
        : "Sem base anterior",
      color: report.trend == null
        ? COLOR_MUTED
        : report.trend.delta > 0
          ? COLOR_OK
          : report.trend.delta < 0
            ? COLOR_BAD
            : COLOR_TEXT,
    },
    {
      label: "XP DA SEMANA",
      value: String(report.xpEarned),
      sub: "Concluído",
      color: COLOR_ACCENT,
    },
    {
      label: "MELHOR DIA",
      value: report.bestDay ? report.bestDay.dayLabel.slice(0, 8) : "—",
      sub: report.bestDay ? `${report.bestDay.percent}%` : "Sem dados",
      color: COLOR_TEXT,
    },
  ];

  cells.forEach((cell, index) => {
    const x = startX + index * (colWidth + gap);
    doc
      .roundedRect(x, startY, colWidth, 70, 4)
      .lineWidth(1)
      .strokeColor(COLOR_BORDER)
      .stroke();
    doc
      .fillColor(COLOR_MUTED)
      .fontSize(7)
      .font("Helvetica-Bold")
      .text(cell.label, x + 10, startY + 10, {
        width: colWidth - 20,
        characterSpacing: 1,
      });
    doc
      .fillColor(cell.color)
      .fontSize(20)
      .font("Helvetica-Bold")
      .text(cell.value, x + 10, startY + 25, {
        width: colWidth - 20,
      });
    doc
      .fillColor(COLOR_MUTED)
      .fontSize(8)
      .font("Helvetica")
      .text(cell.sub, x + 10, startY + 53, {
        width: colWidth - 20,
      });
  });
  doc.y = startY + 80;
  doc.x = startX;
}

function drawDaysGrid(doc: PDFKit.PDFDocument, report: WeeklyReport) {
  const startX = doc.page.margins.left;
  const startY = doc.y;
  const labelWidth = 80;
  const countWidth = 60;
  const barWidth = 495 - labelWidth - countWidth - 16;
  const rowHeight = 18;

  report.days.forEach((day, index) => {
    const y = startY + index * rowHeight;
    doc
      .fillColor(COLOR_TEXT)
      .fontSize(10)
      .font("Helvetica")
      .text(day.dayLabel, startX, y + 4, { width: labelWidth });

    // Bar
    const barX = startX + labelWidth + 8;
    const barY = y + 6;
    const barHeight = 6;
    doc
      .roundedRect(barX, barY, barWidth, barHeight, 3)
      .fillColor("#f3f4f6")
      .fill();
    if (day.total > 0 && day.percent > 0) {
      const filled = Math.max(2, (barWidth * Math.min(100, day.percent)) / 100);
      doc
        .roundedRect(barX, barY, filled, barHeight, 3)
        .fillColor(colorForPercent(day.percent))
        .fill();
    }

    // Count
    doc
      .fillColor(COLOR_MUTED)
      .fontSize(9)
      .font("Helvetica")
      .text(
        day.total > 0 ? `${day.completed}/${day.total}` : "—",
        startX + labelWidth + 8 + barWidth + 8,
        y + 4,
        { width: countWidth, align: "right" },
      );
  });
  doc.y = startY + report.days.length * rowHeight + 4;
  doc.x = startX;
}

function drawModulesTable(doc: PDFKit.PDFDocument, report: WeeklyReport) {
  const startX = doc.page.margins.left;
  const startY = doc.y;
  const labelWidth = 130;
  const countWidth = 90;
  const barWidth = 495 - labelWidth - countWidth - 16;
  const rowHeight = 18;

  report.modules.forEach((mod, index) => {
    const y = startY + index * rowHeight;
    doc
      .fillColor(COLOR_TEXT)
      .fontSize(10)
      .font("Helvetica")
      .text(mod.module, startX, y + 4, { width: labelWidth });

    const barX = startX + labelWidth + 8;
    const barY = y + 6;
    const barHeight = 6;
    doc
      .roundedRect(barX, barY, barWidth, barHeight, 3)
      .fillColor("#f3f4f6")
      .fill();
    if (mod.percent > 0) {
      const filled = Math.max(2, (barWidth * Math.min(100, mod.percent)) / 100);
      doc
        .roundedRect(barX, barY, filled, barHeight, 3)
        .fillColor(colorForPercent(mod.percent))
        .fill();
    }
    doc
      .fillColor(colorForPercent(mod.percent))
      .fontSize(9)
      .font("Helvetica-Bold")
      .text(
        `${mod.percent}% (${mod.completed}/${mod.scheduled})`,
        startX + labelWidth + 8 + barWidth + 8,
        y + 4,
        { width: countWidth, align: "right" },
      );
  });
  doc.y = startY + report.modules.length * rowHeight + 4;
  doc.x = startX;
}

function drawActivitiesTable(
  doc: PDFKit.PDFDocument,
  activities: WeeklyReportActivity[],
) {
  const startX = doc.page.margins.left;
  const titleWidth = 280;
  const moduleWidth = 110;
  const percentWidth = 50;
  const countWidth = 50;
  const rowHeight = 16;

  // Header row
  doc
    .fillColor(COLOR_MUTED)
    .fontSize(7)
    .font("Helvetica-Bold")
    .text("ATIVIDADE", startX, doc.y, { width: titleWidth, characterSpacing: 1, continued: true })
    .text("MÓDULO", { width: moduleWidth, characterSpacing: 1, continued: true })
    .text("%", { width: percentWidth, characterSpacing: 1, align: "right", continued: true })
    .text("DIAS", { width: countWidth, characterSpacing: 1, align: "right" });

  doc.moveDown(0.3);
  const tableStartY = doc.y;

  activities.forEach((activity, index) => {
    const y = tableStartY + index * rowHeight;

    // Quebra de página: se passar do limite, página nova.
    if (y > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      doc.x = startX;
    }
    const rowY = doc.y > tableStartY + index * rowHeight ? doc.y : y;

    doc
      .fillColor(COLOR_TEXT)
      .fontSize(9)
      .font("Helvetica")
      .text(activity.title, startX, rowY + 3, {
        width: titleWidth,
        ellipsis: true,
        height: rowHeight - 4,
      });
    doc
      .fillColor(COLOR_MUTED)
      .fontSize(9)
      .font("Helvetica")
      .text(activity.module, startX + titleWidth, rowY + 3, {
        width: moduleWidth,
        ellipsis: true,
      });
    doc
      .fillColor(colorForPercent(activity.percent))
      .fontSize(9)
      .font("Helvetica-Bold")
      .text(
        `${activity.percent}%`,
        startX + titleWidth + moduleWidth,
        rowY + 3,
        { width: percentWidth, align: "right" },
      );
    doc
      .fillColor(COLOR_MUTED)
      .fontSize(9)
      .font("Helvetica")
      .text(
        `${activity.completed}/${activity.scheduled}`,
        startX + titleWidth + moduleWidth + percentWidth,
        rowY + 3,
        { width: countWidth, align: "right" },
      );
  });
  doc.y = tableStartY + activities.length * rowHeight + 4;
  doc.x = startX;
}

function drawTopToImprove(
  doc: PDFKit.PDFDocument,
  items: WeeklyReportActivity[],
) {
  const startX = doc.page.margins.left;

  items.forEach((activity, index) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 50) {
      doc.addPage();
      doc.x = startX;
    }
    const y = doc.y;
    doc
      .roundedRect(startX, y, 495, 36, 4)
      .lineWidth(1)
      .strokeColor("#fecaca")
      .fillColor("#fef2f2")
      .fillAndStroke();
    doc
      .fillColor(COLOR_BAD)
      .fontSize(18)
      .font("Helvetica-Bold")
      .text(String(index + 1), startX + 10, y + 9, { width: 20 });
    doc
      .fillColor(COLOR_TEXT)
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(activity.title, startX + 36, y + 6, { width: 380, ellipsis: true });
    doc
      .fillColor(COLOR_MUTED)
      .fontSize(9)
      .font("Helvetica")
      .text(
        `${activity.module} · perdeu ${activity.missed} de ${activity.scheduled} dias`,
        startX + 36,
        y + 20,
        { width: 380, ellipsis: true },
      );
    doc
      .fillColor(colorForPercent(activity.percent))
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(`${activity.percent}%`, startX + 420, y + 12, {
        width: 65,
        align: "right",
      });
    doc.y = y + 42;
    doc.x = startX;
  });
}
