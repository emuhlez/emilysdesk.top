import type { VercelRequest, VercelResponse } from '@vercel/node'

/* ── SSRF protection ── */

function isPrivateIP(hostname: string): boolean {
  const blocked = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^0\./,
    /^169\.254\./,
    /^\[::1\]$/,
    /^\[fc/i,
    /^\[fd/i,
    /^\[fe80:/i,
  ]
  return blocked.some((re) => re.test(hostname))
}

function validateUrl(raw: string): URL {
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http/https URLs are allowed')
  }
  if (isPrivateIP(url.hostname)) {
    throw new Error('Private/reserved IPs are not allowed')
  }
  return url
}

/* ── navigation interception script ── */

const NAV_INTERCEPT_SCRIPT = `<script>
(function() {
  var realParent = window.parent;

  // Fake top/parent so page thinks it's not in an iframe
  try {
    Object.defineProperty(window, 'top', { get: function() { return window.self; } });
    Object.defineProperty(window, 'parent', { get: function() { return window.self; } });
    Object.defineProperty(window, 'frameElement', { get: function() { return null; } });
  } catch(e) {}

  function sendNav(url, source) {
    try {
      var a = document.createElement('a');
      a.href = url;
      var absoluteUrl = a.href;
      realParent.postMessage({ type: 'iframeNavigation', url: absoluteUrl, source: source }, '*');
    } catch(e) {}
  }

  // Intercept link clicks
  document.addEventListener('click', function(e) {
    var el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el || !el.href) return;
    if (el.getAttribute('href').startsWith('#')) return;
    e.preventDefault();
    e.stopPropagation();
    sendNav(el.href, 'click');
  }, true);

  // Intercept form submissions
  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (form.method && form.method.toLowerCase() === 'get' && form.action) {
      e.preventDefault();
      var url = new URL(form.action);
      var fd = new FormData(form);
      fd.forEach(function(v, k) { url.searchParams.set(k, v); });
      sendNav(url.href, 'form-get');
    }
  }, true);

  // Intercept location changes
  var realAssign = window.location.assign.bind(window.location);
  var realReplace = window.location.replace.bind(window.location);

  window.location.assign = function(url) { sendNav(url, 'location-assign'); };
  window.location.replace = function(url) { sendNav(url, 'location-replace'); };

  // Intercept window.open
  window.open = function(url) {
    if (url) sendNav(url, 'window-open');
    return null;
  };

  // Intercept pushState/replaceState
  var realPushState = history.pushState.bind(history);
  var realReplaceState = history.replaceState.bind(history);

  history.pushState = function(state, title, url) {
    if (url) sendNav(url, 'pushstate');
    return realPushState(state, title, url);
  };

  history.replaceState = function(state, title, url) {
    if (url) sendNav(url, 'replacestate');
    return realReplaceState(state, title, url);
  };

  // Block service workers and notifications
  if (navigator.serviceWorker) {
    try {
      Object.defineProperty(navigator, 'serviceWorker', {
        get: function() { return { register: function() { return Promise.resolve(); } }; }
      });
    } catch(e) {}
  }

  try {
    Notification.requestPermission = function() { return Promise.resolve('denied'); };
  } catch(e) {}
})();
</script>`

/* ── handler ── */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  let url: string | undefined
  let mode = 'proxy'

  if (req.method === 'POST') {
    url = req.body?.url
    mode = req.body?.mode ?? 'proxy'
  } else {
    url = req.query.url as string | undefined
    mode = (req.query.mode as string) ?? 'proxy'
  }

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' })
  }

  let target: URL
  try {
    target = validateUrl(url)
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : String(e) })
  }

  /* ── check mode ── */

  if (mode === 'check') {
    try {
      const head = await fetch(target.href, { method: 'HEAD', redirect: 'follow' })
      const xfo = head.headers.get('x-frame-options')
      const csp = head.headers.get('content-security-policy')
      const blocked =
        !!xfo ||
        (csp && /frame-ancestors\s/.test(csp))

      return res.json({ url: target.href, embeddable: !blocked, xfo, csp })
    } catch {
      return res.json({ url: target.href, embeddable: false, error: 'fetch failed' })
    }
  }

  /* ── proxy mode (default): fetch & serve HTML with nav interception ── */

  try {
    // Use a crawler User-Agent so SPA-heavy sites (Discourse, etc.) return their
    // SSR'd / crawler-fallback HTML with real article content baked in. Sites
    // that don't differentiate by UA (Next.js, most static-SSR) return the same
    // HTML they would for any UA.
    const upstream = await fetch(target.href, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
      },
    })

    const contentType = upstream.headers.get('content-type') || 'text/html'

    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return res.status(400).json({ error: 'Target URL did not return HTML' })
    }

    let html = await upstream.text()

    // Strip security-restricting meta tags
    html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']?Content-Security-Policy["']?[^>]*>/gi, '')
    html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']?X-Frame-Options["']?[^>]*>/gi, '')
    html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, '')

    // Remove existing base tags
    html = html.replace(/<base\s[^>]*>/gi, '')

    // Strip ALL original <script> tags. The page is loaded from a blob: URL with
    // a UUID path, so SPA frameworks (Next.js, React Router, etc.) crash during
    // hydration when they see window.location.pathname doesn't match the route
    // they were rendered for. The static SSR'd HTML renders fine on its own —
    // we only need our injected nav-interception script to run.
    html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Also strip preload/modulepreload that would re-fetch JS bundles.
    html = html.replace(/<link[^>]*rel\s*=\s*["']?(?:modulepreload|preload)["']?[^>]*>/gi, '')

    // Empty-SSR detection. Fully-client-rendered SPAs (Next.js with no
    // getStaticProps text content, React Router-only apps, ...) ship a
    // skeleton <body> and rely on JS hydration to fill it. After we strip
    // scripts above, those pages have ~0 chars of visible text. Loading
    // them in the iframe gives the user a blank rectangle and no signal
    // about *why* — which feels like the app is broken. Return 502 with
    // a reason code so the client can render its SitePreview fallback
    // (favicon + label + "Open in browser") instead.
    //
    // Two guards keep this from false-positiving on legitimately terse
    // pages (one-paragraph status pages, "Coming soon" splashes,
    // server-rendered 404s, single-line status JSON wrapped in HTML):
    //   1. An 80-char visible-text floor (real SSR'd article/doc pages
    //      have thousands; a true empty-SSR shell has ~0).
    //   2. AND the body must contain no semantic content tag
    //      (<p>/<h1>/<article>/<main>). A short page that still ships
    //      real markup isn't an un-hydrated shell, so we let it through.
    //
    // The <body> matcher deliberately skips over quoted attribute values
    // (`<body data-x="a>b">`) so a `>` inside an attribute doesn't end the
    // open tag early and mis-slice the body region.
    const bodyMatch = html.match(/<body(?:"[^"]*"|'[^']*'|[^>])*>([\s\S]*?)<\/body>/i)
    const bodyHtml = bodyMatch ? bodyMatch[1] : html
    const visibleText = bodyHtml
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    const hasSemanticContent = /<(?:p|h1|article|main)\b/i.test(bodyHtml)
    if (visibleText.length < 80 && !hasSemanticContent) {
      return res.status(502).json({
        error: 'No visible content after script strip',
        reason: 'spa-no-ssr',
        url: target.href,
      })
    }

    // Default font fallback. Crawler-fallback HTML from sites like Discourse
    // omits the inline <style> blocks that set the body font, leaving the iframe
    // rendering everything in the browser-default serif (Times New Roman). Force
    // a clean system-sans baseline; site-specific CSS still overrides where set.
    // Two prongs: (1) define the CSS variables Discourse-style themes reference,
    // (2) add an !important universal rule as a hard backstop. Injected at end
    // of </head> so it wins the cascade over external stylesheet links.
    const fontFallback = `<style id="__proxy_font_fallback">
      :root {
        --font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif !important;
        --heading-font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif !important;
        --font-monospace: ui-monospace, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
        --font-family--monospace: ui-monospace, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
      }
      html, body, button, input, select, textarea, h1, h2, h3, h4, h5, h6, p, span, div, li, a, blockquote, .ember-view, .topic-body, .cooked, .post, .topic-list, .title {
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif !important;
      }
      code, pre, kbd, samp, .monospace, tt, .hljs {
        font-family: ui-monospace, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important;
      }
    </style>`

    // Inject base tag + nav script at the START of <head>, and the font
    // fallback at the END of </head> so it wins the cascade.
    const baseTag = `<base href="${target.origin}/">`
    const headStart = baseTag + NAV_INTERCEPT_SCRIPT

    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, `<head$1>${headStart}`)
      if (/<\/head>/i.test(html)) {
        html = html.replace(/<\/head>/i, `${fontFallback}</head>`)
      } else {
        html += fontFallback
      }
    } else {
      html = headStart + fontFallback + html
    }

    // Set permissive response headers
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.setHeader('Content-Security-Policy', 'frame-ancestors *')
    res.setHeader('Access-Control-Allow-Origin', '*')
    // Explicitly do NOT set X-Frame-Options

    return res.status(upstream.status).send(html)
  } catch (e) {
    return res.status(502).json({
      error: 'Failed to fetch target URL',
      detail: e instanceof Error ? e.message : String(e),
    })
  }
}
