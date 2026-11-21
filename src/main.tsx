import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "harmonyos-sans-sc-webfont-splitted";
import App from "./App";
import "./styles.css";
import "./creator.css";
import "./theme-light.css";

try {
  const saved = JSON.parse(
    localStorage.getItem("studyflow.preferences.v2") || "{}",
  );
  document.documentElement.dataset.theme =
    saved.theme === "light" ? "light" : "dark";
} catch {
  document.documentElement.dataset.theme = "dark";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
