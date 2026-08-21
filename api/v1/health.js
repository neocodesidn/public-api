import { ok } from "../../core/response.js";

export default function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).end();

  return ok(res, {
    data: {
      status: "ok",
      service: "neovx-scraper-api"
    }
  });
}
