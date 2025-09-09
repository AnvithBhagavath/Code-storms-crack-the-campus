import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

function extractYouTubeId(inputUrl) {
  try {
    const u = new URL(inputUrl);
    const host = u.hostname.toLowerCase();
    if (host.includes('youtu.be')) {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id || null;
    }
    if (host.includes('youtube.com') || host.includes('m.youtube.com') || host.includes('music.youtube.com')) {
      if (u.pathname.startsWith('/watch')) {
        return u.searchParams.get('v');
      }
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0] === 'shorts' && parts[1]) return parts[1];
      if (parts[0] === 'embed' && parts[1]) return parts[1];
      if (parts[0] === 'live' && parts[1]) return parts[1];
      if (parts[0] === 'v' && parts[1]) return parts[1];
    }
  } catch {}
  return null;
}

function getYouTubeThumb(videoId) {
  if (!videoId) return '';
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

async function fetchPageSpeedScreenshot(url, apiKey) {
  if (!apiKey) return '';
  try {
    const params = new URLSearchParams({ url, key: apiKey, category: 'performance', strategy: 'desktop' });
    const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`;
    const res = await fetch(psiUrl);
    if (!res.ok) return '';
    const data = await res.json();
    const finalShot = data?.lighthouseResult?.audits?.['final-screenshot']?.details?.data;
    const fullShot = data?.lighthouseResult?.fullPageScreenshot?.screenshot?.data;
    const dataUrl = finalShot || fullShot;
    if (dataUrl && dataUrl.startsWith('data:image')) return dataUrl;
  } catch {}
  return '';
}

function resolveUrl(possibleUrl, base) {
  if (!possibleUrl) return '';
  try {
    return new URL(possibleUrl, base).toString();
  } catch {
    return '';
  }
}

export async function fetchReadableTextFromUrl(url) {
  const commonHeaders = {
    'User-Agent': 'Mozilla/5.0 (compatible; FactCheckBot/1.0; +https://example.org/bot)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
  };

  try {
    const res = await fetch(url, { headers: commonHeaders });
    if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`);
    const html = await res.text();

    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;
    const reader = new Readability(doc);
    const article = reader.parse();
    const text = article?.textContent?.trim() || '';
    const metaDescription =
      doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
      doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
      doc.querySelector('meta[name="twitter:description"]')?.getAttribute('content') ||
      '';
    const metaTitle =
      doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
      article?.title || doc.title || '';
    const metaImage =
      doc.querySelector('meta[property="og:image:secure_url"]')?.getAttribute('content') ||
      doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
      doc.querySelector('meta[name="twitter:image:src"]')?.getAttribute('content') ||
      doc.querySelector('meta[property="twitter:image:src"]')?.getAttribute('content') ||
      doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content') ||
      doc.querySelector('link[rel="image_src"]')?.getAttribute('href') ||
      doc.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') ||
      doc.querySelector('link[rel~="icon"]')?.getAttribute('href') ||
      '';
    const ytId = extractYouTubeId(url);
    const ytThumb = getYouTubeThumb(ytId);
    let image = resolveUrl(metaImage, doc.baseURI || url) || ytThumb || '';
    // If no image is found (common for dynamic Twitter/Instagram pages), fallback to PageSpeed screenshot
    if (!image) {
      image = await fetchPageSpeedScreenshot(url, process.env.GOOGLE_API_KEY);
    }

    if ((text && text.length > 200) || metaDescription) {
      return {
        title: metaTitle,
        text,
        description: metaDescription,
        image
      };
    }
  } catch (_) {
    // ignore and try fallback
  }

  // Fallback: Jina AI Reader (handles dynamic pages better)
  try {
    const stripped = url.replace(/^https?:\/\//, '');
    const jinaUrl = `https://r.jina.ai/http://${stripped}`;
    const res2 = await fetch(jinaUrl, { headers: { 'User-Agent': commonHeaders['User-Agent'] } });
    if (res2.ok) {
      const text2 = (await res2.text()).trim();
      const firstLine = text2.split(/\n+/).find(Boolean) || '';
      let image = '';
      const ytId = extractYouTubeId(url);
      if (ytId) {
        image = getYouTubeThumb(ytId);
      }
      if (!image) {
        image = await fetchPageSpeedScreenshot(url, process.env.GOOGLE_API_KEY);
      }
      return {
        title: new URL(url).hostname,
        text: text2,
        description: firstLine.slice(0, 280),
        image
      };
    }
  } catch (_) {
    // ignore
  }

  return { title: new URL(url).hostname, text: '', description: '', image: '' };
}


