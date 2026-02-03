(() => {
  const $ = (sel) => document.querySelector(sel);

  // ===============================
  // ✅ URL LIVE (n8n → JSON Dashboard)
  // ===============================
  const PP_API_URL =
    "https://pp.autopdm.fr/webhook/pp/dashboard?token=pp_lille_59";

  // ===============================
  // Helpers format
  // ===============================
  const eur = (n) =>
    n == null || n === ""
      ? "—"
      : new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: "EUR",
        }).format(Number(n));

  const fmt = (n) =>
    n == null || n === ""
      ? "—"
      : new Intl.NumberFormat("fr-FR").format(Number(n));

  // ===============================
  // ✅ Charger la data depuis n8n
  // ===============================
  async function loadDashboard() {
    try {
      const res = await fetch(`${PP_API_URL}&v=${Date.now()}`, {
        cache: "no-store",
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const raw = await res.json();

      // ✅ La dernière journée = raw.last
      const data = raw.last;

      console.log("✅ Dashboard chargé :", data);

      // ===============================
      // Mise à jour date
      // ===============================
      const lastUpdate = $("#lastUpdate");
      if (lastUpdate) {
        lastUpdate.textContent = data.date || "—";
      }

      // ===============================
      // KPIs Accueil + CA
      // ===============================
      const caDay = $("#kpi_ca_day");
      if (caDay) caDay.textContent = eur(data.ca_day);

      const coversDay = $("#kpi_covers_day");
      if (coversDay) coversDay.textContent = fmt(data.covers_day);

      const tmDay = $("#kpi_tm_day");
      if (tmDay) tmDay.textContent = eur(data.avg_ticket_day);

      // ===============================
      // KPIs avancés (page ca.html)
      // ===============================
      const caWTD = $("#kpi_ca_wtd");
      if (caWTD) caWTD.textContent = eur(data.ca_week_to_date);

      const caMTD = $("#kpi_ca_mtd");
      if (caMTD) caMTD.textContent = eur(data.ca_month_to_date);

      // Focus texte si présent
      const focus = $("#kpi_focus");
      if (focus) {
        focus.textContent = "✅ Données live connectées (n8n)";
      }
    } catch (e) {
      console.error("❌ Dashboard indisponible :", e);

      const lastUpdate = $("#lastUpdate");
      if (lastUpdate) lastUpdate.textContent = "indisponible";

      const focus = $("#kpi_focus");
      if (focus) focus.textContent = "⚠️ Données non chargées";
    }
  }

  // ✅ Charger immédiatement au démarrage
  loadDashboard();

  // ✅ Auto-refresh toutes les 5 minutes
  setInterval(loadDashboard, 5 * 60 * 1000);
})();
