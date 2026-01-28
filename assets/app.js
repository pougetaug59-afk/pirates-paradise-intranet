/* =========================================================
   Pirates Paradise — Intranet MVP Core
   assets/app.js
   - Navigation active
   - Role persistence
   - Search redirect
   - Live data fetch from n8n
   - Auto-refresh every 5 min
========================================================= */

/* ===== CONFIG ENDPOINTS (à brancher progressivement) ===== */

const TOKEN = "pp_lille_59"; // ton token actuel

const ENDPOINTS = {
  home: `https://pp.autopdm.fr/webhook/pp/dashboard?token=${TOKEN}`,

  // Pages à brancher ensuite dans n8n :
  ca: `https://pp.autopdm.fr/webhook/pp/ca?token=${TOKEN}`,
  frequentation: `https://pp.autopdm.fr/webhook/pp/frequentation?token=${TOKEN}`,
  alerts: `https://pp.autopdm.fr/webhook/pp/alerts?token=${TOKEN}`,
  ops: `https://pp.autopdm.fr/webhook/pp/ops?token=${TOKEN}`,
  docs: `https://pp.autopdm.fr/webhook/pp/docs?token=${TOKEN}`,
  tools: `https://pp.autopdm.fr/webhook/pp/tools?token=${TOKEN}`,

  // Modules futurs
  crm: `https://pp.autopdm.fr/webhook/pp/crm?token=${TOKEN}`,
  b2b: `https://pp.autopdm.fr/webhook/pp/b2b?token=${TOKEN}`,
  rh: `https://pp.autopdm.fr/webhook/pp/rh?token=${TOKEN}`,
  finance: `https://pp.autopdm.fr/webhook/pp/finance?token=${TOKEN}`,
  com: `https://pp.autopdm.fr/webhook/pp/com?token=${TOKEN}`,
  gifts: `https://pp.autopdm.fr/webhook/pp/gifts?token=${TOKEN}`,
};

const REFRESH_MS = 5 * 60 * 1000; // auto-refresh 5 minutes

/* ===== HELPERS ===== */

const eur = (n) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
      }).format(n);

function $(id) {
  return document.getElementById(id);
}

/* ===== UI INIT ===== */

function setSubtitle() {
  const sub = $("subtitle");
  if (!sub) return;

  const now = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
  }).format(new Date());

  sub.textContent = now;
}

function setActiveNav(page) {
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.nav === page);
  });
}

/* ===== ROLE (MVP simple) ===== */

function initRoleSelect() {
  const roleSelect = $("roleSelect");
  if (!roleSelect) return;

  // load saved role
  const saved = localStorage.getItem("pp_role");
  if (saved) roleSelect.value = saved;

  // persist role
  roleSelect.addEventListener("change", () => {
    localStorage.setItem("pp_role", roleSelect.value);
  });
}

/* ===== SEARCH MVP ===== */

function initSearch() {
  const input = $("searchInput");
  if (!input) return;

  const pages = [
    { name: "Dashboard", href: "./index.html" },
    { name: "CA", href: "./ca.html" },
    { name: "Fréquentation", href: "./frequentation.html" },
    { name: "Alertes", href: "./alerts.html" },
    { name: "Ops", href: "./ops.html" },
    { name: "Docs", href: "./docs.html" },
    { name: "Outils", href: "./tools.html" },
    { name: "CRM", href: "./crm.html" },
    { name: "B2B", href: "./b2b.html" },
    { name: "RH", href: "./rh.html" },
    { name: "Compta", href: "./finance.html" },
    { name: "Com", href: "./com.html" },
    { name: "Bons cadeaux", href: "./gifts.html" },
    { name: "Réglages", href: "./settings.html" },
  ];

  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    const q = input.value.trim().toLowerCase();
    if (!q) return;

    const match = pages.find((p) =>
      p.name.toLowerCase().includes(q)
    );

    if (match) window.location.href = match.href;
  });
}

/* ===== FETCH DATA ===== */

async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return await res.json();
}

/* ===== MAIN LOADER ===== */

async function loadPageData() {
  const page = document.body.dataset.page || "home";

  setActiveNav(page);
  setSubtitle();

  const endpoint = ENDPOINTS[page];
  if (!endpoint) return;

  try {
    const data = await fetchJSON(endpoint);

    // dernière mise à jour affichée
    if ($("lastUpdate")) {
      $("lastUpdate").textContent =
        data.lastUpdate || data?.last?.date || "—";
    }

    // HOME KPIs (seulement si les IDs existent)
    if (data.last) {
      const last = data.last;

      if ($("kpi_ca_day")) $("kpi_ca_day").textContent = eur(last.ca_day);
      if ($("kpi_ca_wtd"))
        $("kpi_ca_wtd").textContent = eur(last.ca_week_to_date);
      if ($("kpi_ca_mtd"))
        $("kpi_ca_mtd").textContent = eur(last.ca_month_to_date);

      if ($("kpi_covers_day"))
        $("kpi_covers_day").textContent =
          last.covers_day ?? "—";

      if ($("kpi_tm_day"))
        $("kpi_tm_day").textContent =
          eur(last.avg_ticket_day);

      if ($("kpi_focus")) {
        $("kpi_focus").textContent =
          last.ca_day_vs_n1_pct < -10
            ? "⚠️ Baisse CA aujourd’hui"
            : "✅ Situation normale";
      }
    }

  } catch (err) {
    console.warn("API indisponible :", err);

    if ($("kpi_focus")) {
      $("kpi_focus").textContent = "API indisponible";
    }
  }
}

/* ===== BOOT ===== */

window.addEventListener("DOMContentLoaded", () => {
  initRoleSelect();
  initSearch();

  loadPageData();

  // Auto refresh every 5 min
  setInterval(loadPageData, REFRESH_MS);
});
