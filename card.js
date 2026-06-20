/* Card renderer used by listings, home, saved pages */
(function () {
  const { Wishlist, fmtPriceCard, fmtArea, toast } = window.EH;

  window.EH.renderCard = function (p) {
    const session = window.EH.getSession();
    const imageSrc = p.coverImage || (Array.isArray(p.images) && p.images.length ? p.images[0] : "https://images.unsplash.com/photo-1494526585095-c41746248156?w=1200&q=80");
    const loc = [p.city || p.location, p.country].filter(Boolean).join(" · ") || "Unknown Location";
    const tagline = p.tagline || (p.description ? p.description.slice(0, 100) : "") || "A distinguished residence with exceptional features.";
    const bedrooms = p.bhk || p.bedrooms || p.beds || 0;
    const bathrooms = p.bathrooms || p.baths || 0;
    const area = p.area || 0;
    const areaUnit = p.areaUnit || "sqft";
    const status = p.status || "For Sale";

    const saved = Wishlist.has(p.id) ? "active" : "";
    const detailsVisible = session && session.id;
    return `
      <article class="card reveal" data-testid="property-card-${p.id}">
        <a href="property.html?id=${p.id}" class="card__img" data-testid="property-link-${p.id}">
          <img src="${imageSrc}" alt="${p.title || "Property"}" loading="lazy" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1494526585095-c41746248156?w=1200&q=80';"/>
          <span class="card__tag" data-testid="property-tag-${p.id}">${status}</span>
        </a>
        <button class="card__heart ${saved}" data-id="${p.id}" aria-label="Save" data-testid="wishlist-toggle-${p.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${Wishlist.has(p.id) ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button> 
        <div class="card__body">
          <div class="card__loc">${loc}</div>
          <a href="property.html?id=${p.id}" class="card__title">${p.title || "Luxury Residence"}</a>
          <p class="card__desc">${tagline}</p>
          <div class="card__price" data-price="${p.price}" data-status="${status}">
            ${fmtPriceCard(p.price, status, p.id)}
            ${detailsVisible ? `<span class="per">${bedrooms} BHK · ${fmtArea(area, areaUnit)}</span>` : ``}
          </div>
          ${detailsVisible ? `
          <div class="card__meta">
            <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12h18M3 12l6-6M3 12l6 6"/></svg> ${p.type || "Residence"}</span>
            <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="10" rx="1"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> ${bathrooms} Baths</span>
            <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18"/></svg> ${bedrooms} BHK</span>
          </div>` : ``}
        </div>
      </article>`;
  };

  // Delegate wishlist clicks across any rendered cards
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".card__heart");
    if (!btn) return;
    e.preventDefault();
    const id = btn.getAttribute("data-id");
    const added = await Wishlist.toggle(id);
   btn.classList.toggle("active", added);

    const svg = btn.querySelector("svg");
    if (svg) {
      svg.style.fill = added ? "currentColor" : "none";
      svg.setAttribute("fill", added ? "currentColor" : "none");
    }
    toast(added ? "Added to your collection" : "Removed from collection");
  });
})();
