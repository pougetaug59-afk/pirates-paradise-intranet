(() => {
  // =========================
  // Helpers DOM
  // =========================
  const $ = (sel) => document.querySelector(sel);

  // =========================
  // CONFIG
  // =========================
  const WEBHOOK_URL = "https://pp.autopdm.fr/webhook/pp/dashboard?token=pp_lille_59";

  // =========================
  // Formatters
  // =========================
  function fmtEUR(n) {
    if (n === null || n === undefined || n === "") return "—";
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(x);
  }

  function fmtINT(n) {
    if (n === null || n === undefined || n === "") return "—";
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    return new Intl.NumberFormat("fr-FR").format(Math.round(x));
  }

  function fmtPCT(n) {
    if (n === null || n === undefined || n === "") return "—";
    const x = Number(n);
    if (!Number.isFinite(x)) return "—";
    const sign = x > 0 ? "+" : "";
    return `${sign}${x.toFixed(1)}%`;
  }

  function fmtISODateTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("fr-FR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  // =========================
  // UI : subtitle date
  // =========================
  const subtitle = $("#subtitle");
  if (subtitle) {
    const fr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date());
    subtitle.textContent = fr;
  }

  // =========================
  // UI : active nav link
  // =========================
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll(".nav-link").forEach(a => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    if (href === path) {
      a.style.color = "var(--pp-navy)";
      a.style.fontWeight = "800";
    }
  });

  // =========================
  // Fetch dashboard payload
  // =========================
  async function fetchPayload() {
    const url = `${WEBHOOK_URL}&t=${Date.now()}`; // cache-busting
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Webhook HTTP " + res.status);
    return await res.json();
  }

  // =========================
  // HOME : Chart
  // =========================
  let homeChart = null;

  function renderHomeChart(history) {
    const canvas = $("#ca7Chart");
    if (!canvas) return;

    // si Chart.js n'est pas présent, on ne casse rien
    if (typeof Chart === "undefined") return;

    const arr = Array.isArray(history) ? history : [];
    const last7 = arr.slice(-7);

    const labels = last7.map(x => (x.date || "").slice(5)); // MM-DD
    const values = last7.map(x => Number(x.ca_day) || 0);

    // reset chart si déjà créé
    if (homeChart) {
      try { homeChart.destroy(); } catch (e) {}
      homeChart = null;
    }

    homeChart = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          data: values,
          borderWidth: 2,
          tension: 0.35,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
          y: { display: false }
        }
      }
    });
  }

  // =========================
  // HOME : Hydrate
  // =========================
  function hydrateHome(payload) {
    console.log("PAYLOAD RECU =", payload);
    console.log("LAST =", payload.last);

    const last = payload?.last || {};

    // Footer / meta
    const osUpdated = $("#osUpdated");
    if (osUpdated) osUpdated.textContent = fmtISODateTime(payload?.updatedAt);

    const osVersion = $("#osVersion");
    if (osVersion) osVersion.textContent = "live";

    // KPIs home
    const kpiCa = $("#kpiCa");
    if (kpiCa) kpiCa.textContent = fmtEUR(last.ca_day);

    const kpiCaMeta = $("#kpiCaMeta");
    if (kpiCaMeta) kpiCaMeta.textContent = `vs N-1 : ${fmtPCT(last.ca_day_vs_n1_pct)}`;

    const kpiCovers = $("#kpiCovers");
    if (kpiCovers) kpiCovers.textContent = fmtINT(last.covers_day);

    const kpiCoversMeta = $("#kpiCoversMeta");
    if (kpiCoversMeta) {
      // si covers_day_vs_n1_pct existe on l'affiche, sinon —
      kpiCoversMeta.textContent = (last.covers_day_vs_n1_pct != null)
        ? `vs N-1 : ${fmtPCT(last.covers_day_vs_n1_pct)}`
        : "vs N-1 : —";
    }

    const kpiTm = $("#kpiTm");
    if (kpiTm) kpiTm.textContent = fmtEUR(last.avg_ticket_day);

    const kpiTmMeta = $("#kpiTmMeta");
    if (kpiTmMeta) {
      kpiTmMeta.textContent = (last.ticket_goal != null)
        ? `objectif : ${fmtEUR(last.ticket_goal)}`
        : "objectif : —";
    }

    // Objectif CA + barre
    const kpiGoal = $("#kpiGoal");
    if (kpiGoal) {
      kpiGoal.textContent = (last.goal_ca != null) ? fmtEUR(last.goal_ca) : "—";
    }

    const goalBar = $("#goalBar");
    const kpiGoalMeta = $("#kpiGoalMeta");

    if (last.goal_ca != null && last.ca_day != null && Number(last.goal_ca) > 0) {
      const pct = Math.min(100, (Number(last.ca_day) / Number(last.goal_ca)) * 100);
      if (goalBar) goalBar.style.width = pct.toFixed(0) + "%";
      if (kpiGoalMeta) {
        const reste = Number(last.goal_ca) - Number(last.ca_day);
        kpiGoalMeta.textContent = `${pct.toFixed(0)}% atteint • reste ${fmtEUR(reste)}`;
      }
    } else {
      if (goalBar) goalBar.style.width = "0%";
      if (kpiGoalMeta) kpiGoalMeta.textContent = "—";
    }

    // badgeToday = date du last
    const badgeToday = $("#badgeToday");
    if (badgeToday && last.date) badgeToday.textContent = `📅 ${last.date}`;

    // Chart 7 jours
    renderHomeChart(payload?.history);
  }

  // =========================
  // CA PAGE : Hydrate
  // =========================
  function hydrateCA(payload) {
    const last = payload?.last || {};

    const lastUpdate = $("#lastUpdate");
    if (lastUpdate) lastUpdate.textContent = fmtISODateTime(payload?.updatedAt);

    const kpiCaDay = $("#kpi_ca_day");
    if (kpiCaDay) kpiCaDay.textContent = fmtEUR(last.ca_day);

    const kpiCaWtd = $("#kpi_ca_wtd");
    if (kpiCaWtd) kpiCaWtd.textContent = fmtEUR(last.ca_week_to_date);

    const kpiCaMtd = $("#kpi_ca_mtd");
    if (kpiCaMtd) kpiCaMtd.textContent = fmtEUR(last.ca_month_to_date);

    const kpiCoversDay = $("#kpi_covers_day");
    if (kpiCoversDay) kpiCoversDay.textContent = fmtINT(last.covers_day);

    const kpiTmDay = $("#kpi_tm_day");
    if (kpiTmDay) kpiTmDay.textContent = fmtEUR(last.avg_ticket_day);

    const focus = $("#kpi_focus");
    if (focus) {
      // mini recommandation simple (tu pourras l’améliorer)
      const pct = last.ca_day_vs_n1_pct;
      if (pct == null) focus.textContent = "—";
      else if (pct >= 10) focus.textContent = "✅ Bonne dynamique vs N-1 — pousser upsell desserts/boissons.";
      else if (pct <= -10) focus.textContent = "⚠️ Sous N-1 — vérifier couverts + ticket moyen + promos.";
      else focus.textContent = "↔️ Stable vs N-1 — optimiser le ticket moyen (upsell).";
    }
  }

  // =========================
  // Init : choose page
  // =========================
  async function init() {
    const page = document.body?.dataset?.page || "";

    try {
      const payload = await fetchPayload();

      if (page === "home") hydrateHome(payload);
      if (page === "ca") hydrateCA(payload);

      console.log("[PP Intranet] Webhook chargé ✅", payload);
    } catch (e) {
      console.warn("[PP Intranet] Webhook indisponible", e);

      // petit fallback texte si on a une zone lastUpdate
      const lastUpdate = $("#lastUpdate");
      if (lastUpdate) lastUpdate.textContent = "indisponible";

      const focus = $("#kpi_focus");
      if (focus) focus.textContent = "⚠️ Données indisponibles (webhook)";
    }
  }

  // run
  init();

  // refresh auto (2 min)
  setInterval(init, 2 * 60 * 1000);
})();
