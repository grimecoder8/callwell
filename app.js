const storageKey = "callwell-local-data-v1";
const sampleContacts = [
  { id: "c-1", name: "Fidel Obura", phone: "+1 202 555 0101", label: "Family" },
  { id: "c-2", name: "Noah Williams", phone: "+1 202 555 0102", label: "Work" },
  { id: "c-3", name: "Ava Chen", phone: "+1 202 555 0103", label: "Design team" },
  { id: "c-4", name: "Ethan Parker", phone: "+1 202 555 0104", label: "Friend" },
  { id: "c-5", name: "Sofia Martinez", phone: "+1 202 555 0105", label: "Family" },
  { id: "c-6", name: "Northstar Delivery", phone: "+1 202 555 0199", label: "Business" },
];
const sampleCalls = [
  { id: "r-1", phone: "+1 202 555 0101", direction: "incoming", timestamp: Date.now() - 12 * 60 * 1000, duration: 248 },
  { id: "r-2", phone: "+1 202 555 0102", direction: "outgoing", timestamp: Date.now() - 52 * 60 * 1000, duration: 96 },
  { id: "r-3", phone: "+1 202 555 0199", direction: "missed", timestamp: Date.now() - 2 * 60 * 60 * 1000, duration: 0 },
  { id: "r-4", phone: "+1 202 555 0103", direction: "incoming", timestamp: Date.now() - 5 * 60 * 60 * 1000, duration: 421 },
  { id: "r-5", phone: "+1 202 555 0104", direction: "missed", timestamp: Date.now() - 22 * 60 * 60 * 1000, duration: 0 },
  { id: "r-6", phone: "+1 202 555 0105", direction: "outgoing", timestamp: Date.now() - 28 * 60 * 60 * 1000, duration: 182 },
  { id: "r-7", phone: "+1 202 555 0102", direction: "incoming", timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, duration: 64 },
];

const $ = (selector) => document.querySelector(selector);
const callList = $("#call-list");
const searchInput = $("#search-input");
const toastRegion = $("#toast-region");
const dialerDialog = $("#dialer-dialog");
const contactDialog = $("#contact-dialog");
const detailDialog = $("#detail-dialog");
const settingsDialog = $("#settings-dialog");
let loadError = null;
const themeStorageKey = "callwell-theme";
const pageCopy = {
  recent: ["Recent calls", "Your conversations, all in one place."],
  contacts: ["Contacts", "People and businesses saved in your address book."],
  blocked: ["Blocked numbers", "Numbers you’ve chosen not to hear from."],
};

function createInitialState() {
  return {
    contacts: sampleContacts.map((contact) => ({ ...contact })),
    calls: sampleCalls.map((call) => ({ ...call })),
    blocked: [],
    spam: [],
  };
}

function loadState() {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return createInitialState();
    const parsed = JSON.parse(stored);
    if (!parsed || !Array.isArray(parsed.contacts) || !Array.isArray(parsed.calls)
      || !Array.isArray(parsed.blocked) || !Array.isArray(parsed.spam)) {
      throw new Error("Saved Callwell data has an unexpected format.");
    }
    return {
      contacts: parsed.contacts.filter((item) => item && typeof item.id === "string" && typeof item.name === "string" && typeof item.phone === "string"),
      calls: parsed.calls.filter((item) => item && typeof item.phone === "string" && Number.isFinite(item.timestamp)),
      blocked: parsed.blocked.filter((phone) => typeof phone === "string"),
      spam: parsed.spam.filter((phone) => typeof phone === "string"),
    };
  } catch (error) {
    console.error("Could not load Callwell data:", error);
    loadError = "Saved data couldn’t be read. Sample data is shown instead.";
    return createInitialState();
  }
}

let state = loadState();
let activeView = "recent";
let activeFilter = "all";
let currentContactId = null;
let toastTimer;
let themePreference = "system";
if (loadError) showToast(loadError);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function normalizePhone(phone) {
  return String(phone).replace(/\D/g, "");
}

function validPhone(phone) {
  return /^\+?[\d\s().-]+$/.test(phone.trim()) && normalizePhone(phone).length >= 7 && normalizePhone(phone).length <= 15;
}

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  $('meta[name="theme-color"]').content = isDark ? "#141916" : "#f6f7f5";
  const toggle = $("#theme-toggle");
  toggle.setAttribute("aria-pressed", String(isDark));
  toggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
  toggle.innerHTML = isDark
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg><span>Light mode</span>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.5A8.5 8.5 0 0 1 8.5 3.8 8.5 8.5 0 1 0 20.2 15.5Z"/></svg><span>Dark mode</span>';
}

function initializeTheme() {
  try {
    const storedTheme = localStorage.getItem(themeStorageKey);
    if (storedTheme === "light" || storedTheme === "dark") themePreference = storedTheme;
  } catch (error) {
    console.error("Could not read the theme preference:", error);
  }
  applyTheme(themePreference === "system" ? getSystemTheme() : themePreference);
}

function saveState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("Could not save Callwell data:", error);
    showToast("Changes couldn’t be saved. Check your browser’s storage settings.");
    return false;
  }
}

function showToast(message) {
  toastRegion.textContent = message;
  toastRegion.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastRegion.classList.remove("is-visible"), 3600);
}

function validateBackup(parsed) {
  if (!parsed || parsed.version !== 1 || !parsed.data
    || !Array.isArray(parsed.data.contacts) || !Array.isArray(parsed.data.calls)
    || !Array.isArray(parsed.data.blocked) || !Array.isArray(parsed.data.spam)) {
    throw new Error("This file is not a supported Callwell backup.");
  }
  const contacts = parsed.data.contacts.map((contact) => {
    if (!contact || typeof contact.id !== "string" || !contact.id
      || typeof contact.name !== "string" || !contact.name.trim()
      || typeof contact.phone !== "string" || !validPhone(contact.phone)
      || (contact.label !== undefined && typeof contact.label !== "string")) {
      throw new Error("The backup contains an invalid contact.");
    }
    return {
      id: contact.id,
      name: contact.name.trim().slice(0, 60),
      phone: contact.phone.trim().slice(0, 24),
      label: (contact.label || "").trim().slice(0, 40),
    };
  });
  const contactNumbers = contacts.map((contact) => normalizePhone(contact.phone));
  if (new Set(contactNumbers).size !== contactNumbers.length) {
    throw new Error("The backup contains duplicate contact phone numbers.");
  }
  const calls = parsed.data.calls.map((call) => {
    if (!call || typeof call.phone !== "string" || !validPhone(call.phone)
      || !["incoming", "outgoing", "missed"].includes(call.direction)
      || !Number.isFinite(call.timestamp)
      || !Number.isFinite(call.duration) || call.duration < 0) {
      throw new Error("The backup contains an invalid call record.");
    }
    return {
      id: typeof call.id === "string" ? call.id : `call-${call.timestamp}`,
      phone: call.phone.trim().slice(0, 24),
      direction: call.direction,
      timestamp: call.timestamp,
      duration: call.duration,
    };
  });
  const normalizeList = (items, name) => {
    const values = items.map((phone) => {
      if (typeof phone !== "string" || normalizePhone(phone).length < 7 || normalizePhone(phone).length > 15) {
        throw new Error(`The backup contains an invalid ${name} number.`);
      }
      return normalizePhone(phone);
    });
    return [...new Set(values)];
  };
  return {
    contacts,
    calls,
    blocked: normalizeList(parsed.data.blocked, "blocked"),
    spam: normalizeList(parsed.data.spam, "spam"),
  };
}

function exportBackup() {
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: state,
  };
  const objectUrl = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `callwell-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  showToast("Backup downloaded.");
}

async function importBackup(file) {
  try {
    const parsed = JSON.parse(await file.text());
    const importedState = validateBackup(parsed);
    if (!window.confirm("Import this backup and replace the contacts, call history, and blocked numbers currently saved in this browser?")) return;
    const previousState = state;
    state = importedState;
    if (!saveState()) {
      state = previousState;
      render();
      return;
    }
    render();
    showToast("Backup imported successfully.");
  } catch (error) {
    console.error("Could not import Callwell backup:", error);
    showToast(error instanceof SyntaxError ? "That file isn’t valid JSON." : error.message || "The backup couldn’t be imported.");
  }
}

function clearCallHistory() {
  if (!state.calls.length) {
    showToast("Your call history is already empty.");
    return;
  }
  if (!window.confirm("Clear all calls from your history? This cannot be undone.")) return;
  const previousCalls = state.calls;
  state.calls = [];
  if (!saveState()) {
    state.calls = previousCalls;
    render();
    return;
  }
  render();
  showToast("Call history cleared.");
}

function getContact(phone) {
  const normalized = normalizePhone(phone);
  return state.contacts.find((contact) => normalizePhone(contact.phone) === normalized);
}

function getDisplayName(phone) {
  return getContact(phone)?.name || "Unknown caller";
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function avatarClass(name) {
  const colors = ["avatar-lilac", "avatar-mint", "avatar-peach", "avatar-blue", "avatar-rose"];
  const score = Array.from(name).reduce((total, character) => total + character.charCodeAt(0), 0);
  return colors[score % colors.length];
}

function formatPhone(phone) {
  const digits = normalizePhone(phone);
  if (digits.length === 11 && digits[0] === "1") {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

function formatCallTime(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  if (date.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}m ${String(remainder).padStart(2, "0")}s` : `${remainder}s`;
}

function renderCallRow(call) {
  const name = getDisplayName(call.phone);
  const contact = getContact(call.phone);
  const isBlocked = state.blocked.includes(normalizePhone(call.phone));
  const isSpam = state.spam.includes(normalizePhone(call.phone));
  const direction = call.direction === "missed" ? "Missed call" : call.direction === "outgoing" ? "Outgoing call" : "Incoming call";
  const directionIcon = call.direction === "missed" ? "↙" : call.direction === "outgoing" ? "↗" : "↙";
  const subtitle = isSpam ? "Marked as spam" : contact?.label || formatPhone(call.phone);
  return `<article class="list-row call-row">
    <button class="caller-cell" type="button" data-action="details" data-phone="${escapeHtml(call.phone)}" aria-label="View ${escapeHtml(name)} details">
      <span class="person-avatar ${avatarClass(name)}">${escapeHtml(initials(name) || "?")}</span>
      <span class="person-copy"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(subtitle)}</small></span>
    </button>
    <span class="type-cell"><span class="call-type ${call.direction === "missed" ? "type-missed" : call.direction === "outgoing" ? "type-outgoing" : "type-incoming"}"><span aria-hidden="true">${directionIcon}</span>${direction}</span></span>
    <span class="time-cell">${escapeHtml(formatCallTime(call.timestamp))}<small>${call.duration ? escapeHtml(formatDuration(call.duration)) : "No answer"}</small></span>
    <span class="number-cell">${escapeHtml(formatPhone(call.phone))}${isSpam ? '<span class="spam-tag">Spam</span>' : ""}</span>
    <span class="row-actions"><button class="row-action call-action" type="button" data-action="call" data-phone="${escapeHtml(call.phone)}" aria-label="Call ${escapeHtml(name)}" title="Call"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 3.8 10 3l2 4.8-2.1 1.5a14.2 14.2 0 0 0 4.8 4.8l1.5-2.1 4.8 2-.8 2.8a3 3 0 0 1-3.3 2.2A16.9 16.9 0 0 1 4.9 7.1a3 3 0 0 1 2.3-3.3Z"/></svg></button><button class="row-action block-action" type="button" data-action="${isSpam ? "unspam" : isBlocked ? "unblock" : "block"}" data-phone="${escapeHtml(call.phone)}" aria-label="${isSpam ? "Remove spam label from" : isBlocked ? "Unblock" : "Block"} ${escapeHtml(name)}" title="${isSpam ? "Remove spam label" : isBlocked ? "Unblock number" : "Block number"}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/></svg></button></span>
  </article>`;
}

function renderContactRow(contact) {
  return `<article class="list-row contact-row">
    <button class="caller-cell" type="button" data-action="details" data-phone="${escapeHtml(contact.phone)}" aria-label="View ${escapeHtml(contact.name)} details">
      <span class="person-avatar ${avatarClass(contact.name)}">${escapeHtml(initials(contact.name))}</span>
      <span class="person-copy"><strong>${escapeHtml(contact.name)}</strong><small>${escapeHtml(contact.label || "Saved contact")}</small></span>
    </button><span class="type-cell"><span class="contact-label">${escapeHtml(contact.label || "Contact")}</span></span>
    <span class="time-cell">—<small>In your contacts</small></span><span class="number-cell">${escapeHtml(formatPhone(contact.phone))}</span>
    <span class="row-actions"><button class="row-action call-action" type="button" data-action="call" data-phone="${escapeHtml(contact.phone)}" aria-label="Call ${escapeHtml(contact.name)}" title="Call"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 3.8 10 3l2 4.8-2.1 1.5a14.2 14.2 0 0 0 4.8 4.8l1.5-2.1 4.8 2-.8 2.8a3 3 0 0 1-3.3 2.2A16.9 16.9 0 0 1 4.9 7.1a3 3 0 0 1 2.3-3.3Z"/></svg></button><button class="row-action block-action" type="button" data-action="details" data-phone="${escapeHtml(contact.phone)}" aria-label="More about ${escapeHtml(contact.name)}" title="Contact details"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg></button></span>
  </article>`;
}

function getBlockedNumbers() {
  return [...new Set(state.blocked)].map((number) => ({
    phone: number,
    contact: getContact(number),
    spam: state.spam.includes(number),
  }));
}

function renderBlockedRow(entry) {
  const name = entry.contact?.name || "Unknown caller";
  return `<article class="list-row blocked-row">
    <button class="caller-cell" type="button" data-action="details" data-phone="${escapeHtml(entry.phone)}" aria-label="View ${escapeHtml(name)} details">
      <span class="person-avatar ${avatarClass(name)}">${escapeHtml(initials(name) || "?")}</span>
      <span class="person-copy"><strong>${escapeHtml(name)}</strong><small>${entry.spam ? "Blocked · Marked as spam" : "Blocked number"}</small></span>
    </button><span class="type-cell"><span class="blocked-tag">${entry.spam ? "Spam" : "Blocked"}</span></span>
    <span class="time-cell">—<small>Calls silenced in this app</small></span><span class="number-cell">${escapeHtml(formatPhone(entry.phone))}</span>
    <span class="row-actions"><button class="unblock-button" type="button" data-action="unblock" data-phone="${escapeHtml(entry.phone)}">Unblock</button></span>
  </article>`;
}

function matchesSearch(text) {
  return text.toLocaleLowerCase().includes(searchInput.value.trim().toLocaleLowerCase());
}

function renderList() {
  const query = searchInput.value.trim();
  let html = "";
  let count = 0;
  if (activeView === "recent") {
    const calls = [...state.calls].sort((a, b) => b.timestamp - a.timestamp).filter((call) => {
      const name = getDisplayName(call.phone);
      return (activeFilter === "all" || call.direction === "missed")
        && (!query || matchesSearch(`${name} ${call.phone} ${formatPhone(call.phone)}`));
    });
    count = calls.length;
    html = calls.map(renderCallRow).join("");
  } else if (activeView === "contacts") {
    const contacts = [...state.contacts].sort((a, b) => a.name.localeCompare(b.name)).filter((contact) => (
      !query || matchesSearch(`${contact.name} ${contact.phone} ${contact.label || ""}`)
    ));
    count = contacts.length;
    html = contacts.map(renderContactRow).join("");
  } else {
    const blocked = getBlockedNumbers().filter((entry) => (
      !query || matchesSearch(`${entry.contact?.name || ""} ${entry.phone}`)
    ));
    count = blocked.length;
    html = blocked.map(renderBlockedRow).join("");
  }
  callList.innerHTML = html;
  callList.hidden = count === 0;
  $("#list-heading").hidden = count === 0;
  $("#empty-state").hidden = count !== 0;

  if (count === 0) {
    const hasQuery = Boolean(query);
    const emptyCopy = activeView === "contacts"
      ? ["No contacts found", hasQuery ? "Try another name or phone number." : "Add a contact to keep your favorite people close.", "Add a contact"]
      : activeView === "blocked"
        ? ["No blocked numbers", hasQuery ? "Try another name or phone number." : "Numbers you block will show up here.", "Recent calls"]
        : ["No calls to show", hasQuery ? "Try another name or phone number." : "Your recent calls will appear here.", "Open dialer"];
    $("#empty-title").textContent = emptyCopy[0];
    $("#empty-description").textContent = emptyCopy[1];
    $("#empty-action").innerHTML = `${escapeHtml(emptyCopy[2])} <span aria-hidden="true">↗</span>`;
    $("#empty-action").hidden = activeView === "blocked" && !hasQuery;
  }
}

function render() {
  const missedCalls = state.calls.filter((call) => call.direction === "missed").length;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  $("#total-calls").textContent = state.calls.length;
  $("#total-contacts").textContent = state.contacts.length;
  $("#today-calls").textContent = state.calls.filter((call) => call.timestamp >= todayStart.getTime()).length;
  $("#spam-count").textContent = state.spam.length;
  $("#all-count").textContent = state.calls.length;
  $("#missed-tab-count").textContent = missedCalls;
  $("#missed-count").textContent = missedCalls;
  $("#blocked-count").textContent = state.blocked.length;
  $("#breadcrumb-current").textContent = pageCopy[activeView][0];
  $("#page-title").innerHTML = `${escapeHtml(pageCopy[activeView][0])}<span class="heading-period">.</span>`;
  $("#page-description").textContent = pageCopy[activeView][1];
  document.querySelectorAll(".nav-item").forEach((item) => {
    const selected = item.dataset.view === activeView;
    item.classList.toggle("is-active", selected);
    if (selected) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  document.querySelectorAll(".view-tab").forEach((tab) => {
    const selected = tab.dataset.filter === activeFilter;
    tab.classList.toggle("is-selected", selected);
    tab.setAttribute("aria-selected", String(selected));
  });
  $(".view-tabs").hidden = activeView !== "recent";
  renderList();
}

function setView(view) {
  if (!pageCopy[view]) return;
  activeView = view;
  activeFilter = "all";
  searchInput.value = "";
  render();
}

function blockNumber(phone, markAsSpam = false) {
  const number = normalizePhone(phone);
  if (!number) return;
  if (!state.blocked.includes(number)) state.blocked.push(number);
  if (markAsSpam && !state.spam.includes(number)) state.spam.push(number);
  saveState();
  render();
  showToast(markAsSpam ? "Number marked as spam and blocked." : "Number blocked in Callwell.");
}

function unblockNumber(phone) {
  const number = normalizePhone(phone);
  state.blocked = state.blocked.filter((entry) => entry !== number);
  saveState();
  render();
  showToast("Number unblocked.");
}

function openContactDetails(phone) {
  const number = normalizePhone(phone);
  const contact = getContact(number);
  currentContactId = contact?.id || null;
  const name = contact?.name || "Unknown caller";
  const isBlocked = state.blocked.includes(number);
  const isSpam = state.spam.includes(number);
  const initialsText = initials(name) || "?";
  $("#contact-detail").innerHTML = `<span class="detail-avatar ${avatarClass(name)}">${escapeHtml(initialsText)}</span>
    <p class="dialog-kicker">${contact ? "CONTACT DETAILS" : "CALLER DETAILS"}</p>
    <h2 id="detail-name">${escapeHtml(name)}</h2>
    ${contact?.label ? `<span class="detail-label">${escapeHtml(contact.label)}</span>` : ""}
    <p class="detail-phone">${escapeHtml(formatPhone(contact?.phone || phone))}</p>
    ${isSpam ? '<span class="detail-spam">Reported as spam</span>' : ""}
    <div class="detail-actions"><button class="button button-call" type="button" data-action="call" data-phone="${escapeHtml(contact?.phone || phone)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 3.8 10 3l2 4.8-2.1 1.5a14.2 14.2 0 0 0 4.8 4.8l1.5-2.1 4.8 2-.8 2.8a3 3 0 0 1-3.3 2.2A16.9 16.9 0 0 1 4.9 7.1a3 3 0 0 1 2.3-3.3Z"/></svg>Call</button>
      <button class="button button-secondary" type="button" data-action="${isBlocked ? "unblock" : "block"}" data-phone="${escapeHtml(contact?.phone || phone)}">${isBlocked ? "Unblock" : "Block number"}</button></div>
    <div class="detail-secondary-actions"><button class="detail-link" type="button" data-action="${isSpam ? "unspam" : "spam"}" data-phone="${escapeHtml(contact?.phone || phone)}">${isSpam ? "Remove spam label" : "Mark as spam & block"}</button>${contact ? '<button class="detail-link detail-delete" type="button" data-action="delete-contact">Remove contact</button>' : '<button class="detail-link" type="button" data-action="save-contact" data-phone="' + escapeHtml(phone) + '">Add to contacts</button>'}</div>`;
  detailDialog.showModal();
}

function openDialer(phone = "") {
  $("#dial-number").value = phone;
  $("#dial-hint").textContent = "Calls open in your device’s phone app.";
  dialerDialog.showModal();
  window.setTimeout(() => $("#dial-number").focus(), 0);
}

function placeCall(phone) {
  const cleanPhone = phone.trim();
  if (!validPhone(cleanPhone)) {
    showToast("Enter a valid phone number (7–15 digits).");
    return false;
  }
  const normalized = normalizePhone(cleanPhone);
  if (state.blocked.includes(normalized)) {
    showToast("This number is blocked. Unblock it before calling.");
    return false;
  }
  state.calls.unshift({
    id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    phone: cleanPhone,
    direction: "outgoing",
    timestamp: Date.now(),
    duration: 0,
  });
  saveState();
  render();
  if (dialerDialog.open) dialerDialog.close();
  if (detailDialog.open) detailDialog.close();
  showToast(`Opening your phone app to call ${getDisplayName(cleanPhone)}.`);
  window.location.href = `tel:${encodeURIComponent(cleanPhone.replace(/[\s().-]/g, ""))}`;
  return true;
}

function openAddContact(phone = "") {
  const form = $("#contact-form");
  form.reset();
  form.elements.phone.value = phone;
  $("#contact-error").textContent = "";
  contactDialog.showModal();
  window.setTimeout(() => form.elements.name.focus(), 0);
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelectorAll(".view-tab").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    render();
  });
});

searchInput.addEventListener("input", renderList);
$("#open-dialer").addEventListener("click", () => openDialer());
$("#add-contact-button").addEventListener("click", () => openAddContact());
$("#theme-toggle").addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  themePreference = nextTheme;
  applyTheme(nextTheme);
  try {
    localStorage.setItem(themeStorageKey, nextTheme);
  } catch (error) {
    console.error("Could not save the theme preference:", error);
    showToast("Theme changed, but your preference couldn’t be saved.");
    return;
  }
  showToast(`${nextTheme === "dark" ? "Dark" : "Light"} mode enabled.`);
});
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
  if (themePreference === "system") applyTheme(event.matches ? "dark" : "light");
});
$("#open-settings").addEventListener("click", () => settingsDialog.showModal());
$("#export-data").addEventListener("click", exportBackup);
$("#import-data").addEventListener("click", () => $("#backup-file").click());
$("#backup-file").addEventListener("change", (event) => {
  const [file] = event.currentTarget.files;
  if (file) importBackup(file);
  event.currentTarget.value = "";
});
$("#clear-history").addEventListener("click", clearCallHistory);
$("#empty-action").addEventListener("click", () => {
  if (activeView === "contacts") openAddContact();
  else if (activeView === "blocked") setView("recent");
  else openDialer();
});

callList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, phone } = button.dataset;
  if (action === "call") placeCall(phone);
  if (action === "details") openContactDetails(phone);
  if (action === "block") blockNumber(phone);
  if (action === "unblock") unblockNumber(phone);
  if (action === "spam") blockNumber(phone, true);
  if (action === "unspam") {
    const number = normalizePhone(phone);
    state.spam = state.spam.filter((entry) => entry !== number);
    saveState();
    render();
    showToast("Spam label removed.");
  }
});

$("#contact-detail").addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, phone } = button.dataset;
  if (action === "call") placeCall(phone);
  if (action === "block") {
    blockNumber(phone);
    detailDialog.close();
  }
  if (action === "unblock") {
    unblockNumber(phone);
    detailDialog.close();
  }
  if (action === "spam") {
    blockNumber(phone, true);
    detailDialog.close();
  }
  if (action === "unspam") {
    const number = normalizePhone(phone);
    state.spam = state.spam.filter((entry) => entry !== number);
    saveState();
    detailDialog.close();
    render();
    showToast("Spam label removed.");
  }
  if (action === "save-contact") {
    detailDialog.close();
    openAddContact(phone);
  }
  if (action === "delete-contact" && currentContactId) {
    const contact = state.contacts.find((item) => item.id === currentContactId);
    state.contacts = state.contacts.filter((item) => item.id !== currentContactId);
    currentContactId = null;
    saveState();
    detailDialog.close();
    render();
    showToast(`${contact?.name || "Contact"} removed.`);
  }
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

$("#dial-form").addEventListener("submit", (event) => {
  event.preventDefault();
  placeCall($("#dial-number").value);
});

$(".dial-pad").addEventListener("click", (event) => {
  const button = event.target.closest("[data-digit]");
  if (!button) return;
  const input = $("#dial-number");
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.setRangeText(button.dataset.digit, start, end, "end");
  input.focus();
});

$("#clear-dial").addEventListener("click", () => {
  $("#dial-number").value = "";
  $("#dial-number").focus();
});

$("#contact-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const name = form.elements.name.value.trim();
  const phone = form.elements.phone.value.trim();
  const label = form.elements.label.value.trim();
  const error = $("#contact-error");
  if (!validPhone(phone)) {
    error.textContent = "Enter a valid phone number with 7–15 digits.";
    form.elements.phone.focus();
    return;
  }
  const duplicate = state.contacts.find((contact) => normalizePhone(contact.phone) === normalizePhone(phone));
  if (duplicate) {
    error.textContent = `${duplicate.name} is already saved with this number.`;
    form.elements.phone.focus();
    return;
  }
  state.contacts.push({
    id: globalThis.crypto?.randomUUID ? crypto.randomUUID() : `contact-${Date.now()}`,
    name,
    phone,
    label,
  });
  saveState();
  contactDialog.close();
  if (activeView === "contacts") render();
  else render();
  showToast(`${name} added to your contacts.`);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)
    && !dialerDialog.open && !contactDialog.open && !detailDialog.open) {
    event.preventDefault();
    searchInput.focus();
  }
});

initializeTheme();
render();
