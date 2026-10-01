// main.js
// purpose: app bootstrap + data loading + render orchestration

import { loadCSV, normalizeDirectoryRow, normalizeEventRow } from "./data.js?v=20260823-instagram-links";
import { state, setIndexQuery, setEventsQuery, setIndexEventsQuery, setIndexDistanceMiles, setIndexDistanceFrom, setEventsDistanceMiles, setEventsDistanceFrom } from "./state.js?v=20260813-index-regions";
import { filterEvents } from "./filters.js?v=20261001-area-carousel";
import { renderEventsGroups, renderIndexEventsGroups } from "./render.js?v=20260823-directory-social-links";
import { renderSeminarCarousels } from "./seminarCarousel.js?v=20261001-dynamic-quick-carousel";

import { $ } from "./utils/dom.js?v=20260210-911";
import { applyDistanceFilter } from "./utils/geo.js?v=20261001-zip-focus-fix";
import { initEventsPills, initIndexPills } from "./ui/pills.js?v=20261001-area-carousel";
import { wireSearch, wireSearchSuggestions } from "./ui/search.js?v=20261001-dynamic-quick-carousel";
import { closePricingPopup, wirePricingPopup } from "./ui/pricing.js";
import { activeEventsState, setActiveEventsQuery, setViewUI, syncActiveViewHeight, wireViewToggle } from "./ui/viewToggle.js?v=20260823-simple-gym-index";
import { dirToIndexEventRow, ensureDistanceOriginOptions, filterIndexDirectoryAsEvents, syncDistanceUIFromState } from "./indexDirectory.js?v=20260823-simple-gym-index";

let directoryRows = [];
let eventRows = [];
let didRender = false;
let renderedCarouselMode = "";

const QUICK_CAROUSELS = Object.freeze({
  "THIS WEEK": {
    title: "This Week's Seminars",
    eyebrow: "Coming up this week",
    emptyText: "No seminars are listed for this week yet.",
  },
  "NEXT WEEK": {
    title: "Next Week's Seminars",
    eyebrow: "Coming up next week",
    emptyText: "No seminars are listed for next week yet.",
  },
  "NEW EVENTS": {
    title: "New Events Added",
    eyebrow: "Recently added",
    emptyText: "No newly added seminars are listed yet.",
  },
  "THIS MONTH": {
    title: "This Month's Seminars",
    eyebrow: "Current month",
    emptyText: "No seminars are listed for this month yet.",
  },
});

function normalizedQuickQuery(value){
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function selectedCarouselArea(){
  const selected = state.events.state;
  if(!(selected instanceof Set) || selected.size !== 1) return "";
  if(selected.has("NEW JERSEY")) return "NEW JERSEY";
  if(selected.has("NEW YORK")) return "NEW YORK";
  return "";
}

function combinedCarouselTitle(quickMode, area){
  const areaName = area === "NEW JERSEY" ? "New Jersey" : "New York";
  if(quickMode === "THIS WEEK") return `This Week's ${areaName} Seminars`;
  if(quickMode === "NEXT WEEK") return `Next Week's ${areaName} Seminars`;
  if(quickMode === "NEW EVENTS") return `Newly Added ${areaName} Seminars`;
  if(quickMode === "THIS MONTH") return `This Month's ${areaName} Seminars`;
  return `${areaName} Seminars`;
}

function initThemeToggle(){
  const button = $("themeToggle");
  if(!button) return;

  let settledTheme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";

  const applyTheme = (theme) => {
    const isDark = theme === "dark";
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    button.querySelector(".themeToggle__icon").textContent = isDark ? "\u2600" : "\u263e";
    const label = isDark ? "Switch to light mode" : "Switch to dark mode";
    button.setAttribute("aria-label", label);
    button.title = label;
  };

  applyTheme(settledTheme);
  button.addEventListener("click", () => {
    const nextTheme = settledTheme === "dark" ? "light" : "dark";
    settledTheme = nextTheme;
    localStorage.setItem("bjj-seminars-theme", nextTheme);
    applyTheme(nextTheme);
  });
}

function restoreSavedView(){
  try{
    state.view = localStorage.getItem("bjj-seminars-view") === "index" ? "index" : "events";
  } catch{
    state.view = "events";
  }
}

const EVENTS_AREAS = new Set(["NEW JERSEY", "NYC", "LONG ISLAND", "NEW YORK STATE"]);
const INDEX_REGIONS = Object.freeze({
  "NEW JERSEY": ["NORTH JERSEY", "CENTRAL JERSEY", "SOUTH JERSEY"],
  "NEW YORK": ["NYC", "LONG ISLAND", "NEW YORK STATE"],
});

function isPublishedSeminar(row){
  const type = String(row.TYPE || row.EVENT || "").trim().toUpperCase();
  const area = String(row.STATE || "").trim().toUpperCase();
  return type === "SEMINAR" && EVENTS_AREAS.has(area);
}

function syncIndexDistanceUI(){
  ensureDistanceOriginOptions();
  syncDistanceUIFromState($, state);
}

function syncEventsDistanceUI(){
  const distWrap = $("eventsSearchSuggestEventsDistance");
  if(!distWrap) return;
  const seg = distWrap.querySelector(".iosSeg");
  const btns = distWrap.querySelectorAll(".iosSeg__btn");
  if(seg && btns && btns.length){
    const miles = Number(state.events.distMiles || 15);
    seg.dataset.selected = String(miles);
    btns.forEach((b)=>{
      const m = Number(b.dataset.miles);
      const on = (m === miles);
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }
}

function setSearchQueryForActiveView(val){
  setActiveEventsQuery(val, { setIndexEventsQuery, setEventsQuery });
}


function renderEventsView(){
  const distRes = applyDistanceFilter(
    eventRows,
    Number(state.events.distMiles) || 15,
    state.events.distFrom,
    () => {
      if(state.view === "events") render();
    }
  );

  const evFiltered = filterEvents(distRes.rows, state);
  renderEventsGroups($("eventsRoot"), evFiltered);

  if(distRes.active){
    const pending = Number(distRes.pending) || 0;
    $("eventsStatus").textContent = pending > 0
      ? `${evFiltered.length} events (locating ${pending}…)`
      : `${evFiltered.length} events`;
  } else {
    $("eventsStatus").textContent = `${evFiltered.length} events`;
  }
}

function renderIndexView(){
  const distRes = applyDistanceFilter(
    directoryRows,
    Number(state.indexEvents.distMiles) || 15,
    state.indexEvents.distFrom,
    () => {
      if(state.view === "index") render();
    }
  );

  const idxRows = distRes.rows.map(dirToIndexEventRow);
  const idxFiltered = filterIndexDirectoryAsEvents(idxRows, state.indexEvents);
  renderIndexRegionTabs();
  renderIndexEventsGroups($("indexEventsRoot"), idxFiltered);

  if(distRes.active){
    const pending = Number(distRes.pending) || 0;
    $("status").textContent = pending > 0
      ? `${idxFiltered.length} gyms (locating ${pending}…)`
      : `${idxFiltered.length} gyms`;
  } else {
    $("status").textContent = `${idxFiltered.length} gyms`;
  }
}

function renderIndexRegionTabs(){
  const root = $("indexRegionTabs");
  if(!root) return;

  const selectedAreas = Array.from(state.indexEvents.state).filter(value => INDEX_REGIONS[value]);
  const area = selectedAreas.length === 1 ? selectedAreas[0] : "";
  const regions = INDEX_REGIONS[area] || [];
  root.hidden = regions.length === 0;
  root.replaceChildren();
  if(!regions.length) return;

  const options = ["ALL", ...regions];
  for(const option of options){
    const button = document.createElement("button");
    button.className = "regionTabs__button";
    button.type = "button";
    button.textContent = option;
    const active = option === "ALL" ? !state.indexEvents.region : state.indexEvents.region === option;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.addEventListener("click", () => {
      state.indexEvents.region = option === "ALL" ? "" : option;
      render();
    });
    root.appendChild(button);
  }
}

function render(){
  didRender = true;
  closePricingPopup();
  renderEventsView();
  renderIndexView();
  syncSeminarCarousels();
  syncSeminarCarouselVisibility();
  syncActiveViewHeight($);
}

function syncSeminarCarousels(){
  const quickMode = normalizedQuickQuery(state.events.q);
  const quickConfig = QUICK_CAROUSELS[quickMode] || null;
  const area = selectedCarouselArea();
  const renderMode = [quickConfig ? quickMode : "", area].filter(Boolean).join("|") || "DEFAULT";
  if(renderMode === renderedCarouselMode) return;

  let featured = null;
  if(quickConfig || area){
    const query = quickConfig ? quickMode : "THIS MONTH";
    const areaSelection = area ? new Set([area]) : new Set();
    const rows = filterEvents(eventRows, { events: { q: query, state: areaSelection } });
    featured = {
      ...(quickConfig || {
        eyebrow: "This month's regional seminars",
        emptyText: "No seminars are listed for this area this month yet.",
      }),
      title: area ? combinedCarouselTitle(quickConfig ? quickMode : "", area) : quickConfig.title,
      rows,
    };
  }
  renderCarousels(featured);
  renderedCarouselMode = renderMode;
}

function syncSeminarCarouselVisibility(){
  const root = $("seminarShowcase");
  if(!root) return;

  const query = String(state.events.q || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const isUpcomingSearch = [
    "this week",
    "next week",
    "net week",
    "new events",
    "this month",
  ].some(token => query.includes(token));

  const featured = root.querySelector(".seminarRail");
  const previous = root.querySelector('.seminarRail[aria-label="Previous Seminars"]');
  const featuredCount = featured?.querySelectorAll(".seminarCard").length || 0;
  const isDynamicCarousel = renderedCarouselMode !== "DEFAULT";
  const hideFeatured = isDynamicCarousel && featuredCount < 2;

  if(featured) featured.hidden = hideFeatured;
  if(previous) previous.hidden = isUpcomingSearch;
  root.hidden = hideFeatured && isUpcomingSearch;
}

function focusSeminar(row){
  const query = String(row.FOR || row.GYM || row.WHERE || "seminar").trim();
  setEventsQuery(query);
  const searchInput = $("eventsSearchInput");
  if(searchInput) searchInput.value = query;
  render();
  $("eventsRoot")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderCarousels(featured = null){
  renderSeminarCarousels($("seminarShowcase"), eventRows, {
    onSelect: focusSeminar,
    featured,
  });
}


async function init(){
  const { applyCustomization } = await import(`../../customization.js?v=${Date.now()}`);
  applyCustomization();
  initThemeToggle();
  restoreSavedView();

  wireViewToggle({ $, onIndexViewOpen: syncIndexDistanceUI });
  wirePricingPopup();

  wireSearch({
    $,
    setIndexQuery,
    setIndexEventsQuery,
    setActiveEventsQuery: setSearchQueryForActiveView,
    setIndexDistanceMiles,
    isIndexView: () => state.view === "index",
    isEventsView: () => state.view === "events",
    clearIndexDistance: () => {
      setIndexDistanceFrom("");
      const inZip = $("distanceOriginInput");
      if(inZip) inZip.value = "";
    },
    clearEventsDistance: () => {
      setEventsDistanceFrom("");
      const inZip = $("eventsDistanceOriginInput");
      if(inZip) inZip.value = "";
    },
    render,
  });

  wireSearchSuggestions({
    $,
    setActiveEventsQuery: setSearchQueryForActiveView,
    setIndexDistanceMiles,
    setEventsDistanceMiles,
    isEventsView: () => state.view === "events",
    isIndexView: () => state.view === "index",
    onIndexViewOpen: syncIndexDistanceUI,
    onEventsViewOpen: syncEventsDistanceUI,
    onIndexDistanceSelectOrigin: (label) => {
      setIndexDistanceFrom(label);
      render();
    },
    onEventsDistanceSelectOrigin: (label) => {
      setEventsDistanceFrom(label);
      render();
    },
    setIndexEventsQuery,
    setEventsQuery,
  });


  if(!state.view) state.view = "events";
  setViewUI(state.view, { $, onIndexViewOpen: syncIndexDistanceUI, animate: false });

  $("status").textContent = "Loading...";
  $("eventsStatus").textContent = "Loading...";

  const [dirRaw, evRaw] = await Promise.all([
    loadCSV("directory.csv"),
    loadCSV("events.csv").catch(()=>[])
  ]);

  directoryRows = dirRaw.map(normalizeDirectoryRow);
  eventRows = evRaw.map(normalizeEventRow).filter(isPublishedSeminar);
  initEventsPills({
    $,
    getEventRows: () => eventRows,
    activeEventsState,
    isIndexView: () => state.view === "index",
    onChange: render,
  });

  try{
    initIndexPills({
      $,
      state,
      getDirectoryRows: () => directoryRows,
      onChange: render,
    });
  }catch(err){
    console.warn("Index pill wiring skipped:", err);
  }

  render();
}

init().catch((err)=>{
  console.error(err);
  if(didRender) return;
  $("status").textContent = "Failed to load data";
  $("eventsStatus").textContent = "Failed to load data";
});
