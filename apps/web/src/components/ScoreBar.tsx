import React from 'react';
import { ScoreBreakdown } from '../types';

const DIMENSIONS: { key: keyof ScoreBreakdown; label: string; color: string }[] = [
  { key: 'constraintCompliance', label: 'Constraint', color: '#6366f1' },
  { key: 'answerQuality', label: 'Quality', color: '#22d3ee' },
  { key: 'methodologyFit', label: 'Method', color: '#10b981' },
  { key: 'evidenceQuality', label: 'Evidence', color: '#f59e0b' },
  { key: 'coverageDepth', label: 'Coverage', color: '#8b5cf6' },
  { key: 'reasoningClarity', label: 'Reasoning', color: '#ec4899' },
  { key: 'speedCostEfficiency', label: 'Speed', color: '#14b8a6' },
];

interface Props {
  score: ScoreBreakdown;
  compact?: boolean;
}

export function ScoreBar({ score, compact = false }: Props) {
  return (
    <div className="space-y-1">
      {DIMENSIONS.map(({ key, label, color }) => {
        const val = score[key] as number;
        const pct = Math.min(100, Math.max(0, val));
        return (
          <div key={key} className="flex items-center gap-2">
            <span
              className="text-xs text-slate-400 shrink-0"
              style={{ width: compact ? 52 : 68, fontSize: compact ? 9 : 10 }}
            >
              {label}
            </span>
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <span
              className="text-xs font-semibold shrink-0 tabular-nums"
              style={{ color, width: compact ? 24 : 28, fontSize: compact ? 9 : 10 }}
            >
              {Math.round(val)}
            </span>
          </div>
        );
      })}
      <div className="flex items-center justify-between pt-1 border-t border-slate-800">
        <span className="text-xs text-slate-400" style={{ fontSize: compact ? 9 : 10 }}>TOTAL</span>
        <span
          className="font-bold tabular-nums"
          style={{
            fontSize: compact ? 14 : 18,
            color: score.total >= 80 ? '#10b981' : score.total >= 60 ? '#f59e0b' : '#ef4444',
          }}
        >
          {Math.round(score.total)}
        </span>
      </div>
    </div>
  );
}
