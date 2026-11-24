/* ==========================================================================
   data.js — Demo dataset + business configuration
   --------------------------------------------------------------------------
   Generates a realistic, deterministic (seeded) ledger for a fictional
   mid-size digital services agency. Every figure is fictional.
   Record shape (also the CSV schema):
     { date: 'YYYY-MM-DD', id, type: 'Revenue'|'Expense'|'Pipeline',
       party, service, description, amount, status }
   ========================================================================== */
(function (root) {
  'use strict';

  const COMPANY = {
    name: 'Brújula',
    descriptor: 'Digital Services Agency',
    note: 'All company names and figures are fictional demo data.',
  };

  // Order matters: it fixes each service's chart color (color follows the entity).
  const SERVICES = [
    {
      name: 'Web Development', share: 0.30, min: 7000, max: 26000,
      vendor: 'Cloud hosting & licenses', direct: 'Hosting, plugins & licenses',
      items: ['Website redesign — milestone', 'E-commerce build — sprint', 'Landing page package',
              'CMS migration', 'Web app maintenance', 'Accessibility remediation'],
      deals: ['Website rebuild', 'Customer portal', 'E-commerce replatform', 'Headless CMS project'],
    },
    {
      name: 'Performance Marketing', share: 0.24, min: 4000, max: 15000,
      vendor: 'Ad platform spend', direct: 'Media spend (non-billable)',
      items: ['Paid search management', 'Paid social campaign', 'CRO testing program',
              'Analytics & attribution setup', 'Lead-gen campaign'],
      deals: ['Paid media program', 'Lead-gen engine', 'CRO roadmap'],
    },
    {
      name: 'Managed Retainers', share: 0.18, min: 4500, max: 9500,
      vendor: 'Support tooling', direct: 'Helpdesk & monitoring tools',
      items: ['Monthly growth retainer', 'Fractional CMO retainer', 'Support & SLA retainer'],
      deals: ['Annual growth retainer', 'Support SLA renewal', 'Fractional CMO engagement'],
    },
    {
      name: 'Brand Strategy', share: 0.14, min: 6000, max: 21000,
      vendor: 'Research panels', direct: 'Customer research & panels',
      items: ['Brand identity system', 'Positioning workshop', 'Messaging framework', 'Rebrand rollout'],
      deals: ['Rebrand program', 'Positioning sprint', 'Brand architecture review'],
    },
    {
      name: 'Content Production', share: 0.14, min: 3000, max: 12000,
      vendor: 'Production crew & studio', direct: 'Studio, crew & equipment',
      items: ['Video production', 'Photography shoot', 'Blog content package', 'Case study series'],
      deals: ['Video content series', 'Quarterly content plan', 'Product launch shoot'],
    },
  ];

  // Ordered roughly by account size — earlier clients are picked more often.
  const CLIENTS = [
    'Ironleaf Manufacturing', 'Maplestone Insurance', 'Bluewater Logistics', 'Juniper Health Clinics',
    'Redwood Financial Advisors', 'Orchid Hospitality Group', 'Lumen Solar Co.', 'Northgate Properties',
    'Kestrel Aviation Services', 'Corvid Analytics', 'Alder & Finch Legal', 'Granite Peak Outfitters',
    'Fairhaven Realty', 'Everline Fitness', 'Pinecrest Academy', 'Quayside Marine',
    'Cedar Ridge Dental', 'Harbor Lane Bakery',
  ];
  const PROSPECTS = [
    'Sable Creek Wineries', 'Tidewater Clinics', 'Vantage Freight', 'Willowbrook Senior Living',
    'Atlas Ridge Engineering', 'Brightwater Credit Union', 'Summit Trail Apparel', 'Halden Biotech',
  ];
  const STAGES = ['Discovery', 'Proposal sent', 'Negotiation', 'Verbal commit'];

  const BASE_REVENUE = 176000;                 // monthly revenue level, Jan 2024
  const ANNUAL_GROWTH = 0.15;
  const SEASON = [0.88, 0.90, 1.00, 0.97, 1.03, 0.98, 0.90, 0.94, 1.05, 1.10, 1.07, 1.04];

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const roundTo = (v, step) => Math.round(v / step) * step;
  const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();

  /**
   * Generate ledger rows between two months (inclusive).
   * Invoice status is relative to the last generated month (recent = unpaid).
   */
  function generateLedger({ from = [2024, 0], to = [2025, 11], seed = 20250101 } = {}) {
    const r = mulberry32(seed);
    const pick = (arr, skew = 1) => arr[Math.min(arr.length - 1, Math.floor(Math.pow(r(), skew) * arr.length))];
    const rows = [];
    const counters = {};
    const nextId = (prefix, year) => {
      const k = prefix + year;
      counters[k] = (counters[k] || 0) + 1;
      return `${prefix}-${year}-${pad(counters[k], 4)}`;
    };
    const endIdx = to[0] * 12 + to[1];

    for (let idx = from[0] * 12 + from[1]; idx <= endIdx; idx++) {
      const year = Math.floor(idx / 12);
      const month = idx % 12;
      const t = idx - 2024 * 12;
      const ageFromEnd = endIdx - idx;
      const dim = daysIn(year, month);
      const day = () => `${year}-${pad(month + 1)}-${pad(1 + Math.floor(r() * dim))}`;

      const level = BASE_REVENUE * SEASON[month] * Math.pow(1 + ANNUAL_GROWTH, t / 12) * (0.94 + r() * 0.12);
      let booked = 0;

      // ---- Revenue (invoices)
      SERVICES.forEach((svc) => {
        let budget = level * svc.share * (0.86 + r() * 0.28);
        while (budget > svc.min * 0.6) {
          const amount = roundTo(Math.min(budget, svc.min + r() * (svc.max - svc.min)), 50);
          budget -= amount;
          booked += amount;
          let status = 'Paid';
          const p = r();
          if (ageFromEnd === 0) status = p < 0.38 ? 'Paid' : p < 0.92 ? 'Invoiced' : 'Overdue';
          else if (ageFromEnd === 1) status = p < 0.8 ? 'Paid' : p < 0.93 ? 'Invoiced' : 'Overdue';
          else if (ageFromEnd <= 3) status = p < 0.95 ? 'Paid' : 'Overdue';
          rows.push({
            date: day(), id: nextId('INV', year), type: 'Revenue', party: pick(CLIENTS, 1.6),
            service: svc.name, description: pick(svc.items), amount, status,
          });
        }
      });

      // ---- Expenses (job-costed to each service line)
      const totalCost = booked * (0.70 + r() * 0.08);
      SERVICES.forEach((svc) => {
        const svcCost = totalCost * svc.share * (0.9 + r() * 0.2);
        const lines = [
          ['Internal payroll', `Delivery team & overhead allocation`, 0.65],
          ['Contractor network', `Freelance specialists`, 0.20],
          [svc.vendor, svc.direct, 0.15],
        ];
        lines.forEach(([party, description, w]) => {
          rows.push({
            date: day(), id: nextId('EXP', year), type: 'Expense', party, service: svc.name,
            description, amount: roundTo(svcCost * w * (0.92 + r() * 0.16), 10), status: 'Paid',
          });
        });
      });

      // ---- Pipeline (open opportunities by expected close month)
      const deals = 6 + Math.floor(r() * 4);
      for (let i = 0; i < deals; i++) {
        const svc = pick(SERVICES, 1.3);
        rows.push({
          date: day(), id: nextId('OPP', year), type: 'Pipeline',
          party: r() < 0.55 ? pick(PROSPECTS) : pick(CLIENTS, 1.4),
          service: svc.name, description: `Proposal — ${pick(svc.deals)}`,
          amount: roundTo(9000 + r() * 40000, 500), status: pick(STAGES),
        });
      }
    }
    rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id.localeCompare(b.id)));
    return rows;
  }

  const api = {
    COMPANY,
    SERVICES: SERVICES.map((s) => s.name),
    TARGET_GROWTH: 0.12,          // revenue goal = same month last year × 1.12
    FALLBACK_TARGET_UPLIFT: 1.05, // no prior-year data → dataset monthly average × 1.05
    generateLedger,
    demoData: () => generateLedger({ from: [2024, 0], to: [2025, 11], seed: 20250340 }),
  };

  root.KPI_DATA = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
