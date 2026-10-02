import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { i18nReady } from "./lib/i18n";
import "./styles.css";

// 저장된 언어(ko 외)의 사전을 받은 뒤 그려 한국어가 잠깐 보이는 것을 막음
void i18nReady.then(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
