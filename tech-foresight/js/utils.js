/* Утилиты: DOM-хелперы, drawer, тосты, форматирование, детерминированный ГПСЧ. */
(function () {
  const U = {};

  U.el = function (tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "class") e.className = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else if (k === "text") e.textContent = attrs[k];
      else if (k.startsWith("on") && typeof attrs[k] === "function") e.addEventListener(k.slice(2), attrs[k]);
      else if (k === "dataset") { for (const d in attrs[k]) e.dataset[d] = attrs[k][d]; }
      else if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    }
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null || c === false) return;
        e.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
      });
    }
    return e;
  };
  // SVG-элемент
  U.svg = function (tag, attrs, children) {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs) for (const k in attrs) {
      if (k === "text") e.textContent = attrs[k];
      else if (k.startsWith("on") && typeof attrs[k] === "function") e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    }
    if (children != null) (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c == null) return; e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  };

  U.$ = function (s, r) { return (r || document).querySelector(s); };
  U.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  U.clear = function (n) { while (n.firstChild) n.removeChild(n.firstChild); return n; };
  U.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  U.debounce = function (fn, ms) { let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; };

  U.num = function (n, d) { return Number(n).toLocaleString("ru-RU", d ? { maximumFractionDigits: d, minimumFractionDigits: d } : {}); };
  U.money = function (n) {
    if (n >= 1000) return "$" + (n / 1000).toFixed(1).replace(/\.0$/, "") + " млрд";
    return "$" + Math.round(n) + " млн";
  };

  // Детерминированный ГПСЧ по строковому ключу (стабильные «демо-данные» без Math.random)
  U.hash = function (str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  };
  U.rng = function (seedStr) {
    let s = U.hash(String(seedStr)) || 1;
    return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  };
  U.pick = function (rng, lo, hi, dec) { const v = lo + rng() * (hi - lo); return dec == null ? Math.round(v) : +v.toFixed(dec); };

  // Тосты
  U.toast = function (msg, kind) {
    let wrap = U.$(".toast-wrap");
    if (!wrap) { wrap = U.el("div", { class: "toast-wrap" }); document.body.appendChild(wrap); }
    const icon = kind === "ok" ? "✓" : kind === "err" ? "✕" : "•";
    const t = U.el("div", { class: "toast " + (kind || "") }, [U.el("span", { text: icon }), U.el("span", { text: msg })]);
    wrap.appendChild(t);
    setTimeout(function () { t.style.opacity = "0"; t.style.transition = "opacity .3s"; setTimeout(function () { t.remove(); }, 300); }, 2600);
  };

  // Drawer (боковая панель деталей)
  U.openDrawer = function (buildFn, wide) {
    let ov = U.$(".overlay"), dr = U.$(".drawer");
    if (!ov) {
      ov = U.el("div", { class: "overlay", onclick: U.closeDrawer });
      dr = U.el("div", { class: "drawer" });
      document.body.appendChild(ov); document.body.appendChild(dr);
    }
    dr.className = "drawer" + (wide ? " wide" : "");
    U.clear(dr);
    const head = U.el("div", { class: "drawer-head" });
    const body = U.el("div", { class: "drawer-body" });
    dr.appendChild(head); dr.appendChild(body);
    buildFn(body, head);
    head.appendChild(U.el("button", { class: "close", text: "×", onclick: U.closeDrawer, title: "Закрыть (Esc)", "aria-label": "Закрыть" }));
    requestAnimationFrame(function () { ov.classList.add("open"); dr.classList.add("open"); });
    document.addEventListener("keydown", U._escClose);
  };
  U._escClose = function (e) { if (e.key === "Escape") U.closeDrawer(); };
  U.closeDrawer = function () {
    const ov = U.$(".overlay"), dr = U.$(".drawer");
    if (ov) ov.classList.remove("open");
    if (dr) dr.classList.remove("open");
    document.removeEventListener("keydown", U._escClose);
  };
  U.spacer = function () { return U.el("div", { class: "spacer" }); };

  // Блок в drawer: заголовок-«капитель» + содержимое
  U.block = function (title, content) {
    const b = U.el("div", { class: "block" });
    b.appendChild(U.el("div", { class: "bh" }, [title]));
    (Array.isArray(content) ? content : [content]).forEach(function (c) { if (c) b.appendChild(c); });
    return b;
  };

  // Состояния
  U.state = function (ic, t, m) {
    return U.el("div", { class: "state" }, [
      U.el("div", { class: "ic", text: ic }),
      U.el("div", { class: "t", text: t }),
      m ? U.el("div", { class: "m", text: m }) : null,
    ]);
  };

  window.U = U;
})();
