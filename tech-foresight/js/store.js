/* Централизованное состояние: данные из seed + пользовательские настройки в localStorage.
   Внешних обращений нет — всё работает на подготовленном демонстрационном наборе. */
(function () {
  const LS_KEY = "tech-foresight:v1";

  // Цвета слоёв (совпадают с CSS-токенами --s1..--s6)
  const LAYER_COLORS = { S1: "#7c8cff", S2: "#4fb6e0", S3: "#35c9a6", S4: "#f2c14e", S5: "#f0894e", S6: "#f56b8b" };
  // Цвета аудиторий
  const AUD_COLORS = { A1: "#6ea8ff", A2: "#8b7bff", A3: "#f56b8b", A4: "#35c9a6", A5: "#f2c14e", A6: "#4fb6e0", A7: "#c084fc" };
  const AUD_ICON = { A1: "💰", A2: "🏢", A3: "🏛️", A4: "🔬", A5: "🚀", A6: "🎓", A7: "🧭" };
  const AUD_SHORT = { A1: "Инвесторы", A2: "Корпорации", A3: "Государство", A4: "Учёные", A5: "Стартапы", A6: "Образование", A7: "Аналитики" };
  const LINK_COLORS = { progression: "#8aa0c8", convergence: "#8b7bff", complementary: "#4fb6e0",
    drift: "#f2c14e", cascade: "#f0894e", cannibalism: "#f56b8b" };

  // Короткие имена и номера слоёв (для отображения «1. Фунд.» вместо «S1»)
  const LAYER_NUM = { S1: 1, S2: 2, S3: 3, S4: 4, S5: 5, S6: 6 };
  const LAYER_SHORT = { S1: "Фунд.", S2: "Прикл.", S3: "Появл.", S4: "Спрос", S5: "Прод.", S6: "Мир" };

  // Доминирующий тип подтверждающего артефакта по слою (для заголовков)
  const EVIDENCE_KIND = {
    S1: "Публикации", S2: "Публикации, гранты, PoC", S3: "Патенты и прототипы",
    S4: "Раунды и заказчики", S5: "Продукты и сделки", S6: "Акты и стандарты",
  };
  // Пулы для генерации демо-артефактов (научные источники доминируют)
  const JOURNALS = ["Nature", "Science", "arXiv", "PNAS", "Cell", "Phys. Rev. Lett.", "IEEE Trans.", "Nature Comm.", "PRX", "J. Am. Chem. Soc.", "Adv. Materials"];
  const LABS = ["MIT", "Stanford", "ETH Zürich", "Max Planck Inst.", "Caltech", "Сколтех", "Univ. Tokyo", "Tsinghua", "Oxford", "EPFL", "KAIST", "Fraunhofer"];
  const AUTHORS = ["Chen", "Müller", "Иванов", "Tanaka", "Silva", "Kim", "Novák", "Rossi", "Schmidt", "Zhang", "García", "Петров", "Yamamoto", "Dubois"];
  const PUB_TOPICS = ["теоретическая модель", "масштабируемый подход", "экспериментальное подтверждение", "обзор и метаанализ", "новый механизм", "воспроизводимость результата", "предел эффективности"];
  const FUNDERS = ["NSF", "EU Horizon", "DARPA", "РНФ", "Wellcome Trust", "ARPA-E", "JST", "ERC"];
  const APPLICANTS = ["IBM", "Google", "Samsung", "Siemens", "BASF", "Roche", "Huawei", "Bosch", "TSMC", "Intel", "Toyota", "Novartis"];
  const IPC = ["G06N", "H01L", "C12N", "H04W", "B25J", "G01N", "H01M", "C07K", "G06F", "H04B", "A61K", "C22C"];
  const PTITLES = ["метод и устройство", "система и способ", "архитектура", "композиция материала", "протокол управления", "способ синтеза"];
  const JURIS = ["US", "EP", "WO", "CN", "JP", "RU"];
  const REPO_LANG = ["Python", "C++", "Rust", "Verilog", "CUDA", "Julia"];
  const VCS = ["Sequoia", "a16z", "Khosla Ventures", "SoftBank", "Lux Capital", "DCVC", "Breakthrough Energy"];
  const STARTUPS = ["Helion", "Commonwealth", "Formic", "Aether", "Nuvia", "Cortex", "Volta", "Kairos", "Lumen"];
  const REGS = ["FDA", "EMA", "Еврокомиссия", "ISO", "IEEE SA", "Роспатент", "ITU"];
  const REG_ACTS = ["рамочный регламент", "стандарт безопасности", "директива о сертификации", "этические требования", "протокол испытаний"];

  // Типы барьеров (что мешает переходу на следующий слой)
  const BARRIER_TYPES = [
    { id: "tech", name: "Технические", color: "#6ea8ff" },
    { id: "fin", name: "Финансирование", color: "#8b7bff" },
    { id: "infra", name: "Инфраструктура", color: "#4fb6e0" },
    { id: "demand", name: "Спрос / рынок", color: "#f2c14e" },
    { id: "reg", name: "Регуляторные", color: "#f56b8b" },
    { id: "talent", name: "Кадры / компетенции", color: "#35c9a6" },
  ];
  const BARRIER_NOTE = {
    tech: "нерешённые инженерные ограничения и воспроизводимость",
    fin: "разрыв между грантовым и венчурным финансированием",
    infra: "отсутствие производственной/испытательной инфраструктуры",
    demand: "неустойчивый платёжеспособный спрос",
    reg: "незрелые регуляторные рамки и сертификация",
    talent: "дефицит критических компетенций",
  };

  const Store = {
    state: null,
    listeners: [],

    init: function () {
      const seedTech = window.TECHNOLOGIES_SEED, seedLC = window.LAYERS_CUTS_SEED;
      this.data = {
        techs: seedTech.technologies,
        edges: seedTech.convergenceEdges,
        domains: seedTech.domains,
        layers: seedLC.layers,
        cuts: seedLC.cuts,
        audiences: seedLC.audiences,
        linkTypes: seedLC.linkTypes,
      };
      this._augment();
      this._index();
      const saved = this._load();
      this.state = saved || this._fresh();
      this._deriveDemo();
      this._deriveEvidence();
      this._deriveBarriers();
    },

    _fresh: function () {
      return {
        theme: "dark",
        audience: null,          // null = все аудитории
        ui: {
          catalog: { q: "", layer: "", domain: "", aud: "", link: "", sort: "layer", view: "grid" },
          cutFilter: { layer: "", aud: "" },
          overviewTech: null,
        },
        layerViz: {},            // S1 -> индекс выбранной визуализации
        cutViz: {},              // R01 -> индекс
      };
    },

    // Точечные правки seed для наглядности (не меняют исходные файлы)
    _augment: function () {
      const r07 = this.data.cuts.find(function (c) { return c.id === "R07"; });
      if (r07) {
        // заменить абстрактную «линию» на наглядные кривые замещения и поставить первой
        const li = r07.visualizations.findIndex(function (v) { return v.type === "line"; });
        const sub = { name: "Кривые замещения: как одни технологии съедают другие", type: "substitution", audience: "A1" };
        if (li >= 0) r07.visualizations.splice(li, 1);
        r07.visualizations.unshift(sub);
      }
    },

    // --- индексы и справочные структуры ---
    _index: function () {
      const d = this.data;
      d.techById = {}; d.techs.forEach(function (t) { d.techById[t.id] = t; });
      d.layerById = {}; d.layers.forEach(function (l) { d.layerById[l.id] = l; });
      d.audById = {}; d.audiences.forEach(function (a) { d.audById[a.id] = a; });
      d.cutById = {}; d.cuts.forEach(function (c) { d.cutById[c.id] = c; });
      d.linkTypeById = {}; d.linkTypes.forEach(function (l) { d.linkTypeById[l.id] = l; });

      // обратные связи (кто ссылается на технологию)
      d.backlinks = {};
      d.techs.forEach(function (t) {
        (t.links || []).forEach(function (lk) {
          if (lk.target) { (d.backlinks[lk.target] = d.backlinks[lk.target] || []).push({ from: t.id, type: lk.type, note: lk.note }); }
        });
      });
      // рёбра конвергенции как соседства
      d.convNeighbors = {};
      d.edges.forEach(function (e) {
        (d.convNeighbors[e.source] = d.convNeighbors[e.source] || []).push(e.target);
        (d.convNeighbors[e.target] = d.convNeighbors[e.target] || []).push(e.source);
      });
    },

    // --- Производные «демо-данные» (детерминированы по id, без внешних обращений) ---
    _deriveDemo: function () {
      const d = this.data, U = window.U;
      // счётчики по слоям
      d.layerCounts = {}; d.layers.forEach(function (l) { d.layerCounts[l.id] = 0; });
      d.techs.forEach(function (t) { d.layerCounts[t.currentLayer] = (d.layerCounts[t.currentLayer] || 0) + 1; });
      // связи по типам
      d.linkCounts = {};
      d.techs.forEach(function (t) { (t.links || []).forEach(function (lk) { d.linkCounts[lk.type] = (d.linkCounts[lk.type] || 0) + 1; }); });
      // домены (укрупнённые — первый сегмент до "/")
      d.domainGroups = {};
      d.techs.forEach(function (t) {
        const g = t.domain.split("/")[0];
        (d.domainGroups[g] = d.domainGroups[g] || []).push(t.id);
      });
      // синтетические метрики на технологию (стабильные): цитируемость, инвестиции, патенты, TAM, риск, готовность
      const order = { S1: 1, S2: 2, S3: 3, S4: 4, S5: 5, S6: 6 };
      d.metrics = {};
      d.techs.forEach(function (t) {
        const r = U.rng(t.id), lv = order[t.currentLayer];
        d.metrics[t.id] = {
          maturity: lv / 6,
          citations: U.pick(r, 40, 900),      // цитируемость (условно)
          growth: U.pick(r, -5, 60),          // темп роста цитирований, %
          patents: U.pick(r, 3, 60) + lv * 6, // патентная активность
          invest: U.pick(r, 20, 900, 0),      // накопл. инвестиции, млн $
          rounds: U.pick(r, 1, 9) + lv,       // раунды
          tam: U.pick(r, 5, 480, 0),          // TAM, млрд $
          risk: +(1 - lv / 7 + (r() - 0.5) * 0.2).toFixed(2), // риск (выше на ранних слоях)
          hype: +(r()).toFixed(2),            // перегрев
          ttm: U.pick(r, 2, 22),              // time-to-market / до прорыва, лет
          conv: (d.convNeighbors[t.id] || []).length,
        };
      });
    },

    // --- persistence ---
    _load: function () { try { const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
    save: function () { try { localStorage.setItem(LS_KEY, JSON.stringify(this.state)); } catch (e) {} },
    reset: function () { this.state = this._fresh(); this.save(); this._emit(); },

    // --- подписки ---
    on: function (fn) { this.listeners.push(fn); },
    _emit: function () { this.listeners.forEach(function (f) { f(); }); },

    // --- сеттеры ---
    setTheme: function (t) { this.state.theme = t; document.documentElement.setAttribute("data-theme", t); this.save(); },
    toggleTheme: function () { this.setTheme(this.state.theme === "dark" ? "light" : "dark"); this._emit(); },
    setAudience: function (a) { this.state.audience = a; this.save(); this._emit(); },
    patchUI: function (path, patch) { Object.assign(this.state.ui[path], patch); this.save(); },
    setLayerViz: function (l, i) { this.state.layerViz[l] = i; this.save(); },
    setCutViz: function (c, i) { this.state.cutViz[c] = i; this.save(); },

    // --- геттеры данных ---
    layerColor: function (id) { return LAYER_COLORS[id]; },
    audColor: function (id) { return AUD_COLORS[id]; },
    audIcon: function (id) { return AUD_ICON[id]; },
    linkColor: function (id) { return LINK_COLORS[id]; },
    layerColors: LAYER_COLORS, audColors: AUD_COLORS, linkColors: LINK_COLORS,

    tech: function (id) { return this.data.techById[id]; },
    layer: function (id) { return this.data.layerById[id]; },
    aud: function (id) { return this.data.audById[id]; },
    cut: function (id) { return this.data.cutById[id]; },
    audName: function (id) { const a = this.data.audById[id]; return a ? a.name : id; },
    audShort: function (id) { return AUD_SHORT[id] || id; },
    linkTypeName: function (id) { const l = this.data.linkTypeById[id]; return l ? l.name : id; },

    metrics: function (id) { return this.data.metrics[id]; },
    techsOnLayer: function (lid) { return this.data.techs.filter(function (t) { return t.currentLayer === lid; }); },
    techsWithPresence: function (lid) {
      return this.data.techs.filter(function (t) { return t.byLayer && t.byLayer[lid]; });
    },
    // технологии, релевантные разрезу: пересечение по слоям
    techsForCut: function (cut) {
      const set = cut.layers;
      return this.data.techs.filter(function (t) {
        for (const l of set) if (t.byLayer && t.byLayer[l]) return true;
        return false;
      });
    },
    // разрезы, где встречается технология (по слоям присутствия)
    cutsForTech: function (t) {
      const layers = Object.keys(t.byLayer || {});
      return this.data.cuts.filter(function (c) { return c.layers.some(function (l) { return layers.indexOf(l) >= 0; }); });
    },
    // разрезы, релевантные аудитории
    cutsForAudience: function (aid) { return this.data.cuts.filter(function (c) { return c.audiences.indexOf(aid) >= 0; }); },

    layerOrder: function (id) { return LAYER_NUM[id]; },

    // --- отображаемые имена слоёв ---
    layerNum: function (id) { return LAYER_NUM[id]; },
    layerShort: function (id) { return LAYER_SHORT[id]; },
    layerLabel: function (id) { return LAYER_NUM[id] + ". " + LAYER_SHORT[id]; },   // «1. Фунд.»
    layerTick: function (id) { return LAYER_NUM[id] + "·" + LAYER_SHORT[id]; },     // компактно для осей
    barrierTypes: BARRIER_TYPES,
    evidenceKind: function (lid) { return EVIDENCE_KIND[lid]; },

    // ---------- Подтверждающие артефакты (что «держит» технологию на слое) ----------
    _deriveEvidence: function () {
      const d = this.data, U = window.U;
      const short = function (t) { return t.name.replace(/\s*\(.*?\)/g, "").split(/[\/,]/)[0].trim(); };
      const lower = function (s) { return s.charAt(0).toLowerCase() + s.slice(1); };
      const pick = function (r, arr) { return arr[Math.floor(r() * arr.length) % arr.length]; };
      // фабрики артефактов — научные (публикации/патенты) доминируют
      function pub(r, s) {
        const yr = 2015 + Math.floor(r() * 11);
        return { kind: "Публикация", title: "«" + s + ": " + pick(r, PUB_TOPICS) + "»",
          meta: pick(r, JOURNALS) + " · " + yr + " · " + (30 + Math.floor(r() * 950)) + " цит. · " + pick(r, AUTHORS) + " и др., " + pick(r, LABS) };
      }
      function patent(r, s) {
        const yr = 2016 + Math.floor(r() * 10);
        return { kind: "Патент", title: pick(r, JURIS) + (2000000 + Math.floor(r() * 8999999)) + " · " + pick(r, APPLICANTS),
          meta: pick(r, PTITLES) + " для «" + lower(s) + "» · IPC " + pick(r, IPC) + " · " + yr };
      }
      function repo(r, s) {
        return { kind: "Репозиторий", title: "github.com/" + lower(pick(r, APPLICANTS)) + "/" + s.split(" ")[0].toLowerCase(),
          meta: "★ " + (200 + Math.floor(r() * 24000)) + " · " + pick(r, REPO_LANG) };
      }
      function grant(r, s) {
        const yr = 2016 + Math.floor(r() * 10);
        return { kind: "Грантовый проект", title: pick(r, LABS) + " — PoC «" + s + "»", meta: pick(r, FUNDERS) + " · $" + (1 + Math.floor(r() * 18)) + " млн · " + yr };
      }
      function round(r) {
        const yr = 2019 + Math.floor(r() * 7);
        return { kind: "Венчурный раунд", title: pick(r, ["Seed", "Series A", "Series B", "Series C"]) + " — " + pick(r, STARTUPS), meta: "$" + (5 + Math.floor(r() * 240)) + " млн · " + pick(r, VCS) + " · " + yr };
      }
      function customer(r) { return { kind: "Ранний заказчик", title: pick(r, APPLICANTS) + " — пилотный контракт", meta: "$" + (1 + Math.floor(r() * 40)) + " млн · " + (2021 + Math.floor(r() * 5)) }; }
      function product(r, s) { return { kind: "Продукт / сделка", title: pick(r, APPLICANTS.concat(STARTUPS)) + " — коммерческий выпуск «" + s + "»", meta: "доля " + (2 + Math.floor(r() * 28)) + "% · выручка $" + (20 + Math.floor(r() * 900)) + " млн" }; }
      function reg(r) { return { kind: "Регуляторный акт", title: pick(r, REGS) + " — " + pick(r, REG_ACTS), meta: (2020 + Math.floor(r() * 6)) + " · " + pick(r, ["ЕС", "США", "глобально", "отрасль"]) }; }
      function standard(r, s) { return { kind: "Стандарт", title: pick(r, ["ISO", "IEEE", "IEC", "ГОСТ Р"]) + " — стандарт для «" + lower(s) + "»", meta: "статус: подготовка · " + (2023 + Math.floor(r() * 4)) }; }

      d.evidence = {};
      d.techs.forEach(function (t) {
        const ev = {}, s = short(t), R = function (k) { return U.rng(t.id + k); };
        const has = function (l) { return t.byLayer && t.byLayer[l]; };
        if (has("S1")) { const r = R("S1"); const n = 2 + Math.floor(r() * 2); const a = []; for (let i = 0; i < n; i++) a.push(pub(r, s)); ev.S1 = a; }
        if (has("S2")) { const r = R("S2"); const a = [pub(r, s), grant(r, s)]; if (r() > 0.5) a.push(pub(r, s)); ev.S2 = a; }
        if (has("S3")) { const r = R("S3"); const n = 2 + Math.floor(r() * 2); const a = []; for (let i = 0; i < n; i++) a.push(patent(r, s)); a.push(repo(r, s)); if (r() > 0.5) a.push(pub(r, s)); ev.S3 = a; }
        if (has("S4")) { const r = R("S4"); const a = [round(r)]; if (r() > 0.35) a.push(customer(r)); if (r() > 0.5) a.push(patent(r, s)); ev.S4 = a; }
        if (has("S5")) { const r = R("S5"); const a = [product(r, s)]; if (r() > 0.5) a.push({ kind: "IPO / сделка", title: pick(r, APPLICANTS) + " — IPO / M&A", meta: "оценка $" + (1 + Math.floor(r() * 40)) + " млрд · " + (2021 + Math.floor(r() * 5)) }); ev.S5 = a; }
        if (has("S6")) { const r = R("S6"); const a = [reg(r)]; if (r() > 0.4) a.push(standard(r, s)); ev.S6 = a; }
        d.evidence[t.id] = ev;
      });
    },
    evidenceFor: function (techId, lid) { return (this.data.evidence[techId] || {})[lid] || []; },
    // артефакты слоя, агрегированные по всем технологиям (для вкладки слоя)
    layerEvidence: function (lid, limit) {
      const d = this.data, out = [];
      d.techs.forEach(function (t) {
        (((d.evidence[t.id] || {})[lid]) || []).forEach(function (it) { out.push(Object.assign({ techId: t.id, techName: t.name }, it)); });
      });
      return limit ? out.slice(0, limit) : out;
    },

    // ---------- Барьеры перехода ----------
    _deriveBarriers: function () {
      const d = this.data, U = window.U;
      // весовые предрасположенности по типу барьера в зависимости от слоя/домена
      d.barriers = {};
      d.techs.forEach(function (t) {
        const r = U.rng("bar" + t.id), lv = LAYER_NUM[t.currentLayer];
        const dom = t.domain;
        const bias = {
          tech: 5 - lv + 1,                                   // технические выше на ранних слоях
          fin: (lv >= 2 && lv <= 3) ? 5 : 3,                  // «долина смерти» S2→S3
          infra: /Энерг|Косм|Атом|Производ|Транспорт/.test(dom) ? 4 : 2,
          demand: lv >= 4 ? 4 : 2,
          reg: /Био|Медиц|Атом|Безопас|Экол/.test(dom) ? 5 : 2,
          talent: 3,
        };
        const list = BARRIER_TYPES.map(function (b) {
          const sev = Math.max(0, Math.min(5, Math.round((bias[b.id] || 2) * (0.55 + r() * 0.7))));
          return { id: b.id, name: b.name, color: b.color, severity: sev, note: BARRIER_NOTE[b.id] };
        }).filter(function (b) { return b.severity >= 1; }).sort(function (a, b) { return b.severity - a.severity; });
        d.barriers[t.id] = list;
      });
    },
    barriersFor: function (techId) { return this.data.barriers[techId] || []; },
    // суммарная острота барьеров по типам для набора технологий
    barrierAggregate: function (techs) {
      const agg = {}; BARRIER_TYPES.forEach(function (b) { agg[b.id] = { id: b.id, name: b.name, color: b.color, value: 0, count: 0 }; });
      const self = this;
      techs.forEach(function (t) { self.barriersFor(t.id).forEach(function (b) { agg[b.id].value += b.severity; agg[b.id].count++; }); });
      return BARRIER_TYPES.map(function (b) { return agg[b.id]; }).filter(function (b) { return b.value > 0; }).sort(function (a, b) { return b.value - a.value; });
    },
  };

  window.Store = Store;
})();
