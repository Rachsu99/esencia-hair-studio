(() => {
  const currentYear = String(new Date().getFullYear());
  document.querySelectorAll("[data-year]").forEach((element) => {
    element.textContent = currentYear;
  });

  const menus = Array.from(document.querySelectorAll("[data-menu]"));
  const syncMenuState = () => {
    const isOpen = menus.some((menu) => menu.hasAttribute("open"));
    document.body.classList.toggle("menu-open", isOpen);
    menus.forEach((menu) => {
      const summary = menu.querySelector("summary");
      summary?.setAttribute("aria-expanded", String(menu.hasAttribute("open")));
    });
  };

  menus.forEach((menu) => {
    menu.addEventListener("toggle", syncMenuState);
    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        menu.removeAttribute("open");
        syncMenuState();
      });
    });
    menu.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        menu.removeAttribute("open");
        syncMenuState();
        menu.querySelector("summary")?.focus();
      }
    });
  });
  document.addEventListener("pointerdown", (event) => {
    menus.forEach((menu) => {
      if (menu.hasAttribute("open") && !menu.contains(event.target)) menu.removeAttribute("open");
    });
    syncMenuState();
  }, { passive: true });
  const desktopQuery = window.matchMedia("(min-width: 1051px)");
  desktopQuery.addEventListener("change", (event) => {
    if (!event.matches) return;
    menus.forEach((menu) => menu.removeAttribute("open"));
    syncMenuState();
  });
  syncMenuState();

  document.querySelectorAll("[data-date-input]").forEach((input) => {
    const localDate = new Date();
    localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
    input.min = localDate.toISOString().slice(0, 10);
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
      const emailLink = form.querySelector('a[href^="mailto:"]');
      const recipient = emailLink instanceof HTMLAnchorElement
        ? emailLink.href.replace(/^mailto:/i, "").split("?")[0]
        : "Bookings@esenciahair.co.nz";
      window.location.href =
        "mailto:" + recipient + "?subject=" +
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
    const previousButton = lightbox.querySelector("[data-lightbox-previous]");
    const nextButton = lightbox.querySelector("[data-lightbox-next]");
    const galleryButtons = Array.from(document.querySelectorAll("[data-gallery-image]"));
    let activeIndex = 0;
    let activeTrigger = null;

    const showImage = (index) => {
      activeIndex = (index + galleryButtons.length) % galleryButtons.length;
      const button = galleryButtons[activeIndex];
      if (!button) return;
      if (image instanceof HTMLImageElement) {
        image.src = button.dataset.galleryImage || "";
        image.width = Number(button.dataset.galleryWidth) || 1080;
        image.height = Number(button.dataset.galleryHeight) || 1331;
        image.alt = button.dataset.galleryAlt || "";
      }
      if (caption instanceof HTMLElement) {
        const category = button.dataset.galleryCaption || "Gallery image";
        caption.textContent = `${activeIndex + 1} of ${galleryButtons.length} · ${category}`;
      }
    };

    galleryButtons.forEach((button, index) => {
      button.addEventListener("click", () => {
        activeTrigger = button;
        showImage(index);
        lightbox.showModal();
        closeButton?.focus();
      });
    });

    closeButton?.addEventListener("click", () => lightbox.close());
    previousButton?.addEventListener("click", () => showImage(activeIndex - 1));
    nextButton?.addEventListener("click", () => showImage(activeIndex + 1));
    lightbox.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        lightbox.close();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showImage(activeIndex - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        showImage(activeIndex + 1);
      }
    });
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) lightbox.close();
    });
    lightbox.addEventListener("close", () => {
      if (activeTrigger instanceof HTMLElement) activeTrigger.focus();
    });
  }
})();
