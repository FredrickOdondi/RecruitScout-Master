import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import Footer from '../../src/shared/Footer';
import fs from 'fs';
import path from 'path';

function readAllFiles(dir: string, exts = ['.html', '.js', '.css']): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop()!;
    for (const entry of fs.readdirSync(d)) {
      const full = path.join(d, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) stack.push(full);
      else if (exts.includes(path.extname(full))) out.push(full);
    }
  }
  return out;
}

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
      'src/offscreen/index.html',
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toMatch(/©\s*2026\s+RecruitScout/);
    }
  });

  it('production bundle (if present) contains no stale footer year copies', () => {
    const distDir = 'dist';
    if (!fs.existsSync(distDir)) return; // Skip if no build artifacts are present

    const files = readAllFiles(distDir);
    const contents = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');

    // Find all instances of the footer copy pattern in built assets
    const matches = contents.match(/©\s*20(\d{2})\s+RecruitScout/g) || [];
    const years = new Set(matches.map((m) => (m.match(/20(\d{2})/) || [])[0]));

    // If any footer copy exists in the bundle, it must be 2026 only
    if (years.size > 0) {
      expect(Array.from(years)).toEqual(['2026']);
    }
  });
});
