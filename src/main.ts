import "./styles.css";
import { createElement, mount } from "kiru";
import { App } from "./App";

const root = document.getElementById("root")!;
mount(createElement(App), root);
