import { csvCell, todayKST } from "@wyd/shared";

/** 엑셀 붙여넣기(TSV/CSV) 파싱 — 기존 parsePaste 이식. 셀 안 줄바꿈("…" 감싼 셀)·"" 이스케이프 처리 */
export function parsePaste(text: string): string[][] {
  text = String(text || "").replace(/\r\n?/g, "\n");
  let delim = ",";
  { let q = false; for (let i = 0; i < text.length; i++) { const ch = text[i]; if (ch === '"') q = !q; else if (!q && ch === "\n") break; else if (!q && ch === "\t") { delim = "\t"; break; } } }
  const rows: string[][] = []; let row: string[] = [], cur = "", q = false, atStart = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; }
    if (ch === '"' && atStart) { q = true; atStart = false; continue; }
    if (ch === delim) { row.push(cur); cur = ""; atStart = true; continue; }
    if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; atStart = true; continue; }
    cur += ch; atStart = false;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== "")).map((r) => r.map((c) => String(c).trim()));
}

/** CSV 다운로드(엑셀 한글 깨짐 방지 BOM, 수식 주입 방지) */
export function downloadCSV(name: string, headers: string[], rows: unknown[][]) {
  const body = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}_${todayKST()}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
