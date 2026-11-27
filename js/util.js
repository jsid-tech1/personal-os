/* Personal OS — utilities. No dependencies. */
(function () {
  "use strict";
  const POS = (window.POS = window.POS || {});

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const uid = (prefix = "id") =>
    prefix + "_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  const escapeHTML = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));

  const debounce = (fn, ms = 300) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- dates ---------- */

  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (d = new Date()) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromISO = (iso) => {
    const [y, m, d] = String(iso).split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const todayISO = () => toISO(new Date());
  const addDays = (iso, n) => {
    const d = fromISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  };
  const startOfWeek = (iso, weekStartsMonday = true) => {
    const d = fromISO(iso);
    const day = d.getDay();
    const diff = weekStartsMonday ? (day === 0 ? -6 : 1 - day) : -day;
    d.setDate(d.getDate() + diff);
    return toISO(d);
  };
  const diffDays = (a, b) => Math.round((fromISO(a) - fromISO(b)) / 86400000);

  const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const DOW_S = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MON = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  const MON_S = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const fmtDate = (iso, style = "long") => {
    const d = fromISO(iso);
    if (style === "long") return `${DOW[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`;
    if (style === "medium") return `${DOW_S[d.getDay()]} ${d.getDate()} ${MON_S[d.getMonth()]}`;
    if (style === "short") return `${d.getDate()} ${MON_S[d.getMonth()]}`;
    if (style === "monthYear") return `${MON[d.getMonth()]} ${d.getFullYear()}`;
    return iso;
  };

  const relDate = (iso, base = todayISO()) => {
    const diff = diffDays(iso, base);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    if (diff > 1 && diff < 7) return DOW_S[fromISO(iso).getDay()];
    if (diff < -1 && diff > -7) return `${Math.abs(diff)} days ago`;
    return fmtDate(iso, "short");
  };

  const fmtMin = (minutes) => {
    const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
    const h = Math.floor(m / 60);
    return `${h % 12 === 0 ? 12 : h % 12}:${pad(m % 60)} ${h < 12 ? "am" : "pm"}`;
  };
  const fmtMinShort = (minutes) => {
    const h = Math.floor(minutes / 60);
    return `${h % 12 === 0 ? 12 : h % 12}${minutes % 60 ? ":" + pad(minutes % 60) : ""}${h < 12 ? "am" : "pm"}`;
  };
  const fmtDur = (minutes) => {
    const m = Math.round(minutes);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h}h ${r}m` : `${h}h`;
  };
  const minutesOf = (hhmm) => {
    const [h, m] = String(hhmm).split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const hhmmOf = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  const nowMinutes = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 5) return "Still up";
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    if (h < 22) return "Good evening";
    return "Winding down";
  };

  /* ---------- misc ---------- */

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;

  const download = (filename, text, type = "text/plain") => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const wordCount = (s) => (String(s).trim().match(/\S+/g) || []).length;

  /* ---------- icons (authored, one stroke weight) ---------- */

  const PATHS = {
    today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    brain: '<path d="M4 6h16M4 12h10M4 18h13"/>',
    tasks: '<rect x="3" y="4" width="7" height="7" rx="1.6"/><path d="m4.7 7.5 1.3 1.3 2.3-2.6M14 7.5h7M14 16.5h7M3 16.5h7"/>',
    folder: '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    notes: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/>',
    habits: '<path d="M17 2.5 20.5 6 17 9.5M20.5 6H8a4.5 4.5 0 0 0 0 9h1"/><path d="M7 21.5 3.5 18 7 14.5M3.5 18H16a4.5 4.5 0 0 0 0-9h-1"/>',
    focus: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6M18.5 5.5 20 7"/>',
    reflection: '<path d="M3 20h18M6 20v-6M11 20V8M16 20v-9M21 20V4"/>',
    settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 6-2 7-2 7h16s-2-1-2-7"/><path d="M10.5 19a2 2 0 0 0 3 0"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    "chevron-down": '<path d="m6 9 6 6 6-6"/>',
    "chevron-right": '<path d="m9 6 6 6-6 6"/>',
    "chevron-left": '<path d="m15 6-6 6 6 6"/>',
    "arrow-left": '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',
    paperclip: '<path d="M20 11.5 12 19.5a4.6 4.6 0 0 1-6.5-6.5l8.5-8.5a3.1 3.1 0 0 1 4.4 4.4L10 17.4a1.6 1.6 0 0 1-2.2-2.2l7.6-7.6"/>',
    play: '<path d="M7 4.5 19 12 7 19.5z"/>',
    pause: '<path d="M8 4.5v15M16 4.5v15"/>',
    rotate: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4v5h5"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    trash: '<path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v5M14 11v5"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4"/>',
    link: '<path d="M10 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 1 0-5.7-5.7L11 6.8"/><path d="M14 10.5a4 4 0 0 0-5.7 0L5.5 13.3a4 4 0 1 0 5.7 5.7L13 17.2"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    warning: '<path d="M12 3.5 22 20.5H2z"/><path d="M12 10v4.5M12 18h.01"/>',
    sparkles: '<path d="M12 3.5 13.6 9l5.4 1.6L13.6 12 12 17.5 10.4 12 5 10.6 10.4 9z"/><path d="M19 15.5 19.8 18l2.2.8-2.2.8-.8 2.4-.8-2.4-2.2-.8 2.2-.8z"/>',
    grip: '<path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01"/>',
    edit: '<path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M14 5l4 4"/>',
    external: '<path d="M14 4h6v6M20 4 10 14"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12.5 9 5 9-5M3 16.5l9 5 9-5"/>',
    flag: '<path d="M5 21V4M5 4h11l-1 4 1 4H5"/>',
    filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    columns: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4"/>',
    dot: '<circle cx="12" cy="12" r="3"/>',
    inbox: '<path d="M3 12h5l1.5 3h5L16 12h5"/><path d="M4 5h16l1 7v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    habit: '<path d="M5 12a7 7 0 0 1 12-4.9M19 12a7 7 0 0 1-12 4.9"/><path d="M17 3.5V7h-3.5M7 20.5V17h3.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5S20 17 20 21"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .7-7.9A6 6 0 0 0 6 11.5 3.5 3.5 0 0 0 7 18z"/>',
    wifi: '<path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M12 19h.01"/>',
    spark: '<path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5 19 19M19 5l-2.5 2.5M7.5 16.5 5 19"/>',
    minus: '<path d="M5 12h14"/>',
    gripv: '<path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01"/>',
    hourglass: '<path d="M7 3h10M7 21h10M8 3v3.5c0 3 4 4.5 4 5.5s-4 2.5-4 5.5V21M16 3v3.5c0 3-4 4.5-4 5.5s4 2.5 4 5.5V21"/>',
    plusCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    coffee: '<path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 9h2.5a2.5 2.5 0 0 1 0 5H17M6 3v2M10 3v2M14 3v2"/>',
  };

  const icon = (name, cls = "") => {
    const key = String(name).replace(/[A-Z]/g, letter => "-" + letter.toLowerCase());
    const p = PATHS[key] || PATHS.dot;
    return `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${p}</svg>`;
  };

  POS.util = {
    $, $$, uid, clamp, escapeHTML, debounce, delay,
    toISO, fromISO, todayISO, addDays, startOfWeek, diffDays,
    DOW, DOW_S, MON, MON_S, fmtDate, relDate,
    fmtMin, fmtMinShort, fmtDur, minutesOf, hhmmOf, nowMinutes, greeting,
    plural, download, wordCount, icon,
  };
  POS.icon = icon;
  POS.$ = $;
  POS.$$ = $$;
})();
