import { jsPDF } from "jspdf";
import type { InspectionRecord } from "./db";

function detectImageFormat(dataUrl?: string): "PNG" | "JPEG" | null {
  if (!dataUrl) return null;
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (
    dataUrl.startsWith("data:image/jpeg") ||
    dataUrl.startsWith("data:image/jpg")
  ) {
    return "JPEG";
  }
  return "JPEG";
}

export function generateInspectionPdf(record: InspectionRecord): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 48;

  const ensureSpace = (neededHeight: number) => {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (y + neededHeight > pageHeight - 40) {
      doc.addPage();
      y = 48;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Field Inspection Signed Report", margin, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
  y += 22;

  doc.setTextColor(20);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Site: ${record.siteName}`, margin, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.text(
    `Category: ${record.siteType}   |   Due Date: ${record.dueDate}`,
    margin,
    y
  );
  y += 16;
  doc.text(
    `Inspector: ${record.inspectorName}   |   Sync Status: ${record.syncStatus.toUpperCase()}`,
    margin,
    y
  );
  y += 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Checklist Findings", margin, y);
  y += 18;

  record.items.forEach((item, index) => {
    ensureSpace(95);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const statusLabel = item.status.toUpperCase();
    const lines = doc.splitTextToSize(
      `${index + 1}. [${statusLabel}] ${item.label}`,
      pageWidth - margin * 2
    );
    doc.text(lines, margin, y);
    y += lines.length * 14 + 2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    if (item.note) {
      const noteLines = doc.splitTextToSize(
        `Note: ${item.note}`,
        pageWidth - margin * 2 - 12
      );
      doc.text(noteLines, margin + 12, y);
      y += noteLines.length * 13 + 2;
    }

    if (item.gps) {
      doc.text(
        `GPS: ${item.gps.lat.toFixed(5)}, ${item.gps.lng.toFixed(5)} (at ${new Date(
          item.gps.capturedAt
        ).toLocaleTimeString()})`,
        margin + 12,
        y
      );
      y += 14;
    }

    const imgFmt = detectImageFormat(item.photoDataUrl);
    if (item.photoDataUrl && imgFmt) {
      ensureSpace(90);
      try {
        doc.addImage(item.photoDataUrl, imgFmt, margin + 12, y, 110, 75);
        y += 84;
      } catch {
        doc.text(
          "[Photo attached — unsupported preview format]",
          margin + 12,
          y
        );
        y += 14;
      }
    }

    y += 8;
  });

  ensureSpace(120);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Inspector Sign-Off", margin, y);
  y += 14;

  const sigFmt = detectImageFormat(record.signatureDataUrl);
  if (record.signatureDataUrl && sigFmt) {
    try {
      doc.addImage(record.signatureDataUrl, sigFmt, margin, y, 180, 65);
      y += 72;
    } catch {
      doc.setFont("helvetica", "normal");
      doc.text("Signed electronically on device.", margin, y);
      y += 16;
    }
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Signature pending.", margin, y);
    y += 16;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Signed by: ${record.inspectorName}${
      record.signedAt ? ` on ${new Date(record.signedAt).toLocaleString()}` : ""
    }`,
    margin,
    y
  );

  const safeName = record.siteName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  doc.save(`${safeName}-inspection-report.pdf`);
}