import { useEffect, useRef } from 'react';
import { ShieldCheck, Info, X } from 'lucide-react';
import { Button } from '@/components/shared';

interface ActiveTabExplainerProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Accessible dialog explaining the activeTab temporary permission model.
 * Educates the user on privacy-first design: zero persistent access, zero tracking.
 *
 * Implements WCAG 2.1/2.2 AA compliant modal semantics:
 * - Focus trapping (Tab / Shift+Tab)
 * - Escape key dismissal
 * - Auto-focus on dialog opening
 * - Focus restoration to initiating trigger element upon close
 * - Backdrop click dismissal
 */
export function ActiveTabExplainer({
  isOpen,
  onClose,
  triggerRef,
}: ActiveTabExplainerProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Auto-focus the close button on modal open
    const focusTimer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Focus trapping inside modal dialog (DEF-934)
      if (e.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const focusable = Array.from(focusableElements).filter(
          (el) =>
            !el.hasAttribute('disabled') &&
            (el.offsetParent !== null || el.style.display !== 'none')
        );

        if (focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (!dialogRef.current.contains(document.activeElement)) {
          e.preventDefault();
          firstElement?.focus();
          return;
        }

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    const triggerEl = triggerRef?.current;
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to original trigger element upon close
      if (triggerEl && typeof triggerEl.focus === 'function') {
        triggerEl.focus();
      }
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="explainer-title"
        className="w-full max-w-md p-6 rounded-2xl bg-surface-raised border border-purple-500/50 shadow-glow space-y-4 text-xs"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-900/40 text-purple-300 border border-purple-700/40">
              <ShieldCheck className="w-5 h-5 text-spectral-accent" aria-hidden="true" />
            </div>
            <h3
              id="explainer-title"
              className="text-sm font-bold text-white font-display"
            >
              Privacy-First Page Access
            </h3>
          </div>
          <Button
            ref={closeButtonRef}
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close Privacy Dialog"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>

        <p className="text-gray-300 leading-relaxed">
          Phantom Audit utilizes Chromium's <strong>activeTab</strong> permission model to
          inspect web pages responsibly:
        </p>

        <ul className="space-y-2 text-gray-300">
          <li className="flex items-start gap-2">
            <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong>User-Gesture Required:</strong> Access is granted <em>only</em> when
              you explicitly click the extension icon. It never runs automatically in the
              background.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong>Ephemeral Lifecycle:</strong> Permission is strictly temporary and
              is revoked the moment the tab navigates or closes.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong>Zero Remote Code:</strong> No data leaves your machine.
              Accessibility checks are processed locally in your browser.
            </span>
          </li>
        </ul>

        <div className="pt-2 flex justify-end">
          <Button variant="primary" size="sm" onClick={onClose}>
            Understood
          </Button>
        </div>
      </div>
    </div>
  );
}
