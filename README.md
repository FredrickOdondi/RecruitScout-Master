# RecruitScout - Chrome Extension

A production-ready Chrome Extension for extracting job listing data from any job board website. RecruitScout combines crawling and scraping techniques to achieve universal compatibility across major job platforms.

## Features

- 🚀 **Universal Compatibility**: Works with LinkedIn, Indeed, Glassdoor, Monster, ZipRecruiter, and 20+ other platforms
- 🎯 **Intelligent Extraction**: Uses heuristic selectors, Schema.org parsing, and NLP for accurate data extraction
- 📊 **Beautiful UI**: Glassmorphism design with real-time feedback and progress visualization
- 💾 **Multiple Export Formats**: CSV, JSON, and XLSX support
- ⚡ **High Performance**: Response time <100ms, memory usage <100MB
- 🔒 **Privacy Focused**: All data processed locally, no external servers

## Installation

### Development Mode

1. Clone the repository:
```bash
git clone https://github.com/recruitscout/recruitscout.git
cd recruitscout
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` directory

### Production Build

```bash
npm run build
```

This will generate the extension files in the `dist` directory, ready for Chrome Web Store submission.

## Usage

### Extract Jobs from Current Page

1. Navigate to a job board (LinkedIn, Indeed, Glassdoor, etc.)
2. Click the RecruitScout extension icon
3. Click "Extract Current Page"
4. View extracted jobs in the "Jobs" tab

### Extract Multiple Pages

1. Navigate to a job board with pagination
2. Click "Extract All Pages" to crawl through all listings
3. Monitor progress in real-time

### Export Data

1. Go to the "Export" tab
2. Select export format (CSV, JSON, XLSX)
3. Choose fields to include
4. Click "Export X Jobs" to download

## Project Structure

```
recruitscout/
├── src/
│   ├── background/           # Background Service Worker
│   ├── content/               # Content Scripts
│   ├── popup/                 # React Popup UI
│   ├── offscreen/             # Offscreen Document
│   ├── shared/                # Shared utilities
│   └── lib/                   # Core libraries
├── public/                    # Static assets
├── tests/                     # Test suite
└── dist/                      # Build output
```

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests

### Testing

Run the test suite:

```bash
npm run test
```

Run tests with coverage:

```bash
npm run test -- --coverage
```

## Configuration

### Extraction Settings

- **Max Jobs per Page**: Limit the number of jobs extracted per page (default: 100)
- **Pagination Limit**: Maximum number of pages to crawl (default: 10)
- **Crawl Delay**: Delay between requests in milliseconds (default: 1000)
- **Respect robots.txt**: Follow robots.txt rules when crawling (default: true)

### Export Settings

- **Format**: Choose between CSV, JSON, or XLSX
- **Fields**: Select which fields to include in export
- **Include Metadata**: Include additional metadata in exports

## Architecture

### Extraction Engine

RecruitScout uses a multi-strategy extraction approach:

1. **Schema.org Parser**: Extracts structured data from JSON-LD
2. **Heuristic Engine**: Uses scoring algorithms to identify job elements
3. **Field Extractors**: Targeted extractors for specific job fields
4. **NLP Extractor**: Natural language processing for unstructured data

### Crawler

The crawler supports multiple pagination types:

- Traditional pagination (page numbers)
- Load more buttons
- Infinite scroll
- API-based pagination

### Rate Limiting

Built-in rate limiting ensures respectful crawling:

- Configurable delays between requests
- Exponential backoff on errors
- Respect for robots.txt directives

## Performance

- **Extraction Accuracy**: >90% for core fields (title, company, location)
- **Response Time**: <100ms for typical interactions
- **Memory Usage**: <100MB during active extraction
- **Build Size**: Under 2MB

## Browser Support

- Chrome/Chromium 88+
- Edge 88+
- Brave 1.20+

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting pull requests.

## Support

- 📧 Email: support@recruitscout.com
- 🐛 Issues: [GitHub Issues](https://github.com/recruitscout/recruitscout/issues)
- 📖 Docs: [Documentation](https://docs.recruitscout.com)

## Acknowledgments

- Built with [Vite](https://vitejs.dev/) and [React](https://reactjs.org/)
- UI inspired by modern design principles
- Special thanks to all contributors
# RecruitScout-Master
