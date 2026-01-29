(() => {
  // =========================
  // Helpers
  // =========================
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function safeText(el, txt) {
    if (el) el.textContent = txt;
  }

  // =========================
  // 1) Sous-titre : date du jour (si #subtitle existe)
  // =========================
  const subtitle = $("#subtitle");
  if (subtitle) {
    const fr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date());
    subtitle.textContent = fr;
  }

  // =========================
  // 2) Mettre en évidence le lien actif
  // - Compatible avec .nav-link (onglets) et liens simples
  // - Ajoute la classe .is-active si possible (sinon fallback inline)
  // =========================
  try {
    const current = (location.pathname.split("/").pop() || "index.html").toLowerCase();

    $$(".nav-link").forEach((a) => {
      const href = (a.getAttribute("href") || "").split("?")[0].toLowerCase();
      if (href === current) {
        a.classList.add("is-active");
        // Fallback (si ton CSS n’applique rien sur .is-active)
        a.style.fontWeight = "800";
      } else {
        a.classList.remove("is-active");
      }
    });
  } catch (e) {
    // pas bloquant
  }

  // =========================
  // 3) Menu "Plus" (si présent)
  // =========================
  function initMoreMenu() {
    const btn = $("#moreBtn");
    const menu = $("#moreMenu");
    if (!btn || !menu) return;

    const close = () => {
      menu.style.display = "none";
      btn.setAttribute("aria-expanded", "false");
    };

    const open = () => {
      menu.style.display = "block";
      btn.setAttribute("aria-expanded", "true");
    };

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = menu.style.display === "block";
      if (isOpen) close();
      else open();
    });

    // Fermer au clic ailleurs
    document.addEventListener("click", (e) => {
      if (e.target === btn || menu.contains(e.target)) return;
      close();
    });

    // Fermer avec ESC (accessibilité)
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }
  initMoreMenu();

  // =========================
  // 4) Recherche (mock) : Entrée => redirection simple
  // =========================
  function initSearchShortcuts() {
    const input = $("#searchInput");
    if (!input) return;

    const routes = [
      { test: ["ca", "chiffre", "revenu"], href: "./ca.html" },
      { test: ["fréquentation", "couverts", "covers"], href: "./frequentation.html" },
      { test: ["incident", "maintenance", "ops", "checklist"], href: "./operations.html" },
      { test: ["doc", "procédure", "procedure", "ressource"], href: "./docs.html" },
      { test: ["rh", "onboarding", "contrat"], href: "./rh.html" },
      { test: ["b2b", "entreprise", "cse"], href: "./b2b.html" },
      { test: ["réglage", "settings", "param"], href: "./settings.html" },
      { test: ["outil", "tools"], href: "./tools.html" },
      { test: ["alerte", "alerts"], href: "./alerts.html" },
    ];

    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const q = (input.value || "").trim().toLowerCase();
      if (!q) return;

      const found = routes.find((r) => r.test.some((k) => q.includes(k)));
      if (found) {
        location.href = found.href;
      } else {
        // fallback : si rien trouvé, on va vers docs (logique “base de connaissance”)
        location.href = "./docs.html";
      }
    });
  }
  initSearchShortcuts();

  // =========================
  // 5) Charger data/dashboard.json (si dispo)
  // =========================
  async function loadDashboardData() {
    try {
      // Cache-busting : force le navigateur à recharger le JSON
      const url = `data/dashboard.json?v=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("dashboard.json HTTP " + res.status);

      const data = await res.json();

      // Formatters
      const eur = (n) =>
        (n == null
          ? "—"
          : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n)));

      const fmt = (n) =>
        (n == null ? "—" : new Intl.NumberFormat("fr-FR").format(Number(n)));

      // Dernière mise à jour (si présent)
      safeText($("#lastUpdate"), data.updated_at ? data.updated_at : "—");

      // KPIs génériques (si IDs existent sur la page)
      // NOTE: Ces IDs existent sur certaines pages (ancien dashboard / nouvelles pages)
      const caDay = $("#kpi_ca_day");
      if (caDay) caDay.textContent = eur(data.ca_day);

      const coversDay = $("#kpi_covers_day");
      if (coversDay) coversDay.textContent = fmt(data.covers_day);

      const avgTicket = $("#kpi_tm_day");
      if (avgTicket) avgTicket.textContent = eur(data.avg_ticket);

      // Optionnel : focus/alertes (si présent)
      const focus = $("#kpi_focus");
      if (focus) {
        const alerts = Number(data.alerts_count || 0);
        focus.textContent = alerts > 0 ? `⚠️ ${alerts} alerte(s) à traiter` : "✅ RAS (aucune alerte)";
      }

      console.log("[PP OS] data/dashboard.json chargé ✅", data);
    } catch (e) {
      console.warn("[PP OS] Impossible de charger data/dashboard.json", e);

      safeText($("#lastUpdate"), "indisponible");

      const focus = $("#kpi_focus");
      if (focus) focus.textContent = "⚠️ Données indisponibles (dashboard.json)";
    }
  }

  // Load au démarrage
  loadDashboardData();

  // Refresh auto toutes les 2 minutes (MVP)
  setInterval(loadDashboardData, 2 * 60 * 1000);
})();
