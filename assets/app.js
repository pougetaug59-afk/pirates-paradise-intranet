(() => {
  const $ = (sel) => document.querySelector(sel);

  // ===============================
  // ✅ API LIVE (n8n → JSON Dashboard)
  // ===============================
  const PP_API_URL = "https://pp.autopdm.fr/webhook/pp/dashboard?token=pp_lille_59";

  // ===============================
  // Helpers format
  // ===============================
  const eur = (n) =>
    n == null || n === ""
      ? "—"
      : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n));

  const fmt = (n) =>
    n == null || n === ""
      ? "—"
      : new Intl.NumberFormat("fr-FR").format(Number(n));

  // ===============================
  // UI helpers
  // ===============================
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  // Force les champs date (Du/Au) à la date LAST pour éviter la confusion
  function syncDateInputsToLast(lastDate) {
    if (!lastDate) return;

    // Tous les <input type="date"> présents
    const dateInputs = Array.from(document.querySelectorAll('input[type="date"]'));
    dateInputs.forEach((inp) => {
      // Certains filtres ont 2 inputs (Du/Au). En mode B, on force les deux.
      inp.value = lastDate;
      inp.setAttribute("value", lastDate);
    });

    // Si tu as des champs avec IDs spécifiques, on sécurise au cas où
    const commonIds = ["fromDate", "toDate", "dateFrom", "dateTo", "du", "au"];
    commonIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.tagName === "INPUT") {
        el.value = lastDate;
        el.setAttribute("value", lastDate);
      }
    });
  }

  // Optionnel : sous-titre "aujourd'hui"
  const subtitle = $("#subtitle");
  if (subtitle) {
    const fr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date());
    subtitle.textContent = fr;
  }

  // Optionnel : lien actif nav
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll(".nav-link").forEach((a) => {
    const href = (a.getAttribute("href") || "").toLowerCase();
    if (href === path) {
      a.style.color = "var(--pp-navy)";
      a.style.fontWeight = "800";
    }
  });

  // ===============================
  // ✅ Charger la data depuis n8n
  // ===============================
  async function loadDashboard() {
    const url = `${PP_API_URL}&v=${Date.now()}`;

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();

      // ✅ MODE B : on prend TOUJOURS la dernière journée dispo
      const data = raw && raw.last ? raw.last : null;
      if (!data) throw new Error("JSON invalide : raw.last introuvable");

      // 1) Dernière mise à jour = date de la dernière journée
      setText("lastUpdate", data.date || "—");

      // 2) KPIs (accueil + ca)
      setText("kpi_ca_day", eur(data.ca_day));
      setText("kpi_covers_day", fmt(data.covers_day));
      setText("kpi_tm_day", eur(data.avg_ticket_day));

      // 3) KPIs avancés (si présents sur ca.html)
      setText("kpi_ca_wtd", eur(data.ca_week_to_date));
      setText("kpi_ca_mtd", eur(data.ca_month_to_date));

      // 4) Pour éviter l’incohérence visuelle : on synchronise les inputs Du/Au sur LAST
      syncDateInputsToLast(data.date);

      // 5) Message d’état si présent
      const focus = $("#kpi_focus");
      if (focus) focus.textContent = "✅ Mode LIVE : dernière journée disponible (LAST)";

      console.log("[PP Intranet] LIVE OK ✅", { url, last: data.date, data });
    } catch (e) {
      console.error("[PP Intranet] LIVE KO ❌", e);

      setText("lastUpdate", "indisponible");

      const focus = $("#kpi_focus");
      if (focus) focus.textContent = "⚠️ Données indisponibles (API)";
    }
  }

  // Démarrage + refresh
  loadDashboard();
  setInterval(loadDashboard, 5 * 60 * 1000);
})();
