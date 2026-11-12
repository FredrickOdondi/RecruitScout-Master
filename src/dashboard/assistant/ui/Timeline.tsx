import React, { useEffect, useRef, useState } from 'react';
import { Check, X, ShieldAlert, ChevronDown, Ban } from 'lucide-react';
import type { ApprovalPreview, ToolRisk, ToolView } from '../types';

/*
 * Live work timeline. Patterns adapted from Beautiful UI (beautifului.dev, MIT):
 * pixel loader with elapsed time, tool chips, a collapsed "worked for" summary
 * and a question-style approval card. Implemented from scratch on Glacier tokens.
 */

export type StepState = 'running' | 'ok' | 'error' | 'waiting' | 'declined';

export interface Step {
  id: string;
  name: string;
  label: string;
  state: StepState;
  detail?: string;
  summary?: string;
  error?: string;
  durationMs?: number;
  view?: ToolView;
  approval?: { risk: ToolRisk; preview: ApprovalPreview; resolve: (yes: boolean) => void };
}

/** Decide on an approval; `redirect` declines and sends new instructions instead. */
export type DecideFn = (id: string, yes: boolean, redirect?: string) => void;

const RISK_COPY: Record<ToolRisk, { label: string; tone: string }> = {
  read: { label: 'Read', tone: 'bg-neutral-badge text-fg-muted' },
  write: { label: 'Change', tone: 'bg-neutral-badge text-fg-muted' },
  bulk: { label: 'Bulk change', tone: 'badge-warning' },
  destructive: { label: 'Can\'t be undone', tone: 'badge-error' },
  external: { label: 'Leaves RecruitScout', tone: 'badge-warning' },
  extension: { label: 'Controls an agent', tone: 'badge-primary' },
};

const fmt = (ms?: number) => (ms === undefined ? '' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

export function PixelLoader() {
  return (
    <span className="ai-pixels" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => <i key={i} />)}
    </span>
  );
}

/** Pixel loader + shimmering verb + live elapsed seconds. */
export function WorkingLine({ verb, since }: { verb: string; since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-2.5 text-sm" role="status">
      <PixelLoader />
      <span className="ai-shimmer">{verb}</span>
      <span className="mono-id text-fg-subtle tabular">{((now - since) / 1000).toFixed(1)}s</span>
    </div>
  );
}

function StatsView({ items }: Extract<ToolView, { kind: 'stats' }>) {
  const tone = (t?: string) =>
    t === 'success' ? 'text-success-fg' : t === 'warning' ? 'text-warning-fg' : t === 'danger' ? 'text-danger-fg' : 'text-fg';
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-px rounded-lg overflow-hidden border border-stroke-card bg-stroke-divider">
      {items.map((it) => (
        <div key={it.label} className="bg-surface px-3 py-2.5">
          <dt className="text-xs text-fg-subtle">{it.label}</dt>
          <dd className={`text-xl font-semibold tabular mt-0.5 ${tone(it.tone)}`}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TableView({ columns, rows, total }: Extract<ToolView, { kind: 'table' }>) {
  return (
    <div className="rounded-lg border border-stroke-card overflow-hidden bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular">
          <thead>
            <tr>{columns.map((c) => <th key={c} className="px-3 h-8 text-left text-xs font-medium whitespace-nowrap">{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-stroke-divider">
                {r.map((c, j) => (
                  <td key={j} className={`px-3 py-1.5 max-w-[240px] truncate ${typeof c === 'number' ? 'text-right' : ''}`} title={c === null ? '' : String(c)}>
                    {c === null || c === '' ? <span className="text-fg-subtle">—</span> : typeof c === 'number' ? c.toLocaleString() : c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total !== undefined && total > rows.length && (
        <p className="px-3 py-1.5 text-xs text-fg-subtle border-t border-stroke-divider">Showing {rows.length} of {total.toLocaleString()}</p>
      )}
    </div>
  );
}

function ApprovalCard({ step, onDecide }: { step: Step; onDecide: DecideFn }) {
  const a = step.approval!;
  const risk = RISK_COPY[a.risk];
  const [choice, setChoice] = useState<'approve' | 'decline' | 'other'>('approve');
  const [other, setOther] = useState('');
  const otherRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    if (choice === 'approve') onDecide(step.id, true);
    else if (choice === 'decline') onDecide(step.id, false);
    else if (other.trim()) onDecide(step.id, false, other.trim());
    else otherRef.current?.focus();
  };

  // Keyboard: 1/2/3 pick, Enter continues, Esc skips
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest('textarea, input');
      if (e.key === 'Escape') { e.preventDefault(); onDecide(step.id, false); }
      else if (e.key === 'Enter' && (!typing || (e.target as HTMLElement) === otherRef.current)) { e.preventDefault(); submit(); }
      else if (!typing && ['1', '2', '3'].includes(e.key)) {
        const c = (['approve', 'decline', 'other'] as const)[Number(e.key) - 1];
        setChoice(c);
        if (c === 'other') setTimeout(() => otherRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const Option = ({ id, label, hint }: { id: 'approve' | 'decline'; label: string; hint: string }) => (
    <button type="button" role="radio" aria-checked={choice === id} className="ai-option" onClick={() => setChoice(id)}>
      <span className="ai-radio" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      <span className="mono-id text-fg-subtle">{hint}</span>
    </button>
  );

  return (
    <div className="ai-approval mt-2 p-1.5 max-w-[520px]" role="group" aria-label={`Approve ${step.label}`}>
      <div className="px-2.5 pt-2 pb-1.5">
        <div className="flex items-start gap-2">
          <ShieldAlert size={16} className="text-warning-fg shrink-0 mt-0.5" aria-hidden="true" />
          <h4 className="text-sm font-semibold text-fg flex-1">{step.label}?</h4>
          <span className={`badge ${risk.tone} shrink-0`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
            {risk.label}
          </span>
        </div>
        <p className="text-sm text-fg-muted mt-1 pl-6">{a.preview.summary}</p>
        {!!a.preview.details?.length && (
          <ul className="mt-2 ml-6 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto custom-scrollbar">
            {a.preview.details.map((d, i) => <li key={i} className="ai-chip">{d}</li>)}
          </ul>
        )}
      </div>
      <div role="radiogroup" aria-label="Your decision" className="space-y-0.5 mt-1">
        <Option id="approve" label="Approve and run it" hint="1" />
        <Option id="decline" label="Don't do this" hint="2" />
        <div className="ai-option" role="radio" aria-checked={choice === 'other'} onClick={() => { setChoice('other'); otherRef.current?.focus(); }}>
          <span className="ai-radio" aria-hidden="true" />
          <input
            ref={otherRef}
            value={other}
            onChange={(e) => { setOther(e.target.value); setChoice('other'); }}
            onFocus={() => setChoice('other')}
            placeholder="Something else…"
            aria-label="Tell the Assistant to do something else"
            className="flex-1 bg-transparent border-0 p-0 text-sm text-fg placeholder:text-fg-subtle"
          />
          <span className="mono-id text-fg-subtle">3</span>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 px-1.5 pt-2 pb-1">
        <button type="button" className="btn-ghost" onClick={() => onDecide(step.id, false)}>Skip</button>
        <button type="button" className="btn-primary" onClick={submit} disabled={choice === 'other' && !other.trim()}>Continue</button>
      </div>
    </div>
  );
}

function StepRow({ step, onDecide }: { step: Step; onDecide: DecideFn }) {
  const [open, setOpen] = useState(false);
  const Icon = step.state === 'ok' ? Check : step.state === 'waiting' ? ShieldAlert : step.state === 'declined' ? Ban : X;
  const hasView = step.state === 'ok' && !!step.view;
  const chip = step.state === 'error' ? step.error : step.state === 'declined' ? 'Declined' : step.summary || step.detail;
  return (
    <li className="ai-step" data-state={step.state}>
      <span className="ai-step-node" aria-hidden="true">
        {step.state === 'running' ? <span className="w-1.5 h-1.5 rounded-full bg-accent" /> : <Icon size={11} strokeWidth={2.5} />}
      </span>
      <div className="flex items-center gap-2 min-w-0 h-6">
        <span className={`text-sm shrink-0 ${step.state === 'running' ? 'ai-shimmer' : 'text-fg'}`}>{step.label}</span>
        {chip && (
          <span className={`ai-chip min-w-0 ${step.state === 'error' ? 'text-danger-fg' : ''}`} title={chip}>{chip}</span>
        )}
        <span className="ml-auto text-xs text-fg-subtle tabular shrink-0">{fmt(step.durationMs)}</span>
        {hasView && (
          <button type="button" onClick={() => setOpen((v) => !v)} className="p-0.5 rounded text-fg-subtle hover:text-fg shrink-0" aria-label={open ? 'Hide result' : 'Show result'} aria-expanded={open}>
            <ChevronDown size={14} className="ai-summary-chevron" />
          </button>
        )}
      </div>
      {step.state === 'waiting' && step.approval && <ApprovalCard step={step} onDecide={onDecide} />}
      {hasView && open && (
        <div className="ai-unfold mt-2 mb-1">
          <div>
            {step.view!.kind === 'stats' && <StatsView {...(step.view as any)} />}
            {step.view!.kind === 'table' && <TableView {...(step.view as any)} />}
            {step.view!.kind === 'list' && (
              <ul className="text-sm text-fg-muted list-disc pl-5">{(step.view as any).items.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

/**
 * While the turn is live the steps are shown in full. Once it ends they fold
 * into one line, "Worked for 4.2 s · 3 steps", that expands on click.
 */
export default function Timeline({ steps, live, elapsedMs, onDecide }: { steps: Step[]; live: boolean; elapsedMs?: number; onDecide: DecideFn }) {
  const [expanded, setExpanded] = useState(false);
  if (!steps.length) return null;
  const waiting = steps.some((s) => s.state === 'waiting');
  const showSteps = live || waiting || expanded;
  const failed = steps.filter((s) => s.state === 'error').length;

  return (
    <div>
      {!live && !waiting && (
        <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="flex items-center gap-2 text-sm text-fg-subtle hover:text-fg-muted transition-colors">
          <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
          <span>
            Worked for {fmt(elapsedMs)} · {steps.length} {steps.length === 1 ? 'step' : 'steps'}
            {failed ? <span className="text-danger-fg"> · {failed} failed</span> : null}
          </span>
          <ChevronDown size={14} className="ai-summary-chevron" />
        </button>
      )}
      {showSteps && (
        <ol className={`ai-trace space-y-2 ${!live && !waiting ? 'mt-2.5 ai-in' : ''}`} data-live={live} aria-label="Assistant activity" aria-live="polite">
          {steps.map((s) => <StepRow key={s.id} step={s} onDecide={onDecide} />)}
        </ol>
      )}
    </div>
  );
}
