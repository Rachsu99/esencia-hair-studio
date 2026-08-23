(() => {
  const request = async (path, options = {}) => {
    const response = await fetch(path, {
      credentials: "same-origin",
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    let payload = {};
    try { payload = await response.json(); } catch { payload = { error: "The server returned an unreadable response." }; }
    if (!response.ok) throw new Error(payload.error || "The request could not be completed.");
    return payload;
  };

  const loginForm = document.querySelector("[data-admin-login]");
  if (loginForm instanceof HTMLFormElement) {
    const message = loginForm.querySelector("[data-admin-message]");
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = loginForm.querySelector("button[type=submit]");
      const fields = new FormData(loginForm);
      loginForm.setAttribute("aria-busy", "true");
      if (button instanceof HTMLButtonElement) button.disabled = true;
      if (message instanceof HTMLElement) { message.textContent = "Signing in…"; message.dataset.state = ""; }
      try {
        await request("/api/admin/login", {
          method: "POST",
          body: JSON.stringify({ username: fields.get("username"), password: fields.get("password") }),
        });
        if (message instanceof HTMLElement) { message.textContent = "Signed in. Opening dashboard…"; message.dataset.state = "success"; }
        window.location.assign("/admin");
      } catch (error) {
        if (message instanceof HTMLElement) message.textContent = error instanceof Error ? error.message : "Sign in failed.";
        if (button instanceof HTMLButtonElement) button.disabled = false;
        const username = loginForm.querySelector('[name="username"]');
        if (username instanceof HTMLInputElement) username.focus();
      } finally {
        loginForm.removeAttribute("aria-busy");
      }
    });
    return;
  }

  const dashboard = document.querySelector("[data-admin-dashboard]");
  if (!(dashboard instanceof HTMLElement)) return;

  let content = null;
  let status = null;
  let csrf = "";
  const notice = dashboard.querySelector("[data-admin-notice]");
  const saveButton = dashboard.querySelector("[data-admin-save]");

  const announce = (text, success = false) => {
    if (!(notice instanceof HTMLElement)) return;
    notice.textContent = text;
    notice.dataset.state = success ? "success" : "";
  };

  const field = (label, value, path, options = {}) => {
    const wrapper = document.createElement("label");
    wrapper.className = "admin-field" + (options.wide ? " admin-field--wide" : "");
    wrapper.append(document.createTextNode(label));
    const input = options.multiline ? document.createElement("textarea") : document.createElement("input");
    if (options.type) input.type = options.type;
    input.value = value || "";
    input.maxLength = options.maxLength || 240;
    input.dataset.path = path;
    if (options.required) input.required = true;
    wrapper.append(input);
    return wrapper;
  };

  const toggle = (label, checked, path) => {
    const wrapper = document.createElement("label");
    wrapper.className = "admin-toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.dataset.path = path;
    wrapper.append(input, document.createTextNode(label));
    return wrapper;
  };

  const editorCard = (title) => {
    const article = document.createElement("article");
    article.className = "admin-editor-card";
    const head = document.createElement("div");
    head.className = "admin-editor-card__head";
    const heading = document.createElement("h3");
    heading.textContent = title;
    head.append(heading);
    article.append(head);
    return { article, head };
  };

  const statusCards = (target) => {
    if (!(target instanceof HTMLElement) || !status) return;
    target.replaceChildren();
    const values = [
      ["Website", status.website], ["Domain", status.domain], ["SSL", status.ssl],
      ["Visible services", String(status.services)], ["Visible gallery", String(status.galleryItems)],
      ["Last updated", status.lastUpdated === new Date(0).toISOString() ? "Default content" : new Date(status.lastUpdated).toLocaleString()],
    ];
    for (const [label, value] of values) {
      const card = document.createElement("article");
      card.className = "admin-status-card";
      const small = document.createElement("small");
      const strong = document.createElement("strong");
      small.textContent = label;
      strong.textContent = value;
      card.append(small, strong);
      target.append(card);
    }
  };

  const render = () => {
    if (!content) return;
    statusCards(dashboard.querySelector("[data-dashboard-cards]"));
    statusCards(dashboard.querySelector("[data-status-cards]"));

    const servicesTarget = dashboard.querySelector("[data-services-editor]");
    if (servicesTarget instanceof HTMLElement) {
      servicesTarget.className = "admin-editor-list";
      servicesTarget.replaceChildren();
      for (const [slug, service] of Object.entries(content.services)) {
        const { article, head } = editorCard(service.name);
        head.append(toggle("Visible on website", service.visible, `services.${slug}.visible`));
        const grid = document.createElement("div");
        grid.className = "admin-grid";
        grid.append(
          field("Service name", service.name, `services.${slug}.name`, { required: true, maxLength: 80 }),
          field("Category", service.category, `services.${slug}.category`, { required: true, maxLength: 80 }),
          field("Starting price", service.startingPrice, `services.${slug}.startingPrice`, { required: true, maxLength: 40 }),
          field("Card summary", service.summary, `services.${slug}.summary`, { wide: true, multiline: true, required: true, maxLength: 360 }),
          field("Page introduction", service.description, `services.${slug}.description`, { wide: true, multiline: true, required: true, maxLength: 600 })
        );
        article.append(grid);
        servicesTarget.append(article);
      }
    }

    const pricingTarget = dashboard.querySelector("[data-pricing-editor]");
    if (pricingTarget instanceof HTMLElement) {
      pricingTarget.className = "admin-editor-list";
      pricingTarget.replaceChildren();
      for (const [slug, service] of Object.entries(content.services)) {
        const { article } = editorCard(service.name);
        const prices = document.createElement("div");
        prices.className = "admin-prices";
        service.prices.forEach((price, index) => {
          const row = document.createElement("div");
          row.className = "admin-price-row";
          row.append(
            field("Price item", price.label, `services.${slug}.prices.${index}.label`, { required: true, maxLength: 80 }),
            field("Price", price.price, `services.${slug}.prices.${index}.price`, { required: true, maxLength: 40 })
          );
          prices.append(row);
        });
        article.append(prices);
        pricingTarget.append(article);
      }
    }

    const galleryTarget = dashboard.querySelector("[data-gallery-editor]");
    if (galleryTarget instanceof HTMLElement) {
      galleryTarget.className = "admin-gallery-list";
      galleryTarget.replaceChildren();
      content.gallery.forEach((item, index) => {
        const article = document.createElement("article");
        article.className = "admin-gallery-item";
        const image = document.createElement("img");
        image.src = `/${item.image}`;
        image.alt = "";
        image.loading = "lazy";
        image.width = 125;
        image.height = 165;
        const controls = document.createElement("div");
        const head = document.createElement("div");
        head.className = "admin-editor-card__head";
        const heading = document.createElement("h3");
        heading.textContent = `Image ${index + 1}`;
        head.append(heading, toggle("Visible", item.visible, `gallery.${index}.visible`));
        const grid = document.createElement("div");
        grid.className = "admin-grid";
        grid.append(
          field("Title", item.title, `gallery.${index}.title`, { required: true, maxLength: 100 }),
          field("Category", item.category, `gallery.${index}.category`, { required: true, maxLength: 80 }),
          field("Alternative text", item.alt, `gallery.${index}.alt`, { required: true, maxLength: 180 })
        );
        controls.append(head, grid);
        article.append(image, controls);
        galleryTarget.append(article);
      });
    }

    const contactTarget = dashboard.querySelector("[data-contact-editor]");
    if (contactTarget instanceof HTMLElement) {
      contactTarget.replaceChildren(
        field("General email", content.contact.email, "contact.email", { required: true, type: "email", maxLength: 254 }),
        field("Bookings email", content.contact.bookingsEmail, "contact.bookingsEmail", { required: true, type: "email", maxLength: 254 }),
        field("Phone (optional)", content.contact.phone, "contact.phone", { type: "tel", maxLength: 40 }),
        field("Instagram URL", content.contact.instagram, "contact.instagram", { required: true, type: "url", maxLength: 500 }),
        field("Instagram handle", content.contact.instagramHandle, "contact.instagramHandle", { required: true, maxLength: 80 }),
        field("Address (optional)", content.contact.address, "contact.address", { wide: true, maxLength: 240 }),
        field("Opening hours (optional)", content.contact.openingHours, "contact.openingHours", { wide: true, maxLength: 240 }),
        field("External booking link (optional)", content.contact.bookingLink, "contact.bookingLink", { wide: true, type: "url", maxLength: 500 })
      );
    }

    const seoTarget = dashboard.querySelector("[data-seo-editor]");
    if (seoTarget instanceof HTMLElement) {
      seoTarget.replaceChildren(
        field("Business name", content.seo.businessName, "seo.businessName", { required: true, maxLength: 100 }),
        field("Canonical domain", content.seo.canonicalDomain, "seo.canonicalDomain", { required: true, type: "url", maxLength: 500 }),
        field("Homepage title", content.seo.homepageTitle, "seo.homepageTitle", { wide: true, required: true, maxLength: 70 }),
        field("Search description", content.seo.metaDescription, "seo.metaDescription", { wide: true, multiline: true, required: true, maxLength: 170 }),
        field("Social description", content.seo.socialDescription, "seo.socialDescription", { wide: true, multiline: true, required: true, maxLength: 220 }),
        field("Social image path", content.seo.defaultOgImage, "seo.defaultOgImage", { wide: true, required: true, maxLength: 240 })
      );
    }
  };

  const setValue = (path, value) => {
    const parts = path.split(".");
    let target = content;
    for (let index = 0; index < parts.length - 1; index += 1) target = target[parts[index]];
    target[parts.at(-1)] = value;
  };

  dashboard.addEventListener("input", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) || !input.dataset.path) return;
    setValue(input.dataset.path, input instanceof HTMLInputElement && input.type === "checkbox" ? input.checked : input.value);
  });

  dashboard.querySelectorAll("[data-admin-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.getAttribute("data-admin-section");
      dashboard.querySelectorAll("[data-admin-section]").forEach((item) => item.removeAttribute("aria-current"));
      button.setAttribute("aria-current", "page");
      dashboard.querySelectorAll("[data-panel]").forEach((panel) => { panel.hidden = panel.getAttribute("data-panel") !== section; });
      const heading = dashboard.querySelector("[data-admin-heading]");
      if (heading instanceof HTMLElement) heading.textContent = button.textContent || "Dashboard";
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  });

  if (saveButton instanceof HTMLButtonElement) {
    saveButton.addEventListener("click", async () => {
      dashboard.setAttribute("aria-busy", "true");
      saveButton.disabled = true;
      announce("Saving approved changes…");
      try {
        const payload = await request("/api/admin/content", {
          method: "PUT",
          headers: { "X-CSRF-Token": csrf },
          body: JSON.stringify(content),
        });
        content = payload.content;
        status.lastUpdated = content.updatedAt;
        render();
        announce("Changes saved. Public pages now use the approved content.", true);
      } catch (error) {
        announce(error instanceof Error ? error.message : "Changes could not be saved.");
      } finally {
        saveButton.disabled = false;
        dashboard.removeAttribute("aria-busy");
      }
    });
  }

  const logout = dashboard.querySelector("[data-admin-logout]");
  logout?.addEventListener("click", async () => {
    try { await request("/api/admin/logout", { method: "POST", headers: { "X-CSRF-Token": csrf }, body: "{}" }); }
    finally { window.location.assign("/admin"); }
  });

  request("/api/admin/session")
    .then((payload) => {
      content = payload.content;
      status = payload.status;
      csrf = payload.csrf;
      render();
    })
    .catch(() => window.location.assign("/admin"));
})();
