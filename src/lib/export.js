import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { rupiah, todayLocal } from "./format";

/**
 * Export data to CSV and trigger browser download
 */
export function exportToCSV(filename, headers, rows) {
  if (!rows || !rows.length) return;
  const csvHeaders = headers.join(",");
  const csvRows = rows.map((r) =>
    headers
      .map((h) => {
        const val = r[h] ?? "";
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  const csvContent = "data:text/csv;charset=utf-8," + [csvHeaders, ...csvRows].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${filename}-${todayLocal()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export data to XLSX and trigger browser download
 */
export function exportToXLSX(filename, sheetName, data) {
  if (!data || !data.length) return;
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || "Data");
  XLSX.writeFile(workbook, `${filename}-${todayLocal()}.xlsx`);
}

/**
 * Export professional branded PDF report for PT Mahameru Insan Mandiri
 */
export function exportToPDF({ title, subtitle, headers, data, filename }) {
  const doc = new jsPDF("landscape", "pt", "a4");

  // Header banner
  doc.setFillColor(10, 37, 64); // Navy #0A2540
  doc.rect(0, 0, 842, 60, "F");

  // Gold accent bar
  doc.setFillColor(197, 160, 89); // Gold #C5A059
  doc.rect(0, 60, 842, 4, "F");

  // Company branding
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("PT MAHAMERU INSAN MANDIRI", 40, 35);

  doc.setFontSize(10);
  doc.setTextColor(197, 160, 89);
  doc.text("DISTRIBUTION MANAGEMENT SYSTEM", 802, 35, { align: "right" });

  // Report Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(10, 37, 64);
  doc.text(title || "DMS MAHAMERU — LAPORAN OPERASIONAL", 40, 90);

  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, 40, 105);
  }

  // Generation timestamp
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Dicetak pada: ${new Date().toLocaleString("id-ID")}`, 802, 105, { align: "right" });

  // Table
  const tableRows = data.map((row) =>
    headers.map((h) => {
      const val = row[h.key];
      if (typeof val === "number" && h.isMoney) return rupiah(val);
      if (typeof val === "number") return val.toLocaleString("id-ID");
      return String(val ?? "-");
    })
  );

  autoTable(doc, {
    startY: subtitle ? 120 : 105,
    head: [headers.map((h) => h.label)],
    body: tableRows,
    theme: "striped",
    headStyles: {
      fillColor: [10, 37, 64],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 40, right: 40 },
    didDrawPage: (data) => {
      // Footer page number
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Halaman ${data.pageNumber}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 20,
        { align: "center" }
      );
    },
  });

  doc.save(`${filename || "DMS_Mahameru_Report"}-${todayLocal()}.pdf`);
}
