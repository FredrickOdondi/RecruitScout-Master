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
    
    // Filter out common directories
    const validUrls = urls.filter(u => {
        try {
            const url = new URL(u);
            const hostname = url.hostname;
            if (hostname.includes('linkedin.com') || hostname.includes('wikipedia.org') || hostname.includes('facebook.com') || hostname.includes('instagram.com') || hostname.includes('bloomberg.com') || hostname.includes('crunchbase.com') || hostname.includes('indeed.com') || hostname.includes('glassdoor.com')) return false;
            return true;
        } catch { return false; }
    });

    console.log("Results for:", query);
    console.log(validUrls.slice(0, 3));
  } catch (e) { console.error(e); }
}

searchDDG('"Drago" "Roma" official website');
