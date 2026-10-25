/* Рендеринг вкладок + диспетчер визуализаций (spec → реальная демо-графика). */
(function () {
  const U = window.U, VZ = window.VZ, St = window.Store;
  const Tabs = {};
  const YEARS = ["2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"];
  const PUBYEARS = ["2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024", "2025", "2026"];
  const DOM_PALETTE = ["#6ea8ff", "#8b7bff", "#35c9a6", "#f2c14e", "#f0894e", "#f56b8b", "#4fb6e0", "#c084fc", "#9be36a"];
  const LABS = ["MIT", "Stanford", "ETH Zürich", "Max Planck", "Caltech", "Сколтех", "Univ. Tokyo", "Tsinghua", "Oxford", "EPFL"];
  const FUNDERS = ["NSF", "EU Horizon", "DARPA", "РНФ", "Wellcome", "ARPA-E"];
  const APPLICANTS = ["IBM", "Google", "Samsung", "Siemens", "BASF", "Roche", "Huawei", "Bosch", "TSMC", "Intel"];
  const IPCS = ["G06N", "H01L", "C12N", "H04W", "B25J", "G01N", "H01M", "C07K"];

  /* ============================ Общие мелкие builder-ы ============================ */
  function layerBadge(lid, withName) {
    const l = St.layer(lid), c = St.layerColor(lid);
    return U.el("span", { class: "badge layer-badge", style: "background:" + c, title: lid + " · " + l.title }, [
      U.el("b", { text: St.layerLabel(lid), style: "font-family:var(--font-mono)" }),
      withName ? U.el("span", { text: " · " + l.title, style: "font-weight:500" }) : null,
    ]);
  }
  function audBadge(aid) {
    const a = St.aud(aid), c = St.audColor(aid);
    return U.el("span", { class: "aud-badge", style: "color:" + c + ";border-color:" + c }, [
      U.el("span", { class: "d", style: "background:" + c }), a ? a.name.split(" ")[0] : aid,
    ]);
  }
  function audBadges(list) { return U.el("div", { class: "chips-row" }, (list || []).map(audBadge)); }

  // ---- подтверждающие артефакты (evidence) ----
  const EV_LAYER = { "Публикация": "S1", "Грантовый проект": "S2", "PoC-прототип": "S2", "Патент": "S3", "Репозиторий": "S3", "Демонстрация": "S3", "Венчурный раунд": "S4", "Ранний заказчик": "S4", "Продукт / сделка": "S5", "IPO / сделка": "S5", "Регуляторный акт": "S6", "Стандарт": "S6" };
  function evColor(kind) { return St.layerColor(EV_LAYER[kind] || "S3"); }
  function evItem(it, onclick) {
    const col = evColor(it.kind);
    return U.el("div", { class: "ev-item" + (onclick ? " click" : ""), onclick: onclick || null }, [
      U.el("span", { class: "ek", style: "color:" + col + ";border-color:" + col, text: it.kind }),
      U.el("div", { class: "ec" }, [U.el("div", { class: "et", text: it.title }), U.el("div", { class: "em", text: it.meta + (it.techName ? "  ·  " + it.techName : "") })]),
    ]);
  }
  function evList(items, clickable) {
    return U.el("div", { class: "ev-list" }, items.map(function (it) { return evItem(it, clickable ? function () { openTech(it.techId); } : null); }));
  }

  // ---- барьеры ----
  function sevDots(n) { return U.el("span", { class: "sev-dots" }, [1, 2, 3, 4, 5].map(function (i) { return U.el("span", { class: "sd" + (i <= n ? " on" : "") }); })); }
  function barrierList(techId) {
    const bs = St.barriersFor(techId);
    if (!bs.length) return U.el("div", { class: "small muted", text: "Явных барьеров не зафиксировано." });
    return U.el("div", {}, bs.map(function (b) {
      return U.el("div", { class: "bar-item", title: b.note }, [
        U.el("span", { class: "bn", text: b.name }),
        U.el("div", { class: "btrack" }, U.el("div", { class: "bfill", style: "width:" + (b.severity / 5 * 100) + "%;background:" + b.color })),
        sevDots(b.severity),
      ]);
    }));
  }
  function barrierAggBlock(techs) {
    const agg = St.barrierAggregate(techs);
    const max = Math.max.apply(null, agg.map(function (b) { return b.value; })) || 1;
    return U.el("div", {}, agg.map(function (b) {
      return U.el("div", { class: "bar-item", title: b.count + " технологий с этим барьером" }, [
        U.el("span", { class: "bn", text: b.name }),
        U.el("div", { class: "btrack" }, U.el("div", { class: "bfill", style: "width:" + (b.value / max * 100) + "%;background:" + b.color })),
        U.el("span", { class: "bsev", text: "Σ" + b.value }),
      ]);
    }));
  }
  function isBarrierSpec(name) { return /барьер|причин|сопротивлен|bottleneck|препятств/i.test(name || ""); }

  function layerBar(t, big) {
    const bar = U.el("div", { class: "layerbar" + (big ? " big" : "") });
    ["S1", "S2", "S3", "S4", "S5", "S6"].forEach(function (lid) {
      const on = t.byLayer && t.byLayer[lid];
      const seg = U.el("div", { class: "seg" + (on ? " on" : "") + (t.currentLayer === lid ? " cur" : ""),
        style: on ? "background:" + St.layerColor(lid) : "", title: lid + (on ? " · " + t.byLayer[lid] : " · не достигнут") });
      bar.appendChild(seg);
    });
    return bar;
  }

  function domGroup(t) { return t.domain.split("/")[0]; }
  function cutDisp(id) { return id.replace(/^R/, "I"); } // отображаемый код разреза I01–I16
  // информативная короткая подпись технологии (акроним из скобок или 1–2 слова)
  function techShort(t) {
    const paren = t.name.match(/\(([^)]+)\)/);
    if (paren && /^[A-ZА-Я0-9][A-ZА-Я0-9\- ]{1,8}$/.test(paren[1])) return paren[1];
    const base = t.name.replace(/\s*\([^)]*\)/g, "").trim();
    const words = base.split(" ");
    let s = words.slice(0, 2).join(" ");
    if (s.length > 20) s = words[0];
    if (s.length > 20) s = s.slice(0, 18) + "…";
    return s;
  }
  // drawer со списком технологий, стоящих за элементом графика
  function openTechList(title, techs, subtitle) {
    U.openDrawer(function (body, head) {
      head.appendChild(U.el("span", { class: "tag", text: "Список" }));
      head.appendChild(U.spacer());
      body.appendChild(U.el("h3", { class: "dt", text: title }));
      if (subtitle) body.appendChild(U.el("div", { class: "dsub", text: subtitle }));
      body.appendChild(U.el("div", { class: "dsub", text: techs.length + " технологий · клик — карточка с артефактами" }));
      if (!techs.length) { body.appendChild(U.state("∅", "Пусто", "Нет технологий для этого элемента.")); return; }
      const wrap = U.el("div", { class: "stack" });
      techs.slice().sort(function (a, b) { return St.layerOrder(a.currentLayer) - St.layerOrder(b.currentLayer); }).forEach(function (t) {
        wrap.appendChild(U.el("div", { class: "link-item", onclick: function () { openTech(t.id); } }, [
          layerBadge(t.currentLayer),
          U.el("div", { class: "lc" }, [U.el("div", { class: "n", text: t.name }), U.el("div", { class: "note", text: t.domain })]),
          U.el("span", { class: "arr", text: "→" }),
        ]));
      });
      body.appendChild(wrap);
    });
  }
  function topDomainGroups(techs, n) {
    const m = {}; techs.forEach(function (t) { const g = domGroup(t); m[g] = (m[g] || 0) + 1; });
    return Object.keys(m).sort(function (a, b) { return m[b] - m[a]; }).slice(0, n || 7);
  }
  function domColor(g, all) { const i = all.indexOf(g); return DOM_PALETTE[(i < 0 ? 0 : i) % DOM_PALETTE.length]; }

  /* ============================ Каталог: карточка технологии ============================ */
  function techCard(t) {
    const c = St.layerColor(t.currentLayer);
    const card = U.el("div", { class: "card hover tech-card", onclick: function () { openTech(t.id); } }, [
      U.el("div", { class: "top" }, [
        U.el("div", {}, [U.el("h4", { text: t.name }), U.el("div", { class: "dom", text: t.domain })]),
        layerBadge(t.currentLayer),
      ]),
      U.el("div", { class: "desc", text: t.description }),
      layerBar(t),
      U.el("div", { class: "foot" }, [
        U.el("span", { class: "tag", text: (t.links || []).length + " связей" }),
        U.el("span", { class: "tag", text: (St.metrics(t.id).conv) + " конверг." }),
        U.el("div", { class: "spacer", style: "flex:1" }),
        audBadges((t.audiences || []).slice(0, 2)),
      ]),
    ]);
    return card;
  }

  /* ============================ Drawer: технология ============================ */
  function openTech(id) {
    const t = St.tech(id); if (!t) return;
    U.openDrawer(function (body, head) {
      head.appendChild(layerBadge(t.currentLayer, true));
      head.appendChild(U.spacer());
      body.appendChild(U.el("h3", { class: "dt", text: t.name }));
      body.appendChild(U.el("div", { class: "dsub", text: t.domain + "  ·  текущий слой " + St.layerLabel(t.currentLayer) }));

      body.appendChild(U.block("Описание", U.el("div", { class: "prose", text: t.description })));
      body.appendChild(U.block("Следующий ожидаемый рубеж", U.el("div", { class: "prose", text: t.nextMilestone })));

      // присутствие по слоям
      const pres = U.el("div", { class: "stack" });
      pres.appendChild(layerBar(t, true));
      const list = U.el("div", { class: "stack", style: "margin-top:14px;gap:16px" });
      ["S1", "S2", "S3", "S4", "S5", "S6"].forEach(function (lid) {
        if (!t.byLayer || !t.byLayer[lid]) return;
        const ev = St.evidenceFor(t.id, lid);
        const row = U.el("div", { class: "stack", style: "gap:8px" }, [
          U.el("div", { class: "row", style: "align-items:flex-start;gap:10px" }, [
            layerBadge(lid), U.el("div", { class: "small muted", text: t.byLayer[lid], style: "flex:1" }),
          ]),
        ]);
        if (ev.length) row.appendChild(evList(ev, false));
        list.appendChild(row);
      });
      pres.appendChild(list);
      body.appendChild(U.block("Присутствие по слоям — подтверждающие артефакты", pres));

      // барьеры перехода
      body.appendChild(U.block("Барьеры перехода на следующий слой", [
        U.el("div", { class: "small muted", style: "margin-bottom:10px", text: "Значение по шкале 1–5. Тип барьера отражает, что удерживает технологию на текущем слое." }),
        barrierList(t.id),
      ]));

      // связи
      const links = (t.links || []).filter(function (l) { return l.target || l.note; });
      const backs = St.data.backlinks[t.id] || [];
      if (links.length || backs.length) {
        const wrap = U.el("div", {});
        links.forEach(function (l) {
          const tgt = l.target ? St.tech(l.target) : null;
          const lc = St.linkColor(l.type);
          wrap.appendChild(U.el("div", { class: "link-item", onclick: function () { if (tgt) openTech(tgt.id); } }, [
            U.el("span", { class: "lt", style: "background:" + lc + "22;color:" + lc, text: St.linkTypeName(l.type) }),
            U.el("div", { class: "lc" }, [
              U.el("div", { class: "n", text: tgt ? tgt.name : "(межотраслевая / без конкретной цели)" }),
              l.note ? U.el("div", { class: "note", text: l.note }) : null,
            ]),
            tgt ? U.el("span", { class: "arr", text: "→" }) : null,
          ]));
        });
        backs.forEach(function (b) {
          const src = St.tech(b.from), lc = St.linkColor(b.type);
          wrap.appendChild(U.el("div", { class: "link-item", onclick: function () { openTech(src.id); } }, [
            U.el("span", { class: "lt", style: "background:" + lc + "22;color:" + lc, text: "← " + St.linkTypeName(b.type) }),
            U.el("div", { class: "lc" }, [U.el("div", { class: "n", text: src.name }), b.note ? U.el("div", { class: "note", text: b.note }) : null]),
          ]));
        });
        body.appendChild(U.block("Связи с технологиями", wrap));
      }

      // аудитории
      body.appendChild(U.block("Релевантные аудитории", audBadges(t.audiences)));

      // разрезы, где фигурирует
      const cuts = St.cutsForTech(t).slice(0, 8);
      if (cuts.length) {
        const cr = U.el("div", { class: "chips-row" });
        cuts.forEach(function (c) { cr.appendChild(U.el("button", { class: "chip click", text: c.title, onclick: function () { U.closeDrawer(); App.go("cuts"); setTimeout(function () { openCut(c.id); }, 260); } })); });
        body.appendChild(U.block("Фигурирует в разрезах", cr));
      }

      // переходы
      const nav = U.el("div", { class: "row wrap", style: "gap:8px" }, [
        U.el("button", { class: "btn sm primary", text: "На карту эволюции →", onclick: function () { U.closeDrawer(); St.state.ui.overviewTech = t.id; St.save(); App.go("overview"); } }),
        U.el("button", { class: "btn sm", text: "Слой " + St.layerLabel(t.currentLayer) + " →", onclick: function () { U.closeDrawer(); App.go(t.currentLayer); } }),
      ]);
      body.appendChild(U.block("Переходы", nav));
    });
  }

  /* ============================ Диспетчер визуализаций ============================ */
  // spec: {name,type,audience}; ctx: {techs, layer, cut}
  function buildViz(spec, ctx) {
    const techs = (ctx.techs && ctx.techs.length) ? ctx.techs : St.data.techs;
    const type = spec.type;
    try {
      const routed = routeLayerViz(spec, ctx, techs);
      if (routed) return routed;
      switch (type) {
        case "funnel": return VZ.funnel(funnelData(techs, spec));
        case "sankey": return VZ.sankey(sankeyData(techs, ctx.cut));
        case "substitution": return VZ.substitution(substitutionData());
        case "graph": return VZ.graph(graphData(techs, spec));
        case "heatmap": return VZ.heatmap(heatmapData(techs, spec));
        case "bubble": return VZ.bubble(bubbleData(techs, spec));
        case "scatter": return VZ.scatter(scatterData(techs, spec, ctx.cut));
        case "quadrant": return VZ.quadrant(quadrantData(techs));
        case "line": return VZ.line(lineData(techs, spec));
        case "area": return VZ.area(areaData(techs));
        case "bar": return VZ.bar(isBarrierSpec(spec.name) ? barrierBarData(techs) : barData(techs, spec));
        case "waterfall": return VZ.waterfall(waterfallData(techs));
        case "radar": return VZ.radar(radarData(techs));
        case "chord": return VZ.chord(chordData(techs));
        case "tree": return VZ.tree(treeData(techs, spec));
        case "timeline": return VZ.timeline(timelineData(techs));
        case "radial": return VZ.radial(radialData(techs));
        case "fan": return VZ.fan(fanData());
        case "loop": return VZ.loop(loopData(spec));
        case "geo": return VZ.geo(geoData(techs));
        case "tornado": return VZ.tornado(tornadoData());
        case "table": return tableData(techs, spec);
        default: return VZ.mock({ type: type, name: spec.name, typeLabel: type });
      }
    } catch (e) {
      return VZ.mock({ type: type, name: spec.name, typeLabel: type });
    }
  }

  // ---- генераторы демо-данных (детерминированы по seed) ----
  function funnelData(techs, spec) {
    const stages = ["S1", "S2", "S3", "S4", "S5", "S6"].map(function (lid) {
      const v = techs.filter(function (t) { return t.byLayer && t.byLayer[lid]; }).length;
      return { id: lid, tick: St.layerTick(lid), label: St.layer(lid).title, value: v, color: St.layerColor(lid), sub: St.layer(lid).transitionCriterion };
    });
    const onPick = (spec && spec._pick) ? spec._pick : function (lid) {
      openTechList("Слой " + St.layerLabel(lid), techs.filter(function (t) { return t.byLayer && t.byLayer[lid]; }), "Технологии с присутствием на этом слое");
    };
    return { stages: stages, onPick: onPick };
  }
  // санки: тип данных зависит от разреза (технологии / капитал / добавленная стоимость / кадры)
  function sankeyData(techs, cut) {
    const cid = cut && cut.id;
    if (cid === "R01") return sankeyValueAdded(techs);
    if (cid === "R02") return sankeyCapitalFlow(techs);
    if (cid === "R05") return sankeyTalent(techs);
    return sankeyTechFlow(techs);
  }
  // по умолчанию: домен → слой → аудитория, ширина ленты = число технологий
  function sankeyTechFlow(techs) {
    const groups = topDomainGroups(techs, 6);
    const nodes = [], links = [];
    groups.forEach(function (g, i) { nodes.push({ id: "d:" + g, label: g, col: 0, color: domColor(g, groups), order: i }); });
    ["S1", "S2", "S3", "S4", "S5", "S6"].forEach(function (lid, i) { nodes.push({ id: "l:" + lid, label: St.layerTick(lid), col: 1, color: St.layerColor(lid), order: i }); });
    const auds = {};
    techs.forEach(function (t) { const a = t.audiences && t.audiences[0]; if (a) auds[a] = true; });
    Object.keys(auds).forEach(function (a, i) { nodes.push({ id: "a:" + a, label: St.audShort(a), col: 2, color: St.audColor(a), order: i }); });
    const l1 = {}, l2 = {};
    techs.forEach(function (t) {
      const g = domGroup(t); if (groups.indexOf(g) < 0) return;
      const k1 = "d:" + g + ">l:" + t.currentLayer; l1[k1] = (l1[k1] || 0) + 1;
      const a = t.audiences && t.audiences[0]; if (a) { const k2 = "l:" + t.currentLayer + ">a:" + a; l2[k2] = (l2[k2] || 0) + 1; }
    });
    Object.keys(l1).forEach(function (k) { const p = k.split(">"); links.push({ source: p[0], target: p[1], value: l1[k] }); });
    Object.keys(l2).forEach(function (k) { const p = k.split(">"); links.push({ source: p[0], target: p[1], value: l2[k] }); });
    return { nodes: nodes, links: links, nodeMetric: "Технологий", unit: " шт.", nodeFmt: function (v) { return "(" + v + " шт.)"; },
      onNode: function (n) {
        const p = n.id.split(":"), kind = p[0], val = p[1];
        let sub, list;
        if (kind === "d") { sub = "Домен: " + val; list = techs.filter(function (t) { return domGroup(t) === val; }); }
        else if (kind === "l") { sub = "Слой: " + St.layerLabel(val); list = techs.filter(function (t) { return t.currentLayer === val; }); }
        else { sub = "Аудитория: " + St.audName(val); list = techs.filter(function (t) { return (t.audiences || [])[0] === val; }); }
        openTechList(n.label.replace(/\s*\(.*?\)$/, ""), list, sub);
      } };
  }
  // R01: добавленная стоимость Труд/Капитал → секторы, млрд $
  function sankeyValueAdded(techs) {
    const groups = topDomainGroups(techs, 6);
    const nodes = [
      { id: "f:labor", label: "Труд", col: 0, color: "#4fb6e0", order: 0 },
      { id: "f:cap", label: "Капитал", col: 0, color: "#8b7bff", order: 1 },
    ];
    groups.forEach(function (g, i) { nodes.push({ id: "s:" + g, label: g, col: 1, color: domColor(g, groups), order: i }); });
    const links = [];
    groups.forEach(function (g) {
      const r = U.rng("va" + g), cnt = techs.filter(function (t) { return domGroup(t) === g; }).length;
      const total = 40 + cnt * 22 + Math.round(r() * 60);
      const capShare = 0.45 + r() * 0.4;
      links.push({ source: "f:cap", target: "s:" + g, value: Math.round(total * capShare) });
      links.push({ source: "f:labor", target: "s:" + g, value: Math.round(total * (1 - capShare)) });
    });
    return { nodes: nodes, links: links, nodeMetric: "Добавленная стоимость", unit: " млрд $",
      nodeFmt: function (v) { return "$" + v + " млрд"; }, nodeTip: function (v) { return "$" + v + " млрд"; },
      onNode: function (n) { if (n.id.indexOf("s:") === 0) { const g = n.id.slice(2); openTechList("Сектор: " + g, techs.filter(function (t) { return domGroup(t) === g; }), "Технологии сектора (добавленная стоимость условна)"); } } };
  }
  // R02: потоки капитала по слоям зрелости S1→S5, млрд $
  function sankeyCapitalFlow(techs) {
    const lids = ["S1", "S2", "S3", "S4", "S5"];
    const nodes = lids.map(function (lid, i) { return { id: "l:" + lid, label: St.layerTick(lid), col: i, color: St.layerColor(lid), order: 0 }; });
    const cap = {};
    lids.forEach(function (lid) {
      const sum = techs.filter(function (t) { return t.byLayer && t.byLayer[lid]; }).reduce(function (a, t) { return a + St.metrics(t.id).invest; }, 0);
      cap[lid] = Math.max(1, Math.round(sum / 100) / 10);
    });
    const links = [];
    for (let i = 0; i < lids.length - 1; i++) links.push({ source: "l:" + lids[i], target: "l:" + lids[i + 1], value: Math.max(cap[lids[i]], cap[lids[i + 1]]) });
    return { nodes: nodes, links: links, nodeMetric: "Капитал", unit: " млрд $",
      nodeFmt: function (v) { return "$" + v + " млрд"; }, nodeTip: function (v) { return "$" + v + " млрд"; },
      onNode: function (n) { const lid = n.id.slice(2); openTechList("Слой " + St.layerLabel(lid), techs.filter(function (t) { return t.byLayer && t.byLayer[lid]; }), "Технологии с присутствием на слое (капитал условен)"); } };
  }
  // R05: миграция специалистов между отраслями, тыс. чел.
  function sankeyTalent(techs) {
    const groups = topDomainGroups(techs, 5);
    const nodes = [];
    groups.forEach(function (g, i) { nodes.push({ id: "src:" + g, label: g, col: 0, color: domColor(g, groups), order: i }); });
    groups.forEach(function (g, i) { nodes.push({ id: "dst:" + g, label: g, col: 1, color: domColor(g, groups), order: i }); });
    const links = [];
    groups.forEach(function (g, i) {
      const r = U.rng("tal" + g);
      for (let k = 1; k <= 2; k++) { const tg = groups[(i + k) % groups.length]; links.push({ source: "src:" + g, target: "dst:" + tg, value: 3 + Math.round(r() * 22) }); }
    });
    return { nodes: nodes, links: links, nodeMetric: "Специалисты", unit: " тыс.",
      nodeFmt: function (v) { return v + " тыс."; }, nodeTip: function (v) { return v + " тыс. чел."; },
      onNode: function (n) { const g = n.id.split(":")[1]; openTechList("Отрасль: " + g, techs.filter(function (t) { return domGroup(t) === g; }), "Технологии отрасли"); } };
  }
  function substitutionData() {
    return { yFrom: 2022, yTo: 2050, pairs: [
      { disruptor: "Натрий-ионные аккумуляторы", incumbent: "Литий-ион (стационарное хранение)", cross: 2033 },
      { disruptor: "Генеративный ИИ", incumbent: "Шаблонный труд и классический поиск", cross: 2028 },
      { disruptor: "Спутниковый интернет (LEO)", incumbent: "Наземный ШПД (удалённые регионы)", cross: 2031 },
    ] };
  }

  /* ===== Специализированные генераторы визуализаций слоёв (отвечают на вопрос слоя) ===== */
  function pickN(r, pool, n) { const out = []; let g = 0; while (out.length < n && g < 30) { const x = pool[Math.floor(r() * pool.length) % pool.length]; if (out.indexOf(x) < 0) out.push(x); g++; } return out; }
  // Сеть соавторства / патентных семей: узлы — институты/заявители, рёбра — совместные работы
  function entityNet(techs, pool, seedk, sizeLabel) {
    const nm = {}, ew = {};
    techs.forEach(function (t) {
      const r = U.rng(seedk + t.id), chosen = pickN(r, pool, 2 + Math.floor(r() * 2));
      chosen.forEach(function (x) { nm[x] = nm[x] || { w: 0, techs: [] }; nm[x].w += 1 + Math.floor(r() * 3); nm[x].techs.push(t.id); });
      for (let i = 0; i < chosen.length; i++) for (let j = i + 1; j < chosen.length; j++) { const k = [chosen[i], chosen[j]].sort().join("|"); ew[k] = (ew[k] || 0) + 1; }
    });
    const names = Object.keys(nm);
    const nodes = names.map(function (x, i) { return { id: x, label: x, color: DOM_PALETTE[i % DOM_PALETTE.length], r: 8 + Math.min(18, nm[x].w * 1.3), tip: [[sizeLabel, nm[x].w], ["Технологий", nm[x].techs.length]] }; });
    const links = Object.keys(ew).map(function (k) { const p = k.split("|"); return { source: p[0], target: p[1], weight: Math.min(1, ew[k] / 3) }; });
    return { nodes: nodes, links: links, showWeights: true, seed: seedk, onPick: function (id) { if (nm[id]) openTechList(id, nm[id].techs.map(function (id) { return St.tech(id); }), sizeLabel + " · технологии узла"); } };
  }
  function coauthorData(techs) { return entityNet(techs, LABS, "coauth", "Публикаций"); }
  function patentFamilyData(techs) { return entityNet(techs, APPLICANTS, "patfam", "Патентов"); }

  function themeYearData(techs) {
    const themes = topDomainGroups(techs, 7);
    const values = themes.map(function (g) { const r = U.rng("ty" + g); let base = 2 + Math.floor(r() * 4); return PUBYEARS.map(function (y, i) { return Math.max(0, Math.round(base * (1 + i * 0.28) * (0.55 + r() * 0.9))); }); });
    return { rows: themes, cols: PUBYEARS.map(function (y) { return "'" + y.slice(2); }), values: values, c1: "#141d33", c2: "#8b7bff", metric: "Публикаций", showVals: true, padL: 128,
      onCell: function (i) { const g = themes[i]; openTechList("Тема: " + g, techs.filter(function (t) { return domGroup(t) === g; }), "Технологии темы"); } };
  }
  function ipcYearData(techs) {
    const rows = IPCS.slice(0, 8);
    const values = rows.map(function (c) { const r = U.rng("ipc" + c); let base = 3 + Math.floor(r() * 6); return PUBYEARS.map(function (y, i) { return Math.max(0, Math.round(base * (1 + i * 0.22) * (0.6 + r() * 0.8))); }); });
    return { rows: rows, cols: PUBYEARS.map(function (y) { return "'" + y.slice(2); }), values: values, c1: "#141d33", c2: "#35c9a6", metric: "Патентов", showVals: true, padL: 80 };
  }
  function transformData(techs) {
    const rows = topDomainGroups(techs, 7), cols = ["2030", "2040", "2050"];
    const values = rows.map(function (g) { const r = U.rng("tr" + g); let base = 2 + Math.floor(r() * 4); return cols.map(function (c, i) { return Math.min(10, base + i * 2 + Math.floor(r() * 2)); }); });
    return { rows: rows, cols: cols, values: values, c1: "#141d33", c2: "#f56b8b", metric: "Сила трансформации (1–10)", showVals: true, padL: 128,
      onCell: function (i) { const g = rows[i]; openTechList("Отрасль: " + g, techs.filter(function (t) { return domGroup(t) === g; }), "Технологии отрасли"); } };
  }
  function grantsSankeyData(techs) {
    const funders = FUNDERS.slice(0, 5), labs = LABS.slice(0, 6), doms = topDomainGroups(techs, 5);
    const nodes = [], links = [], fM = {}, lM = {}, dM = {};
    funders.forEach(function (f, i) { nodes.push({ id: "f:" + f, label: f, col: 0, color: "#8b7bff", order: i }); fM[f] = []; });
    labs.forEach(function (l, i) { nodes.push({ id: "l:" + l, label: l, col: 1, color: "#4fb6e0", order: i }); lM[l] = []; });
    doms.forEach(function (g, i) { nodes.push({ id: "d:" + g, label: g, col: 2, color: domColor(g, doms), order: i }); dM[g] = []; });
    const l1 = {}, l2 = {};
    techs.forEach(function (t) {
      const r = U.rng("gr" + t.id), g = domGroup(t); if (doms.indexOf(g) < 0) return;
      const f = funders[Math.floor(r() * funders.length) % funders.length], l = labs[Math.floor(r() * labs.length) % labs.length];
      l1["f:" + f + ">l:" + l] = (l1["f:" + f + ">l:" + l] || 0) + 1; l2["l:" + l + ">d:" + g] = (l2["l:" + l + ">d:" + g] || 0) + 1;
      fM[f].push(t.id); lM[l].push(t.id); dM[g].push(t.id);
    });
    Object.keys(l1).forEach(function (k) { const p = k.split(">"); links.push({ source: p[0], target: p[1], value: l1[k] }); });
    Object.keys(l2).forEach(function (k) { const p = k.split(">"); links.push({ source: p[0], target: p[1], value: l2[k] }); });
    return { nodes: nodes, links: links, nodeMetric: "Проектов", unit: "", nodeFmt: function (v) { return "(" + v + ")"; },
      onNode: function (n) { const p = n.id.split(":"), m = p[0] === "f" ? fM : p[0] === "l" ? lM : dM; openTechList(n.label, (m[p[1]] || []).map(function (id) { return St.tech(id); }), "Проекты этого узла"); } };
  }
  function stageFunnel(techs, stages) {
    const base = Math.max(techs.length, 4);
    return { stages: stages.map(function (s) { return { id: s.id, tick: s.tick, label: s.label, value: Math.max(1, Math.round(base * s.k)), color: s.color, sub: s.sub }; }) };
  }
  function reproFunnelData(techs) {
    return stageFunnel(techs, [
      { id: "poc", tick: "PoC", label: "PoC-прототипы", k: 1, color: St.layerColor("S2") },
      { id: "rep", tick: "Воспр.", label: "Воспроизведено в лаборатории", k: 0.7, color: "#4fb6e0" },
      { id: "ind", tick: "Незав.", label: "Независимое воспроизведение", k: 0.45, color: "#35c9a6" },
      { id: "s3", tick: "→S3", label: "Переход в S3 (коммерч. реализуемость)", k: 0.28, color: St.layerColor("S3") },
    ]);
  }
  function demandFunnelData(techs) {
    return stageFunnel(techs, [
      { id: "early", tick: "Пилоты", label: "Ранние заказчики / пилоты", k: 1, color: St.layerColor("S4") },
      { id: "repeat", tick: "Повтор", label: "Повторные заказы", k: 0.62, color: "#f2c14e" },
      { id: "stable", tick: "Спрос", label: "Устойчивый платёжеспособный спрос", k: 0.4, color: "#f0894e" },
      { id: "prod", tick: "→S5", label: "Переход в продукт", k: 0.26, color: St.layerColor("S5") },
    ]);
  }
  function topicsBubbleData(techs) {
    const points = techs.map(function (t) { const m = St.metrics(t.id); return { id: t.id, label: t.name, x: m.citations, y: m.growth, r: 6 + Math.sqrt(m.patents), color: St.layerColor(t.currentLayer), tip: [["Цитируемость", m.citations], ["Темп роста, %", m.growth], ["Патентов", m.patents]] }; });
    return { points: points, xLabel: "Объём публикаций (цитируемость)", yLabel: "Темп роста цитирований, %", onPick: openTech };
  }
  function financeProbData(techs) {
    const points = techs.map(function (t) { const m = St.metrics(t.id), r = U.rng("fp" + t.id); const prob = Math.min(95, 22 + St.layerOrder(t.currentLayer) * 10 + Math.round(r() * 16)); return { id: t.id, label: t.name, x: m.invest, y: prob, r: 6 + m.conv, color: St.layerColor(t.currentLayer), tip: [["Финансирование, млн $", m.invest], ["Вероятность перехода, %", prob]] }; });
    return { points: points, xLabel: "Объём финансирования, млн $", yLabel: "Вероятность перехода, %", yMax: 100, onPick: openTech };
  }
  function tamBubbleData(techs) {
    const points = techs.map(function (t) { const m = St.metrics(t.id); return { id: t.id, label: t.name, x: m.tam, y: m.rounds, r: 6 + Math.sqrt(m.tam * 0.4), color: St.layerColor(t.currentLayer), tip: [["TAM, млрд $", m.tam], ["SAM, млрд $", Math.round(m.tam * 0.4)], ["SOM, млрд $", Math.round(m.tam * 0.1)], ["Раундов", m.rounds]] }; });
    return { points: points, xLabel: "TAM, млрд $", yLabel: "Темп раундов (шт.)", onPick: openTech };
  }
  function marketShareData(techs) {
    const comps = APPLICANTS.slice(0, 5);
    const series = comps.map(function (c, idx) { const r = U.rng("ms" + c); let v = 6 + Math.floor(r() * 16); return { name: c, color: DOM_PALETTE[idx % DOM_PALETTE.length], values: YEARS.map(function () { v = Math.max(2, v + Math.round((r() - 0.4) * 6)); return v; }) }; });
    return { series: series, xLabels: YEARS, yLabel: "Доля рынка / выручка (усл.)", unit: "" };
  }
  function ttmBarData(techs) {
    const groups = topDomainGroups(techs, 8);
    const items = groups.map(function (g) { const gt = techs.filter(function (t) { return domGroup(t) === g; }); const avg = Math.round(gt.reduce(function (a, t) { return a + St.metrics(t.id).ttm; }, 0) / Math.max(1, gt.length)); return { label: g, value: avg, color: domColor(g, groups), _g: g }; }).sort(function (a, b) { return b.value - a.value; });
    return { items: items, horizontal: true, metric: "Time-to-market", unit: " лет", padL: 150, onPick: function (d) { openTechList("Категория: " + d._g, techs.filter(function (t) { return domGroup(t) === d._g; }), "Технологии категории"); } };
  }
  function effectsBarData(techs) {
    const spheres = ["Занятость", "Здоровье", "Экология", "Приватность", "Мобильность", "Образование", "Продбезопасность"];
    const items = spheres.map(function (s, i) { const r = U.rng("eff" + s); return { label: s, value: 3 + Math.floor(r() * 8), color: DOM_PALETTE[i % DOM_PALETTE.length] }; }).sort(function (a, b) { return b.value - a.value; });
    return { items: items, horizontal: true, metric: "Сила эффекта (1–10)", unit: "", padL: 150 };
  }
  function launchTimelineData(techs) {
    const groups = topDomainGroups(techs, 5), gi = {}; groups.forEach(function (g, i) { gi[g] = i; }); const other = groups.length; let uo = false;
    const evs = techs.slice(0, 20).map(function (t) { const r = U.rng("lt" + t.id); const y = 2016 + Math.floor(r() * 12); const g = domGroup(t); let lane = gi[g]; if (lane == null) { lane = other; uo = true; } return { year: y, label: techShort(t), color: St.layerColor(t.currentLayer), lane: lane, tip: [["Технология", t.name], ["Домен", t.domain]] }; });
    return { events: evs, yFrom: 2015, yTo: 2029, laneLabels: groups.concat(uo ? ["Другое"] : []) };
  }
  function regTimelineData(techs) {
    const groups = topDomainGroups(techs, 5), gi = {}; groups.forEach(function (g, i) { gi[g] = i; }); const other = groups.length; let uo = false;
    const evs = techs.slice(0, 16).map(function (t) { const r = U.rng("rt" + t.id); const y = 2024 + Math.floor(r() * 11); const g = domGroup(t); let lane = gi[g]; if (lane == null) { lane = other; uo = true; } return { year: y, label: "Рег.: " + techShort(t), color: St.layerColor(t.currentLayer), lane: lane, tip: [["Технология", t.name], ["Ожидаемое регулирование", y]] }; });
    return { events: evs, yFrom: 2024, yTo: 2036, laneLabels: groups.concat(uo ? ["Другое"] : []) };
  }

  // маршрутизация: по слою и названию визуализации — на соответствующий вопросу генератор
  function routeLayerViz(spec, ctx, techs) {
    if (!ctx || !ctx.layer) return null;
    const n = spec.name || "", ty = spec.type;
    if (ty === "graph" && /соавтор/i.test(n)) return VZ.graph(coauthorData(techs));
    if (ty === "graph" && /патент/i.test(n)) return VZ.graph(patentFamilyData(techs));
    if (ty === "heatmap" && /год/i.test(n)) return VZ.heatmap(themeYearData(techs));
    if (ty === "heatmap" && /IPC|патентн/i.test(n)) return VZ.heatmap(ipcYearData(techs));
    if (ty === "heatmap" && /(отрасл|сфера|трансформ)/i.test(n)) return VZ.heatmap(transformData(techs));
    if (ty === "sankey" && /грант/i.test(n)) return VZ.sankey(grantsSankeyData(techs));
    if (ty === "funnel" && /воспроизвод/i.test(n)) return VZ.funnel(reproFunnelData(techs));
    if (ty === "funnel" && /спрос/i.test(n)) return VZ.funnel(demandFunnelData(techs));
    if (ty === "bubble" && /публикац/i.test(n)) return VZ.bubble(topicsBubbleData(techs));
    if (ty === "bubble" && /финансиров/i.test(n)) return VZ.bubble(financeProbData(techs));
    if (ty === "bubble" && /TAM/i.test(n)) return VZ.bubble(tamBubbleData(techs));
    if (ty === "area" && /доля рынка/i.test(n)) return VZ.area(marketShareData(techs));
    if (ty === "bar" && /time-to-market/i.test(n)) return VZ.bar(ttmBarData(techs));
    if (ty === "bar" && /(социальн|эколог)/i.test(n)) return VZ.bar(effectsBarData(techs));
    if (ty === "timeline" && /регулятор/i.test(n)) return VZ.timeline(regTimelineData(techs));
    if (ty === "timeline" && /(запуск|IPO|продукт)/i.test(n)) return VZ.timeline(launchTimelineData(techs));
    return null;
  }
  function graphData(techs, spec) {
    const ids = {}; techs.forEach(function (t) { ids[t.id] = true; });
    let edges = St.data.edges.filter(function (e) { return ids[e.source] && ids[e.target]; });
    let useIds = {};
    if (edges.length < 3) { edges = St.data.edges; }
    edges.forEach(function (e) { useIds[e.source] = true; useIds[e.target] = true; });
    const nodes = Object.keys(useIds).map(function (id) {
      const t = St.tech(id), m = St.metrics(id);
      return { id: id, label: techShort(t), color: St.layerColor(t.currentLayer), r: 8 + m.conv * 1.8,
        tip: [["Технология", t.name], ["Домен", t.domain], ["Слой", St.layerLabel(t.currentLayer)], ["Конверг. связей", m.conv]] };
    });
    const links = edges.map(function (e) { return { source: e.source, target: e.target, weight: e.weight }; });
    return { nodes: nodes, links: links, showWeights: true, seed: (spec && spec.name) || "g", onPick: openTech };
  }
  function heatmapData(techs, spec) {
    const groups = topDomainGroups(techs, 8);
    const lids = ["S1", "S2", "S3", "S4", "S5", "S6"];
    const values = groups.map(function (g) {
      return lids.map(function (lid) { return techs.filter(function (t) { return domGroup(t) === g && t.byLayer && t.byLayer[lid]; }).length; });
    });
    return { rows: groups, cols: lids.map(St.layerTick.bind(St)), values: values, c1: "#141d33", c2: "#6ea8ff",
      metric: "Технологий (присутствие)", showVals: true, padL: 130,
      onCell: function (i, j) { const g = groups[i], lid = lids[j]; openTechList(g + " × " + St.layerLabel(lid), techs.filter(function (t) { return domGroup(t) === g && t.byLayer && t.byLayer[lid]; }), "Технологии домена с присутствием на слое"); } };
  }
  function bubbleData(techs, spec) {
    const points = techs.map(function (t) {
      const m = St.metrics(t.id);
      return { id: t.id, label: t.name, short: t.id.replace("T-", ""), x: m.tam, y: m.growth, r: 6 + Math.sqrt(m.invest) / 3.4,
        color: St.layerColor(t.currentLayer), tip: [["TAM, млрд $", m.tam], ["Темп роста, %", m.growth], ["Инвестиции, млн $", m.invest], ["Слой", t.currentLayer]] };
    });
    return { points: points, xLabel: "TAM / объём рынка, млрд $", yLabel: "Темп роста, %", labels: false, onPick: openTech };
  }
  // scatter зависит от разреза — оси соответствуют вопросу
  function scatterData(techs, spec, cut) {
    const cid = cut && cut.id;
    if (cid === "R03") return sleepingScatter(techs);
    if (cid === "R06") return deathValleyScatter(techs);
    if (cid === "R08") return citPatentScatter(techs);
    if (cid === "R13") return overheatScatter(techs);
    if (cid === "R16") return blindspotScatter(techs);
    // по умолчанию: время до прорыва × вероятность неуспеха
    const points = techs.map(function (t) {
      const m = St.metrics(t.id);
      return { id: t.id, label: t.name, x: m.ttm, y: Math.round(m.risk * 100), r: 5, color: St.layerColor(t.currentLayer),
        tip: [["Время до прорыва, лет", m.ttm], ["Вероятность неуспеха, %", Math.round(m.risk * 100)], ["Слой", St.layerLabel(t.currentLayer)]] };
    });
    return { points: points, xLabel: "Время до прорыва, лет", yLabel: "Вероятность неуспеха, %", yMax: 100, onPick: openTech };
  }
  function sleepingScatter(techs) {
    const points = techs.map(function (t) {
      const r = U.rng("sp" + t.id), year = 2005 + Math.floor(r() * 18), comm = Math.min(100, Math.round(St.layerOrder(t.currentLayer) * 13 + r() * 28));
      const sleeping = year < 2015 && comm < 45;
      return { id: t.id, label: t.name, x: year, y: comm, r: sleeping ? 7 : 5, color: sleeping ? "#f56b8b" : St.layerColor(t.currentLayer),
        tip: [["Год подачи", year], ["Коммерциализация, %", comm]].concat(sleeping ? ["⚠ спящий патент (старый + не коммерциализован)"] : []) };
    });
    return { points: points, xLabel: "Год подачи патента", yLabel: "Уровень коммерциализации, %", xMin: 2005, xMax: 2024, yMax: 100, onPick: openTech };
  }
  function deathValleyScatter(techs) {
    const points = techs.map(function (t) {
      const r = U.rng("dv" + t.id), stuck = 1 + Math.round(r() * 8);
      const bs = St.barriersFor(t.id), top = bs[0] || { color: St.layerColor(t.currentLayer), name: "—" };
      const sev = bs.reduce(function (a, b) { return a + b.severity; }, 0);
      return { id: t.id, label: t.name, x: stuck, y: sev, r: 6, color: top.color,
        tip: [["Время застревания, лет", stuck], ["Суммарная острота барьеров", sev], ["Главная причина", top.name]] };
    });
    return { points: points, xLabel: "Время застревания в S2, лет", yLabel: "Суммарная острота барьеров (Σ)", onPick: openTech };
  }
  function citPatentScatter(techs) {
    const points = techs.map(function (t) {
      const m = St.metrics(t.id);
      return { id: t.id, label: t.name, x: m.growth, y: m.patents, r: 6, color: St.layerColor(t.currentLayer),
        tip: [["Темп роста цитирований, %", m.growth], ["Смежные патенты, шт.", m.patents]] };
    });
    return { points: points, xLabel: "Темп роста цитирований, %", yLabel: "Смежные патенты, шт.", onPick: openTech };
  }
  function overheatScatter(techs) {
    const points = techs.map(function (t) {
      const m = St.metrics(t.id), fail = Math.round(m.hype * 100);
      return { id: t.id, label: t.name, x: m.invest, y: m.ttm, r: 5 + m.hype * 14, color: St.layerColor(t.currentLayer),
        tip: [["Инвестиции, млн $", m.invest], ["Время до прорыва, лет", m.ttm], ["Доля неудач, %", fail]] };
    });
    return { points: points, xLabel: "Инвестиции, млн $", yLabel: "Время до прорыва, лет", onPick: openTech };
  }
  function blindspotScatter(techs) {
    const points = techs.map(function (t) {
      const m = St.metrics(t.id), r = U.rng("bs" + t.id);
      const visibility = Math.round(Math.min(100, m.invest / 9 + r() * 30));
      const potential = Math.round(Math.min(100, 30 + m.conv * 8 + m.growth * 0.6));
      const blind = visibility < 45 && potential > 60;
      return { id: t.id, label: t.name, x: visibility, y: potential, r: blind ? 7 : 5, color: blind ? "#f2c14e" : St.layerColor(t.currentLayer),
        tip: [["Видимость для рынка, %", visibility], ["Потенциал, %", potential]].concat(blind ? ["⚠ слепая зона (высокий потенциал, низкая видимость)"] : []) };
    });
    return { points: points, xLabel: "Видимость для рынка, %", yLabel: "Потенциал, %", xMax: 100, yMax: 100, onPick: openTech };
  }
  function quadrantData(techs) {
    const points = techs.map(function (t) {
      const m = St.metrics(t.id);
      return { id: t.id, label: t.name, x: m.invest, y: m.growth, r: 6 + m.conv, color: St.layerColor(t.currentLayer),
        tip: [["Плотность капитала, млн $", m.invest], ["Скорость прогресса, %", m.growth]] };
    });
    return { points: points, xLabel: "Плотность капитала →", yLabel: "Скорость прогресса →",
      qLabels: [{ x: 0, y: 0, t: "Недоинвестировано" }, { x: 1, y: 0, t: "⚠ Зона перегрева" }, { x: 0, y: 1, t: "Тихие прорывы" }, { x: 1, y: 1, t: "Лидеры" }], onPick: openTech };
  }
  function lineData(techs, spec) {
    const groups = topDomainGroups(techs, 5);
    const series = groups.map(function (g) {
      const gt = techs.filter(function (t) { return domGroup(t) === g; });
      const base = gt.reduce(function (a, t) { return a + St.metrics(t.id).patents; }, 0) / Math.max(1, gt.length);
      const r = U.rng("ln" + g);
      let acc = base * 0.5;
      const vals = YEARS.map(function (y, i) { acc += base * (0.06 + r() * 0.14) * (1 + i * 0.08); return Math.round(acc); });
      return { name: g, color: domColor(g, groups), values: vals };
    });
    return { series: series, xLabels: YEARS, area: false, yLabel: "Патентная активность (накопл.)", unit: "" };
  }
  function areaData(techs) {
    const groups = topDomainGroups(techs, 5);
    const series = groups.map(function (g) {
      const r = U.rng("ar" + g); let v = U.pick(r, 6, 22);
      const vals = YEARS.map(function () { v = Math.max(2, v + U.pick(r, -2, 5)); return v; });
      return { name: g, color: domColor(g, groups), values: vals };
    });
    return { series: series, xLabels: YEARS, yLabel: "Доля рынка / выручка (усл. ед.)", unit: "" };
  }
  function barData(techs, spec) {
    const groups = topDomainGroups(techs, 9);
    const items = groups.map(function (g) {
      return { label: g, value: techs.filter(function (t) { return domGroup(t) === g; }).length, color: domColor(g, groups), _g: g };
    }).sort(function (a, b) { return b.value - a.value; });
    return { items: items, horizontal: true, metric: "Технологий", unit: " шт.", padL: 150,
      onPick: function (d) { openTechList("Домен: " + d._g, techs.filter(function (t) { return domGroup(t) === d._g; }), "Технологии домена"); } };
  }
  function barrierBarData(techs) {
    const agg = St.barrierAggregate(techs);
    return { items: agg.map(function (b) { return { label: b.name, value: b.value, color: b.color, _bid: b.id }; }),
      horizontal: true, metric: "Суммарное значение", unit: "", padL: 170,
      onPick: function (d) { openTechList("Барьер: " + d.label, techs.filter(function (t) { return St.barriersFor(t.id).some(function (x) { return x.id === d._bid; }); }), "Технологии с этим барьером"); } };
  }
  function waterfallData(techs) {
    const r = U.rng("wf" + techs.length);
    return { items: [
      { label: "Базовый рынок", value: 100 },
      { label: "Комплементарные рынки", value: U.pick(r, 30, 70) },
      { label: "Конвергентный спрос", value: U.pick(r, 25, 60) },
      { label: "Каскадные эффекты", value: U.pick(r, 20, 50) },
      { label: "Регуляторный демпфер", value: -U.pick(r, 10, 30) },
    ], totalLabel: "Мультипликатор", unit: "" };
  }
  function radarData(techs) {
    const lids = ["S1", "S2", "S3", "S4", "S5", "S6"];
    const max = Math.max.apply(null, lids.map(function (lid) { return techs.filter(function (t) { return t.byLayer && t.byLayer[lid]; }).length; })) || 1;
    return { axes: lids.map(St.layerTick.bind(St)), max: max, series: [
      { name: "Присутствие технологий", color: "#6ea8ff", values: lids.map(function (lid) { return techs.filter(function (t) { return t.byLayer && t.byLayer[lid]; }).length; }) },
      { name: "Критичность компетенций", color: "#f2c14e", values: lids.map(function (lid, i) { return Math.round((max) * (0.4 + 0.1 * i) * (1 - i * 0.02)); }) },
    ] };
  }
  // хорд дрейфа: ленты = технологии, работающие на стыке двух отраслей (мультидоменные + конвергентные связи)
  function chordData(techs) {
    const groups = topDomainGroups(techs, 6);
    const gi = {}; groups.forEach(function (g, i) { gi[g] = i; });
    const M = groups.map(function () { return groups.map(function () { return 0; }); });
    const cell = {}; // "i-j" -> Set技technologies ids
    function add(a, b, id) {
      if (gi[a] == null || gi[b] == null || a === b) return;
      M[gi[a]][gi[b]] += 1; M[gi[b]][gi[a]] += 1;
      const k = [gi[a], gi[b]].sort(function (x, y) { return x - y; }).join("-");
      cell[k] = cell[k] || {}; cell[k][id] = true;
    }
    // 1) мультидоменные технологии (домен «A/B») — дрейфуют между отраслями
    techs.forEach(function (t) { const segs = t.domain.split("/").map(function (s) { return s.trim(); }); for (let a = 0; a < segs.length; a++) for (let b = a + 1; b < segs.length; b++) add(segs[a], segs[b], t.id); });
    // 2) конвергентные/дрейфовые связи между технологиями разных отраслей
    St.data.edges.forEach(function (e) { const A = St.tech(e.source), B = St.tech(e.target); if (A && B) add(domGroup(A), domGroup(B), A.id); });
    return { labels: groups, matrix: M, colors: groups.map(function (g) { return domColor(g, groups); }),
      ribbonMetric: "Технологий на стыке", arcMetric: "Дрейфов",
      onRibbon: function (i, j) {
        const k = [i, j].sort(function (x, y) { return x - y; }).join("-");
        const ids = Object.keys(cell[k] || {});
        openTechList("Дрейф: " + groups[i] + " ↔ " + groups[j], ids.map(function (id) { return St.tech(id); }).filter(Boolean), "Технологии, работающие на стыке этих отраслей");
      } };
  }
  function treeData(techs, spec) {
    // корень — технология с наибольшим числом конвергентных связей внутри набора
    let hub = null, best = -1;
    techs.forEach(function (t) { const c = (St.data.convNeighbors[t.id] || []).length; if (c > best) { best = c; hub = t; } });
    if (!hub) hub = St.tech("T-GENAI");
    const seen = { [hub.id]: true };
    function kids(id, depth) {
      if (depth > 2) return [];
      return (St.data.convNeighbors[id] || []).filter(function (n) { return !seen[n]; }).slice(0, depth === 0 ? 4 : 2).map(function (n) {
        seen[n] = true; const t = St.tech(n);
        return { name: techShort(t), color: St.layerColor(t.currentLayer), note: t.name + " · " + t.domain + " · " + St.layerLabel(t.currentLayer), children: kids(n, depth + 1) };
      });
    }
    return { root: { name: techShort(hub), color: St.layerColor(hub.currentLayer), note: hub.name + " · " + hub.domain, children: kids(hub.id, 0) } };
  }
  function timelineData(techs) {
    // проекция ожидаемой коммерциализации: слой → год (форсайт)
    const yearByLayer = { S1: 2044, S2: 2039, S3: 2034, S4: 2030, S5: 2027, S6: 2025 };
    const groups = topDomainGroups(techs, 5);
    const gi = {}; groups.forEach(function (g, i) { gi[g] = i; });
    const otherLane = groups.length; let usedOther = false;
    const evs = techs.slice(0, 22).map(function (t) {
      const r = U.rng("tl" + t.id);
      const y = (yearByLayer[t.currentLayer] || 2035) + U.pick(r, -1, 2);
      const g = domGroup(t);
      let lane = gi[g]; if (lane == null) { lane = otherLane; usedOther = true; }
      return { year: y, label: techShort(t), color: St.layerColor(t.currentLayer), lane: lane,
        tip: [["Технология", t.name], ["Домен", t.domain], ["Слой", St.layerLabel(t.currentLayer)]] };
    });
    return { events: evs, yFrom: 2024, yTo: 2046, laneLabels: groups.concat(usedOther ? ["Другое"] : []) };
  }
  function radialData(techs) {
    return { rings: [
      { label: "Возможности (микро)", color: "#f2c14e", items: techs.filter(function (t) { return t.currentLayer === "S1" || t.currentLayer === "S2"; }).slice(0, 8).map(function (t) { return t.name; }) },
      { label: "Сигналы (мезо)", color: "#35c9a6", items: techs.filter(function (t) { return t.currentLayer === "S3" || t.currentLayer === "S4"; }).slice(0, 8).map(function (t) { return t.name; }) },
      { label: "Тренды (макро)", color: "#6ea8ff", items: techs.filter(function (t) { return t.currentLayer === "S5"; }).slice(0, 6).map(function (t) { return t.name; }) },
      { label: "Системные изменения (глобал)", color: "#f56b8b", items: techs.filter(function (t) { return t.currentLayer === "S6"; }).map(function (t) { return t.name; }) },
    ] };
  }
  function fanData() {
    const X = ["2026", "2030", "2035", "2040", "2045", "2050"];
    return { xLabels: X, splitAt: 1, scenarios: [
      { name: "Ускорение", color: "#35c9a6", points: [10, 22, 45, 78, 120, 175] },
      { name: "База", color: "#6ea8ff", points: [10, 20, 34, 52, 74, 98] },
      { name: "Фрагментация", color: "#f2c14e", points: [10, 18, 26, 36, 46, 58], dash: "6 4" },
      { name: "Стагнация", color: "#f56b8b", points: [10, 15, 19, 23, 27, 30], dash: "2 4" },
    ] };
  }
  function loopData(spec) {
    return { nodes: [
      { id: "adopt", label: "Внедрение", color: "#6ea8ff44" },
      { id: "scale", label: "Масштаб / эффект", color: "#35c9a644" },
      { id: "cost", label: "Себестоимость", color: "#f2c14e44" },
      { id: "reg", label: "Регуляция", color: "#f56b8b44" },
      { id: "limit", label: "Самоограничение", color: "#f0894e44" },
    ], edges: [
      { from: "adopt", to: "scale", sign: "+" },
      { from: "scale", to: "cost", sign: "-" },
      { from: "cost", to: "adopt", sign: "+" },
      { from: "scale", to: "reg", sign: "+" },
      { from: "reg", to: "limit", sign: "+" },
      { from: "limit", to: "adopt", sign: "-" },
    ], loops: ["R — усиливающая петля: внедрение → масштаб → ↓себестоимость → внедрение", "B — балансирующая: масштаб → регуляция → самоограничение → ↓внедрение"] };
  }
  function geoData(techs) {
    const groups = topDomainGroups(techs, 9);
    return { points: groups.map(function (g, i) {
      const r = U.rng("geo" + g);
      return { x: 0.1 + r() * 0.8, y: 0.15 + r() * 0.7, label: g, value: techs.filter(function (t) { return domGroup(t) === g; }).length, color: domColor(g, groups) };
    }), metric: "Технологий / плотность", unit: "" };
  }
  function tornadoData() {
    return { items: [
      { label: "Регуляторная политика", low: -60, high: 45 },
      { label: "Доступ к капиталу", low: -40, high: 55 },
      { label: "Смежный техпрогресс", low: -25, high: 50 },
      { label: "Общественное восприятие", low: -35, high: 30 },
      { label: "Климат / ресурсы", low: -30, high: 25 },
    ] };
  }
  function tableData(techs, spec) {
    const rows = techs.map(function (t) { return { t: t, m: St.metrics(t.id) }; })
      .sort(function (a, b) { return b.m.growth - a.m.growth; }).slice(0, 12);
    const wrap = U.el("div", { class: "tbl-wrap" });
    const tbl = U.el("table", { class: "tbl" });
    tbl.appendChild(U.el("thead", {}, U.el("tr", {}, [
      U.el("th", { text: "#" }), U.el("th", { text: "Технология" }), U.el("th", { text: "Слой" }),
      U.el("th", { text: "Ранний сигнал (рост, %)" }), U.el("th", { text: "Цитируемость" }), U.el("th", { text: "Потенциал" }),
    ])));
    const tb = U.el("tbody");
    rows.forEach(function (row, i) {
      const t = row.t, m = row.m, score = Math.min(99, Math.round(m.growth + m.conv * 4 + (7 - St.layerOrder(t.currentLayer)) * 3));
      tb.appendChild(U.el("tr", { onclick: function () { openTech(t.id); } }, [
        U.el("td", { class: "mono muted", text: i + 1 }),
        U.el("td", {}, U.el("span", { class: "nm", text: t.name })),
        U.el("td", {}, layerBadge(t.currentLayer)),
        U.el("td", { class: "mono", text: "+" + m.growth }),
        U.el("td", { class: "mono", text: m.citations }),
        U.el("td", {}, U.el("span", { class: "mono", style: "color:var(--good)", text: score })),
      ]));
    });
    tbl.appendChild(tb); wrap.appendChild(tbl); return wrap;
  }

  /* ============================ Пояснения к визуализациям ============================ */
  const VIZ_INFO = {
    funnel: { d: "Высота столбца — число технологий, присутствующих на слое. Ширина потока — движение технологий на следующий слой.", e: [["ось Y", "технологии, шт."], ["поток", "переходы S(n)→S(n+1)"]], l: "layer" },
    sankey: { d: "Трёхчастный поток: <b>домен → слой зрелости → ключевая аудитория</b>. Толщина ленты — число технологий на маршруте.", e: [["толщина ленты", "технологии, шт."], ["колонки", "домен · слой · аудитория"]], l: "layer" },
    graph: { d: "Узлы — технологии, рёбра — конвергентная синергия. Клик по узлу открывает карточку с подтверждающими артефактами.", e: [["цвет узла", "слой зрелости"], ["размер узла", "число конверг. связей"], ["толщина ребра", "сила синергии 0–1"]], l: "layer", i: true },
    heatmap: { d: "Цвет и число в ячейке — значение показателя на пересечении строки и столбца. Наведите для подробностей.", e: [["цвет ячейки", "интенсивность / кол-во"]], l: null },
    bubble: { d: "Каждый пузырёк — технология. Клик — карточка с артефактами, подтверждающими стадию.", e: [["ось X", "TAM, млрд $"], ["ось Y", "темп роста, %"], ["размер", "инвестиции, млн $"], ["цвет", "слой"]], l: "layer", i: true },
    scatter: { d: "Каждая точка — технология. Клик — карточка технологии.", e: [["ось X", "время до прорыва, лет"], ["ось Y", "риск, %"], ["цвет", "слой"]], l: "layer", i: true },
    quadrant: { d: "Матрица квадрантов. Правый-нижний — зона перегрева (много капитала, мало прогресса); правый-верхний — лидеры.", e: [["ось X", "плотность капитала, млн $"], ["ось Y", "скорость прогресса, %"], ["цвет", "слой"]], l: "layer", i: true },
    line: { d: "Накопленная патентная активность по доменам, 2019–2026 (усл. индекс). Наведите на точку для значения.", e: [["ось Y", "патенты, накопл."], ["цвет линии", "домен"]], l: null, i: true },
    area: { d: "Доля рынка / выручка по доменам с накоплением (stacked, усл. ед.).", e: [["ось Y", "доля/выручка, усл."], ["цвет", "домен"]], l: null, i: true },
    bar: { d: "Число технологий по доменам (длина полосы).", e: [["длина полосы", "технологии, шт."]], l: null, i: true },
    barrier: { d: "Барьеры перехода на следующий слой: суммарное значение (Σ по шкале 1–5) по типам для технологий набора.", e: [["длина полосы", "Σ значение барьера"]], l: "barrier", i: true },
    waterfall: { d: "Разложение мультипликативного эффекта: вклад каждого источника (усл. ед., базовый рынок = 100).", e: [["высота", "вклад, усл."], ["зелёный / красный", "рост / демпфер"]], l: null, i: true },
    tornado: { d: "Чувствительность траектории к факторам: диапазон отклонения (%) в негативном (красный) и позитивном (зелёный) сценарии.", e: [["длина", "отклонение, %"]], l: null, i: true },
    radar: { d: "Профиль по слоям 1–6 набора технологий.", e: [["радиус", "значение по оси"]], l: [["#6ea8ff", "Присутствие технологий, шт."], ["#f2c14e", "Критичность компетенций"]], i: true },
    chord: { d: "Дуги — отрасли; ленты — <b>технологии, работающие на стыке двух отраслей</b> (дрейф и конвергентные связи). Толщина ленты — число таких технологий. Клик по ленте — список технологий.", e: [["дуга", "отрасль"], ["лента", "технологии на стыке"], ["толщина", "число технологий"]], l: null, i: true },
    tree: { d: "Каскад от технологии-хаба к связанным технологиям (2 уровня). Цвет узла — слой.", e: [["узлы", "технологии"], ["цвет", "слой"]], l: "layer", i: true },
    timeline: { d: "Ожидаемый год коммерциализации (форсайт-проекция от текущего слоя); дорожки — домены.", e: [["ось X", "год, 2024–2046"], ["дорожки", "домены"], ["цвет", "слой"]], l: "layer", i: true },
    radial: { d: "Масштабы эффектов от микро к глобальному; точки на кольцах — технологии соответствующей зрелости.", e: [["кольца", "микро → мезо → макро → глобал"]], l: null, i: true },
    fan: { d: "Веер сценарных траекторий до 2050 с точкой расхождения (усл. индекс масштаба эффекта).", e: [["ось Y", "масштаб эффекта, усл."], ["линии", "сценарии"]], l: null },
    loop: { d: "Причинно-петлевые обратные связи. «+» — усиливающая связь, «−» — балансирующая (см. петли R/B под графиком).", e: [["зелёная стрелка", "+ усиление"], ["красная стрелка", "− торможение"]], l: null },
    geo: { d: "Абстрактная гео-карта плотности: размер круга — число технологий по домену.", e: [["размер круга", "технологии, шт."], ["цвет", "домен"]], l: null, i: true },
    table: { d: "Рейтинг по раннему сигналу (темп роста цитирований + связи + зрелость). Клик по строке — карточка.", e: [], l: null, i: true },
    substitution: { d: "Доля рынка (%) во времени: <b>зелёная область</b> — технология-вытеснитель, <b>красная</b> — вытесняемая (инкумбент). Пунктир — точка каннибализации (50/50).", e: [["ось Y", "доля рынка, %"], ["ось X", "год"], ["зелёная область", "вытеснитель"], ["красная область", "инкумбент"]], l: null, i: true },
  };
  // переопределения пояснения для санки в зависимости от разреза
  const SANKEY_BY_CUT = {
    R01: { d: "Перераспределение добавленной стоимости: <b>Труд / Капитал → секторы</b>. Толщина ленты — объём, млрд $.", e: [["толщина ленты", "млрд $"], ["колонки", "фактор → сектор"]], l: null },
    R02: { d: "Потоки капитала по слоям зрелости <b>S1→S5</b>. Толщина ленты — накопленные инвестиции, млрд $.", e: [["толщина ленты", "инвестиции, млрд $"], ["колонки", "слои 1→5"]], l: "layer" },
    R05: { d: "Миграция специалистов между отраслями. Толщина ленты — численность, тыс. чел.", e: [["толщина ленты", "тыс. чел."], ["колонки", "отрасль-источник → отрасль-приёмник"]], l: null },
  };
  const SCATTER_BY_CUT = {
    R03: { d: "Точка — технология и её ключевой патент. <b>Красные — «спящие»</b>: поданы давно, но слабо коммерциализованы. Клик — карточка.", e: [["ось X", "год подачи патента"], ["ось Y", "уровень коммерциализации, %"], ["красные", "спящие патенты"]] },
    R06: { d: "Точка — технология в «долине смерти». <b>Цвет — главная причина</b> застревания (тип барьера).", e: [["ось X", "время застревания, лет"], ["ось Y", "суммарная острота барьеров"], ["цвет", "главная причина"]], l: "barrier" },
    R08: { d: "Точка — гипотеза/технология. <b>Правый-верхний угол</b> — высокий рост цитирований и много смежных патентов (лучшие кандидаты).", e: [["ось X", "темп роста цитирований, %"], ["ось Y", "смежные патенты, шт."]] },
    R13: { d: "Точка — технология; <b>размер — доля неудач</b>. Крупные точки справа-сверху (много денег, долго до прорыва) — риск перегрева/тупика.", e: [["ось X", "инвестиции, млн $"], ["ось Y", "время до прорыва, лет"], ["размер", "доля неудач, %"]] },
    R16: { d: "Точка — технология. <b>Жёлтые в левом-верхнем углу</b> — слепые зоны (высокий потенциал, низкая видимость).", e: [["ось X", "видимость для рынка, %"], ["ось Y", "потенциал, %"], ["жёлтые", "слепые зоны"]] },
  };
  // пояснения для переосмысленных визуализаций слоёв (по названию + типу)
  const NAMED_CAPTION = [
    { t: "graph", re: /соавтор/i, d: "Сеть соавторства: узлы — институты, рёбра — совместные публикации. Размер узла — число публикаций; клик по узлу — технологии института.", e: [["узел", "институт"], ["размер", "публикаций"], ["ребро", "совместные работы"]] },
    { t: "graph", re: /патент/i, d: "Патентные семьи: узлы — заявители, рёбра — общие патентные семьи/классы. Размер — число патентов; клик — технологии заявителя.", e: [["узел", "заявитель"], ["размер", "патентов"], ["ребро", "общие семьи"]] },
    { t: "heatmap", re: /год/i, d: "Публикации по темам и годам: строки — темы, столбцы — годы, цвет и число — количество публикаций.", e: [["строки", "темы"], ["столбцы", "год"], ["цвет", "публикаций"]] },
    { t: "heatmap", re: /IPC|патентн/i, d: "Патентная активность: строки — классы IPC, столбцы — годы, цвет — число патентов.", e: [["строки", "класс IPC"], ["столбцы", "год"], ["цвет", "патентов"]] },
    { t: "heatmap", re: /отрасл|сфера|трансформ/i, d: "Сила эффекта/трансформации по сферам и горизонтам (1–10).", e: [["строки", "сфера/отрасль"], ["столбцы", "горизонт"], ["цвет", "сила"]] },
    { t: "sankey", re: /грант/i, d: "Поток: фонды → лаборатории → PoC. Толщина ленты — число проектов; клик по узлу — технологии.", e: [["толщина", "проектов"], ["колонки", "фонд → лаборатория → PoC"]] },
    { t: "funnel", re: /воспроизвод/i, d: "Воронка воспроизводимости: от PoC к независимому воспроизведению и переходу в S3. Разрыв между ступенями — застрявшие.", e: [["высота", "число проектов"]] },
    { t: "funnel", re: /спрос/i, d: "Воронка спроса: от ранних заказчиков к устойчивому платёжеспособному спросу и переходу в продукт.", e: [["высота", "число заказов/технологий"]] },
    { t: "bubble", re: /публикац/i, d: "Темы: X — объём публикаций (цитируемость), Y — темп роста цитирований, размер — патентная активность.", e: [["ось X", "цитируемость"], ["ось Y", "рост, %"], ["размер", "патенты"]] },
    { t: "bubble", re: /финансиров/i, d: "Технологии: X — объём финансирования, Y — вероятность перехода на следующий слой.", e: [["ось X", "финансирование, млн $"], ["ось Y", "вероятность, %"]] },
    { t: "bubble", re: /TAM/i, d: "Технологии: X — TAM, Y — темп раундов, размер — SAM.", e: [["ось X", "TAM, млрд $"], ["ось Y", "раундов"], ["размер", "SAM"]] },
    { t: "area", re: /доля рынка/i, d: "Доля рынка по компаниям во времени (накопление, усл. ед.).", e: [["ось Y", "доля/выручка"], ["цвет", "компания"]] },
    { t: "bar", re: /time-to-market/i, d: "Среднее время от появления спроса до выхода продукта по категориям.", e: [["длина полосы", "лет"]] },
    { t: "bar", re: /социальн|эколог/i, d: "Сила социально-экологических эффектов по сферам жизни (1–10).", e: [["длина полосы", "сила эффекта"]] },
    { t: "timeline", re: /регулятор/i, d: "Ожидаемые регуляторные изменения по годам; дорожки — отрасли.", e: [["ось X", "год"], ["дорожки", "отрасли"]] },
    { t: "timeline", re: /запуск|IPO/i, d: "Запуски продуктов и сделки IPO по годам; дорожки — домены.", e: [["ось X", "год"], ["дорожки", "домены"]] },
  ];
  function namedCaption(spec) {
    for (let i = 0; i < NAMED_CAPTION.length; i++) { const c = NAMED_CAPTION[i]; if (c.t === spec.type && c.re.test(spec.name || "")) return { d: c.d, e: c.e, l: null, i: true }; }
    return null;
  }
  function captionFor(spec, ctx) {
    const isB = spec.type === "bar" && isBarrierSpec(spec.name);
    let info = isB ? VIZ_INFO.barrier : (namedCaption(spec) || VIZ_INFO[spec.type] || { d: "", e: [], l: null });
    if (spec.type === "sankey" && ctx && ctx.cut && SANKEY_BY_CUT[ctx.cut.id]) info = Object.assign({ i: true }, SANKEY_BY_CUT[ctx.cut.id]);
    if (spec.type === "scatter" && ctx && ctx.cut && SCATTER_BY_CUT[ctx.cut.id]) info = Object.assign({ i: true }, SCATTER_BY_CUT[ctx.cut.id]);
    const cap = U.el("div", { class: "viz-caption" });
    if (info.e && info.e.length) {
      cap.appendChild(U.el("div", { class: "enc" }, info.e.map(function (p) {
        return U.el("span", { class: "e" }, [U.el("b", { text: p[0] }), U.el("span", { text: p[1] })]);
      })));
    }
    if (info.d) cap.appendChild(U.el("div", { class: "desc", html: info.d }));
    if (info.i) {
      var click = /graph|bubble|scatter|quadrant|tree|table|timeline/.test(spec.type) ? " · клик открывает карточку технологии"
        : (/funnel|bar|heatmap|sankey/.test(spec.type) ? " · клик по элементу — список технологий" : "");
      cap.appendChild(U.el("div", { class: "viz-hint", text: "Наведите на элементы для точных значений" + click }));
    }
    if (info.l === "layer") cap.appendChild(legendLayers());
    else if (info.l === "barrier") cap.appendChild(legendBarriers());
    else if (Array.isArray(info.l)) cap.appendChild(U.el("div", { class: "legend" }, info.l.map(function (p) {
      return U.el("span", { class: "it" }, [U.el("span", { class: "sw line", style: "background:" + p[0] }), p[1]]);
    })));
    return cap;
  }
  function legendBarriers() {
    return U.el("div", { class: "legend" }, St.barrierTypes.map(function (b) {
      return U.el("span", { class: "it" }, [U.el("span", { class: "sw", style: "background:" + b.color }), b.name]);
    }));
  }
  // виз-шелл с заголовком, телом и пояснением (для отдельных графиков вне vizPanel)
  function vizShell(title, spec, ctx, hint) {
    const shell = U.el("div", { class: "viz-shell" });
    shell.appendChild(U.el("div", { class: "viz-head" }, [
      U.el("span", { class: "vt", text: title }), U.el("span", { class: "vtype", text: spec.type }),
      U.spacer(), hint ? U.el("span", { class: "small muted", text: hint }) : null,
    ]));
    const body = U.el("div", { class: "viz-body" });
    const node = buildViz(spec, ctx || { techs: St.data.techs });
    if (node && node.tagName === "svg") body.appendChild(node); else { body.classList.add("pad"); body.appendChild(node); }
    shell.appendChild(body);
    shell.appendChild(captionFor(spec, ctx));
    return shell;
  }

  /* ============================ Панель переключаемых визуализаций ============================ */
  function vizPanel(specs, kind, key, ctx) {
    const wrap = U.el("div", { class: "vizpanel" });
    // порядок с учётом выбранной аудитории (акценты вперёд)
    const aud = St.state.audience;
    let order = specs.map(function (s, i) { return i; });
    if (aud) order.sort(function (a, b) { return (specs[b].audience === aud) - (specs[a].audience === aud); });
    const saved = (kind === "layer" ? St.state.layerViz[key] : St.state.cutViz[key]);
    let sel = saved != null ? saved : order[0];
    if (order.indexOf(sel) < 0) sel = order[0];

    const switcher = U.el("div", { class: "viz-switch" });
    const shell = U.el("div", { class: "viz-shell" });

    function draw() {
      U.$$(".viz-tab", switcher).forEach(function (b, k) { b.classList.toggle("on", order[k] === sel); });
      U.clear(shell);
      const spec = specs[sel];
      const head = U.el("div", { class: "viz-head" }, [
        U.el("span", { class: "vt", text: spec.name }),
        U.el("span", { class: "vtype", text: spec.type }),
        U.spacer(),
        U.el("span", { class: "va small", style: "display:inline-flex;align-items:center;gap:6px;color:var(--text-3)" }, [
          U.el("span", { text: "для: " }), audBadge(spec.audience),
        ]),
      ]);
      shell.appendChild(head);
      const bodyc = U.el("div", { class: "viz-body" });
      const node = buildViz(spec, ctx);
      if (node && node.tagName === "svg") bodyc.appendChild(node);
      else { bodyc.classList.add("pad"); bodyc.appendChild(node); }
      shell.appendChild(bodyc);
      shell.appendChild(captionFor(spec, ctx));
    }

    function selectIdx(idx) { sel = idx; if (kind === "layer") St.setLayerViz(key, idx); else St.setCutViz(key, idx); draw(); }
    order.forEach(function (idx) {
      const s = specs[idx];
      const btn = U.el("button", { class: "viz-tab", dataset: { specIndex: idx }, onclick: function () { selectIdx(idx); } }, [
        U.el("span", { class: "vn", text: s.name }),
        U.el("span", { class: "va" }, [U.el("span", { class: "d", style: "background:" + St.audColor(s.audience) }), St.audName(s.audience).split(" ")[0]]),
      ]);
      switcher.appendChild(btn);
    });
    wrap.appendChild(switcher); wrap.appendChild(shell); draw();
    // программный выбор визуализации по индексу спецификации (для перехода из ответов)
    wrap._select = function (idx) {
      if (idx == null || idx < 0) return;
      selectIdx(idx);
      requestAnimationFrame(function () {
        shell.scrollIntoView({ behavior: "smooth", block: "start" });
        shell.classList.add("viz-flash");
        setTimeout(function () { shell.classList.remove("viz-flash"); }, 1200);
      });
    };
    return wrap;
  }
  // индекс визуализации разреза, наиболее соответствующей строке-ссылке ответа
  function matchVizIndex(name, specs) {
    const norm = function (s) { return String(s || "").toLowerCase().replace(/[«»"'(),.:×—–\-]/g, " ").replace(/\s+/g, " ").trim(); };
    const tgt = norm(name), toks = tgt.split(" ").filter(function (w) { return w.length > 3; });
    let best = -1, bestScore = 0;
    specs.forEach(function (s, i) {
      const sn = norm(s.name); let score = 0;
      toks.forEach(function (w) { if (sn.indexOf(w) >= 0) score++; });
      if (sn && (sn.indexOf(tgt) >= 0 || tgt.indexOf(sn) >= 0)) score += 5;
      if (score > bestScore) { bestScore = score; best = i; }
    });
    return bestScore > 0 ? best : -1;
  }

  /* ============================ Спец-аналитика S6: форсайт STEEPV ============================ */
  function worldSteepvSection() {
    const sec = U.el("div", { class: "section" });
    sec.appendChild(sectionHead("Как меняется мир — форсайт STEEPV",
      "Конкретные тезисы: какие изменения и в какие годы возможны благодаря каким технологиям. STEEPV — социальные, технологические, экономические, экологические, политические, ценностные."));
    // роадмап-таймлайн (дорожки — оси STEEPV)
    const events = [], laneLabels = [];
    window.WORLD_STEEPV.forEach(function (ax, i) {
      laneLabels.push(ax.code + " " + ax.short);
      ax.theses.forEach(function (th) {
        events.push({ year: th.year, label: th.short, color: ax.color, lane: i,
          tip: [["Тезис", th.title], ["Технологии", th.techs.map(function (id) { const t = St.tech(id); return t ? techShort(t) : id; }).join(", ")]] });
      });
    });
    const shell = U.el("div", { class: "viz-shell" });
    shell.appendChild(U.el("div", { class: "viz-head" }, [
      U.el("span", { class: "vt", text: "Роадмап изменений мира (STEEPV × горизонт)" }),
      U.el("span", { class: "vtype", text: "timeline" }), U.spacer(),
      U.el("span", { class: "small muted", text: "наведите на точку — тезис и технологии" }),
    ]));
    shell.appendChild(U.el("div", { class: "viz-body" }, VZ.timeline({ events: events, yFrom: 2029, yTo: 2051, laneLabels: laneLabels })));
    shell.appendChild(U.el("div", { class: "legend" }, window.WORLD_STEEPV.map(function (ax) {
      return U.el("span", { class: "it" }, [U.el("span", { class: "sw", style: "background:" + ax.color }), ax.code + " · " + ax.axis]);
    })));
    sec.appendChild(shell);
    // карточки тезисов по осям
    const grid = U.el("div", { class: "grid cols-2", style: "margin-top:16px" });
    window.WORLD_STEEPV.forEach(function (ax) {
      const card = U.el("div", { class: "card", style: "border-top:3px solid " + ax.color });
      card.appendChild(U.el("div", { class: "row", style: "gap:10px;align-items:center;margin-bottom:12px" }, [
        U.el("span", { class: "steepv-code", style: "background:" + ax.color, text: ax.code }),
        U.el("h3", { text: ax.axis, style: "font-size:16px" }),
      ]));
      ax.theses.forEach(function (th) {
        const chips = U.el("div", { class: "chips-row", style: "margin-top:8px" });
        th.techs.forEach(function (id) { const t = St.tech(id); if (t) chips.appendChild(U.el("button", { class: "chip click", onclick: function () { openTech(id); } }, [U.el("span", { class: "dot", style: "background:" + St.layerColor(t.currentLayer) }), t.name])); });
        card.appendChild(U.el("div", { class: "steepv-thesis" }, [
          U.el("div", { class: "row", style: "gap:8px;align-items:baseline" }, [
            U.el("span", { class: "year-badge", style: "color:" + ax.color + ";border-color:" + ax.color, text: th.year }),
            U.el("div", { class: "steepv-title", text: th.title }),
          ]),
          U.el("div", { class: "steepv-desc", text: th.desc }),
          chips,
        ]));
      });
      grid.appendChild(card);
    });
    sec.appendChild(grid);
    return sec;
  }

  /* ============================ ВКЛАДКА: Обзор / Карта эволюции ============================ */
  Tabs.overview = function (panel) {
    const aud = St.state.audience;
    const intro = U.el("div", { class: "tab-intro" }, [
      U.el("div", { class: "kicker" }, ["● Обзор", U.el("span", { text: "карта эволюции" })]),
      U.el("h2", { text: "Как технологии движутся от гипотезы к изменению мира?" }),
      U.el("div", { class: "lead", text: "Шестислойная модель зрелости S1→S6: конвейер технологий, потоки между слоями и траектории отдельных технологий на горизонте до 2050." }),
    ]);
    panel.appendChild(intro);

    // счётчики
    const totalLinks = St.data.techs.reduce(function (a, t) { return a + (t.links || []).length; }, 0);
    const counters = U.el("div", { class: "counters" }, [
      counter(St.data.techs.length, "технологий в наборе", "6 слоёв зрелости"),
      counter(St.data.edges.length, "рёбер конвергенции", "ландшафт синергий"),
      counter(totalLinks, "связей между технологиями", "5 типов связей"),
      counter(St.data.domains.length, "доменов", "ИКТ, энергетика, биотех, космос…"),
      counter(St.data.cuts.length, "аналитических разрезов", "сквозные темы"),
    ]);
    panel.appendChild(counters);

    // конвейер S1→S6
    const funnelSection = U.el("div", { class: "section" }, [
      sectionHead("Конвейер технологической эволюции", "Ширина потока — движение технологий между слоями. Клик по слою — переход на вкладку слоя."),
    ]);
    const fshell = U.el("div", { class: "viz-shell" });
    fshell.appendChild(U.el("div", { class: "viz-body" }, VZ.funnel(funnelData(St.data.techs, { _pick: function (lid) { App.go(lid); } }))));
    fshell.appendChild(captionFor({ type: "funnel", name: "Конвейер" }));
    funnelSection.appendChild(fshell);
    panel.appendChild(funnelSection);

    // ландшафт конвергенции + распределение по доменам
    const two = U.el("div", { class: "section panel-2col" });
    two.appendChild(vizShell("Ландшафт конвергенции", { type: "graph", name: "landscape" }, { techs: St.data.techs }, "клик по узлу → карточка"));
    two.appendChild(vizShell("Распределение по доменам", { type: "bar", name: "домены" }, { techs: St.data.techs }));
    panel.appendChild(two);

    // траектория технологии
    const trajSec = U.el("div", { class: "section" });
    trajSec.appendChild(sectionHead("Траектория технологии по слоям", "Выберите технологию, чтобы увидеть её присутствие и застревание."));
    const pick = U.el("select", { class: "select-ctl", style: "min-width:280px", onchange: function () { renderTraj(this.value); } });
    St.data.techs.slice().sort(function (a, b) { return a.name.localeCompare(b.name, "ru"); }).forEach(function (t) {
      pick.appendChild(U.el("option", { value: t.id, text: t.name + " (" + t.currentLayer + ")" }));
    });
    const trajBox = U.el("div", { class: "card", style: "margin-top:12px" });
    trajSec.appendChild(U.el("div", { class: "traj-pick" }, [U.el("span", { class: "small muted", text: "Технология:" }), pick]));
    trajSec.appendChild(trajBox);
    panel.appendChild(trajSec);

    function renderTraj(id) {
      const t = St.tech(id); U.clear(trajBox);
      trajBox.appendChild(U.el("div", { class: "row wrap", style: "justify-content:space-between;gap:12px;margin-bottom:14px" }, [
        U.el("div", {}, [U.el("h4", { text: t.name }), U.el("div", { class: "dom", text: t.domain, style: "font-family:var(--font-mono);color:var(--text-3);font-size:12px" })]),
        U.el("button", { class: "btn sm primary", text: "Открыть карточку →", onclick: function () { openTech(t.id); } }),
      ]));
      trajBox.appendChild(layerBar(t, true));
      const steps = U.el("div", { class: "stack", style: "margin-top:14px" });
      ["S1", "S2", "S3", "S4", "S5", "S6"].forEach(function (lid) {
        const on = t.byLayer && t.byLayer[lid], cur = t.currentLayer === lid;
        steps.appendChild(U.el("div", { class: "row", style: "gap:10px;align-items:flex-start;opacity:" + (on ? 1 : .4) }, [
          layerBadge(lid), cur ? U.el("span", { class: "tag", style: "border-color:var(--accent);color:var(--accent)", text: "текущий" }) : null,
          U.el("div", { class: "small", style: "flex:1;color:var(--text-2)", text: on ? t.byLayer[lid] : "рубеж не достигнут — критерий: «" + St.layer(lid).transitionCriterion + "»" }),
        ]));
      });
      trajBox.appendChild(steps);
      trajBox.appendChild(U.el("div", { class: "note-demo", style: "margin-top:14px" }, [U.el("span", { class: "i", text: "◆" }), U.el("span", { text: "Следующий рубеж: " + t.nextMilestone })]));
    }
    renderTraj(St.state.ui.overviewTech || St.data.techs[0].id);
    if (St.state.ui.overviewTech) pick.value = St.state.ui.overviewTech;

    if (aud) panel.appendChild(audienceHint(aud));
  };

  /* ============================ ВКЛАДКА: Каталог технологий ============================ */
  Tabs.catalog = function (panel) {
    const ui = St.state.ui.catalog;
    panel.appendChild(U.el("div", { class: "tab-intro" }, [
      U.el("div", { class: "kicker" }, ["● Каталог", U.el("span", { text: "браузер технологий" })]),
      U.el("h2", { text: "50 технологий: поиск, фильтры, связи" }),
      U.el("div", { class: "lead", text: "Просматривайте технологии по слою, домену, аудитории и типу связи. Клик по карточке — детальная карточка с присутствием по слоям и связями." }),
    ]));

    // тулбар
    const search = U.el("input", { type: "search", placeholder: "Поиск по названию и описанию…", value: ui.q });
    const box = U.el("div", { class: "toolbar" }, [
      U.el("div", { class: "search-box" }, [U.el("span", { class: "ico", html: svgIcon("search") }), search]),
      selectCtl(ui.sort, [["layer", "Сортировка: по слою"], ["name", "по названию"], ["domain", "по домену"]], function (v) { ui.sort = v; St.save(); rerender(); }),
      U.el("div", { class: "view-toggle" }, [
        U.el("button", { class: ui.view === "grid" ? "on" : "", html: svgIcon("grid") + " Сетка", onclick: function () { ui.view = "grid"; St.save(); rerender(); } }),
        U.el("button", { class: ui.view === "table" ? "on" : "", html: svgIcon("rows") + " Таблица", onclick: function () { ui.view = "table"; St.save(); rerender(); } }),
      ]),
    ]);
    panel.appendChild(box);

    // фильтры-чипы
    const filterWrap = U.el("div", {});
    panel.appendChild(filterWrap);
    const results = U.el("div", {});
    panel.appendChild(results);

    search.addEventListener("input", U.debounce(function () { ui.q = search.value; St.save(); rerender(); }, 200));

    function buildFilters() {
      U.clear(filterWrap);
      // слои
      const rowL = U.el("div", { class: "filter-row" }, [U.el("span", { class: "lbl", text: "Слой" })]);
      ["S1", "S2", "S3", "S4", "S5", "S6"].forEach(function (lid) {
        rowL.appendChild(U.el("button", { class: "chip click" + (ui.layer === lid ? " on" : ""), onclick: function () { ui.layer = ui.layer === lid ? "" : lid; St.save(); rerender(); } },
          [U.el("span", { class: "dot", style: "background:" + St.layerColor(lid) }), St.layerLabel(lid)]));
      });
      filterWrap.appendChild(rowL);
      // домены (укрупнённые)
      const groups = Object.keys(St.data.domainGroups).sort();
      const rowD = U.el("div", { class: "filter-row" }, [U.el("span", { class: "lbl", text: "Домен" }), selectCtl(ui.domain, [["", "все домены"]].concat(groups.map(function (g) { return [g, g]; })), function (v) { ui.domain = v; St.save(); rerender(); })]);
      // аудитории
      rowD.appendChild(U.el("span", { class: "lbl", text: "Аудитория", style: "margin-left:8px" }));
      rowD.appendChild(selectCtl(ui.aud, [["", "все аудитории"]].concat(St.data.audiences.map(function (a) { return [a.id, a.name]; })), function (v) { ui.aud = v; St.save(); rerender(); }));
      // тип связи
      rowD.appendChild(U.el("span", { class: "lbl", text: "Связь", style: "margin-left:8px" }));
      rowD.appendChild(selectCtl(ui.link, [["", "любой тип"]].concat(St.data.linkTypes.map(function (l) { return [l.id, l.name]; })), function (v) { ui.link = v; St.save(); rerender(); }));
      filterWrap.appendChild(rowD);
    }

    function filtered() {
      let list = St.data.techs.slice();
      const q = (ui.q || "").trim().toLowerCase();
      if (q) list = list.filter(function (t) { return (t.name + " " + t.description + " " + t.domain).toLowerCase().indexOf(q) >= 0; });
      if (ui.layer) list = list.filter(function (t) { return t.currentLayer === ui.layer; });
      if (ui.domain) list = list.filter(function (t) { return domGroup(t) === ui.domain; });
      if (ui.aud) list = list.filter(function (t) { return (t.audiences || []).indexOf(ui.aud) >= 0; });
      if (ui.link) list = list.filter(function (t) { return (t.links || []).some(function (l) { return l.type === ui.link; }); });
      list.sort(function (a, b) {
        if (ui.sort === "name") return a.name.localeCompare(b.name, "ru");
        if (ui.sort === "domain") return a.domain.localeCompare(b.domain, "ru");
        return St.layerOrder(a.currentLayer) - St.layerOrder(b.currentLayer) || a.name.localeCompare(b.name, "ru");
      });
      return list;
    }

    function rerender() {
      buildFilters();
      const list = filtered();
      U.clear(results);
      results.appendChild(U.el("div", { class: "result-meta", text: "Найдено: " + list.length + " из " + St.data.techs.length }));
      if (!list.length) { results.appendChild(U.state("∅", "Ничего не найдено", "Измените поисковый запрос или сбросьте фильтры.")); return; }
      if (ui.view === "grid") {
        const grid = U.el("div", { class: "grid cols-3" });
        list.forEach(function (t) { grid.appendChild(techCard(t)); });
        results.appendChild(grid);
      } else {
        results.appendChild(catalogTable(list));
      }
    }
    rerender();
  };

  function catalogTable(list) {
    const wrap = U.el("div", { class: "tbl-wrap" });
    const tbl = U.el("table", { class: "tbl" });
    tbl.appendChild(U.el("thead", {}, U.el("tr", {}, [
      U.el("th", { text: "Технология" }), U.el("th", { text: "Домен" }), U.el("th", { text: "Слой" }),
      U.el("th", { text: "Присутствие" }), U.el("th", { text: "Связи" }), U.el("th", { text: "Аудитории" }),
    ])));
    const tb = U.el("tbody");
    list.forEach(function (t) {
      tb.appendChild(U.el("tr", { onclick: function () { openTech(t.id); } }, [
        U.el("td", {}, [U.el("span", { class: "nm", text: t.name })]),
        U.el("td", { class: "mono small", text: t.domain }),
        U.el("td", {}, layerBadge(t.currentLayer)),
        U.el("td", { style: "min-width:120px" }, layerBar(t)),
        U.el("td", { class: "mono", text: (t.links || []).length }),
        U.el("td", {}, audBadges((t.audiences || []).slice(0, 3))),
      ]));
    });
    tbl.appendChild(tb); wrap.appendChild(tbl); return wrap;
  }

  /* ============================ ВКЛАДКИ: Слои S1–S6 ============================ */
  Tabs.layer = function (panel, lid) {
    const l = St.layer(lid), c = St.layerColor(lid);
    const onLayer = St.techsOnLayer(lid), withPres = St.techsWithPresence(lid);
    panel.appendChild(U.el("div", { class: "tab-intro" }, [
      U.el("div", { class: "kicker" }, [U.el("span", { class: "lchip", style: "width:11px;height:11px;border-radius:3px;background:" + c }), "Слой " + St.layerNum(lid) + " из 6 · " + St.layerShort(lid)]),
      U.el("h2", { text: St.layerNum(lid) + ". " + l.title }),
      U.el("div", { class: "lead", text: l.whatCaptured }),
      U.el("div", { class: "counters" }, [
        counter(onLayer.length, "технологий на слое", "текущий слой = " + St.layerLabel(lid)),
        counter(withPres.length, "технологий с присутствием", "прошли через слой"),
        counter(l.entities.length, "типов сущностей", "артефакты слоя"),
        counter(l.visualizations.length, "визуализаций", "переключаемые"),
      ]),
    ]));

    // критерий перехода
    panel.appendChild(U.el("div", { class: "card", style: "margin-top:20px;border-left:3px solid " + c }, [
      U.el("div", { class: "row wrap", style: "gap:20px" }, [
        kv("Критерий перехода на следующий слой", l.transitionCriterion),
      ]),
    ]));

    // спец-аналитика слоя «Мир»: форсайт STEEPV
    if (lid === "S6" && window.WORLD_STEEPV) panel.appendChild(worldSteepvSection());

    // визуализации слоя (переключаемые)
    const vsec = U.el("div", { class: "section" });
    vsec.appendChild(sectionHead("Варианты визуализации слоя", "Переключаются под разные аудитории. Отрисованы на демонстрационных данных набора."));
    vsec.appendChild(vizPanel(l.visualizations, "layer", lid, { techs: withPres.length ? withPres : onLayer, layer: lid }));
    panel.appendChild(vsec);

    // две колонки: сущности + технологии на слое
    const two = U.el("div", { class: "section panel-2col" });
    // сущности
    const entCard = U.el("div", { class: "card" }, [U.el("h3", { text: "Сущности слоя (артефакты)", style: "font-size:16px;margin-bottom:12px" })]);
    l.entities.forEach(function (e) {
      const rel = withPres.slice(0, 3);
      entCard.appendChild(U.el("div", { class: "link-item", onclick: function () { openEntity(lid, e); } }, [
        U.el("span", { class: "lt", style: "background:" + c + "22;color:" + c, text: "◆" }),
        U.el("div", { class: "lc" }, [U.el("div", { class: "n", text: e }), U.el("div", { class: "note", text: "пример: " + (rel[0] ? rel[0].name : "—") })]),
        U.el("span", { class: "arr", text: "→" }),
      ]));
    });
    // технологии на слое
    const techCol = U.el("div", { class: "card" }, [U.el("h3", { text: "Технологии на слое", style: "font-size:16px;margin-bottom:12px" })]);
    if (!onLayer.length) techCol.appendChild(U.el("div", { class: "small muted", text: "Нет технологий с текущим слоем " + lid + " (все прошли дальше или ещё не достигли)." }));
    onLayer.forEach(function (t) {
      techCol.appendChild(U.el("div", { class: "link-item", onclick: function () { openTech(t.id); } }, [
        U.el("div", { class: "lc" }, [U.el("div", { class: "n", text: t.name }), U.el("div", { class: "note", text: t.domain })]),
        audBadges((t.audiences || []).slice(0, 1)),
      ]));
    });
    two.appendChild(entCard); two.appendChild(techCol);
    panel.appendChild(two);

    // подтверждающие артефакты + барьеры
    const evTechs = withPres.length ? withPres : onLayer;
    const ev2 = U.el("div", { class: "section panel-2col" });
    const evItems = St.layerEvidence(lid, 14);
    const evCard = U.el("div", { class: "card" }, [
      U.el("div", { class: "row", style: "justify-content:space-between;align-items:baseline;margin-bottom:12px" }, [
        U.el("h3", { text: "Подтверждающие артефакты — «" + St.evidenceKind(lid) + "»", style: "font-size:16px" }),
        U.el("span", { class: "pill-count", text: St.layerEvidence(lid).length + " шт." }),
      ]),
      U.el("div", { class: "small muted", style: "margin-bottom:12px", text: "Конкретные данные, фиксирующие присутствие технологий на этом слое. Клик — карточка технологии." }),
      evItems.length ? evList(evItems, true) : U.el("div", { class: "small muted", text: "Нет артефактов." }),
    ]);
    const barCard = U.el("div", { class: "card" }, [
      U.el("h3", { text: "Барьеры перехода на следующий слой", style: "font-size:16px;margin-bottom:8px" }),
      U.el("div", { class: "small muted", style: "margin-bottom:14px", text: "Суммарное значение (Σ по шкале 1–5) по типам для технологий этого слоя — что мешает движению дальше." }),
      barrierAggBlock(evTechs),
      legendBarriers(),
    ]);
    ev2.appendChild(evCard); ev2.appendChild(barCard);
    panel.appendChild(ev2);

    // ключевые вопросы + аудитории + связи
    const three = U.el("div", { class: "section grid cols-3" });
    three.appendChild(U.el("div", { class: "card" }, [
      U.el("h3", { text: "Ключевые вопросы слоя", style: "font-size:15px;margin-bottom:10px" }),
      U.el("div", { class: "stack" }, l.keyQuestions.map(function (q, i) { return U.el("div", { class: "qrow", style: "border:none;padding:6px 0" }, [U.el("span", { class: "n", text: "?" }), U.el("span", { text: q })]); })),
    ]));
    three.appendChild(U.el("div", { class: "card" }, [
      U.el("h3", { text: "Целевая аудитория слоя", style: "font-size:15px;margin-bottom:10px" }),
      U.el("div", { class: "stack" }, l.audiences.map(function (a) { return U.el("div", { class: "row", style: "gap:8px" }, [audBadge(a), U.el("span", { class: "small muted", text: St.aud(a).focus })]); })),
    ]));
    three.appendChild(U.el("div", { class: "card" }, [
      U.el("h3", { text: "Связи со смежными слоями", style: "font-size:15px;margin-bottom:10px" }),
      U.el("div", { class: "prose small", text: l.linksToLayers }),
    ]));
    panel.appendChild(three);

    // источники (описательно)
    panel.appendChild(sourcesBlock(l.sources, l.updateMechanism));

    if (St.state.audience) panel.appendChild(audienceHint(St.state.audience));
  };

  function openEntity(lid, name) {
    const l = St.layer(lid), c = St.layerColor(lid);
    const rel = St.techsWithPresence(lid);
    U.openDrawer(function (body, head) {
      head.appendChild(layerBadge(lid, true)); head.appendChild(U.spacer());
      body.appendChild(U.el("h3", { class: "dt", text: name }));
      body.appendChild(U.el("div", { class: "dsub", text: "Сущность слоя " + lid + " · " + l.title }));
      body.appendChild(U.block("Роль в слое", U.el("div", { class: "prose", text: "«" + name + "» — фиксируемый артефакт слоя «" + l.title + "». " + l.whatCaptured })));

      // конкретные подтверждающие артефакты этого слоя
      const ev = St.layerEvidence(lid, 10);
      if (ev.length) body.appendChild(U.block("Примеры артефактов («" + St.evidenceKind(lid) + "»)", evList(ev, true)));

      const cr = U.el("div", {});
      rel.slice(0, 8).forEach(function (t) {
        cr.appendChild(U.el("div", { class: "link-item", onclick: function () { openTech(t.id); } }, [
          U.el("div", { class: "lc" }, [U.el("div", { class: "n", text: t.name }), U.el("div", { class: "note", text: t.byLayer[lid] || t.domain })]),
          U.el("span", { class: "arr", text: "→" }),
        ]));
      });
      body.appendChild(U.block("Связанные технологии (примеры)", cr));
    });
  }

  /* ============================ ВКЛАДКА: Аналитические разрезы ============================ */
  Tabs.cuts = function (panel) {
    const f = St.state.ui.cutFilter;
    panel.appendChild(U.el("div", { class: "tab-intro" }, [
      U.el("div", { class: "kicker" }, ["● Разрезы", U.el("span", { text: "16 сквозных тем" })]),
      U.el("h2", { text: "Аналитические разрезы: сквозные срезы по слоям" }),
      U.el("div", { class: "lead", text: "Каждый разрез собирает данные с нескольких слоёв, предлагает варианты визуализации под аудитории и выводы для разных групп." }),
    ]));

    const filterWrap = U.el("div", {}); panel.appendChild(filterWrap);
    const grid = U.el("div", { class: "section grid cols-3" }); panel.appendChild(grid);

    function buildFilters() {
      U.clear(filterWrap);
      const rowL = U.el("div", { class: "filter-row" }, [U.el("span", { class: "lbl", text: "Слой" })]);
      ["S1", "S2", "S3", "S4", "S5", "S6"].forEach(function (lid) {
        rowL.appendChild(U.el("button", { class: "chip click" + (f.layer === lid ? " on" : ""), onclick: function () { f.layer = f.layer === lid ? "" : lid; St.save(); render(); } }, [U.el("span", { class: "dot", style: "background:" + St.layerColor(lid) }), St.layerLabel(lid)]));
      });
      rowL.appendChild(U.el("span", { class: "lbl", text: "Аудитория", style: "margin-left:8px" }));
      rowL.appendChild(selectCtl(f.aud, [["", "все аудитории"]].concat(St.data.audiences.map(function (a) { return [a.id, a.name]; })), function (v) { f.aud = v; St.save(); render(); }));
      filterWrap.appendChild(rowL);
    }
    function render() {
      buildFilters(); U.clear(grid);
      let list = St.data.cuts.slice();
      if (f.layer) list = list.filter(function (c) { return c.layers.indexOf(f.layer) >= 0; });
      if (f.aud) list = list.filter(function (c) { return c.audiences.indexOf(f.aud) >= 0; });
      if (St.state.audience) list.sort(function (a, b) { return (b.audiences.indexOf(St.state.audience) >= 0) - (a.audiences.indexOf(St.state.audience) >= 0); });
      grid.appendChild(U.el("div", { class: "result-meta", text: "Разрезов: " + list.length, style: "grid-column:1/-1" }));
      list.forEach(function (c) { grid.appendChild(cutCard(c)); });
    }
    render();
  };

  function cutCard(c) {
    const card = U.el("div", { class: "card hover", onclick: function () { openCut(c.id); } }, [
      U.el("div", { class: "row", style: "justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px" }, [
        U.el("span", { class: "tag", text: cutDisp(c.id) }),
        U.el("div", { class: "chips-row" }, c.layers.map(function (l) { return U.el("span", { class: "badge layer-badge", style: "background:" + St.layerColor(l) + ";height:18px", title: St.layer(l).title, text: St.layerLabel(l) }); })),
      ]),
      U.el("h4", { text: c.title, style: "font-size:15.5px;line-height:1.25;margin-bottom:8px" }),
      U.el("div", { class: "small muted", text: c.keyQuestions[0], style: "display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden" }),
      U.el("div", { class: "row wrap", style: "gap:6px;margin-top:12px;justify-content:space-between" }, [
        audBadges(c.audiences.slice(0, 3)),
        U.el("span", { class: "tag", text: c.visualizations.length + " виз." }),
      ]),
    ]);
    return card;
  }

  function openCut(id) {
    const c = St.cut(id);
    U.openDrawer(function (body, head) {
      head.appendChild(U.el("span", { class: "tag", text: cutDisp(c.id) }));
      head.appendChild(U.el("div", { class: "chips-row", style: "margin-left:8px" }, c.layers.map(function (l) { return layerBadge(l); })));
      head.appendChild(U.spacer());
      body.appendChild(U.el("h3", { class: "dt", text: c.title }));
      body.appendChild(U.el("div", { class: "dsub", text: "Задействованные слои: " + c.layers.join(", ") }));

      const ans = (window.CUT_ANSWERS || {})[c.id];
      // Ключевые вопросы + ответы
      body.appendChild(U.block("Ключевые вопросы и выводы из визуализаций", U.el("div", { class: "stack", style: "gap:16px" }, c.keyQuestions.map(function (q, i) {
        const raw = ans && ans.answers && ans.answers[i];
        const a = typeof raw === "string" ? { a: raw } : (raw || null);
        const parts = [U.el("div", { class: "qa-q" }, [U.el("span", { class: "n", text: "?" }), U.el("span", { text: q })])];
        if (a) {
          parts.push(U.el("div", { class: "qa-a", text: a.a }));
          if (a.viz) {
            const vIdx = matchVizIndex(a.viz, c.visualizations);
            const src = U.el("div", { class: "qa-src" + (vIdx >= 0 ? " click" : ""), title: vIdx >= 0 ? "Перейти к визуализации" : "",
              onclick: vIdx >= 0 ? function () { const vp = body.querySelector(".vizpanel"); if (vp && vp._select) vp._select(vIdx); } : null }, [
              U.el("span", { class: "qa-src-ic", text: "📊" }),
              U.el("div", {}, [U.el("b", { text: "Из визуализации «" + a.viz + "»: " }), U.el("span", { text: a.read || "" }),
                vIdx >= 0 ? U.el("span", { class: "qa-src-go", text: " → перейти к графику" }) : null]),
            ]);
            parts.push(src);
          }
        } else parts.push(U.el("div", { class: "qa-a muted", text: "Вывод формируется на демонстрационных данных (см. визуализации ниже)." }));
        return U.el("div", { class: "qa" }, parts);
      }))));

      // Именованные сущности, связанные с технологиями
      if (ans && ans.entities && ans.entities.length) {
        body.appendChild(U.block(ans.entityLabel + " → технологии", U.el("div", { class: "stack" }, ans.entities.map(function (e) {
          const chips = U.el("div", { class: "chips-row", style: "margin-top:8px" });
          (e.techs || []).forEach(function (id) { const t = St.tech(id); if (t) chips.appendChild(U.el("button", { class: "chip click", onclick: function () { openTech(id); } }, [U.el("span", { class: "dot", style: "background:" + St.layerColor(t.currentLayer) }), t.name])); });
          return U.el("div", { class: "ent-card" }, [
            U.el("div", { class: "ent-name", text: e.name }),
            U.el("div", { class: "ent-desc", text: e.desc }),
            chips,
          ]);
        }))));
      }

      body.appendChild(U.block("Целевые аудитории", audBadges(c.audiences)));

      // варианты визуализации
      body.appendChild(U.block("Варианты визуализации (" + c.visualizations.length + ")",
        vizPanel(c.visualizations, "cut", c.id, { techs: St.techsForCut(c), cut: c })));

      // выводы по аудиториям
      const ins = U.el("div", {});
      c.insights.forEach(function (o) {
        const col = St.audColor(o.audience);
        ins.appendChild(U.el("div", { class: "insight", style: "border-left-color:" + col }, [
          U.el("div", { style: "flex:none" }, [U.el("div", { class: "who", style: "color:" + col, text: St.audName(o.audience) })]),
          U.el("div", { class: "txt", text: o.insight }),
        ]));
      });
      body.appendChild(U.block("Выводы для целевых групп", ins));

      // источники
      body.appendChild(sourcesBlock(c.sources, c.updateMechanism, true));

      // связанные технологии
      const rel = St.techsForCut(c).slice(0, 10);
      const cr = U.el("div", { class: "chips-row" });
      rel.forEach(function (t) { cr.appendChild(U.el("button", { class: "chip click", onclick: function () { openTech(t.id); } }, [U.el("span", { class: "dot", style: "background:" + St.layerColor(t.currentLayer) }), t.name])); });
      body.appendChild(U.block("Связанные технологии", cr));
    }, true);
  }

  /* ============================ ВКЛАДКА: Системные вопросы ============================ */
  const SYS = [
    { ic: "🌍", t: "Трансформация мира и геополитика", d: "Суверенитет, баланс сил, новые экономические модели", cuts: ["R01", "R11", "R16"], layers: ["S6"] },
    { ic: "🏭", t: "Отраслевая диффузия", d: "Как технологии перетекают между отраслями и создают рынки", cuts: ["R04", "R14", "R15"], layers: ["S3", "S4", "S5"] },
    { ic: "🏠", t: "Повседневная жизнь и общество", d: "Как изменится структура жизни, кто выигрывает и кто уязвим", cuts: ["R09", "R05"], layers: ["S6"] },
    { ic: "💰", t: "Инвестиции и капитал", d: "Горизонты, диспропорции капитала, перегрев и тупики", cuts: ["R02", "R13", "R06"], layers: ["S1", "S2", "S3", "S4", "S5"] },
    { ic: "🎓", t: "Образование и рынок труда", d: "Компетенции будущего, кадровые миграции, программы обучения", cuts: ["R05", "R09"], layers: ["S2", "S6"] },
    { ic: "🔭", t: "Наука и слепые зоны", d: "Коммерческий потенциал гипотез, недооценённые направления", cuts: ["R08", "R03", "R16"], layers: ["S1"] },
  ];
  Tabs.system = function (panel) {
    panel.appendChild(U.el("div", { class: "tab-intro" }, [
      U.el("div", { class: "kicker" }, ["● Системные вопросы", U.el("span", { text: "глобальный уровень" })]),
      U.el("h2", { text: "Вопросы системного уровня — навигатор по разрезам" }),
      U.el("div", { class: "lead", text: "Вопрос глобального уровня ведёт к набору разрезов и слоёв, которые дают на него ответ. Выбор аудитории подсвечивает релевантные темы." }),
    ]));
    const aud = St.state.audience;
    const grid = U.el("div", { class: "section grid cols-2" });
    SYS.forEach(function (q) {
      const relCuts = q.cuts.map(St.cut.bind(St));
      const hot = aud ? relCuts.some(function (c) { return c.audiences.indexOf(aud) >= 0; }) : false;
      const card = U.el("div", { class: "qcat", style: hot ? "border-color:var(--accent)" : "" }, [
        U.el("div", { class: "qh" }, [
          U.el("div", { class: "ic", style: "background:var(--surface-2)", text: q.ic }),
          U.el("div", {}, [U.el("div", { class: "qt", text: q.t }), U.el("div", { class: "qd", text: q.d })]),
        ]),
        U.el("div", { class: "qbody" }, [
          U.el("div", { class: "row wrap", style: "gap:6px;margin:8px 0" }, q.layers.map(function (l) { return layerBadge(l); }).concat([
            U.el("button", { class: "btn sm ghost", text: "к слоям →", onclick: function () { App.go(q.layers[0]); } }),
          ])),
          U.el("div", { class: "stack" }, relCuts.map(function (c) {
            const on = aud && c.audiences.indexOf(aud) >= 0;
            return U.el("div", { class: "qrow", style: on ? "background:color-mix(in srgb,var(--accent) 8%,transparent);border-radius:8px;padding:8px" : "", onclick: function () { App.go("cuts"); setTimeout(function () { openCut(c.id); }, 220); }, onmouseenter: function () {} }, [
              U.el("span", { class: "n", text: cutDisp(c.id) }),
              U.el("span", { style: "flex:1;cursor:pointer;color:var(--text)", text: c.title }),
              U.el("span", { class: "arr muted", text: "→" }),
            ]);
          })),
        ]),
      ]);
      grid.appendChild(card);
    });
    panel.appendChild(grid);
    if (aud) panel.appendChild(audienceHint(aud));
  };

  /* ============================ Мелкие shared-хелперы ============================ */
  function counter(v, l, sub) {
    return U.el("div", { class: "counter" }, [U.el("div", { class: "v mono", text: typeof v === "number" ? U.num(v) : v }), U.el("div", { class: "l", text: l }), sub ? U.el("div", { class: "sub", text: sub }) : null]);
  }
  function sectionHead(title, hint) {
    return U.el("div", { class: "section-head" }, [U.el("h3", { text: title }), hint ? U.el("span", { class: "hint", text: hint }) : null]);
  }
  function kv(k, v) { return U.el("div", {}, [U.el("div", { class: "small muted", text: k, style: "font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.08em;font-size:11px;margin-bottom:4px" }), U.el("div", { text: v, style: "color:var(--text)" })]); }
  function legendLayers() {
    return U.el("div", { class: "legend" }, ["S1", "S2", "S3", "S4", "S5", "S6"].map(function (lid) {
      return U.el("span", { class: "it" }, [U.el("span", { class: "sw", style: "background:" + St.layerColor(lid) }), St.layerLabel(lid) + " — " + St.layer(lid).title]);
    }));
  }
  function sourcesBlock(sources, mech, inDrawer) {
    const content = [
      U.el("ul", { class: "source-list" }, sources.map(function (s) { return U.el("li", {}, [U.el("span", { class: "b" }), s]); })),
      U.el("div", { class: "note-demo", style: "margin-top:12px" }, [U.el("span", { class: "i", text: "ⓘ" }), U.el("div", {}, [U.el("b", { text: "Механизм обновления: " }), mech])]),
    ];
    if (inDrawer) return U.block("Источники и механизм обновления", content);
    const sec = U.el("div", { class: "section" });
    sec.appendChild(sectionHead("Источники и механизм обновления", "Описание, реализация сбора — на целевой стадии"));
    const card = U.el("div", { class: "card" }); content.forEach(function (c) { card.appendChild(c); }); sec.appendChild(card);
    return sec;
  }
  function audienceHint(aid) {
    const a = St.aud(aid), col = St.audColor(aid);
    return U.el("div", { class: "card", style: "margin-top:28px;border-left:3px solid " + col + ";display:flex;gap:12px;align-items:center" }, [
      U.el("span", { text: St.audIcon(aid), style: "font-size:22px" }),
      U.el("div", {}, [U.el("div", { style: "font-weight:600", text: "Активна аудитория: " + a.name }), U.el("div", { class: "small muted", text: "Акценты представлений и порядок визуализаций подстроены под фокус: " + a.focus })]),
    ]);
  }
  function selectCtl(val, opts, onch) {
    const sel = U.el("select", { class: "select-ctl", onchange: function () { onch(this.value); } });
    opts.forEach(function (o) { const op = U.el("option", { value: o[0], text: o[1] }); if (o[0] === val) op.selected = true; sel.appendChild(op); });
    return sel;
  }
  function svgIcon(n) {
    const ic = {
      search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>',
      grid: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
      rows: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
    };
    return ic[n] || "";
  }

  // экспорт часто используемых
  Tabs._openTech = openTech; Tabs._openCut = openCut;
  window.Tabs = Tabs;
})();
