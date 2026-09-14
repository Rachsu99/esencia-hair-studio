const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export const dashboardHtml = (email: string, logoutUrl: string) => `<!doctype html>
<html lang="en-NZ">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="theme-color" content="#fbf8f3">
<title>Pricing Admin | Esencia Hair Studio</title>
<link rel="icon" type="image/webp" href="/assets/images/brand/esencia-logo.webp">
<link rel="stylesheet" href="/css/admin.css?v=20260914a">
<script src="/js/admin.js?v=20260914a" defer></script>
</head>
<body>
  <main class="admin-page">
    <header class="admin-header">
      <a class="admin-brand" href="/" aria-label="Return to Esencia Hair Studio">
        <img src="/assets/images/brand/esencia-logo.webp" width="760" height="451" alt="Esencia Hair Studio">
      </a>
      <div class="admin-account">
        <span>${escapeHtml(email)}</span>
        <a href="${escapeHtml(logoutUrl)}">Logout</a>
      </div>
    </header>

    <section class="admin-intro" aria-labelledby="admin-title">
      <p class="admin-eyebrow">Website admin</p>
      <h1 id="admin-title">Pricing</h1>
      <p>Update the amounts shown across the Esencia website.</p>
    </section>

    <form class="price-form" data-price-form novalidate>
      <div class="admin-status" role="status" aria-live="polite" data-admin-status>Loading current prices…</div>
      <div class="price-groups" data-price-groups aria-busy="true"></div>
      <div class="admin-actions">
        <p data-dirty-message>No unsaved changes</p>
        <button class="admin-button" type="submit" data-save-button disabled>Save changes</button>
      </div>
    </form>
  </main>
  <dialog class="remove-dialog" data-remove-dialog aria-labelledby="remove-title">
    <form method="dialog">
      <p class="admin-eyebrow">Confirm removal</p>
      <h2 id="remove-title">Remove “<span data-remove-name></span>”?</h2>
      <p>This option will no longer appear on the website.</p>
      <div class="remove-dialog__actions">
        <button type="submit" value="cancel">Cancel</button>
        <button class="styling-remove" type="submit" value="remove">Remove</button>
      </div>
    </form>
  </dialog>
</body>
</html>`;
