(() => {
  // =========================
  // CONFIG
  // =========================
  const DASHBOARD_URL = "https://pp.autopdm.fr/webhook/pp/dashboard?token=pp_lille_59";

  // Petit helper
  const $ = (sel) => document.querySelector(sel);

  // =========================
  // UI: subtitle date
  // =========================
  const subtitle = $("#subtitle");
  if (subtitle) {
    const fr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date());
    subtitle.textContent = fr;
  }

  // =========================
  // UI: nav active
  // =========================
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll(".nav-link").forEach((a) => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    if (href === path) {
      a.classList.add("is-active");
    }
  });

  // =========================
  // Formatters
  // =========================
  const fmtEUR = (n) => {
    if (n == null || Number.isNaN(Number(n))) return "—";
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n));
  };

  const fmtINT = (n) => {
    if (n == null || Number.isNaN(Number(n))) return "—";
    return new Intl.NumberFormat("fr-FR").format(Number(n));
  };

  const fmtPCT = (n) => {
    if (n == null || Number.isNaN(Number(n))) return "—";
    const v = Number(n);
    const sign = v > 0 ? "+" : "";
    return `${sign}${v.toFixed(1)}%`;
  };

  const fmtISODateTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString("fr-FR");
  };

  // =========================
  // Chart (home)
  // =========================
  let ca7ChartInstance = null;

  function renderHomeChart(history) {
    const canvas = $("#ca7Chart");
    if (!canvas) return; // pas la home

    if (typeof Chart === "undefined") {
      console.warn("[PP OS] Chart.js non chargé");
      return;
    }

    // Prendre les 7 derniers points dispo
    const last7 = (Array.isArray(history) ? history : []).slice(-7);
    const labels = last7.map((x) => (x.date ? x.date.slice(5) : "")); // MM-DD
    const values = last7.map((x) => Number(x.ca_day || 0));

    // Détruire l’ancien chart si refresh
    if (ca7ChartInstance) {
      ca7ChartInstance.destroy();
      ca7ChartInstance = null;
    }

    ca7ChartInstance = new Chart(canvas, {
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

  // =========================
  // Home KPIs mapping (index.html)
  // =========================
  function hydrateHome(payload) {
    console.log("PAYLOAD RECU =", payload);
console.log("LAST =", payload.last);

    const last = payload?.last || {};

    // Badges footer (si présents)
    const osUpdated = $("#osUpdated");
    if (osUpdated) osUpdated.textContent = fmtISODateTime(payload?.updatedAt);

    const osVersion = $("#osVersion");
    if (osVersion) osVersion.textContent = "live";

    // KPI cards (tes IDs sur la home)
    const kpiCa = $("#kpiCa");
    if (kpiCa) kpiCa.textContent = fmtEUR(last.ca_day);

    const kpiCaMeta = $("#kpiCaMeta");
    if (kpiCaMeta) kpiCaMeta.textContent = `vs N-1 : ${fmtPCT(last.ca_day_vs_n1_pct)}`;

    const kpiCovers = $("#kpiCovers");
    if (kpiCovers) kpiCovers.textContent = fmtINT(last.covers_day);

    const kpiCoversMeta = $("#kpiCoversMeta");
    // Ton webhook ne donne pas covers_day_n1 pour l’instant → on met —
    if (kpiCoversMeta) kpiCoversMeta.textContent = `vs N-1 : —`;

    const kpiTm = $("#kpiTm");
    if (kpiTm) kpiTm.textContent = fmtEUR(last.avg_ticket_day);

    const kpiTmMeta = $("#kpiTmMeta");
    if (kpiTmMeta) kpiTmMeta.textContent = `objectif : —`;

    // Objectif (pas encore dans ton payload)
    const kpiGoal = $("#kpiGoal");
    if (kpiGoal) kpiGoal.textContent = "—";

    const goalBar = $("#goalBar");
    if (goalBar) goalBar.style.width = "0%";

    const kpiGoalMeta = $("#kpiGoalMeta");
    if (kpiGoalMeta) kpiGoalMeta.textContent = "—";

    // Optionnel : afficher clairement la date de “last”
    const badgeToday = $("#badgeToday");
    if (badgeToday && last.date) badgeToday.textContent = `📅 ${last.date}`;

    // Chart
    renderHomeChart(payload?.history);
  }

  // =========================
  // Fetch webhook
  // =========================
  async function loadDashboardFromWebhook() {
    try {
      const res = await fetch(`${DASHBOARD_URL}&_=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);

      const payload = await res.json();
      window.__PP_DASHBOARD__ = payload;

      // Home
      hydrateHome(payload);

      console.log("[PP OS] Webhook dashboard OK ✅", payload);
    } catch (e) {
      console.warn("[PP OS] Webhook dashboard KO ❌", e);

      // Si erreur, on ne casse pas l’UI : on met juste des —
      const ids = [
        "kpiCa", "kpiCaMeta", "kpiCovers", "kpiCoversMeta",
        "kpiTm", "kpiTmMeta", "kpiGoal", "kpiGoalMeta", "osUpdated"
      ];
      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = "—";
      });
      const bar = document.getElementById("goalBar");
      if (bar) bar.style.width = "0%";
    }
  }

  // =========================
  // Init + refresh
  // =========================
  loadDashboardFromWebhook();
  setInterval(loadDashboardFromWebhook, 2 * 60 * 1000);
})();
