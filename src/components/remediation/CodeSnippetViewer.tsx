import { useState, useRef, type KeyboardEvent } from 'react';
import { Copy, Check, AlertCircle, FileCode } from 'lucide-react';
import type { CodeSnippet, SnippetLanguage } from '@/domain/remediation';

export interface CodeSnippetViewerProps {
  snippets: CodeSnippet[];
  className?: string;
}

const LANGUAGE_LABELS: Record<SnippetLanguage, string> = {
  html: 'HTML5 Semantic',
  react: 'React / JSX',
  css: 'CSS Styling',
};

/**
 * CodeSnippetViewer provides a tabbed multi-syntax code viewer.
 *
 * Invariants:
 * - Pure text rendering via React text nodes — ZERO dangerouslySetInnerHTML.
 * - Dynamic language tabs: only languages present in snippets are rendered.
 * - Sequential line numbering.
 * - Fully accessible tab pattern with W3C ARIA keyboard navigation.
 * - Copy button with visual feedback for success and failure.
 */
export function CodeSnippetViewer({ snippets, className = '' }: CodeSnippetViewerProps) {
  // Default to the snippet marked primary, or the first snippet
  const initialIndex =
    snippets && snippets.length > 0
      ? Math.max(
          0,
          snippets.findIndex((s) => s.isPrimary)
        )
      : 0;
  const [activeIdx, setActiveIdx] = useState(initialIndex);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (!snippets || snippets.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-base border border-border-subtle text-xs text-gray-400 font-sans">
        No code snippets available for this rule.
      </div>
    );
  }

  const activeSnippet = snippets[activeIdx] ?? snippets[0];
  if (!activeSnippet) {
    return null;
  }

  const lines = (activeSnippet.code || '').split('\n');

  const handleCopy = async () => {
    if (!activeSnippet?.code) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(activeSnippet.code);
        setCopied(true);
        setCopyFailed(false);
        setTimeout(() => setCopied(false), 2000);
      } else {
        throw new Error('Clipboard API unavailable in current context');
      }
    } catch {
      setCopyFailed(true);
      setCopied(false);
      setTimeout(() => setCopyFailed(false), 3000);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIdx = index;
    if (e.key === 'ArrowRight') {
      nextIdx = (index + 1) % snippets.length;
    } else if (e.key === 'ArrowLeft') {
      nextIdx = (index - 1 + snippets.length) % snippets.length;
    } else if (e.key === 'Home') {
      nextIdx = 0;
    } else if (e.key === 'End') {
      nextIdx = snippets.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    setActiveIdx(nextIdx);
    tabRefs.current[nextIdx]?.focus();
  };

  return (
    <div
      className={`rounded-xl bg-surface border border-border-default shadow-sm overflow-hidden ${className}`}
    >
      {/* Tab Navigation Header */}
      <div className="flex items-center justify-between bg-surface-raised border-b border-border-subtle px-3 pt-2 gap-2 flex-wrap">
        <div
          role="tablist"
          aria-label="Code snippet languages"
          className="flex items-center gap-1 overflow-x-auto"
        >
          {snippets.map((snippet, idx) => {
            const isActive = activeIdx === idx;
            return (
              <button
                key={`${snippet.language}-${idx}`}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                role="tab"
                id={`snippet-tab-${snippet.language}-${idx}`}
                aria-selected={isActive}
                aria-controls={`snippet-panel-${snippet.language}-${idx}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveIdx(idx)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors border-t border-x ${
                  isActive
                    ? 'bg-surface text-cyan-300 border-border-default border-b-transparent shadow-sm'
                    : 'bg-transparent text-gray-400 hover:text-gray-200 border-transparent'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {LANGUAGE_LABELS[snippet.language] || snippet.language.toUpperCase()}
                </span>
                {snippet.isPrimary && (
                  <span className="text-[10px] px-1 py-0.2 rounded bg-purple-950/80 text-purple-300 font-mono border border-purple-700/50">
                    Primary
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Copy Button */}
        <div className="pb-2">
          <button
            type="button"
            onClick={handleCopy}
            aria-label={`Copy ${activeSnippet.title} ${activeSnippet.language.toUpperCase()} code`}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium rounded bg-surface border border-border-subtle hover:bg-surface-overlay text-gray-200 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : copyFailed ? (
              <>
                <AlertCircle className="w-3 h-3 text-red-400" aria-hidden="true" />
                <span className="text-red-400">Copy Failed</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-cyan-400" aria-hidden="true" />
                <span>Copy Snippet</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Snippet Content Body */}
      <div
        role="tabpanel"
        id={`snippet-panel-${activeSnippet.language}-${activeIdx}`}
        aria-labelledby={`snippet-tab-${activeSnippet.language}-${activeIdx}`}
        tabIndex={0}
        className="p-3.5 space-y-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500/50"
      >
        {/* Snippet Title */}
        <div className="flex items-center justify-between text-xs font-semibold text-gray-200">
          <span>{activeSnippet.title}</span>
          <span className="text-[11px] font-mono text-gray-500 uppercase">
            {activeSnippet.language}
          </span>
        </div>

        {/* Code Block with Sequential Line Numbers */}
        <pre className="p-3 rounded-lg bg-base border border-border-subtle font-mono text-xs overflow-x-auto text-gray-100 leading-relaxed shadow-inner">
          <code className="table w-full">
            {lines.map((line, lineIdx) => (
              <span key={lineIdx} className="table-row">
                <span
                  className="table-cell select-none text-right pr-4 text-gray-600 text-[11px] w-8 shrink-0 font-mono"
                  aria-hidden="true"
                >
                  {lineIdx + 1}
                </span>
                <span className="table-cell whitespace-pre font-mono text-gray-200 break-words">
                  {line || ' '}
                </span>
              </span>
            ))}
          </code>
        </pre>

        {/* Snippet Explanation Footer */}
        {activeSnippet.explanation && (
          <div className="p-2.5 rounded bg-surface-raised border border-border-subtle text-xs text-gray-300 leading-relaxed flex items-start gap-2">
            <span className="text-cyan-400 font-bold shrink-0 text-sm">ⓘ</span>
            <p className="text-gray-300">{activeSnippet.explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
