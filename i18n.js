/* ==========================================================================
   i18n.js — English / Spanish dictionaries + tiny translation runtime
   --------------------------------------------------------------------------
   • I18N.t('a.b.c', { name: 'x' })  → translated string with {name} interpolation
   • I18N.label('service', raw)       → display label for a canonical data value
                                         (falls back to the raw string for custom values)
   • I18N.canonical('status', text)   → maps a translated label back to its canonical key
   • DOM: data-i18n, data-i18n-placeholder, data-i18n-title, data-i18n-aria
   Data in state / CSV always keeps canonical English keys — only labels change.
   ========================================================================== */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'kpi-lang';
  const LOCALES = { en: 'en-US', es: 'es-ES' };

  const DICT = {
    /* ===================================================================== EN */
    en: {
      meta: {
        title: 'Brújula — Business dashboard',
        description: 'Interactive business KPI dashboard and executive reporting tool: revenue, expenses, pipeline, targets, what-if modeling, CSV import/export and printable executive summaries.',
      },
      months: {
        short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        long: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      },
      top: {
        badge: 'Executive Dashboard',
        import: 'Import CSV', importTitle: 'Import transactions from a CSV file',
        export: 'Export CSV', exportTitle: 'Export the filtered records as CSV',
        report: 'Executive Summary', reportTitle: 'Preview and print the executive summary',
        theme: 'Toggle dark / light mode',
        lang: 'Switch language: English / Spanish',
      },
      source: {
        empty: 'No data loaded',
        imported: 'File: {name}',
        merged: 'Merged with: {name}',
        reset: 'Clear data',
      },
      company: {
        descriptor: 'Business dashboard',
        note: 'The example files use fictional names and figures.',
      },
      empty: {
        title: 'No data yet',
        text: 'Load a CSV file with your income and expenses to see your business at a glance.',
        button: 'Load CSV file',
        drop: 'You can also drag the file and drop it anywhere on this page.',
        samples: 'Nothing to load? Download an example file:',
        bakery: 'Neighborhood bakery',
        bigco: 'Large company',
      },
      page: { title: 'Business Performance Overview' },
      filters: {
        aria: 'Dashboard filters',
        year: 'Year', period: 'Period', service: 'Service',
        fullYear: 'Full year', quarters: 'Quarters', months: 'Months',
        allServices: 'All services',
        reset: 'Reset', resetTitle: 'Reset filters',
      },
      period: { fy: 'FY {year}', fyShort: 'FY{year}', q: 'Q{n} {year}', qShort: 'Q{n}', month: '{month} {year}' },
      scope: '{period} · {service} — compared with {prev}',
      kpi: {
        aria: 'Key performance indicators',
        revenue: { Monthly: 'Monthly Revenue', Quarterly: 'Quarterly Revenue', Annual: 'Annual Revenue' },
        margin: 'Net Profit Margin',
        pipeline: 'Active Client Pipeline',
        goal: 'Goal Completion',
        metaRevenue: '{invoices} invoices · {clients} clients',
        metaMargin: 'Net profit {profit} · Costs {costs}',
        metaPipeline: '{deals} open deals · {clients} active clients',
        metaGoal: '{revenue} of {target} target',
        vs: 'vs {prev}',
      },
      trend: { noPrior: 'No prior data', up: 'Up', down: 'Down', flat: 'Flat', pts: '{v} pts', title: '{dir} {value} vs {prev}' },
      chart: {
        trendTitle: 'Revenue vs. Expenses',
        trendSubStatic: 'Monthly, selected period highlighted',
        trendSub: '{year} monthly · {service} · click a month to drill down',
        trendAria: 'Monthly revenue and expenses chart',
        revenue: 'Revenue', expenses: 'Expenses',
        type: 'Chart type', bar: 'Bar', line: 'Line',
        netProfit: 'Net profit: {profit} ({margin} margin)',
        mixTitle: 'Revenue by Service',
        mixSub: 'Click a service to filter the dashboard',
        mixAria: 'Revenue breakdown by service category',
        mixTotal: 'Total revenue',
        other: 'Other',
        mixEmpty: 'No revenue in this period.',
        otherToast: '“Other” groups smaller services — pick one from the Service filter',
      },
      sim: {
        title: 'What-If Revenue & Margin Simulator',
        live: 'Live',
        baselineDefault: 'Baseline from the current filter',
        baseline: 'Baseline: {scope} · {service} — {revenue} revenue, {costs} costs / month',
        monthlyAvg: '{period} monthly average',
        noRevenue: 'No revenue in the selected period — choose another period to model scenarios.',
        preset: { conservative: 'Conservative', growth: 'Growth push', efficiency: 'Cost discipline', reset: 'Reset' },
        clients: 'Active clients / month',
        ticket: 'Average revenue per client',
        cost: 'Operating cost change',
        footBase: 'Baseline {base}',
        footClientsDelta: 'Baseline {base} · {delta} clients',
        footTicketDelta: 'Baseline {base} · {delta}%',
        footCost: 'Baseline {base} / month',
        footCostApplied: 'Baseline {base} / month · applied on top of volume effect',
        noBaseline: 'No baseline for this period',
        model: 'Model: revenue = clients × revenue per client. 35% of operating costs scale with client volume (delivery capacity); the rest is fixed overhead. The cost slider applies on top.',
        stat: {
          profit: 'Projected net profit / month', revenue: 'Revenue / month', costs: 'Operating costs / month',
          margin: 'Net margin', annual: 'Annualized profit impact',
        },
        delta: {
          none: 'No change vs baseline', vs: '{delta} vs baseline',
          saved: '{v} saved vs baseline', added: '{v} added vs baseline',
          annual: '12 × monthly change', pts: '{v} pts',
        },
        empty: 'No revenue in this period',
        chartEmpty: 'Scenario chart appears when the period has revenue',
        chart: { baseline: 'Baseline', scenario: 'Scenario', revenue: 'Revenue', costs: 'Costs', profit: 'Net profit' },
        chartAria: 'Baseline versus scenario comparison chart',
      },
      table: {
        title: 'Transactions & Client Pipeline',
        typeAria: 'Record type',
        tab: { all: 'All', Revenue: 'Revenue', Expense: 'Expenses', Pipeline: 'Pipeline' },
        search: 'Search clients, IDs, services…', searchAria: 'Search records',
        col: { date: 'Date', id: 'ID', party: 'Client / Vendor', service: 'Service', type: 'Type', description: 'Description', amount: 'Amount', status: 'Status' },
        sub: '{period} · {service} · {n} records',
        pageInfo: 'Showing {from}–{to} of {total} · Revenue {rev} · Expenses {exp}',
        noRecords: 'No records',
        emptyQuery: 'No records match “{q}” in {period}. Try clearing the search or widening the period.',
        empty: 'No records in {period}. Try widening the period.',
        prev: '‹ Prev', next: 'Next ›', prevAria: 'Previous page', nextAria: 'Next page',
      },
      type: { Revenue: 'Revenue', Expense: 'Expense', Pipeline: 'Pipeline' },
      status: { Paid: 'Paid', Invoiced: 'Invoiced', Overdue: 'Overdue' },
      stage: { Discovery: 'Discovery', 'Proposal sent': 'Proposal sent', Negotiation: 'Negotiation', 'Verbal commit': 'Verbal commit' },
      service: {
        'Web Development': 'Web Development', 'Performance Marketing': 'Performance Marketing',
        'Managed Retainers': 'Managed Retainers', 'Brand Strategy': 'Brand Strategy',
        'Content Production': 'Content Production', Unassigned: 'Unassigned',
      },
      footer: { built: 'Built with HTML, Tailwind CSS & Chart.js · No build step' },
      import: {
        title: 'Import CSV',
        summary: '<strong class="text-ink">{name}</strong> — {n} valid rows ({types}){skipped}, dated {from} to {to}.',
        types: '{rev} revenue, {exp} expense, {pipe} pipeline',
        skipped: ', {n} skipped',
        help: 'Merge adds the rows to the current dataset (matching IDs are updated). Replace swaps the dataset entirely.',
        cancel: 'Cancel', replace: 'Replace current data', merge: 'Merge with current data',
      },
      toast: {
        exported: 'Exported {n} records to {name}',
        nothing: 'Nothing to export — adjust the filters first',
        importFailed: 'Import failed: {msg}',
        readError: 'Could not read the file.',
        merged: 'Merged {n} rows from {name}',
        loaded: 'Loaded {n} rows from {name}',
        cleared: 'Data cleared',
        lang: 'Language: English',
      },
      err: {
        noRows: 'The file has no data rows.',
        missingCols: 'Missing required columns: the CSV needs at least “Date” and “Amount”.',
        noValid: 'No valid rows found (check the Date and Amount columns).',
      },
      report: {
        toolbar: 'Executive Summary — print preview',
        print: 'Print / Save as PDF', close: 'Close', aria: 'Executive summary report',
        title: 'Executive Summary — {period}',
        scope: 'Scope:', compared: 'Compared with:', generated: 'Generated:',
        kpis: 'Key performance indicators',
        noPrior: 'no prior data',
        trendChart: 'Revenue vs. expenses — {year} (selected period highlighted)',
        mixChart: 'Revenue by service',
        trendAlt: 'Revenue vs expenses chart', mixAlt: 'Revenue by service chart',
        highlights: 'Highlights', focus: 'Recommended focus', topClients: 'Top clients by revenue',
        col: { client: 'Client', invoices: 'Invoices', revenue: 'Revenue', share: 'Share' },
        totalRevenue: 'Total revenue', opCosts: 'Operating costs', netProfit: 'Net profit',
        noRevenue: 'No revenue in this period.',
        scenario: 'Scenario modeled',
        scenarioText: '{clients} clients / month ({dClients}), {ticket} average revenue per client, operating costs {cost}. Projected monthly net profit <b>{profit}</b> vs {base} baseline ({margin} margin) — an annualized impact of <b>{annual}</b>.',
        confidential: '{company} · Confidential — internal use only',
      },
      hl: {
        revenue: 'Revenue of <b>{revenue}</b>{change}.',
        revenueUp: ', up {pct} vs {prev}', revenueDown: ', down {pct} vs {prev}',
        profit: 'Net profit of <b>{profit}</b> at a <b>{margin}</b> net margin{change}.',
        profitChange: ' ({pts} pts)',
        mix: '<b>{top}</b> led the service mix with {share} of revenue{next}.',
        mixNext: ', followed by {name} ({share})',
        goal: 'Goal completion at <b>{goal}</b> of the {target} revenue target — {status}.',
        goalAchieved: 'target achieved', goalOnTrack: 'on track', goalBehind: 'behind plan by {gap}',
        pipeline: 'Open pipeline of <b>{pipeline}</b> across {deals} deals{top}.',
        pipelineTop: '; largest: {party} ({amount})',
        overdueOne: '<b>1 overdue invoice</b> totalling {sum} requires collection follow-up.',
        overdueMany: '<b>{n} overdue invoices</b> totalling {sum} require collection follow-up.',
      },
      focus: {
        collections: 'Accelerate collections on {sum} in overdue invoices to protect cash flow.',
        margin: 'Margin contracted {pts} pts — review contractor spend and delivery utilisation.',
        gap: 'Close the {gap} gap to target by prioritising late-stage pipeline deals.',
        onPlan: 'Performance is on plan — prioritise converting the top three pipeline opportunities and protect current margin.',
      },
    },

    /* ===================================================================== ES */
    es: {
      meta: {
        title: 'Brújula — Panel de negocio',
        description: 'Panel interactivo de KPIs y herramienta de reportes ejecutivos: ingresos, gastos, pipeline, objetivos, simulación de escenarios, importación/exportación CSV y resúmenes ejecutivos imprimibles.',
      },
      months: {
        short: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
        long: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
      },
      top: {
        badge: 'Panel ejecutivo',
        import: 'Importar CSV', importTitle: 'Importar transacciones desde un archivo CSV',
        export: 'Exportar CSV', exportTitle: 'Exportar los registros filtrados a CSV',
        report: 'Resumen ejecutivo', reportTitle: 'Previsualizar e imprimir el resumen ejecutivo',
        theme: 'Cambiar modo oscuro / claro',
        lang: 'Cambiar idioma: inglés / español',
      },
      source: {
        empty: 'Sin datos cargados',
        imported: 'Archivo: {name}',
        merged: 'Combinado con: {name}',
        reset: 'Quitar datos',
      },
      company: {
        descriptor: 'Panel de negocio',
        note: 'Los archivos de ejemplo usan nombres y cifras ficticios.',
      },
      empty: {
        title: 'Aún no hay datos',
        text: 'Carga un archivo CSV con tus ingresos y gastos para ver tu negocio de un vistazo.',
        button: 'Cargar archivo CSV',
        drop: 'También puedes arrastrar el archivo y soltarlo en cualquier parte de esta página.',
        samples: '¿No tienes un archivo? Descarga uno de ejemplo:',
        bakery: 'Panadería de barrio',
        bigco: 'Empresa grande',
      },
      page: { title: 'Resumen del rendimiento del negocio' },
      filters: {
        aria: 'Filtros del panel',
        year: 'Año', period: 'Periodo', service: 'Servicio',
        fullYear: 'Año completo', quarters: 'Trimestres', months: 'Meses',
        allServices: 'Todos los servicios',
        reset: 'Restablecer', resetTitle: 'Restablecer filtros',
      },
      period: { fy: 'Ejercicio {year}', fyShort: 'Ej. {year}', q: 'T{n} {year}', qShort: 'T{n}', month: '{month} {year}' },
      scope: '{period} · {service} — comparado con {prev}',
      kpi: {
        aria: 'Indicadores clave de rendimiento',
        revenue: { Monthly: 'Ingresos mensuales', Quarterly: 'Ingresos trimestrales', Annual: 'Ingresos anuales' },
        margin: 'Margen de beneficio neto',
        pipeline: 'Pipeline activo de clientes',
        goal: 'Cumplimiento del objetivo',
        metaRevenue: '{invoices} facturas · {clients} clientes',
        metaMargin: 'Beneficio neto {profit} · Costes {costs}',
        metaPipeline: '{deals} oportunidades abiertas · {clients} clientes activos',
        metaGoal: '{revenue} de un objetivo de {target}',
        vs: 'vs {prev}',
      },
      trend: { noPrior: 'Sin datos previos', up: 'Sube', down: 'Baja', flat: 'Estable', pts: '{v} pp', title: '{dir} {value} vs {prev}' },
      chart: {
        trendTitle: 'Ingresos vs. gastos',
        trendSubStatic: 'Mensual, periodo seleccionado resaltado',
        trendSub: '{year} mensual · {service} · haz clic en un mes para ver el detalle',
        trendAria: 'Gráfico mensual de ingresos y gastos',
        revenue: 'Ingresos', expenses: 'Gastos',
        type: 'Tipo de gráfico', bar: 'Barras', line: 'Líneas',
        netProfit: 'Beneficio neto: {profit} (margen {margin})',
        mixTitle: 'Ingresos por servicio',
        mixSub: 'Haz clic en un servicio para filtrar el panel',
        mixAria: 'Desglose de ingresos por categoría de servicio',
        mixTotal: 'Ingresos totales',
        other: 'Otros',
        mixEmpty: 'Sin ingresos en este periodo.',
        otherToast: '“Otros” agrupa servicios menores: elige uno en el filtro Servicio',
      },
      sim: {
        title: 'Simulador de escenarios: ingresos y margen',
        live: 'En vivo',
        baselineDefault: 'Base según el filtro actual',
        baseline: 'Base: {scope} · {service} — {revenue} de ingresos, {costs} de costes / mes',
        monthlyAvg: '{period}, media mensual',
        noRevenue: 'Sin ingresos en el periodo seleccionado: elige otro periodo para simular escenarios.',
        preset: { conservative: 'Conservador', growth: 'Impulso de crecimiento', efficiency: 'Control de costes', reset: 'Restablecer' },
        clients: 'Clientes activos / mes',
        ticket: 'Ingreso medio por cliente',
        cost: 'Variación de costes operativos',
        footBase: 'Base {base}',
        footClientsDelta: 'Base {base} · {delta} clientes',
        footTicketDelta: 'Base {base} · {delta}%',
        footCost: 'Base {base} / mes',
        footCostApplied: 'Base {base} / mes · se aplica sobre el efecto volumen',
        noBaseline: 'Sin base para este periodo',
        model: 'Modelo: ingresos = clientes × ingreso por cliente. El 35% de los costes operativos escala con el volumen de clientes (capacidad de entrega); el resto es estructura fija. El control de costes se aplica encima.',
        stat: {
          profit: 'Beneficio neto proyectado / mes', revenue: 'Ingresos / mes', costs: 'Costes operativos / mes',
          margin: 'Margen neto', annual: 'Impacto anual en beneficio',
        },
        delta: {
          none: 'Sin cambios vs base', vs: '{delta} vs base',
          saved: '{v} de ahorro vs base', added: '{v} adicionales vs base',
          annual: '12 × variación mensual', pts: '{v} pp',
        },
        empty: 'Sin ingresos en este periodo',
        chartEmpty: 'El gráfico del escenario aparece cuando el periodo tiene ingresos',
        chart: { baseline: 'Base', scenario: 'Escenario', revenue: 'Ingresos', costs: 'Costes', profit: 'Beneficio neto' },
        chartAria: 'Gráfico comparativo de base frente a escenario',
      },
      table: {
        title: 'Transacciones y pipeline de clientes',
        typeAria: 'Tipo de registro',
        tab: { all: 'Todos', Revenue: 'Ingresos', Expense: 'Gastos', Pipeline: 'Pipeline' },
        search: 'Buscar clientes, IDs, servicios…', searchAria: 'Buscar registros',
        col: { date: 'Fecha', id: 'ID', party: 'Cliente / proveedor', service: 'Servicio', type: 'Tipo', description: 'Descripción', amount: 'Importe', status: 'Estado' },
        sub: '{period} · {service} · {n} registros',
        pageInfo: 'Mostrando {from}–{to} de {total} · Ingresos {rev} · Gastos {exp}',
        noRecords: 'Sin registros',
        emptyQuery: 'Ningún registro coincide con “{q}” en {period}. Prueba a borrar la búsqueda o ampliar el periodo.',
        empty: 'No hay registros en {period}. Prueba a ampliar el periodo.',
        prev: '‹ Anterior', next: 'Siguiente ›', prevAria: 'Página anterior', nextAria: 'Página siguiente',
      },
      type: { Revenue: 'Ingreso', Expense: 'Gasto', Pipeline: 'Oportunidad' },
      status: { Paid: 'Pagado', Invoiced: 'Facturado', Overdue: 'Vencido' },
      stage: { Discovery: 'Descubrimiento', 'Proposal sent': 'Propuesta enviada', Negotiation: 'Negociación', 'Verbal commit': 'Compromiso verbal' },
      service: {
        'Web Development': 'Desarrollo web', 'Performance Marketing': 'Marketing de resultados',
        'Managed Retainers': 'Contratos recurrentes', 'Brand Strategy': 'Estrategia de marca',
        'Content Production': 'Producción de contenido', Unassigned: 'Sin asignar',
      },
      footer: { built: 'Hecho con HTML, Tailwind CSS y Chart.js · Sin compilación' },
      import: {
        title: 'Importar CSV',
        summary: '<strong class="text-ink">{name}</strong> — {n} filas válidas ({types}){skipped}, del {from} al {to}.',
        types: '{rev} ingresos, {exp} gastos, {pipe} oportunidades',
        skipped: ', {n} omitidas',
        help: 'Combinar añade las filas a los datos actuales (los IDs coincidentes se actualizan). Reemplazar sustituye todos los datos.',
        cancel: 'Cancelar', replace: 'Reemplazar datos actuales', merge: 'Combinar con los datos actuales',
      },
      toast: {
        exported: '{n} registros exportados a {name}',
        nothing: 'No hay nada que exportar: ajusta primero los filtros',
        importFailed: 'Error al importar: {msg}',
        readError: 'No se pudo leer el archivo.',
        merged: '{n} filas combinadas desde {name}',
        loaded: '{n} filas cargadas desde {name}',
        cleared: 'Datos eliminados',
        lang: 'Idioma: español',
      },
      err: {
        noRows: 'El archivo no contiene filas de datos.',
        missingCols: 'Faltan columnas obligatorias: el CSV necesita al menos “Date” (Fecha) y “Amount” (Importe).',
        noValid: 'No se encontraron filas válidas (revisa las columnas de fecha e importe).',
      },
      report: {
        toolbar: 'Resumen ejecutivo — vista previa de impresión',
        print: 'Imprimir / Guardar como PDF', close: 'Cerrar', aria: 'Informe de resumen ejecutivo',
        title: 'Resumen ejecutivo — {period}',
        scope: 'Alcance:', compared: 'Comparado con:', generated: 'Generado:',
        kpis: 'Indicadores clave de rendimiento',
        noPrior: 'sin datos previos',
        trendChart: 'Ingresos vs. gastos — {year} (periodo seleccionado resaltado)',
        mixChart: 'Ingresos por servicio',
        trendAlt: 'Gráfico de ingresos vs gastos', mixAlt: 'Gráfico de ingresos por servicio',
        highlights: 'Aspectos destacados', focus: 'Enfoque recomendado', topClients: 'Principales clientes por ingresos',
        col: { client: 'Cliente', invoices: 'Facturas', revenue: 'Ingresos', share: 'Cuota' },
        totalRevenue: 'Ingresos totales', opCosts: 'Costes operativos', netProfit: 'Beneficio neto',
        noRevenue: 'Sin ingresos en este periodo.',
        scenario: 'Escenario simulado',
        scenarioText: '{clients} clientes / mes ({dClients}), {ticket} de ingreso medio por cliente, costes operativos {cost}. Beneficio neto mensual proyectado de <b>{profit}</b> frente a {base} de base (margen {margin}): un impacto anual de <b>{annual}</b>.',
        confidential: '{company} · Confidencial — solo para uso interno',
      },
      hl: {
        revenue: 'Ingresos de <b>{revenue}</b>{change}.',
        revenueUp: ', un {pct} más que en {prev}', revenueDown: ', un {pct} menos que en {prev}',
        profit: 'Beneficio neto de <b>{profit}</b> con un margen neto del <b>{margin}</b>{change}.',
        profitChange: ' ({pts} pp)',
        mix: '<b>{top}</b> lideró el mix de servicios con el {share} de los ingresos{next}.',
        mixNext: ', seguido de {name} ({share})',
        goal: 'Cumplimiento del objetivo del <b>{goal}</b> sobre un objetivo de ingresos de {target}: {status}.',
        goalAchieved: 'objetivo alcanzado', goalOnTrack: 'en línea con el plan', goalBehind: 'por debajo del plan en {gap}',
        pipeline: 'Pipeline abierto de <b>{pipeline}</b> en {deals} oportunidades{top}.',
        pipelineTop: '; la mayor: {party} ({amount})',
        overdueOne: '<b>1 factura vencida</b> por {sum} requiere seguimiento de cobro.',
        overdueMany: '<b>{n} facturas vencidas</b> por un total de {sum} requieren seguimiento de cobro.',
      },
      focus: {
        collections: 'Acelerar el cobro de {sum} en facturas vencidas para proteger la tesorería.',
        margin: 'El margen se redujo {pts} pp: revisar el gasto en colaboradores externos y la utilización del equipo.',
        gap: 'Cerrar la brecha de {gap} frente al objetivo priorizando las oportunidades en fase avanzada.',
        onPlan: 'El rendimiento va según lo previsto: priorizar la conversión de las tres principales oportunidades y proteger el margen actual.',
      },
    },
  };

  /* --------------------------------------------------------------- runtime */
  let lang = 'en'; // English by default for first-time visitors
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && DICT[saved]) lang = saved;
  } catch (e) { /* storage unavailable */ }

  const listeners = [];

  function lookup(l, key) {
    return key.split('.').reduce((node, k) => (node != null && node[k] !== undefined ? node[k] : undefined), DICT[l]);
  }

  /** Translate a key (falls back to English, then to the key itself). */
  function t(key, params) {
    let v = lookup(lang, key);
    if (v === undefined) v = lookup('en', key);
    if (v === undefined) return key;
    if (typeof v === 'string' && params) {
      v = v.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined && params[k] !== null ? String(params[k]) : m));
    }
    return v;
  }

  /** Display label for a canonical data value; custom (imported) values pass through untouched. */
  function label(group, raw) {
    const g = DICT[lang][group];
    if (g && Object.prototype.hasOwnProperty.call(g, raw)) return g[raw];
    const en = DICT.en[group];
    if (en && Object.prototype.hasOwnProperty.call(en, raw)) return en[raw];
    return raw;
  }

  /** Map any known label (EN or ES, case-insensitive) back to its canonical key, else null. */
  function canonical(group, text) {
    const needle = String(text || '').trim().toLowerCase();
    if (!needle) return null;
    for (const l of Object.keys(DICT)) {
      const g = DICT[l][group] || {};
      for (const key of Object.keys(g)) {
        if (key.toLowerCase() === needle || String(g[key]).toLowerCase() === needle) return key;
      }
    }
    return null;
  }

  function apply(rootEl = document) {
    const html = document.documentElement;
    html.setAttribute('lang', lang);
    document.title = t('meta.title');
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', t('meta.description'));
    rootEl.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    rootEl.querySelectorAll('[data-i18n-placeholder]').forEach((el) => el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder)));
    rootEl.querySelectorAll('[data-i18n-title]').forEach((el) => el.setAttribute('title', t(el.dataset.i18nTitle)));
    rootEl.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    rootEl.querySelectorAll('[data-lang-opt]').forEach((el) => el.classList.toggle('is-active', el.dataset.langOpt === lang));
  }

  function setLang(next) {
    if (!DICT[next] || next === lang) return;
    lang = next;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* storage unavailable */ }
    apply();
    listeners.forEach((fn) => fn(lang));
  }

  root.I18N = {
    t, label, canonical, apply, setLang,
    toggle: () => setLang(lang === 'en' ? 'es' : 'en'),
    onChange: (fn) => listeners.push(fn),
    get lang() { return lang; },
    get locale() { return LOCALES[lang]; },
    languages: Object.keys(DICT),
  };
})(window);
