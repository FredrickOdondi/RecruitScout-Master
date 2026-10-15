import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import Footer from '../../src/shared/Footer';
import fs from 'fs';

describe('Footer year', () => {
  it('renders 2026 in the shared Footer component', () => {
    const html = renderToString(React.createElement(Footer));
    expect(html).toMatch(/2026/);
  });

  it('static HTML shells include 2026 in their footers', () => {
    const files = [
      'src/popup/index.html',
      'src/dashboard/index.html',
      'src/blue/index.html',
      'src/preferences/index.html',
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toMatch(/2026/);
    }
  });
});
