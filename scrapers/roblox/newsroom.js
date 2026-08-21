import * as cheerio from "cheerio";
import { getText } from "../../core/http.js";
import { sources } from "../../config/sources.js";

const SOURCE = sources["roblox-newsroom"];

const LISTING_LABELS = [
  "Safety + Civility",
  "Engineering",
  "Careers",
  "Product",
  "Community",
  "News"
];

function absoluteUrl(value, base = SOURCE.baseUrl) {
  if (!value) return null;
  try { return new URL(value, base).href; } catch { return null; }
}

function clean(value) {
  return value?.replace(/\s+/g, " ").trim() || null;
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? clean(value) : date.toISOString();
}

function uniqueByUrl(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function jsonLd($) {
  const out = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).text());
      out.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch {}
  });
  return out;
}

function articleLd($) {
  return jsonLd($).find((x) => {
    const types = Array.isArray(x?.["@type"]) ? x["@type"] : [x?.["@type"]];
    return types.some((t) => ["NewsArticle", "Article", "BlogPosting"].includes(t));
  }) || {};
}

function extractTitle(anchorText) {
  let raw = clean(anchorText);
  if (!raw) return null;

  raw = raw.replace(/\s*Read more\s*$/i, "").trim();

  for (const label of LISTING_LABELS) {
    if (raw.toLowerCase().startsWith(label.toLowerCase())) {
      raw = raw.slice(label.length).trim();
      break;
    }
  }

  return clean(raw);
}

// Fetch only the metadata needed by the listing.
// We intentionally do not fetch article content here.
async function getArticlePublishedAt(url) {
  try {
    const { body } = await getText(url);
    const $ = cheerio.load(body);
    const ld = articleLd($);

    return normalizeDate(
      ld.datePublished ||
      $('meta[property="article:published_time"]').attr("content") ||
      $('meta[name="publish-date"]').attr("content") ||
      $('meta[name="date"]').attr("content") ||
      $("time").first().attr("datetime") ||
      clean($("time").first().text())
    );
  } catch {
    return null;
  }
}

async function mapWithConcurrency(items, worker, concurrency = 4) {
  const results = new Array(items.length);
  let next = 0;

  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => run()
    )
  );

  return results;
}

export async function listNews({ limit = 20 } = {}) {
  const { body, finalUrl } = await getText(SOURCE.listingUrl);
  const $ = cheerio.load(body);
  const articles = [];

  $('a[href*="/newsroom/"]').each((_, el) => {
    const a = $(el);
    const url = absoluteUrl(a.attr("href"), finalUrl);
    if (!url) return;

    const box = a.closest("article, li, div");
    const title = extractTitle(a.text());

    if (!title || title.length < 8) return;

    const img = a.find("img").first().length
      ? a.find("img").first()
      : box.find("img").first();

    const image = absoluteUrl(
      img.attr("src") ||
      img.attr("data-src") ||
      img.attr("data-lazy-src"),
      finalUrl
    );

    const time = box.find("time").first();
    const listingDate = normalizeDate(
      time.attr("datetime") || clean(time.text())
    );

    articles.push({
      title,
      url,
      image,
      publishedAt: listingDate
    });
  });

  const unique = uniqueByUrl(articles).slice(
    0,
    Math.max(1, Math.min(Number(limit) || 20, 50))
  );

  // Roblox does not expose publishedAt reliably on the listing cards.
  // Enrich each listing from its article's structured metadata.
  const enriched = await mapWithConcurrency(
    unique,
    async (item) => ({
      ...item,
      publishedAt:
        item.publishedAt || await getArticlePublishedAt(item.url)
    }),
    4
  );

  return enriched;
}

export async function getArticle(slugOrUrl) {
  const url = slugOrUrl.startsWith("http")
    ? slugOrUrl
    : absoluteUrl(`/newsroom/${String(slugOrUrl).replace(/^\/+/, "")}`);

  const { body, finalUrl } = await getText(url);
  const $ = cheerio.load(body);
  const ld = articleLd($);

  const title =
    clean(ld.headline) ||
    clean($('meta[property="og:title"]').attr("content")) ||
    clean($("h1").first().text());

  const description =
    clean(ld.description) ||
    clean($('meta[name="description"]').attr("content")) ||
    clean($('meta[property="og:description"]').attr("content"));

  const imageRaw =
    (Array.isArray(ld.image)
      ? ld.image[0]
      : ld.image?.url || ld.image) ||
    $('meta[property="og:image"]').attr("content");

  const author =
    clean(ld.author?.name) ||
    clean(Array.isArray(ld.author) ? ld.author[0]?.name : null) ||
    clean($('[rel="author"]').first().text()) ||
    clean($('[class*="author" i]').first().text());

  const publishedAt = normalizeDate(
    ld.datePublished ||
    $('meta[property="article:published_time"]').attr("content") ||
    $("time").first().attr("datetime") ||
    clean($("time").first().text())
  );

  const modifiedAt = normalizeDate(
    ld.dateModified ||
    $('meta[property="article:modified_time"]').attr("content")
  );

  let root = $("article").first();
  if (!root.length) root = $("main").first();

  const paragraphs = [];
  root.find("p, li").each((_, el) => {
    const text = clean($(el).text());
    if (text && text.length > 20 && !paragraphs.includes(text)) {
      paragraphs.push(text);
    }
  });

  return {
    title,
    url: finalUrl,
    description,
    image: absoluteUrl(imageRaw, finalUrl),
    author,
    publishedAt,
    modifiedAt,
    content: paragraphs.join("\n\n")
  };
}
