// ---------- Storage keys ----------
const STORAGE = {
    COUNTERS: "counters",
    ALLOW_NEG: "allowNegatives",
    SORT: "sortMode",
  };
  
  // ---------- Elements ----------
  const listEl = document.getElementById("list");
  const addBtn = document.getElementById("addCounter");
  const newNameEl = document.getElementById("newName");
  const allowNegativesEl = document.getElementById("allowNegatives");
  const totalEl = document.getElementById("total");
  const clearAllBtn = document.getElementById("clearAll");
  const searchEl = document.getElementById("search");
  const sortEl = document.getElementById("sort");
  const showingEl = document.getElementById("showing");
  
  // ---------- State ----------
  let counters = loadCounters();
  let allowNegatives = loadBool(STORAGE.ALLOW_NEG, false);
  let sortMode = loadSortMode();
  let searchTerm = "";
  
  // ---------- Startup ----------
  allowNegativesEl.checked = allowNegatives;
  sortEl.value = sortMode;
  updateSummary();
  updateClearAllState();
  render();
  
  // ---------- Events (global) ----------
  addBtn.addEventListener("click", () => {
    const name = (newNameEl.value || "").trim();
    addCounter(name || nextDefaultName());
    newNameEl.value = "";
    newNameEl.focus();
  });
  
  newNameEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addBtn.click();
  });
  
  allowNegativesEl.addEventListener("change", (e) => {
    allowNegatives = e.target.checked;
    saveBool(STORAGE.ALLOW_NEG, allowNegatives);
    if (!allowNegatives) {
      // Clamp all to >= 0 if turning negatives off
      counters = counters.map(c => ({ ...c, count: Math.max(0, c.count) }));
      saveCounters(counters);
    }
    render();
  });
  
  clearAllBtn.addEventListener("click", () => {
    if (counters.length === 0) return;
    const sure = confirm(
      "Clear ALL counters? This deletes every counter and its count. (Names too.)"
    );
    if (!sure) return;
    counters = [];
    saveCounters(counters);
    render();
  });
  
  searchEl.addEventListener("input", () => {
    searchTerm = searchEl.value.trim();
    render();
  });
  
  sortEl.addEventListener("change", () => {
    sortMode = sortEl.value;
    saveSortMode(sortMode);
    render();
  });
  
  // ---------- Rendering ----------
  function render() {
    const visible = getVisibleCounters();
    listEl.innerHTML = "";
    visible.forEach((counter) => {
      const card = createCounterCard(counter);
      listEl.appendChild(card);
    });
    updateSummary();          // total of ALL counters
    updateClearAllState();    // disable clear all when nothing exists
    updateShowing(visible);   // "Showing X of Y"
  }
  
  function updateSummary() {
    const total = counters.reduce((sum, c) => sum + (Number.isFinite(c.count) ? c.count : 0), 0);
    totalEl.textContent = `Total: ${total}`;
  }
  
  function updateClearAllState() {
    clearAllBtn.disabled = counters.length === 0;
  }
  
  function updateShowing(visible) {
    showingEl.textContent = `Showing ${visible.length} of ${counters.length}`;
  }
  
  function getVisibleCounters() {
    const term = searchTerm.toLowerCase();
    let list = counters.filter(c =>
      term === "" ? true : c.name.toLowerCase().includes(term)
    );
  
    const byNameAsc = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.id.localeCompare(b.id);
    const byNameDesc = (a, b) => -byNameAsc(a, b);
    const byCountAsc = (a, b) => (a.count - b.count) || byNameAsc(a, b);
    const byCountDesc = (a, b) => -byCountAsc(a, b);
    const byCreatedAsc = (a, b) => (a.createdAt - b.createdAt) || byNameAsc(a, b);
    const byCreatedDesc = (a, b) => -byCreatedAsc(a, b);
  
    switch (sortMode) {
      case "name-asc":   list.sort(byNameAsc); break;
      case "name-desc":  list.sort(byNameDesc); break;
      case "count-asc":  list.sort(byCountAsc); break;
      case "count-desc": list.sort(byCountDesc); break;
      case "created-asc":  list.sort(byCreatedAsc); break;
      case "created-desc": list.sort(byCreatedDesc); break;
      default: list.sort(byCreatedDesc); // sensible default
    }
    return list;
  }
  
  // Build one counter card DOM, wire up its events
  function createCounterCard(counter) {
    const card = el("div", { class: "card" });
  
    // Name row (input + delete)
    const nameRow = el("div", { class: "name-row" });
    const nameInput = el("input", {
      class: "name",
      value: counter.name,
      placeholder: "Counter name",
    });
    const delBtn = el("button", { class: "danger icon", title: "Delete" }, "Delete");
    nameRow.appendChild(nameInput);
    nameRow.appendChild(delBtn);
  
    // Count display
    const countEl = el("div", { class: "count" }, String(counter.count));
  
    // Buttons row
    const btnRow = el("div", { class: "btn-row" });
    const decBtn = el("button", { class: "danger" }, "−1");
    const incBtn = el("button", null, "+1");
    const resetBtn = el("button", { class: "secondary" }, "Reset");
    const saveBtn = el("button", { class: "secondary" }, "Save name");
    btnRow.append(decBtn, incBtn, resetBtn, saveBtn);
  
    // Compose card
    card.append(nameRow, countEl, btnRow);
  
    // Helper to (re)paint just this card’s changing bits
    function paint() {
      // Update count text with bump animation
      countEl.textContent = String(counter.count);
      countEl.classList.remove("bump");
      void countEl.offsetWidth; // restart animation
      countEl.classList.add("bump");
  
      // Fake-disable decrement if needed
      const shouldDisableDec = !allowNegatives && counter.count === 0;
      decBtn.classList.toggle("is-disabled", shouldDisableDec);
      decBtn.setAttribute("aria-disabled", String(shouldDisableDec));
  
      // Keep name input current (in case of external updates)
      nameInput.value = counter.name;
    }
  
    // Persist the updated counter back into `counters`
    function updateCounter(mutator) {
      counters = counters.map((c) => (c.id === counter.id ? mutator({ ...c }) : c));
      saveCounters(counters);
      // Replace `counter` reference with latest copy
      counter = counters.find((c) => c.id === counter.id);
      paint();
      updateSummary();
    }
  
    // Normalize according to global rule
    function normalize(n) {
      return allowNegatives ? n : Math.max(0, n);
    }
  
    // Events
    incBtn.addEventListener("click", () => {
      updateCounter((c) => ({ ...c, count: normalize(c.count + 1) }));
    });
  
    decBtn.addEventListener("click", () => {
      const disallowed = !allowNegatives && counter.count === 0;
      if (disallowed) {
        // Shake instead of doing nothing
        decBtn.classList.remove("shake");
        void decBtn.offsetWidth;
        decBtn.classList.add("shake");
        return;
      }
      updateCounter((c) => ({ ...c, count: c.count - 1 }));
    });
  
    resetBtn.addEventListener("click", () => {
      updateCounter((c) => ({ ...c, count: 0 }));
    });
  
    // Save name button
    saveBtn.addEventListener("click", () => {
      const name = nameInput.value.trim();
      updateCounter((c) => ({ ...c, name: name || c.name }));
      // After rename, it may move due to sort; re-render the list so the card relocates
      render();
    });
  
    // Also save on Enter/blur so you don’t have to click “Save name”
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveBtn.click();
        nameInput.blur();
      }
    });
    nameInput.addEventListener("blur", () => saveBtn.click());
  
    // Delete
    delBtn.addEventListener("click", () => {
      counters = counters.filter((c) => c.id !== counter.id);
      saveCounters(counters);
      render(); // rebuild list and update total/clear-all state
    });
  
    // Initial paint of this card
    paint();
  
    return card;
  }
  
  // ---------- Data helpers ----------
  function loadCounters() {
    try {
      const raw = localStorage.getItem(STORAGE.COUNTERS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((c) => ({
        id: String(c.id ?? makeId()),
        name: String(c.name ?? "Counter"),
        count: Number.isFinite(c.count) ? c.count : 0,
        createdAt: Number.isFinite(c.createdAt) ? c.createdAt : Date.now(),
      }));
    } catch {
      return [];
    }
  }
  
  function saveCounters(list) {
    localStorage.setItem(STORAGE.COUNTERS, JSON.stringify(list));
  }
  
  function loadBool(key, fallback = false) {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw === "true";
  }
  function saveBool(key, value) {
    localStorage.setItem(key, String(value));
  }
  
  function loadSortMode() {
    const raw = localStorage.getItem(STORAGE.SORT);
    return raw || "created-desc";
  }
  function saveSortMode(value) {
    localStorage.setItem(STORAGE.SORT, value);
  }
  
  function addCounter(name) {
    const item = { id: makeId(), name, count: 0, createdAt: Date.now() };
    counters = [item, ...counters];
    saveCounters(counters);
    render();
  }
  
  function nextDefaultName() {
    // “Counter 1”, “Counter 2”, ...
    const used = new Set(
      counters
        .map((c) => c.name.trim())
        .filter((n) => /^Counter \d+$/.test(n))
    );
    let n = 1;
    while (used.has(`Counter ${n}`)) n++;
    return `Counter ${n}`;
  }
  
  function makeId() {
    return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  
  // ---------- Tiny DOM helper ----------
  function el(tag, attrs, text) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null) continue;
        if (k === "class") node.className = v;
        else if (k === "dataset") for (const [dk, dv] of Object.entries(v)) node.dataset[dk] = dv;
        else node.setAttribute(k, v);
      }
    }
    if (text != null) node.textContent = text;
    return node;
  }
  