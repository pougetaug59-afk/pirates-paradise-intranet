(() => {
  // =========================
  // Helpers
  // =========================
  const $ = (sel) => document.querySelector(sel);

  function fmtEUR(n) {
    if (n === null || n === undefined || n === "" || Number.isNaN(Number(n))) return "—";
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n));
  }

  function fmtINT(n) {
    if (n === null || n === undefined || n === "" || Number.isNaN(Number(n))) return "—";
    return new Intl.NumberFormat("fr-FR").format(Math.round(Number(n)));
  }

  function fmtPCT(n) {
    if (n === null || n === undefined || n === "" || Number.isNaN(Number(n))) return "—";
    const num = Number(n);
    const sign = num > 0 ? "+" : "";
    return `${sign}${num.toFixed(1)}%`;
  }

  function fmtISODateTime(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso);
      return new Intl.DateTimeFormat("fr-FR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return String(iso);
    }
  }

  // =========================
  // UI header (subtitle date)
  // =========================
  const subtitle = $("#subtitle");
  if (subtitle) {
    const fr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date());
    subtitle.textContent = fr;
  }

  // Active nav link
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll(".nav-link").forEach((a) => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    if (href === path) {
      a.classList.add("is-active");
    }
  });

  // =========================
  // WEBHOOK CONFIG
  // =========================
  const DASHBOARD_URL = "https://pp.autopdm.fr/webhook/pp/dashboard?token=pp_lille_59";

  async function fetchDashboard() {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);

    try {
      const res = await fetch(`${DASHBOARD_URL}&_=${Date.now()}`, {
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log("[PP OS] Webhook dashboard OK ✅", data);
      return data;
    } catch (e) {
      console.warn("[PP OS] Webhook dashboard KO ❌", e);
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  // =========================
  // HOME hydration (robuste : premium + ancien MVP)
  // =========================
  function renderHomeChart(history) {
    // Si Chart.js n’est pas chargé sur la page, on skip.
    if (!window.Chart) return;

    const canvas = $("#ca7Chart");
    if (!canvas) return;

    // Prendre les 7 derniers jours de l'history (si dispo)
    const arr = Array.isArray(history) ? history.slice(-7) : [];
    if (!arr.length) return;

    const labels = arr.map((x) => (x.date || "").slice(5)); // "MM-DD"
    const values = arr.map((x) => Number(x.ca_day || 0));

    // Détruire un chart existant si on recharge
    if (canvas.__chart) {
      canvas.__chart.destroy();
      canvas.__chart = null;
    }

    const ctx = canvas.getContext("2d");
    canvas.__chart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            data: values,
            borderWidth: 2,
            tension: 0.35,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } },
      },
    });
  }

  function hydrateHome(payload) {
    console.log("PAYLOAD RECU =", payload);
    console.log("LAST =", payload?.last);

    const last = payload?.last || {};

    // ---- Badges / footer / dates
    const osUpdated = $("#osUpdated") || $("#lastUpdate");
    if (osUpdated) {
      // ton payload = updatedAt (ISO)
      osUpdated.textContent = fmtISODateTime(payload?.updatedAt);
    }

    const osVersion = $("#osVersion");
    if (osVersion) osVersion.textContent = "live";

    const badgeToday = $("#badgeToday");
    if (badgeToday && last.date) badgeToday.textContent = `📅 ${last.date}`;

    // ---- KPIs (NOUVELLE HOME premium)
    const kpiCa = $("#kpiCa");
    if (kpiCa) kpiCa.textContent = fmtEUR(last.ca_day);

    const kpiCaMeta = $("#kpiCaMeta");
    if (kpiCaMeta) kpiCaMeta.textContent = `vs N-1 : ${fmtPCT(last.ca_day_vs_n1_pct)}`;

    const kpiCovers = $("#kpiCovers");
    if (kpiCovers) kpiCovers.textContent = fmtINT(last.covers_day);

    const kpiCoversMeta = $("#kpiCoversMeta");
    if (kpiCoversMeta) kpiCoversMeta.textContent = `vs N-1 : —`;

    const kpiTm = $("#kpiTm");
    if (kpiTm) kpiTm.textContent = fmtEUR(last.avg_ticket_day);

    const kpiTmMeta = $("#kpiTmMeta");
    if (kpiTmMeta) kpiTmMeta.textContent = `objectif : —`;

    const kpiGoal = $("#kpiGoal");
    if (kpiGoal) kpiGoal.textContent = "—";

    const goalBar = $("#goalBar");
    if (goalBar) goalBar.style.width = "0%";

    const kpiGoalMeta = $("#kpiGoalMeta");
    if (kpiGoalMeta) kpiGoalMeta.textContent = "—";

    // ---- KPIs (ANCIENNE HOME MVP)
    const oldCa = $("#kpi_ca_day");
    if (oldCa) oldCa.textContent = fmtEUR(last.ca_day);

    const oldCovers = $("#kpi_covers_day");
    if (oldCovers) oldCovers.textContent = fmtINT(last.covers_day);

    const oldTm = $("#kpi_tm_day");
    if (oldTm) oldTm.textContent = fmtEUR(last.avg_ticket_day);

    // ---- Chart (si page premium)
    renderHomeChart(payload?.history);
  }

  // =========================
  // Page router
  // =========================
  async function boot() {
    const page = document.body?.dataset?.page || "";

    const payload = await fetchDashboard();

    if (!payload) {
      // si KO : on affiche une info minimale si possible
      const osUpdated = $("#osUpdated") || $("#lastUpdate");
      if (osUpdated) osUpdated.textContent = "indisponible";
      return;
    }

    // Home
    if (page === "home" || path === "index.html" || path === "pirates-paradise-intranet") {
      hydrateHome(payload);
    }

    // (plus tard : hydrateCA(payload), hydrateOps(payload), etc.)
  }

  // Boot + refresh
  boot();
  setInterval(boot, 2 * 60 * 1000);
})();
