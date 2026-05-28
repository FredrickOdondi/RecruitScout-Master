async function searchDDG(query) {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'text/html'
      }
    });
    const html = await res.text();
    const urls = [...html.matchAll(/href="\/\/duckduckgo\.com\/l\/\?uddg=([^"&]+)/g)]
      .map(m => decodeURIComponent(m[1]));
    console.log("Results for:", query);
    console.log(urls.slice(0, 3));
  } catch (e) { console.error(e); }
}

searchDDG("site:linkedin.com/company drago publisher");
