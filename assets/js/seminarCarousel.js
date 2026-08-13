import { localMidnight, parseEventDate } from "./utils/dates.js";

const AUTO_ADVANCE_MS = 3600;

export function renderSeminarCarousels(root, rows, { onSelect } = {}){
  if(!root) return;

  const today = localMidnight();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const seminars = rows.filter((row) => String(row.TYPE || row.EVENT || "").trim().toLowerCase() === "seminar");

  const thisMonthRows = seminars
    .filter((row) => {
      const date = row._date || parseEventDate(row.DATE);
      return date && date >= monthStart && date < nextMonth;
    });

  const thisMonth = [
    ...thisMonthRows.filter((row) => (row._date || parseEventDate(row.DATE)) >= today).sort(sortByDate("asc")),
    ...thisMonthRows.filter((row) => (row._date || parseEventDate(row.DATE)) < today).sort(sortByDate("desc")),
  ];

  const previous = seminars
    .filter((row) => {
      const date = row._date || parseEventDate(row.DATE);
      return date && date < monthStart;
    })
    .sort(sortByDate("desc"));

  root.replaceChildren(
    buildCarouselSection({
      eyebrow: monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      title: "This Month's Seminars",
      rows: thisMonth,
      emptyText: "No seminars are listed for this month yet.",
      onSelect,
    }),
    buildCarouselSection({
      eyebrow: "Recent sessions",
      title: "Previous Seminars",
      rows: previous,
      emptyText: "Previous seminars will appear here.",
      onSelect,
    }),
  );
}

function buildCarouselSection({ eyebrow, title, rows, emptyText, onSelect }){
  const section = document.createElement("section");
  section.className = "seminarRail";
  section.setAttribute("aria-label", title);

  const heading = document.createElement("div");
  heading.className = "seminarRail__heading";

  const headingText = document.createElement("div");
  headingText.innerHTML = `
    <div class="seminarRail__eyebrow">${escapeHtml(eyebrow)}</div>
    <h2 class="seminarRail__title">${escapeHtml(title)}</h2>
  `;

  const controls = document.createElement("div");
  controls.className = "seminarRail__controls";
  controls.setAttribute("aria-label", `${title} controls`);

  const previousButton = createArrowButton("previous", title);
  const nextButton = createArrowButton("next", title);
  controls.append(previousButton, nextButton);
  heading.append(headingText, controls);

  const viewport = document.createElement("div");
  viewport.className = "seminarRail__viewport";
  viewport.tabIndex = 0;
  viewport.setAttribute("aria-label", `${title} carousel`);

  const track = document.createElement("div");
  track.className = "seminarRail__track";

  if(rows.length){
    for(const row of rows) track.appendChild(buildSeminarCard(row, onSelect));
  } else {
    const empty = document.createElement("div");
    empty.className = "seminarRail__empty";
    empty.textContent = emptyText;
    track.appendChild(empty);
  }

  viewport.appendChild(track);
  section.append(heading, viewport);

  const move = (direction) => {
    const card = viewport.querySelector(".seminarCard");
    const distance = card ? card.getBoundingClientRect().width + 12 : viewport.clientWidth * 0.8;
    viewport.scrollBy({ left: distance * direction, behavior: "smooth" });
  };

  previousButton.addEventListener("click", () => move(-1));
  nextButton.addEventListener("click", () => move(1));
  wireAutoAdvance(viewport, rows.length);

  return section;
}

function buildSeminarCard(row, onSelect){
  const date = row._date || parseEventDate(row.DATE);
  const card = document.createElement("button");
  card.className = "seminarCard";
  card.type = "button";

  const instructor = String(row.FOR || row.NAME || "Seminar").trim() || "Seminar";
  const gym = String(row.GYM || row.WHERE || "Location coming soon").trim() || "Location coming soon";
  const city = String(row.CITY || "").trim();
  const state = String(row.STATE || "").trim();
  const location = [city, state].filter(Boolean).join(", ");
  const poster = String(row.POSTER || "").trim();

  card.setAttribute("aria-label", `Find ${instructor}, ${formatFullDate(date)}`);
  if(poster){
    card.classList.add("seminarCard--poster");
    card.innerHTML = `
      <img class="seminarCard__poster" src="${escapeHtml(poster)}" alt="${escapeHtml(`${instructor} seminar poster`)}" loading="lazy" />
      <span class="seminarCard__posterShade" aria-hidden="true"></span>
      <span class="seminarCard__posterMeta">
        <span class="seminarCard__posterDate">${escapeHtml(formatFullDate(date))}</span>
        <span class="seminarCard__posterName">${escapeHtml(instructor)}</span>
        <span class="seminarCard__posterPlace">${escapeHtml(gym)} · ${escapeHtml(location)}</span>
      </span>
    `;
    card.addEventListener("click", () => onSelect?.(row));
    return card;
  }

  card.innerHTML = `
    <span class="seminarCard__date" aria-hidden="true">
      <span class="seminarCard__month">${escapeHtml(date ? date.toLocaleDateString("en-US", { month: "short" }) : "TBD")}</span>
      <span class="seminarCard__day">${escapeHtml(date ? String(date.getDate()).padStart(2, "0") : "--")}</span>
    </span>
    <span class="seminarCard__body">
      <span class="seminarCard__type">Seminar</span>
      <span class="seminarCard__name">${escapeHtml(instructor)}</span>
      <span class="seminarCard__gym">${escapeHtml(gym)}</span>
      <span class="seminarCard__location">${escapeHtml(location || formatFullDate(date))}</span>
    </span>
    <span class="seminarCard__action" aria-hidden="true">View <span>→</span></span>
  `;

  card.addEventListener("click", () => onSelect?.(row));
  return card;
}

function wireAutoAdvance(viewport, itemCount){
  if(itemCount < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let timer = null;
  const stop = () => {
    if(timer) window.clearInterval(timer);
    timer = null;
  };
  const start = () => {
    stop();
    timer = window.setInterval(() => {
      const card = viewport.querySelector(".seminarCard");
      if(!card) return;
      const step = card.getBoundingClientRect().width + 12;
      const atEnd = viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 8;
      viewport.scrollTo({ left: atEnd ? 0 : viewport.scrollLeft + step, behavior: "smooth" });
    }, AUTO_ADVANCE_MS);
  };

  viewport.addEventListener("mouseenter", stop);
  viewport.addEventListener("mouseleave", start);
  viewport.addEventListener("focusin", stop);
  viewport.addEventListener("focusout", start);
  viewport.addEventListener("pointerdown", stop, { passive: true });
  viewport.addEventListener("pointerup", start, { passive: true });
  document.addEventListener("visibilitychange", () => document.hidden ? stop() : start());
  start();
}

function createArrowButton(direction, title){
  const button = document.createElement("button");
  button.className = "seminarRail__arrow";
  button.type = "button";
  button.setAttribute("aria-label", `${direction === "next" ? "Next" : "Previous"} ${title}`);
  button.textContent = direction === "next" ? "→" : "←";
  return button;
}

function sortByDate(direction){
  return (a, b) => {
    const aTime = a._dateTime ?? (parseEventDate(a.DATE)?.getTime() ?? 0);
    const bTime = b._dateTime ?? (parseEventDate(b.DATE)?.getTime() ?? 0);
    return direction === "asc" ? aTime - bTime : bTime - aTime;
  };
}

function formatFullDate(date){
  return date ? date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : "Date coming soon";
}

function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
