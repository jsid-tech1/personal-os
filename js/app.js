/* Personal OS — the shell: routing, chrome, and a single place data becomes visible. */
(function () {
  "use strict";
  const POS = window.POS;
  const U = POS.util;
  const { icon, esc } = { icon: U.icon, esc: U.escapeHTML };
  const store = POS.store;
  const ui = POS.ui;

  const NAV = [
    {
      group: "Workspace",
      items: [
        { id: "today", label: "Today", icon: "today", href: "#/today" },
        { id: "dump", label: "Brain Dump", icon: "brain", href: "#/dump" },
        { id: "tasks", label: "Tasks", icon: "tasks", href: "#/tasks", count: () => store.openTasks().length },
        { id: "projects", label: "Projects", icon: "folder", href: "#/projects" },
        { id: "calendar", label: "Calendar", icon: "calendar", href: "#/calendar" },
        { id: "planner", label: "Planner", icon: "columns", href: "#/planner" },
      ],
    },
    {
      group: "Practice",
      items: [
        { id: "notes", label: "Notes", icon: "notes", href: "#/notes" },
        { id: "habits", label: "Habits", icon: "habits", href: "#/habits" },
        { id: "focus", label: "Focus", icon: "focus", href: "#/focus" },
        { id: "reflection", label: "Reflection", icon: "reflection", href: "#/reflection" },
      ],
    },
    {
      group: "System",
      items: [
        { id: "notifications", label: "Notifications", icon: "bell", href: "#/notifications", count: () => store.unreadCount() },
        { id: "reschedule", label: "Rescheduling", icon: "rotate", href: "#/reschedule" },
        { id: "settings", label: "Settings", icon: "settings", href: "#/settings" },
      ],
    },
  ];

  const TITLES = {
    today: "Today",
    dump: "Brain Dump",
    tasks: "Tasks",
    projects: "Projects",
    project: "Project",
    goal: "Goal Breakdown",
    calendar: "Calendar",
    planner: "Daily Planner",
    notifications: "Notifications",
    focus: "Focus",
    reschedule: "Rescheduling",
    notes: "Notes",
    habits: "Habits",
    reflection: "Reflection",
    settings: "Control Centre",
  };

  const GROUP_OF = {};
  NAV.forEach((g) => g.items.forEach((it) => { GROUP_OF[it.id] = g.group; }));
  GROUP_OF.project = "Workspace";
  GROUP_OF.goal = "Workspace";

  const ACTIVE_OF = { project: "projects", goal: "projects" };

  let activeView = null;
  let lastPath = null;
  let pendingRerender = false;

  /* =========================================================
     Routing
     ========================================================= */

  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [pathPart, queryPart] = raw.split("?");
    const segs = pathPart.split("/").filter(Boolean);
    const params = {};
    new URLSearchParams(queryPart || "").forEach((v, k) => { params[k] = v; });
    let key = segs[0] || "today";
    if (key === "project") {
      if (segs[1]) params.id = segs[1];
      else key = "projects";
    }
    return { key, params };
  }

  function resolve(route) {
    const st = store.get();
    let key = route.key;
    let viewKey = key;
    let title = TITLES[key] || "Not found";

    if (key === "project") {
      const p = st.projects.find((x) => x.id === route.params.id);
      title = p ? p.name : "Project not found";
    }
    if (key === "goal") {
      const p = route.params.project ? st.projects.find((x) => x.id === route.params.project) : null;
      title = p ? `Plan ${p.name}` : "Goal Breakdown";
    }
    if (key === "focus" && route.params.task) {
      const t = store.task(route.params.task);
      if (t) title = t.title.length > 34 ? t.title.slice(0, 34) + "…" : t.title;
    }
    if (!["today", "dump", "tasks", "projects", "project", "goal", "calendar", "planner",
      "notifications", "focus", "reschedule", "notes", "habits", "reflection", "settings"].includes(key)) {
      viewKey = null;
    }
    return {
      key,
      viewKey,
      title,
      group: GROUP_OF[key] || "Workspace",
      active: ACTIVE_OF[key] || key,
      path: location.hash.split("?")[0] || "#/today",
      params: route.params,
    };
  }

  const viewFor = (viewKey) => {
    if (viewKey === "dump") return POS.views.brainDump || POS.views.dump;
    if (viewKey === "projects" || viewKey === "project") return POS.views.projects;
    return POS.views[viewKey] || null;
  };

  function render(reason = "route") {
    const route = parseHash();
    const meta = resolve(route);
    const main = document.getElementById("main");
    if (!main) return;
    const changedPath = lastPath !== meta.path;
    const y = window.scrollY;

    if (changedPath) {
      closeOverlays();
      ui.closeMenus();
      app().classList.remove("is-focus", "nav-open");
      menuBtn().setAttribute("aria-expanded", "false");
    }

    const nextView = meta.viewKey ? viewFor(meta.viewKey) : null;
    if (activeView && activeView.destroy && nextView !== activeView) {
      try { activeView.destroy(); } catch (err) { console.warn(err); }
    }
    activeView = nextView;

    updateChrome(meta);

    try {
      if (!nextView) {
        main.innerHTML = notFound(meta);
      } else {
        nextView.render(main, meta.params);
      }
    } catch (err) {
      console.error("Personal OS: view failed to render", err);
      main.innerHTML = errorPanel(err);
    }

    if (meta.key === "focus") app().classList.add("is-focus");

    if (changedPath) window.scrollTo(0, 0);
    else window.scrollTo(0, y);

    lastPath = meta.path;
    pendingRerender = false;
    document.title = `${meta.title} · Personal OS`;
  }

  function notFound(meta) {
    return `<div class="page">
      <header class="page-head"><div>
        <h1 class="page-title">Not <em>found</em></h1>
        <div class="page-sub"><span>There is no screen at this address.</span></div>
      </div></header>
      <div class="panel">${ui.emptyState(
        "This route does not exist",
        "The link may be old, or the screen may have moved. Everything else is still where you left it.",
        `<a class="btn btn-primary btn-sm" href="#/today">${icon("today")} Back to today</a>`
      )}</div>
    </div>`;
  }

  function errorPanel(err) {
    return `<div class="page">
      <header class="page-head"><div>
        <h1 class="page-title">Something <em>broke</em></h1>
        <div class="page-sub"><span>This screen could not be drawn. Your saved data is untouched.</span></div>
      </div></header>
      <div class="panel"><div class="panel-body">
        <div class="note note-warning">${icon("warning")}
          <div><strong>The view failed.</strong> Reload this screen, or open Today. If it keeps happening, export a backup from Settings first.</div>
        </div>
        <pre style="margin-top:12px;font-family:var(--font-mono);font-size:11px;color:var(--ink-3);white-space:pre-wrap">${esc(err && err.message ? err.message : String(err))}</pre>
        <div class="row gap-2" style="margin-top:14px">
          <button class="btn btn-sm" id="err-reload">${icon("rotate")} Reload screen</button>
          <a class="btn btn-sm btn-ghost" href="#/today">${icon("today")} Today</a>
        </div>
      </div></div>
    </div>`;
  }

  /* =========================================================
     Chrome
     ========================================================= */

  const app = () => document.getElementById("app");
  const menuBtn = () => document.getElementById("menu-btn");

  function navHTML(meta) {
    return NAV.map((group) => `
      <div class="nav-group">
        <div class="nav-label">${group.group}</div>
        ${group.items.map((item) => {
          const active = meta.active === item.id;
          const count = item.count ? item.count() : 0;
          return `<a class="nav-item" href="${item.href}" ${active ? 'aria-current="page"' : ""} data-nav="${item.id}">
            ${icon(item.icon)}
            <span class="grow truncate">${item.label}</span>
            ${count ? `<span class="nav-count">${count}</span>` : ""}
          </a>`;
        }).join("")}
      </div>`).join("");
  }

  function mobileHTML(meta) {
    const item = (id, label, ico, href) => `
      <a href="${href}" ${meta.active === id ? 'aria-current="page"' : ""}>
        ${icon(ico)}<span>${label}</span>
      </a>`;
    return `
      <div class="mobilebar-inner">
        ${item("today", "Today", "today", "#/today")}
        ${item("tasks", "Tasks", "tasks", "#/tasks")}
        <button class="capture-fab" id="mobile-capture" aria-label="Capture something">
          <i>${icon("plus")}</i><span>Capture</span>
        </button>
        ${item("calendar", "Calendar", "calendar", "#/calendar")}
        <button class="mobile-more" id="mobile-more" aria-label="Open navigation">
          ${icon("list")}<span>More</span>
        </button>
      </div>`;
  }

  function updateChrome(meta) {
    const st = store.get();
    const nav = document.getElementById("nav");
    if (nav) {
      nav.innerHTML = navHTML(meta);
      nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeNav));
    }

    const foot = document.getElementById("sidebar-foot");
    if (foot) {
      foot.innerHTML = `
        <button class="sidebar-assistant" id="sidebar-assistant">
          ${icon("sparkles")}<span class="grow">Ask the assistant</span><span class="mono">AI</span>
        </button>
        <div class="status-line ${navigator.onLine ? "" : "is-offline"}">
          <span class="dot"></span>
          <span>${navigator.onLine ? "Saved on this device" : "Offline · still saved"}</span>
          <span class="mono">LOCAL</span>
        </div>`;
      foot.querySelector("#sidebar-assistant").addEventListener("click", () => ui.openAssistant());
    }

    const crumb = document.getElementById("crumb");
    if (crumb) {
      crumb.innerHTML = `
        <span class="crumb-parent">${esc(meta.group || "Workspace")}</span>
        <span class="sep">/</span>
        <strong>${esc(meta.title)}</strong>`;
    }

    const notify = document.getElementById("notify-btn");
    if (notify) {
      const unread = store.unreadCount();
      notify.innerHTML = icon("bell") + (unread ? '<span class="badge-dot" aria-hidden="true"></span>' : "");
      notify.setAttribute("aria-label", unread ? `Notifications, ${unread} unread` : "Notifications");
    }

    const avatar = document.getElementById("avatar-btn");
    if (avatar) {
      avatar.textContent = st.settings.initials || "OS";
      avatar.setAttribute("aria-label", `Open control centre for ${st.settings.name}`);
    }

    const bar = document.getElementById("mobilebar");
    if (bar) {
      bar.innerHTML = mobileHTML(meta);
      bar.querySelector("#mobile-capture").addEventListener("click", () => ui.openCapture());
      bar.querySelector("#mobile-more").addEventListener("click", toggleNav);
    }

    updateConnectivity();
  }

  function updateConnectivity() {
    const banner = document.getElementById("offline-banner");
    if (banner) banner.hidden = navigator.onLine;
    document.querySelectorAll(".status-line").forEach((line) => line.classList.toggle("is-offline", !navigator.onLine));
    const conn = document.getElementById("s-conn-status");
    if (conn) conn.textContent = navigator.onLine ? "Online" : "Offline";
  }

  function closeNav() {
    app().classList.remove("nav-open");
    menuBtn().setAttribute("aria-expanded", "false");
  }

  function toggleNav() {
    const open = app().classList.toggle("nav-open");
    menuBtn().setAttribute("aria-expanded", String(open));
  }

  function closeOverlays() {
    document.querySelectorAll(".modal-wrap, .sheet-wrap, .palette-wrap").forEach((el) => {
      if (el.__posClose) el.__posClose();
      else el.remove();
    });
    document.querySelectorAll(".menu, .popover").forEach((el) => el.remove());
    ui.lockScroll(false);
  }

  function hydrateStaticIcons() {
    document.querySelectorAll("[data-icon]").forEach((el) => {
      el.innerHTML = icon(el.dataset.icon);
    });
    menuBtn().innerHTML = icon("list");
    document.getElementById("notify-btn").innerHTML = icon("bell");
  }

  /* =========================================================
     Typing guard — updates while an input has focus are deferred
     ========================================================= */

  const TEXTUAL_INPUT = new Set([
    "text", "search", "email", "url", "tel", "password", "number",
    "date", "time", "datetime-local", "month", "week",
  ]);

  function isTyping() {
    const el = document.activeElement;
    if (!el || el === document.body) return false;
    if (el.isContentEditable) return true;
    if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
    if (el.tagName === "INPUT") {
      return TEXTUAL_INPUT.has((el.type || "text").toLowerCase());
    }
    return false;
  }

  /* =========================================================
     Boot
     ========================================================= */

  function boot() {
    store.load();
    hydrateStaticIcons();

    document.getElementById("menu-btn").addEventListener("click", toggleNav);
    document.getElementById("search-btn").addEventListener("click", () => ui.openSearch());
    document.getElementById("notify-btn").addEventListener("click", (e) => ui.openNotificationsPopover(e.currentTarget));
    document.getElementById("capture-btn").addEventListener("click", () => ui.openCapture());
    document.getElementById("avatar-btn").addEventListener("click", () => {
      if (app().classList.contains("nav-open")) closeNav();
      location.hash = "#/settings";
    });

    document.getElementById("main").addEventListener("click", (e) => {
      const reload = e.target.closest("#err-reload");
      if (reload) render("retry");
    });

    document.addEventListener("click", (e) => {
      if (!app().classList.contains("nav-open")) return;
      if (e.target.closest("#sidebar") || e.target.closest("#menu-btn") || e.target.closest("#mobile-more")) return;
      closeNav();
    });

    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === "k") {
        e.preventDefault();
        if (!document.querySelector(".palette-wrap")) ui.openSearch();
      }
      if (e.key === "Escape" && app().classList.contains("nav-open")) {
        closeNav();
      }
    });

    window.addEventListener("hashchange", () => {
      if (!location.hash) { location.replace("#/today"); return; }
      render("route");
    });

    window.addEventListener("online", updateConnectivity);
    window.addEventListener("offline", updateConnectivity);

    window.addEventListener("resize", () => {
      if (window.innerWidth > 960 && app().classList.contains("nav-open")) closeNav();
    });

    document.addEventListener("focusout", () => {
      if (!pendingRerender) return;
      setTimeout(() => {
        if (pendingRerender && !isTyping()) render("store");
      }, 0);
    });

    store.subscribe(() => {
      if (isTyping()) { pendingRerender = true; return; }
      render("store");
    });

    if (!location.hash) history.replaceState(null, "", "#/today");
    render("route");
    updateConnectivity();
    window.addEventListener("pagehide", () => { POS.store.flush(); });
    if (window.innerWidth <= 960) app().classList.remove("nav-open");
  }

  POS.app = { render, closeNav };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
