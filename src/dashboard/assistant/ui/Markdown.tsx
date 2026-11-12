import React from 'react';

/**
 * Small, safe Markdown renderer for Assistant replies: headings, paragraphs,
 * lists, tables, code, quotes, rules, bold, italic, inline code and links.
 * Builds React elements (never innerHTML) and only links http(s) and mailto.
 */

type Block =
  | { t: 'h'; level: number; text: string }
  | { t: 'p'; text: string }
  | { t: 'ul' | 'ol'; items: string[] }
  | { t: 'table'; head: string[]; rows: string[][]; align: ('left' | 'right' | 'center')[] }
  | { t: 'code'; text: string }
  | { t: 'quote'; text: string }
  | { t: 'hr' };

const splitRow = (line: string) =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (line.trim().startsWith('```')) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) body.push(lines[i++]);
      i++;
      blocks.push({ t: 'code', text: body.join('\n') });
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { blocks.push({ t: 'h', level: Math.min(h[1].length, 3), text: h[2] }); i++; continue; }
    if (/^\s*(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(line)) { blocks.push({ t: 'hr' }); i++; continue; }

    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const head = splitRow(line);
      const align = splitRow(lines[i + 1]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left')) as ('left' | 'right' | 'center')[];
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(splitRow(lines[i++]));
      blocks.push({ t: 'table', head, rows, align });
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*+]\s+/, ''));
      blocks.push({ t: 'ul', items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''));
      blocks.push({ t: 'ol', items });
      continue;
    }
    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ''));
      blocks.push({ t: 'quote', text: body.join(' ') });
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length && lines[i].trim() &&
      !/^(#{1,6})\s|^\s*[-*+]\s+|^\s*\d+[.)]\s+|^\s*>|^```/.test(lines[i]) &&
      !(lines[i].includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1]))
    ) para.push(lines[i++]);
    blocks.push({ t: 'p', text: para.join('\n') });
  }
  return blocks;
}

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

/** Inline: `code`, **bold**, *italic* / _italic_, [text](url), bare URLs, line breaks. */
export function renderInline(text: string, keyBase = 'i'): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))|(\*[^*\s][^*]*\*)|(\b_[^_\s][^_]*_\b)|(https?:\/\/[^\s)]+)|(\n)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${k++}`;
    if (m[1]) out.push(<code key={key}>{tok.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={key}>{renderInline(tok.slice(2, -2), key)}</strong>);
    else if (m[3]) {
      const [, label, url] = tok.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/) || [];
      out.push(SAFE_URL.test(url) ? <a key={key} href={url} target="_blank" rel="noopener noreferrer">{label}</a> : label);
    } else if (m[4] || m[5]) out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    else if (m[6]) out.push(<a key={key} href={tok} target="_blank" rel="noopener noreferrer">{tok}</a>);
    else if (m[7]) out.push(<br key={key} />);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Markdown({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const blocks = parseBlocks(text);
  return (
    <div className="ai-md text-sm leading-6 text-fg">
      {blocks.map((b, idx) => {
        const isLast = idx === blocks.length - 1;
        const caret = streaming && isLast ? ' ai-caret' : '';
        const key = `b${idx}`;
        switch (b.t) {
          case 'h': {
            const Tag = (`h${b.level}`) as 'h1' | 'h2' | 'h3';
            return <Tag key={key} className={caret.trim() || undefined}>{renderInline(b.text, key)}</Tag>;
          }
          case 'p': return <p key={key} className={caret.trim() || undefined}>{renderInline(b.text, key)}</p>;
          case 'ul':
          case 'ol': {
            const Tag = b.t;
            return (
              <Tag key={key}>
                {b.items.map((it, j) => (
                  <li key={j} className={streaming && isLast && j === b.items.length - 1 ? 'ai-caret' : undefined}>{renderInline(it, `${key}-${j}`)}</li>
                ))}
              </Tag>
            );
          }
          case 'table':
            return (
              <div key={key} className="overflow-x-auto rounded-lg border border-stroke-card">
                <table className="w-full text-sm tabular">
                  <thead>
                    <tr>{b.head.map((c, j) => <th key={j} className="px-3 h-9 text-left font-medium" style={{ textAlign: b.align[j] }}>{renderInline(c, `${key}-h${j}`)}</th>)}</tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, ri) => (
                      <tr key={ri} className="border-t border-stroke-divider">
                        {r.map((c, j) => <td key={j} className="px-3 py-2" style={{ textAlign: b.align[j] || (/^[\d,.\s%€$-]+$/.test(c) ? 'right' : 'left') }}>{renderInline(c, `${key}-${ri}-${j}`)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'code': return <pre key={key}><code>{b.text}</code></pre>;
          case 'quote': return <blockquote key={key}>{renderInline(b.text, key)}</blockquote>;
          case 'hr': return <hr key={key} />;
          default: return null;
        }
      })}
      {streaming && blocks.length === 0 && <p className="ai-caret" />}
    </div>
  );
}
