import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { fmtDate } from "./templates.server";

export type PdfTicket = {
  code: string;
  type: string;
  attendee: string | null;
  event: { title: string; starts_at: string; venue: string | null; city: string };
};

const BRAND = rgb(0.145, 0.388, 0.922);
const DARK = rgb(0.043, 0.071, 0.125);
const MUTED = rgb(0.39, 0.45, 0.55);

const clean = (s: string) => s.replace(/[^\x20-\x7E]/g, "");

export async function ticketsPdf(tickets: PdfTicket[]) {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const mono = await doc.embedFont(StandardFonts.CourierBold);

  for (const t of tickets) {
    const page = doc.addPage([595, 842]);
    const { width, height } = page.getSize();
    page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: DARK });
    page.drawText("Usikose", { x: 40, y: height - 55, size: 26, font: bold, color: rgb(1, 1, 1) });
    page.drawText("360", { x: 40 + bold.widthOfTextAtSize("Usikose", 26), y: height - 55, size: 26, font: bold, color: rgb(0.22, 0.74, 0.97) });
    page.drawText("E-TICKET", { x: width - 120, y: height - 52, size: 14, font: bold, color: rgb(1, 1, 1) });

    const top = height - 140;
    page.drawRectangle({ x: 40, y: top - 520, width: width - 80, height: 520, borderColor: rgb(0.89, 0.91, 0.94), borderWidth: 1 });
    page.drawRectangle({ x: 40, y: top - 520, width: 8, height: 520, color: BRAND });

    let y = top - 40;
    page.drawText(clean(t.type).toUpperCase(), { x: 70, y, size: 12, font: bold, color: BRAND });
    y -= 30;
    const title = clean(t.event.title);
    const words = title.split(" ");
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (bold.widthOfTextAtSize(next, 22) > width - 150) {
        page.drawText(line, { x: 70, y, size: 22, font: bold, color: DARK });
        y -= 28;
        line = w;
      } else line = next;
    }
    if (line) page.drawText(line, { x: 70, y, size: 22, font: bold, color: DARK });
    y -= 34;
    page.drawText(clean(fmtDate(t.event.starts_at)), { x: 70, y, size: 12, font: reg, color: MUTED });
    y -= 18;
    page.drawText(clean(t.event.venue ? `${t.event.venue}, ${t.event.city}` : t.event.city), { x: 70, y, size: 12, font: reg, color: MUTED });
    y -= 34;
    page.drawText("ATTENDEE", { x: 70, y, size: 10, font: bold, color: MUTED });
    y -= 18;
    page.drawText(clean(t.attendee || "Guest"), { x: 70, y, size: 16, font: bold, color: DARK });

    // QR code drawn as vector squares
    const qr = QRCode.create(t.code, { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    const size = 220;
    const cell = size / n;
    const qx = (width - size) / 2;
    const qy = top - 470;
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        if (qr.modules.get(r, c))
          page.drawRectangle({ x: qx + c * cell, y: qy + (n - 1 - r) * cell, width: cell + 0.2, height: cell + 0.2, color: DARK });
    const cw = mono.widthOfTextAtSize(t.code, 20);
    page.drawText(t.code, { x: (width - cw) / 2, y: qy - 30, size: 20, font: mono, color: DARK });

    const note = "Show this QR code at the entrance. Each code can be scanned once.";
    page.drawText(note, { x: (width - reg.widthOfTextAtSize(note, 10)) / 2, y: 60, size: 10, font: reg, color: MUTED });
  }
  return doc.save();
}
