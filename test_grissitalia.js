async function fetchDomainFromSearchEngine(companyName, location) {
  function extractDomainFromUrl(urlStr) {
    try {
      const u = new URL(urlStr);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return urlStr.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    }
  }

  try {
    let query = `"${companyName}"`;
    if (location) {
      const cleanLoc = location.split(',')[0].trim();
      query += ` "${cleanLoc}"`;
    }
    query += ` official website Italy`;

    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
    });

    if (response.ok) {
      const html = await response.text();
      const urls = [...html.matchAll(/href="\/\/duckduckgo\.com\/l\/\?uddg=([^"&]+)/g)]
        .map(m => decodeURIComponent(m[1]));
      
      const validUrls = urls.filter(u => {
        try {
          const uObj = new URL(u);
          const hostname = uObj.hostname.toLowerCase();
          const skipList = ['linkedin.com', 'wikipedia.org', 'facebook.com', 'instagram.com', 'bloomberg.com', 'crunchbase.com', 'indeed.com', 'glassdoor.com', 'monster.com', 'infojobs.it', 'youtube.com', 'twitter.com', 'tiktok.com', 'bedsandhotels.com'];
          return !skipList.some(skip => hostname.includes(skip));
        } catch { return false; }
      });

      if (validUrls.length > 0) {
        return extractDomainFromUrl(validUrls[0]);
      }
    }
  } catch (e) {
    console.error(e);
  }
  return '';
}

async function runTest() {
  const domain1 = await fetchDomainFromSearchEngine("Grissitalia Srl");
  console.log("Grissitalia Srl ->", domain1);
}

runTest();
