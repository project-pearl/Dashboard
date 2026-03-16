'use client';

import type { AudienceSegment } from '@/lib/outreach/types';

const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

interface Props {
  segment: AudienceSegment;
  onGenerateEmail?: (segmentId: string) => void;
  onDelete?: (segmentId: string) => void;
  selected?: boolean;
  onSelect?: (segmentId: string) => void;
}

export default function SegmentCard({ segment, onGenerateEmail, onDelete, selected, onSelect }: Props) {
  return (
    <div
      className={`border rounded-lg p-4 space-y-3 transition-colors ${
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-400'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {onSelect && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onSelect(segment.id)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
          )}
          <h3 className="font-semibold text-gray-900 dark:text-white">{segment.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${PRIORITY_COLORS[segment.priority]}`}>
            {segment.priority}
          </span>
          {onDelete && (
            <button
              onClick={() => onDelete(segment.id)}
              className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
              title="Delete segment"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">{segment.description}</p>

      <div className="text-xs text-gray-500 dark:text-gray-500">
        <span className="font-medium">Tone:</span> {segment.roleMapping}
      </div>

      <div>
        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Pain Points</h4>
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
          {segment.painPoints.slice(0, 3).map((p, i) => (
            <li key={i} className="flex items-start gap-1">
              <span className="text-red-400 mt-0.5">&#x2022;</span> {p}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Buying Motivations</h4>
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
          {segment.buyingMotivations.slice(0, 3).map((m, i) => (
            <li key={i} className="flex items-start gap-1">
              <span className="text-green-400 mt-0.5">&#x2022;</span> {m}
            </li>
          ))}
        </ul>
      </div>

      {segment.decisionMakers.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Key Roles / Decision Makers</h4>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
            {segment.decisionMakers.map((dm, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-blue-400 mt-0.5">&#x2022;</span> {dm}
              </li>
            ))}
          </ul>
        </div>
      )}

      {onGenerateEmail && (
        <button
          onClick={() => onGenerateEmail(segment.id)}
          className="w-full mt-2 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors"
        >
          Generate Email
        </button>
      )}
    </div>
  );
}
