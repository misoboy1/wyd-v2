// QR 코드 → SVG path(숫자·명령만이라 화면·인쇄 어디에 넣어도 안전). 개인 링크 카드용
import { encode } from "uqr";

export function qrPath(text: string): { size: number; d: string } {
  const { data, size } = encode(text, { ecc: "M", border: 2 });
  let d = "";
  data.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on) d += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return { size, d };
}

/** 개인 링크 주소 — 토큰은 # 뒤(서버 접속 기록에 남지 않음) */
export const personalUrl = (token: string) => `${location.origin}/me#${token}`;
