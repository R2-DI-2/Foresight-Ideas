/* Библиотека визуализаций (SVG). Все компоненты темонезависимы (цвета через токены
   или явные значения), интерактивны (tooltip) и отрисовываются на демо-данных.
   Каждый метод возвращает DOM-узел <svg> или контейнер. */
(function () {
  const S = window.U.svg, EL = window.U.el;
  const NS = "http://www.w3.org/2000/svg";

  // ---------- общий tooltip ----------
  const Tip = {
    node: null,
    ensure: function () {
      if (!this.node) { this.node = EL("div", { class: "viz-tip" }); document.body.appendChild(this.node); }
      return this.node;
    },
    show: function (evt, title, rows) {
      const n = this.ensure();
      let h = "";
      if (title) h += '<div class="tt">' + window.U.esc(title) + "</div>";
      (rows || []).forEach(function (r) {
        if (typeof r === "string") h += '<div class="tr">' + window.U.esc(r) + "</div>";
        else h += '<div class="tr"><span>' + window.U.esc(r[0]) + '</span><b>' + window.U.esc(r[1]) + "</b></div>";
      });
      n.innerHTML = h;
      n.classList.add("show");
      this.move(evt);
    },
    move: function (evt) {
      const n = this.node; if (!n) return;
      let x = evt.clientX + 14, y = evt.clientY + 14;
      const w = n.offsetWidth, hh = n.offsetHeight;
      if (x + w > window.innerWidth - 8) x = evt.clientX - w - 14;
      if (y + hh > window.innerHeight - 8) y = evt.clientY - hh - 14;
      n.style.left = x + "px"; n.style.top = y + "px";
    },
    hide: function () { if (this.node) this.node.classList.remove("show"); },
  };
  // навесить tooltip на узел
  function tipify(node, title, rows) {
    node.classList.add("v-interactive");
    node.addEventListener("mousemove", function (e) { Tip.show(e, title, rows); });
    node.addEventListener("mouseleave", function () { Tip.hide(); });
    return node;
  }

  // ---------- утилиты ----------
  function root(w, h) {
    return S("svg", { viewBox: "0 0 " + w + " " + h, class: "viz-svg", preserveAspectRatio: "xMidYMid meet" });
  }
  function txt(x, y, s, cls, extra) {
    const t = S("text", Object.assign({ x: x, y: y, class: cls || "ax-txt" }, extra || {})); t.textContent = s; return t;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hex2rgb(h) { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function mix(c1, c2, t) {
    const a = hex2rgb(c1), b = hex2rgb(c2);
    return "rgb(" + Math.round(lerp(a[0], b[0], t)) + "," + Math.round(lerp(a[1], b[1], t)) + "," + Math.round(lerp(a[2], b[2], t)) + ")";
  }
  function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10; return m * p; }
  function poly(pts) { return pts.map(function (p) { return p[0] + "," + p[1]; }).join(" "); }
  function curveH(x1, y1, x2, y2) { const mx = (x1 + x2) / 2; return "M" + x1 + "," + y1 + " C" + mx + "," + y1 + " " + mx + "," + y2 + " " + x2 + "," + y2; }

  const VZ = { Tip: Tip };

  /* =========================================================================
     ВОРОНКА / КОНВЕЙЕР СЛОЁВ  (Обзор S1→S6)
     opts: stages:[{id,label,value,color,sub}], flows (bool)
     ========================================================================= */
  VZ.funnel = function (opts) {
    const stages = opts.stages, n = stages.length;
    const W = 820, H = 300, padL = 12, padR = 12, top = 30, bot = 74;
    const svg = root(W, H);
    const bandW = (W - padL - padR) / n;
    const maxV = Math.max.apply(null, stages.map(function (s) { return s.value; }));
    const maxH = H - top - bot;
    stages.forEach(function (st, i) {
      const cx = padL + bandW * i + bandW / 2;
      const h = Math.max(26, (st.value / maxV) * maxH);
      const y = top + (maxH - h);
      const bw = bandW - 16;
      // поток к следующему слою
      if (i < n - 1) {
        const next = stages[i + 1];
        const h2 = Math.max(26, (next.value / maxV) * maxH), y2 = top + (maxH - h2);
        const x1 = cx + bw / 2, x2 = padL + bandW * (i + 1) + bandW / 2 - bw / 2;
        const flowH = Math.min(h, h2) * 0.62;
        const fy1 = y + h / 2, fy2 = y2 + h2 / 2;
        const grad = mkGrad(svg, "fl" + i, st.color, next.color);
        const path = S("path", {
          d: "M" + x1 + "," + (fy1 - flowH / 2) +
             " C" + (x1 + x2) / 2 + "," + (fy1 - flowH / 2) + " " + (x1 + x2) / 2 + "," + (fy2 - flowH / 2) + " " + x2 + "," + (fy2 - flowH / 2) +
             " L" + x2 + "," + (fy2 + flowH / 2) +
             " C" + (x1 + x2) / 2 + "," + (fy2 + flowH / 2) + " " + (x1 + x2) / 2 + "," + (fy1 + flowH / 2) + " " + x1 + "," + (fy1 + flowH / 2) + " Z",
          fill: "url(#" + grad + ")", opacity: .28
        });
        svg.appendChild(path);
      }
      // столбик слоя
      const rect = S("rect", { x: cx - bw / 2, y: y, width: bw, height: h, rx: 10, fill: st.color, opacity: .92 });
      tipify(rect, st.label, [["Технологий на слое", st.value], st.sub || ""].filter(Boolean));
      if (opts.onPick) { rect.style.cursor = "pointer"; rect.addEventListener("click", function () { opts.onPick(st.id); }); }
      svg.appendChild(rect);
      // значение
      svg.appendChild(txt(cx, y - 9, String(st.value), "ax-txt", { "font-size": 20, "font-family": "var(--font-mono)", "font-weight": 700, "text-anchor": "middle", fill: "var(--text)" }));
      // подпись слоя (номер + короткое имя)
      svg.appendChild(txt(cx, H - bot + 26, st.tick || st.id, "ax-txt", { "text-anchor": "middle", "font-size": 13, "font-weight": 700, fill: st.color, "font-family": "var(--font-mono)" }));
      wrapText(svg, st.label, cx, H - bot + 42, bandW - 6, 11, "var(--text-3)");
    });
    return svg;
  };

  function mkGrad(svg, id, c1, c2, vertical) {
    let defs = svg.querySelector("defs"); if (!defs) { defs = S("defs"); svg.appendChild(defs); }
    const g = S("linearGradient", { id: id, x1: 0, y1: 0, x2: vertical ? 0 : 1, y2: vertical ? 1 : 0 });
    g.appendChild(S("stop", { offset: "0%", "stop-color": c1 }));
    g.appendChild(S("stop", { offset: "100%", "stop-color": c2 }));
    defs.appendChild(g); return id;
  }
  function wrapText(svg, str, cx, y, maxW, size, fill) {
    const words = String(str).split(" "); let line = "", lines = [];
    const cpl = Math.max(6, Math.floor(maxW / (size * 0.56)));
    words.forEach(function (w) { if ((line + " " + w).trim().length > cpl) { lines.push(line.trim()); line = w; } else line += " " + w; });
    if (line.trim()) lines.push(line.trim());
    lines.slice(0, 2).forEach(function (l, i) {
      svg.appendChild(txt(cx, y + i * (size + 2), l, "ax-txt", { "text-anchor": "middle", "font-size": size, fill: fill || "var(--text-3)" }));
    });
  }

  /* =========================================================================
     SANKEY  (потоки между колонками)
     opts: nodes:[{id,label,col,color}], links:[{source,target,value}]
     ========================================================================= */
  VZ.sankey = function (opts) {
    const W = 900, pad = 20, labelPad = 118, colW = 18;
    const fmt = opts.nodeFmt || function (v) { return "(" + v + ")"; };
    const cols = {}; opts.nodes.forEach(function (nd) { (cols[nd.col] = cols[nd.col] || []).push(nd); });
    const nCols = Math.max.apply(null, opts.nodes.map(function (n) { return n.col; })) + 1;
    const byId = {}; opts.nodes.forEach(function (n) { byId[n.id] = n; });
    // пропускная способность узла
    opts.nodes.forEach(function (n) { n._in = 0; n._out = 0; });
    opts.links.forEach(function (l) { byId[l.source]._out += l.value; byId[l.target]._in += l.value; });
    opts.nodes.forEach(function (n) { n._v = Math.max(n._in, n._out, 1); });
    const maxCol = Math.max.apply(null, Object.keys(cols).map(function (c) { return cols[c].length; }));
    const nodeTop = 34, nodeBot = 30, gapV = 18;
    const H = Math.max(340, maxCol * 66 + nodeTop + nodeBot);
    const svg = root(W, H);
    const totalPerCol = {};
    Object.keys(cols).forEach(function (c) { totalPerCol[c] = cols[c].reduce(function (a, n) { return a + n._v; }, 0); });
    const maxTotal = Math.max.apply(null, Object.values(totalPerCol));
    // масштаб учитывает вертикальные зазоры самой высокой колонки
    const avail = H - nodeTop - nodeBot - gapV * (maxCol - 1);
    const scale = avail / maxTotal;
    const colX = function (c) { return labelPad + (W - labelPad * 2 - colW) * (c / (nCols - 1)); };
    // раскладка узлов по вертикали (центрируем каждую колонку)
    Object.keys(cols).forEach(function (c) {
      cols[c].sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      const colH = cols[c].reduce(function (a, n) { return a + Math.max(12, n._v * scale); }, 0) + gapV * (cols[c].length - 1);
      let y = nodeTop + Math.max(0, (H - nodeTop - nodeBot - colH) / 2);
      cols[c].forEach(function (n) {
        n._h = Math.max(12, n._v * scale); n._x = colX(+c); n._y = y; n._oy = y; n._iy = y; y += n._h + gapV;
      });
    });
    // рёбра
    opts.links.forEach(function (l) {
      const a = byId[l.source], b = byId[l.target];
      const th = Math.max(1.4, l.value * scale);
      const sy = a._oy + th / 2, ty = b._iy + th / 2;
      a._oy += th; b._iy += th;
      const gid = mkGrad(svg, "sk" + l.source + l.target, a.color, b.color);
      const p = S("path", {
        d: curveH(a._x + colW, sy, b._x, ty), fill: "none", stroke: "url(#" + gid + ")",
        "stroke-width": th, opacity: .34, "stroke-linecap": "butt"
      });
      tipify(p, a.label + " → " + b.label, [["Поток", l.value + (opts.unit || "")]]);
      svg.appendChild(p);
    });
    // узлы
    opts.nodes.forEach(function (n) {
      const r = S("rect", { x: n._x, y: n._y, width: colW, height: n._h, rx: 5, fill: n.color });
      tipify(r, n.label, [[opts.nodeMetric || "Объём", (opts.nodeTip ? opts.nodeTip(n._v) : n._v + (opts.unit || ""))]].concat(opts.onNode ? ["клик — список технологий"] : []));
      if (opts.onNode) { r.style.cursor = "pointer"; r.addEventListener("click", function () { opts.onNode(n); }); }
      svg.appendChild(r);
      const cy = n._y + n._h / 2, val = fmt(n._v);
      if (n.col === 0 || n.col === nCols - 1) {
        // боковые колонки: имя и значение в две строки, чтобы не выходить за край
        const lx = n.col === 0 ? n._x - 8 : n._x + colW + 8, anc = n.col === 0 ? "end" : "start";
        svg.appendChild(txt(lx, cy - 2, n.label, "node-lbl", { "text-anchor": anc, "font-size": 11 }));
        svg.appendChild(txt(lx, cy + 12, val, "ax-txt", { "text-anchor": anc, "font-size": 10, fill: "var(--text-3)", "font-family": "var(--font-mono)" }));
      } else {
        svg.appendChild(txt(n._x + colW / 2, n._y - 6, n.label + " " + val, "node-lbl", { "text-anchor": "middle", "font-size": 10.5 }));
      }
    });
    return svg;
  };

  /* =========================================================================
     ГРАФ / СЕТЬ  (force layout, синхронный)
     opts: nodes:[{id,label,color,r,val}], links:[{source,target,weight}], onPick
     ========================================================================= */
  VZ.graph = function (opts) {
    const W = 820, H = opts.height || 460;
    const nodes = opts.nodes.map(function (n) { return Object.assign({}, n); });
    const idx = {}; nodes.forEach(function (n, i) { idx[n.id] = i; });
    const links = opts.links.filter(function (l) { return idx[l.source] != null && idx[l.target] != null; })
      .map(function (l) { return { s: idx[l.source], t: idx[l.target], w: l.weight || 1 }; });
    const rng = window.U.rng(opts.seed || "g");
    nodes.forEach(function (n, i) { n.x = W / 2 + Math.cos(i * 2.4) * (120 + rng() * 160); n.y = H / 2 + Math.sin(i * 2.4) * (90 + rng() * 120); n.vx = 0; n.vy = 0; });
    // симуляция
    const K = 210, iters = 260;
    for (let it = 0; it < iters; it++) {
      const alpha = 1 - it / iters;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          let dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y; let d2 = dx * dx + dy * dy || 1;
          const f = (K * K) / d2 * 0.5;
          const d = Math.sqrt(d2); dx /= d; dy /= d;
          nodes[i].vx += dx * f; nodes[i].vy += dy * f; nodes[j].vx -= dx * f; nodes[j].vy -= dy * f;
        }
      }
      links.forEach(function (l) {
        const a = nodes[l.s], b = nodes[l.t]; let dx = b.x - a.x, dy = b.y - a.y; const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const desired = 118 - l.w * 28; const f = (d - desired) * 0.06 * (0.4 + l.w);
        dx /= d; dy /= d; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
      });
      nodes.forEach(function (n) {
        n.vx += (W / 2 - n.x) * 0.012; n.vy += (H / 2 - n.y) * 0.012;
        n.x += Math.max(-24, Math.min(24, n.vx * alpha)); n.y += Math.max(-24, Math.min(24, n.vy * alpha));
        n.vx *= 0.82; n.vy *= 0.82;
        const m = 34; n.x = Math.max(m, Math.min(W - m, n.x)); n.y = Math.max(m, Math.min(H - m, n.y));
      });
    }
    const svg = root(W, H);
    links.forEach(function (l) {
      const a = nodes[l.s], b = nodes[l.t];
      const p = S("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: opts.linkColor || "var(--border-strong)", "stroke-width": 0.8 + l.w * 2.4, opacity: .3 + l.w * 0.35 });
      if (l.w != null && opts.showWeights) tipify(p, a.label + " ↔ " + b.label, [["Сила", l.w]]);
      svg.appendChild(p);
    });
    nodes.forEach(function (n) {
      const g = S("g", { class: "v-interactive" });
      const r = n.r || 8 + (n.val || 0) * 2;
      g.appendChild(S("circle", { cx: n.x, cy: n.y, r: r, fill: n.color, stroke: "var(--bg-1)", "stroke-width": 2 }));
      if (n.ring) g.appendChild(S("circle", { cx: n.x, cy: n.y, r: r + 3.5, fill: "none", stroke: n.color, "stroke-width": 1.4, opacity: .5 }));
      const lbl = txt(n.x, n.y + r + 12, n.label, "node-lbl", { "text-anchor": "middle", "font-size": 10.5 });
      g.appendChild(lbl);
      tipify(g, n.label, n.tip || []);
      if (opts.onPick) { g.style.cursor = "pointer"; g.addEventListener("click", function () { opts.onPick(n.id); }); }
      svg.appendChild(g);
    });
    return svg;
  };

  /* =========================================================================
     ТЕПЛОВАЯ КАРТА
     opts: rows:[label], cols:[label], values: [[..]], c1,c2, unit, fmt
     ========================================================================= */
  VZ.heatmap = function (opts) {
    const rows = opts.rows, cols = opts.cols;
    const cell = 34, padL = opts.padL || 150, padT = 64, gap = 3;
    const W = Math.max(560, padL + cols.length * (cell + gap) + 20);
    const H = padT + rows.length * (cell + gap) + 20;
    const svg = root(W, H);
    let max = 0, min = Infinity;
    opts.values.forEach(function (r) { r.forEach(function (v) { if (v != null) { max = Math.max(max, v); min = Math.min(min, v); } }); });
    if (min === Infinity) min = 0;
    const c1 = opts.c1 || "#16203c", c2 = opts.c2 || "#6ea8ff";
    cols.forEach(function (c, j) {
      const x = padL + j * (cell + gap) + cell / 2;
      const t = txt(x, padT - 12, c, "ax-txt", { "text-anchor": "start", "font-size": 10.5, transform: "rotate(-38 " + x + " " + (padT - 12) + ")" });
      svg.appendChild(t);
    });
    rows.forEach(function (rw, i) {
      svg.appendChild(txt(padL - 10, padT + i * (cell + gap) + cell / 2 + 4, rw, "ax-txt", { "text-anchor": "end", "font-size": 11, fill: "var(--text-2)" }));
      cols.forEach(function (c, j) {
        const v = opts.values[i][j];
        const t = max > min ? (v - min) / (max - min) : 0;
        const x = padL + j * (cell + gap), y = padT + i * (cell + gap);
        const rect = S("rect", { x: x, y: y, width: cell, height: cell, rx: 6, fill: v == null ? "var(--bg-2)" : mix(c1, c2, 0.12 + t * 0.88), opacity: v == null ? .4 : 1 });
        if (v != null) {
          tipify(rect, rw + " × " + c, [[opts.metric || "Значение", (opts.fmt ? opts.fmt(v) : v) + (opts.unit || "")]].concat(opts.onCell && v ? ["клик — список технологий"] : []));
          if (opts.onCell && v) { const ii = i, jj = j; rect.style.cursor = "pointer"; rect.addEventListener("click", function () { opts.onCell(ii, jj, v); }); }
          if (opts.showVals && cell >= 30) svg.appendChild(txt(x + cell / 2, y + cell / 2 + 4, opts.fmt ? opts.fmt(v) : v, "ax-txt", { "text-anchor": "middle", "font-size": 10, fill: t > 0.55 ? "#05101f" : "var(--text-2)" }));
        }
        svg.appendChild(rect);
      });
    });
    return svg;
  };

  /* =========================================================================
     ПУЗЫРЬКОВАЯ / SCATTER / QUADRANT
     opts: points:[{x,y,r,label,color,tip}], xLabel,yLabel, xMax,yMax, quadrant, qLabels
     ========================================================================= */
  VZ.bubble = function (opts) {
    const W = 780, H = 460, padL = 58, padB = 52, padT = 24, padR = 26;
    const svg = root(W, H);
    const x0 = padL, x1 = W - padR, y0 = H - padB, y1 = padT;
    const xMax = opts.xMax || niceMax(Math.max.apply(null, opts.points.map(function (p) { return p.x; })));
    const yMax = opts.yMax || niceMax(Math.max.apply(null, opts.points.map(function (p) { return p.y; })));
    const xMin = opts.xMin || 0, yMin = opts.yMin || 0;
    const sx = function (v) { return x0 + (v - xMin) / (xMax - xMin) * (x1 - x0); };
    const sy = function (v) { return y0 - (v - yMin) / (yMax - yMin) * (y0 - y1); };
    // сетка
    for (let i = 0; i <= 4; i++) {
      const gy = lerp(y0, y1, i / 4), gx = lerp(x0, x1, i / 4);
      svg.appendChild(S("line", { x1: x0, y1: gy, x2: x1, y2: gy, class: "ax-line" }));
      svg.appendChild(txt(x0 - 8, gy + 3, Math.round(lerp(yMin, yMax, i / 4)), "ax-txt", { "text-anchor": "end" }));
      svg.appendChild(txt(gx, y0 + 16, Math.round(lerp(xMin, xMax, i / 4)), "ax-txt", { "text-anchor": "middle" }));
    }
    // квадранты
    if (opts.quadrant) {
      const mx = sx((xMin + xMax) / 2), my = sy((yMin + yMax) / 2);
      svg.appendChild(S("line", { x1: mx, y1: y1, x2: mx, y2: y0, class: "ax-line strong", "stroke-dasharray": "4 4" }));
      svg.appendChild(S("line", { x1: x0, y1: my, x2: x1, y2: my, class: "ax-line strong", "stroke-dasharray": "4 4" }));
      (opts.qLabels || []).forEach(function (q) {
        svg.appendChild(txt(q.x === 0 ? x0 + 8 : x1 - 8, q.y === 0 ? y1 + 16 : y0 - 8, q.t, "ax-txt",
          { "text-anchor": q.x === 0 ? "start" : "end", "font-size": 10.5, fill: "var(--text-3)", "font-style": "italic" }));
      });
    }
    // оси-подписи
    svg.appendChild(txt((x0 + x1) / 2, H - 8, opts.xLabel, "ax-title", { "text-anchor": "middle" }));
    svg.appendChild(txt(14, (y0 + y1) / 2, opts.yLabel, "ax-title", { "text-anchor": "middle", transform: "rotate(-90 14 " + (y0 + y1) / 2 + ")" }));
    // точки
    opts.points.forEach(function (p) {
      const g = S("g", { class: "v-interactive" });
      g.appendChild(S("circle", { cx: sx(p.x), cy: sy(p.y), r: p.r || 6, fill: p.color, opacity: opts.scatter ? .9 : .62, stroke: p.color, "stroke-width": 1.2 }));
      if (opts.labels && (p.r || 6) > 9) g.appendChild(txt(sx(p.x), sy(p.y) + 3, p.short || "", "ax-txt", { "text-anchor": "middle", "font-size": 9, fill: "#05101f" }));
      tipify(g, p.label, p.tip || [[opts.xLabel, p.x], [opts.yLabel, p.y]]);
      if (opts.onPick) { g.style.cursor = "pointer"; g.addEventListener("click", function () { opts.onPick(p.id); }); }
      svg.appendChild(g);
    });
    return svg;
  };
  VZ.scatter = function (opts) { opts.scatter = true; opts.points.forEach(function (p) { p.r = p.r || 5; }); return VZ.bubble(opts); };
  VZ.quadrant = function (opts) { opts.quadrant = true; return VZ.bubble(opts); };

  /* =========================================================================
     МУЛЬТИЛИНИЯ / ОБЛАСТЬ (stacked area)
     opts: series:[{name,color,values:[]}], xLabels, area(bool), stacked(bool), yLabel, unit
     ========================================================================= */
  VZ.line = function (opts) {
    const W = 780, H = 380, padL = 52, padB = 46, padT = 20, padR = 20;
    const svg = root(W, H);
    const x0 = padL, x1 = W - padR, y0 = H - padB, y1 = padT;
    const nX = opts.xLabels.length;
    const sx = function (i) { return x0 + (nX <= 1 ? 0 : i / (nX - 1) * (x1 - x0)); };
    let yMax;
    if (opts.stacked) { yMax = 0; for (let i = 0; i < nX; i++) { let s = 0; opts.series.forEach(function (se) { s += se.values[i] || 0; }); yMax = Math.max(yMax, s); } }
    else { yMax = Math.max.apply(null, opts.series.map(function (se) { return Math.max.apply(null, se.values); })); }
    yMax = niceMax(yMax);
    const yMin = opts.yMin != null ? opts.yMin : 0;
    const sy = function (v) { return y0 - (v - yMin) / (yMax - yMin) * (y0 - y1); };
    for (let i = 0; i <= 4; i++) {
      const gy = lerp(y0, y1, i / 4);
      svg.appendChild(S("line", { x1: x0, y1: gy, x2: x1, y2: gy, class: "ax-line" }));
      svg.appendChild(txt(x0 - 8, gy + 3, Math.round(lerp(yMin, yMax, i / 4)), "ax-txt", { "text-anchor": "end" }));
    }
    opts.xLabels.forEach(function (l, i) { if (nX <= 12 || i % 2 === 0) svg.appendChild(txt(sx(i), y0 + 16, l, "ax-txt", { "text-anchor": "middle" })); });
    if (opts.yLabel) svg.appendChild(txt(13, (y0 + y1) / 2, opts.yLabel, "ax-title", { "text-anchor": "middle", transform: "rotate(-90 13 " + (y0 + y1) / 2 + ")" }));
    if (opts.stacked) {
      const acc = new Array(nX).fill(0);
      opts.series.forEach(function (se) {
        const top = [], bot = [];
        for (let i = 0; i < nX; i++) { bot.push([sx(i), sy(acc[i])]); acc[i] += se.values[i] || 0; top.push([sx(i), sy(acc[i])]); }
        const path = S("path", { d: "M" + poly(top) + " L" + poly(bot.reverse()) + " Z", fill: se.color, opacity: .5, stroke: se.color, "stroke-width": 1 });
        tipify(path, se.name, [["Итог по ряду", se.values.reduce(function (a, b) { return a + b; }, 0) + (opts.unit || "")]]);
        svg.appendChild(path);
      });
    } else {
      opts.series.forEach(function (se) {
        const pts = se.values.map(function (v, i) { return [sx(i), sy(v)]; });
        if (opts.area) { const gid = mkGrad(svg, "ln" + se.name.replace(/\W/g, ""), se.color, se.color, true); svg.querySelector("#" + gid + " stop:last-child").setAttribute("stop-opacity", "0"); svg.querySelector("#" + gid + " stop:first-child").setAttribute("stop-opacity", ".35");
          svg.appendChild(S("path", { d: "M" + poly(pts) + " L" + sx(nX - 1) + "," + y0 + " L" + x0 + "," + y0 + " Z", fill: "url(#" + gid + ")" })); }
        svg.appendChild(S("path", { d: "M" + poly(pts), fill: "none", stroke: se.color, "stroke-width": 2.4, "stroke-linejoin": "round", "stroke-linecap": "round" }));
        pts.forEach(function (p, i) {
          const c = S("circle", { cx: p[0], cy: p[1], r: 3.4, fill: se.color, class: "v-interactive" });
          tipify(c, se.name + " · " + opts.xLabels[i], [["Значение", se.values[i] + (opts.unit || "")]]);
          svg.appendChild(c);
        });
      });
    }
    return svg;
  };
  VZ.area = function (opts) { opts.stacked = true; return VZ.line(opts); };

  /* =========================================================================
     СТОЛБЧАТАЯ (верт/гориз) + WATERFALL + TORNADO
     ========================================================================= */
  VZ.bar = function (opts) {
    const horiz = opts.horizontal, items = opts.items;
    if (horiz) {
      const rowH = 34, padL = opts.padL || 190, padR = 60, padT = 14, gap = 10;
      const W = 780, H = padT + items.length * (rowH + gap) + 14;
      const svg = root(W, H);
      const max = niceMax(Math.max.apply(null, items.map(function (d) { return Math.abs(d.value); })));
      const x0 = padL, x1 = W - padR;
      items.forEach(function (d, i) {
        const y = padT + i * (rowH + gap);
        svg.appendChild(txt(x0 - 12, y + rowH / 2 + 4, d.label, "ax-txt", { "text-anchor": "end", "font-size": 12, fill: "var(--text-2)" }));
        const w = Math.abs(d.value) / max * (x1 - x0);
        const rect = S("rect", { x: x0, y: y, width: Math.max(2, w), height: rowH, rx: 7, fill: d.color || "var(--accent)" });
        tipify(rect, d.label, [[opts.metric || "Значение", d.value + (opts.unit || "")]].concat(opts.onPick ? ["клик — список технологий"] : []));
        if (opts.onPick) { rect.style.cursor = "pointer"; rect.addEventListener("click", function () { opts.onPick(d); }); }
        svg.appendChild(rect);
        svg.appendChild(txt(x0 + w + 8, y + rowH / 2 + 4, (opts.fmt ? opts.fmt(d.value) : d.value) + (opts.unit || ""), "ax-txt", { "font-size": 11, fill: "var(--text-3)", "font-family": "var(--font-mono)" }));
      });
      return svg;
    }
    const W = 780, H = 380, padL = 48, padB = 66, padT = 18, padR = 18;
    const svg = root(W, H);
    const x0 = padL, x1 = W - padR, y0 = H - padB, y1 = padT;
    const max = niceMax(Math.max.apply(null, items.map(function (d) { return d.value; })));
    const bw = (x1 - x0) / items.length;
    for (let i = 0; i <= 4; i++) { const gy = lerp(y0, y1, i / 4); svg.appendChild(S("line", { x1: x0, y1: gy, x2: x1, y2: gy, class: "ax-line" })); svg.appendChild(txt(x0 - 8, gy + 3, Math.round(lerp(0, max, i / 4)), "ax-txt", { "text-anchor": "end" })); }
    items.forEach(function (d, i) {
      const h = d.value / max * (y0 - y1), x = x0 + bw * i + bw * 0.15;
      const rect = S("rect", { x: x, y: y0 - h, width: bw * 0.7, height: h, rx: 6, fill: d.color || "var(--accent)" });
      tipify(rect, d.label, [[opts.metric || "Значение", d.value + (opts.unit || "")]]);
      svg.appendChild(rect);
      wrapText(svg, d.label, x + bw * 0.35, y0 + 16, bw, 10, "var(--text-3)");
    });
    return svg;
  };

  VZ.waterfall = function (opts) {
    const W = 780, H = 380, padL = 52, padB = 66, padT = 20, padR = 18;
    const svg = root(W, H);
    const x0 = padL, x1 = W - padR, y0 = H - padB, y1 = padT;
    let cum = 0, maxC = 0; const steps = [];
    opts.items.forEach(function (d) { const start = cum; cum += d.value; maxC = Math.max(maxC, cum, start); steps.push({ d: d, start: start, end: cum }); });
    steps.push({ d: { label: opts.totalLabel || "Итого", total: true }, start: 0, end: cum });
    const max = niceMax(Math.max(maxC, cum));
    const bw = (x1 - x0) / steps.length;
    const sy = function (v) { return y0 - v / max * (y0 - y1); };
    for (let i = 0; i <= 4; i++) { const gy = lerp(y0, y1, i / 4); svg.appendChild(S("line", { x1: x0, y1: gy, x2: x1, y2: gy, class: "ax-line" })); svg.appendChild(txt(x0 - 8, gy + 3, Math.round(lerp(0, max, i / 4)), "ax-txt", { "text-anchor": "end" })); }
    steps.forEach(function (st, i) {
      const x = x0 + bw * i + bw * 0.16, w = bw * 0.68;
      const yTop = st.d.total ? sy(st.end) : sy(Math.max(st.start, st.end)), h = st.d.total ? (y0 - sy(st.end)) : Math.abs(sy(st.start) - sy(st.end));
      const col = st.d.total ? "var(--accent)" : (st.d.value >= 0 ? "var(--good)" : "var(--bad)");
      const rect = S("rect", { x: x, y: yTop, width: w, height: Math.max(2, h), rx: 5, fill: col, opacity: st.d.total ? 1 : .85 });
      tipify(rect, st.d.label, [[st.d.total ? "Суммарно" : "Вклад", (st.d.total ? st.end : st.d.value) + (opts.unit || "")]]);
      svg.appendChild(rect);
      if (i > 0 && i < steps.length) svg.appendChild(S("line", { x1: x0 + bw * (i - 1) + bw * 0.84, y1: sy(st.start), x2: x, y2: sy(st.start), stroke: "var(--border-strong)", "stroke-dasharray": "3 3", "stroke-width": 1 }));
      wrapText(svg, st.d.label, x + w / 2, y0 + 16, bw, 10, "var(--text-3)");
    });
    return svg;
  };

  VZ.tornado = function (opts) {
    // диаграмма чувствительности: items:[{label, low, high}] относительно базового 0
    const rowH = 34, padL = 200, padT = 20, gap = 12;
    const W = 780, H = padT + opts.items.length * (rowH + gap) + 20;
    const svg = root(W, H);
    const cx = padL + (W - padL - 30) / 2;
    const max = Math.max.apply(null, opts.items.map(function (d) { return Math.max(Math.abs(d.low), Math.abs(d.high)); }));
    const half = (W - padL - 40) / 2;
    svg.appendChild(S("line", { x1: cx, y1: padT - 6, x2: cx, y2: H - 14, class: "ax-line strong" }));
    opts.items.forEach(function (d, i) {
      const y = padT + i * (rowH + gap);
      svg.appendChild(txt(padL - 14, y + rowH / 2 + 4, d.label, "ax-txt", { "text-anchor": "end", "font-size": 12, fill: "var(--text-2)" }));
      const wl = Math.abs(d.low) / max * half, wh = Math.abs(d.high) / max * half;
      const rl = S("rect", { x: cx - wl, y: y, width: wl, height: rowH, rx: 5, fill: "var(--bad)", opacity: .82 });
      const rh = S("rect", { x: cx, y: y, width: wh, height: rowH, rx: 5, fill: "var(--good)", opacity: .82 });
      tipify(rl, d.label, [["Негативный сценарий", d.low]]); tipify(rh, d.label, [["Позитивный сценарий", d.high]]);
      svg.appendChild(rl); svg.appendChild(rh);
    });
    return svg;
  };

  /* =========================================================================
     РАДАР
     opts: axes:[label], series:[{name,color,values:[0..1 или до max]}], max
     ========================================================================= */
  VZ.radar = function (opts) {
    const W = 560, H = 460, cx = W / 2, cy = H / 2 + 6, R = 165;
    const svg = root(W, H);
    const n = opts.axes.length, max = opts.max || 1;
    const ang = function (i) { return -Math.PI / 2 + i / n * Math.PI * 2; };
    for (let r = 1; r <= 4; r++) {
      const pts = []; for (let i = 0; i < n; i++) { const a = ang(i); pts.push([cx + Math.cos(a) * R * r / 4, cy + Math.sin(a) * R * r / 4]); }
      svg.appendChild(S("polygon", { points: poly(pts), fill: "none", class: "ax-line" }));
    }
    opts.axes.forEach(function (ax, i) {
      const a = ang(i), ex = cx + Math.cos(a) * R, ey = cy + Math.sin(a) * R;
      svg.appendChild(S("line", { x1: cx, y1: cy, x2: ex, y2: ey, class: "ax-line" }));
      const lx = cx + Math.cos(a) * (R + 20), ly = cy + Math.sin(a) * (R + 20);
      svg.appendChild(txt(lx, ly + 3, ax, "ax-txt", { "text-anchor": Math.abs(Math.cos(a)) < 0.3 ? "middle" : (Math.cos(a) > 0 ? "start" : "end"), "font-size": 10.5, fill: "var(--text-2)" }));
    });
    opts.series.forEach(function (se) {
      const pts = se.values.map(function (v, i) { const a = ang(i), rr = v / max * R; return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; });
      svg.appendChild(S("polygon", { points: poly(pts), fill: se.color, opacity: .22, stroke: se.color, "stroke-width": 2 }));
      pts.forEach(function (p, i) { const c = S("circle", { cx: p[0], cy: p[1], r: 3.2, fill: se.color, class: "v-interactive" }); tipify(c, se.name + " · " + opts.axes[i], [["Уровень", se.values[i]]]); svg.appendChild(c); });
    });
    return svg;
  };

  /* =========================================================================
     ХОРД-ДИАГРАММА  (упрощённая): labels, matrix (NxN), colors[]
     ========================================================================= */
  VZ.chord = function (opts) {
    const W = 560, H = 520, cx = W / 2, cy = H / 2, R = 190, thick = 16;
    const svg = root(W, H);
    const n = opts.labels.length;
    const totals = opts.matrix.map(function (row) { return row.reduce(function (a, b) { return a + b; }, 0); });
    const grand = totals.reduce(function (a, b) { return a + b; }, 0) || 1;
    const gap = 0.03; const span = Math.PI * 2 - gap * n;
    const arcs = []; let a0 = -Math.PI / 2;
    totals.forEach(function (t, i) { const a1 = a0 + (t / grand) * span; arcs.push({ a0: a0, a1: a1, mid: (a0 + a1) / 2 }); a0 = a1 + gap; });
    function pt(r, a) { return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }
    function arcPath(r, a0, a1) { const p0 = pt(r, a0), p1 = pt(r, a1); const large = (a1 - a0) > Math.PI ? 1 : 0; return "M" + p0[0] + "," + p0[1] + " A" + r + "," + r + " 0 " + large + " 1 " + p1[0] + "," + p1[1]; }
    // ленты (используем субугловые смещения)
    const outPos = arcs.map(function (a) { return a.a0; });
    const inPos = arcs.map(function (a) { return a.a0; });
    // сперва исходящие занимают долю, потом входящие — упрощение: рисуем по matrix[i][j]
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = opts.matrix[i][j]; if (!v) continue;
        const aw = (v / grand) * span;
        const s0 = outPos[i]; outPos[i] += aw; const s1 = outPos[i];
        const t0 = inPos[j]; inPos[j] += aw; const t1 = inPos[j];
        const p1 = pt(R - thick, s0), p2 = pt(R - thick, s1), p3 = pt(R - thick, t1), p4 = pt(R - thick, t0);
        const d = "M" + p1[0] + "," + p1[1] +
          " A" + (R - thick) + "," + (R - thick) + " 0 0 1 " + p2[0] + "," + p2[1] +
          " Q" + cx + "," + cy + " " + p3[0] + "," + p3[1] +
          " A" + (R - thick) + "," + (R - thick) + " 0 0 1 " + p4[0] + "," + p4[1] +
          " Q" + cx + "," + cy + " " + p1[0] + "," + p1[1] + " Z";
        const ribbon = S("path", { d: d, fill: opts.colors[i], opacity: .32, class: "v-interactive" });
        tipify(ribbon, "Дрейф: " + opts.labels[i] + " ↔ " + opts.labels[j], [[opts.ribbonMetric || "Технологий на стыке", v]].concat(opts.onRibbon ? ["клик — список технологий"] : []));
        if (opts.onRibbon) { const ii = i, jj = j; ribbon.style.cursor = "pointer"; ribbon.addEventListener("click", function () { opts.onRibbon(ii, jj); }); }
        svg.appendChild(ribbon);
      }
    }
    arcs.forEach(function (a, i) {
      const arc = S("path", { d: arcPath(R - thick / 2, a.a0, a.a1), fill: "none", stroke: opts.colors[i], "stroke-width": thick, "stroke-linecap": "round", opacity: .95, class: "v-interactive" });
      tipify(arc, "Отрасль: " + opts.labels[i], [[opts.arcMetric || "Связей", opts.matrix[i].reduce(function (x, y) { return x + y; }, 0)]]);
      svg.appendChild(arc);
      const lp = pt(R + 12, a.mid);
      const anchor = Math.cos(a.mid) < 0 ? "end" : "start";
      svg.appendChild(txt(lp[0], lp[1] + 3, opts.labels[i], "ax-txt", { "text-anchor": anchor, "font-size": 10.5, fill: "var(--text-2)" }));
    });
    return svg;
  };

  /* =========================================================================
     ДЕРЕВО  (иерархия, слева-направо)  root:{name,color,children:[]}
     ========================================================================= */
  VZ.tree = function (opts) {
    const nodes = [], links = [];
    let maxDepth = 0; const leaves = [];
    (function walk(nd, depth, parent) {
      nd._d = depth; maxDepth = Math.max(maxDepth, depth); nodes.push(nd);
      if (parent) links.push([parent, nd]);
      if (nd.children && nd.children.length) nd.children.forEach(function (c) { walk(c, depth + 1, nd); });
      else leaves.push(nd);
    })(opts.root, 0, null);
    leaves.forEach(function (l, i) { l._y = i; });
    // y родителя — среднее детей
    for (let d = maxDepth; d >= 0; d--) {
      nodes.filter(function (n) { return n._d === d; }).forEach(function (n) {
        if (n.children && n.children.length) { n._y = n.children.reduce(function (a, c) { return a + c._y; }, 0) / n.children.length; }
      });
    }
    const rowH = 44, colW = Math.min(230, 720 / Math.max(1, maxDepth));
    const W = 120 + maxDepth * colW + 120, H = 40 + Math.max(1, leaves.length) * rowH;
    const svg = root(W, H);
    const px = function (n) { return 60 + n._d * colW; };
    const py = function (n) { return 30 + n._y * rowH; };
    links.forEach(function (l) {
      svg.appendChild(S("path", { d: curveH(px(l[0]) + 6, py(l[0]), px(l[1]) - 6, py(l[1])), fill: "none", stroke: "var(--border-strong)", "stroke-width": 1.6, opacity: .6 }));
    });
    nodes.forEach(function (n) {
      const g = S("g", { class: "v-interactive" });
      const c = n.color || "var(--accent)";
      g.appendChild(S("circle", { cx: px(n), cy: py(n), r: n._d === 0 ? 9 : 6, fill: c, stroke: "var(--bg-1)", "stroke-width": 2 }));
      svg.appendChild(g);
      if (n._d === 0) {
        // корень: подпись над узлом по центру, чтобы не уходить за левый край
        svg.appendChild(txt(px(n), py(n) - 13, n.name, "node-lbl", { "text-anchor": "start", "font-size": 12 }));
      } else {
        svg.appendChild(txt(px(n) + 12, py(n) + 4, n.name, "node-lbl", { "text-anchor": "start", "font-size": 11.5 }));
      }
      if (n.note) tipify(g, n.name, [n.note]);
    });
    return svg;
  };

  /* =========================================================================
     ТАЙМЛАЙН  events:[{year,label,color,lane}], yFrom,yTo
     ========================================================================= */
  VZ.timeline = function (opts) {
    const W = 820, laneH = 74, padT = 46, padL = 40, padR = 30;
    const lanes = Math.max.apply(null, opts.events.map(function (e) { return e.lane || 0; })) + 1;
    const H = padT + lanes * laneH + 24;
    const svg = root(W, H);
    const yFrom = opts.yFrom || Math.min.apply(null, opts.events.map(function (e) { return e.year; }));
    const yTo = opts.yTo || Math.max.apply(null, opts.events.map(function (e) { return e.year; }));
    const sx = function (y) { return padL + (y - yFrom) / (yTo - yFrom || 1) * (W - padL - padR); };
    // ось лет
    svg.appendChild(S("line", { x1: padL, y1: padT - 16, x2: W - padR, y2: padT - 16, class: "ax-line strong" }));
    for (let y = Math.ceil(yFrom / 5) * 5; y <= yTo; y += 5) {
      svg.appendChild(S("line", { x1: sx(y), y1: padT - 20, x2: sx(y), y2: H - 18, class: "ax-line", "stroke-dasharray": "2 5" }));
      svg.appendChild(txt(sx(y), padT - 26, y, "ax-txt", { "text-anchor": "middle", "font-family": "var(--font-mono)" }));
    }
    // подписи дорожек
    (opts.laneLabels || []).forEach(function (nm, i) {
      svg.appendChild(txt(padL - 6, padT + i * laneH + 10, nm, "ax-txt", { "text-anchor": "start", "font-size": 10, fill: "var(--text-3)" }));
    });
    // сортировка + чередование подписи (над/под точкой) для избежания наложения
    const evs = opts.events.slice().sort(function (a, b) { return ((a.lane || 0) - (b.lane || 0)) || (a.year - b.year); });
    const laneCount = {};
    evs.forEach(function (e) {
      const lane = e.lane || 0;
      const x = sx(e.year), y = padT + lane * laneH + laneH / 2;
      laneCount[lane] = (laneCount[lane] || 0);
      const slot = laneCount[lane]++;
      const above = slot % 2 === 0;
      const ly = above ? y - 14 : y + 20;
      const g = S("g", { class: "v-interactive" });
      g.appendChild(S("line", { x1: x, y1: padT - 16, x2: x, y2: y, stroke: e.color || "var(--accent)", "stroke-width": 1, opacity: .35 }));
      g.appendChild(S("circle", { cx: x, cy: y, r: 6, fill: e.color || "var(--accent)", stroke: "var(--bg-1)", "stroke-width": 2 }));
      const lbl = e.label.length > 18 ? e.label.slice(0, 17) + "…" : e.label;
      const anchor = x < padL + 46 ? "start" : (x > W - padR - 46 ? "end" : "middle");
      g.appendChild(txt(x, ly, lbl, "node-lbl", { "text-anchor": anchor, "font-size": 10 }));
      svg.appendChild(g);
      tipify(g, e.label, [["Год", e.year]].concat(e.tip || []));
    });
    return svg;
  };

  /* =========================================================================
     КОНЦЕНТРИЧЕСКИЕ КРУГИ МАСШТАБОВ  rings:[{label,color,items:[str]}]
     ========================================================================= */
  VZ.radial = function (opts) {
    const W = 620, H = 620, cx = W / 2, cy = H / 2;
    const svg = root(W, H);
    const n = opts.rings.length, Rmax = 280, step = Rmax / n;
    for (let i = n - 1; i >= 0; i--) {
      const ring = opts.rings[i], r = step * (i + 1);
      svg.appendChild(S("circle", { cx: cx, cy: cy, r: r, fill: ring.color, opacity: .07 + i * 0.015, stroke: ring.color, "stroke-width": 1.4, "stroke-opacity": .5 }));
      svg.appendChild(txt(cx, cy - r + 18, ring.label, "ax-title", { "text-anchor": "middle", fill: ring.color, "font-size": 12 }));
      // элементы по дуге
      const items = ring.items || [];
      items.forEach(function (it, k) {
        const a = -Math.PI / 2 + (k + 0.5) / items.length * Math.PI * 2 + (i * 0.3);
        const rr = r - step * 0.42;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        const g = S("g", { class: "v-interactive" });
        g.appendChild(S("circle", { cx: x, cy: y, r: 5, fill: ring.color }));
        svg.appendChild(g);
        tipify(g, ring.label, [it]);
      });
    }
    svg.appendChild(S("circle", { cx: cx, cy: cy, r: 5, fill: "var(--text)" }));
    return svg;
  };

  /* =========================================================================
     ВЕЕР СЦЕНАРИЕВ  scenarios:[{name,color,points:[y..]}], xLabels, splitAt
     ========================================================================= */
  VZ.fan = function (opts) {
    const W = 780, H = 400, padL = 46, padB = 44, padT = 20, padR = 140;
    const svg = root(W, H);
    const x0 = padL, x1 = W - padR, y0 = H - padB, y1 = padT;
    const nX = opts.xLabels.length;
    const sx = function (i) { return x0 + i / (nX - 1) * (x1 - x0); };
    const yMax = niceMax(Math.max.apply(null, opts.scenarios.map(function (s) { return Math.max.apply(null, s.points); })));
    const sy = function (v) { return y0 - v / yMax * (y0 - y1); };
    for (let i = 0; i <= 4; i++) { const gy = lerp(y0, y1, i / 4); svg.appendChild(S("line", { x1: x0, y1: gy, x2: x1, y2: gy, class: "ax-line" })); svg.appendChild(txt(x0 - 8, gy + 3, Math.round(lerp(0, yMax, i / 4)), "ax-txt", { "text-anchor": "end" })); }
    opts.xLabels.forEach(function (l, i) { svg.appendChild(txt(sx(i), y0 + 16, l, "ax-txt", { "text-anchor": "middle" })); });
    // точка расхождения
    const split = opts.splitAt != null ? opts.splitAt : 1;
    svg.appendChild(S("line", { x1: sx(split), y1: y1, x2: sx(split), y2: y0, class: "ax-line strong", "stroke-dasharray": "4 4" }));
    svg.appendChild(txt(sx(split), y1 - 4, "точка расхождения", "ax-txt", { "text-anchor": "middle", "font-size": 10, fill: "var(--text-3)", "font-style": "italic" }));
    opts.scenarios.forEach(function (s) {
      const pts = s.points.map(function (v, i) { return [sx(i), sy(v)]; });
      svg.appendChild(S("path", { d: "M" + poly(pts), fill: "none", stroke: s.color, "stroke-width": 2.6, "stroke-linejoin": "round", opacity: .9, "stroke-dasharray": s.dash || "" }));
      const last = pts[pts.length - 1];
      svg.appendChild(S("circle", { cx: last[0], cy: last[1], r: 4, fill: s.color }));
      svg.appendChild(txt(last[0] + 9, last[1] + 4, s.name, "node-lbl", { "font-size": 11, fill: s.color }));
    });
    return svg;
  };

  /* =========================================================================
     ПРИЧИННО-ПЕТЛЕВАЯ ДИАГРАММА  nodes:[{id,label}], edges:[{from,to,sign}]
     ========================================================================= */
  VZ.loop = function (opts) {
    const W = 720, H = 460, cx = W / 2, cy = H / 2, R = 165;
    const svg = root(W, H);
    const n = opts.nodes.length, pos = {};
    opts.nodes.forEach(function (nd, i) { const a = -Math.PI / 2 + i / n * Math.PI * 2; pos[nd.id] = { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R }; });
    const defs = S("defs");
    defs.appendChild(mkArrow("arrPos", "var(--good)")); defs.appendChild(mkArrow("arrNeg", "var(--bad)"));
    svg.appendChild(defs);
    opts.edges.forEach(function (e) {
      const a = pos[e.from], b = pos[e.to]; if (!a || !b) return;
      const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.18, my = (a.y + b.y) / 2 - (b.x - a.x) * 0.18;
      const col = e.sign === "-" ? "var(--bad)" : "var(--good)";
      const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy);
      const bx = b.x - dx / L * 24, by = b.y - dy / L * 24;
      const p = S("path", { d: "M" + a.x + "," + a.y + " Q" + mx + "," + my + " " + bx + "," + by, fill: "none", stroke: col, "stroke-width": 1.8, opacity: .7, "marker-end": "url(#" + (e.sign === "-" ? "arrNeg" : "arrPos") + ")" });
      svg.appendChild(p);
      svg.appendChild(txt(mx, my, e.sign === "-" ? "−" : "+", "ax-txt", { "text-anchor": "middle", "font-size": 15, fill: col, "font-weight": 700 }));
    });
    opts.nodes.forEach(function (nd) {
      const p = pos[nd.id]; const g = S("g", { class: "v-interactive" });
      g.appendChild(S("circle", { cx: p.x, cy: p.y, r: 20, fill: nd.color || "var(--surface-2)", stroke: nd.color ? nd.color : "var(--border-strong)", "stroke-width": 2 }));
      svg.appendChild(g);
      wrapText(svg, nd.label, p.x, p.y + 3, 84, 10, "var(--text)");
      if (nd.tip) tipify(g, nd.label, [nd.tip]);
    });
    // легенда петель
    if (opts.loops) opts.loops.forEach(function (lp, i) {
      svg.appendChild(txt(20, 24 + i * 18, lp, "ax-txt", { "font-size": 11, fill: "var(--text-3)" }));
    });
    return svg;
  };
  function mkArrow(id, color) {
    const m = S("marker", { id: id, markerWidth: 8, markerHeight: 8, refX: 6, refY: 3, orient: "auto", markerUnits: "strokeWidth" });
    m.appendChild(S("path", { d: "M0,0 L6,3 L0,6 Z", fill: color })); return m;
  }

  /* =========================================================================
     ГЕО-КАРТА (абстрактная): points:[{x,y,label,value,color}]  x,y в 0..1
     ========================================================================= */
  VZ.geo = function (opts) {
    const W = 820, H = 440;
    const svg = root(W, H);
    // абстрактная сетка «широта/долгота»
    for (let i = 0; i <= 8; i++) svg.appendChild(S("line", { x1: i / 8 * W, y1: 0, x2: i / 8 * W, y2: H, class: "ax-line" }));
    for (let j = 0; j <= 4; j++) svg.appendChild(S("line", { x1: 0, y1: j / 4 * H, x2: W, y2: j / 4 * H, class: "ax-line" }));
    // стилизованные «континенты» (декоративные блобы)
    const blobs = [[0.12, 0.3, 90, 70], [0.28, 0.62, 70, 60], [0.5, 0.34, 80, 90], [0.55, 0.66, 55, 50], [0.75, 0.42, 95, 80], [0.82, 0.72, 45, 40]];
    blobs.forEach(function (b, i) { svg.appendChild(S("ellipse", { cx: b[0] * W, cy: b[1] * H, rx: b[2], ry: b[3], fill: "var(--surface-2)", opacity: .5, stroke: "var(--border)", "stroke-width": 1 })); });
    const maxV = Math.max.apply(null, opts.points.map(function (p) { return p.value || 1; }));
    opts.points.forEach(function (p) {
      const x = p.x * W, y = p.y * H, r = 6 + (p.value || 1) / maxV * 22;
      const g = S("g", { class: "v-interactive" });
      g.appendChild(S("circle", { cx: x, cy: y, r: r, fill: p.color || "var(--accent)", opacity: .34 }));
      g.appendChild(S("circle", { cx: x, cy: y, r: 4, fill: p.color || "var(--accent)" }));
      svg.appendChild(g);
      svg.appendChild(txt(x, y - r - 5, p.label, "node-lbl", { "text-anchor": "middle", "font-size": 10.5 }));
      tipify(g, p.label, [[opts.metric || "Значение", (p.value || 0) + (opts.unit || "")]]);
    });
    return svg;
  };

  /* =========================================================================
     КРИВЫЕ ЗАМЕЩЕНИЯ (каннибализация): как одна технология «съедает» рынок другой
     opts: pairs:[{disruptor, incumbent, cross}], yFrom, yTo
     ========================================================================= */
  VZ.substitution = function (opts) {
    const pairs = opts.pairs, yFrom = opts.yFrom || 2022, yTo = opts.yTo || 2050;
    const W = 840, padL = 52, padR = 62, chartH = 176, gap = 34, padT = 44, padB = 28;
    const H = pairs.length * (chartH + gap);
    const svg = root(W, H);
    const GRN = "#35d39b", RED = "#ff6b81";
    function tspan(s, fill) { const t = S("tspan", { fill: fill }); t.textContent = s; return t; }
    pairs.forEach(function (p, idx) {
      const top = idx * (chartH + gap);
      const x0 = padL, x1 = W - padR, yTop = top + padT, yBot = top + chartH - padB;
      // заголовок панели: вытеснитель ⟶ вытесняемый
      const title = S("text", { x: x0, y: top + 18, "font-family": "var(--font-ui)", "font-size": 13, "font-weight": 600 });
      title.appendChild(tspan("🟢 " + p.disruptor, GRN));
      title.appendChild(tspan("   съедает рынок   ", "var(--text-3)"));
      title.appendChild(tspan(p.incumbent + " 🔴", RED));
      svg.appendChild(title);
      const sx = function (t) { return x0 + (t - yFrom) / (yTo - yFrom) * (x1 - x0); };
      const sy = function (v) { return yBot - v / 100 * (yBot - yTop); };
      const k = 0.42, cross = p.cross;
      const share = function (t) { return 100 / (1 + Math.exp(-k * (t - cross))); };
      // сетка Y (0/50/100 %)
      [0, 50, 100].forEach(function (v) { svg.appendChild(S("line", { x1: x0, y1: sy(v), x2: x1, y2: sy(v), class: "ax-line" })); svg.appendChild(txt(x0 - 8, sy(v) + 3, v + "%", "ax-txt", { "text-anchor": "end" })); });
      // ось X (годы)
      for (let y = Math.ceil(yFrom / 5) * 5; y <= yTo; y += 5) svg.appendChild(txt(sx(y), yBot + 15, y, "ax-txt", { "text-anchor": "middle", "font-family": "var(--font-mono)" }));
      // точки кривой
      const pts = []; for (let t = yFrom; t <= yTo; t += 1) pts.push([sx(t), sy(share(t)), t]);
      // область вытеснителя (зелёная, снизу)
      const grn = "M" + x0 + "," + yBot + " L" + pts.map(function (p) { return p[0] + "," + p[1]; }).join(" ") + " L" + x1 + "," + yBot + " Z";
      svg.appendChild(S("path", { d: grn, fill: GRN, opacity: .26 }));
      // область инкумбента (красная, сверху)
      const red = "M" + x0 + "," + yTop + " L" + pts.map(function (p) { return p[0] + "," + p[1]; }).join(" ") + " L" + x1 + "," + yTop + " Z";
      svg.appendChild(S("path", { d: red, fill: RED, opacity: .20 }));
      // линия раздела
      svg.appendChild(S("path", { d: "M" + pts.map(function (p) { return p[0] + "," + p[1]; }).join(" "), fill: "none", stroke: GRN, "stroke-width": 2.6 }));
      // точка каннибализации (50/50)
      svg.appendChild(S("line", { x1: sx(cross), y1: yTop, x2: sx(cross), y2: yBot, stroke: "var(--text-2)", "stroke-dasharray": "4 4", "stroke-width": 1 }));
      svg.appendChild(S("circle", { cx: sx(cross), cy: sy(50), r: 4.5, fill: "var(--text)" }));
      svg.appendChild(txt(sx(cross), yTop - 5, "⚔ точка каннибализации · " + cross, "ax-txt", { "text-anchor": "middle", "font-size": 10, fill: "var(--text-2)", "font-style": "italic" }));
      // интерактивные маркеры
      pts.filter(function (p) { return p[2] % 4 === 0; }).forEach(function (pp) {
        const g = S("g", { class: "v-interactive" });
        g.appendChild(S("circle", { cx: pp[0], cy: pp[1], r: 8, fill: "transparent" }));
        g.appendChild(S("circle", { cx: pp[0], cy: pp[1], r: 2.6, fill: GRN }));
        tipify(g, pp[2] + " год", [[p.disruptor + " (вытеснитель)", Math.round(share(pp[2])) + "%"], [p.incumbent + " (инкумбент)", Math.round(100 - share(pp[2])) + "%"]]);
        svg.appendChild(g);
      });
      // финальные доли справа у краёв областей
      const fd = Math.round(share(yTo)), fi = 100 - fd;
      svg.appendChild(txt(x1 + 8, sy(share(yTo) / 2) + 4, fd + "%", "ax-txt", { "font-size": 12, fill: GRN, "font-weight": 700, "font-family": "var(--font-mono)" }));
      svg.appendChild(txt(x1 + 8, sy(100 - share(yTo) / 2) + 4, fi + "%", "ax-txt", { "font-size": 12, fill: RED, "font-weight": 700, "font-family": "var(--font-mono)" }));
      // ось Y подпись
      svg.appendChild(txt(x0 - 34, (yTop + yBot) / 2, "доля рынка, %", "ax-title", { "text-anchor": "middle", "font-size": 10, transform: "rotate(-90 " + (x0 - 34) + " " + ((yTop + yBot) / 2) + ")" }));
    });
    return svg;
  };

  /* =========================================================================
     МОКАП-ЗАГЛУШКА (когда демо-данных для типа нет)
     ========================================================================= */
  VZ.mock = function (o) {
    return EL("div", { class: "viz-mock" }, [
      EL("div", { class: "ic", html: ICONS[o.type] || ICONS._ }),
      EL("div", { class: "mt", text: o.name || "Визуализация" }),
      EL("div", { class: "mm", text: (o.typeLabel ? "Тип: " + o.typeLabel + ". " : "") + "Оформленный макет — отрисовка на реальных данных предусмотрена на целевой стадии." }),
    ]);
  };
  const ICONS = {
    _: "◆", geo: "🌐", radar: "◈", chord: "◍", tree: "🌳", loop: "↻", fan: "⋔", timeline: "▬", radial: "◎",
    quadrant: "▧", waterfall: "▤", tornado: "◧", heatmap: "▦", sankey: "⇶", graph: "⬡", bubble: "◉",
  };

  window.VZ = VZ;
})();
