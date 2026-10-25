/* Точка входа: шапка, панель вкладок, фильтр аудитории, тема, маршрутизация. */
(function () {
  const U = window.U, St = window.Store, Tabs = window.Tabs;

  const TABS = [
    { id: "overview", label: "Обзор / Карта эволюции", short: "Обзор" },
    { id: "catalog", label: "Каталог технологий", short: "Каталог" },
    { id: "S1", label: "1. Фундаментальные исследования", short: "1·Фунд.", layer: true },
    { id: "S2", label: "2. Прикладные исследования", short: "2·Прикл.", layer: true },
    { id: "S3", label: "3. Появление технологий", short: "3·Появл.", layer: true },
    { id: "S4", label: "4. Формирование спроса", short: "4·Спрос", layer: true },
    { id: "S5", label: "5. Появление продуктов", short: "5·Прод.", layer: true },
    { id: "S6", label: "6. Изменение мира", short: "6·Мир", layer: true },
    { id: "cuts", label: "Аналитические разрезы", short: "Разрезы" },
    { id: "system", label: "Системные вопросы", short: "Системные" },
  ];

  const App = {
    current: "overview",

    boot: function () {
      if (this._booted) return; this._booted = true;
      St.init();
      document.documentElement.setAttribute("data-theme", St.state.theme);
      this.renderHeader();
      this.renderTabs();
      const start = (location.hash || "").replace("#", "");
      this.go(TABS.some(function (t) { return t.id === start; }) ? start : "overview", true);
    },

    // ---------- шапка ----------
    renderHeader: function () {
      const h = U.$("#app-header"); U.clear(h);
      const top = U.el("div", { class: "hdr-top" }, [
        U.el("div", { class: "hdr-brand" }, [
          U.el("div", { class: "hdr-logo", text: "GF" }),
          U.el("div", { class: "hdr-titles" }, [
            U.el("div", { class: "eyebrow", text: "Платформа технологической аналитики · до 2050" }),
            U.el("h1", { text: "Глобальный форсайт технологической эволюции" }),
            U.el("div", { class: "hdr-sub", text: "Стратифицированная модель зрелости S1→S6, 50 технологий, 16 аналитических разрезов, 7 целевых аудиторий. Демонстрационный образец на подготовленном наборе данных." }),
          ]),
        ]),
        this.headerActions(),
      ]);
      h.appendChild(top);
    },

    headerActions: function () {
      const self = this;
      const wrap = U.el("div", { class: "hdr-actions" });

      // фильтр аудитории
      const audWrap = U.el("div", { class: "aud-select" });
      const cur = St.state.audience;
      const trigger = U.el("button", { class: "ctl", onclick: function (e) { e.stopPropagation(); menu.classList.toggle("open"); } }, [
        U.el("span", { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4h18M6 8h12M9 12h6M11 16h2"/></svg>' }),
        U.el("span", { text: cur ? St.audName(cur).split(" ")[0] : "Аудитория: все" }),
        U.el("span", { html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" style="width:12px;height:12px"><path d="M6 9l6 6 6-6"/></svg>' }),
      ]);
      const menu = U.el("div", { class: "aud-menu" });
      const optAll = U.el("div", { class: "aud-opt" + (!cur ? " active" : ""), onclick: function () { St.setAudience(null); } }, [
        U.el("span", { class: "dot", style: "background:var(--text-3)" }),
        U.el("div", {}, [U.el("div", { class: "nm", text: "Все аудитории" }), U.el("div", { class: "fc", text: "Нейтральное представление без акцентов" })]),
      ]);
      menu.appendChild(optAll);
      St.data.audiences.forEach(function (a) {
        menu.appendChild(U.el("div", { class: "aud-opt" + (cur === a.id ? " active" : ""), onclick: function () { St.setAudience(a.id); } }, [
          U.el("span", { class: "dot", style: "background:" + St.audColor(a.id) }),
          U.el("div", {}, [U.el("div", { class: "nm", text: St.audIcon(a.id) + " " + a.name }), U.el("div", { class: "fc", text: a.focus })]),
        ]));
      });
      audWrap.appendChild(trigger); audWrap.appendChild(menu);
      document.addEventListener("click", function () { menu.classList.remove("open"); });
      wrap.appendChild(audWrap);

      // тема
      wrap.appendChild(U.el("button", { class: "ctl ctl-icon", title: "Переключить тему", "aria-label": "Тема",
        html: St.state.theme === "dark"
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>',
        onclick: function () { St.toggleTheme(); self.renderHeader(); } }));

      // сброс
      wrap.appendChild(U.el("button", { class: "ctl", title: "Сбросить к начальным данным",
        html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg><span style="margin-left:2px">Сброс</span>',
        onclick: function () {
          if (confirm("Сбросить настройки представления (аудитория, фильтры, тема, выбор визуализаций) к начальным?")) {
            St.reset(); document.documentElement.setAttribute("data-theme", St.state.theme);
            self.renderHeader(); self.renderTabs(); self.go(self.current, true); U.toast("Сброшено к начальным данным", "ok");
          }
        } }));

      return wrap;
    },

    // ---------- панель вкладок ----------
    renderTabs: function () {
      const inner = U.$("#tabs-inner"); U.clear(inner);
      const mob = U.$("#tabs-mobile"); U.clear(mob);
      const self = this;
      TABS.forEach(function (t) {
        const btn = U.el("button", { class: "tab-btn" + (t.id === self.current ? " active" : ""), dataset: { tab: t.id }, onclick: function () { self.go(t.id); } });
        if (t.layer) btn.appendChild(U.el("span", { class: "lchip", style: "background:" + St.layerColor(t.id) }));
        btn.appendChild(U.el("span", { text: t.short }));
        const cnt = self.tabCount(t.id);
        if (cnt != null) btn.appendChild(U.el("span", { class: "cnt", text: cnt }));
        inner.appendChild(btn);
        mob.appendChild(U.el("option", { value: t.id, text: t.label, selected: t.id === self.current ? "selected" : null }));
      });
      mob.onchange = function () { self.go(this.value); };
    },

    tabCount: function (id) {
      if (id === "catalog") return St.data.techs.length;
      if (id === "cuts") return St.data.cuts.length;
      if (/^S[1-6]$/.test(id)) return St.techsOnLayer(id).length;
      return null;
    },

    // ---------- маршрутизация ----------
    go: function (id, skipScroll) {
      this.current = id;
      try { history.replaceState(null, "", "#" + id); } catch (e) {}
      U.$$(".tab-btn").forEach(function (b) { b.classList.toggle("active", b.dataset.tab === id); });
      const mob = U.$("#tabs-mobile"); if (mob) mob.value = id;
      const panel = U.$("#panel"); U.clear(panel); panel.classList.remove("active"); void panel.offsetWidth; panel.classList.add("active");
      window.VZ && window.VZ.Tip && window.VZ.Tip.hide();

      if (id === "overview") Tabs.overview(panel);
      else if (id === "catalog") Tabs.catalog(panel);
      else if (/^S[1-6]$/.test(id)) Tabs.layer(panel, id);
      else if (id === "cuts") Tabs.cuts(panel);
      else if (id === "system") Tabs.system(panel);

      if (!skipScroll) { const bar = U.$("#tabs-bar"); const y = (U.$("#app-header").offsetHeight); window.scrollTo({ top: 0, behavior: "smooth" }); }
    },
  };

  // при смене аудитории — перерисовать текущую вкладку и шапку
  St.on(function () { App.renderHeader(); App.renderTabs(); App.go(App.current, true); });

  window.App = App;
  document.addEventListener("DOMContentLoaded", function () { App.boot(); });
  if (document.readyState !== "loading") App.boot();
})();
