import { useEffect, useState } from "react";
export type ThemePref = "light" | "dark" | "system";
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(() => { try { return (localStorage.getItem("wyd-theme") as ThemePref) || "system"; } catch { return "system"; } });
  useEffect(() => {
    const el = document.documentElement;
    if (pref === "system") delete el.dataset.theme; else el.dataset.theme = pref;
    try { if (pref === "system") localStorage.removeItem("wyd-theme"); else localStorage.setItem("wyd-theme", pref); } catch { /* 무시 */ }
  }, [pref]);
  return { pref, setPref };
}
