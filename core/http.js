import { fetch } from "undici";

const DEFAULT_HEADERS = {
  "user-agent": "Mozilla/5.0 (compatible; neovx-scraper-api/1.0; +https://vercel.com)",
  "accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9"
};

export async function getText(url, { timeout = 12000, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      headers: { ...DEFAULT_HEADERS, ...headers },
      redirect: "follow",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Upstream returned HTTP ${response.status}`);
    }

    return {
      body: await response.text(),
      finalUrl: response.url,
      status: response.status
    };
  } finally {
    clearTimeout(timer);
  }
}
