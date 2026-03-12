'use client';

import { ICISCompliancePanel } from '@/components/ICISCompliancePanel';
import { STATE_ABBR_TO_NAME } from '@/lib/adminStateContext';
import type { DraggableSectionProps } from '@/components/DraggableSection';

interface Props {
  selectedState: string;
  setSelectedState: (state: string) => void;
  lens: any;
  DS: (content: React.ReactNode) => DraggableSectionProps;
}

export function ICISSection({
  selectedState,
  setSelectedState,
  lens,
  DS
}: Props) {
  return DS(
    <div id="section-icis">
      {!lens.sections?.has('usmap') && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <label htmlFor="icis-state-selector" className="text-xs font-medium text-slate-500">State:</label>
          <select
            id="icis-state-selector"
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            aria-label="Select state for ICIS compliance data"
            className="px-2 py-1 rounded-md border border-slate-300 text-xs bg-white cursor-pointer hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
          >
            {Object.entries(STATE_ABBR_TO_NAME).sort((a, b) => a[1].localeCompare(b[1])).map(([abbr, name]) => (
              <option key={abbr} value={abbr}>{name} ({abbr})</option>
            ))}
          </select>
        </div>
      )}
      <ICISCompliancePanel
        state={selectedState}
        compactMode={false}
      />
    </div>
  );
}