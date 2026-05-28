async function searchDomain(companyName) {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(companyName + " official website")}`, {
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
            if (hostname.includes('linkedin.com') || hostname.includes('wikipedia.org') || hostname.includes('facebook.com') || hostname.includes('instagram.com') || hostname.includes('bloomberg.com') || hostname.includes('crunchbase.com')) return false;
            return true;
        } catch { return false; }
    });

    console.log(companyName, "->", validUrls[0] ? new URL(validUrls[0]).hostname.replace(/^www\./, '') : 'None');
  } catch (e) { console.error(e); }
}

searchDomain("Drago");
searchDomain("Bending Spoons");
searchDomain("Gi Group");
searchDomain("Neuman & Esser");
searchDomain("Adecco Italia");
