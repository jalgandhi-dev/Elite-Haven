/* Minimal helper for dashboard pages — inquiry rendering + tab highlight */
(async function () {
  const { loadInquiries, getSession } = window.EH;

  let statusUpdateInProgress = false;

  // Utility for badge styling based on inquiry status.
  function statusClass(status) {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "new") return "pill gold";
    if (normalized === "contacted") return "pill blue";
    if (normalized === "scheduled" || normalized === 'site visit scheduled') return "pill green";
    if (normalized === "negotiation") return "pill purple";
    if (normalized === "closed") return "pill gray";
    if (normalized === "rejected") return "pill red";
    return "pill";
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function getAvailableTabs() {
    return Array.from(document.querySelectorAll('.dash-side nav a[data-tab]'))
      .map(a => a.getAttribute('data-tab'))
      .filter(Boolean);
  }

  function getTabFromHash() {
    const hash = (window.location.hash || '').replace('#', '').trim();
    const tabs = getAvailableTabs();
    return tabs.includes(hash) ? hash : null;
  }

  function activateTab(tabName, replace = false) {
    const tabs = getAvailableTabs();
    if (!tabs.includes(tabName)) {
      tabName = tabs[0] || 'properties';
    }
    document.querySelectorAll('.dash-side nav a').forEach(x => x.classList.toggle('active', x.getAttribute('data-tab') === tabName));
    document.querySelectorAll('section[data-tab-panel]').forEach(section => section.classList.toggle('active', section.getAttribute('data-tab-panel') === tabName));
    const newHash = `#${tabName}`;
    if (replace) {
      history.replaceState(null, '', newHash);
    } else {
      history.pushState(null, '', newHash);
    }
  }

  async function renderInquiries() {
    const session = getSession();
    const agentId = session?.id;
    const body = document.getElementById("agentInquiriesBody");
    if (!body) return;

    const inquiries = await loadInquiries();
    const assigned = agentId ? inquiries.filter(i => String(i.agentId) === String(agentId)) : [];
    assigned.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (!assigned.length) {
      body.innerHTML = `<tr><td colspan="5">No inquiries received yet.</td></tr>`;
      return;
    }

    body.innerHTML = assigned.map((inquiry) => {
      const cur = inquiry.status || 'New';
      const safeId = inquiry.id || inquiry.inquiryId || '';
      return `
      <tr data-id="${safeId}">
        <td>${inquiry.customerName || "—"}</td>
        <td>${inquiry.propertyTitle || "—"}</td>
        <td>${formatDate(inquiry.createdAt)}</td>
        <td><span class="${statusClass(cur)}">${cur}</span></td>
        <td>
          <div class="action-control">
            <select class="inq-status-select" data-id="${safeId}">
              ${['New','Contacted','Scheduled','Negotiation','Closed','Rejected'].map(s => `<option value="${s}" ${s===cur? 'selected' : ''}>${s}</option>`).join('')}
            </select>
            <button class="btn btn--small contact-btn" type="button" data-email="${encodeURIComponent(inquiry.customerEmail || "")}" data-name="${encodeURIComponent(inquiry.customerName || "Client")}">Contact</button>
          </div>
        </td>
      </tr>`;
    }).join("");
  }

  renderInquiries();

  document.addEventListener('click', (e) => {
    const button = e.target.closest('.contact-btn');
    if (!button) return;
    e.preventDefault();
    e.stopPropagation();
    const email = button.dataset.email;
    const name = decodeURIComponent(button.dataset.name || 'Client');
    if (email) {
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(`Follow-up on your inquiry, ${name}`)}`;
    }
  });

  document.addEventListener('change', async (e) => {
    const sel = e.target;
    if (!sel.classList.contains('inq-status-select')) return;
    if (statusUpdateInProgress) return;

    e.preventDefault();
    e.stopPropagation();

    const id = sel.getAttribute('data-id');
    const newStatus = sel.value;
    if (!id) return;

    statusUpdateInProgress = true;
    try {
      sel.disabled = true;
      await fetch(`http://elite-haven.onrender.com/inquiries/${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      window.EH.toast('Inquiry status updated');
      window.dispatchEvent(new Event('inquiries:updated'));
      window.EH._inquiryCache = null;
      await renderInquiries();
      activateTab('inquiries', true);
    } catch (err) {
      console.error('Failed to update inquiry status', err);
      window.EH.toast('Failed to update status');
    } finally {
      sel.disabled = false;
      statusUpdateInProgress = false;
    }
  });

  document.querySelectorAll('.dash-side nav a').forEach(a => {
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href') || '';
      const dataTab = a.getAttribute('data-tab') || '';
      if (!href.startsWith('#')) return;
      e.preventDefault();
      if (statusUpdateInProgress) return;
      activateTab(dataTab);
    });
  });

  function initializeTabs() {
    const hashTab = getTabFromHash();
    if (hashTab) {
      activateTab(hashTab, true);
      return;
    }
    const activeLink = document.querySelector('.dash-side nav a.active');
    if (activeLink) {
      const dataTab = activeLink.getAttribute('data-tab') || 'overview';
      activateTab(dataTab, true);
      return;
    }
    activateTab('properties', true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTabs);
  } else {
    initializeTabs();
  }
})();
