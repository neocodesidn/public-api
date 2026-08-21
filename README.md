# neovx Scraper API

Scalable serverless scraping API intended for Vercel.

## Endpoints

- `GET /api/v1/health`
- `GET /api/v1/scrape/roblox-newsroom?limit=20`
- `GET /api/v1/scrape/roblox-newsroom/latest`
- `GET /api/v1/scrape/roblox-newsroom/<article-slug>`

Every JSON response includes:

```json
{
  "success": true,
  "creator": "neovx"
}
```

## Local development

```bash
npm install
npx vercel dev
```

## Deploy

Push the project to GitHub, import the repository into Vercel, and deploy.

## Adding another scraper

Keep source-specific parsing inside `scrapers/`, then expose a thin handler under
`api/v1/scrape/`. Shared HTTP, response and cache behavior belongs in `core/`.

The included in-memory cache is only a per-instance optimization. For a larger
production deployment, replace `core/cache.js` with a persistent/shared cache
without changing individual scraper adapters.
