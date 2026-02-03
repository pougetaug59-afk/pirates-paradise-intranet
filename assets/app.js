(() => {
  // =========
  // CONFIG
  // =========
  const DASHBOARD_API =
    "https://pp.autopdm.fr/webhook/pp/dashboard?token=pp_lille_59";

  const REFRESH_MS = 2 * 60 * 1000;

  // Petit helper
  const $ = (sel) => document.querySelector(sel);

  // =========
  // UI: date sous-titre (si présent)
  // =========
  const subtitle = $("#subtitle");
  if (subtitle) {
    const fr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(
      new Date()
    );
    subtitle.textContent = fr;
  }

  // =========
  // UI: nav active (si tes liens ont .nav-link)
  // =========
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll(".nav-link").forEach((a) => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    if (href === path) {
      a.classList.add("is-active");
      a.setAttribute("aria-current", "page");
    }
  });

  // =========
  // Format helpers
  // =========
  const eur = (n) =>
    n == null || Number.isNaN(Number(n))
      ? "—"
      : new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: "EUR",
        }).format(Number(n));

  const num = (n) =>
    n == null || Number.isNaN(Number(n))
      ? "—"
      : new Intl.NumberFormat("fr-FR").format(Number(n));

  const pct = (n) => {
    if (n == null || Number.isNaN(Number(n))) return "—";
    const x = Number(n);
    const sign = x > 0 ? "+" : "";
    return `${sign}${x.toFixed(1)}%`;
  };

  // =========
  // Normalisation : accepte plusieurs formats (webhook n8n / ancien json / mock)
  // =========
  function normalize(raw) {
    // Format webhook n8n attendu :
    // { last: {...}, history: [...], updatedAt: "..." }
    if (raw && raw.last) {
      const last = raw.last || {};
      const history = Array.isArray(raw.history) ? raw.history : [];

      return {
        updated_at: raw.updatedAt || raw.updated_at || last.date || null,

        // KPIs jour
        ca_day: last.ca_day ?? null,
        covers_day: last.covers_day ?? null,
        avg_ticket_day: last.avg_ticket_day ?? null,

        // Comparaisons
        ca_day_vs_n1_pct: last.ca_day_vs_n1_pct ?? null,
        covers_day_vs_n1_pct: last.covers_day_vs_n1_pct ?? null,

        // Objectifs (souvent pas dans ton webhook actuellement)
        goal_ca_day: last.goal_ca_day ?? raw.goal_ca_day ?? null,
        ticket_goal_day: last.ticket_goal_day ?? raw.ticket_goal_day ?? null,

        // Historique pour graphe
        history,
      };
    }

    // Ancien format possible (ex: data/dashboard.json)
    return {
      updated_at: raw?.updated_at ?? null,
      ca_day: raw?.ca_day ?? null,
      covers_day: raw?.covers_day ?? null,
      avg_ticket_day: raw?.avg_ticket ?? raw?.avg_ticket_day ?? null,
      ca_day_vs_n1_pct: raw?.ca_day_vs_n1_pct ?? null,
      covers_day_vs_n1_pct: raw?.covers_day_vs_n1_pct ?? null,
      goal_ca_day: raw?.goal_ca_day ?? null,
      ticket_goal_day: raw?.ticket_goal_day ?? null,
      history: Array.isArray(raw?.history) ? raw.history : [],
    };
  }

  // =========
  // Render : supporte les IDs "anciens" + "nouveaux" (tes 2 visuels)
  // =========
  function render(data) {
    // Dernière MAJ (si un élément existe)
    const lastUpdate = $("#lastUpdate") || $("#osUpdated");
    if (lastUpdate) lastUpdate.textContent = data.updated_at || "—";

    // ------- INDEX (nouveau visuel)
    const kpiCa = $("#kpiCa");
    if (kpiCa) kpiCa.textContent = eur(data.ca_day);

    const kpiCaMeta = $("#kpiCaMeta");
    if (kpiCaMeta)
      kpiCaMeta.textContent = `vs N-1 : ${pct(data.ca_day_vs_n1_pct)}`;

    const kpiCovers = $("#kpiCovers");
    if (kpiCovers) kpiCovers.textContent = num(data.covers_day);

    const kpiCoversMeta = $("#kpiCoversMeta");
    if (kpiCoversMeta)
      kpiCoversMeta.textContent = `vs N-1 : ${pct(data.covers_day_vs_n1_pct)}`;

    const kpiTm = $("#kpiTm");
    if (kpiTm) kpiTm.textContent = eur(data.avg_ticket_day);

    const kpiTmMeta = $("#kpiTmMeta");
    if (kpiTmMeta) {
      kpiTmMeta.textContent =
        data.ticket_goal_day != null ? `objectif : ${eur(data.ticket_goal_day)}` : "objectif : —";
    }

    const kpiGoal = $("#kpiGoal");
    if (kpiGoal) kpiGoal.textContent = data.goal_ca_day != null ? eur(data.goal_ca_day) : "—";

    const goalBar = $("#goalBar");
    const kpiGoalMeta = $("#kpiGoalMeta");
    if (goalBar && kpiGoalMeta) {
      if (data.goal_ca_day != null && data.ca_day != null && Number(data.goal_ca_day) > 0) {
        const p = Math.min(100, (Number(data.ca_day) / Number(data.goal_ca_day)) * 100);
        goalBar.style.width = `${p.toFixed(0)}%`;
        kpiGoalMeta.textContent = `${p.toFixed(0)}% atteint • reste ${eur(Number(data.goal_ca_day) - Number(data.ca_day))}`;
      } else {
        goalBar.style.width = "0%";
        kpiGoalMeta.textContent = "—";
      }
    }

    // ------- CA PAGE (ton visuel KPI : ids possibles)
    const caDayOld = $("#kpi_ca_day");
    if (caDayOld) caDayOld.textContent = eur(data.ca_day);

    const coversOld = $("#kpi_covers_day");
    if (coversOld) coversOld.textContent = num(data.covers_day);

    const tmOld = $("#kpi_tm_day");
    if (tmOld) tmOld.textContent = eur(data.avg_ticket_day);

    // =========
    // Chart (si canvas existe + Chart.js chargé)
    // =========
    const canvas = $("#ca7Chart");
    if (canvas && window.Chart) {
      // Prend les 7 derniers points de history si dispo, sinon rien
      const last7 = (data.history || []).slice(-7);
      const values = last7.map((x) => Number(x.ca_day ?? 0));
      const labels = last7.map((x) => (x.date ? String(x.date).slice(5) : ""));

      // détruire l’ancien chart si présent
      if (window.__ppChart) {
        try { window.__ppChart.destroy(); } catch (e) {}
        window.__ppChart = null;
      }

      // Si pas de data -> ne pas casser
      if (values.length) {
        window.__ppChart = new Chart(canvas, {
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
    }
  }

  // =========
  // Fetch webhook
  // =========
  async function loadLive() {
    try {
      const url = `${DASHBOARD_API}&_=${Date.now()}`; // cache-bust
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);

      const raw = await res.json();
      const data = normalize(raw);

      // Debug utile
      console.log("[PP OS] webhook OK ✅", { raw, data });

      render(data);
    } catch (e) {
      console.warn("[PP OS] webhook FAIL ❌", e);

      // Affiche au moins “indisponible” si on a un endroit où le mettre
      const lastUpdate = $("#lastUpdate") || $("#osUpdated");
      if (lastUpdate) lastUpdate.textContent = "indisponible";
    }
  }

  // Start + refresh
  loadLive();
  setInterval(loadLive, REFRESH_MS);
})();
