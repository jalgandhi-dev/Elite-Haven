/* Property inquiry helpers and detail renderer */
window.EH = window.EH || {};
window.EH.INQUIRY_API_URL = "https://elite-haven.onrender.com/inquiries"; // Unified JSON Server inquiries endpoint
window.EH.generateId = function (prefix = "inq") {
  if (window.crypto?.randomUUID) return `${prefix}_${window.crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

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

function initPropertyPage() {
  if (!document.querySelector('[data-testid="page-property-detail"]')) {
    // Only run the detail renderer on the property detail page.
    return;
  }

  (async function () {
  const { fmtPriceDetail, fmtArea, Wishlist, toast } = window.EH;
  const session = window.EH.getSession();
  const data = await window.EH.loadProperties();
  await window.EH.Wishlist.refresh();
  
  
  const params = new URLSearchParams(location.search);
  const id = params.get("id") || data[0].id;
  const p = data.find(x => String(x.id) === String(id)) || data[0];
  p.id = String(p.id || p.propertyId || "");
  document.title = `${p.title} — Elite Haven`;

  const defaultAgent = {
    name: 'Elite Haven Advisor',
    title: 'Senior Advisor',
    phone: '+91 310 555 0100',
    email: 'jal@elitehaven.lux',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80'
  };

  p.amenities = Array.isArray(p.amenities) && p.amenities.length
    ? p.amenities
    : ['Private pool', '24/7 concierge', 'Terrace views'];
  p.city = p.city || p.location || 'Unknown City';
  p.country = p.country || 'USA';
  p.address = p.address || `${p.city}, ${p.country}`;
  p.lat = p.lat || 20.5937;
  p.lng = p.lng || 78.9629;
  p.bhk = p.bhk || p.bedrooms || p.beds || 0;
  p.bathrooms = p.bathrooms || p.baths || 0;
  p.area = Number(p.area || 0);
  p.areaUnit = p.areaUnit || 'sqft';
  p.tagline = p.tagline || (p.description ? p.description.slice(0, 120) : '');
  p.images = Array.isArray(p.images) ? p.images : (p.images ? [p.images] : []);
  p.coverImage = p.coverImage || (p.images.length ? p.images[0] : 'https://images.unsplash.com/photo-1494526585095-c41746248156?w=1200&q=80');
  p.agent = p.agent || {};
  p.agent.name = p.agent.name || defaultAgent.name;
  p.agent.email = p.agent.email || defaultAgent.email;
  p.agent.phone = p.agent.phone || defaultAgent.phone;
  p.agent.avatar = p.agent.avatar || defaultAgent.avatar;
  p.agent.title = p.agent.title || defaultAgent.title;
  p.verified = p.verified || false;

  const main = document.getElementById("propertyMain");
  const saved = Wishlist.has(p.id);

  const galleryImages = [p.coverImage, ...p.images]
    .filter((src, idx, arr) => src && arr.indexOf(src) === idx);

  while (galleryImages.length < 5) {
    galleryImages.push(galleryImages[galleryImages.length - 1] || p.coverImage);
  }

  const galleryHtml = `
    <div class="prop-gallery" data-testid="property-gallery">
      <div class="prop-gallery__main" data-idx="0">
        <img id="galleryMainImg" src="${galleryImages[0]}" alt="${p.title}" />
      </div>
      <div class="prop-gallery__thumbs">
        ${galleryImages.map((src, idx) => `
          <button class="prop-gallery__thumb ${idx === 0 ? 'active' : ''}" type="button" data-idx="${idx}" data-src="${src}" aria-label="View image ${idx + 1}">
            <img src="${src}" alt="${p.title} image ${idx + 1}" />
          </button>
        `).join("")}
      </div>
    </div>`;

  const amenitiesHtml = p.amenities.map(a => `
    <div class="amenity"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12l5 5L20 7"/></svg> ${a}</div>
  `).join("");

  main.innerHTML = `
    ${galleryHtml}
    <div class="detail-head reveal">
      <div>
        <div class="loc">${p.city} · ${p.country}</div>
        <h1 data-testid="property-title">${p.title}</h1>
        <p class="muted" style="max-width:620px">${p.tagline}</p>
        <div class="tag-row" style="margin-top:14px">
          <span class="tag">${p.type}</span>
          <span class="tag">${p.status}</span>
          ${p.verified ? '<span class="tag">Verified</span>' : ''}
        </div>
      </div>
      <div class="price">
        <div class="amt" data-testid="property-price" data-price="${p.price}" data-status="${p.status}">${fmtPriceDetail(p.price, p.status)}</div>
        <div class="per">${p.status === "For Rent" ? "Monthly" : "Asking"}</div>
        <button class="btn ${saved ? 'btn--solid' : ''} card__heart-inline" id="propSave" data-testid="property-save-btn" style="margin-top:16px;padding:14px 22px">
          ${saved ? '★ Saved' : '☆ Save'}
        </button>
      </div>
    </div>

    <div class="detail-stats reveal" data-testid="property-stats">
      <div class="stat"><div class="label">Bedrooms</div><div class="value" data-stat="bedrooms" data-value="${p.bhk}">${session && session.id ? p.bhk : '—'}</div></div>
      <div class="stat"><div class="label">Bathrooms</div><div class="value" data-stat="bathrooms" data-value="${p.bathrooms}">${session && session.id ? p.bathrooms : '—'}</div></div>
      <div class="stat"><div class="label">Area</div><div class="value" data-stat="area" data-value="${p.area}">${session && session.id ? new Intl.NumberFormat("en-US").format(p.area) + `<span style=\"font-size:13px;color:var(--muted);margin-left:6px;letter-spacing:.2em;text-transform:uppercase\">${p.areaUnit}</span>` : '—'}</div></div>
      <div class="stat"><div class="label">Year Built</div><div class="value" data-stat="yearBuilt" data-value="${p.yearBuilt || ''}">${session && session.id ? (p.yearBuilt || '—') : '—'}</div></div>
    </div>

    ${p.status !== "For Rent" ? `
    <div class="detail-section reveal" style="background: linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); border: 1px solid rgba(200,168,106,0.12); padding: 32px; border-radius: 14px; margin: 36px 0;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:24px;height:24px;color:var(--gold);"><path d="M12 2v20M2 12h20"/></svg>
        <h3 style="margin:0;">EMI Calculator</h3>
      </div>
      <p style="color:var(--muted);margin-bottom:24px;">Estimate your monthly payment, total interest and total amount payable on this property.</p>
      <div class="form-grid two-col">
        <div class="field">
          <label for="propEmiPrice">Loan Amount</label>
          <input id=\"propEmiPrice\" type=\"number\" min=\"0\" step=\"1000\" placeholder=\"Property price minus down payment\" value=\"${session && session.id ? (p.price || '') : ''}\" />
        </div>
        <div class="field">
          <label for="propEmiRate">Interest Rate (% per year)</label>
          <input id="propEmiRate" type="number" min="0" step="0.01" placeholder="e.g. 7.25" value="7.5" />
        </div>
        <div class="field">
          <label for="propEmiTenure">Tenure (years)</label>
          <input id="propEmiTenure" type="number" min="1" step="1" placeholder="e.g. 20" value="20" />
        </div>
      </div>
      <div style="display:flex;gap:12px;margin-top:24px;">
        <button id="propEmiCalcBtn" class="btn btn--solid" type="button">Calculate EMI</button>
        <button id="propEmiResetBtn" class="btn btn--ghost" type="button">Reset</button>
      </div>
      <div class="calculator-summary" style="margin-top:24px;display:none;" id="propEmiResults">
        <div class="field">
          <label>Monthly EMI</label>
          <div class="result-value" id="propEmiOutput">-</div>
        </div>
        <div class="field">
          <label>Total Interest</label>
          <div class="result-value" id="propInterestOutput">-</div>
        </div>
        <div class="field">
          <label>Total Payable</label>
          <div class="result-value" id="propPayableOutput">-</div>
        </div>
      </div>
    </div>
    ` : ''}

    <div class="detail-grid">
      <div>
        <div class="detail-section reveal">
          <h3>About this residence</h3>
          <p style="color:var(--white);font-size:16px;line-height:1.8">${p.description}</p>
        </div>

        <div class="detail-section reveal">
          <h3>Amenities</h3>
          <div class="amenities-grid">${amenitiesHtml}</div>
        </div>

        <div class="detail-section reveal">
          <h3>Location</h3>
          <p>${p.address}</p>
          <iframe class="map-frame" data-testid="property-map"
            src="https://www.google.com/maps?q=${p.lat},${p.lng}&z=14&output=embed"
            loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        </div>

        <div class="detail-section reveal">
          <h3>Inquire about this property</h3>
          <form class="form-grid" id="propInquiry" data-testid="property-inquiry-form">
            <div class="form-row">
              <div class="field"><label>Full Name</label><input required name="name" type="text" data-testid="inquiry-name"/></div>
              <div class="field"><label>Email</label><input required name="email" type="email" data-testid="inquiry-email"/></div>
            </div>
            <div class="form-row">
              <div class="field"><label>Phone</label><input name="phone" type="tel" data-testid="inquiry-phone"/></div>
              <div class="field"><label>Preferred Date</label><input name="date" type="date" data-testid="inquiry-date"/></div>
            </div>
            <div class="form-row">
              <div class="field"><label>Preferred Time</label><input name="time" type="time" data-testid="inquiry-time"/></div>
              <div class="field"><label>Visit Type</label>
                <select name="visitType" data-testid="inquiry-visit-type">
                  <option value="Site Visit">Site Visit</option>
                  <option value="Virtual Tour">Virtual Tour</option>
                  <option value="Phone Consultation">Phone Consultation</option>
                </select>
              </div>
            </div>
            <div class="field"><label>Message</label><textarea required name="message" placeholder="Tell us a little about your brief..." data-testid="inquiry-message"></textarea></div>
            <button class="btn btn--solid btn--lg" type="submit" data-testid="inquiry-submit">Send Inquiry <span class="arrow">&rarr;</span></button>
          </form>
        </div>
      </div>

      <aside>
        <div class="sidebar-card reveal">
          <h4>Your Advisor</h4>
          <div class="agent-block">
            <img src="${p.agent.avatar}" alt="${p.agent.name}"/>
            <div>
              <div class="name">${p.agent.name}</div>
              <div class="title">${p.agent.title}</div>
            </div>
          </div>
          <a href="tel:${p.agent.phone}" class="btn btn--block" data-testid="agent-call-btn">Call ${p.agent.phone}</a>
          <a href="mailto:${p.agent.email}?subject=${encodeURIComponent('Inquiry: ' + p.title)}" class="btn btn--solid btn--block" style="margin-top:12px" data-testid="agent-email-btn">Email Advisor</a>
          <button class="btn btn--ghost btn--block" style="margin-top:12px" id="bookVisit" data-testid="book-visit-btn">Book a Site Visit</button>

          <div style="margin-top:28px;padding-top:24px;border-top:1px solid var(--line)">
            <h4 style="font-size:14px">Quick Facts</h4>
            <div style="font-size:13px;color:var(--muted);line-height:2">
              <div><span style="color:var(--gold)">Reference</span> · ${String(p.id).toUpperCase()}</div>
              <div><span style="color:var(--gold)">Listing</span> · ${p.status}</div>
              <div><span style="color:var(--gold)">Verified</span> · ${p.verified ? "Yes" : "No"}</div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  `;

  // Similar properties scoring: location high, type medium, price medium, status match required for sale/rent
  const targetCity = String(p.city || p.location || '').trim().toLowerCase();
  const targetCountry = String(p.country || '').trim().toLowerCase();
  const targetType = String(p.type || '').trim().toLowerCase();
  const targetStatus = String(p.status || '').trim().toLowerCase();
  const targetPrice = Number(p.price || 0);

  function computeSimilarityScore(item) {
    let score = 0;
    const itemCity = String(item.city || item.location || '').trim().toLowerCase();
    const itemCountry = String(item.country || '').trim().toLowerCase();
    const itemType = String(item.type || '').trim().toLowerCase();
    const itemStatus = String(item.status || '').trim().toLowerCase();
    const itemPrice = Number(item.price || 0);

    if (targetCity && itemCity && targetCity === itemCity) {
      score += 100;
    } else if (targetCountry && itemCountry && targetCountry === itemCountry) {
      score += 60;
    }

    if (targetType && itemType && targetType === itemType) {
      score += 30;
    }

    if (targetPrice > 0 && itemPrice > 0) {
      const diff = Math.abs(targetPrice - itemPrice) / targetPrice;
      if (diff <= 0.1) score += 35;
      else if (diff <= 0.2) score += 20;
      else if (diff <= 0.3) score += 10;
    }

    if (targetStatus && itemStatus && targetStatus === itemStatus && (targetStatus === 'for sale' || targetStatus === 'for rent')) {
      score += 20;
    }

    return score;
  }

  const similar = data
    .filter(x => String(x.id) !== String(p.id))
    .map(item => ({ item, score: computeSimilarityScore(item) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ item }) => item);

  document.getElementById("similarGrid").innerHTML = similar.map(window.EH.renderCard).join("");
  try { window.EH.updatePrices(); } catch (e) { /* ignore */ }
  
  
  // Set up reveal animation for similar cards
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll("#similarGrid .reveal").forEach(el => io.observe(el));

  // Save button
  document.getElementById("propSave").addEventListener("click", async () => {
    const added = await Wishlist.toggle(p.id);
    const btn = document.getElementById("propSave");
    btn.classList.toggle("btn--solid", added);
    btn.innerHTML = added ? "★ Saved" : "☆ Save";
    toast(added ? "Added to your collection" : "Removed from collection");
  });

  // Inquiry submit
  document.getElementById("propInquiry").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const session = window.EH.getSession();
    const preferredDate = fd.get("date")?.trim() || null;
    const preferredTime = fd.get("time")?.trim() || null;
    const visitType = fd.get("visitType")?.trim() || "Site Visit";
    const inquiryPayload = {
      inquiryId: window.EH.generateId("inquiry"),
      propertyId: p.id,
      propertyTitle: p.title,
      agentId: p.agent.id || "unknown",
      agentName: p.agent.name,
      customerName: fd.get("name").trim(),
      customerEmail: fd.get("email").trim(),
      customerPhone: fd.get("phone").trim(),
      userId: session?.id || null,
      preferredDate,
      preferredTime,
      visitType,
      message: fd.get("message").trim(),
      status: preferredDate ? "Scheduled" : "New",
      createdAt: new Date().toISOString()
    };

    try {
      // Save inquiry to the inquiries JSON Server endpoint.
      await window.EH.createInquiry(inquiryPayload);
      window.dispatchEvent(new Event('inquiries:updated'));
      form.reset();
      toast("Inquiry sent successfully. Your advisor will reach out soon.");
    } catch (err) {
      toast("Unable to submit inquiry right now. Please try again later.");
      console.error("Inquiry submit failed:", err);
    }
  });

  document.getElementById("bookVisit").addEventListener("click", () => {
    document.getElementById("propInquiry").scrollIntoView({ behavior: "smooth", block: "center" });
    toast("Complete the form below to book your visit.");
  });

  // Lightbox
  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lbImg");
  let lbIdx = 0;
  function showLb(i) {
    lbIdx = (i + galleryImages.length) % galleryImages.length;
    lbImg.src = galleryImages[lbIdx];
    lb.classList.add("show");
  }

  const mainImg = document.getElementById("galleryMainImg");
  const thumbButtons = document.querySelectorAll(".prop-gallery__thumb");

  thumbButtons.forEach((thumb) => {
    thumb.addEventListener("click", () => {
      const idx = parseInt(thumb.dataset.idx, 10);
      const src = thumb.dataset.src;
      if (!Number.isFinite(idx) || !src) return;
      mainImg.src = src;
      mainImg.closest('.prop-gallery__main').dataset.idx = idx;
      thumbButtons.forEach(btn => btn.classList.toggle("active", btn === thumb));
    });
  });

  if (mainImg) {
    mainImg.addEventListener("click", () => showLb(parseInt(mainImg.closest('.prop-gallery__main').dataset.idx, 10) || 0));
  }

  document.getElementById("lbClose").addEventListener("click", () => lb.classList.remove("show"));
  document.getElementById("lbPrev").addEventListener("click", () => showLb(lbIdx - 1));
  document.getElementById("lbNext").addEventListener("click", () => showLb(lbIdx + 1));
  lb.addEventListener("click", (e) => { if (e.target === lb) lb.classList.remove("show"); });
  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("show")) return;
    if (e.key === "Escape") lb.classList.remove("show");
    if (e.key === "ArrowLeft") showLb(lbIdx - 1);
    if (e.key === "ArrowRight") showLb(lbIdx + 1);
  });

  // EMI Calculator (for sale properties only)
  if (p.status !== "For Rent") {
    const propEmiPrice = document.getElementById("propEmiPrice");
    const propEmiRate = document.getElementById("propEmiRate");
    const propEmiTenure = document.getElementById("propEmiTenure");
    const propEmiCalcBtn = document.getElementById("propEmiCalcBtn");
    const propEmiResetBtn = document.getElementById("propEmiResetBtn");
    const propEmiOutput = document.getElementById("propEmiOutput");
    const propInterestOutput = document.getElementById("propInterestOutput");
    const propPayableOutput = document.getElementById("propPayableOutput");
    const propEmiResults = document.getElementById("propEmiResults");

    function formatCurrency(value) {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
    }

    function calculatePropEmi() {
      const loan = Number(propEmiPrice.value) || 0;
      const rate = Number(propEmiRate.value) || 0;
      const years = Number(propEmiTenure.value) || 0;

      if (!loan || loan <= 0 || !years || years <= 0) {
        propEmiResults.style.display = 'none';
        return;
      }

      const monthlyRate = rate / 100 / 12;
      const months = years * 12;
      let emi = 0;
      if (monthlyRate === 0) {
        emi = loan / months;
      } else {
        const factor = Math.pow(1 + monthlyRate, months);
        emi = loan * monthlyRate * factor / (factor - 1);
      }
      const totalPayable = emi * months;
      const totalInterest = totalPayable - loan;

      propEmiOutput.textContent = formatCurrency(Math.round(emi));
      propInterestOutput.textContent = formatCurrency(Math.round(totalInterest));
      propPayableOutput.textContent = formatCurrency(Math.round(totalPayable));
      propEmiResults.style.display = 'grid';
    }

    propEmiCalcBtn?.addEventListener('click', calculatePropEmi);
    propEmiResetBtn?.addEventListener('click', () => {
      propEmiPrice.value = session && session.id ? (p.price || '') : '';
      propEmiRate.value = '7.5';
      propEmiTenure.value = '20';
      propEmiResults.style.display = 'none';
    });
  }

  // Reveal
  document.querySelectorAll(".reveal").forEach(el => el.classList.add("in"));
})();
}

initPropertyPage();
