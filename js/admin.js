(() => {
  const form = document.querySelector("[data-price-form]");
  const groups = document.querySelector("[data-price-groups]");
  const status = document.querySelector("[data-admin-status]");
  const dirtyMessage = document.querySelector("[data-dirty-message]");
  const saveButton = document.querySelector("[data-save-button]");
  if (!(form instanceof HTMLFormElement) || !(groups instanceof HTMLElement) || !(status instanceof HTMLElement) || !(dirtyMessage instanceof HTMLElement) || !(saveButton instanceof HTMLButtonElement)) return;

  let records = [];
  let saving = false;

  const announce = (message, state = "") => {
    status.textContent = message;
    if (state) status.dataset.state = state;
    else delete status.dataset.state;
  };

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || "The request could not be completed.");
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function updateDirtyState() {
    const changed = records.filter((record) => {
      if (!record.editable) return false;
      const input = groups.querySelector(`[data-price-key="${CSS.escape(record.key)}"]`);
      if (!(input instanceof HTMLInputElement) || !input.validity.valid || input.value.trim() === "") return false;
      return Math.round(Number(input.value) * 100) !== record.amountCents;
    });
    dirtyMessage.textContent = changed.length ? `${changed.length} unsaved ${changed.length === 1 ? "change" : "changes"}` : "No unsaved changes";
    saveButton.disabled = saving || changed.length === 0 || !form.checkValidity();
  }

  function render() {
    groups.replaceChildren();
    const categories = new Map();
    for (const record of records) {
      if (!categories.has(record.category)) categories.set(record.category, []);
      categories.get(record.category).push(record);
    }
    for (const [category, prices] of categories) {
      const section = document.createElement("section");
      section.className = "price-group";
      const heading = document.createElement("h2");
      heading.textContent = category;
      section.append(heading);
      for (const record of prices) {
        const row = document.createElement("div");
        row.className = "price-field";
        const label = document.createElement("label");
        label.htmlFor = `price-${record.key}`;
        label.textContent = record.label;
        row.append(label);
        if (record.editable) {
          const control = document.createElement("div");
          control.className = "price-control";
          const prefix = document.createElement("span");
          prefix.textContent = record.displayType === "from" ? "from $" : record.displayType === "surcharge" ? "+$" : "$";
          const input = document.createElement("input");
          input.id = `price-${record.key}`;
          input.type = "number";
          input.inputMode = "decimal";
          input.min = "0";
          input.max = "50000";
          input.step = "0.01";
          input.required = true;
          input.value = String(record.amountCents / 100);
          input.dataset.priceKey = record.key;
          input.setAttribute("aria-describedby", `help-${record.key}`);
          control.append(prefix, input);
          const help = document.createElement("small");
          help.id = `help-${record.key}`;
          help.textContent = "Enter the amount only";
          row.append(control, help);
        } else {
          const value = document.createElement("strong");
          value.textContent = record.formatted;
          const help = document.createElement("small");
          help.textContent = "This service is quoted after consultation";
          row.append(value, help);
        }
        section.append(row);
      }
      groups.append(section);
    }
    groups.setAttribute("aria-busy", "false");
    updateDirtyState();
  }

  groups.addEventListener("input", () => {
    for (const input of groups.querySelectorAll("input")) input.setAttribute("aria-invalid", input.validity.valid ? "false" : "true");
    updateDirtyState();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (saving || !form.reportValidity()) return;
    const changes = records.filter((record) => {
      if (!record.editable) return false;
      const input = groups.querySelector(`[data-price-key="${CSS.escape(record.key)}"]`);
      return input instanceof HTMLInputElement && Math.round(Number(input.value) * 100) !== record.amountCents;
    });
    if (!changes.length) return;
    saving = true;
    saveButton.disabled = true;
    announce("Saving changes…");
    try {
      for (const record of changes) {
        const input = groups.querySelector(`[data-price-key="${CSS.escape(record.key)}"]`);
        const amountCents = Math.round(Number(input.value) * 100);
        const payload = await request("/api/admin/prices", { method: "PATCH", body: JSON.stringify({ key: record.key, amountCents, version: record.version }) });
        Object.assign(record, payload.price);
      }
      render();
      announce("✓ Prices updated successfully", "success");
    } catch (error) {
      if (error.status === 409) announce("Pricing changed in another session. Refresh this page before saving again.", "error");
      else announce(error.message || "Prices could not be saved. Your entries have been kept.", "error");
      updateDirtyState();
    } finally {
      saving = false;
      updateDirtyState();
    }
  });

  request("/api/admin/prices")
    .then((payload) => { records = payload.prices; render(); announce("Current website prices loaded.", "success"); })
    .catch((error) => { groups.setAttribute("aria-busy", "false"); announce(error.message || "Current prices could not be loaded. Please refresh and try again.", "error"); });
})();
