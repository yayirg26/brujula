/* ==========================================================================
   app.js — Interactive Business KPI Dashboard & Executive Reporting Tool
   Vanilla JS + Chart.js. No build step. UI copy comes from i18n.js (EN / ES).
   Internal data, filters and CSV always use canonical English keys.
   ========================================================================== */
(function () {
  'use strict';

  const D = window.KPI_DATA;
  const I = window.I18N;
  const t = I.t;
  const SERIES_VARS = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5'];
  const VARIABLE_COST_SHARE = 0.35;
  const CSV_HEADERS = ['Date', 'ID', 'Type', 'Client/Vendor', 'Service', 'Description', 'Amount', 'Status'];
  const OTHER = '__other__';

  const state = {
    data: [],
    source: { kind: 'demo', name: '', mode: '' },
    services: [],
    years: [],
    year: null,
    period: 'all',
    service: 'all',
    chartType: 'bar',
    table: { type: 'all', q: '', sort: 'date', dir: 'desc', page: 0, size: 10 },
    sim: { clientsRatio: 0, ticketRatio: 0, cost: 0, preset: null },
    simBase: null,
    pendingImport: null,
  };
  const charts = { trend: null, mix: null, sim: null };
  let cube = new Map();

  /* ------------------------------------------------------------ utilities */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + f(x), 0);

  // Reporting currency is USD, so money keeps one consistent en-US format in both languages.
  const moneyFull = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const moneyCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
  const fmtMoney = (v, compact = false) => (v == null || !isFinite(v) ? '—' : (compact ? moneyCompact : moneyFull).format(v));
  const fmtPct = (v, d = 1) => (v == null || !isFinite(v) ? '—' : `${(v * 100).toFixed(d)}%`);
  const fmtInt = (v) => new Intl.NumberFormat('en-US').format(Math.round(v));
  const signed = (v, f) => (v > 0 ? '+' : v < 0 ? '−' : '±') + f(Math.abs(v));

  /* ------------------------------------------------------------ display labels (i18n) */
  const months = (kind) => t(`months.${kind}`);
  const svcLabel = (s) => (s === 'all' ? t('filters.allServices') : s === OTHER ? t('chart.other') : I.label('service', s));
  const typeLabel = (type) => I.label('type', type);
  const statusLabel = (r) => (r.type === 'Pipeline' ? I.label('stage', r.status) : I.label('status', r.status));

  function alpha(color, a) {
    const c = color.trim();
    if (c.startsWith('#')) {
      const h = c.length === 4 ? c.slice(1).split('').map((x) => x + x).join('') : c.slice(1, 7);
      const n = parseInt(h, 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    }
    return c;
  }

  const ICONS = {
    up: '<svg class="ico" viewBox="0 0 24 24"><path d="M7 17L17 7M8 7h9v9"/></svg>',
    down: '<svg class="ico" viewBox="0 0 24 24"><path d="M7 7l10 10M17 8v9H8"/></svg>',
    flat: '<svg class="ico" viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
    check: '<svg class="ico" viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>',
    clock: '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    alert: '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>',
    dollar: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 2v20M17 6.5C16 5 14.2 4.5 12 4.5c-2.8 0-4.5 1.3-4.5 3.3 0 4.7 9.5 2.4 9.5 7.6 0 2-1.9 3.6-5 3.6-2.4 0-4.2-.8-5.2-2.5"/></svg>',
    percent: '<svg class="ico" viewBox="0 0 24 24"><path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/></svg>',
    funnel: '<svg class="ico" viewBox="0 0 24 24"><path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/></svg>',
    target: '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
  };

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 3200);
  }

  /* ------------------------------------------------------------ data model */
  function prep(rows) {
    return rows.map((r) => ({ ...r, amount: Number(r.amount) || 0, _y: +r.date.slice(0, 4), _m: +r.date.slice(5, 7) - 1 }));
  }

  function setData(rows, source) {
    state.data = prep(rows);
    state.source = source;
    // services: canonical order first (fixed colors), then any extra services by revenue
    const seen = new Map();
    state.data.forEach((r) => { if (r.type === 'Revenue') seen.set(r.service, (seen.get(r.service) || 0) + r.amount); else if (!seen.has(r.service)) seen.set(r.service, 0); });
    const canon = D.SERVICES.filter((s) => seen.has(s));
    const extra = [...seen.keys()].filter((s) => !D.SERVICES.includes(s)).sort((a, b) => seen.get(b) - seen.get(a));
    state.services = [...canon, ...extra];
    state.years = [...new Set(state.data.map((r) => r._y))].sort((a, b) => b - a);
    buildCube();
  }

  function buildCube() {
    cube = new Map();
    state.data.forEach((r) => {
      const k = `${r._y}|${r._m}`;
      if (!cube.has(k)) cube.set(k, { Revenue: {}, Expense: {}, Pipeline: {} });
      const bucket = cube.get(k)[r.type];
      if (bucket) bucket[r.service] = (bucket[r.service] || 0) + r.amount;
    });
  }

  function cubeSum(year, monthList, type, service = 'all') {
    let total = 0;
    monthList.forEach((m) => {
      const c = cube.get(`${year}|${m}`);
      if (!c) return;
      const b = c[type];
      total += service === 'all' ? sum(Object.values(b)) : b[service] || 0;
    });
    return total;
  }

  const ALL_MONTHS = [...Array(12).keys()];
  function monthsOf(period) {
    if (period === 'all') return ALL_MONTHS;
    const n = +period.slice(1);
    return period[0] === 'q' ? [n * 3, n * 3 + 1, n * 3 + 2] : [n];
  }
  function prevOf(year, period) {
    if (period === 'all') return { year: year - 1, period: 'all' };
    const n = +period.slice(1);
    if (period[0] === 'q') return n > 0 ? { year, period: `q${n - 1}` } : { year: year - 1, period: 'q3' };
    return n > 0 ? { year, period: `m${n - 1}` } : { year: year - 1, period: 'm11' };
  }
  function periodLabel(year, period, short = false) {
    if (period === 'all') return t(short ? 'period.fyShort' : 'period.fy', { year });
    const n = +period.slice(1);
    if (period[0] === 'q') return t('period.q', { n: n + 1, year });
    return t('period.month', { month: months(short ? 'short' : 'long')[n], year });
  }
  /** Language-neutral period code for file names (e.g. 2025-12, 2025-Q4, 2025-FY). */
  function periodCode(year, period) {
    if (period === 'all') return `${year}-FY`;
    const n = +period.slice(1);
    return period[0] === 'q' ? `${year}-Q${n + 1}` : `${year}-${String(n + 1).padStart(2, '0')}`;
  }
  const periodKind = (p) => (p === 'all' ? 'Annual' : p[0] === 'q' ? 'Quarterly' : 'Monthly');
  const revenueTitle = (p) => t(`kpi.revenue.${periodKind(p)}`);

  let avgMonthlyRevenue = 0;
  function computeAverages() {
    const totals = [];
    cube.forEach((c) => { const v = sum(Object.values(c.Revenue)); if (v > 0) totals.push(v); });
    avgMonthlyRevenue = totals.length ? sum(totals) / totals.length : 0;
  }

  /** Revenue goal per month: same month last year × (1 + growth); else dataset average × uplift. */
  function targetFor(year, month, service) {
    const prior = cubeSum(year - 1, [month], 'Revenue');
    let target = prior > 0 ? prior * (1 + D.TARGET_GROWTH) : avgMonthlyRevenue * D.FALLBACK_TARGET_UPLIFT;
    if (service !== 'all') {
      const yearTotal = cubeSum(year, ALL_MONTHS, 'Revenue');
      const share = yearTotal > 0 ? cubeSum(year, ALL_MONTHS, 'Revenue', service) / yearTotal : 1 / Math.max(1, state.services.length);
      target *= share;
    }
    return Math.round(target / 100) * 100;
  }

  function select(year, period, service) {
    const set = new Set(monthsOf(period));
    return state.data.filter((r) => r._y === year && set.has(r._m) && (service === 'all' || r.service === service));
  }

  function metrics(year, period, service) {
    const rows = select(year, period, service);
    const rev = rows.filter((r) => r.type === 'Revenue');
    const exp = rows.filter((r) => r.type === 'Expense');
    const pipe = rows.filter((r) => r.type === 'Pipeline');
    const revenue = sum(rev, (r) => r.amount);
    const expenses = sum(exp, (r) => r.amount);
    const pipeline = sum(pipe, (r) => r.amount);
    const monthList = monthsOf(period);
    const activeMonths = monthList.filter((m) => cubeSum(year, [m], 'Revenue', service) > 0);
    const target = sum(activeMonths.length ? activeMonths : monthList, (m) => targetFor(year, m, service));
    const overdue = rev.filter((r) => r.status === 'Overdue');
    const clientsPerMonth = activeMonths.map((m) => new Set(rev.filter((r) => r._m === m).map((r) => r.party)).size);
    return {
      year, period, service, rows,
      hasData: rows.length > 0,
      revenue, expenses, pipeline,
      profit: revenue - expenses,
      margin: revenue > 0 ? (revenue - expenses) / revenue : null,
      invoices: rev.length,
      clients: new Set(rev.map((r) => r.party)).size,
      deals: pipe.length,
      topDeal: pipe.slice().sort((a, b) => b.amount - a.amount)[0] || null,
      target,
      goal: target > 0 && revenue > 0 ? revenue / target : null,
      overdueCount: overdue.length,
      overdueSum: sum(overdue, (r) => r.amount),
      activeMonths,
      avgClients: clientsPerMonth.length ? sum(clientsPerMonth) / clientsPerMonth.length : 0,
    };
  }

  function current() { return metrics(state.year, state.period, state.service); }
  function previous() { const p = prevOf(state.year, state.period); return metrics(p.year, p.period, state.service); }

  /* ------------------------------------------------------------ filters UI */
  function renderFilterOptions() {
    $('#fYear').innerHTML = state.years.map((y) => `<option value="${y}">${y}</option>`).join('');
    $('#fPeriod').innerHTML =
      `<option value="all">${esc(t('filters.fullYear'))}</option>` +
      `<optgroup label="${esc(t('filters.quarters'))}">${[0, 1, 2, 3].map((n) => `<option value="q${n}">${esc(t('period.qShort', { n: n + 1 }))}</option>`).join('')}</optgroup>` +
      `<optgroup label="${esc(t('filters.months'))}">${months('long').map((m, i) => `<option value="m${i}">${esc(m)}</option>`).join('')}</optgroup>`;
    $('#fService').innerHTML = `<option value="all">${esc(t('filters.allServices'))}</option>` +
      state.services.map((s) => `<option value="${esc(s)}">${esc(svcLabel(s))}</option>`).join('');
  }
  function syncFilterInputs() {
    $('#fYear').value = String(state.year);
    $('#fPeriod').value = state.period;
    $('#fService').value = state.service;
  }
  function latestMonth(year) {
    const ms = state.data.filter((r) => r._y === year && r.type !== 'Pipeline').map((r) => r._m);
    return ms.length ? Math.max(...ms) : 11;
  }
  function defaultFilters() {
    state.year = state.years[0];
    state.period = `m${latestMonth(state.year)}`;
    state.service = 'all';
  }

  function sourceLabel() {
    const s = state.source;
    if (s.kind === 'empty') return t('source.empty');
    return t(s.mode === 'merge' ? 'source.merged' : 'source.imported', { name: s.name });
  }
  function renderSource() {
    const el = $('#dataSource');
    el.innerHTML = esc(sourceLabel()) +
      (state.source.kind !== 'empty' ? ` · <button type="button" id="btnResetData" class="underline decoration-dotted underline-offset-2 hover:text-ink">${esc(t('source.reset'))}</button>` : '');
    const rb = $('#btnResetData');
    if (rb) rb.addEventListener('click', () => { clearData(); toast(t('toast.cleared')); });
  }

  /* ------------------------------------------------------------ KPI cards */
  function trendBadge(curr, prev, mode, prevLabel, hasPrev) {
    if (!hasPrev || curr == null || prev == null || (mode === 'pct' && prev === 0)) {
      return `<span class="trend flat">${ICONS.flat}<span>${esc(t('trend.noPrior'))}</span></span>`;
    }
    const delta = mode === 'pct' ? (curr - prev) / Math.abs(prev) : (curr - prev) * 100;
    const dir = Math.abs(delta) < (mode === 'pct' ? 0.0005 : 0.05) ? 'flat' : delta > 0 ? 'up' : 'down';
    const txt = mode === 'pct' ? `${Math.abs(delta * 100).toFixed(1)}%` : t('trend.pts', { v: Math.abs(delta).toFixed(1) });
    const title = t('trend.title', { dir: t(`trend.${dir}`), value: txt, prev: prevLabel });
    return `<span class="trend ${dir}" title="${esc(title)}">${ICONS[dir]}<span>${esc(txt)}</span><span class="sr-only"> ${esc(title)}</span></span>`;
  }

  function renderKPIs() {
    const m = current();
    const p = previous();
    const pp = prevOf(state.year, state.period);
    const prevLabel = periodLabel(pp.year, pp.period, true);
    const hasPrev = p.hasData;
    const cards = [
      {
        label: revenueTitle(state.period), icon: ICONS.dollar,
        value: fmtMoney(m.revenue, true),
        badge: trendBadge(m.revenue, p.revenue, 'pct', prevLabel, hasPrev),
        meta: t('kpi.metaRevenue', { invoices: fmtInt(m.invoices), clients: fmtInt(m.clients) }),
      },
      {
        label: t('kpi.margin'), icon: ICONS.percent,
        value: fmtPct(m.margin),
        badge: trendBadge(m.margin, p.margin, 'pts', prevLabel, hasPrev),
        meta: t('kpi.metaMargin', { profit: fmtMoney(m.profit, true), costs: fmtMoney(m.expenses, true) }),
      },
      {
        label: t('kpi.pipeline'), icon: ICONS.funnel,
        value: fmtMoney(m.pipeline, true),
        badge: trendBadge(m.pipeline, p.pipeline, 'pct', prevLabel, hasPrev),
        meta: t('kpi.metaPipeline', { deals: fmtInt(m.deals), clients: fmtInt(m.clients) }),
      },
      {
        label: t('kpi.goal'), icon: ICONS.target,
        value: fmtPct(m.goal, 0),
        badge: trendBadge(m.goal, p.goal, 'pts', prevLabel, hasPrev),
        meta: t('kpi.metaGoal', { revenue: fmtMoney(m.revenue, true), target: fmtMoney(m.target, true) }),
        progress: m.goal,
      },
    ];
    $('#kpis').innerHTML = cards.map((c) => `
      <article class="card kpi">
        <div class="kpi-top">
          <span class="kpi-label"><span class="kpi-icon">${c.icon}</span>${esc(c.label)}</span>
          ${c.badge}
        </div>
        <div class="kpi-value">${c.value}</div>
        ${c.progress !== undefined ? `<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round((c.progress || 0) * 100)}"><i style="width:${Math.min(100, (c.progress || 0) * 100)}%"></i></div>` : ''}
        <div class="kpi-meta"><span>${esc(c.meta)}</span><span>${esc(t('kpi.vs', { prev: prevLabel }))}</span></div>
      </article>`).join('');

    $('#scopeLine').textContent = t('scope', {
      period: periodLabel(state.year, state.period), service: svcLabel(state.service), prev: periodLabel(pp.year, pp.period),
    });
  }

  /* ------------------------------------------------------------ chart theme */
  function theme() {
    return {
      ink: cssVar('--ink'), ink2: cssVar('--ink-2'), muted: cssVar('--muted'),
      grid: cssVar('--grid'), axis: cssVar('--axis'), surface: cssVar('--surface'), line: cssVar('--line'),
      band: cssVar('--band'), baseline: cssVar('--baseline'),
      series: SERIES_VARS.map(cssVar),
    };
  }
  function tooltipStyle(th) {
    return {
      backgroundColor: th.surface, titleColor: th.ink, bodyColor: th.ink2, footerColor: th.ink,
      borderColor: th.line, borderWidth: 1, padding: 10, cornerRadius: 8, boxPadding: 4, usePointStyle: true,
      titleFont: { family: 'Inter', weight: '600', size: 12 }, bodyFont: { family: 'Inter', size: 12 },
      footerFont: { family: 'Inter', weight: '600', size: 12 },
    };
  }
  Chart.defaults.font.family = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";
  Chart.defaults.font.size = 12;

  const inPeriod = (i) => monthsOf(state.period).includes(i);

  const bandPlugin = {
    id: 'periodBand',
    beforeDatasetsDraw(chart) {
      if (state.period === 'all') return;
      const ms = monthsOf(state.period);
      const x = chart.scales.x;
      const step = x.getPixelForValue(1) - x.getPixelForValue(0);
      const x0 = x.getPixelForValue(ms[0]) - step / 2;
      const x1 = x.getPixelForValue(ms[ms.length - 1]) + step / 2;
      const { top, bottom } = chart.chartArea;
      const ctx = chart.ctx;
      ctx.save();
      ctx.fillStyle = cssVar('--band');
      ctx.fillRect(x0, top, x1 - x0, bottom - top);
      ctx.restore();
    },
  };

  /* ------------------------------------------------------------ trend chart */
  function trendConfig() {
    const th = theme();
    const rev = ALL_MONTHS.map((m) => cubeSum(state.year, [m], 'Revenue', state.service) || null);
    const exp = ALL_MONTHS.map((m) => cubeSum(state.year, [m], 'Expense', state.service) || null);
    const isBar = state.chartType === 'bar';
    const colorFor = (base) => (ctx) => (inPeriod(ctx.dataIndex) ? base : alpha(base, 0.3));
    const ds = (label, data, color) => isBar
      ? { label, data, backgroundColor: colorFor(color), hoverBackgroundColor: color, borderRadius: 4, borderSkipped: 'start', barPercentage: 0.86, categoryPercentage: 0.66, maxBarThickness: 22 }
      : { label, data, borderColor: color, backgroundColor: color, borderWidth: 2, tension: 0.32, spanGaps: true,
          pointRadius: (ctx) => (inPeriod(ctx.dataIndex) ? 4 : 2.5), pointHoverRadius: 6,
          pointBackgroundColor: colorFor(color), pointBorderColor: th.surface, pointBorderWidth: 2 };
    return {
      type: state.chartType,
      data: { labels: months('short'), datasets: [ds(t('chart.revenue'), rev, th.series[0]), ds(t('chart.expenses'), exp, th.series[1])] },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        animation: { duration: 450 },
        layout: { padding: { top: 4 } },
        scales: {
          x: { offset: true, grid: { display: false }, border: { color: th.axis }, ticks: { color: th.muted } },
          y: {
            beginAtZero: true, grid: { color: th.grid, drawTicks: false }, border: { display: false },
            ticks: { color: th.muted, padding: 8, maxTicksLimit: 6, callback: (v) => fmtMoney(v, true) },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipStyle(th),
            callbacks: {
              title: (items) => t('period.month', { month: months('long')[items[0].dataIndex], year: state.year }),
              label: (c) => ` ${c.dataset.label}: ${fmtMoney(c.parsed.y)}`,
              footer: (items) => {
                const r = items.find((i) => i.datasetIndex === 0)?.parsed.y || 0;
                const e = items.find((i) => i.datasetIndex === 1)?.parsed.y || 0;
                return r ? t('chart.netProfit', { profit: fmtMoney(r - e), margin: fmtPct((r - e) / r) }) : '';
              },
            },
          },
        },
        onClick: (evt, els) => {
          if (!els.length) return;
          const m = els[0].index;
          state.period = state.period === `m${m}` ? 'all' : `m${m}`;
          onFiltersChanged();
        },
        onHover: (evt, els) => { evt.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
      },
      plugins: [bandPlugin],
    };
  }

  function renderTrend(rebuild = false) {
    const cfg = trendConfig();
    if (rebuild && charts.trend) { charts.trend.destroy(); charts.trend = null; }
    if (!charts.trend) charts.trend = new Chart($('#trendChart'), cfg);
    else { charts.trend.data = cfg.data; charts.trend.options = cfg.options; charts.trend.update(); }
    $('#trendSub').textContent = t('chart.trendSub', { year: state.year, service: svcLabel(state.service) });
  }

  /* ------------------------------------------------------------ mix (doughnut) */
  function mixRows() {
    const ms = monthsOf(state.period);
    const rows = state.services.map((s, i) => ({ name: s, value: cubeSum(state.year, ms, 'Revenue', s), idx: i }));
    // Fixed identity: first five services keep their slot color; anything beyond folds into "Other".
    const head = rows.slice(0, SERIES_VARS.length);
    const tail = rows.slice(SERIES_VARS.length);
    if (tail.length) head.push({ name: OTHER, value: sum(tail, (r) => r.value), idx: -1, members: tail.map((r) => r.name) });
    return head.filter((r) => r.value > 0 || r.idx >= 0);
  }

  const centerTextPlugin = {
    id: 'centerText',
    afterDraw(chart) {
      const total = sum(chart.data.datasets[0].data);
      const { ctx, chartArea: { left, right, top, bottom } } = chart;
      const cx = (left + right) / 2, cy = (top + bottom) / 2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = cssVar('--ink');
      ctx.font = "600 19px Inter, system-ui, sans-serif";
      ctx.fillText(total ? fmtMoney(total, true) : '—', cx, cy - 7);
      ctx.fillStyle = cssVar('--muted');
      ctx.font = "500 11px Inter, system-ui, sans-serif";
      ctx.fillText(t('chart.mixTotal'), cx, cy + 13);
      ctx.restore();
    },
  };

  function renderMix() {
    const th = theme();
    const rows = mixRows();
    const total = sum(rows, (r) => r.value);
    const sel = state.service;
    const colorOf = (r) => (r.idx >= 0 ? th.series[r.idx] : th.baseline);
    const colors = rows.map((r) => (sel === 'all' || sel === r.name ? colorOf(r) : alpha(colorOf(r), 0.25)));
    const cfg = {
      type: 'doughnut',
      data: {
        labels: rows.map((r) => svcLabel(r.name)),
        datasets: [{
          data: rows.map((r) => r.value), backgroundColor: colors, hoverBackgroundColor: rows.map(colorOf),
          borderColor: th.surface, borderWidth: 2, borderRadius: 3,
          offset: rows.map((r) => (sel === r.name ? 8 : 0)), hoverOffset: 6,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '72%', layout: { padding: 8 },
        animation: { duration: 450 },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipStyle(th),
            callbacks: { label: (c) => ` ${c.label}: ${fmtMoney(c.parsed)} (${fmtPct(total ? c.parsed / total : 0)})` },
          },
        },
        onClick: (evt, els) => { if (els.length) toggleService(rows[els[0].index]); },
        onHover: (evt, els) => { evt.native.target.style.cursor = els.length ? 'pointer' : 'default'; },
      },
      plugins: [centerTextPlugin],
    };
    if (!charts.mix) charts.mix = new Chart($('#mixChart'), cfg);
    else { charts.mix.data = cfg.data; charts.mix.options = cfg.options; charts.mix.update(); }

    $('#mixLegend').innerHTML = rows.map((r, i) => `
      <li><button type="button" data-i="${i}" class="${sel === r.name ? 'is-selected' : sel !== 'all' ? 'is-dim' : ''}" aria-pressed="${sel === r.name}">
        <i class="swatch" style="background:${colorOf(r)}"></i>
        <span class="name">${esc(svcLabel(r.name))}</span>
        <span class="val">${fmtMoney(r.value, true)}</span>
        <span class="pct">${fmtPct(total ? r.value / total : 0, 0)}</span>
      </button></li>`).join('') || `<li class="text-sm text-muted">${esc(t('chart.mixEmpty'))}</li>`;
    $$('#mixLegend button').forEach((b) => b.addEventListener('click', () => toggleService(rows[+b.dataset.i])));
  }

  function toggleService(row) {
    if (!row || row.idx < 0) { toast(t('chart.otherToast')); return; }
    state.service = state.service === row.name ? 'all' : row.name;
    onFiltersChanged();
  }

  /* ------------------------------------------------------------ what-if simulator */
  function computeSimBase() {
    const m = current();
    const n = Math.max(1, m.activeMonths.length);
    const revenue = m.revenue / n;
    const expenses = m.expenses / n;
    const clients = Math.max(1, Math.round(m.avgClients));
    const ticket = Math.max(10, Math.round(revenue / clients / 10) * 10); // snapped to the slider step
    return { revenue, expenses, clients, ticket, profit: revenue - expenses, months: n, has: m.revenue > 0 };
  }

  function setRangeFill(input) {
    const pct = ((+input.value - +input.min) / (+input.max - +input.min || 1)) * 100;
    input.style.setProperty('--pct', `${pct}%`);
  }

  function rebaseSimulator() {
    const b = (state.simBase = computeSimBase());
    const sC = $('#sClients'), sT = $('#sTicket'), sK = $('#sCost');
    sC.min = Math.max(1, Math.floor(b.clients * 0.5)); sC.max = Math.ceil(b.clients * 1.6) + 1; sC.step = 1;
    const tMin = Math.max(100, Math.floor((b.ticket * 0.6) / 100) * 100), tMax = Math.ceil((b.ticket * 1.5) / 100) * 100;
    sT.min = tMin; sT.max = Math.max(tMin + 100, tMax); sT.step = 10;
    sC.value = Math.round(b.clients * (1 + state.sim.clientsRatio));
    sT.value = Math.round((b.ticket * (1 + state.sim.ticketRatio)) / 10) * 10;
    sK.value = state.sim.cost;
    const scope = state.period[0] === 'm' ? periodLabel(state.year, state.period) : t('sim.monthlyAvg', { period: periodLabel(state.year, state.period) });
    $('#simBaseline').textContent = b.has
      ? t('sim.baseline', { scope, service: svcLabel(state.service), revenue: fmtMoney(b.revenue, true), costs: fmtMoney(b.expenses, true) })
      : t('sim.noRevenue');
    [sC, sT, sK, ...$$('[data-preset]')].forEach((el) => { el.disabled = !b.has; });
    if (!b.has) { renderSimEmpty(); return; }
    updateSimulator(false);
  }

  /** Empty state: no baseline → no projections (avoids plotting placeholder clients/ticket values). */
  function renderSimEmpty() {
    ['#oClients', '#oTicket', '#oCost'].forEach((id) => { $(id).textContent = '—'; });
    ['#dClients', '#dTicket', '#dCost'].forEach((id) => { $(id).textContent = t('sim.noBaseline'); });
    ['#sClients', '#sTicket', '#sCost'].forEach((id) => $(id).style.setProperty('--pct', '0%'));
    const tile = (key, cls = '') => `<div class="sim-stat ${cls}"><div class="lbl">${esc(t(`sim.stat.${key}`))}</div><div class="val">—</div><div class="dlt flat">${esc(t('sim.empty'))}</div></div>`;
    $('#simResults').innerHTML = tile('profit', 'hero') + tile('revenue') + tile('costs') + tile('margin') + tile('annual');
    if (charts.sim) { charts.sim.destroy(); charts.sim = null; }
    const box = $('#simChartBox');
    box.classList.add('is-empty');
    box.setAttribute('data-empty', t('sim.chartEmpty'));
    $$('[data-preset]').forEach((btn) => btn.classList.remove('is-active'));
  }

  function scenario() {
    const b = state.simBase;
    const clients = +$('#sClients').value;
    const ticket = +$('#sTicket').value;
    const cost = +$('#sCost').value;
    const revenue = clients * ticket;
    const expenses = b.expenses * ((1 - VARIABLE_COST_SHARE) + VARIABLE_COST_SHARE * (clients / b.clients)) * (1 + cost / 100);
    const baseRevenue = b.clients * b.ticket; // modeled baseline (clients × snapped ticket)
    return {
      clients, ticket, cost, revenue, expenses, profit: revenue - expenses,
      margin: revenue > 0 ? (revenue - expenses) / revenue : null,
      base: { revenue: baseRevenue, expenses: b.expenses, profit: baseRevenue - b.expenses, margin: baseRevenue > 0 ? (baseRevenue - b.expenses) / baseRevenue : null },
    };
  }

  function deltaHtml(v, f, isPts = false) {
    const dir = isPts ? (Math.abs(v) < 0.05 ? 'flat' : v > 0 ? 'up' : 'down') : (Math.abs(v) < 0.5 ? 'flat' : v > 0 ? 'up' : 'down');
    if (dir === 'flat') return `<div class="dlt flat">${esc(t('sim.delta.none'))}</div>`;
    const value = isPts ? t('sim.delta.pts', { v: signed(v, f) }) : signed(v, f);
    return `<div class="dlt ${dir}">${esc(t('sim.delta.vs', { delta: value }))}</div>`;
  }

  function updateSimulator(fromUser = true) {
    const b = state.simBase;
    const sC = $('#sClients'), sT = $('#sTicket'), sK = $('#sCost');
    [sC, sT, sK].forEach(setRangeFill);
    if (fromUser) {
      state.sim.clientsRatio = +sC.value / b.clients - 1;
      state.sim.ticketRatio = b.ticket ? +sT.value / b.ticket - 1 : 0;
      state.sim.cost = +sK.value;
    }
    const s = scenario();
    $('#oClients').textContent = fmtInt(s.clients);
    $('#oTicket').textContent = fmtMoney(s.ticket);
    $('#oCost').textContent = `${s.cost > 0 ? '+' : ''}${s.cost}%`;
    const dC = s.clients - b.clients, dT = b.ticket ? s.ticket / b.ticket - 1 : 0;
    $('#dClients').textContent = dC
      ? t('sim.footClientsDelta', { base: fmtInt(b.clients), delta: signed(dC, fmtInt) })
      : t('sim.footBase', { base: fmtInt(b.clients) });
    $('#dTicket').textContent = Math.abs(dT) > 0.001
      ? t('sim.footTicketDelta', { base: fmtMoney(b.ticket), delta: signed(dT * 100, (v) => v.toFixed(1)) })
      : t('sim.footBase', { base: fmtMoney(b.ticket) });
    $('#dCost').textContent = t(s.cost ? 'sim.footCostApplied' : 'sim.footCost', { base: fmtMoney(b.expenses, true) });

    const dProfit = s.profit - s.base.profit;
    const dCost = s.expenses - s.base.expenses;
    const costDelta = Math.abs(dCost) < 0.5
      ? `<div class="dlt flat">${esc(t('sim.delta.none'))}</div>`
      : `<div class="dlt ${dCost < 0 ? 'up' : 'down'}">${esc(t(dCost < 0 ? 'sim.delta.saved' : 'sim.delta.added', { v: fmtMoney(Math.abs(dCost), true) }))}</div>`;
    const lbl = (key) => esc(t(`sim.stat.${key}`));
    $('#simResults').innerHTML = `
      <div class="sim-stat hero">
        <div class="lbl">${lbl('profit')}</div>
        <div class="val">${fmtMoney(s.profit)}</div>
        ${deltaHtml(dProfit, (v) => fmtMoney(v))}
      </div>
      <div class="sim-stat"><div class="lbl">${lbl('revenue')}</div><div class="val">${fmtMoney(s.revenue, true)}</div>${deltaHtml(s.revenue - s.base.revenue, (v) => fmtMoney(v, true))}</div>
      <div class="sim-stat"><div class="lbl">${lbl('costs')}</div><div class="val">${fmtMoney(s.expenses, true)}</div>${costDelta}</div>
      <div class="sim-stat"><div class="lbl">${lbl('margin')}</div><div class="val">${fmtPct(s.margin)}</div>${deltaHtml(((s.margin || 0) - (s.base.margin || 0)) * 100, (v) => v.toFixed(1), true)}</div>
      <div class="sim-stat"><div class="lbl">${lbl('annual')}</div><div class="val">${signed(dProfit * 12, (v) => fmtMoney(v, true))}</div><div class="dlt flat">${esc(t('sim.delta.annual'))}</div></div>`;
    renderSimChart(s);
    $$('[data-preset]').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.preset === state.sim.preset));
  }

  function renderSimChart(s) {
    const th = theme();
    const bar = { borderRadius: 4, borderSkipped: 'start', barPercentage: 0.86, categoryPercentage: 0.62, maxBarThickness: 30 };
    const cfg = {
      type: 'bar',
      data: {
        labels: [t('sim.chart.revenue'), t('sim.chart.costs'), t('sim.chart.profit')],
        datasets: [
          { label: t('sim.chart.baseline'), data: [s.base.revenue, s.base.expenses, s.base.profit], backgroundColor: th.baseline, ...bar },
          { label: t('sim.chart.scenario'), data: [s.revenue, s.expenses, s.profit], backgroundColor: th.series[0], ...bar },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { display: false }, border: { color: th.axis }, ticks: { color: th.muted } },
          y: { beginAtZero: true, grid: { color: th.grid, drawTicks: false }, border: { display: false }, ticks: { color: th.muted, padding: 8, maxTicksLimit: 5, callback: (v) => fmtMoney(v, true) } },
        },
        plugins: {
          legend: { position: 'bottom', align: 'end', labels: { color: th.ink2, boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 3, padding: 14 } },
          tooltip: { ...tooltipStyle(th), callbacks: { label: (c) => ` ${c.dataset.label}: ${fmtMoney(c.parsed.y)}` } },
        },
      },
    };
    $('#simChartBox').classList.remove('is-empty');
    if (!charts.sim) charts.sim = new Chart($('#simChart'), cfg);
    else { charts.sim.data = cfg.data; charts.sim.options = cfg.options; charts.sim.update(); }
  }

  const PRESETS = {
    conservative: { clientsRatio: -0.10, ticketRatio: -0.05, cost: 5 },
    growth: { clientsRatio: 0.20, ticketRatio: 0.08, cost: 10 },
    efficiency: { clientsRatio: 0, ticketRatio: 0.03, cost: -12 },
    reset: { clientsRatio: 0, ticketRatio: 0, cost: 0 },
  };
  function applyPreset(name) {
    Object.assign(state.sim, PRESETS[name], { preset: name === 'reset' ? null : name });
    rebaseSimulator();
  }
  const simChanged = () => state.sim.clientsRatio !== 0 || state.sim.ticketRatio !== 0 || state.sim.cost !== 0;

  /* ------------------------------------------------------------ table */
  // Display-aware values so sorting and search follow what the user actually sees.
  function sortValue(r, k) {
    if (k === 'service') return svcLabel(r.service);
    if (k === 'type') return typeLabel(r.type);
    if (k === 'status') return statusLabel(r);
    return r[k];
  }

  function tableRows() {
    const { type, q, sort, dir } = state.table;
    let rows = select(state.year, state.period, state.service);
    if (type !== 'all') rows = rows.filter((r) => r.type === type);
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length) {
      rows = rows.filter((r) => {
        const hay = `${r.id} ${r.party} ${r.service} ${svcLabel(r.service)} ${r.description} ${r.status} ${statusLabel(r)} ${r.type} ${typeLabel(r.type)} ${r.date} ${r.amount}`.toLowerCase();
        return terms.every((term) => hay.includes(term));
      });
    }
    const s = dir === 'asc' ? 1 : -1;
    return rows.slice().sort((a, b) => {
      const va = sortValue(a, sort), vb = sortValue(b, sort);
      const c = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), I.locale);
      return (c || a.id.localeCompare(b.id)) * s;
    });
  }

  /** Match on the raw text, then escape each segment — never regex over escaped HTML entities. */
  function highlight(text) {
    const raw = String(text ?? '');
    const terms = state.table.q.trim().split(/\s+/).filter((term) => term.length > 1);
    if (!terms.length) return esc(raw);
    const re = new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    // split() with one capture group puts matches at odd indexes
    return raw.split(re).map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part))).join('');
  }

  function statusPill(r) {
    const label = highlight(statusLabel(r));
    if (r.type === 'Pipeline') return `<span class="pill stage">${label}</span>`;
    if (r.status === 'Paid') return `<span class="pill paid">${ICONS.check}${label}</span>`;
    if (r.status === 'Overdue') return `<span class="pill overdue">${ICONS.alert}${label}</span>`;
    if (r.status === 'Invoiced') return `<span class="pill invoiced">${ICONS.clock}${label}</span>`;
    return `<span class="pill stage">${label}</span>`;
  }
  function typeTag(type) {
    const color = type === 'Revenue' ? 'var(--series-1)' : type === 'Expense' ? 'var(--series-2)' : 'transparent';
    const border = type === 'Pipeline' ? 'box-shadow: inset 0 0 0 1.5px var(--muted);' : '';
    return `<span class="type-tag"><i style="background:${color};${border}"></i>${highlight(typeLabel(type))}</span>`;
  }

  function renderTable() {
    const rows = tableRows();
    const { page, size, sort, dir, q } = state.table;
    const pages = Math.max(1, Math.ceil(rows.length / size));
    if (page >= pages) state.table.page = pages - 1;
    const start = state.table.page * size;
    const view = rows.slice(start, start + size);
    const periodTxt = periodLabel(state.year, state.period);

    $('#tbody').innerHTML = view.length ? view.map((r) => `
      <tr>
        <td class="muted">${esc(r.date)}</td>
        <td class="muted">${highlight(r.id)}</td>
        <td>${highlight(r.party)}</td>
        <td class="hide-sm">${highlight(svcLabel(r.service))}</td>
        <td>${typeTag(r.type)}</td>
        <td class="desc hide-md" title="${esc(r.description)}">${highlight(r.description)}</td>
        <td class="num ${r.type === 'Expense' ? 'neg' : ''}">${r.type === 'Expense' ? '−' : ''}${fmtMoney(r.amount)}</td>
        <td>${statusPill(r)}</td>
      </tr>`).join('')
      : `<tr><td colspan="8" class="empty">${esc(q.trim() ? t('table.emptyQuery', { q: q.trim(), period: periodTxt }) : t('table.empty', { period: periodTxt }))}</td></tr>`;

    $$('.data-table th').forEach((th) => {
      th.classList.toggle('sorted', th.dataset.sort === sort);
      th.classList.toggle('asc', th.dataset.sort === sort && dir === 'asc');
      th.setAttribute('aria-sort', th.dataset.sort === sort ? (dir === 'asc' ? 'ascending' : 'descending') : 'none');
    });

    const rev = sum(rows.filter((r) => r.type === 'Revenue'), (r) => r.amount);
    const exp = sum(rows.filter((r) => r.type === 'Expense'), (r) => r.amount);
    $('#tableSub').textContent = t('table.sub', { period: periodTxt, service: svcLabel(state.service), n: fmtInt(rows.length) });
    $('#pageInfo').textContent = rows.length
      ? t('table.pageInfo', { from: start + 1, to: Math.min(start + size, rows.length), total: fmtInt(rows.length), rev: fmtMoney(rev, true), exp: fmtMoney(exp, true) })
      : t('table.noRecords');
    $('#prevPage').disabled = state.table.page === 0;
    $('#nextPage').disabled = state.table.page >= pages - 1;
  }

  /* ------------------------------------------------------------ CSV export / import (canonical keys only) */
  function toCSV(rows) {
    const cell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return [CSV_HEADERS.join(','), ...rows.map((r) => [r.date, r.id, r.type, r.party, r.service, r.description, r.amount.toFixed(2), r.status].map(cell).join(','))].join('\r\n');
  }
  function download(name, text) {
    const blob = new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportCSV() {
    const rows = tableRows();
    if (!rows.length) { toast(t('toast.nothing')); return; }
    const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const name = `kpi-records_${periodCode(state.year, state.period)}_${slug(state.service === 'all' ? 'all-services' : state.service)}${state.table.type !== 'all' ? '_' + slug(state.table.type) : ''}.csv`;
    download(name, toCSV(rows));
    toast(t('toast.exported', { n: fmtInt(rows.length), name }));
  }

  function parseCSV(text) {
    text = text.replace(/^\uFEFF/, '');
    const firstLine = text.split(/\r?\n/, 1)[0] || '';
    const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = []; let field = ''; let q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === delim) { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some((v) => v.trim() !== '')) rows.push(row);
        row = [];
      } else field += c;
    }
    row.push(field);
    if (row.some((v) => v.trim() !== '')) rows.push(row);
    return rows;
  }

  // Header aliases (English + Spanish), compared after lower-casing and stripping accents/symbols.
  const HEADER_MAP = {
    date: ['date', 'transactiondate', 'invoicedate', 'closedate', 'fecha'],
    id: ['id', 'invoiceid', 'ref', 'reference', 'number', 'transactionid', 'referencia', 'numero'],
    type: ['type', 'recordtype', 'kind', 'transactiontype', 'tipo'],
    party: ['clientvendor', 'client', 'vendor', 'party', 'counterparty', 'customer', 'name', 'account', 'clienteproveedor', 'cliente', 'proveedor'],
    service: ['service', 'category', 'servicecategory', 'serviceline', 'department', 'servicio', 'categoria'],
    description: ['description', 'memo', 'details', 'notes', 'item', 'descripcion', 'concepto'],
    amount: ['amount', 'value', 'total', 'amountusd', 'importe', 'monto', 'valor'],
    status: ['status', 'stage', 'state', 'estado', 'etapa'],
  };
  const normHeader = (h) => h.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z]/g, '');

  function parseDate(s) {
    s = String(s || '').trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`; // US M/D/YYYY
    const d = new Date(s);
    return isNaN(d) ? null : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  /** Accepts US (1,234.50) and European/Spanish (1.234,50) formats, currency symbols and (negatives). */
  function parseAmount(s) {
    let str = String(s ?? '').trim();
    const neg = /^\(.*\)$/.test(str) || /^-/.test(str) || /^−/.test(str);
    str = str.replace(/[^0-9.,]/g, '');
    const lastDot = str.lastIndexOf('.'), lastComma = str.lastIndexOf(',');
    if (lastDot >= 0 && lastComma >= 0) {
      // both present: whichever comes last is the decimal separator
      str = lastComma > lastDot ? str.replace(/\./g, '').replace(',', '.') : str.replace(/,/g, '');
    } else if (lastComma >= 0 || lastDot >= 0) {
      const sep = lastComma >= 0 ? ',' : '.';
      const parts = str.split(sep);
      // one separator followed by exactly 3 digits (or repeated groups) = thousands; otherwise decimal
      const thousands = parts.length > 2 || (parts.length === 2 && parts[1].length === 3);
      str = thousands ? parts.join('') : parts.join('.');
    }
    const v = parseFloat(str);
    return isNaN(v) ? null : neg ? -v : v;
  }
  function normType(raw, amount) {
    const s = String(raw || '').toLowerCase();
    if (/rev|income|sale|invoice|ingreso|venta|factura/.test(s)) return 'Revenue';
    if (/exp|cost|spend|bill|gasto|coste|costo|compra/.test(s)) return 'Expense';
    if (/pipe|opp|deal|lead|prospect|oportunidad/.test(s)) return 'Pipeline';
    return amount < 0 ? 'Expense' : 'Revenue';
  }
  /** Known EN/ES labels become canonical keys; anything custom is kept verbatim. */
  function normStatus(raw, type) {
    if (!raw) return type === 'Pipeline' ? 'Proposal sent' : 'Paid';
    return I.canonical(type === 'Pipeline' ? 'stage' : 'status', raw) || raw;
  }
  const normService = (raw) => (raw ? I.canonical('service', raw) || raw : 'Unassigned');

  function rowsFromCSV(text) {
    const table = parseCSV(text);
    if (table.length < 2) throw new Error(t('err.noRows'));
    const norm = table[0].map(normHeader);
    const col = {};
    Object.entries(HEADER_MAP).forEach(([key, names]) => { const i = norm.findIndex((h) => names.includes(h)); if (i >= 0) col[key] = i; });
    if (col.date === undefined || col.amount === undefined) throw new Error(t('err.missingCols'));
    const out = []; let skipped = 0;
    table.slice(1).forEach((cells, i) => {
      const get = (k) => (col[k] !== undefined ? String(cells[col[k]] ?? '').trim() : '');
      const date = parseDate(get('date'));
      const amount = parseAmount(get('amount'));
      if (!date || amount === null) { skipped++; return; }
      const type = normType(get('type'), amount);
      out.push({
        date, type,
        id: get('id') || `IMP-${date.slice(0, 4)}-${String(i + 1).padStart(4, '0')}`,
        party: get('party') || (type === 'Expense' ? 'Unspecified vendor' : 'Unspecified client'),
        service: normService(get('service')),
        description: get('description'),
        amount: Math.abs(amount),
        status: normStatus(get('status'), type),
      });
    });
    if (!out.length) throw new Error(t('err.noValid'));
    return { rows: out, skipped };
  }

  function renderImportSummary() {
    const imp = state.pendingImport;
    if (!imp) return;
    const count = (ty) => fmtInt(imp.rows.filter((r) => r.type === ty).length);
    const dates = imp.rows.map((r) => r.date).sort();
    $('#importSummary').innerHTML =
      t('import.summary', {
        name: esc(imp.name), n: fmtInt(imp.rows.length),
        types: t('import.types', { rev: count('Revenue'), exp: count('Expense'), pipe: count('Pipeline') }),
        skipped: imp.skipped ? t('import.skipped', { n: fmtInt(imp.skipped) }) : '',
        from: esc(dates[0]), to: esc(dates[dates.length - 1]),
      }) + `<br><br>${esc(t('import.help'))}`;
  }

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { rows, skipped } = rowsFromCSV(String(reader.result));
        state.pendingImport = { rows, skipped, name: file.name };
        // Nothing loaded yet: there is nothing to merge with, so load the file straight away.
        if (!state.data.length) { commitImport('replace'); }
        else { renderImportSummary(); openModal(); }
      } catch (err) {
        toast(t('toast.importFailed', { msg: err.message }));
      }
      $('#fileInput').value = '';
    };
    reader.onerror = () => toast(t('toast.readError'));
    reader.readAsText(file);
  }

  function commitImport(mode) {
    const imp = state.pendingImport;
    closeModal();
    if (!imp || mode === 'cancel') { state.pendingImport = null; return; }
    let rows;
    if (mode === 'merge') {
      const byId = new Map(state.data.map(({ _y, _m, ...r }) => [r.id, r]));
      imp.rows.forEach((r) => byId.set(r.id, r));
      rows = [...byId.values()];
    } else rows = imp.rows;
    rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    setData(rows, { kind: 'import', name: imp.name, mode });
    setEmptyView(false);
    computeAverages();
    renderFilterOptions();
    const latestYear = Math.max(...imp.rows.map((r) => +r.date.slice(0, 4)));
    state.year = latestYear;
    state.period = `m${latestMonth(latestYear)}`;
    state.service = 'all';
    state.table.page = 0;
    state.pendingImport = null;
    renderSource();
    onFiltersChanged();
    toast(t(mode === 'merge' ? 'toast.merged' : 'toast.loaded', { n: fmtInt(imp.rows.length), name: imp.name }));
  }

  function openModal() { $('#importDialog').hidden = false; $('[data-import="merge"]').focus(); }
  function closeModal() { $('#importDialog').hidden = true; }

  /* ------------------------------------------------------------ executive report */
  function chartImagesForPaper() {
    // Charts are re-themed to light ink before capture so the report always prints on white.
    const root = document.documentElement;
    const was = root.getAttribute('data-theme');
    const needSwap = was !== 'light';
    if (needSwap) { root.setAttribute('data-theme', 'light'); recolorCharts('none'); }
    const imgs = {
      trend: charts.trend ? charts.trend.toBase64Image('image/png', 1) : '',
      mix: charts.mix ? charts.mix.toBase64Image('image/png', 1) : '',
      mixColors: SERIES_VARS.map(cssVar),
      baseline: cssVar('--baseline'),
    };
    if (needSwap) { root.setAttribute('data-theme', was); recolorCharts('none'); }
    return imgs;
  }

  function renderReport() {
    const m = current();
    const p = previous();
    const pp = prevOf(state.year, state.period);
    const prevLabel = periodLabel(pp.year, pp.period);
    const prevShort = periodLabel(pp.year, pp.period, true);
    const imgs = chartImagesForPaper();
    const pct = (a, b) => (b ? (a - b) / Math.abs(b) : null);
    const pts = (v) => t('trend.pts', { v });
    const trendTxt = (d, unit) => {
      if (!p.hasData || d == null || !isFinite(d)) return esc(t('report.noPrior'));
      const dir = d > 0 ? 'up' : d < 0 ? 'down' : '';
      const v = unit === 'pts' ? pts(Math.abs(d).toFixed(1)) : `${Math.abs(d * 100).toFixed(1)}%`;
      return `<b class="${dir}">${d > 0 ? '▲' : d < 0 ? '▼' : '■'} ${esc(v)}</b> ${esc(t('kpi.vs', { prev: prevShort }))}`;
    };

    const mix = mixRows();
    const mixTotal = sum(mix, (r) => r.value);
    const ranked = mix.slice().sort((a, b) => b.value - a.value);

    // top clients
    const byClient = new Map();
    m.rows.filter((r) => r.type === 'Revenue').forEach((r) => {
      const c = byClient.get(r.party) || { name: r.party, value: 0, n: 0 };
      c.value += r.amount; c.n++; byClient.set(r.party, c);
    });
    const topClients = [...byClient.values()].sort((a, b) => b.value - a.value).slice(0, 6);

    // auto-generated highlights (dictionary strings carry <b>; every interpolated value is escaped)
    const revD = pct(m.revenue, p.revenue);
    const marD = m.margin != null && p.margin != null ? (m.margin - p.margin) * 100 : null;
    const bullets = [];
    bullets.push(t('hl.revenue', {
      revenue: fmtMoney(m.revenue),
      change: p.hasData && revD != null ? t(revD >= 0 ? 'hl.revenueUp' : 'hl.revenueDown', { pct: `${Math.abs(revD * 100).toFixed(1)}%`, prev: esc(prevLabel) }) : '',
    }));
    bullets.push(t('hl.profit', {
      profit: fmtMoney(m.profit), margin: fmtPct(m.margin),
      change: marD != null && p.hasData ? t('hl.profitChange', { pts: `${marD >= 0 ? '+' : '−'}${Math.abs(marD).toFixed(1)}` }) : '',
    }));
    if (state.service === 'all' && ranked[0] && mixTotal) {
      bullets.push(t('hl.mix', {
        top: esc(svcLabel(ranked[0].name)), share: fmtPct(ranked[0].value / mixTotal, 0),
        next: ranked[1] ? t('hl.mixNext', { name: esc(svcLabel(ranked[1].name)), share: fmtPct(ranked[1].value / mixTotal, 0) }) : '',
      }));
    }
    if (m.goal != null) {
      const status = m.goal >= 1 ? t('hl.goalAchieved') : m.goal >= 0.95 ? t('hl.goalOnTrack') : t('hl.goalBehind', { gap: fmtMoney(m.target - m.revenue, true) });
      bullets.push(t('hl.goal', { goal: fmtPct(m.goal, 0), target: fmtMoney(m.target, true), status: esc(status) }));
    }
    bullets.push(t('hl.pipeline', {
      pipeline: fmtMoney(m.pipeline), deals: fmtInt(m.deals),
      top: m.topDeal ? t('hl.pipelineTop', { party: esc(m.topDeal.party), amount: fmtMoney(m.topDeal.amount, true) }) : '',
    }));
    if (m.overdueCount) bullets.push(t(m.overdueCount > 1 ? 'hl.overdueMany' : 'hl.overdueOne', { n: fmtInt(m.overdueCount), sum: fmtMoney(m.overdueSum) }));

    const focus = [];
    if (m.overdueCount) focus.push(t('focus.collections', { sum: fmtMoney(m.overdueSum, true) }));
    if (marD != null && marD < -0.5) focus.push(t('focus.margin', { pts: Math.abs(marD).toFixed(1) }));
    if (m.goal != null && m.goal < 0.95) focus.push(t('focus.gap', { gap: fmtMoney(m.target - m.revenue, true) }));
    if (!focus.length) focus.push(t('focus.onPlan'));

    let simBlock = '';
    if (simChanged() && state.simBase && state.simBase.has) {
      const s = scenario();
      simBlock = `
        <section class="rp-section">
          <div class="rp-h">${esc(t('report.scenario'))}</div>
          <div class="rp-callout">${t('report.scenarioText', {
            clients: fmtInt(s.clients), dClients: signed(s.clients - state.simBase.clients, fmtInt), ticket: fmtMoney(s.ticket),
            cost: `${s.cost >= 0 ? '+' : ''}${s.cost}%`, profit: fmtMoney(s.profit), base: fmtMoney(s.base.profit), margin: fmtPct(s.margin),
            annual: signed((s.profit - s.base.profit) * 12, (v) => fmtMoney(v, true)),
          })}</div>
        </section>`;
    }

    const colorOf = (r) => (r.idx >= 0 ? imgs.mixColors[r.idx] : imgs.baseline);
    const today = new Date().toLocaleDateString(I.locale, { year: 'numeric', month: 'long', day: 'numeric' });
    const kind = periodKind(state.period);
    const sw = (c) => `<i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${c};margin-right:5px"></i>`;

    $('#report').innerHTML = `
      <header class="rp-head">
        <div>
          <div class="rp-brand">
            <div class="logo-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 18v-6M12 18V6M18 18v-3"/></svg></div>
            <div>
              <div class="rp-kicker">${esc(D.COMPANY.name)} · ${esc(t('company.descriptor'))}</div>
              <div class="rp-title">${esc(t('report.title', { period: periodLabel(state.year, state.period) }))}</div>
            </div>
          </div>
        </div>
        <div class="rp-meta">
          <div><b>${esc(t('report.scope'))}</b> ${esc(svcLabel(state.service))}</div>
          <div><b>${esc(t('report.compared'))}</b> ${esc(prevLabel)}</div>
          <div><b>${esc(t('report.generated'))}</b> ${esc(today)}</div>
        </div>
      </header>

      <section class="rp-section">
        <div class="rp-h">${esc(t('report.kpis'))}</div>
        <div class="rp-kpis">
          <div class="rp-kpi"><div class="l">${esc(t(`kpi.revenue.${kind}`))}</div><div class="v">${fmtMoney(m.revenue, true)}</div><div class="t">${trendTxt(revD)}</div></div>
          <div class="rp-kpi"><div class="l">${esc(t('kpi.margin'))}</div><div class="v">${fmtPct(m.margin)}</div><div class="t">${trendTxt(marD, 'pts')}</div></div>
          <div class="rp-kpi"><div class="l">${esc(t('kpi.pipeline'))}</div><div class="v">${fmtMoney(m.pipeline, true)}</div><div class="t">${trendTxt(pct(m.pipeline, p.pipeline))}</div></div>
          <div class="rp-kpi"><div class="l">${esc(t('kpi.goal'))}</div><div class="v">${fmtPct(m.goal, 0)}</div><div class="t">${trendTxt(m.goal != null && p.goal != null ? (m.goal - p.goal) * 100 : null, 'pts')}</div></div>
        </div>
      </section>

      <section class="rp-section rp-charts">
        <div class="rp-chart">
          <div class="c">${esc(t('report.trendChart', { year: state.year }))}</div>
          ${imgs.trend ? `<img src="${imgs.trend}" alt="${esc(t('report.trendAlt'))}">` : ''}
          <div style="display:flex;gap:14px;font-size:10.5px;color:#52514e;margin-top:4px">
            <span>${sw(imgs.mixColors[0])}${esc(t('chart.revenue'))}</span>
            <span>${sw(imgs.mixColors[1])}${esc(t('chart.expenses'))}</span>
          </div>
        </div>
        <div class="rp-chart">
          <div class="c">${esc(t('report.mixChart'))}</div>
          <div class="rp-mix">
            ${imgs.mix ? `<img src="${imgs.mix}" alt="${esc(t('report.mixAlt'))}">` : '<div></div>'}
            <ul>${mix.map((r) => `<li><i style="background:${colorOf(r)}"></i><span>${esc(svcLabel(r.name))}</span><span>${fmtPct(mixTotal ? r.value / mixTotal : 0, 0)}</span></li>`).join('')}</ul>
          </div>
        </div>
      </section>

      <section class="rp-section rp-cols">
        <div>
          <div class="rp-h">${esc(t('report.highlights'))}</div>
          <ul class="rp-list">${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>
          <div class="rp-h" style="margin-top:14px">${esc(t('report.focus'))}</div>
          <div class="rp-callout">${focus.map((f) => esc(f)).join('<br>')}</div>
        </div>
        <div>
          <div class="rp-h">${esc(t('report.topClients'))}</div>
          <table class="rp-table">
            <thead><tr><th>${esc(t('report.col.client'))}</th><th class="num">${esc(t('report.col.invoices'))}</th><th class="num">${esc(t('report.col.revenue'))}</th><th class="num">${esc(t('report.col.share'))}</th></tr></thead>
            <tbody>${topClients.map((c) => `<tr><td>${esc(c.name)}</td><td class="num">${c.n}</td><td class="num">${fmtMoney(c.value)}</td><td class="num">${fmtPct(m.revenue ? c.value / m.revenue : 0, 0)}</td></tr>`).join('') || `<tr><td colspan="4">${esc(t('report.noRevenue'))}</td></tr>`}</tbody>
          </table>
          <table class="rp-table" style="margin-top:12px">
            <tbody>
              <tr><td>${esc(t('report.totalRevenue'))}</td><td class="num">${fmtMoney(m.revenue)}</td></tr>
              <tr><td>${esc(t('report.opCosts'))}</td><td class="num">${fmtMoney(m.expenses)}</td></tr>
              <tr><td><b>${esc(t('report.netProfit'))}</b></td><td class="num"><b>${fmtMoney(m.profit)}</b></td></tr>
            </tbody>
          </table>
        </div>
      </section>
      ${simBlock}
      <footer class="rp-foot">
        <span>${esc(t('report.confidential', { company: D.COMPANY.name }))}</span>
        <span>${esc(sourceLabel())}</span>
      </footer>`;
  }

  function openReport() {
    renderReport();
    $('#reportOverlay').hidden = false;
    document.body.classList.add('report-open');
    $('#reportOverlay').scrollTop = 0;
    $('#btnPrint').focus();
  }
  function closeReport() {
    $('#reportOverlay').hidden = true;
    document.body.classList.remove('report-open');
  }

  /* ------------------------------------------------------------ theme */
  function recolorCharts(mode) {
    if (charts.trend) { const c = trendConfig(); charts.trend.data = c.data; charts.trend.options = c.options; charts.trend.update(mode); }
    if (charts.mix) renderMix();
    if (charts.sim && state.simBase && state.simBase.has) renderSimChart(scenario());
    if (mode === 'none') Object.values(charts).forEach((c) => c && c.update('none'));
  }
  function toggleTheme() {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('kpi-theme', next); } catch (e) { /* storage unavailable */ }
    recolorCharts();
  }

  /* ------------------------------------------------------------ language */
  /** Re-render every dynamic surface in place; filters, table page, search and scenario are kept. */
  function onLanguageChanged() {
    if (!state.data.length) { renderSource(); return; }
    renderFilterOptions();
    syncFilterInputs();
    renderSource();
    renderKPIs();
    renderTrend();
    renderMix();
    rebaseSimulator();
    renderTable();
    if (!$('#importDialog').hidden) renderImportSummary();
    if (!$('#reportOverlay').hidden) renderReport();
  }

  /* ------------------------------------------------------------ orchestration */
  function onFiltersChanged() {
    syncFilterInputs();
    state.table.page = 0;
    renderKPIs();
    renderTrend();
    renderMix();
    rebaseSimulator();
    renderTable();
  }

  /** Show the welcome screen (no data) or the dashboard. */
  function setEmptyView(empty) {
    document.body.classList.toggle('no-data', empty);
    $('#btnExport').disabled = empty;
    $('#btnReport').disabled = empty;
  }

  /** The app starts with no data: the user loads their own CSV file. */
  function clearData() {
    setData([], { kind: 'empty', name: '', mode: '' });
    computeAverages();
    state.year = null;
    state.period = 'all';
    state.service = 'all';
    state.sim = { clientsRatio: 0, ticketRatio: 0, cost: 0, preset: null };
    state.table = { ...state.table, type: 'all', q: '', page: 0 };
    $('#search').value = '';
    setSegmented('#typeFilter', 'all');
    closeReport();
    setEmptyView(true);
    renderSource();
  }

  function bind() {
    $('#fYear').addEventListener('change', (e) => {
      state.year = +e.target.value;
      if (state.period[0] === 'm' && !select(state.year, state.period, 'all').length) state.period = `m${latestMonth(state.year)}`;
      onFiltersChanged();
    });
    $('#fPeriod').addEventListener('change', (e) => { state.period = e.target.value; onFiltersChanged(); });
    $('#fService').addEventListener('change', (e) => { state.service = e.target.value; onFiltersChanged(); });
    $('#btnResetFilters').addEventListener('click', () => {
      defaultFilters();
      state.table = { ...state.table, type: 'all', q: '', page: 0 };
      $('#search').value = '';
      setSegmented('#typeFilter', 'all');
      onFiltersChanged();
    });

    $$('[data-chart]').forEach((b) => b.addEventListener('click', () => {
      state.chartType = b.dataset.chart;
      $$('[data-chart]').forEach((x) => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-pressed', x === b); });
      renderTrend(true);
    }));

    ['#sClients', '#sTicket', '#sCost'].forEach((id) => $(id).addEventListener('input', () => { state.sim.preset = null; updateSimulator(true); }));
    $$('[data-preset]').forEach((b) => b.addEventListener('click', () => applyPreset(b.dataset.preset)));

    $$('#typeFilter button').forEach((b) => b.addEventListener('click', () => {
      state.table.type = b.dataset.type; state.table.page = 0;
      setSegmented('#typeFilter', b.dataset.type);
      renderTable();
    }));
    let searchT;
    $('#search').addEventListener('input', (e) => {
      clearTimeout(searchT);
      searchT = setTimeout(() => { state.table.q = e.target.value; state.table.page = 0; renderTable(); }, 120);
    });
    $$('.data-table th').forEach((th) => th.addEventListener('click', () => {
      const k = th.dataset.sort;
      if (state.table.sort === k) state.table.dir = state.table.dir === 'asc' ? 'desc' : 'asc';
      else { state.table.sort = k; state.table.dir = k === 'amount' || k === 'date' ? 'desc' : 'asc'; }
      renderTable();
    }));
    $('#prevPage').addEventListener('click', () => { state.table.page--; renderTable(); });
    $('#nextPage').addEventListener('click', () => { state.table.page++; renderTable(); });

    $('#btnExport').addEventListener('click', exportCSV);
    $('#btnImport').addEventListener('click', () => $('#fileInput').click());
    $('#btnImportEmpty').addEventListener('click', () => $('#fileInput').click());
    $('#fileInput').addEventListener('change', (e) => handleFile(e.target.files[0]));
    $$('[data-import]').forEach((b) => b.addEventListener('click', () => commitImport(b.dataset.import)));
    // drag & drop a CSV anywhere on the page
    document.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
    document.addEventListener('drop', (e) => {
      const f = e.dataTransfer && e.dataTransfer.files[0];
      if (f) { e.preventDefault(); handleFile(f); }
    });

    $('#btnReport').addEventListener('click', openReport);
    $('#btnCloseReport').addEventListener('click', closeReport);
    $('#btnPrint').addEventListener('click', () => window.print());
    $('#reportOverlay').addEventListener('click', (e) => { if (e.target.id === 'reportOverlay') closeReport(); });
    window.addEventListener('beforeprint', renderReport);

    $('#btnTheme').addEventListener('click', toggleTheme);
    $('#btnLang').addEventListener('click', () => I.toggle());
    I.onChange(onLanguageChanged);
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        let saved = null;
        try { saved = localStorage.getItem('kpi-theme'); } catch (err) { /* ignore */ }
        if (!saved) { document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light'); recolorCharts(); }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!$('#importDialog').hidden) commitImport('cancel');
      else if (!$('#reportOverlay').hidden) closeReport();
    });
  }

  function setSegmented(sel, val) {
    $$(`${sel} button`).forEach((x) => { const on = x.dataset.type === val; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', on); });
  }

  // Small public hook for testing / automation
  window.KPIDashboard = { state, toCSV, rowsFromCSV, metrics, openReport };

  I.apply();
  bind();
  $('#companyName').textContent = D.COMPANY.name;
  clearData();
})();
