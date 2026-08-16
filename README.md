# Esencia Hair Studio

Production-ready static website for Esencia Hair Studio.

- Production domain: https://esenciahair.co.nz
- Repository name: esencia-hair-studio
- Architecture: static HTML, CSS and JavaScript
- Package manager: npm
- Build output: dist

The project intentionally has no database, Worker, serverless API or framework.
Esencia is a marketing website and uses a simple Cloudflare Pages static
deployment path.

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
Pages response headers.

## Website content

Confirmed contact details, the production domain, services, prices and FAQs are
centralized in site.config.mjs. Running npm run build refreshes all root HTML
pages and the dist output.

The enquiry form prepares an email to Rachsu99@gmail.com in the visitor’s email
application. No contact-form backend or email credentials are required.

Before public launch, replace the clearly labelled editorial photography and
placeholders with approved Esencia client work, reviews, Rachel’s biography,
studio address, phone number and opening hours.

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

## Cloudflare Pages deployment

Use these exact values:

    Repository: esencia-hair-studio
    Framework preset: None
    Production branch: main
    Build command: npm run build
    Build output directory: dist
    Root directory: / (repository root; leave the advanced field blank)
    Environment variables: None required

Dashboard steps:

1. Open Cloudflare Dashboard.
2. Go to Workers & Pages.
3. Select Create application, then Pages.
4. Select Import an existing Git repository.
5. Connect GitHub and choose esencia-hair-studio.
6. Enter the settings above.
7. Select Save and Deploy.
8. Test the generated esencia-hair-studio.pages.dev address.

Cloudflare Pages automatically serves files such as about.html at the clean
/about route and redirects /about.html to /about. The included 404.html handles
unknown routes.

After the pages.dev version is approved, connect esenciahair.co.nz in the
Cloudflare project’s Custom domains section. The project already generates
canonical metadata and a sitemap for that domain, but this repository does not
change DNS or connect the domain itself.

Every push to main will trigger a new production build after the GitHub
repository is connected to Cloudflare Pages.
