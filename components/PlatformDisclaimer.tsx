'use client';

import { Info } from 'lucide-react';

export function PlatformDisclaimer() {
  return (
    <div className="mt-6 pt-4 border-t border-slate-200">
      <div className="flex items-start gap-2 text-[10px] text-slate-400 leading-relaxed max-w-4xl mx-auto text-center">
        <Info size={14} className="flex-shrink-0 mt-0.5 text-slate-300" />
        <div>
          <p className="mb-1">
            <span className="font-medium text-slate-500">Data Sources:</span> EPA ATTAINS · Water Quality Portal · NOAA CO-OPS · USGS WDFN · EPA ECHO · Blue Water Baltimore · state environmental agencies
          </p>
          <p>
            PIN grades and alerts are informational tools derived from publicly available data and automated analysis. They are not official EPA, MDE, or state assessments and do not constitute regulatory determinations. Always verify with primary agency data for compliance or permitting purposes. Data freshness and completeness vary — stale or absent data results in &quot;Unassessed&quot; status to reflect uncertainty.
          </p>
          <p className="mt-1">&copy; 2026 Local Seafood Projects Inc. All rights reserved. Project Pearl&trade;, Pearl&trade;, ALIA&trade;, and AQUA-LO&trade; are trademarks of Local Seafood Projects Inc.</p>
          <p className="mt-1"><a href="/dashboard/data-provenance" className="text-blue-500 hover:text-blue-700 underline">Data Provenance &amp; Methodology</a></p>
        </div>
      </div>
    </div>
  );
}
