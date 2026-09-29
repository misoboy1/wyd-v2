// D-DAY 준비 단계 공용 계산(준비 화면·대시보드)
import { WYD_OPEN, todayKST, type PrepStep } from "@wyd/shared";

const WYD_YEAR = WYD_OPEN.slice(0, 4);
/**
 * 시기 문구 → 시작일(YYYY-MM-DD). "(2026.08)"·"(2026.10~11)" → 그 달 1일,
 * "교구대회 7.29(목)"·"본대회 8.3~8.8" → 대회 연도의 그 날. "상시" 등 날짜 없음 → null
 */
export function phaseStart(phase: string): string | null {
  const ym = phase.match(/(20\d{2})\.(\d{1,2})/);
  if (ym) return `${ym[1]}-${ym[2].padStart(2, "0")}-01`;
  const mdm = phase.match(/(\d{1,2})\.(\d{1,2})/);
  if (mdm) return `${WYD_YEAR}-${mdm[1].padStart(2, "0")}-${mdm[2].padStart(2, "0")}`;
  return null;
}
export const sortPrep = (list: PrepStep[]) => list.slice().sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id);
/** 오늘 해당하는 단계 = 시작일이 오늘 이전인 단계 중 마지막(목록 순서 기준) */
export function currentPhaseId(list: PrepStep[], today = todayKST()): number | null {
  let cur: number | null = null;
  for (const p of list) { const s = phaseStart(p.phase); if (s && s <= today) cur = p.id; }
  return cur;
}
