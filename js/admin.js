(() => {
  const form = document.querySelector("[data-price-form]");
  const groups = document.querySelector("[data-price-groups]");
  const status = document.querySelector("[data-admin-status]");
  const dirtyMessage = document.querySelector("[data-dirty-message]");
  const saveButton = document.querySelector("[data-save-button]");
  const removeDialog = document.querySelector("[data-remove-dialog]");
  const removeName = document.querySelector("[data-remove-name]");
  if (!(form instanceof HTMLFormElement) || !(groups instanceof HTMLElement) || !(status instanceof HTMLElement) || !(dirtyMessage instanceof HTMLElement) || !(saveButton instanceof HTMLButtonElement) || !(removeDialog instanceof HTMLDialogElement) || !(removeName instanceof HTMLElement)) return;

  let records = [];
  let stylingItems = [];
  let initialStyling = "[]";
  let removedStyling = [];
  let pendingRemoval = -1;
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

  const stylingState = () => JSON.stringify(stylingItems.map((item) => ({ key: item.key, label: item.label.trim(), amountCents: item.amountCents, version: item.version })));
  const stylingChanged = () => stylingState() !== initialStyling || removedStyling.length > 0;

  function normalPriceChanges() {
    return records.filter((record) => {
      if (!record.editable || record.category === "Styling") return false;
      const input = groups.querySelector(`[data-price-key="${CSS.escape(record.key)}"]`);
      if (!(input instanceof HTMLInputElement) || !input.validity.valid || input.value.trim() === "") return false;
      return Math.round(Number(input.value) * 100) !== record.amountCents;
    });
  }

  function syncStylingInputs() {
    for (const input of groups.querySelectorAll("[data-styling-index]")) {
      if (!(input instanceof HTMLInputElement)) continue;
      const index = Number(input.dataset.stylingIndex);
      if (!stylingItems[index]) continue;
      if (input.dataset.stylingField === "label") stylingItems[index].label = input.value;
      if (input.dataset.stylingField === "price") stylingItems[index].amountCents = Math.round(Number(input.value) * 100);
      input.setAttribute("aria-invalid", input.validity.valid ? "false" : "true");
    }
  }

  function updateDirtyState() {
    syncStylingInputs();
    const count = normalPriceChanges().length + (stylingChanged() ? 1 : 0);
    dirtyMessage.textContent = count ? `${count} unsaved ${count === 1 ? "change" : "changes"}` : "No unsaved changes";
    saveButton.disabled = saving || count === 0 || !form.checkValidity();
  }

  function priceControl(record, input) {
    const control = document.createElement("div");
    control.className = "price-control";
    const prefix = document.createElement("span");
    prefix.textContent = record.displayType === "from" ? "from $" : record.displayType === "surcharge" ? "+$" : "$";
    control.append(prefix, input);
    return control;
  }

  function renderStandardField(record) {
    const row = document.createElement("div");
    row.className = "price-field";
    const label = document.createElement("label");
    label.htmlFor = `price-${record.key}`;
    label.textContent = record.label;
    row.append(label);
    if (record.editable) {
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
      const help = document.createElement("small");
      help.id = `help-${record.key}`;
      help.textContent = "Enter the amount only";
      row.append(priceControl(record, input), help);
    } else {
      const value = document.createElement("strong");
      value.textContent = record.formatted;
      const help = document.createElement("small");
      help.textContent = "This service is quoted after consultation";
      row.append(value, help);
    }
    return row;
  }

  function renderStylingSection(section) {
    const intro = document.createElement("p");
    intro.className = "styling-help";
    intro.textContent = "Rename, price, add, remove or reorder the options shown on the Styling page.";
    section.append(intro);
    const list = document.createElement("div");
    list.className = "styling-list";
    stylingItems.forEach((record, index) => {
      const card = document.createElement("fieldset");
      card.className = "styling-card";
      const legend = document.createElement("legend");
      legend.textContent = `Styling option ${index + 1}`;
      const nameLabel = document.createElement("label");
      nameLabel.htmlFor = `styling-name-${record.clientId}`;
      nameLabel.textContent = "Service name";
      const nameInput = document.createElement("input");
      nameInput.className = "styling-name";
      nameInput.id = nameLabel.htmlFor;
      nameInput.type = "text";
      nameInput.required = true;
      nameInput.minLength = 2;
      nameInput.maxLength = 80;
      nameInput.value = record.label;
      nameInput.dataset.stylingIndex = String(index);
      nameInput.dataset.stylingField = "label";
      const priceLabel = document.createElement("label");
      priceLabel.htmlFor = `styling-price-${record.clientId}`;
      priceLabel.textContent = "Price";
      const priceInput = document.createElement("input");
      priceInput.id = priceLabel.htmlFor;
      priceInput.type = "number";
      priceInput.inputMode = "decimal";
      priceInput.required = true;
      priceInput.min = "0";
      priceInput.max = "50000";
      priceInput.step = "0.01";
      priceInput.value = String(record.amountCents / 100);
      priceInput.dataset.stylingIndex = String(index);
      priceInput.dataset.stylingField = "price";
      const controls = document.createElement("div");
      controls.className = "styling-card__actions";
      const safeName = record.label || `option ${index + 1}`;
      const up = document.createElement("button");
      up.type = "button"; up.dataset.styleAction = "up"; up.dataset.index = String(index); up.disabled = index === 0; up.setAttribute("aria-label", `Move ${safeName} up`); up.textContent = "↑";
      const down = document.createElement("button");
      down.type = "button"; down.dataset.styleAction = "down"; down.dataset.index = String(index); down.disabled = index === stylingItems.length - 1; down.setAttribute("aria-label", `Move ${safeName} down`); down.textContent = "↓";
      const remove = document.createElement("button");
      remove.className = "styling-remove"; remove.type = "button"; remove.dataset.styleAction = "remove"; remove.dataset.index = String(index); remove.textContent = "Remove option";
      controls.append(up, down, remove);
      card.append(legend, nameLabel, nameInput, priceLabel, priceControl(record, priceInput), controls);
      list.append(card);
    });
    const add = document.createElement("button");
    add.className = "styling-add";
    add.type = "button";
    add.dataset.styleAction = "add";
    add.textContent = "+ Add Styling Option";
    section.append(list, add);
  }

  function render() {
    groups.replaceChildren();
    const categories = new Map();
    for (const record of records.filter((item) => item.category !== "Styling")) {
      if (!categories.has(record.category)) categories.set(record.category, []);
      categories.get(record.category).push(record);
    }
    categories.set("Styling", stylingItems);
    for (const [category, prices] of categories) {
      const section = document.createElement("section");
      section.className = `price-group${category === "Styling" ? " price-group--styling" : ""}`;
      const heading = document.createElement("h2");
      heading.textContent = category;
      section.append(heading);
      if (category === "Styling") renderStylingSection(section);
      else for (const record of prices) section.append(renderStandardField(record));
      groups.append(section);
    }
    groups.setAttribute("aria-busy", "false");
    updateDirtyState();
  }

  groups.addEventListener("input", updateDirtyState);
  groups.addEventListener("click", (event) => {
    const button = event.target.closest("[data-style-action]");
    if (!(button instanceof HTMLButtonElement)) return;
    syncStylingInputs();
    const action = button.dataset.styleAction;
    const index = Number(button.dataset.index);
    if (action === "add") {
      stylingItems.push({ key: null, label: "", amountCents: 0, version: null, displayType: "fixed", clientId: crypto.randomUUID() });
      render();
      groups.querySelector(`[data-styling-index="${stylingItems.length - 1}"][data-styling-field="label"]`)?.focus();
    } else if ((action === "up" || action === "down") && Number.isInteger(index)) {
      const next = action === "up" ? index - 1 : index + 1;
      if (next >= 0 && next < stylingItems.length) {
        [stylingItems[index], stylingItems[next]] = [stylingItems[next], stylingItems[index]];
        render();
      }
    } else if (action === "remove" && stylingItems[index]) {
      if (stylingItems.length === 1) { announce("Keep at least one Styling option active.", "error"); return; }
      pendingRemoval = index;
      removeName.textContent = stylingItems[index].label || `Styling option ${index + 1}`;
      removeDialog.showModal();
    }
  });

  removeDialog.addEventListener("close", () => {
    if (removeDialog.returnValue === "remove" && stylingItems[pendingRemoval]) {
      const [removed] = stylingItems.splice(pendingRemoval, 1);
      if (removed.key) removedStyling.push({ key: removed.key, version: removed.version });
      render();
    }
    pendingRemoval = -1;
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    syncStylingInputs();
    if (saving || !form.reportValidity()) return;
    const priceChanges = normalPriceChanges();
    const saveStyling = stylingChanged();
    if (!priceChanges.length && !saveStyling) return;
    saving = true;
    saveButton.disabled = true;
    announce("Saving changes…");
    try {
      for (const record of priceChanges) {
        const input = groups.querySelector(`[data-price-key="${CSS.escape(record.key)}"]`);
        const amountCents = Math.round(Number(input.value) * 100);
        const payload = await request("/api/admin/prices", { method: "PATCH", body: JSON.stringify({ key: record.key, amountCents, version: record.version }) });
        Object.assign(record, payload.price);
      }
      if (saveStyling) {
        const payload = await request("/api/admin/styling", {
          method: "PUT",
          body: JSON.stringify({
            items: stylingItems.map((item) => ({ key: item.key, label: item.label.trim(), amountCents: item.amountCents, version: item.version })),
            removed: removedStyling,
          }),
        });
        stylingItems = payload.prices.map((item) => ({ ...item, clientId: item.key }));
        records = [...records.filter((item) => item.category !== "Styling"), ...payload.prices];
        removedStyling = [];
        initialStyling = stylingState();
      }
      render();
      announce("✓ Changes updated successfully", "success");
    } catch (error) {
      if (error.status === 409) announce("Pricing changed in another session. Refresh this page before saving again.", "error");
      else announce(error.message || "Changes could not be saved. Your entries have been kept.", "error");
      updateDirtyState();
    } finally {
      saving = false;
      updateDirtyState();
    }
  });

  request("/api/admin/prices")
    .then((payload) => {
      records = payload.prices;
      stylingItems = records.filter((item) => item.category === "Styling").map((item) => ({ ...item, clientId: item.key }));
      initialStyling = stylingState();
      render();
      announce("Current website prices loaded.", "success");
    })
    .catch((error) => { groups.setAttribute("aria-busy", "false"); announce(error.message || "Current prices could not be loaded. Please refresh and try again.", "error"); });
})();
