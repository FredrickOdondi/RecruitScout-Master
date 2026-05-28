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
    
    const validUrls = urls.filter(u => {
      try {
        const hostname = new URL(u).hostname.toLowerCase();
        const skip = ['dnb.com', 'zoominfo.com', 'apollo.io', 'linkedin.com', 'cerved.com', 'ufficiocamerale.it', 'registroimprese.it', 'paginegialle.it', 'kompass.com', 'bloomberg.com', 'pitchbook.com', 'reuters.com', 'cibus.it'];
        return !skip.some(s => hostname.includes(s));
      } catch { return false; }
    });
    
    console.log("Filtered Results for:", query);
    console.log(validUrls.slice(0, 5));
  } catch (e) { console.error(e); }
}

searchDDG('"Grissitalia Srl" official website Italy');
