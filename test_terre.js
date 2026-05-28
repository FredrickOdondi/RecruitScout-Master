async function testTerre() {
  const companyName = "Terre Dei Marsi Soc. Coop. Agr.";

  function normalizeCompanyName(name) {
    let cleaned = name.replace(/s\.?p\.?a\.?|s\.?r\.?l\.?|llc|inc\.?|ltd\.?|gmbh|soc\.?|coop\.?|agr\.?/gi, '').trim();
    cleaned = cleaned.replace(/[^a-zA-Z0-9\s]/g, '');
    return cleaned;
  }

  function extractDomainFromUrl(urlStr) {
    try {
      const u = new URL(urlStr);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return urlStr.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
    }
  }

  console.log("Normalized Name:", normalizeCompanyName(companyName));

  console.log("\n--- 1. Testing LinkedIn ---");
  const normalized = normalizeCompanyName(companyName).toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '');
  const url = `https://www.linkedin.com/company/${normalized}`;
  console.log("LinkedIn URL:", url);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
    if (res.ok) {
      const html = await res.text();
      const m1 = html.match(/"sameAs"\s*:\s*"([^"]+)"/);
      if (m1 && !m1[1].includes('linkedin.com')) console.log("LinkedIn sameAs:", extractDomainFromUrl(m1[1]));
      else {
        const m2 = html.match(/"companyPageUrl"\s*:\s*"([^"]+)"/);
        if (m2 && !m2[1].includes('linkedin.com')) console.log("LinkedIn companyPageUrl:", extractDomainFromUrl(m2[1]));
        else console.log("LinkedIn: Domain not found in HTML");
      }
    } else {
      console.log("LinkedIn: HTTP", res.status);
    }
  } catch (e) { console.log("LinkedIn fetch failed"); }

  console.log("\n--- 2. Testing Clearbit ---");
  const cbName = encodeURIComponent(normalizeCompanyName(companyName));
  const cbUrl = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${cbName}`;
  console.log("Clearbit URL:", cbUrl);
  try {
    const res = await fetch(cbUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.length > 0) {
        console.log("Clearbit Best Match:", data[0].name, "->", data[0].domain);
      } else {
        console.log("Clearbit: No results");
      }
    }
  } catch (e) { console.log("Clearbit fetch failed"); }

  console.log("\n--- 3. Testing Wikidata ---");
  const wikiUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${cbName}&language=it&type=item&format=json&origin=*&limit=3`;
  console.log("Wikidata URL:", wikiUrl);
  try {
    const res = await fetch(wikiUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.search && data.search.length > 0) {
        const id = data.search[0].id;
        console.log("Wikidata Top Match ID:", id, data.search[0].label);
        const cRes = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${id}&props=claims&format=json&origin=*`);
        const cData = await cRes.json();
        const claims = cData.entities[id].claims.P856;
        if (claims && claims.length > 0) {
          console.log("Wikidata Website:", claims[0].mainsnak.datavalue.value);
        } else {
          console.log("Wikidata Website: Not found");
        }
      } else {
        console.log("Wikidata: No results");
      }
    }
  } catch(e) {}
}

testTerre();
