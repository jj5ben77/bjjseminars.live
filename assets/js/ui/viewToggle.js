// ui/viewToggle.js
// purpose: view state, slider UI, and tab controls

import { CUSTOMIZATION } from "../../../customization.js?v=20260813-bjj-tab-title";
import { state, setView } from "../state.js?v=20260813-index-regions";
import { refreshEventsPillDots } from "./pills.js?v=20260813-dual-area-selection";

const VIEW_LOCKED = false;

let viewShellW = 0;
let lastViewTitleMode = null; // null | "events" | "index"
let currentP = 0;             // source of truth for current progress

function setTransition(ms){
  document.body.style.setProperty("--viewTransition", ms + "ms");
}

function setViewShellW(w){
  viewShellW = Math.max(1, Number(w) || 0);
}

function getViewShellW($){
  return viewShellW || ($("viewShell")?.clientWidth) || window.innerWidth || 1;
}

export function syncActiveViewHeight($, view = state.view){
  const shell = $("viewShell");
  const panel = view === "index" ? $("viewIndex") : $("viewEvents");
  if(!shell || !panel) return;

  window.requestAnimationFrame(() => {
    shell.style.height = `${panel.scrollHeight}px`;
  });
}

function applyProgressVars($, p){
  const clamped = Math.max(0, Math.min(1, p));
  currentP = clamped;

  document.body.style.setProperty("--viewProgress", String(clamped));
  document.body.style.setProperty("--viewOffsetPx", (-getViewShellW($) * clamped) + "px");
  return clamped;
}

function applyProgress($, p){
  const clamped = applyProgressVars($, p);

  const mode = (clamped >= 0.5) ? "index" : "events";
  if(mode !== lastViewTitleMode){
    lastViewTitleMode = mode;
    const viewTitle = $("viewTitle");
    if(viewTitle) viewTitle.textContent = (mode === "index") ? "FIND TRAINING" : "EVENTS";
  }
  return clamped;
}

function setSharedPillLabels(view){
  const isIndex = view === "index";

  const pill1Btn = document.getElementById("eventsPill1Btn");
  const pill1Menu = document.getElementById("eventsPill1Menu");
  const pill1BtnLabel = pill1Btn?.querySelector('[data-pill-title]');
  const pill1MenuTitle = pill1Menu?.querySelector('.menu__title');
  if(pill1BtnLabel) pill1BtnLabel.textContent = "YEAR";
  if(pill1MenuTitle) pill1MenuTitle.textContent = "YEAR";
  if(pill1Menu) pill1Menu.setAttribute("aria-label", "Year menu");

  const wrapYear  = document.querySelector('.pillSelect[data-filter="eventsYear"]');
  const wrapState = document.querySelector('.pillSelect[data-filter="eventsState"]');
  const wrapType = document.querySelector('.pillSelect[data-filter="eventsType"]');
  if(wrapYear) wrapYear.hidden = isIndex;
  if(wrapType) wrapType.hidden = isIndex;
  if(wrapState) wrapState.hidden = false;
  const parent = wrapYear?.parentElement;
  if(wrapYear && wrapState && parent){
    if(!isIndex && wrapYear.nextElementSibling !== wrapState){
      parent.insertBefore(wrapYear, wrapState);
    }
  }

  const pill3Btn = document.getElementById("eventsPill3Btn");
  const pill3Menu = document.getElementById("eventsPill3Menu");
  const pill3BtnLabel = pill3Btn?.querySelector('[data-pill-title]');
  const pill3MenuTitle = pill3Menu?.querySelector('.menu__title');
  if(pill3BtnLabel) pill3BtnLabel.textContent = "EVENT";
  if(pill3MenuTitle) pill3MenuTitle.textContent = "EVENT";
  if(pill3Menu) pill3Menu.setAttribute("aria-label", "Event menu");
}

export function activeEventsState(){
  return (state.view === "index") ? state.indexEvents : state.events;
}

export function setActiveEventsQuery(val, setters){
  if(state.view === "index") setters.setIndexEventsQuery(val);
  else setters.setEventsQuery(val);
}

export function setViewUI(view, { $, onIndexViewOpen, animate = true } = {}){
  setView(view);
  try{
    localStorage.setItem("bjj-seminars-view", state.view);
  } catch{}

  $("tabEvents")?.setAttribute("aria-selected", view === "events" ? "true" : "false");
  $("tabIndex")?.setAttribute("aria-selected", view === "index" ? "true" : "false");

  const evFilters = document.getElementById("eventsFilters");
  const idxFilters = document.getElementById("filters");
  if(evFilters) evFilters.hidden = false;
  if(idxFilters) idxFilters.hidden = true;

  const title = $("viewTitle");
  if(title) title.textContent = (view === "events") ? "EVENTS" : "FIND TRAINING";

  setSharedPillLabels(view);

  const evIn = $("eventsSearchInput");
  if(evIn){
    evIn.value = String(activeEventsState().q || "");
    evIn.setAttribute("placeholder", view === "index" ? "Search gyms" : "Search events");
  }

  if(view === "index" && typeof onIndexViewOpen === "function") onIndexViewOpen();

  const evStatus = $("eventsStatus");
  const idxStatus = $("status");
  if(evStatus) evStatus.hidden = (view !== "events");
  if(idxStatus) idxStatus.hidden = (view !== "index");

  document.title = CUSTOMIZATION.siteHeaderName || "BJJ SEMINARS NJ + NY";

  setTransition(animate ? 260 : 0);
  refreshEventsPillDots({ $, activeEventsState });
  applyProgress($, view === "index" ? 1 : 0);
  syncActiveViewHeight($, view);
}

export function wireViewToggle({ $, onIndexViewOpen } = {}){
  const tabEvents = $("tabEvents");
  const tabIndex  = $("tabIndex");
  const viewToggle = $("viewToggle");
  const viewShell  = $("viewShell");
  const siteMenu = $("siteMenu");
  const siteMenuBtn = $("siteMenuBtn");

  if(viewShell && "ResizeObserver" in window){
    const panelObserver = new ResizeObserver(() => syncActiveViewHeight($));
    const eventsPanel = $("viewEvents");
    const indexPanel = $("viewIndex");
    if(eventsPanel) panelObserver.observe(eventsPanel);
    if(indexPanel) panelObserver.observe(indexPanel);
  }

  window.addEventListener("resize", () => syncActiveViewHeight($));

  function closeSiteMenu(){
    if(!siteMenu || !siteMenuBtn) return;
    siteMenu.hidden = true;
    siteMenuBtn.setAttribute("aria-expanded", "false");
  }

  const positionSiteMenu = () => {
    if(!siteMenuBtn || !siteMenu) return;
    const r = siteMenuBtn.getBoundingClientRect();
    const pad = 8;
    siteMenu.hidden = false;
    const menuRect = siteMenu.getBoundingClientRect();
    const left = Math.max(pad, Math.min(window.innerWidth - menuRect.width - pad, r.right - menuRect.width));
    const top = r.bottom + pad;
    siteMenu.style.left = `${Math.round(left)}px`;
    siteMenu.style.top = `${Math.round(top)}px`;
  };

  function openSiteMenu(){
    if(!siteMenu || !siteMenuBtn) return;
    positionSiteMenu();
    siteMenuBtn.setAttribute("aria-expanded", "true");
  }

  if(VIEW_LOCKED){
    setView("events");
    setViewUI("events", { $, onIndexViewOpen });
    if(viewToggle){
      viewToggle.classList.add("viewToggle--locked");
      viewToggle.setAttribute("aria-disabled", "true");
    }
    tabEvents?.setAttribute("tabindex", "-1");
    tabIndex?.setAttribute("tabindex", "-1");
    tabEvents?.setAttribute("aria-disabled", "true");
    tabIndex?.setAttribute("aria-disabled", "true");
    return;
  }

  tabEvents?.addEventListener("click", () => {
    closeSiteMenu();
    setViewUI("events", { $, onIndexViewOpen });
  });

  siteMenuBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if(siteMenu && siteMenu.hidden) openSiteMenu();
    else closeSiteMenu();
  });

  document.addEventListener("click", (e) => {
    const target = e.target;
    if(target?.closest?.("#siteMenu") || target?.closest?.("#siteMenuBtn")) return;
    closeSiteMenu();
  });

  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape") closeSiteMenu();
  });

  window.addEventListener("resize", closeSiteMenu);
  window.addEventListener("scroll", closeSiteMenu, { passive: true });
  siteMenu?.querySelectorAll(".siteMenu__item").forEach((item) => {
    item.addEventListener("click", closeSiteMenu);
  });

  tabIndex?.addEventListener("click", () => setViewUI("index", { $, onIndexViewOpen }));

  if(viewToggle){
    let dragging = false;
    let pointerId = null;
    let downX = 0;
    let moved = false;

    viewToggle.addEventListener("pointerdown", (e) => {
      dragging = true;
      moved = false;
      downX = e.clientX;
      pointerId = e.pointerId;
      viewToggle.setPointerCapture(pointerId);
    });

    viewToggle.addEventListener("pointermove", (e) => {
      if(!dragging || e.pointerId !== pointerId) return;
      if(!moved){
        if(Math.abs(e.clientX - downX) < 6) return;
        moved = true;
        setTransition(0);
      }

      const rect = viewToggle.getBoundingClientRect();
      const padding = 4;
      const trackW = rect.width - padding * 2;
      const thumbW = trackW / 2;
      const travel = trackW - thumbW;
      const x = e.clientX - rect.left - padding;
      applyProgress($, (x - thumbW / 2) / travel);
    });

    const endDrag = (e) => {
      if(!dragging) return;
      if(e && pointerId != null && e.pointerId !== pointerId) return;

      dragging = false;
      const wasMoved = moved;
      moved = false;
      pointerId = null;

      if(!wasMoved){
        const rect = viewToggle.getBoundingClientRect();
        const x = e && typeof e.clientX === "number" ? e.clientX : (rect.left + rect.width / 2);
        const isRightHalf = x >= (rect.left + rect.width / 2);
        setTransition(260);
        setViewUI(isRightHalf ? "index" : "events", { $, onIndexViewOpen });
        return;
      }

      setTransition(260);
      setViewUI((currentP || 0) >= 0.5 ? "index" : "events", { $, onIndexViewOpen });
    };

    viewToggle.addEventListener("pointerup", endDrag);
    viewToggle.addEventListener("pointercancel", endDrag);
    viewToggle.addEventListener("lostpointercapture", endDrag);
  }

}
