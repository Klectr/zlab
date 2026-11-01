import "./styles.css";
import { createElement, mount } from "kiru";
import { App } from "./App";

const root = document.getElementById("root")!;
mount(createElement(App), root);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {})
  })
}
