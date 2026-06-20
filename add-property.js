// ==========================
// Add Property (URL-only images)
// ==========================

// Load sessioned agent info into the form
function initializeAgentSession() {
  const agent = window.EH.getSession() || { name: "Advisor", email: "advisor@elitehaven.lux" };
  const sidebarAgentName = document.getElementById("agentName");
  if (sidebarAgentName) sidebarAgentName.textContent = agent.name || "Advisor";

  const agentNameInput = document.querySelector('[name="agentName"]');
  if (agentNameInput) { agentNameInput.value = agent.name || "Advisor"; agentNameInput.readOnly = true; }

  const agentEmailInput = document.querySelector('[name="agentEmail"]');
  if (agentEmailInput) { agentEmailInput.value = agent.email || ""; agentEmailInput.readOnly = true; }

  const agentPhoneInput = document.querySelector('[name="agentPhone"]');
  if (agentPhoneInput) agentPhoneInput.value = agent.phone || "";
}
initializeAgentSession();

let editingProperty = null;
const editPropertyId = new URLSearchParams(window.location.search).get('id');

async function loadEditProperty() {
  if (!editPropertyId) return null;
  try {
    const all = await window.EH.loadAllProperties();
    const property = all.find(p => String(p.id) === String(editPropertyId) || String(p.propertyId) === String(editPropertyId));
    return property || null;
  } catch (err) {
    console.warn('Failed to load property for edit', err);
    return null;
  }
}

function setFormValue(name, value) {
  const el = document.querySelector(`[name="${name}"]`);
  if (!el) return;
  if (el.type === 'checkbox') return;
  el.value = value || '';
}

function setCheckboxValues(name, values) {
  document.querySelectorAll(`input[name="${name}"]`).forEach((el) => {
    el.checked = values.includes(el.value);
  });
}

async function populateEditForm() {
  const property = await loadEditProperty();
  if (!property) return;
  editingProperty = property;

  setFormValue('title', property.title);
  setFormValue('type', property.type);
  setFormValue('price', property.price);
  setFormValue('city', property.city);
  setFormValue('address', property.address);
  setFormValue('description', property.description);
  setFormValue('beds', property.bhk || property.bedrooms || property.beds);
  setFormValue('baths', property.bathrooms || property.baths);
  setFormValue('area', property.area);
  setFormValue('parking', property.parking);
  setFormValue('furnish', property.furnish);
  setFormValue('status', property.status);
  setFormValue('coverImage', property.coverImage);
  setFormValue('maplink', property.maplink);
  setFormValue('nearby', property.nearby);
  setFormValue('agentName', property.agentName || property.agent?.name);
  setFormValue('agentPhone', property.agentPhone || property.agent?.phone);
  setFormValue('agentEmail', property.agentEmail || property.agent?.email);
  setCheckboxValues('amenities', Array.isArray(property.amenities) ? property.amenities : []);

  const galleryInputs = Array.from(document.querySelectorAll('input[name="images"]'));
  const images = Array.isArray(property.images) ? property.images : property.images ? [property.images] : [];
  galleryInputs.forEach((input, index) => {
    input.value = images[index] || '';
  });

  const heading = document.querySelector('.dash-head h2');
  if (heading) heading.textContent = 'Edit Property';
  document.getElementById('publishBtn').textContent = 'Update Property';
  document.getElementById('publishBtn2').textContent = 'Update Property';
}

populateEditForm();

// Collect form data into normalized property object
function collect() {
  const form = document.getElementById("addPropertyForm");
  const fd = new FormData(form);
  const obj = {};
  for (const [k, v] of fd.entries()) {
    if (obj[k]) obj[k] = Array.isArray(obj[k]) ? obj[k].concat(v) : [obj[k], v];
    else obj[k] = v;
  }

  const amenities = Array.from(document.querySelectorAll('input[name="amenities"]:checked')).map(el => el.value);
  const title = (obj.title || "").toString().trim();
  const description = (obj.description || "").toString().trim();
  const city = (obj.city || "").toString().trim();
  const address = (obj.address || "").toString().trim();
  const location = city || address || "Unknown Location";

  // Normalize images (multiple inputs named `images` produce obj.images as array or single string)
  let imgs = [];
  if (obj.images) imgs = Array.isArray(obj.images) ? obj.images : [obj.images];
  imgs = imgs.map(s => (s || "").toString().trim()).filter(Boolean).slice(0,5);
  const cover = (obj.coverImage || "").toString().trim() || null;

  return {
    title,
    price: Number(obj.price || 0),
    location,
    city,
    country: obj.country || "USA",
    address,
    type: obj.type || "Villa",
    status: obj.status || "For Sale",
    description,
    tagline: description ? description.slice(0, 120) : "",
    bedrooms: Number(obj.beds || obj.bedrooms || 0),
    bhk: Number(obj.beds || obj.bedrooms || 0),
    bathrooms: Number(obj.baths || obj.bathrooms || 0),
    area: Number(obj.area || 0),
    areaUnit: "sqft",
    parking: obj.parking || "Garage",
    furnish: obj.furnish || "Furnished",
    amenities,
    coverImage: cover,
    images: imgs,
    maplink: obj.maplink || "",
    nearby: obj.nearby || "",
    agentName: obj.agentName || "",
    agentPhone: obj.agentPhone || "",
    agentEmail: obj.agentEmail || "",
    featured: false,
    verified: false
  };
}

function isValidUrl(u) {
  try { const url = new URL(u); return url.protocol === 'http:' || url.protocol === 'https:'; } 
  catch (e) { return false; }
}

async function publishProperty() {
  const form = document.getElementById("addPropertyForm");
  if (!form.checkValidity()) { form.reportValidity(); return; }

  try {
    const property = collect();
    const session = window.EH.getSession();

    // Basic validation
    if (!property.title || !property.price) { window.EH.toast('Title and Price are required'); return; }
    if (!property.coverImage || !isValidUrl(property.coverImage)) { window.EH.toast('Please provide a valid Cover Image URL'); return; }
    for (const u of property.images) { if (!isValidUrl(u)) { window.EH.toast('One or more gallery URLs are invalid'); return; } }

    // Ensure agent ID is always set
    const agentId = session?.id || editingProperty?.agent?.id;
    if (!agentId && !editingProperty) {
      window.EH.toast('Please log in as an agent to add properties');
      return;
    }

    property.createdAt = editingProperty?.createdAt || new Date().toISOString();
    property.agent = {
      id: agentId || "",
      name: session?.name || property.agentName || editingProperty?.agent?.name || "Advisor",
      email: session?.email || property.agentEmail || editingProperty?.agent?.email || "",
      phone: session?.phone || property.agentPhone || editingProperty?.agent?.phone || "",
      role: session?.role || editingProperty?.agent?.role || "agent"
    };

    if (!editingProperty) {
      property.verified = false;
      property.reviewStatus = 'pending';
      property.reviewNotes = [];
    } else {
      property.verified = editingProperty.verified;
      property.reviewStatus = editingProperty.reviewStatus;
      property.reviewNotes = editingProperty.reviewNotes;
    }

    const saveRes = await fetch(editingProperty ? `https://elite-haven.onrender.com/properties${encodeURIComponent(editingProperty.id)}` : "https://elite-haven.onrender.com/properties", {
      method: editingProperty ? 'PATCH' : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(property)
    });

    
    if (!saveRes.ok) {
      const text = await saveRes.text();
      console.error('Failed to save property:', text);
      window.EH.toast('Unable to publish property. See console for details.');
      return;
    }

    const created = await saveRes.json();
    if (!editingProperty && created && created.id) {
      try {
        await fetch(`https://elite-haven.onrender.com/properties/${created.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ propertyId: created.id })
        });
      } catch (e) { console.warn('Failed to patch propertyId:', e); }
    }

    localStorage.removeItem('eh_draft');
    if (window.EH && typeof window.EH.invalidateProperties === 'function') window.EH.invalidateProperties();

    window.EH.toast(editingProperty ? 'Property updated successfully' : 'Property Published Successfully');
    window.location.href = 'listings.html';

  } catch (err) {
    console.error('Publish failed:', err);
    window.EH.toast('Unable to publish property');
  }
}

function saveDraft() {
  localStorage.setItem('eh_draft', JSON.stringify(collect()));
  window.EH.toast('Draft Saved');
}

// Event listeners
document.getElementById('saveDraft')?.addEventListener('click', saveDraft);
document.getElementById('saveDraft2')?.addEventListener('click', saveDraft);
document.getElementById('publishBtn')?.addEventListener('click', publishProperty);
document.getElementById('publishBtn2')?.addEventListener('click', publishProperty);

document.getElementById('previewBtn')?.addEventListener('click', () => {
  localStorage.setItem('eh_preview', JSON.stringify(collect()));
  window.open('property.html', '_blank');
});

// add-property.js loaded
