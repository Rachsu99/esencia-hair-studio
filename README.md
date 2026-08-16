# Esencia Hair Studio

Production-ready static website for Esencia Hair Studio.

- Production domain: https://esenciahair.co.nz
- Repository name: esencia-hair-studio
- Architecture: static HTML, CSS and JavaScript
- Package manager: npm
- Build output: dist

The project intentionally has no database, serverless API or framework.
Esencia is a marketing website deployed with Cloudflare Workers Static Assets.

## Local development

Install the project metadata:

    npm install

Start the local website:

    npm run dev

The command refreshes the generated HTML files and prints the local preview
address.

## Production build

Create the Cloudflare-ready build:

    npm run build

Preview the exact dist output locally:

    npm run preview

Run the project checks:

    npm run lint
    npm test

The build creates a fresh dist directory containing the HTML pages, optimized
images, CSS, JavaScript, sitemap, robots file, custom 404 page and Cloudflare
response headers.

## Website content

Confirmed contact details, the production domain, services, prices and FAQs are
centralized in site.config.mjs. Running npm run build refreshes all root HTML
pages and the dist output.

The enquiry form prepares an email to Rachsu99@gmail.com in the visitor’s email
application. No contact-form backend or email credentials are required.

Editorial photography is clearly disclosed and is not presented as Esencia
client work. Current client work is linked from Rachel’s official Instagram.
Studio address, phone number and opening hours are intentionally omitted until
approved for publication.

## Git workflow

The production branch is main. After creating an empty GitHub repository named
esencia-hair-studio, add its remote using your real GitHub username:

    git remote add origin https://github.com/YOUR_GITHUB_USERNAME/esencia-hair-studio.git
    git add .
    git commit -m "Initial Esencia Hair Studio deployment setup"
    git push -u origin main

For future updates:

    git add .
    git commit -m "Describe the website update"
    git push

Do not substitute an email address for YOUR_GITHUB_USERNAME.

## Cloudflare Workers deployment

Use these exact values:

    Repository: esencia-hair-studio
    Framework preset: None
    Production branch: main
    Build command: npm run build
    Deploy command: npx wrangler deploy
    Static assets directory: dist (configured in wrangler.jsonc)
    Root directory: / (repository root; leave the advanced field blank)
    Environment variables: None required

Dashboard steps:

1. Open Cloudflare Dashboard.
2. Go to Workers & Pages.
3. Open the existing `esencia-hair-studio` Worker.
4. Under Builds, connect the `Rachsu99/esencia-hair-studio` repository.
5. Enter the settings above.
6. Save and deploy, then test `esencia-hair-studio.rachsu99.workers.dev`.

Wrangler publishes only the generated `dist` directory. Clean routes such as
`/about` and the custom `404.html` behavior are configured in `wrangler.jsonc`.
The production custom domain is `https://esenciahair.co.nz` and `www` redirects
permanently to the apex domain.

Every push to `main` triggers a new production Worker build and deployment.
