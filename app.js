const seedLeadsByCountry = {
  co: [
    {
      id: "co-101",
      name: "Maria Fernanda Ruiz",
      phone: "+57 320 555 1201",
      city: "Bogota",
      region: "Cundinamarca",
      address: "Calle 127 # 48-19, Apto 402",
      product: "Vital Core x 1",
      quantity: 1,
      value: 149000,
      status: "novo",
      updatedAt: "Hoje, 10:42",
    },
    {
      id: "co-102",
      name: "Juan Esteban Acosta",
      phone: "+57 301 882 5514",
      city: "Medellin",
      region: "Antioquia",
      address: "Cra. 65 # 29C-10",
      product: "Vital Core x 2",
      quantity: 2,
      value: 260000,
      status: "agendado",
      scheduledDate: "2026-04-28",
      updatedAt: "Hoje, 09:18",
    },
    {
      id: "co-103",
      name: "Luisa Valentina Mora",
      phone: "+57 311 772 4030",
      city: "Cali",
      region: "Valle del Cauca",
      address: "Av. 6N # 25-44",
      product: "Vital Core x 3",
      quantity: 3,
      value: 290000,
      status: "confirmado",
      updatedAt: "Hoje, 08:54",
    },
  ],
  ec: [
    {
      id: "ec-201",
      name: "Gerson Lourenco da Silva",
      phone: "+593 1 599 803 8637",
      city: "Quito",
      region: "Pichincha",
      address: "Rua Antonio Rupe Melchiori 145",
      product: "Vital Men x 1",
      quantity: 1,
      value: 39.99,
      status: "novo",
      updatedAt: "Hoje, 11:04",
    },
    {
      id: "ec-202",
      name: "Teodoro Isaias Veloz Castillo",
      phone: "+593 9 393 937 916",
      city: "Guayaquil",
      region: "Guayas",
      address: "Terminal Norte, local 38",
      product: "Vital Men x 3",
      quantity: 3,
      value: 95.99,
      status: "confirmado",
      updatedAt: "Hoje, 10:28",
    },
    {
      id: "ec-203",
      name: "Jose Ezequiel Aguirre Miranda",
      phone: "+593 9 786 659 928",
      city: "Quito",
      region: "Quito",
      address: "Mapasingue oeste",
      product: "Vital Men x 3",
      quantity: 3,
      value: 95.99,
      status: "atendendo",
      updatedAt: "Hoje, 09:41",
    },
  ],
};

const STORAGE_KEY = "maxlien-admin-leads-v1";
const PRICE_TABLE = {
  co: {
    1: 149000,
    2: 260000,
    3: 290000,
    6: 510000,
  },
  ec: {
    1: 39.99,
    2: 69.99,
    3: 95.99,
    6: 167.99,
  },
};
const PRODUCT_BASE = {
  co: "Vital Core",
  ec: "Vital Men",
};

const countryNames = {
  all: "Colombia + Equador",
  co: "Colombia",
  ec: "Equador",
};

const statusLabels = {
  novo: "novo",
  pendente: "pendente",
  atendendo: "atendendo",
  processado: "processado",
  agendado: "agendado",
  retirada_agencia: "retiro em agencia",
  confirmado: "confirmado",
  entregue: "entregue",
  cancelado: "cancelado",
  devolvido: "devolvido",
};

let currentCountry = "all";
let currentSearch = "";
let currentStatus = "all";
let currentQuickFilter = "all";

const tableBody = document.getElementById("lead-table-body");
const searchInput = document.getElementById("search-input");
const statusFilter = document.getElementById("status-filter");
const metricLeads = document.getElementById("metric-leads");
const metricProgress = document.getElementById("metric-progress");
const metricScheduled = document.getElementById("metric-scheduled");
const metricConfirmed = document.getElementById("metric-confirmed");
const drawer = document.getElementById("lead-drawer");
const drawerKicker = document.getElementById("drawer-kicker");
const drawerTitle = document.getElementById("drawer-title");
const drawerCopy = document.getElementById("drawer-copy");
const leadForm = document.getElementById("lead-form");
const newLeadButton = document.getElementById("new-lead-button");
const exportButton = document.getElementById("export-button");
const resetButton = document.getElementById("reset-button");
const quickFilters = document.getElementById("quick-filters");
const countryStatusCo = document.getElementById("country-status-co");
const countryStatusEc = document.getElementById("country-status-ec");
const activeCountryPill = document.getElementById("active-country-pill");
const statusPicker = document.getElementById("status-picker");
const statusTrigger = document.getElementById("status-trigger");
const statusMenu = document.getElementById("status-menu");
const statusTriggerLabel = document.getElementById("status-trigger-label");
const scheduledDateField = document.getElementById("scheduled-date-field");
const futureNote = document.getElementById("future-note");
const formFeedback = document.getElementById("form-feedback");

const formFields = {
  id: document.getElementById("lead-id"),
  country: document.getElementById("field-country"),
  name: document.getElementById("field-name"),
  phone: document.getElementById("field-phone"),
  city: document.getElementById("field-city"),
  region: document.getElementById("field-region"),
  address: document.getElementById("field-address"),
  product: document.getElementById("field-product"),
  quantity: document.getElementById("field-quantity"),
  value: document.getElementById("field-value"),
  status: document.getElementById("field-status"),
  scheduledDate: document.getElementById("field-scheduled-date"),
};

let leadsByCountry = loadLeads();
const remoteStatus = {
  co: "down",
  ec: "up",
};

function cloneSeedData() {
  return JSON.parse(JSON.stringify(seedLeadsByCountry));
}

function loadLeads() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return cloneSeedData();
    }

    const parsed = JSON.parse(saved);
    if (!parsed || !Array.isArray(parsed.co) || !Array.isArray(parsed.ec)) {
      return cloneSeedData();
    }

    return parsed;
  } catch (error) {
    return cloneSeedData();
  }
}

function saveLeads() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leadsByCountry));
}

function exportLeads() {
  const payload = {
    exportedAt: new Date().toISOString(),
    leads: leadsByCountry,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateStamp = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = `maxlien-leads-${dateStamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function resetDemoLeads() {
  const confirmed = window.confirm(
    "Restaurar os dados demo e apagar os leads salvos neste navegador?"
  );

  if (!confirmed) {
    return;
  }

  leadsByCountry = cloneSeedData();
  syncLeadPricing();
  saveLeads();
  closeDrawer();
  renderTable();
}

function normalizeQuantity(quantity) {
  const allowed = [1, 2, 3, 6];
  const numeric = Number(quantity);
  return allowed.includes(numeric) ? numeric : 1;
}

function getPriceByCountryAndQuantity(country, quantity) {
  const normalizedCountry = country === "all" ? "ec" : country;
  const normalizedQuantity = normalizeQuantity(quantity);
  return PRICE_TABLE[normalizedCountry][normalizedQuantity];
}

function getProductLabel(country, quantity) {
  const normalizedCountry = country === "all" ? "ec" : country;
  const normalizedQuantity = normalizeQuantity(quantity);
  return `${PRODUCT_BASE[normalizedCountry]} x ${normalizedQuantity}`;
}

function syncLeadPricing() {
  ["co", "ec"].forEach((country) => {
    leadsByCountry[country] = leadsByCountry[country].map((lead) => {
      const quantity = normalizeQuantity(lead.quantity);
      return {
        ...lead,
        quantity,
        product: getProductLabel(country, quantity),
        value: getPriceByCountryAndQuantity(country, quantity),
      };
    });
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

function getVisibleCountries() {
  return currentCountry === "all" ? ["co", "ec"] : [currentCountry];
}

function getCountryEntries(countries = getVisibleCountries()) {
  return countries.flatMap((country) =>
    leadsByCountry[country].map((lead) => ({ ...lead, country }))
  );
}

function formatCurrency(value, country = currentCountry) {
  const baseCountry = country === "all" ? "ec" : country;
  const locale = baseCountry === "co" ? "es-CO" : "es-EC";
  const currency = baseCountry === "co" ? "COP" : "USD";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: baseCountry === "co" ? 0 : 2,
  }).format(value);
}

function formatTimestamp() {
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  return `Hoje, ${time}`;
}

function formatScheduledDate(value) {
  if (!value) return "Sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function getScheduleState(lead) {
  if (lead.status !== "agendado" || !lead.scheduledDate) return "none";

  const today = getTodayDateValue();
  if (lead.scheduledDate < today) return "overdue";
  if (lead.scheduledDate === today) return "today";
  return "future";
}

function syncFormPricing() {
  const country = formFields.country.value || "ec";
  const quantity = normalizeQuantity(formFields.quantity.value || 1);
  formFields.quantity.value = String(quantity);
  formFields.product.value = getProductLabel(country, quantity);
  formFields.value.value = formatCurrency(
    getPriceByCountryAndQuantity(country, quantity),
    country
  );
}

function formatStatusLabel(status) {
  return (statusLabels[status] || status)
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatusPriority(status) {
  const order = {
    agendado: 0,
    novo: 1,
    pendente: 2,
    atendendo: 3,
    processado: 4,
    retirada_agencia: 5,
    confirmado: 6,
    entregue: 7,
    devolvido: 8,
    cancelado: 9,
  };

  return order[status] ?? 99;
}

function getLeadSortValue(lead) {
  if (lead.status === "agendado" && lead.scheduledDate) {
    return new Date(`${lead.scheduledDate}T12:00:00`).getTime();
  }

  const numericId = Number(String(lead.id).split("-").pop());
  return Number.isFinite(numericId) ? -numericId : 0;
}

function sortLeads(leads) {
  return [...leads].sort((left, right) => {
    const byStatus = getStatusPriority(left.status) - getStatusPriority(right.status);
    if (byStatus !== 0) return byStatus;

    const leftValue = getLeadSortValue(left);
    const rightValue = getLeadSortValue(right);

    if (left.status === "agendado" && right.status === "agendado") {
      return leftValue - rightValue;
    }

    return rightValue - leftValue;
  });
}

function setFormFeedback(message = "") {
  formFeedback.hidden = !message;
  formFeedback.textContent = message;
}

function setStatusMenuOpen(isOpen) {
  statusMenu.hidden = !isOpen;
  statusTrigger.setAttribute("aria-expanded", String(isOpen));
}

function syncScheduleVisibility() {
  const isScheduled = formFields.status.value === "agendado";
  scheduledDateField.hidden = !isScheduled;
  futureNote.hidden = !isScheduled;
  formFields.scheduledDate.required = isScheduled;

  if (!isScheduled) {
    formFields.scheduledDate.value = "";
    formFields.scheduledDate.setCustomValidity("");
  }
}

function setFormStatus(status) {
  formFields.status.value = status;
  statusTrigger.className = `status-trigger status-${status}`;
  statusTriggerLabel.textContent = formatStatusLabel(status);
  document.querySelectorAll("[data-status-option]").forEach((button) => {
    button.classList.toggle("active", button.dataset.statusOption === status);
  });
  syncScheduleVisibility();
  setStatusMenuOpen(false);
}

function getFilteredLeads() {
  const query = currentSearch.trim().toLowerCase();

  return sortLeads(getCountryEntries()).filter((lead) => {
    const matchesStatus =
      currentStatus === "all" ? true : lead.status === currentStatus;
    const scheduleState = getScheduleState(lead);
    const matchesQuickFilter =
      currentQuickFilter === "all"
        ? true
        : currentQuickFilter === "today"
          ? scheduleState === "today" || scheduleState === "overdue"
          : lead.status === currentQuickFilter;

    const haystack = [
      lead.name,
      lead.phone,
      lead.city,
      lead.region,
      lead.product,
      lead.address,
      countryNames[lead.country],
    ]
      .join(" ")
      .toLowerCase();

    return matchesStatus && matchesQuickFilter && haystack.includes(query);
  });
}

function renderMetrics() {
  const visibleLeads = getCountryEntries();
  metricLeads.textContent = visibleLeads.length;
  metricProgress.textContent = visibleLeads.filter(
    (lead) => lead.status === "atendendo"
  ).length;
  metricScheduled.textContent = visibleLeads.filter(
    (lead) => lead.status === "agendado"
  ).length;
  metricConfirmed.textContent = visibleLeads.filter(
    (lead) => lead.status === "confirmado"
  ).length;
}

function renderTable() {
  renderMetrics();

  const leads = getFilteredLeads();

  if (!leads.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="empty-state">Nenhum lead encontrado com esse filtro.</div>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = leads
    .map((lead) => {
      const safeName = escapeHtml(lead.name);
      const safePhone = escapeHtml(lead.phone);
      const safeAddress = escapeHtml(lead.address);
      const safeLocation = escapeHtml(`${lead.city} / ${lead.region}`);
      const safeStatus = escapeHtml(statusLabels[lead.status] || lead.status);
      const safeSchedule = escapeHtml(
        lead.status === "agendado"
          ? formatScheduledDate(lead.scheduledDate)
          : "-"
      );
      const scheduleState = getScheduleState(lead);
      const scheduleBadge =
        scheduleState === "today"
          ? '<span class="schedule-flag today">hoje</span>'
          : scheduleState === "overdue"
            ? '<span class="schedule-flag overdue">atrasado</span>'
            : "";

      return `
        <tr class="${lead.status === "agendado" ? "row-agendado" : ""} ${scheduleState === "today" ? "row-agenda-today" : ""} ${scheduleState === "overdue" ? "row-agenda-overdue" : ""}">
          <td class="client-cell single-line" data-label="Cliente" title="${safeName}">
            <strong>${safeName}</strong>
          </td>
          <td class="contact-cell single-line" data-label="Contato" title="${safePhone}">
            <strong>${safePhone}</strong>
          </td>
          <td class="location-cell single-line" data-label="Localizacao" title="${safeLocation}">
            <strong>${safeLocation}</strong>
          </td>
          <td class="address-cell" data-label="Endereco" title="${safeAddress}">
            <span>${safeAddress}</span>
          </td>
          <td class="qty-cell" data-label="Qtd">${lead.quantity}</td>
          <td class="value-cell" data-label="Valor">${formatCurrency(lead.value, lead.country)}</td>
          <td class="schedule-cell ${lead.status === "agendado" ? "is-active" : ""}" data-label="Agenda">${safeSchedule}${scheduleBadge}</td>
          <td class="status-cell" data-label="Status">
            <span class="status-pill ${lead.status}">${safeStatus}</span>
          </td>
          <td data-label="Acao">
            <div class="actions-cell">
              <button class="table-button" type="button" data-edit-id="${lead.id}">
                editar
              </button>
              <button class="danger-button" type="button" data-delete-id="${lead.id}">
                remover
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  document.querySelectorAll("[data-edit-id]").forEach((button) => {
    button.addEventListener("click", () => openDrawer(button.dataset.editId));
  });

  document.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", () => deleteLead(button.dataset.deleteId));
  });
}

function syncQuickFilters() {
  if (!quickFilters) return;

  quickFilters.querySelectorAll("[data-quick-filter]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.quickFilter === currentQuickFilter
    );
  });
}

function syncCountryButtons() {
  document.querySelectorAll("[data-country-target]").forEach((item) => {
    item.classList.toggle(
      "active",
      item.dataset.countryTarget === currentCountry
    );

    if (item.classList.contains("country-card")) {
      item.classList.toggle(
        "is-down",
        item.dataset.countryTarget === "co" && remoteStatus.co === "down"
      );
    }
  });

  if (!activeCountryPill) return;

  const pillLabels = {
    all: "modo: colombia + equador",
    co: "modo: colombia",
    ec: "modo: equador",
  };

  activeCountryPill.className = `active-country-pill ${currentCountry}`;
  activeCountryPill.textContent = pillLabels[currentCountry];
}

function setCountry(country) {
  currentCountry = country;
  syncCountryButtons();
  renderTable();
}

function resetForm() {
  leadForm.reset();
  setFormFeedback("");
  formFields.id.value = "";
  formFields.country.value = currentCountry === "all" ? "ec" : currentCountry;
  formFields.quantity.value = "1";
  setFormStatus("novo");
  formFields.scheduledDate.value = "";
  formFields.scheduledDate.min = new Date().toISOString().slice(0, 10);
  syncFormPricing();
}

function findLeadById(leadId) {
  return getCountryEntries(["co", "ec"]).find((item) => item.id === leadId);
}

function openDrawer(leadId) {
  const lead = findLeadById(leadId);
  if (!lead) return;

  setFormFeedback("");
  formFields.id.value = lead.id;
  formFields.country.value = lead.country;
  formFields.name.value = lead.name;
  formFields.phone.value = lead.phone;
  formFields.city.value = lead.city;
  formFields.region.value = lead.region;
  formFields.address.value = lead.address;
  formFields.product.value = lead.product;
  formFields.quantity.value = String(lead.quantity);
  setFormStatus(lead.status);
  formFields.scheduledDate.value = lead.scheduledDate || "";
  syncFormPricing();

  drawerKicker.textContent = "Editar lead";
  drawerTitle.textContent = lead.name;
  drawerCopy.textContent = `Atualize o cadastro de ${countryNames[lead.country]} sem sair da operacao.`;
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
}

function openCreateDrawer() {
  resetForm();
  drawerKicker.textContent = "Novo lead";
  drawerTitle.textContent =
    currentCountry === "all"
      ? "Novo lead para Colombia ou Equador"
      : `Novo lead para ${countryNames[currentCountry]}`;
  drawerCopy.textContent = "Cadastre um contato e ele entra na fila imediatamente.";
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  setFormFeedback("");
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
}

function getNextLeadId(country) {
  return `${country}-${Date.now()}`;
}

function deleteLead(leadId) {
  const lead = findLeadById(leadId);
  if (!lead) return;

  const confirmed = window.confirm(
    `Remover o lead ${lead.name} da fila de ${countryNames[lead.country]}?`
  );

  if (!confirmed) {
    return;
  }

  leadsByCountry[lead.country] = leadsByCountry[lead.country].filter(
    (item) => item.id !== leadId
  );
  saveLeads();
  renderTable();
}

function readFormLead() {
  return {
    id: formFields.id.value.trim(),
    country: formFields.country.value,
    name: formFields.name.value.trim(),
    phone: formFields.phone.value.trim(),
    city: formFields.city.value.trim(),
    region: formFields.region.value.trim(),
    address: formFields.address.value.trim(),
    product: getProductLabel(formFields.country.value, formFields.quantity.value),
    quantity: normalizeQuantity(formFields.quantity.value),
    value: getPriceByCountryAndQuantity(
      formFields.country.value,
      formFields.quantity.value
    ),
    status: formFields.status.value,
    scheduledDate: formFields.scheduledDate.value,
  };
}

function validateLeadForm(formLead) {
  if (!formLead.name || !formLead.phone || !formLead.city || !formLead.address) {
    return "Preencha nome, telefone, cidade e endereco antes de salvar.";
  }

  if (formLead.status === "agendado" && !formLead.scheduledDate) {
    return "Lead agendado precisa de uma data desejada para acompanhamento.";
  }

  return "";
}

document.querySelectorAll("[data-country-target]").forEach((item) => {
  item.addEventListener("click", () => {
    setCountry(item.dataset.countryTarget);
  });
});

countryStatusCo.textContent =
  remoteStatus.co === "down"
    ? "painel externo indisponivel, usando dados do unificado"
    : "operacao ativa dentro desta aba";

countryStatusEc.textContent =
  remoteStatus.ec === "down"
    ? "painel externo indisponivel, usando dados do unificado"
    : "operacao ativa dentro desta aba";

statusPicker.addEventListener("click", (event) => {
  const trigger = event.target.closest("#status-trigger");
  if (trigger) {
    const isOpen = statusTrigger.getAttribute("aria-expanded") === "true";
    setStatusMenuOpen(!isOpen);
    return;
  }

  const button = event.target.closest("[data-status-option]");
  if (!button) return;
  setFormStatus(button.dataset.statusOption);
});

document.addEventListener("click", (event) => {
  if (statusPicker.contains(event.target)) return;
  setStatusMenuOpen(false);
});

searchInput.addEventListener("input", (event) => {
  currentSearch = event.target.value;
  renderTable();
});

formFields.country.addEventListener("change", syncFormPricing);
formFields.quantity.addEventListener("change", syncFormPricing);

statusFilter.addEventListener("change", (event) => {
  currentStatus = event.target.value;
  renderTable();
});

quickFilters?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-quick-filter]");
  if (!button) return;
  currentQuickFilter = button.dataset.quickFilter;
  syncQuickFilters();
  renderTable();
});

newLeadButton.addEventListener("click", openCreateDrawer);
exportButton.addEventListener("click", exportLeads);
resetButton.addEventListener("click", resetDemoLeads);

document.querySelectorAll("[data-close-drawer]").forEach((item) => {
  item.addEventListener("click", closeDrawer);
});

leadForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formLead = readFormLead();
  const validationMessage = validateLeadForm(formLead);

  if (validationMessage) {
    setFormFeedback(validationMessage);
    return;
  }

  setFormFeedback("");
  let existingLead = null;
  let existingCountry = null;

  ["co", "ec"].some((country) => {
    const match = leadsByCountry[country].find((item) => item.id === formLead.id);
    if (!match) return false;
    existingLead = match;
    existingCountry = country;
    return true;
  });

  if (existingLead) {
    if (existingCountry !== formLead.country) {
      leadsByCountry[existingCountry] = leadsByCountry[existingCountry].filter(
        (item) => item.id !== formLead.id
      );
      leadsByCountry[formLead.country].unshift(existingLead);
    }

    existingLead.name = formLead.name;
    existingLead.phone = formLead.phone;
    existingLead.city = formLead.city;
    existingLead.region = formLead.region;
    existingLead.address = formLead.address;
    existingLead.product = formLead.product;
    existingLead.quantity = formLead.quantity;
    existingLead.value = formLead.value;
    existingLead.status = formLead.status;
    existingLead.scheduledDate =
      formLead.status === "agendado" ? formLead.scheduledDate : "";
    existingLead.updatedAt = formatTimestamp();
  } else {
    leadsByCountry[formLead.country].unshift({
      ...formLead,
      scheduledDate:
        formLead.status === "agendado" ? formLead.scheduledDate : "",
      id: getNextLeadId(formLead.country),
      updatedAt: formatTimestamp(),
    });
  }

  saveLeads();
  closeDrawer();
  renderTable();
});

syncLeadPricing();
saveLeads();
renderTable();
syncCountryButtons();
syncQuickFilters();
