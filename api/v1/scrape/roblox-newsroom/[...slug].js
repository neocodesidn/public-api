import { getArticle } from "../../../../scrapers/roblox/newsroom.js";
import { remember } from "../../../../core/cache.js";
import { ok, fail } from "../../../../core/response.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return fail(res, "METHOD_NOT_ALLOWED", "Only GET is supported.", 405);

  try {
    const slugParts = Array.isArray(req.query.slug) ? req.query.slug : [req.query.slug];
    const slug = slugParts.filter(Boolean).join("/");

    if (!slug) return fail(res, "INVALID_SLUG", "Article slug is required.", 400);

    const { value, cached } = await remember(
      `roblox-newsroom:article:${slug}`,
      15 * 60 * 1000,
      () => getArticle(slug)
    );

    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=1800");
    return ok(res, {
      source: "roblox-newsroom",
      data: value,
      meta: { cached }
    });
  } catch (error) {
    return fail(res, "SCRAPE_FAILED", "Failed to scrape the Roblox article.", 502, error.message);
  }
}
