import { useState } from 'react';
import {
  Volume2,
  Eye,
  RotateCcw,
  Wrench,
  CheckSquare,
  Square,
  ShieldAlert,
} from 'lucide-react';
import type { VerificationStep } from '@/domain/remediation';

export interface VerificationChecklistProps {
  steps: VerificationStep[];
  fingerprint?: string;
  className?: string;
}

const METHOD_CONFIG: Record<
  VerificationStep['method'],
  { label: string; icon: typeof Eye; color: string }
> = {
  keyboard: {
    label: 'Keyboard Navigation',
    icon: Wrench,
    color: 'bg-purple-950/60 text-purple-300 border-purple-800/50',
  },
  'screen-reader': {
    label: 'Screen Reader Test',
    icon: Volume2,
    color: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/50',
  },
  visual: {
    label: 'Visual Inspection',
    icon: Eye,
    color: 'bg-blue-950/60 text-blue-300 border-blue-800/50',
  },
  rescan: {
    label: 'Phantom Audit Rescan',
    icon: RotateCcw,
    color: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50',
  },
};

/**
 * VerificationChecklist provides step-by-step instructions for testing fixes.
 *
 * Invariant:
 * Checking off manual steps verifies testing rigor, but NEVER automatically marks
 * a finding as 'verified'. Only scan certification can establish verified status.
 */
export function VerificationChecklist({
  steps,
  fingerprint = 'default',
  className = '',
}: VerificationChecklistProps) {
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});

  if (!steps || steps.length === 0) {
    return (
      <div className="p-3.5 rounded-lg bg-surface border border-border-subtle text-xs text-gray-400">
        No verification steps specified for this finding.
      </div>
    );
  }

  const toggleStep = (idx: number) => {
    setCheckedSteps((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const totalSteps = steps.length;
  const completedSteps = Object.values(checkedSteps).filter(Boolean).length;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header with progress */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        <span className="font-semibold text-gray-200 uppercase tracking-wider">
          Verification Checklist
        </span>
        <span className="font-mono text-[11px] text-gray-400">
          {completedSteps} of {totalSteps} manual tests checked
        </span>
      </div>

      {/* Step Items */}
      <div className="space-y-2">
        {steps.map((step, idx) => {
          const isChecked = !!checkedSteps[idx];
          const methodMeta = METHOD_CONFIG[step.method] || METHOD_CONFIG.visual;
          const MethodIcon = methodMeta.icon;
          const stepId = `verify-step-${fingerprint}-${idx}`;

          return (
            <div
              key={idx}
              className={`p-3 rounded-lg border transition-colors ${
                isChecked
                  ? 'bg-surface-raised border-emerald-800/40 opacity-90'
                  : 'bg-surface border-border-subtle'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Interactive Checkbox Button */}
                <button
                  type="button"
                  id={stepId}
                  role="checkbox"
                  aria-checked={isChecked}
                  onClick={() => toggleStep(idx)}
                  className="mt-0.5 shrink-0 text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded"
                  aria-label={`Step ${idx + 1}: ${step.instruction}`}
                >
                  {isChecked ? (
                    <CheckSquare
                      className="w-4 h-4 text-emerald-400"
                      aria-hidden="true"
                    />
                  ) : (
                    <Square className="w-4 h-4 text-gray-500" aria-hidden="true" />
                  )}
                </button>

                {/* Step Details */}
                <div className="space-y-1.5 text-xs flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-1.5 py-0.5 rounded border text-[10px] font-mono flex items-center gap-1 ${methodMeta.color}`}
                    >
                      <MethodIcon className="w-2.5 h-2.5" aria-hidden="true" />
                      <span>{methodMeta.label}</span>
                    </span>
                    <span className="text-[11px] font-mono text-gray-500">
                      Step #{idx + 1}
                    </span>
                  </div>

                  <p
                    className={`text-gray-200 leading-relaxed ${
                      isChecked ? 'line-through text-gray-400' : ''
                    }`}
                  >
                    {step.instruction}
                  </p>

                  <div className="text-[11px] text-gray-400 bg-base p-2 rounded border border-border-subtle/80 flex items-start gap-1.5">
                    <span className="text-emerald-400 font-semibold shrink-0">
                      Expected:
                    </span>
                    <span className="text-gray-300 leading-normal">
                      {step.expectedResult}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Non-misleading Notice */}
      <div className="p-2.5 rounded-lg bg-surface-raised border border-border-subtle/60 text-[11px] text-gray-400 flex items-start gap-2">
        <ShieldAlert
          className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <p className="leading-relaxed">
          <strong>Certification notice:</strong> Checking off testing steps validates
          local verification rigor. Formal <em>Verified</em> status is certified
          automatically on subsequent rescan.
        </p>
      </div>
    </div>
  );
}
