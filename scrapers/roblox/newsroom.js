import * as cheerio from "cheerio";
import { getText } from "../../core/http.js";
import { sources } from "../../config/sources.js";

const SOURCE = sources["roblox-newsroom"];

function absoluteUrl(value, base = SOURCE.baseUrl) {
  if (!value) return null;
  try {
    return new URL(value, base).href;
  } catch {
    return null;
  }
}

function clean(value) {
  return value?.replace(/\s+/g, " ").trim() || null;
}

function uniqueByUrl(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function extractJsonLd($) {
  const values = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      values.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch {}
  });
  return values;
}

export async function listNews({ limit = 20 } = {}) {
  const { body, finalUrl } = await getText(SOURCE.listingUrl);
  const $ = cheerio.load(body);
  const articles = [];

  // Prefer newsroom article URLs. Multiple selectors make the adapter
  // resilient to moderate markup changes.
  $('a[href*="/newsroom/"]').each((_, el) => {
    const a = $(el);
    const href = absoluteUrl(a.attr("href"), finalUrl);
    if (!href || href.replace(/\/$/, "") === SOURCE.listingUrl.replace(/\/$/, "")) return;

    const container = a.closest("article, li, div");
    const title =
      clean(a.find("h1,h2,h3,h4").first().text()) ||
      clean(container.find("h1,h2,h3,h4").first().text()) ||
      clean(a.attr("aria-label")) ||
      clean(a.text());

    if (!title || title.length < 8) return;

    const img = a.find("img").first().length ? a.find("img").first() : container.find("img").first();
    const image = absoluteUrl(
      img.attr("src") || img.attr("data-src") || img.attr("data-lazy-src"),
      finalUrl
    );

    const time = container.find("time").first();
    const publishedAt = time.attr("datetime") || clean(time.text());

    articles.push({
      title,
      url: href,
      image,
      publishedAt
    });
  });

  const data = uniqueByUrl(articles).slice(0, Math.max(1, Math.min(Number(limit) || 20, 50)));
  return data;
}

export async function getArticle(slugOrUrl) {
  const url = slugOrUrl.startsWith("http")
    ? slugOrUrl
    : absoluteUrl(`/newsroom/${String(slugOrUrl).replace(/^\/+/, "")}`);

  const { body, finalUrl } = await getText(url);
  const $ = cheerio.load(body);
  const jsonLd = extractJsonLd($);

  const articleLd = jsonLd.find((x) =>
    ["NewsArticle", "Article", "BlogPosting"].includes(x?.["@type"])
  ) || {};

  const title =
    clean(articleLd.headline) ||
    clean($('meta[property="og:title"]').attr("content")) ||
    clean($("h1").first().text());

  const description =
    clean(articleLd.description) ||
    clean($('meta[name="description"]').attr("content")) ||
    clean($('meta[property="og:description"]').attr("content"));

  const imageRaw =
    (Array.isArray(articleLd.image) ? articleLd.image[0] : articleLd.image?.url || articleLd.image) ||
    $('meta[property="og:image"]').attr("content");

  const author =
    clean(articleLd.author?.name) ||
    clean(Array.isArray(articleLd.author) ? articleLd.author[0]?.name : null) ||
    clean($('[rel="author"]').first().text());

  const publishedAt =
    articleLd.datePublished ||
    $("time").first().attr("datetime") ||
    clean($("time").first().text());

  let articleRoot = $("article").first();
  if (!articleRoot.length) articleRoot = $("main").first();

  const paragraphs = [];
  articleRoot.find("p").each((_, el) => {
    const text = clean($(el).text());
    if (text && text.length > 20) paragraphs.push(text);
  });

  return {
    title,
    url: finalUrl,
    description,
    image: absoluteUrl(imageRaw, finalUrl),
    author,
    publishedAt,
    content: paragraphs.join("\n\n")
  };
}
