import { listNews } from "../../../../scrapers/roblox/newsroom.js";
import { remember } from "../../../../core/cache.js";
import { ok, fail } from "../../../../core/response.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return fail(res, "METHOD_NOT_ALLOWED", "Only GET is supported.", 405);

  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 50));
    const key = `roblox-newsroom:list:${limit}`;

    const { value, cached } = await remember(key, 5 * 60 * 1000, () =>
      listNews({ limit })
    );

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

    return ok(res, {
      source: "roblox-newsroom",
      data: value,
      meta: {
        count: value.length,
        cached
      }
    });
  } catch (error) {
    return fail(res, "SCRAPE_FAILED", "Failed to scrape Roblox Newsroom.", 502, error.message);
  }
}
