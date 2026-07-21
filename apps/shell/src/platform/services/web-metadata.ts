export async function fetchWebMetadata(url: string) {
  const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try {
    const response = await fetch(normalizedUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Karya Desktop Metadata Fetcher",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { url: normalizedUrl };
    const html = (await response.text()).slice(0, 250_000);
    const siteUrl = new URL(response.url || normalizedUrl);
    const previewImage = absolutizeUrl(
      readMetaContent(html, "og:image") ?? readMetaContent(html, "twitter:image"),
      siteUrl,
    );
    return {
      url: response.url || normalizedUrl,
      title: readMetaContent(html, "og:title") ?? readTitle(html),
      description: readMetaContent(html, "og:description") ?? readMetaContent(html, "description"),
      siteName: readMetaContent(html, "og:site_name") ?? siteUrl.hostname.replace(/^www\./, ""),
      favicon:
        absolutizeUrl(readFaviconHref(html), siteUrl) ??
        `https://www.google.com/s2/favicons?domain=${siteUrl.hostname}&sz=64`,
      previewImage,
    };
  } catch {
    return { url: normalizedUrl };
  }
}

function readTitle(html: string): string | undefined {
  return decodeHtml(html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]);
}

function readMetaContent(html: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const propertyMatch = html.match(
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
  );
  if (propertyMatch?.[1]) return decodeHtml(propertyMatch[1]);
  const reversedMatch = html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
  );
  return decodeHtml(reversedMatch?.[1]);
}

function readFaviconHref(html: string): string | undefined {
  const iconMatch = html.match(
    /<link[^>]+rel=["'][^"']*(?:icon|shortcut icon|apple-touch-icon)[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i,
  );
  return decodeHtml(iconMatch?.[1]);
}

function absolutizeUrl(value: string | undefined, base: URL): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
}

function decodeHtml(value: string | undefined): string | undefined {
  return value
    ?.replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}
