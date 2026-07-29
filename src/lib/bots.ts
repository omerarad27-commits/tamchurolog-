/*
 * Link-preview crawler detection.
 *
 * This matters more than it looks. The moment a quote link is pasted into
 * WhatsApp, Meta's crawler fetches the page to build the preview card — before
 * the client has seen anything. Counting that as a view would flip every quote
 * to "viewed" instantly and make the one signal this product exists to provide
 * completely worthless.
 *
 * So: crawlers still get the page (we want the preview card), but their visit
 * is not recorded and does not move the quote's status.
 */

const BOT_PATTERNS = [
  "facebookexternalhit",
  "facebookcatalog",
  "whatsapp",
  "telegrambot",
  "twitterbot",
  "slackbot",
  "slack-imgproxy",
  "discordbot",
  "linkedinbot",
  "skypeuripreview",
  "googlebot",
  "bingbot",
  "yandexbot",
  "duckduckbot",
  "applebot",
  "embedly",
  "quora link preview",
  "redditbot",
  "vkshare",
  "pinterest",
  "developers.google.com/+/web/snippet",
  "headlesschrome",
  "phantomjs",
  "curl/",
  "wget/",
  "python-requests",
  "node-fetch",
  "axios/",
  "go-http-client",
  "bot",
  "crawler",
  "spider",
  "preview",
];

export function isLinkPreviewBot(userAgent: string | null): boolean {
  if (!userAgent) return true; // No UA at all is not a person with a browser.
  const ua = userAgent.toLowerCase();
  return BOT_PATTERNS.some((pattern) => ua.includes(pattern));
}

/**
 * Best-effort client IP behind Vercel's proxy.
 * x-forwarded-for is a comma separated chain; the first entry is the client.
 */
export function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip");
}
