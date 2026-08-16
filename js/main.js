(() => {
  const currentYear = String(new Date().getFullYear());
  document.querySelectorAll("[data-year]").forEach((element) => {
    element.textContent = currentYear;
  });

  document.querySelectorAll("[data-menu]").forEach((menu) => {
    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => menu.removeAttribute("open"));
    });
    menu.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        menu.removeAttribute("open");
        menu.querySelector("summary")?.focus();
      }
    });
  });

  document.querySelectorAll("[data-date-input]").forEach((input) => {
    input.min = new Date().toISOString().slice(0, 10);
  });

  const form = document.querySelector("[data-enquiry-form]");
  if (form instanceof HTMLFormElement) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = new FormData(form);
      const subject = "Esencia appointment enquiry — " + values.get("service");
      const body = [
        "Hello Rachel,",
        "",
        "I would like to enquire about an appointment.",
        "",
        "Name: " + values.get("name"),
        "Phone: " + values.get("phone"),
        "Email: " + values.get("email"),
        "Service: " + values.get("service"),
        "Hair length: " + values.get("hairLength"),
        "Preferred date: " + (values.get("date") || "Not specified"),
        "",
        "Message:",
        values.get("message"),
      ].join("\n");

      const status = form.querySelector("[data-form-status]");
      if (status instanceof HTMLElement) {
        status.hidden = false;
        status.focus();
      }
      window.location.href =
        "mailto:Rachsu99@gmail.com?subject=" +
        encodeURIComponent(subject) +
        "&body=" +
        encodeURIComponent(body);
    });
  }

  const lightbox = document.querySelector("[data-lightbox]");
  if (lightbox instanceof HTMLDialogElement) {
    const image = lightbox.querySelector("[data-lightbox-image]");
    const caption = lightbox.querySelector("[data-lightbox-caption]");
    const closeButton = lightbox.querySelector("[data-lightbox-close]");

    document.querySelectorAll("[data-gallery-image]").forEach((button) => {
      button.addEventListener("click", () => {
        if (image instanceof HTMLImageElement) {
          image.src = button.dataset.galleryImage || "";
          image.alt = button.dataset.galleryAlt || "";
        }
        if (caption instanceof HTMLElement) {
          caption.textContent = button.dataset.galleryCaption || "";
        }
        lightbox.showModal();
        closeButton?.focus();
      });
    });

    closeButton?.addEventListener("click", () => lightbox.close());
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) lightbox.close();
    });
  }
})();
