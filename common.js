/* Elite Haven — Shared script
 * Builds navigation, footer, scroll behaviors, reveal animations, toast & wishlist helpers.
 */
(function () {
  const NAV_LINKS = [
    { href: "index.html", label: "Home", key: "home" },
    { href: "listings.html", label: "Properties", key: "listings" },
    { href: "about.html", label: "About", key: "about" },
    { href: "reviews.html", label: "Reviews", key: "reviews" },
    { href: "faqs.html", label: "FAQs", key: "faqs" },
    { href: "contact.html", label: "Contact", key: "contact" }
  ];

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.from((c || document).querySelectorAll(s)); }

  /* ---------- WISHLIST (Server-backed, no localStorage) ---------- */
  const WL_API = "http://localhost:3000/wishlist";

  const Wishlist = {
    _cache: new Set(), // unique property IDs
    _itemIds: {}, // map propertyId -> wishlist item ids on server

    async refresh() {
      this._cache.clear();
      this._itemIds = {};
      const session = window.EH.getSession();
      if (!session || !session.id) return;
      try {
        const res = await fetch(`${WL_API}?userId=${encodeURIComponent(session.id)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const items = await res.json();
        const uniqueIds = new Map();
        items.forEach(item => {
          const pid = String(item.propertyId);
          if (!uniqueIds.has(pid)) uniqueIds.set(pid, []);
          uniqueIds.get(pid).push(item.id);
        });
        uniqueIds.forEach((ids, pid) => {
          this._cache.add(pid);
          this._itemIds[pid] = ids;
        });
      } catch (e) {
        console.warn("Failed to load wishlist from server", e);
      }
    },

    all() { return Array.from(this._cache); },
    has(id) { return this._cache.has(String(id)); },
    count() { return this._cache.size; },

    async toggle(id) {
      const session = window.EH.getSession();
      if (!session || !session.id) {
        try { window.EH.toast("Please sign in to save properties."); } catch (e) {}
        return false;
      }
      id = String(id);
      const exists = this.has(id);
      try {
        if (exists) {
          const itemIds = this._itemIds[id] || [];
          await Promise.all(itemIds.map(itemId => fetch(`${WL_API}/${encodeURIComponent(itemId)}`, { method: "DELETE" })));
          this._cache.delete(id);
          delete this._itemIds[id];
        } else {
          const res = await fetch(WL_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: session.id, propertyId: id, createdAt: new Date().toISOString() })
          });
          if (res.ok) {
            const created = await res.json();
            this._cache.add(id);
            this._itemIds[id] = [created.id];
          }
        }
      } catch (e) {
        console.error("Wishlist toggle failed", e);
        return exists;
      }
      try { window.dispatchEvent(new CustomEvent("wishlist:update", { detail: { id, list: this.all() } })); } catch (e) {}
      return !exists;
    }
  };
  window.EH = window.EH || {};
  window.EH.Wishlist = Wishlist;
  window.EH.$ = $; window.EH.$$ = $$;
  window.EH.matchesPropertyId = function (property, id) {
    const normalizedId = String(id || "");
    return String(property.id || "") === normalizedId || String(property.propertyId || property.id || "") === normalizedId;
  };

  window.EH.INQUIRY_API_URL = "http://localhost:3000/inquiries";
  window.EH.loadInquiries = async function () {
    if (window.EH._inquiryCache) return window.EH._inquiryCache;
    try {
      const res = await fetch(window.EH.INQUIRY_API_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      window.EH._inquiryCache = Array.isArray(data) ? data : data.inquiries || [];
      return window.EH._inquiryCache;
    } catch (e) {
      console.warn("Failed to load inquiries from", window.EH.INQUIRY_API_URL, e);
      return [];
    }
  };

  window.EH.createInquiry = async function (inquiry) {
    try {
      const res = await fetch(window.EH.INQUIRY_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inquiry)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();
      window.EH._inquiryCache = null;
      return created;
    } catch (e) {
      console.warn("Failed to save inquiry to JSON Server:", e);
      throw e;
    }
  };

  /* ---------- TOAST ---------- */
  function toast(msg) {
    let el = $(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("data-testid", "toast");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 2500);
  }
  window.EH.toast = toast;

  /* ---------- FORMATTING ---------- */
  // Simple price formatter (used in dashboards and for logged-in rendering)
  window.EH.isRentListing = function (listingType) {
    return String(listingType || '').toLowerCase() === 'for rent';
  };

  window.EH.fmtPrice = function (p, listingType) {
    const n = new Intl.NumberFormat('en-US').format(p || 0);
    return window.EH.isRentListing(listingType) ? `$${n}/mo` : `$${n}`;
  };
  window.EH.fmtArea = function (a, unit) {
    return `${new Intl.NumberFormat('en-US').format(a)} ${unit || 'sqft'}`;
  };

  // Card-specific premium markup (shows luxury unlock UI for guests)
  window.EH.fmtPriceCard = function (p, listingType, id) {
    const session = window.EH.getSession();
    if (session && session.id) return `<span class="amt">${window.EH.fmtPrice(p, listingType)}</span>`;
    // Guest view: very compact unlock badge (no feature list shown until login)
    return `
      <div class="premium-unlock-compact" data-prop-id="${id || ''}" aria-hidden="false">
        <div class="puc-inline">🔒 Exclusive Pricing</div>
        <button class="btn btn--small unlock-btn" data-prop-id="${id || ''}">Unlock Details →</button>
      </div>`;
  };

  // Property detail premium price (blurred for guests)
  window.EH.fmtPriceDetail = function (p, listingType) {
    const session = window.EH.getSession();
    if (session && session.id) return `<div class="amt">${window.EH.fmtPrice(p, listingType)}</div>`;
    // Guest blurred view
    return `
      <div class="premium-price-blur">
        <div class="ppb-amount">🔒 <span class="ppb-dots">••••••••</span></div>
        <div class="ppb-note">Login to unlock pricing</div>
        <button class="btn btn--outline btn--lg unlock-btn">Unlock Details →</button>
      </div>`;
  };

  /* Update rendered price elements when session changes */
  window.EH.updatePrices = function () {
    try {
      document.querySelectorAll('[data-price]').forEach(el => {
        const price = Number(el.getAttribute('data-price') || 0);
        const listingType = el.getAttribute('data-listing-type') || el.getAttribute('data-status') || '';
        // Card vs property detail detection
        if (el.classList && el.classList.contains('card__price')) {
          const pid = el.closest('[data-testid]') && el.closest('[data-testid]').getAttribute('data-testid')?.includes('property-card') ? el.closest('.card')?.getAttribute('data-testid')?.split('-').pop() : el.getAttribute('data-id') || el.getAttribute('data-prop-id') || '';
          el.innerHTML = window.EH.fmtPriceCard(price, listingType, pid);
        } else if (el.getAttribute('data-testid') === 'property-price' || el.classList.contains('price') || el.closest('#propertyMain')) {
          el.innerHTML = window.EH.fmtPriceDetail(price, listingType);
        } else {
          el.innerHTML = window.EH.fmtPrice(price, listingType);
        }
      });
      // Update protected stats (bedrooms, bathrooms, area, year built)
      document.querySelectorAll('[data-stat]').forEach(el => {
        try {
          const val = el.getAttribute('data-value') || '';
          const session = window.EH.getSession();
          if (session && session.id) {
            // For area we may want to format with units if present
            if (el.getAttribute('data-stat') === 'area') {
              el.innerHTML = val ? new Intl.NumberFormat('en-US').format(Number(val)) : '—';
            } else {
              el.textContent = val || '—';
            }
          } else {
            el.textContent = '—';
          }
        } catch (e) { /* ignore per-item */ }
      });
    } catch (e) { /* ignore */ }
  };

  function setCookie(name, value, days) {
    const expires = days ? `; expires=${new Date(Date.now() + days * 864e5).toUTCString()}` : "";
    document.cookie = `${name}=${encodeURIComponent(value || "")}${expires}; path=/; SameSite=Lax`;
  }

  function getCookie(name) {
    const match = document.cookie.split('; ').find(c => c.indexOf(name + '=') === 0);
    if (!match) return null;
    return decodeURIComponent(match.split('=')[1] || '') || null;
  }

  function deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  }

  window.EH.setSession = function (session) {
    const payload = JSON.stringify(session || {});
    setCookie("eh_session", payload, 7);
    // do not store session in memory; rely on cookie only
    try { window.dispatchEvent(new Event('eh:session')); } catch (e) {}
    return session;
  };

  window.EH.getSession = function () {
    const cookieValue = getCookie("eh_session");
    if (!cookieValue) return null;
    try {
      return JSON.parse(cookieValue);
    } catch (e) {
      return null;
    }
  };

  window.EH.clearSession = function () {
    deleteCookie("eh_session");
    // no in-memory session to clear; cookie removed above
    try { window.dispatchEvent(new Event('eh:session')); } catch (e) {}
  };

  /* ---------- DATA LOADER ---------- */
  // Load all properties (including unverified) — used by admin
  window.EH.loadAllProperties = async function () {
    if (window.EH._allCache) return window.EH._allCache;

    const url = "http://localhost:3000/properties";

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      window.EH._allCache = (Array.isArray(data) ? data : data.properties || []).map((item) => ({
        ...item,
        id: String(item.id != null ? item.id : item.propertyId || ""),
        price: Number(item.price || 0),
        area: Number(item.area || 0),
        bhk: Number(item.bhk || item.bedrooms || item.beds || 0),
        bathrooms: Number(item.bathrooms || item.baths || 0),
        state: item.state || item.marketState || item.lifecycleStatus || 'Available',
        images: Array.isArray(item.images)
          ? item.images
          : item.images
            ? [item.images]
            : [],
        createdAt: item.createdAt || new Date().toISOString()
      }));
      return window.EH._allCache;
    } catch (e) {
      console.warn(`Failed to load properties from ${url}:`, e);
      return [];
    }
  };

  // Load only approved/verified properties (public-facing)
  window.EH.loadProperties = async function () {
    if (window.EH._cache) return window.EH._cache;
    const all = await window.EH.loadAllProperties();
    window.EH._cache = (all || []).filter(p => p.verified || p.verified === true);
    return window.EH._cache;
  };

  window.EH.invalidateProperties = function () { window.EH._cache = null; window.EH._allCache = null; };

  window.EH.updateProperty = async function (id, patch) {
    const url = `http://localhost:3000/properties/${encodeURIComponent(id)}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    if (!res.ok) throw new Error(`Unable to update property ${id}: ${res.status}`);
    window.EH.invalidateProperties();
    return await res.json();
  };

  window.EH.deleteProperty = async function (id) {
    const url = `http://localhost:3000/properties/${encodeURIComponent(id)}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Unable to delete property ${id}: ${res.status}`);
    window.EH.invalidateProperties();
    return true;
  };

  /* ---------- NAVIGATION + FOOTER INJECTION ---------- */
  async function buildNav(activeKey) {
    const session = window.EH.getSession();
    if (session) await Wishlist.refresh();
    const wlCount = new Set(Wishlist.all()).size;
    const linksHtml = NAV_LINKS.map(l =>
      `<a href="${l.href}" class="${activeKey === l.key ? "active" : ""}" data-testid="nav-link-${l.key}">${l.label}</a>`
    ).join("");
    
    // Check if on dashboard page
    const isDashboardPage = /dashboard-(user|agent|admin)\.html/.test(window.location.pathname);
    
    // Generate CTA based on session and role
    let ctaHtml;
    if (session) {
      let dashboardBtn = "";
      
      // Only show dashboard button on non-dashboard pages
      if (!isDashboardPage) {
        let dashboardHref = "dashboard-user.html";
        let dashboardLabel = "Dashboard";
        
        if (session.role === "agent") {
          dashboardHref = "dashboard-agent.html";
          dashboardLabel = "Advisor Dashboard";
        } else if (session.role === "admin") {
          dashboardHref = "dashboard-admin.html";
          dashboardLabel = "Admin Dashboard";
        }
        
        dashboardBtn = `<a href="${dashboardHref}" class="btn btn--solid btn--nav-compact" data-testid="nav-dashboard-btn">${dashboardLabel} <span class="arrow">&rarr;</span></a>`;
      }
      
      // Logout button always visible when logged in
      ctaHtml = `${dashboardBtn}
        <button class="btn btn--nav-compact" id="navLogoutBtn" data-testid="nav-logout-btn">Log Out <span class="arrow">&rarr;</span></button>`;
    } else {
      ctaHtml = `<a href="login.html" class="btn btn--nav-compact" data-testid="nav-login-btn">Sign In <span class="arrow">&rarr;</span></a>`;
    }
    
    return `
      <nav class="nav" id="ehNav" data-testid="main-nav">
        <div class="container nav__inner">
          <a href="index.html" class="brand" data-testid="brand-link">
            <span class="brand__mark"><img src="logo1.png" alt="Elite Haven Logo" /></span>
            <span class="brand__name">Elite Haven</span>
          </a>
          <div class="nav__links" id="navLinks">${linksHtml}</div>
          <div class="nav__cta">
            <a href="saved.html" class="icon-btn" aria-label="Saved properties" data-testid="nav-wishlist-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span class="badge" id="wlBadge" data-testid="wishlist-badge" style="display:${wlCount ? 'inline-flex' : 'none'}">${wlCount}</span>
            </a>
            ${ctaHtml}
            <button class="icon-btn nav__burger" id="navBurger" aria-label="Menu" data-testid="nav-burger">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
          </div>
        </div>
      </nav>`;
  }

  function updateWishlistBadge() {
    const count = Wishlist.count();
    const btn = $('[data-testid="nav-wishlist-btn"]');
    const badge = $('#wlBadge');
    if (!btn) return;
    if (count > 0) {
      if (badge) {
        badge.textContent = count;
        badge.style.display = 'inline-flex';
      }
    } else if (badge) {
      badge.textContent = '';
      badge.style.display = 'none';
    }
  }
  window.EH.updateWishlistBadge = updateWishlistBadge;

  function buildFooter() {
    return `
      <footer class="footer" data-testid="main-footer">
        <div class="container">
          <div class="footer__grid">
            <div class="footer__col">
              <div class="footer__brand">ELITE HAVEN</div>
              <p>An invitation-only platform connecting the world's most discerning buyers with rare residential masterpieces across five continents.</p>
              <div class="socials" style="margin-top:18px">
                <a href="#" aria-label="Instagram"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor"/></svg></a>
                <a href="#" aria-label="Facebook"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>
                <a href="#" aria-label="LinkedIn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg></a>
                <a href="#" aria-label="YouTube"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22.5 6.5a3 3 0 0 0-2.1-2.1C18.7 4 12 4 12 4s-6.7 0-8.4.4A3 3 0 0 0 1.5 6.5C1 8.2 1 12 1 12s0 3.8.5 5.5a3 3 0 0 0 2.1 2.1C5.3 20 12 20 12 20s6.7 0 8.4-.4a3 3 0 0 0 2.1-2.1c.5-1.7.5-5.5.5-5.5s0-3.8-.5-5.5z"/><path d="M10 15V9l5 3-5 3z" fill="currentColor"/></svg></a>
              </div>
            </div>
            <div class="footer__col">
              <h4>Discover</h4>
              <a href="listings.html">All Properties</a>
              <a href="listings.html?type=Villa">Villas</a>
              <a href="listings.html?type=Penthouse">Penthouses</a>
              <a href="listings.html?type=Estate">Estates</a>
              <a href="listings.html?status=For Rent">For Rent</a>
            </div>
            <div class="footer__col">
              <h4>Company</h4>
              <a href="about.html">About</a>
              <a href="reviews.html">Reviews</a>
              <a href="faqs.html">FAQs</a>
              <a href="contact.html">Contact</a>
              <a href="login.html">Agent Portal</a>
            </div>
            <div class="footer__col">
              <h4>Contact</h4>
              <a href="mailto:concierge@elitehaven.lux">concierge@elitehaven.lux</a>
              <a href="tel:+13105550100">+1 310 555 0100</a>
              <span style="display:block;color:var(--muted);padding:6px 0;font-size:14px">Beverly Hills · Manhattan · London · Dubai</span>
            </div>
          </div>
          <div class="footer__bottom">
            <span>© 2026 Elite Haven. All rights reserved.</span>
            <span>Privacy · Terms · Sitemap</span>
          </div>
        </div>
      </footer>`;
  }

  /* ---------- NAV MOUNT + UPDATES ---------- */
  async function mountNav(activeKey) {
    const navMount = $("#mountNav");
    if (navMount) navMount.outerHTML = await buildNav(activeKey);
    // wire logout if present
    const navLogoutBtn = $("#navLogoutBtn");
    if (navLogoutBtn) {
      navLogoutBtn.addEventListener("click", () => {
        window.EH.clearSession();
        window.EH.toast("Logged out successfully.");
        window.location.href = "login.html";
      });
    }
  }

  /* ---------- INIT ---------- */
  async function init() {
    const active = document.body.getAttribute("data-page") || "";

    // Mount header & footer
    await mountNav(active);
    const footMount = $("#mountFooter");
    if (footMount) footMount.outerHTML = buildFooter();
    try { window.EH.updatePrices(); } catch (e) { /* ignore */ }

    // Refresh wishlist and update nav when session changes (login/logout)
    window.addEventListener('eh:session', async () => {
      await Wishlist.refresh();
      try { window.dispatchEvent(new CustomEvent('wishlist:update', { detail: { id: null, list: Wishlist.all() } })); } catch (e) {}
      await mountNav(active);
      try { window.EH.updatePrices(); } catch (e) { /* ignore */ }
    });

    // Sticky nav on scroll
    const nav = $("#ehNav");
    const onScroll = () => {
      if (!nav) return;
      if (window.scrollY > 30) nav.classList.add("scrolled");
      else nav.classList.remove("scrolled");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // Mobile menu
    const burger = $("#navBurger");
    if (burger) burger.addEventListener("click", () => $("#navLinks").classList.toggle("open"));

    // Reveal on scroll
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    $$(".reveal").forEach(el => io.observe(el));

    // Unlock button behavior: redirect guests to login, reveal for logged-in users
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.unlock-btn');
      if (!btn) return;
      const session = window.EH.getSession();
      if (!session || !session.id) {
        // redirect to login
        window.location.href = 'login.html';
        return;
      }
      // logged-in: refresh prices in-place
      try { window.EH.updatePrices(); } catch (err) { /* ignore */ }
      // smooth reveal: if inside a card, scroll to it
      const card = btn.closest('.card');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    // Update wishlist badge and UI live
    window.addEventListener("wishlist:update", (ev) => {
      const c = new Set(Wishlist.all()).size;
      let badge = $("#wlBadge");
      const btn = $('[data-testid="nav-wishlist-btn"]');
      if (btn) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "badge"; badge.id = "wlBadge"; badge.setAttribute("data-testid", "wishlist-badge");
          badge.style.display = 'none';
          btn.appendChild(badge);
        }
        badge.textContent = c;
        badge.style.display = c > 0 ? 'inline-flex' : 'none';
      }

      // Sync any card heart icons on the page
      document.querySelectorAll('.card__heart').forEach(btn => {
        try {
          const id = btn.getAttribute('data-id');
          const isSaved = Wishlist.has(id);
          btn.classList.toggle('active', isSaved);
          const svg = btn.querySelector('svg');
          if (svg) svg.setAttribute('fill', isSaved ? 'currentColor' : 'none');
        } catch (e) { /* ignore */ }
      });

      // Sync property detail save button if present
      try {
        const propSave = document.getElementById('propSave');
        if (propSave) {
          const params = new URLSearchParams(location.search);
          const pid = params.get('id');
          if (pid) {
            const added = Wishlist.has(pid);
            propSave.classList.toggle('btn--solid', added);
            propSave.innerHTML = added ? '★ Saved' : '☆ Save';
          }
        }
      } catch (e) {}

      // If we're on the saved page, re-render the saved grid (renderSaved is defined in saved.html)
      try {
        if (typeof renderSaved === 'function') renderSaved();
      } catch (e) {}
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
