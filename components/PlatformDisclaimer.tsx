'use client';

import { Info } from 'lucide-react';

export function PlatformDisclaimer() {
  return (
    <div className="mt-6 pt-4 border-t border-slate-200">
      <div className="flex items-start gap-2 text-2xs text-slate-400 leading-relaxed max-w-4xl mx-auto text-center">
        <Info size={14} className="flex-shrink-0 mt-0.5 text-slate-300" />
        <div>
          <p className="mb-1">
            <span className="font-medium text-slate-500">Data Sources:</span> EPA ATTAINS · Water Quality Portal · NOAA CO-OPS · USGS WDFN · EPA ECHO · Blue Water Baltimore · state environmental agencies
          </p>
          <p>
            PIN is not a regulatory agency, laboratory, or certified data provider. PIN is not a substitute for professional environmental assessment or legal compliance review. PIN does not perform primary field sampling or laboratory analysis. PIN does not guarantee the accuracy, completeness, or timeliness of any third-party data it ingests. PIN scores, grades, and alerts are informational tools derived from publicly available data and automated analysis — they do not constitute official EPA, state, or federal regulatory assessments or determinations. Always verify with primary agency data and sources for compliance, permitting, or enforcement purposes.
          </p>
          <p className="mt-1">&copy; 2026 Local Seafood Projects Inc. All rights reserved. Project Pearl&trade;, Pearl&trade;, ALIA&trade;, and AQUA-LO&trade; are trademarks of Local Seafood Projects Inc.</p>
          <p className="mt-1"><a href="/dashboard/data-provenance" className="text-blue-500 hover:text-blue-700 underline">Data Provenance &amp; Methodology</a></p>
        </div>
      </div>
    </div>
  );
}
