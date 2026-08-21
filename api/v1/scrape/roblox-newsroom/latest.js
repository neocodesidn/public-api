import { listNews, getArticle } from "../../../../scrapers/roblox/newsroom.js";
import { remember } from "../../../../core/cache.js";
import { ok, fail } from "../../../../core/response.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return fail(res, "METHOD_NOT_ALLOWED", "Only GET is supported.", 405);

  try {
    const { value, cached } = await remember("roblox-newsroom:latest", 5 * 60 * 1000, async () => {
      const list = await listNews({ limit: 1 });
      if (!list.length) throw new Error("No newsroom articles found.");
      return getArticle(list[0].url);
    });

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return ok(res, {
      source: "roblox-newsroom",
      data: value,
      meta: { cached }
    });
  } catch (error) {
    return fail(res, "SCRAPE_FAILED", "Failed to scrape the latest Roblox article.", 502, error.message);
  }
}
