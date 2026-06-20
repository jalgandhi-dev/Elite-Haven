(async function () {
  const countrySelect = document.getElementById('fCountry');
  const searchInput = document.getElementById('fSearch');
  const typeSelect = document.getElementById('fType');
  const statusSelect = document.getElementById('fStatus');
  const bhkSelect = document.getElementById('fBhk');
  const budgetSelect = document.getElementById('fBudget');
  const sortSelect = document.getElementById('fSort');
  const grid = document.getElementById('listingsGrid');
  const countEl = document.getElementById('resCount');
  const emptyState = document.getElementById('emptyState');

  function parseBudget(value) {
    if (!value) return null;
    const [min, max] = value.split('-').map(Number);
    return { min, max };
  }

  function getUniqueCitiesByCountry(properties, country) {
    if (!country) {
      return [...new Set(properties.map(p => p.city))].sort();
    }
    return [...new Set(properties.filter(p => p.country === country).map(p => p.city))].sort();
  }

  function updateCityDropdown(properties) {
    const country = countrySelect.value;
    const cities = getUniqueCitiesByCountry(properties, country);
    const currentCity = searchInput.value;
    
    searchInput.innerHTML = '<option value="">Select City</option>';
    cities.forEach(city => {
      const option = document.createElement('option');
      option.value = city;
      option.textContent = city;
      searchInput.appendChild(option);
    });
    
    // Restore previous city selection if it still exists
    if (currentCity && cities.includes(currentCity)) {
      searchInput.value = currentCity;
    } else {
      searchInput.value = '';
    }
  }

  function matchesFilter(property, filters) {
    if (filters.country && property.country !== filters.country) return false;
    if (filters.city && property.city !== filters.city) return false;
    if (filters.type && property.type !== filters.type) return false;
    if (filters.status && property.status !== filters.status) return false;
    if (filters.bhk && Number(property.bhk) < Number(filters.bhk)) return false;
    if (filters.budget) {
      if (property.price < filters.budget.min || property.price > filters.budget.max) return false;
    }
    return true;
  }

  function sortProperties(properties, sortKey) {
    return properties.slice().sort((a, b) => {
      if (sortKey === 'price-asc') return a.price - b.price;
      if (sortKey === 'price-desc') return b.price - a.price;
      if (sortKey === 'area-desc') return b.area - a.area;
      if (sortKey === 'recommended') return (b.featured === true) - (a.featured === true) || a.price - b.price;
      return 0;
    });
  }

  function getFilters() {
    return {
      country: countrySelect.value,
      city: searchInput.value.trim(),
      type: typeSelect.value,
      status: statusSelect.value,
      bhk: bhkSelect.value,
      budget: parseBudget(budgetSelect.value)
    };
  }

  function renderResults(properties) {
    const results = sortProperties(properties.filter(p => matchesFilter(p, getFilters())), sortSelect.value);
    countEl.textContent = results.length;
    if (results.length === 0) {
      grid.innerHTML = '';
      emptyState.style.display = 'block';
    } else {
      emptyState.style.display = 'none';
      grid.innerHTML = results.map(window.EH.renderCard).join('');
      try { window.EH.updatePrices(); } catch (e) { /* ignore */ }
      // Set up reveal animation for newly rendered cards
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
      }, { threshold: 0.12 });
      grid.querySelectorAll(".reveal").forEach(el => io.observe(el));
    }
  }

  function syncFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const country = params.get('country');
    const city = params.get('city');
    const type = params.get('type');
    const status = params.get('status');
    const budget = params.get('budget');
    if (country) countrySelect.value = country;
    if (city) searchInput.value = city;
    if (type) typeSelect.value = type;
    if (status) statusSelect.value = status;
    if (budget) budgetSelect.value = budget;
  }

  const properties = await window.EH.loadProperties();
  await window.EH.Wishlist.refresh();
  syncFromUrl();
  updateCityDropdown(properties);
  renderResults(properties);

  countrySelect.addEventListener('change', () => {
    updateCityDropdown(properties);
    renderResults(properties);
  });

  // Apply filters immediately when controls change (no Apply button)
  [searchInput, typeSelect, statusSelect, bhkSelect, budgetSelect, sortSelect].forEach(el => {
    if (!el) return;
    el.addEventListener('change', () => renderResults(properties));
  });

  // Support Enter key on inputs to trigger filtering
  [searchInput, typeSelect, statusSelect, bhkSelect, budgetSelect].forEach(el => el.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      renderResults(properties);
    }
  }));
})();
