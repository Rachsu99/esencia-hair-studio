const documentShell = (title: string, body: string) => `<!doctype html>
<html lang="en-NZ">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="theme-color" content="#2d1c18">
<title>${title}</title>
<link rel="icon" type="image/webp" href="/assets/images/brand/esencia-logo.webp">
<link rel="stylesheet" href="/css/admin.css?v=20260816c">
<script src="/js/admin.js?v=20260816" defer></script>
</head>
<body class="admin-body">${body}</body>
</html>`;

export const loginHtml = () =>
  documentShell(
    "Admin Login | Esencia Hair Studio",
    `<main class="admin-login">
      <section class="admin-login__card" aria-labelledby="login-title">
        <img class="admin-login__logo" src="/assets/images/brand/esencia-logo.webp" width="760" height="451" alt="Esencia Hair Studio">
        <p class="admin-eyebrow">Private administration</p>
        <h1 id="login-title">Welcome back.</h1>
        <p>Sign in to manage approved Esencia website content.</p>
        <form class="admin-form" data-admin-login>
          <label>Username<input name="username" autocomplete="username" required maxlength="80"></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" required maxlength="256"></label>
          <button class="admin-button" type="submit">Sign in securely</button>
          <p class="admin-message" role="status" aria-live="polite" data-admin-message></p>
        </form>
        <a class="admin-back" href="/">← Return to website</a>
      </section>
    </main>`
  );

export const dashboardHtml = () =>
  documentShell(
    "Admin Dashboard | Esencia Hair Studio",
    `<div class="admin-shell" data-admin-dashboard>
      <aside class="admin-sidebar">
        <a href="/" aria-label="Open Esencia website"><img src="/assets/images/brand/esencia-logo.webp" width="760" height="451" alt=""></a>
        <p class="admin-eyebrow">Website administration</p>
        <nav aria-label="Admin sections">
          <button type="button" data-admin-section="dashboard" aria-current="page">Dashboard</button>
          <button type="button" data-admin-section="content">Website Content</button>
          <button type="button" data-admin-section="services">Services</button>
          <button type="button" data-admin-section="pricing">Pricing</button>
          <button type="button" data-admin-section="gallery">Gallery</button>
          <button type="button" data-admin-section="contact">Contact Details</button>
          <button type="button" data-admin-section="seo">SEO</button>
          <button type="button" data-admin-section="status">Site Status</button>
        </nav>
        <button class="admin-logout" type="button" data-admin-logout>Logout</button>
      </aside>
      <main class="admin-main">
        <header class="admin-topbar"><div><p class="admin-eyebrow">Esencia Hair Studio</p><h1 data-admin-heading>Dashboard</h1></div><a href="/" target="_blank" rel="noopener noreferrer">View live site ↗</a></header>
        <p class="admin-notice" role="status" aria-live="polite" data-admin-notice></p>
        <section class="admin-panel" data-panel="dashboard">
          <div class="admin-status-grid" data-dashboard-cards></div>
          <div class="admin-card"><h2>Content management</h2><p>Changes are validated and stored in Esencia’s private Cloudflare database. Public pages never receive admin credentials or session data.</p></div>
        </section>
        <section class="admin-panel" data-panel="content" hidden>
          <div class="admin-card"><h2>Website Content</h2><p>Core service descriptions are managed under Services. Contact and SEO settings have dedicated sections to reduce accidental changes.</p></div>
        </section>
        <section class="admin-panel" data-panel="services" hidden><div class="admin-card"><h2>Services</h2><div data-services-editor></div></div></section>
        <section class="admin-panel" data-panel="pricing" hidden><div class="admin-card"><h2>Pricing</h2><div data-pricing-editor></div></div></section>
        <section class="admin-panel" data-panel="gallery" hidden><div class="admin-card"><h2>Gallery</h2><p class="admin-help">Manage existing editorial images. New uploads require the optional Esencia R2 storage phase.</p><div data-gallery-editor></div></div></section>
        <section class="admin-panel" data-panel="contact" hidden><div class="admin-card"><h2>Contact Details</h2><div class="admin-grid" data-contact-editor></div></div></section>
        <section class="admin-panel" data-panel="seo" hidden><div class="admin-card"><h2>SEO</h2><div class="admin-grid" data-seo-editor></div></div></section>
        <section class="admin-panel" data-panel="status" hidden><div class="admin-card"><h2>Site Status</h2><div class="admin-status-grid" data-status-cards></div></div></section>
        <div class="admin-actions"><button class="admin-button" type="button" data-admin-save>Save approved changes</button></div>
      </main>
    </div>`
  );
