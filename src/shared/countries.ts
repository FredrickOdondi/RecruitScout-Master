export interface CountryItem {
  name: string;
  code: string;
  flag: string;
  aliases?: string[];
}

export const COUNTRIES: CountryItem[] = [
  { name: 'Afghanistan', code: 'AF', flag: '🇦🇫' },
  { name: 'Albania', code: 'AL', flag: '🇦🇱' },
  { name: 'Algeria', code: 'DZ', flag: '🇩🇿' },
  { name: 'Andorra', code: 'AD', flag: '🇦🇩' },
  { name: 'Angola', code: 'AO', flag: '🇦🇴' },
  { name: 'Argentina', code: 'AR', flag: '🇦🇷' },
  { name: 'Armenia', code: 'AM', flag: '🇦🇲' },
  { name: 'Australia', code: 'AU', flag: '🇦🇺' },
  { name: 'Austria', code: 'AT', flag: '🇦🇹' },
  { name: 'Azerbaijan', code: 'AZ', flag: '🇦🇿' },
  { name: 'Bahamas', code: 'BS', flag: '🇧🇸' },
  { name: 'Bahrain', code: 'BH', flag: '🇧🇭' },
  { name: 'Bangladesh', code: 'BD', flag: '🇧🇩' },
  { name: 'Barbados', code: 'BB', flag: '🇧🇧' },
  { name: 'Belarus', code: 'BY', flag: '🇧🇾' },
  { name: 'Belgium', code: 'BE', flag: '🇧🇪' },
  { name: 'Belize', code: 'BZ', flag: '🇧🇿' },
  { name: 'Benin', code: 'BJ', flag: '🇧🇯' },
  { name: 'Bermuda', code: 'BM', flag: '🇧🇲' },
  { name: 'Bhutan', code: 'BT', flag: '🇧🇹' },
  { name: 'Bolivia', code: 'BO', flag: '🇧🇴' },
  { name: 'Bosnia and Herzegovina', code: 'BA', flag: '🇧🇦' },
  { name: 'Botswana', code: 'BW', flag: '🇧🇼' },
  { name: 'Brazil', code: 'BR', flag: '🇧🇷' },
  { name: 'Brunei', code: 'BN', flag: '🇧🇳' },
  { name: 'Bulgaria', code: 'BG', flag: '🇧🇬' },
  { name: 'Burkina Faso', code: 'BF', flag: '🇧🇫' },
  { name: 'Burundi', code: 'BI', flag: '🇧🇮' },
  { name: 'Cambodia', code: 'KH', flag: '🇰🇭' },
  { name: 'Cameroon', code: 'CM', flag: '🇨🇲' },
  { name: 'Canada', code: 'CA', flag: '🇨🇦' },
  { name: 'Cape Verde', code: 'CV', flag: '🇨🇻' },
  { name: 'Cayman Islands', code: 'KY', flag: '🇰🇾' },
  { name: 'Central African Republic', code: 'CF', flag: '🇨🇫' },
  { name: 'Chad', code: 'TD', flag: '🇹🇩' },
  { name: 'Chile', code: 'CL', flag: '🇨🇱' },
  { name: 'China', code: 'CN', flag: '🇨🇳' },
  { name: 'Colombia', code: 'CO', flag: '🇨🇴' },
  { name: 'Comoros', code: 'KM', flag: '🇰🇲' },
  { name: 'Congo', code: 'CG', flag: '🇨🇬' },
  { name: 'Costa Rica', code: 'CR', flag: '🇨🇷' },
  { name: 'Croatia', code: 'HR', flag: '🇭🇷' },
  { name: 'Cuba', code: 'CU', flag: '🇨🇺' },
  { name: 'Cyprus', code: 'CY', flag: '🇨🇾' },
  { name: 'Czech Republic', code: 'CZ', flag: '🇨🇿', aliases: ['Czechia'] },
  { name: 'Democratic Republic of the Congo', code: 'CD', flag: '🇨🇩', aliases: ['DR Congo', 'DRC'] },
  { name: 'Denmark', code: 'DK', flag: '🇩🇰' },
  { name: 'Djibouti', code: 'DJ', flag: '🇩🇯' },
  { name: 'Dominica', code: 'DM', flag: '🇩🇲' },
  { name: 'Dominican Republic', code: 'DO', flag: '🇩🇴' },
  { name: 'Ecuador', code: 'EC', flag: '🇪🇨' },
  { name: 'Egypt', code: 'EG', flag: '🇪🇬' },
  { name: 'El Salvador', code: 'SV', flag: '🇸🇻' },
  { name: 'Equatorial Guinea', code: 'GQ', flag: '🇬🇶' },
  { name: 'Eritrea', code: 'ER', flag: '🇪🇷' },
  { name: 'Estonia', code: 'EE', flag: '🇪🇪' },
  { name: 'Eswatini', code: 'SZ', flag: '🇸🇿', aliases: ['Swaziland'] },
  { name: 'Ethiopia', code: 'ET', flag: '🇪🇹' },
  { name: 'Fiji', code: 'FJ', flag: '🇫🇯' },
  { name: 'Finland', code: 'FI', flag: '🇫🇮' },
  { name: 'France', code: 'FR', flag: '🇫🇷' },
  { name: 'Gabon', code: 'GA', flag: '🇬🇦' },
  { name: 'Gambia', code: 'GM', flag: '🇬🇲' },
  { name: 'Georgia', code: 'GE', flag: '🇬🇪' },
  { name: 'Germany', code: 'DE', flag: '🇩🇪', aliases: ['Deutschland'] },
  { name: 'Ghana', code: 'GH', flag: '🇬🇭' },
  { name: 'Greece', code: 'GR', flag: '🇬🇷' },
  { name: 'Grenada', code: 'GD', flag: '🇬🇩' },
  { name: 'Guatemala', code: 'GT', flag: '🇬🇹' },
  { name: 'Guinea', code: 'GN', flag: '🇬🇳' },
  { name: 'Guinea-Bissau', code: 'GW', flag: '🇬🇼' },
  { name: 'Guyana', code: 'GY', flag: '🇬🇾' },
  { name: 'Haiti', code: 'HT', flag: '🇭🇹' },
  { name: 'Honduras', code: 'HN', flag: '🇭🇳' },
  { name: 'Hong Kong', code: 'HK', flag: '🇭🇰' },
  { name: 'Hungary', code: 'HU', flag: '🇭🇺' },
  { name: 'Iceland', code: 'IS', flag: '🇮🇸' },
  { name: 'India', code: 'IN', flag: '🇮🇳' },
  { name: 'Indonesia', code: 'ID', flag: '🇮🇩' },
  { name: 'Iran', code: 'IR', flag: '🇮🇷' },
  { name: 'Iraq', code: 'IQ', flag: '🇮🇶' },
  { name: 'Ireland', code: 'IE', flag: '🇮🇪' },
  { name: 'Israel', code: 'IL', flag: '🇮🇱' },
  { name: 'Italy', code: 'IT', flag: '🇮🇹' },
  { name: 'Ivory Coast', code: 'CI', flag: '🇨🇮', aliases: ["Cote d'Ivoire"] },
  { name: 'Jamaica', code: 'JM', flag: '🇯🇲' },
  { name: 'Japan', code: 'JP', flag: '🇯🇵' },
  { name: 'Jordan', code: 'JO', flag: '🇯🇴' },
  { name: 'Kazakhstan', code: 'KZ', flag: '🇰🇿' },
  { name: 'Kenya', code: 'KE', flag: '🇰🇪' },
  { name: 'Kiribati', code: 'KI', flag: '🇰🇮' },
  { name: 'Kosovo', code: 'XK', flag: '🇽🇰' },
  { name: 'Kuwait', code: 'KW', flag: '🇰🇼' },
  { name: 'Kyrgyzstan', code: 'KG', flag: '🇰🇬' },
  { name: 'Laos', code: 'LA', flag: '🇱🇦' },
  { name: 'Latvia', code: 'LV', flag: '🇱🇻' },
  { name: 'Lebanon', code: 'LB', flag: '🇱🇧' },
  { name: 'Lesotho', code: 'LS', flag: '🇱🇸' },
  { name: 'Liberia', code: 'LR', flag: '🇱🇷' },
  { name: 'Libya', code: 'LY', flag: '🇱🇾' },
  { name: 'Liechtenstein', code: 'LI', flag: '🇱🇮' },
  { name: 'Lithuania', code: 'LT', flag: '🇱🇹' },
  { name: 'Luxembourg', code: 'LU', flag: '🇱🇺' },
  { name: 'Madagascar', code: 'MG', flag: '🇲🇬' },
  { name: 'Malawi', code: 'MW', flag: '🇲🇼' },
  { name: 'Malaysia', code: 'MY', flag: '🇲🇾' },
  { name: 'Maldives', code: 'MV', flag: '🇲🇻' },
  { name: 'Mali', code: 'ML', flag: '🇲🇱' },
  { name: 'Malta', code: 'MT', flag: '🇲🇹' },
  { name: 'Mauritania', code: 'MR', flag: '🇲🇷' },
  { name: 'Mauritius', code: 'MU', flag: '🇲🇺' },
  { name: 'Mexico', code: 'MX', flag: '🇲🇽' },
  { name: 'Micronesia', code: 'FM', flag: '🇫🇲' },
  { name: 'Moldova', code: 'MD', flag: '🇲🇩' },
  { name: 'Monaco', code: 'MC', flag: '🇲🇨' },
  { name: 'Mongolia', code: 'MN', flag: '🇲🇳' },
  { name: 'Montenegro', code: 'ME', flag: '🇲🇪' },
  { name: 'Morocco', code: 'MA', flag: '🇲🇦' },
  { name: 'Mozambique', code: 'MZ', flag: '🇲🇿' },
  { name: 'Myanmar', code: 'MM', flag: '🇲🇲', aliases: ['Burma'] },
  { name: 'Namibia', code: 'NA', flag: '🇳🇦' },
  { name: 'Nauru', code: 'NR', flag: '🇳🇷' },
  { name: 'Nepal', code: 'NP', flag: '🇳🇵' },
  { name: 'Netherlands', code: 'NL', flag: '🇳🇱', aliases: ['Holland'] },
  { name: 'New Zealand', code: 'NZ', flag: '🇳🇿' },
  { name: 'Nicaragua', code: 'NI', flag: '🇳🇮' },
  { name: 'Niger', code: 'NE', flag: '🇳🇪' },
  { name: 'Nigeria', code: 'NG', flag: '🇳🇬' },
  { name: 'North Korea', code: 'KP', flag: '🇰🇵' },
  { name: 'North Macedonia', code: 'MK', flag: '🇲🇰', aliases: ['Macedonia'] },
  { name: 'Norway', code: 'NO', flag: '🇳🇴' },
  { name: 'Oman', code: 'OM', flag: '🇴🇲' },
  { name: 'Pakistan', code: 'PK', flag: '🇵🇰' },
  { name: 'Palau', code: 'PW', flag: '🇵🇼' },
  { name: 'Palestine', code: 'PS', flag: '🇵🇸' },
  { name: 'Panama', code: 'PA', flag: '🇵🇦' },
  { name: 'Papua New Guinea', code: 'PG', flag: '🇵🇬' },
  { name: 'Paraguay', code: 'PY', flag: '🇵🇾' },
  { name: 'Peru', code: 'PE', flag: '🇵🇪' },
  { name: 'Philippines', code: 'PH', flag: '🇵🇭' },
  { name: 'Poland', code: 'PL', flag: '🇵🇱' },
  { name: 'Portugal', code: 'PT', flag: '🇵🇹' },
  { name: 'Qatar', code: 'QA', flag: '🇶🇦' },
  { name: 'Romania', code: 'RO', flag: '🇷🇴' },
  { name: 'Russia', code: 'RU', flag: '🇷🇺' },
  { name: 'Rwanda', code: 'RW', flag: '🇷🇼' },
  { name: 'Saint Kitts and Nevis', code: 'KN', flag: '🇰🇳' },
  { name: 'Saint Lucia', code: 'LC', flag: '🇱🇨' },
  { name: 'Saint Vincent and the Grenadines', code: 'VC', flag: '🇻🇨' },
  { name: 'Samoa', code: 'WS', flag: '🇼🇸' },
  { name: 'San Marino', code: 'SM', flag: '🇸🇲' },
  { name: 'Sao Tome and Principe', code: 'ST', flag: '🇸🇹' },
  { name: 'Saudi Arabia', code: 'SA', flag: '🇸🇦' },
  { name: 'Senegal', code: 'SN', flag: '🇸🇳' },
  { name: 'Serbia', code: 'RS', flag: '🇷🇸' },
  { name: 'Seychelles', code: 'SC', flag: '🇸🇨' },
  { name: 'Sierra Leone', code: 'SL', flag: '🇸🇱' },
  { name: 'Singapore', code: 'SG', flag: '🇸🇬' },
  { name: 'Slovakia', code: 'SK', flag: '🇸🇰' },
  { name: 'Slovenia', code: 'SI', flag: '🇸🇮' },
  { name: 'Solomon Islands', code: 'SB', flag: '🇸🇧' },
  { name: 'Somalia', code: 'SO', flag: '🇸🇴' },
  { name: 'South Africa', code: 'ZA', flag: '🇿🇦' },
  { name: 'South Korea', code: 'KR', flag: '🇰🇷', aliases: ['Korea'] },
  { name: 'South Sudan', code: 'SS', flag: '🇸🇸' },
  { name: 'Spain', code: 'ES', flag: '🇪🇸' },
  { name: 'Sri Lanka', code: 'LK', flag: '🇱🇰' },
  { name: 'Sudan', code: 'SD', flag: '🇸🇩' },
  { name: 'Suriname', code: 'SR', flag: '🇸🇷' },
  { name: 'Sweden', code: 'SE', flag: '🇸🇪' },
  { name: 'Switzerland', code: 'CH', flag: '🇨🇭' },
  { name: 'Syria', code: 'SY', flag: '🇸🇾' },
  { name: 'Taiwan', code: 'TW', flag: '🇹🇼' },
  { name: 'Tajikistan', code: 'TJ', flag: '🇹🇯' },
  { name: 'Tanzania', code: 'TZ', flag: '🇹🇿' },
  { name: 'Thailand', code: 'TH', flag: '🇹🇭' },
  { name: 'Timor-Leste', code: 'TL', flag: '🇹🇱' },
  { name: 'Togo', code: 'TG', flag: '🇹🇬' },
  { name: 'Tonga', code: 'TO', flag: '🇹🇴' },
  { name: 'Trinidad and Tobago', code: 'TT', flag: '🇹🇹' },
  { name: 'Tunisia', code: 'TN', flag: '🇹🇳' },
  { name: 'Turkey', code: 'TR', flag: '🇹🇷', aliases: ['Turkiye'] },
  { name: 'Turkmenistan', code: 'TM', flag: '🇹🇲' },
  { name: 'Tuvalu', code: 'TV', flag: '🇹🇻' },
  { name: 'Uganda', code: 'UG', flag: '🇺🇬' },
  { name: 'Ukraine', code: 'UA', flag: '🇺🇦' },
  { name: 'United Arab Emirates', code: 'AE', flag: '🇦🇪', aliases: ['UAE', 'Emirates', 'Dubai'] },
  { name: 'United Kingdom', code: 'GB', flag: '🇬🇧', aliases: ['UK', 'Great Britain', 'England', 'Scotland', 'Wales'] },
  { name: 'United States', code: 'US', flag: '🇺🇸', aliases: ['USA', 'United States of America', 'US', 'America'] },
  { name: 'Uruguay', code: 'UY', flag: '🇺🇾' },
  { name: 'Uzbekistan', code: 'UZ', flag: '🇺🇿' },
  { name: 'Vanuatu', code: 'VU', flag: '🇻🇺' },
  { name: 'Vatican City', code: 'VA', flag: '🇻🇦' },
  { name: 'Venezuela', code: 'VE', flag: '🇻🇪' },
  { name: 'Vietnam', code: 'VN', flag: '🇻🇳' },
  { name: 'Yemen', code: 'YE', flag: '🇾🇪' },
  { name: 'Zambia', code: 'ZM', flag: '🇿🇲' },
  { name: 'Zimbabwe', code: 'ZW', flag: '🇿🇼' },
];

/**
 * Searches and ranks countries based on query:
 * 1. Countries starting with query come first (exact prefix match)
 * 2. Countries with an alias starting with query
 * 3. Countries containing query anywhere within the name
 * 4. Merges and formats any custom countries present in database
 */
export function searchCountries(
  query: string,
  extraCountryNames: string[] = []
): CountryItem[] {
  // Collect base countries plus any unique extra countries
  const countryMap = new Map<string, CountryItem>();
  for (const c of COUNTRIES) {
    countryMap.set(c.name.toLowerCase(), c);
  }

  // Add extra countries if not already in standard list
  for (const raw of extraCountryNames) {
    if (!raw) continue;
    const trimmed = raw.trim();
    const key = trimmed.toLowerCase();
    if (!countryMap.has(key)) {
      countryMap.set(key, {
        name: trimmed,
        code: trimmed.slice(0, 2).toUpperCase(),
        flag: '🌐',
      });
    }
  }

  const allCountries = Array.from(countryMap.values());
  const cleanQuery = query.trim().toLowerCase();

  if (!cleanQuery) {
    return allCountries;
  }

  const startsWithList: CountryItem[] = [];
  const aliasStartsWithList: CountryItem[] = [];
  const containsList: CountryItem[] = [];

  for (const country of allCountries) {
    const nameLower = country.name.toLowerCase();
    if (nameLower.startsWith(cleanQuery)) {
      startsWithList.push(country);
    } else if (
      country.aliases?.some(a => a.toLowerCase().startsWith(cleanQuery))
    ) {
      aliasStartsWithList.push(country);
    } else if (
      nameLower.includes(cleanQuery) ||
      country.code.toLowerCase() === cleanQuery ||
      country.aliases?.some(a => a.toLowerCase().includes(cleanQuery))
    ) {
      containsList.push(country);
    }
  }

  // Sort each category alphabetically
  const sortAlpha = (a: CountryItem, b: CountryItem) => a.name.localeCompare(b.name);
  startsWithList.sort(sortAlpha);
  aliasStartsWithList.sort(sortAlpha);
  containsList.sort(sortAlpha);

  return [...startsWithList, ...aliasStartsWithList, ...containsList];
}
