# Interactive Business KPI Dashboard & Executive Reporting Tool

A web-based KPI and operations dashboard for small businesses. It tracks revenue, expenses, client pipeline and monthly targets, with interactive charts, a live what-if simulator, CSV import/export and a printable one-page executive summary.

It's plain HTML, CSS and JavaScript, with **Tailwind CSS** and **Chart.js** loaded from a CDN. There's **no build step**: open it locally or deploy it to Netlify in seconds.

> All company names and figures are **fictional demo data**. The demo company is "Northbeam Partners", a mid-size digital services agency.

---

## Features

| Area | What it does |
|---|---|
| **Executive KPI cards** | Monthly / Quarterly / Annual Revenue, Net Profit Margin, Active Client Pipeline, Goal Completion (%). Each card has a period-over-period trend badge (▲/▼ % or pts). |
| **Revenue vs. Expenses** | A monthly trend chart you can switch between **Bar** and **Line**. The selected period is highlighted, and clicking a month drills into it. |
| **Revenue by Service** | A doughnut chart with a value/percentage legend. Clicking a service filters the whole dashboard. |
| **Dynamic controls** | Year, Period (full year / quarter / month) and Service filters, a Reset button, and a Dark/Light toggle (it remembers your choice and follows the OS by default). |
| **What-If Simulator** | Sliders for client volume, average revenue per client and operating costs. It projects revenue, costs, net profit, margin and annualized impact live, with a baseline-vs-scenario chart and presets (Conservative, Growth push, Cost discipline). |
| **Transactions & Pipeline table** | Search with highlighted matches, filter by type (Revenue / Expenses / Pipeline), sortable columns, pagination, and totals for the rows in view. |
| **CSV export** | Exports exactly the filtered records: period + service + type + search. |
| **CSV import** | Load a CSV with the file picker or by dragging it onto the page. You can merge it with the current data (rows with the same ID are updated) or replace the data. Headers are matched flexibly (e.g. `Client` / `Vendor` / `Customer`). Accepts US or ISO dates, `$1,234.00` or `(1,234)` amounts, and comma or semicolon delimiters. |
| **English / Spanish** | An `EN / ES` toggle in the top bar switches every label, chart, table, message and the printable report instantly, with no reload. English is the default and your choice is remembered. Data and CSV files always keep their original English values, so imports and exports work in either language. |
| **Executive Summary (PDF)** | An on-screen print preview of a one-page A4 report: KPIs, charts, auto-generated highlights, recommended focus, top clients, P&L summary and the modeled scenario. **Print / Save as PDF** uses a dedicated `@media print` layout that always prints light. |

## Folder structure

```
upwork-kpi-dashboard/
├── index.html        # Layout & markup (Tailwind + Chart.js via CDN)
├── styles.css        # Design tokens (light/dark), components, print layout
├── app.js            # KPIs, charts, filters, simulator, table, CSV, report
├── i18n.js           # English / Spanish dictionaries + t() translation helper
├── data.js           # Business config + seeded demo-data generator (FY2024–FY2025)
├── sample-data.csv   # FY2026 Jan–Oct sample to demo the CSV import
├── netlify.toml      # Zero-config static deploy
└── README.md
```

## Run locally

- **Simplest:** double-click `index.html`. It opens in any modern browser (you need an internet connection for the CDN scripts and font).
- **Optional local server:** for example the VS Code "Live Server" extension, or `npx serve .` if you have Node.js.

### Try the import

1. Click **Import CSV** (or drag `sample-data.csv` onto the page).
2. Choose **Merge with current data**. The dashboard jumps to October 2026, and 2026 appears in the Year filter.
3. Click **Reset demo data** (under the company name) to go back.

### CSV format

```
Date,ID,Type,Client/Vendor,Service,Description,Amount,Status
2026-01-05,INV-2026-0001,Revenue,Ironleaf Manufacturing,Web Development,Website redesign — milestone,18500.00,Paid
2026-01-12,EXP-2026-0001,Expense,Contractor network,Web Development,Freelance specialists,4200.00,Paid
2026-01-20,OPP-2026-0001,Pipeline,Sable Creek Wineries,Brand Strategy,Proposal — Rebrand program,30500.00,Negotiation
```

- **Required columns:** `Date` and `Amount`. All other columns are optional.
- **Type:** `Revenue`, `Expense` or `Pipeline`. If it's missing, negative amounts are treated as expenses.
- **Status:** `Paid`, `Invoiced` or `Overdue` for revenue. For pipeline rows it holds the deal stage.

### How the KPIs are calculated

- **Revenue** is the sum of `Revenue` rows. Pipeline rows are never counted as revenue.
- **Net Profit Margin** = (Revenue − Expenses) ÷ Revenue.
- **Active Client Pipeline** is the total value of `Pipeline` rows expected to close in the period, plus the number of open deals and distinct active clients.
- **Goal Completion** = Revenue ÷ Target. Each month's target is the same month last year × 1.12. If there's no prior-year data, the target is the dataset's average monthly revenue × 1.05. With a service filter, the target is pro-rated by that service's share of revenue.
- **Trend badges** compare against the previous equivalent period (previous month, previous quarter or previous year).
- **Simulator:** Revenue = clients × revenue per client. 35% of operating costs scale with client volume, and the cost slider applies on top of that.

To rebrand, change `COMPANY`, `SERVICES` and the target settings in `data.js`. Colors are CSS variables at the top of `styles.css`.

---

## Deploy to Netlify (about 60 seconds)

**Option A: drag & drop (no account setup beyond sign-in)**
1. Go to **https://app.netlify.com/drop** and sign in.
2. Drag the whole `upwork-kpi-dashboard` folder onto the page.
3. Netlify gives you a live URL. Under **Site configuration → Change site name**, rename it to something like `kpi-dashboard-demo` so the link reads `https://kpi-dashboard-demo.netlify.app`.

**Option B: from GitHub (auto-deploys on every push)**
1. Push the folder to a GitHub repository.
2. In Netlify, choose **Add new site → Import an existing project → GitHub**, then pick the repository.
3. Leave the build command empty and set the publish directory to `.` (`netlify.toml` already sets both). Click **Deploy**.

After deploying, open the live URL, click through the filters, the simulator and Executive Summary, and test **Export CSV** once.

---

**Tech:** HTML5 · Tailwind CSS 3.4 (CDN) · Chart.js 4.4 · Vanilla JavaScript (ES2020) · CSS `@media print` · Netlify
