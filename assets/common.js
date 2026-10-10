/* Planning Algorithms 学习站 —— 共享脚本：主题切换、目录高亮、公式渲染、小工具 */
(function () {
  "use strict";

  // ---------- 安全的 localStorage ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 忽略 */ } },
  };

  // ---------- 主题 ----------
  const saved = store.get("pa-theme", null);
  if (saved) document.documentElement.setAttribute("data-theme", saved);

  function currentTheme() {
    const t = document.documentElement.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  const themeListeners = [];
  function onThemeChange(fn) { themeListeners.push(fn); }
  function fireTheme() { themeListeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", fireTheme);
  }

  function cssVar(name, el) {
    return getComputedStyle(el || document.documentElement).getPropertyValue(name).trim();
  }

  // ---------- DOM 小工具 ----------
  function h(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return e;
  }

  const SVGNS = "http://www.w3.org/2000/svg";
  function s(tag, attrs, ...children) {
    const e = document.createElementNS(SVGNS, tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return e;
  }

  // 箭头 marker（每个 svg 自己一份，颜色用 currentColor 继承）
  function arrowDefs(svg, ids) {
    const defs = s("defs");
    for (const [id, color] of Object.entries(ids)) {
      defs.append(s("marker", { id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" },
        s("path", { d: "M0,0 L10,5 L0,10 z", fill: color })));
    }
    svg.append(defs);
  }

  const INF = Infinity;
  const fmt = (v) => (v === INF ? "∞" : (Number.isInteger(v) ? String(v) : v.toFixed(2)));

  // 让 canvas 跟随容器宽度并适配高分屏
  function fitCanvas(canvas, cssW, cssH) {
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  // ---------- 目录高亮 ----------
  function initToc() {
    const links = Array.from(document.querySelectorAll(".toc a[href^='#']"));
    if (!links.length || !("IntersectionObserver" in window)) return;
    const map = new Map();
    links.forEach((a) => {
      const t = document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1)));
      if (t) map.set(t, a);
    });
    let active = null;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          const a = map.get(en.target);
          if (a && a !== active) {
            if (active) active.classList.remove("active");
            a.classList.add("active");
            active = a;
          }
        }
      });
    }, { rootMargin: "-70px 0px -70% 0px" });
    map.forEach((_, t) => io.observe(t));
  }

  // ---------- 公式 ----------
  function renderMath(root) {
    if (window.renderMathInElement) {
      window.renderMathInElement(root || document.body, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\(", right: "\\)", display: false },
        ],
        throwOnError: false,
      });
    }
  }

  // ---------- 主题按钮 ----------
  function initThemeButton() {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    const label = () => { btn.textContent = currentTheme() === "dark" ? "☀︎" : "☾"; btn.title = currentTheme() === "dark" ? "切换到浅色" : "切换到深色"; };
    label();
    btn.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      store.set("pa-theme", next);
      label();
      fireTheme();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initThemeButton();
    initToc();
  });
  window.addEventListener("load", () => renderMath());

  window.PA = { store, h, s, arrowDefs, cssVar, onThemeChange, currentTheme, INF, fmt, fitCanvas, renderMath };
})();
