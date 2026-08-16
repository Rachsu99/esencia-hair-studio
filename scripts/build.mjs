import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { galleryImages, pricingNote, services, site, treatmentFaqs } from "../site.config.mjs";

const root = process.cwd();
const productionUrl = (process.env.SITE_URL || site.url || "").replace(/\/$/, "");
const year = new Date().getFullYear();
const instagramLabel = site.instagramHandle;

const routeFor = (file) =>
  file === "index.html" ? "/" : "/" + file.replace(/\.html$/, "");

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const navItems = [
  ["Home", "index.html", "home"],
  ["Services", "services.html", "services"],
  ["Keratin", "keratin.html", "keratin"],
  ["Nanoplasty", "nanoplasty.html", "nanoplasty"],
  ["Gallery", "gallery.html", "gallery"],
  ["About", "about.html", "about"],
  ["Contact", "contact.html", "contact"],
];

function brandMark(compact = false) {
  return [
    '<span class="brand-mark' + (compact ? " brand-mark--compact" : "") + '">',
    '<img src="assets/images/brand/esencia-logo.webp" width="760" height="451" alt="">',
    "</span>",
  ].join("");
}

function navigation(active, mobile = false) {
  const links = navItems
    .map(([label, href, key]) => {
      const current = active === key ? ' aria-current="page"' : "";
      return '<a href="' + href + '"' + current + ">" + label + "</a>";
    })
    .join("");
  return (
    '<nav class="' +
    (mobile ? "mobile-nav" : "desktop-nav") +
    '" aria-label="' +
    (mobile ? "Mobile navigation" : "Main navigation") +
    '">' +
    links +
    '<a class="button button--small" href="book.html">Book appointment</a></nav>'
  );
}

function header(active) {
  return [
    '<a class="skip-link" href="#main-content">Skip to content</a>',
    '<div class="announcement">Beautiful hair starts with healthy-looking hair.</div>',
    '<header class="site-header">',
    '<a class="logo-link" href="index.html" aria-label="Esencia Hair Studio home">' + brandMark(true) + "</a>",
    navigation(active),
    '<details class="menu" data-menu>',
    '<summary><span>Menu</span><i aria-hidden="true"></i></summary>',
    navigation(active, true),
    "</details>",
    "</header>",
  ].join("\n");
}

function footer() {
  return [
    '<footer class="footer">',
    '<div class="shell footer__grid">',
    '<div class="footer__brand">' + brandMark() + '<p>Personalised haircuts and smoothing treatments, delivered with care and a refined, wearable finish.</p><a class="text-link" href="' + site.instagram + '" target="_blank" rel="noopener noreferrer">Follow ' + instagramLabel + " ↗</a></div>",
    '<div><p class="footer__heading">Explore</p><a href="index.html">Home</a><a href="services.html">Services</a><a href="gallery.html">Gallery</a><a href="about.html">About</a></div>',
    '<div><p class="footer__heading">Services</p><a href="haircuts.html">Ladies haircuts</a><a href="keratin.html">Keratin smoothing</a><a href="nanoplasty.html">Nanoplasty</a></div>',
    '<div><p class="footer__heading">Contact</p><a href="mailto:' + site.email + '">' + site.email + '</a><a href="' + site.instagram + '" target="_blank" rel="noopener noreferrer">' + instagramLabel + ' ↗</a><p>Location and opening hours are confirmed with your appointment.</p><a class="button button--light button--small" href="book.html">Request appointment</a></div>',
    "</div>",
    '<div class="shell footer__bottom"><span>© <span data-year>' + year + "</span> Esencia Hair Studio. All rights reserved.</span><span>Appointments are arranged directly with Rachel.</span></div>",
    "</footer>",
    '<a class="mobile-cta" href="book.html">Book appointment</a>',
  ].join("\n");
}

function schema() {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "HairSalon",
    name: site.name,
    email: site.email,
    sameAs: [site.instagram],
    priceRange: "$$",
    description: "Boutique hair studio offering personalised ladies haircuts, Keratin smoothing and Nanoplasty.",
  }).replaceAll("<", "\\u003c");
}

function layout({ file, active, title, description, content, socialImage = "assets/images/brand/esencia-social-share.jpg", indexable = true }) {
  const canonical = productionUrl && indexable ? productionUrl + routeFor(file) : "";
  const socialUrl = productionUrl && socialImage ? productionUrl + "/" + socialImage : "";
  const productionMeta = [
    canonical ? '<link rel="canonical" href="' + canonical + '">' : "",
    canonical ? '<meta property="og:url" content="' + canonical + '">' : "",
    socialUrl ? '<meta property="og:image" content="' + socialUrl + '">' : "",
    socialUrl ? '<meta name="twitter:image" content="' + socialUrl + '">' : "",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "<!doctype html>",
    '<html lang="en-NZ">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="theme-color" content="#faf7f3">',
    "<title>" + escapeHtml(title) + "</title>",
    '<meta name="description" content="' + escapeHtml(description) + '">',
    '<meta name="robots" content="' + (indexable ? "index,follow" : "noindex,follow") + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:locale" content="en_NZ">',
    '<meta property="og:site_name" content="' + site.name + '">',
    '<meta property="og:title" content="' + escapeHtml(title) + '">',
    '<meta property="og:description" content="' + escapeHtml(description) + '">',
    '<meta name="twitter:card" content="' + (socialUrl ? "summary_large_image" : "summary") + '">',
    '<meta name="twitter:title" content="' + escapeHtml(title) + '">',
    '<meta name="twitter:description" content="' + escapeHtml(description) + '">',
    productionMeta,
    '<link rel="icon" type="image/webp" href="assets/images/brand/esencia-logo.webp">',
    '<link rel="preload" href="css/style.css" as="style">',
    '<link rel="stylesheet" href="css/style.css">',
    '<script type="application/ld+json">' + schema() + "</script>",
    '<script src="js/main.js" defer></script>',
    "</head>",
    "<body>",
    header(active),
    '<main id="main-content">',
    content,
    "</main>",
    footer(),
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

function sectionHeading(eyebrow, title, copy = "", align = "") {
  return [
    '<div class="section-heading' + (align === "center" ? " section-heading--center" : "") + '">',
    '<p class="eyebrow">' + eyebrow + "</p>",
    "<h2>" + title + "</h2>",
    copy ? '<p class="section-heading__copy">' + copy + "</p>" : "",
    "</div>",
  ].join("");
}

function pageHero(eyebrow, title, copy, image, width, height, alt, dark = false) {
  return [
    '<section class="page-hero' + (dark ? " page-hero--dark" : "") + '">',
    '<div class="shell page-hero__inner">',
    '<div><p class="eyebrow">' + eyebrow + "</p><h1>" + title + '</h1><p>' + copy + '</p><div class="button-row"><a class="button" href="book.html">Request appointment</a><a class="text-link" href="services.html">View all services →</a></div></div>',
    '<figure class="page-hero__image"><img src="' + image + '" width="' + width + '" height="' + height + '" alt="' + alt + '" fetchpriority="high"></figure>',
    "</div>",
    "</section>",
  ].join("");
}

function serviceCards() {
  return (
    '<div class="service-grid">' +
    services
      .map(
        (service, index) =>
          '<article class="service-card"><a class="service-card__image" href="' +
          service.file +
          '"><img src="' +
          service.image +
          '" width="' +
          service.width +
          '" height="' +
          service.height +
          '" alt="' +
          service.alt +
          '" loading="' +
          "lazy" +
          '"><span>0' +
          (index + 1) +
          '</span></a><div class="service-card__body"><p class="eyebrow">' +
          service.eyebrow +
          "</p><h3>" +
          service.name +
          "</h3><p>" +
          service.summary +
          '</p><div class="service-card__footer"><strong>' +
          service.startingPrice +
          '</strong><a class="text-link" href="' +
          service.file +
          '">Explore service →</a></div></div></article>'
      )
      .join("") +
    "</div>"
  );
}

function pricingNoteBlock() {
  return '<div class="pricing-note"><span>A note on pricing</span><p>' + pricingNote + "</p></div>";
}

function comparison() {
  const rows = [
    ["Primary goal", "Softer, smoother manageability", "A sleeker, more intensive smoothing finish"],
    ["Finish", "Soft and polished", "Sleek and glossy"],
    ["Frizz", "Designed to reduce frizz", "Designed for intensive smoothing"],
    ["Starting price", "From $180", "From $280"],
    ["Consultation", "Recommended", "Essential"],
  ];
  return [
    '<div class="comparison-wrap">',
    '<div class="comparison" role="table" aria-label="Keratin and Nanoplasty comparison">',
    '<div class="comparison__row comparison__head" role="row"><span></span><strong>Keratin</strong><strong>Nanoplasty</strong></div>',
    rows
      .map(
        ([label, keratin, nano]) =>
          '<div class="comparison__row" role="row"><span>' + label + "</span><span>" + keratin + "</span><span>" + nano + "</span></div>"
      )
      .join(""),
    "</div>",
    '<div class="comparison-cta"><p>Not sure which treatment is right for you?</p><a class="button button--light" href="book.html">Request a consultation</a></div>',
    "</div>",
  ].join("");
}

function faq(items = treatmentFaqs) {
  return (
    '<div class="faq-list">' +
    items
      .map(
        ([question, answer]) =>
          '<details><summary><span>' + question + '</span><span aria-hidden="true">+</span></summary><p>' + answer + "</p></details>"
      )
      .join("") +
    "</div>"
  );
}

function cta(title = "Ready for hair that feels more like you?", copy = "Start with a conversation. Rachel will help you choose the service that suits your hair, your routine and the result you want.") {
  return [
    '<section class="cta-section">',
    '<div class="shell cta-section__inner"><p class="eyebrow">Your next appointment</p><h2>' + title + '</h2><p>' + copy + '</p><div class="button-row button-row--center"><a class="button button--light" href="book.html">Request appointment</a><a class="text-link text-link--light" href="mailto:' + site.email + '">Email ' + site.email + " →</a></div></div>",
    "</section>",
  ].join("");
}

function allPrices() {
  return (
    '<div class="all-prices">' +
    services
      .map(
        (service) =>
          '<article><p class="eyebrow">' +
          service.eyebrow +
          "</p><h3>" +
          service.name +
          "</h3>" +
          service.prices.map(([label, price]) => "<div><span>" + label + "</span><strong>" + price + "</strong></div>").join("") +
          '<a class="text-link" href="' +
          service.file +
          '">Service details →</a></article>'
      )
      .join("") +
    "</div>"
  );
}

function contactForm() {
  return [
    '<form class="contact-form" id="enquiry" data-enquiry-form>',
    '<div class="form-intro"><p class="eyebrow">Appointment enquiry</p><h2>Tell Rachel about your hair</h2><p>Complete the details below and we will prepare an email to ' + site.email + ' in your email app. Nothing is submitted to a server from this website.</p></div>',
    '<div class="form-grid">',
    '<label>Full name<input name="name" autocomplete="name" required></label>',
    '<label>Phone<input name="phone" type="tel" autocomplete="tel" required></label>',
    '<label>Email<input name="email" type="email" autocomplete="email" required></label>',
    '<label>Service interested in<select name="service" required><option value="" selected disabled>Select a service</option><option>Ladies Haircut</option><option>Shampoo, Treatment &amp; Haircut</option><option>Keratin Smoothing</option><option>Nanoplasty</option><option>Consultation</option><option>Other</option></select></label>',
    '<label>Hair length<select name="hairLength" required><option value="" selected disabled>Select hair length</option><option>Short</option><option>Medium</option><option>Long</option><option>Extra long / thick</option><option>Not sure</option></select></label>',
    '<label>Preferred date<input name="date" type="date" data-date-input></label>',
    '<label class="form-grid__full">Message<textarea name="message" rows="5" placeholder="What would you like help with?" required></textarea></label>',
    "</div>",
    '<div class="form-actions"><button class="button" type="submit">Prepare email enquiry</button><span>Or email <a href="mailto:' + site.email + '">' + site.email + "</a></span></div>",
    '<div class="form-success" role="status" tabindex="-1" data-form-status hidden><strong>Your enquiry is ready.</strong><p>Your email application should open with the details filled in. Review the message, then press send.</p></div>',
    "</form>",
  ].join("");
}

function resultsPanel(wide = false) {
  return '<div class="result-placeholder' + (wide ? " result-placeholder--wide" : "") + '" aria-label="Esencia Hair Studio brand artwork"><div><span>Shape</span></div><div><span>Shine</span></div><p>See current Esencia work on Instagram</p></div>';
}

function homePage() {
  const instagramTiles = galleryImages
    .slice(0, 4)
    .map(
      ([image, width, height, alt]) =>
        '<a href="' + site.instagram + '" target="_blank" rel="noopener noreferrer"><img src="' + image + '" width="' + width + '" height="' + height + '" alt="' + alt + '" loading="lazy"><span>' + instagramLabel + "</span></a>"
    )
    .join("");

  return [
    '<section class="home-hero"><div class="shell home-hero__grid">',
    '<div class="home-hero__copy"><p class="eyebrow">Boutique hair studio · Personalised care</p><h1>Beautiful hair.<br><em>Effortlessly you.</em></h1><p class="home-hero__lead">A personal studio experience for considered cuts, smoother texture and healthy-looking, beautifully wearable hair.</p><div class="button-row"><a class="button" href="book.html">Book your appointment</a><a class="text-link" href="services.html">Explore treatments →</a></div><div class="home-hero__meta"><span>01</span><p>Ladies haircuts · Keratin smoothing<br>Nanoplasty · Consultations</p></div></div>',
    '<div class="home-hero__visual"><figure class="hero-photo hero-photo--main"><img src="assets/images/editorial/dark-hair.webp" width="1400" height="1709" alt="Woman with softly layered dark hair" fetchpriority="high"></figure><figure class="hero-photo hero-photo--detail"><img src="assets/images/editorial/silky-hair.webp" width="1400" height="934" alt="Long smooth dark hair"></figure><div class="hero-stamp"><span>Personalised</span><strong>for you</strong></div></div>',
    '</div><div class="marquee" aria-hidden="true"><span>Thoughtful consultations</span><i>✦</i><span>Beautifully wearable results</span><i>✦</i><span>A warm, refined experience</span></div></section>',
    '<section class="story-section"><div class="shell story-grid"><figure class="story-image"><img src="assets/images/editorial/consultation.webp" width="1400" height="934" alt="A personal hair consultation in a bright salon" loading="lazy"><figcaption>Personal from the first conversation.</figcaption></figure><div class="story-copy"><p class="eyebrow">Welcome to Esencia</p><h2>Your hair, understood.</h2><p>A personalised hair experience focused on beautiful results, healthy-looking hair and styles designed around you.</p><p>Whether you are refreshing your shape or exploring a smoothing treatment, each appointment is approached with warmth, honesty and attention to detail.</p><a class="text-link" href="about.html">Discover the studio →</a></div></div></section>',
    '<section class="section shell">' + sectionHeading("Services", "Carefully chosen. Beautifully finished.", "Three considered services, each beginning with a conversation about your hair and the result you want.") + serviceCards() + pricingNoteBlock() + "</section>",
    '<section class="section section--soft"><div class="shell">' + sectionHeading("Treatment guide", "Keratin or Nanoplasty?", "Two distinct smoothing services, compared simply. Your consultation is where the right choice becomes clear.") + comparison() + "</div></section>",
    '<section class="results-section"><div class="shell results-grid"><div class="results-copy"><p class="eyebrow">Current work</p><h2>Transformations, without the guesswork.</h2><p>Visit Rachel’s official Instagram for current Esencia cuts, smoothing services and transformations.</p><a class="button button--outline" href="' + site.instagram + '" target="_blank" rel="noopener noreferrer">See current results ↗</a></div>' + resultsPanel() + "</div></section>",
    '<section class="instagram-section"><div class="shell"><div class="instagram-heading">' + sectionHeading("From the studio", "Follow our transformations.", "Follow Rachel’s official account for current Esencia work, appointment updates and studio inspiration.") + '<a class="button" href="' + site.instagram + '" target="_blank" rel="noopener noreferrer">Follow on Instagram ↗</a></div><div class="instagram-grid">' + instagramTiles + "</div></div></section>",
    '<section class="section shell faq-section">' + sectionHeading("Good to know", "Before you book") + faq() + "</section>",
    cta(),
  ].join("\n");
}

function servicesPage() {
  return [
    pageHero("Services & pricing", "Beautifully tailored to you.", "Considered cuts and smoothing services, with clear starting prices and a consultation-led approach.", "assets/images/editorial/long-hair.webp", 1400, 2100, "Long softly styled brown hair"),
    '<section class="section shell">' + sectionHeading("The menu", "Services and starting prices.", "Choose a service to see the full experience, benefits and pricing guide.") + allPrices() + pricingNoteBlock() + "</section>",
    '<section class="section section--soft"><div class="shell">' + sectionHeading("Compare treatments", "Smoothing, made simpler.") + comparison() + "</div></section>",
    cta(),
  ].join("\n");
}

function servicePage(service) {
  const isCut = service.slug === "haircuts";
  const serviceFaqs = isCut
    ? [
        ["What is included in a haircut appointment?", "Your appointment begins with a consultation and includes a professionally tailored haircut and finish."],
        ["Can I add a treatment?", "Yes. The Shampoo, Treatment & Haircut service is available from $95."],
        ["How should I prepare?", "Bring reference images if helpful and tell Rachel how you usually wear and style your hair."],
      ]
    : treatmentFaqs;

  return [
    pageHero(service.eyebrow, service.name, service.intro, service.image, service.width, service.height, service.alt, true),
    '<section class="section shell service-intro"><div>' + sectionHeading("Who it may suit", isCut ? "A shape made for real life." : "A smoother way to wear your hair.", service.suit) + "<p>" + service.summary + '</p></div><ul class="benefit-list">' + service.benefits.map((benefit, index) => "<li><span>0" + (index + 1) + "</span>" + benefit + "</li>").join("") + "</ul></section>",
    '<section class="section section--soft"><div class="shell price-layout"><div>' + sectionHeading("Pricing", "A clear starting point.") + (isCut ? '<p class="section-heading__copy">Choose a tailored haircut or add a shampoo and conditioning treatment.</p>' : pricingNoteBlock()) + '</div><div class="price-guide">' + service.prices.map(([label, price], index) => '<div class="price-row"><span class="price-row__number">0' + (index + 1) + "</span><span>" + label + "</span><strong>" + price + "</strong></div>").join("") + "</div></div></section>",
    '<section class="section shell">' + sectionHeading("Your appointment", "A thoughtful process, from hello to finish.") + '<div class="process-grid">' + [
      ["01", "Consult", "We start with your hair, routine and desired result."],
      ["02", "Assess", "Rachel considers condition, length, thickness and suitability."],
      ["03", "Create", "Your service is delivered with care and attention to detail."],
      ["04", "Guide", "You leave with clear, practical guidance for your hair."],
    ].map(([number, title, copy]) => "<article><span>" + number + "</span><h3>" + title + "</h3><p>" + copy + "</p></article>").join("") + "</div></section>",
    '<section class="result-band"><div class="shell">' + sectionHeading("Current work", "See Rachel’s latest results.", "Visit the official Esencia Instagram account for current cuts, smoothing services and transformations.", "center") + resultsPanel(true) + '<div class="button-row button-row--center"><a class="button button--outline" href="' + site.instagram + '" target="_blank" rel="noopener noreferrer">View results on Instagram ↗</a></div></div></section>',
    '<section class="section shell faq-section">' + sectionHeading("Questions", "About " + service.name) + faq(serviceFaqs) + "</section>",
    cta("Let’s plan your " + service.name.toLowerCase() + ".", "Tell Rachel about your hair and the finish you have in mind. Your consultation will confirm suitability, timing and final pricing."),
  ].join("\n");
}

function galleryPage() {
  const tiles = galleryImages
    .map(
      ([image, width, height, alt, category], index) =>
        '<button class="gallery-tile gallery-tile--' + (index + 1) + '" type="button" data-gallery-image="' + image + '" data-gallery-alt="' + alt + '" data-gallery-caption="' + category + ' · Editorial image"><img src="' + image + '" width="' + width + '" height="' + height + '" alt="' + alt + '" loading="lazy"><span><small>' + category + "</small><b>View</b></span></button>"
    )
    .join("");
  return [
    pageHero("The work", "Hair, in its best light.", "Explore the Esencia aesthetic, then visit Rachel’s official Instagram account for current client work and transformations.", "assets/images/editorial/glossy-hair.webp", 1400, 2101, "Long glossy brunette hair"),
    '<section class="section shell"><div class="gallery-intro">' + sectionHeading("Gallery", "Shape. Softness. Shine.", "A visual introduction to the considered shapes, smooth finishes and healthy-looking shine that inspire Esencia.") + '<a class="button" href="' + site.instagram + '" target="_blank" rel="noopener noreferrer">Current work on Instagram ↗</a></div><div class="gallery-grid">' + tiles + '</div><p class="image-note">Editorial photography is used for visual presentation and is not presented as Esencia client work.</p></section>',
    '<dialog class="lightbox" data-lightbox aria-label="Gallery image"><button class="lightbox__close" type="button" data-lightbox-close>Close ×</button><img data-lightbox-image src="assets/images/editorial/dark-hair.webp" width="1400" height="1709" alt=""><p data-lightbox-caption></p></dialog>',
    cta(),
  ].join("\n");
}

function aboutPage() {
  return [
    pageHero("About Esencia", "Personal by nature. Refined by design.", "A boutique hair studio centred on considered consultations, individual care and beautifully wearable results.", "assets/images/editorial/consultation.webp", 1400, 934, "Personal consultation in a light-filled salon"),
    '<section class="section shell about-story"><div><p class="eyebrow">Meet Rachel</p><h2>A personal studio, created around the client in the chair.</h2></div><div><p>At the heart of Esencia is Rachel and a simple idea: your hair appointment should feel considered from beginning to end.</p><p>That means listening first, choosing services thoughtfully and creating a finish that works with your hair and your life — not just for the moment you leave the salon.</p><p>Follow Rachel on Instagram for current Esencia work, transformations and studio updates.</p></div></section>',
    '<section class="values-section"><div class="shell">' + sectionHeading("The approach", "Warm. Honest. Thoughtful.", "", "center") + '<div class="values-grid">' + [
      ["01", "Listen first", "Every appointment begins with a real conversation about your hair and your desired result."],
      ["02", "Treat with intention", "Services are recommended thoughtfully, with clear starting prices and expectations."],
      ["03", "Create for real life", "The finish should feel polished in the studio and manageable once you are home."],
    ].map(([number, title, copy]) => "<article><span>" + number + "</span><h3>" + title + "</h3><p>" + copy + "</p></article>").join("") + "</div></div></section>",
    '<section class="section shell about-quote"><figure><img src="assets/images/editorial/dark-hair.webp" width="1400" height="1709" alt="Editorial portrait with softly layered hair" loading="lazy"></figure><blockquote><span>Esencia</span><p>“The essence of beautiful hair is a result that still feels like you.”</p><small>Brand philosophy</small></blockquote></section>',
    cta(),
  ].join("\n");
}

function contactPage(isBooking = false) {
  return [
    '<section class="' + (isBooking ? "simple-hero shell" : "contact-hero") + '">' +
      (isBooking
        ? '<p class="eyebrow">Book an appointment</p><h1>Let’s begin with your hair.</h1><p>Share a little about what you are considering and Rachel will help you choose the right appointment.</p>'
        : '<div class="shell contact-hero__grid"><div><p class="eyebrow">Contact & book</p><h1>Let’s talk about your hair.</h1><p>Tell Rachel what you are considering and she’ll help you choose the right appointment.</p></div><div class="contact-details"><div><span>01</span><small>Email</small><a href="mailto:' + site.email + '">' + site.email + '</a></div><div><span>02</span><small>Instagram</small><a href="' + site.instagram + '" target="_blank" rel="noopener noreferrer">' + instagramLabel + ' ↗</a></div><div><span>03</span><small>Studio details</small><p>Location and opening hours are confirmed directly with your appointment.</p></div></div></div>') +
      "</section>",
    '<section class="section shell">' + contactForm() + "</section>",
  ].join("\n");
}

const pages = [
  ["index.html", "home", "Esencia Hair Studio | Premium Haircuts & Smoothing", "Personalised ladies haircuts, Keratin smoothing and Nanoplasty in a warm, refined studio experience.", homePage()],
  ["services.html", "services", "Services & Pricing | Esencia Hair Studio", "Explore ladies haircuts, Keratin smoothing and Nanoplasty services and pricing at Esencia Hair Studio.", servicesPage()],
  ...services.map((service) => [service.file, service.slug, service.name + " | Esencia Hair Studio", "Explore " + service.name + " benefits, pricing and the consultation-led experience at Esencia Hair Studio.", servicePage(service), service.image]),
  ["gallery.html", "gallery", "Gallery | Esencia Hair Studio", "Explore the Esencia Hair Studio aesthetic and visit Rachel’s official Instagram account for current client work.", galleryPage()],
  ["about.html", "about", "About | Esencia Hair Studio", "Meet Rachel and discover the warm, personalised philosophy behind Esencia Hair Studio.", aboutPage()],
  ["contact.html", "contact", "Contact & Book | Esencia Hair Studio", "Contact Esencia Hair Studio or prepare an appointment enquiry for Rachel.", contactPage(false)],
  ["book.html", "book", "Book an Appointment | Esencia Hair Studio", "Prepare an appointment enquiry for a haircut, Keratin smoothing, Nanoplasty or consultation.", contactPage(true)],
];

await rm(path.join(root, "dist"), { recursive: true, force: true });
await mkdir(path.join(root, "dist"), { recursive: true });

for (const [file, active, title, description, content, socialImage] of pages) {
  const output = layout({ file, active, title, description, content, socialImage });
  await writeFile(path.join(root, file), output, "utf8");
  await writeFile(path.join(root, "dist", file), output, "utf8");
}

const notFound = layout({
  file: "404.html",
  active: "",
  title: "Page Not Found | Esencia Hair Studio",
  description: "The requested page could not be found.",
  socialImage: "",
  indexable: false,
  content:
    '<section class="simple-hero shell"><p class="eyebrow">404 · Page not found</p><h1>Let’s find your way back.</h1><p>The page you requested may have moved or no longer exists.</p><div class="button-row button-row--center"><a class="button" href="index.html">Return home</a><a class="text-link" href="contact.html">Contact Esencia →</a></div></section>',
});
await writeFile(path.join(root, "404.html"), notFound, "utf8");
await writeFile(path.join(root, "dist", "404.html"), notFound, "utf8");

for (const directory of ["assets", "css", "js"]) {
  await cp(path.join(root, directory), path.join(root, "dist", directory), { recursive: true });
}
await cp(path.join(root, "robots.txt"), path.join(root, "dist", "robots.txt"));
await cp(path.join(root, "_headers"), path.join(root, "dist", "_headers"));

const expectedFiles = new Set(pages.map(([file]) => file));
for (const [file] of pages) {
  const html = await readFile(path.join(root, file), "utf8");
  if (!html.includes(site.email) || !html.includes(site.instagram)) {
    throw new Error(file + " is missing confirmed Esencia contact details.");
  }
  if (html.includes("localhost") || html.includes("http://127.0.0.1")) {
    throw new Error(file + " contains a local development URL.");
  }
  for (const match of html.matchAll(/href="([^"#?]+\.html)(?:#[^"]*)?"/g)) {
    if (!expectedFiles.has(match[1])) {
      throw new Error(file + " links to missing page " + match[1]);
    }
  }
}

if (productionUrl) {
  const sitemap = pages
    .map(([file]) => "  <url><loc>" + productionUrl + routeFor(file) + "</loc></url>")
    .join("\n");
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + sitemap + "\n</urlset>\n";
  await writeFile(path.join(root, "sitemap.xml"), xml, "utf8");
  await writeFile(path.join(root, "dist", "sitemap.xml"), xml, "utf8");
}

console.log("Built " + pages.length + " primary Esencia pages plus a custom 404 in the project root and dist/.");
