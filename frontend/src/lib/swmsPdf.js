import jsPDF from "jspdf";

const drawHeader = (doc, meta) => {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Purple accent bar
  doc.setFillColor(107, 33, 168);
  doc.rect(0, 0, pageWidth, 8, "F");

  // Logo circle
  doc.setFillColor(107, 33, 168);
  doc.circle(20, 26, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("1K5°", 20, 27.5, { align: "center" });

  // Title
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Safe Work Method Statement", 32, 24);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("SolarSafe pro · Confidential", 32, 30);

  // Meta box (top-right)
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const rightX = pageWidth - 15;
  doc.text(`Ref: ${meta.ref}`, rightX, 20, { align: "right" });
  doc.text(`Issued: ${meta.issued}`, rightX, 25, { align: "right" });
  doc.text(`Status: DRAFT`, rightX, 30, { align: "right" });

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(15, 38, pageWidth - 15, 38);
};

const drawInfoBlock = (doc, y, meta) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(246, 248, 251);
  doc.roundedRect(15, y, pageWidth - 30, 22, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("SITE", 20, y + 7);
  doc.text("JOB TYPE", 90, y + 7);
  doc.text("PREPARED BY", 155, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(doc.splitTextToSize(meta.site, 65), 20, y + 14);
  doc.text(doc.splitTextToSize(meta.jobType, 60), 90, y + 14);
  doc.text(meta.author, 155, y + 14);

  return y + 30;
};

const drawSection = (doc, title, items, y, color, symbol) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - 40;

  // Section header
  doc.setFillColor(...color);
  doc.roundedRect(15, y, pageWidth - 30, 7, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(title, 19, y + 4.8);

  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);

  items.forEach((item) => {
    if (y > 265) {
      doc.addPage();
      y = 25;
    }
    doc.setTextColor(...color);
    doc.text(symbol, 20, y);
    doc.setTextColor(30, 41, 59);
    const wrapped = doc.splitTextToSize(item, maxWidth - 6);
    doc.text(wrapped, 26, y);
    y += wrapped.length * 5 + 2;
  });

  return y + 4;
};

const drawSignatures = (doc, y, signatures) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  if (y > 240) {
    doc.addPage();
    y = 30;
  }

  doc.setFillColor(246, 248, 251);
  doc.roundedRect(15, y, pageWidth - 30, 46, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("Sign-off", 20, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    "By signing below, all crew members confirm they have read and understood this SWMS and agree to work in accordance with its control measures.",
    20,
    y + 14,
    { maxWidth: pageWidth - 40 }
  );

  const col1x = 20;
  const col2x = pageWidth / 2 + 5;
  const sigY = y + 22;
  const lineY = y + 38;

  // Embed signature images if provided
  if (signatures?.supervisor) {
    try { doc.addImage(signatures.supervisor, "PNG", col1x, sigY, 60, 14); } catch (_) {}
  }
  if (signatures?.crew) {
    try { doc.addImage(signatures.crew, "PNG", col2x, sigY, 60, 14); } catch (_) {}
  }

  doc.setDrawColor(148, 163, 184);
  doc.line(col1x, lineY, col1x + 70, lineY);
  doc.line(col2x, lineY, col2x + 70, lineY);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Site Supervisor${signatures?.supervisorName ? " · " + signatures.supervisorName : ""}`, col1x, lineY + 4);
  doc.text(`Crew Member${signatures?.crewName ? " · " + signatures.crewName : ""}`, col2x, lineY + 4);

  if (signatures?.supervisor || signatures?.crew) {
    doc.setFontSize(7);
    doc.setTextColor(16, 185, 129);
    doc.text(`Signed digitally · ${new Date().toLocaleString()}`, col1x, lineY + 9);
  }
};

const drawFooter = (doc) => {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      "SolarSafe pro · Auto-generated with AI · Review before use",
      15,
      pageHeight - 8
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 15, pageHeight - 8, { align: "right" });
  }
};

export const exportSWMSPdf = ({ site, jobType, notes, aiResult, author = "M. Weber", signatures = null }) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ref = `SWMS-${Date.now().toString().slice(-6)}`;
  const issued = new Date().toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });

  drawHeader(doc, { ref, issued });

  let y = 46;

  y = drawInfoBlock(doc, y, { site, jobType, author });

  // Summary block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("Overview", 15, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  const summary = doc.splitTextToSize(aiResult.summary || "—", doc.internal.pageSize.getWidth() - 30);
  doc.text(summary, 15, y);
  y += summary.length * 5 + 4;

  if (notes && notes.trim()) {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    const noteLines = doc.splitTextToSize(`Site-specific notes: ${notes}`, doc.internal.pageSize.getWidth() - 30);
    doc.text(noteLines, 15, y);
    y += noteLines.length * 4.5 + 4;
  }

  y = drawSection(doc, "IDENTIFIED HAZARDS", aiResult.hazards || [], y + 2, [225, 29, 72], "!");
  y = drawSection(doc, "CONTROL MEASURES", aiResult.controls || [], y, [5, 150, 105], "+");
  y = drawSection(doc, "REQUIRED PPE", aiResult.ppe || [], y, [217, 119, 6], "•");

  drawSignatures(doc, y + 4, signatures);
  drawFooter(doc);

  doc.save(`${ref}_${site.replace(/[^a-z0-9]/gi, "_").slice(0, 20)}.pdf`);
  return ref;
};
