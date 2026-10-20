import { PARISH, todayKST, toStr } from "@wyd/shared";
import { getLocale, tt } from "./i18n";

export interface PrintSection {
  heading?: string;
  note?: string;
  columns: string[];
  rows: (string | number | null | undefined)[][];
}
const esc = (s: unknown) =>
  toStr(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * 인쇄용 문서(A4) — 새 창 대신 숨은 iframe에 그려 바로 인쇄 대화상자.
 * 모든 값은 이스케이프(기존 innerHTML 방식의 XSS 위험 제거)
 */
export function printDocument(
  title: string,
  sections: PrintSection[],
  opts: { kpis?: [string, string | number][]; subtitle?: string } = {},
) {
  const kpi = opts.kpis?.length
    ? `<div class="kpis">${opts.kpis.map(([l, v]) => `<div class="kpi"><div class="l">${esc(l)}</div><div class="v">${esc(v)}</div></div>`).join("")}</div>`
    : "";
  const body = sections
    .map(
      (s) => `
    ${s.heading ? `<h2>${esc(s.heading)}</h2>` : ""}${s.note ? `<p class="note">${esc(s.note)}</p>` : ""}
    <table><thead><tr>${s.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
    <tbody>${s.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${s.columns.length}" class="empty">${esc(tt("shell.print.empty"))}</td></tr>`}</tbody></table>`,
    )
    .join("");
  const html = `<!doctype html><html lang="${getLocale()}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box}
    body{font-family:"Pretendard","Malgun Gothic",system-ui,sans-serif;color:#111827;font-size:11px;margin:0}
    header{border-bottom:2px solid #1b4fc4;padding-bottom:8px;margin-bottom:12px}
    h1{font-size:18px;margin:0 0 4px;color:#1b4fc4}.meta{color:#6b7280;font-size:10px}
    h2{font-size:13px;margin:16px 0 6px;padding-left:8px;border-left:3px solid #1b4fc4}
    .note{color:#6b7280;margin:0 0 6px}
    .kpis{display:flex;gap:8px;margin:0 0 12px}.kpi{flex:1;border:1px solid #e5e7eb;border-radius:6px;padding:8px 10px;background:#f8fafc}
    .kpi .l{color:#6b7280;font-size:10px}.kpi .v{font-size:16px;font-weight:700}
    table{width:100%;border-collapse:collapse;margin-bottom:6px;page-break-inside:auto}tr{page-break-inside:avoid}
    th{background:#f1f5f9;text-align:left;font-weight:600;color:#374151}
    th,td{border:1px solid #e5e7eb;padding:4px 6px;vertical-align:top;white-space:pre-wrap}.empty{color:#9ca3af;text-align:center}
  </style></head><body><header><h1>${esc(title)}</h1><div class="meta">${esc(PARISH.name)} · 2027 WYD${opts.subtitle ? " · " + esc(opts.subtitle) : ""} · ${esc(tt("shell.print.printedOn", { date: todayKST() }))}</div></header>${kpi}${body}</body></html>`;
  printHtml(html);
}

/** 완성된 문서(값은 모두 이스케이프된 상태)를 숨은 iframe에 그려 인쇄 */
function printHtml(html: string) {
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(f);
  const d = f.contentDocument!;
  d.open();
  d.write(html);
  d.close();
  setTimeout(() => {
    f.contentWindow?.focus();
    f.contentWindow?.print();
    setTimeout(() => f.remove(), 2000);
  }, 250);
}

export interface QrCard {
  name: string;
  sub?: string;
  /** qrPath() 결과 — 숫자·명령만이므로 그대로 넣음 */
  qr: { size: number; d: string };
  hint: string;
}
/** 개인 링크 QR 카드(A4 한 장에 2×4장, 잘라서 나눠 줌) */
export function printQrCards(title: string, cards: QrCard[]) {
  const body = cards
    .map(
      (c) => `<div class="card"><svg viewBox="0 0 ${c.qr.size} ${c.qr.size}" shape-rendering="crispEdges"><path d="${c.qr.d}"/></svg>
      <div class="txt"><div class="name">${esc(c.name)}</div>${c.sub ? `<div class="sub">${esc(c.sub)}</div>` : ""}<p>${esc(c.hint)}</p>
      <div class="org">${esc(PARISH.name)} · WYD 2027</div></div></div>`,
    )
    .join("");
  printHtml(`<!doctype html><html lang="${getLocale()}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    @page{size:A4;margin:10mm}*{box-sizing:border-box}
    body{font-family:"Pretendard","Malgun Gothic",system-ui,sans-serif;color:#111827;margin:0;display:grid;grid-template-columns:1fr 1fr;gap:0}
    .card{display:flex;gap:10px;align-items:center;height:68mm;padding:6mm;border:1px dashed #9ca3af;page-break-inside:avoid}
    svg{width:40mm;height:40mm;flex:none}path{fill:#111827}
    .name{font-size:15px;font-weight:700}.sub{font-size:11px;color:#6b7280;margin-top:2px}
    p{font-size:10.5px;line-height:1.45;margin:6px 0}.org{font-size:9.5px;color:#1b4fc4;font-weight:600}
  </style></head><body>${body}</body></html>`);
}
