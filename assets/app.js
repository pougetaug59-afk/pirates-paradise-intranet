(() => {
  // =========================
  // Helpers
  // =========================
  const $ = (sel) => document.querySelector(sel);

  function fmtINT(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return new Intl.NumberFormat("fr-FR").format(x);
  }

  function fmtEUR(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(x);
  }

  function fmtPCT(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    const sign = x > 0 ? "+" : "";
    return `${sign}${x.toFixed(1)}%`;
  }

  function fmtISODateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  }

  function fmtYMD(ymd) {
    if (!ymd) return "—";
    // "2026-01-31" -> affichage simple
    return ymd;
  }

  // =========================
  // Config webhook (N8N)
  // =========================
  const DASHBOARD_URL = "https://pp.autopdm.fr/webhook/pp/dashboard?token=pp_lille_59";

  let inFlight = false;
  let timer = null;

  async function fetchDashboard() {
    if (inFlight) return null;
    inFlight = true;

    try {
      // cache: no-store pour éviter les vieux payloads
      const res = await fetch(DASHBOARD_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);

      const data = await res.json();

      console.log("[PP OS] Webhook dashboard OK ✅", data);
      return data;
    } catch (e) {
      console.warn("[PP OS] Webhook dashboard FAIL ❌", e);
      return null;
    } finally {
      inFlight = false;
    }
  }

  // =========================
  // Chart Home (7 derniers jours)
  // =========================
  let homeChart = null;

  function renderHomeChart(history) {
    const canvas = $("#ca7Chart");
    if (!canvas) return;

    // Chart.js doit être chargé par la page (index.html)
    if (typeof Chart === "undefined") return;

    const arr = Array.isArray(history) ? history : [];
    // On prend les 7 derniers points disponibles
    const last7 = arr.slice(-7);

    const labels = last7.map((h) => {
      // h.date = "2026-01-31"
      const d = h?.date || "";
      // Affichage court: "31/01"
      const parts = d.split("-");
      if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
      return d || "—";
    });

    const values = last7.map((h) => Number(h?.ca_day));

    // Détruit l'ancien chart si déjà créé
    if (homeChart) {
      homeChart.destroy();
      homeChart = null;
    }

    homeChart = new Chart(canvas, {
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
        scales: {
          x: { display: false },
          y: { display: false },
        },
      },
    });
  }

  // =========================
  // Hydrate HOME (index.html)
  // =========================
  function hydrateHome(payload) {
    if (!payload) return;

    console.log("PAYLOAD RECU =", payload);
    console.log("LAST =", payload.last);

    const last = payload?.last || {};

    // Footer
    const osUpdated = $("#osUpdated");
    if (osUpdated) osUpdated.textContent = fmtISODateTime(payload?.updatedAt);

    const osVersion = $("#osVersion");
    if (osVersion) osVersion.textContent = "live";

    // KPI cards
    const kpiCa = $("#kpiCa");
    if (kpiCa) kpiCa.textContent = fmtEUR(last.ca_day);

    const kpiCaMeta = $("#kpiCaMeta");
    if (kpiCaMeta) kpiCaMeta.textContent = `vs N-1 : ${fmtPCT(last.ca_day_vs_n1_pct)}`;

    const kpiCovers = $("#kpiCovers");
    if (kpiCovers) kpiCovers.textContent = fmtINT(last.covers_day);

    const kpiCoversMeta = $("#kpiCoversMeta");
    // pas de covers_day_n1 dans ton payload -> —
    if (kpiCoversMeta) kpiCoversMeta.textContent = `vs N-1 : —`;

    const kpiTm = $("#kpiTm");
    if (kpiTm) kpiTm.textContent = fmtEUR(last.avg_ticket_day);

    const kpiTmMeta = $("#kpiTmMeta");
    if (kpiTmMeta) kpiTmMeta.textContent = `objectif : —`;

    // Objectif (pas dans payload pour l’instant)
    const kpiGoal = $("#kpiGoal");
    if (kpiGoal) kpiGoal.textContent = "—";

    const goalBar = $("#goalBar");
    if (goalBar) goalBar.style.width = "0%";

    const kpiGoalMeta = $("#kpiGoalMeta");
    if (kpiGoalMeta) kpiGoalMeta.textContent = "—";

    // Badge date + service
    const badgeToday = $("#badgeToday");
    if (badgeToday) badgeToday.textContent = `📅 ${fmtYMD(last.date)}`;

    const badgeStatus = $("#badgeStatus");
    if (badgeStatus) badgeStatus.textContent = `⚓ Service : —`;

    // Chart depuis history
    renderHomeChart(payload?.history);
  }

  // =========================
  // Nav active (optionnel)
  // =========================
  function setActiveNav() {
    const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    document.querySelectorAll(".nav-link").forEach((a) => {
      const href = (a.getAttribute("href") || "").toLowerCase();
      if (href === path) a.classList.add("is-active");
      else a.classList.remove("is-active");
    });
  }

  // =========================
  // Main init
  // =========================
  async function refresh() {
    const data = await fetchDashboard();
    if (!data) return;

    // On hydrate selon la page
    const page = document.body?.dataset?.page || "";
    if (page === "home") hydrateHome(data);
    // (plus tard : page === "ca" -> hydrateCA(data), etc.)
  }

  function init() {
    setActiveNav();

    // 1 refresh immédiat
    refresh();

    // refresh auto toutes les 2 minutes (1 seul timer)
    if (timer) clearInterval(timer);
    timer = setInterval(refresh, 2 * 60 * 1000);
  }

  init();
})();
