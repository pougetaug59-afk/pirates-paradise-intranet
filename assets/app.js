(() => {
  // =========================
  // Pirates Paradise OS — app.js (WEBHOOK ONLY)
  // Objectif :
  // - Une seule source de vérité : webhook n8n
  // - Compatible anciennes pages + nouvelles pages (IDs différents)
  // - Pas de chiffres "demo" injectés ici
  // =========================

  const WEBHOOK_URL = "https://pp.autopdm.fr/webhook/pp/dashboard?token=pp_lille_59";

  const $ = (sel) => document.querySelector(sel);

  const setText = (idOrEl, value) => {
    const el = typeof idOrEl === "string" ? document.getElementById(idOrEl) : idOrEl;
    if (!el) return false;
    el.textContent = value;
    return true;
  };

  const setStyleWidth = (id, pct) => {
    const el = document.getElementById(id);
    if (!el) return false;
    el.style.width = `${pct}%`;
    return true;
  };

  const eur = (n) => {
    if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n));
  };

  const num = (n) => {
    if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
    return new Intl.NumberFormat("fr-FR").format(Number(n));
  };

  const pct = (n) => {
    if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
    const v = Number(n);
    const sign = v > 0 ? "+" : "";
    return `${sign}${v.toFixed(1)}%`;
  };

  // 1) Sous-titre date (si présent)
  const subtitle = $("#subtitle");
  if (subtitle) {
    const fr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date());
    subtitle.textContent = fr;
  }

  // 2) Nav active (si présent)
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll(".nav-link").forEach((a) => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    if (href === path) {
      a.classList.add("is-active");
    } else {
      a.classList.remove("is-active");
    }
  });

  // 3) Récupération webhook
  async function fetchDashboard() {
    const res = await fetch(WEBHOOK_URL + `&v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Webhook HTTP " + res.status);
    return res.json();
  }

  // 4) Apply data sur toutes les pages (compat IDs)
  function applyData(payload) {
    // Structure attendue (d’après tes captures) :
    // payload.last = { date, ca_day, covers_day, avg_ticket_day, ca_day_vs_n1_pct, covers_day_vs_n1_pct, ... }
    // payload.history = [...]
    const last = payload?.last || {};
    const updatedAt = last.date || payload?.updated_at || payload?.meta?.updated_at || "—";

    // --- "Dernière mise à jour" (anciennes pages)
    setText("lastUpdate", updatedAt);
    // --- Footer (nouvelle home)
    setText("osUpdated", updatedAt);

    // =========================
    // HOME (nouvelle) — IDs : kpiCa / kpiCovers / kpiTm / kpiGoal + metas
    // =========================
    setText("kpiCa", eur(last.ca_day));
    setText("kpiCovers", num(last.covers_day));
    setText("kpiTm", eur(last.avg_ticket_day));

    // Meta vs N-1 (si dispo)
    // On prend les champs présents dans ton JSON (ex: ca_day_vs_n1_pct / covers_day_vs_n1_pct)
    if (document.getElementById("kpiCaMeta")) {
      setText("kpiCaMeta", `vs N-1 : ${pct(last.ca_day_vs_n1_pct)}`);
    }
    if (document.getElementById("kpiCoversMeta")) {
      setText("kpiCoversMeta", `vs N-1 : ${pct(last.covers_day_vs_n1_pct)}`);
    }
    if (document.getElementById("kpiTmMeta")) {
      // objectif ticket moyen (si tu l’ajoutes plus tard côté n8n : last.ticket_goal)
      setText("kpiTmMeta", last.ticket_goal != null ? `objectif : ${eur(last.ticket_goal)}` : "objectif : —");
    }

    // Objectif CA (si tu l’ajoutes plus tard côté n8n : last.goal_ca_day)
    const goal = last.goal_ca_day != null ? Number(last.goal_ca_day) : null;
    const ca = last.ca_day != null ? Number(last.ca_day) : null;

    if (document.getElementById("kpiGoal")) {
      setText("kpiGoal", goal != null ? eur(goal) : "—");
    }

    // Progress bar + texte
    if (document.getElementById("goalBar") && document.getElementById("kpiGoalMeta")) {
      if (goal != null && ca != null && goal > 0) {
        const p = Math.max(0, Math.min(100, (ca / goal) * 100));
        setStyleWidth("goalBar", p.toFixed(0));
        const remaining = Math.max(0, goal - ca);
        setText("kpiGoalMeta", `${p.toFixed(0)}% atteint • reste ${eur(remaining)}`);
      } else {
        setStyleWidth("goalBar", 0);
        setText("kpiGoalMeta", "—");
      }
    }

    // =========================
    // PAGES “anciens KPIs” — IDs : kpi_ca_day / kpi_covers_day / kpi_tm_day etc.
    // =========================
    setText("kpi_ca_day", eur(last.ca_day));
    setText("kpi_covers_day", num(last.covers_day));
    setText("kpi_tm_day", eur(last.avg_ticket_day));

    // KPIs période (si présents dans ton webhook — ex: ca_week_to_date, ca_month_to_date)
    setText("kpi_ca_wtd", last.ca_week_to_date != null ? eur(last.ca_week_to_date) : "—");
    setText("kpi_ca_mtd", last.ca_month_to_date != null ? eur(last.ca_month_to_date) : "—");

    // Focus/alertes (si tu ajoutes plus tard un champ)
    if (document.getElementById("kpi_focus")) {
      const alerts = payload?.alerts_count ?? last.alerts_count ?? null;
      setText("kpi_focus", alerts == null ? "—" : (Number(alerts) > 0 ? `⚠️ ${alerts} alerte(s) à traiter` : "✅ RAS"));
    }

    // Badge “Service” (si présent sur la nouvelle home)
    if (document.getElementById("badgeStatus")) {
      const service = payload?.meta?.service_status || last.service_status || "—";
      setText("badgeStatus", `⚓ Service : ${service}`);
    }
  }

  // 5) Init
  async function init() {
    try {
      const data = await fetchDashboard();
      applyData(data);
      console.log("[PP OS] Webhook chargé ✅", data);
    } catch (e) {
      console.warn("[PP OS] Webhook indisponible", e);
      // On met juste des placeholders si besoin
      setText("lastUpdate", "indisponible");
      setText("osUpdated", "indisponible");
    }
  }

  init();
  setInterval(init, 2 * 60 * 1000);
})();
