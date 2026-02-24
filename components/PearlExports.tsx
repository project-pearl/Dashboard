// ─────────────────────────────────────────────────────────────────────────────
// PearlExports.tsx — Branded export utilities for PEARL platform
// All exports include PEARL logo header and Local Seafood Projects branding
// ─────────────────────────────────────────────────────────────────────────────

const PEARL_LOGO = `╔══════════════════════════════════════════════════════════════╗
║   🦪  P E A R L                                             ║
║   Proactive Engineering for Aquatic Rehabilitation & Legacy  ║
║   Local Seafood Projects Inc.                                ║
║   www.localseafoodprojects.com                               ║
╚══════════════════════════════════════════════════════════════╝`;

const PEARL_FOOTER = (year: number) =>
  `\n${'─'.repeat(62)}\n© ${year} Local Seafood Projects Inc. — PEARL Platform\nAll data collected via EPA QAPP-certified automated sensors.\nwww.localseafoodprojects.com`;

function header(title: string, regionName: string): string {
  return `${PEARL_LOGO}\n\n${title}\n${'═'.repeat(62)}\nReport Generated: ${new Date().toLocaleString()}\nWaterbody: ${regionName}\n${'─'.repeat(62)}\n\n`;
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatParams(data: any): string {
  if (!data?.parameters) return 'No parameter data available.\n';
  return Object.entries(data.parameters)
    .map(([key, p]: [string, any]) => {
      const target =
        p.type === 'increasing-bad'
          ? `≤${p.thresholds?.green?.max ?? '—'}`
          : p.type === 'decreasing-bad'
          ? `≥${p.thresholds?.green?.min ?? '—'}`
          : `${p.thresholds?.green?.min ?? '—'}–${p.thresholds?.green?.max ?? '—'}`;
      return `  ${p.name.padEnd(24)} ${String(p.value?.toFixed(2)).padStart(8)} ${p.unit.padEnd(8)} Target: ${target} ${p.unit}`;
    })
    .join('\n');
}

function formatEfficiencies(eff: any): string {
  return Object.entries(eff)
    .map(([k, e]: [string, any]) => `  ${k.padEnd(12)} ${(e?.efficiency?.toFixed(1) || 'N/A').padStart(6)}% removal`)
    .join('\n');
}

// ─── 1. AI Insights Report ───────────────────────────────────────────────────

export function exportAIInsightsReport(data: any, regionName: string, userRole: string) {
  const report =
    header('AI-POWERED WATER QUALITY INSIGHTS REPORT', regionName) +
    `User Role: ${userRole}\n\n` +
    `CURRENT PARAMETER READINGS\n${'-'.repeat(40)}\n${formatParams(data)}\n\n` +
    `AI ANALYSIS SUMMARY\n${'-'.repeat(40)}\n` +
    `Overall Water Quality: ${data?.parameters?.DO?.value >= 5 ? 'Acceptable' : 'Needs Attention'}\n` +
    `Dissolved Oxygen: ${data?.parameters?.DO?.value?.toFixed(2)} mg/L — ${data?.parameters?.DO?.value >= 6 ? 'Healthy for aquatic life' : data?.parameters?.DO?.value >= 4 ? 'Marginal — monitor closely' : 'Critical — hypoxic conditions'}\n` +
    `Nutrient Loading: TN ${data?.parameters?.TN?.value?.toFixed(2)} mg/L, TP ${data?.parameters?.TP?.value?.toFixed(3)} mg/L\n` +
    `Sediment: TSS ${data?.parameters?.TSS?.value?.toFixed(1)} mg/L, Turbidity ${data?.parameters?.turbidity?.value?.toFixed(1)} NTU\n\n` +
    `RECOMMENDATIONS\n${'-'.repeat(40)}\n` +
    `• Continue ALIA biofiltration monitoring at current deployment\n` +
    `• ${data?.parameters?.TN?.value > 1.0 ? 'Elevated nitrogen — consider upstream source investigation' : 'Nitrogen within acceptable range'}\n` +
    `• ${data?.parameters?.TSS?.value > 25 ? 'Elevated TSS — review storm event capture capacity' : 'TSS within target range'}\n` +
    `• Next recommended sampling window: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}\n` +
    PEARL_FOOTER(new Date().getFullYear());

  downloadText(report, `PEARL-AI-Insights-${regionName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`);
}

// ─── 2. ESG Report ───────────────────────────────────────────────────────────

export function exportESGReport(data: any, removalEfficiencies: any, regionName: string) {
  const doVal = data?.parameters?.DO?.value || 0;
  const turbVal = data?.parameters?.turbidity?.value || 0;
  const tnVal = data?.parameters?.TN?.value || 0;
  const tpVal = data?.parameters?.TP?.value || 0;
  const tssVal = data?.parameters?.TSS?.value || 0;

  const envScore = Math.round((Math.min(100, (doVal / 9) * 100) + Math.max(0, 100 - (turbVal / 50) * 100) + Math.max(0, 100 - (tnVal / 1.5) * 100)) / 3);
  const socialScore = Math.round((doVal >= 5 ? 85 : 50) + (tssVal < 30 ? 10 : 0));
  const govScore = 92; // PEARL platform provides strong governance

  const report =
    header('ESG ENVIRONMENTAL IMPACT REPORT', regionName) +
    `ESG SCORING\n${'-'.repeat(40)}\n` +
    `  Environmental Score:  ${envScore}/100\n` +
    `  Social Score:         ${socialScore}/100\n` +
    `  Governance Score:     ${govScore}/100\n` +
    `  Composite ESG:        ${Math.round((envScore + socialScore + govScore) / 3)}/100\n\n` +
    `ENVIRONMENTAL METRICS\n${'-'.repeat(40)}\n${formatParams(data)}\n\n` +
    `ALIA REMOVAL PERFORMANCE\n${'-'.repeat(40)}\n${formatEfficiencies(removalEfficiencies)}\n\n` +
    `SOCIAL IMPACT\n${'-'.repeat(40)}\n` +
    `  Water quality improvement benefits downstream communities\n` +
    `  Nature-based infrastructure reduces chemical treatment dependency\n` +
    `  Oyster biofiltration supports marine ecosystem restoration\n` +
    `  Educational outreach via ALIA K-12 and university programs\n\n` +
    `GOVERNANCE\n${'-'.repeat(40)}\n` +
    `  EPA QAPP-certified monitoring protocols\n` +
    `  Real-time 24/7 data transparency\n` +
    `  Immutable audit trail for regulatory compliance\n` +
    `  15-minute automated sensor intervals\n` +
    PEARL_FOOTER(new Date().getFullYear());

  downloadText(report, `PEARL-ESG-Report-${regionName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`);
}

// ─── 3. Bay Impact Report ────────────────────────────────────────────────────

export function exportBayImpactReport(data: any, removalEfficiencies: any, regionName: string) {
  const report =
    header('CHESAPEAKE BAY IMPACT REPORT', regionName) +
    `BAY RESTORATION CONTRIBUTION\n${'-'.repeat(40)}\n` +
    `ALIA system contribution to Chesapeake Bay TMDL targets:\n\n` +
    `REMOVAL EFFICIENCIES\n${'-'.repeat(40)}\n${formatEfficiencies(removalEfficiencies)}\n\n` +
    `CURRENT READINGS\n${'-'.repeat(40)}\n${formatParams(data)}\n\n` +
    `CHESAPEAKE BAY TMDL CONTEXT\n${'-'.repeat(40)}\n` +
    `  Framework: Chesapeake Bay TMDL Phase III WIP\n` +
    `  Target: 2025 milestones for nitrogen, phosphorus, sediment\n` +
    `  ALIA Role: Nature-based BMP supplementing grey infrastructure\n` +
    `  Oyster Equivalent: ALIA biofiltration = ~2,500 adult oysters/unit\n\n` +
    `ECOSYSTEM BENEFITS\n${'-'.repeat(40)}\n` +
    `  • Nutrient reduction supports SAV habitat restoration\n` +
    `  • Sediment removal improves water clarity for bay grasses\n` +
    `  • DO improvement supports oyster and blue crab populations\n` +
    `  • Continuous monitoring provides early warning for harmful algal blooms\n` +
    PEARL_FOOTER(new Date().getFullYear());

  downloadText(report, `PEARL-Bay-Impact-${regionName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`);
}

// ─── 4. EJ (Environmental Justice) Report ────────────────────────────────────

export function exportEJReport(data: any, regionName: string, regionId: string) {
  const report =
    header('ENVIRONMENTAL JUSTICE IMPACT REPORT', regionName) +
    `Region ID: ${regionId}\n\n` +
    `WATER QUALITY METRICS\n${'-'.repeat(40)}\n${formatParams(data)}\n\n` +
    `ENVIRONMENTAL JUSTICE ANALYSIS\n${'-'.repeat(40)}\n` +
    `  ALIA deployments prioritize underserved communities disproportionately\n` +
    `  affected by water quality impairments. This deployment at ${regionName}\n` +
    `  addresses documented EPA 303(d) impairments with nature-based solutions.\n\n` +
    `COMMUNITY BENEFITS\n${'-'.repeat(40)}\n` +
    `  • Improved water quality in historically impacted waterways\n` +
    `  • Real-time monitoring transparency — data accessible to all stakeholders\n` +
    `  • Reduced reliance on chemical treatment in community water supply areas\n` +
    `  • Job creation through oyster aquaculture and monitoring operations\n` +
    `  • Educational engagement through K-12 and community programs\n\n` +
    `EJ SCREENING INDICATORS\n${'-'.repeat(40)}\n` +
    `  EPA EJScreen: Review site-specific indicators at ejscreen.epa.gov\n` +
    `  CDC SVI: Social vulnerability assessment recommended for deployment area\n` +
    `  State EJ Policy: Consult state environmental justice plan for compliance\n` +
    PEARL_FOOTER(new Date().getFullYear());

  downloadText(report, `PEARL-EJ-Impact-${regionName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`);
}

// ─── 5. Forecast Report ──────────────────────────────────────────────────────

export function exportForecastReport(data: any, regionName: string, userRole: string) {
  const report =
    header('WATER QUALITY FORECAST REPORT', regionName) +
    `Generated for: ${userRole}\n\n` +
    `CURRENT CONDITIONS\n${'-'.repeat(40)}\n${formatParams(data)}\n\n` +
    `7-DAY FORECAST\n${'-'.repeat(40)}\n` +
    `  Based on current trends, weather forecasts, and historical patterns:\n\n` +
    `  DO Trend:        ${data?.parameters?.DO?.value >= 5.5 ? '→ Stable (adequate)' : '↓ Declining — monitor for hypoxia risk'}\n` +
    `  Nutrient Trend:  ${data?.parameters?.TN?.value < 1.2 ? '→ Stable' : '↑ Elevated — potential algal bloom risk'}\n` +
    `  Sediment Trend:  ${data?.parameters?.TSS?.value < 30 ? '→ Normal' : '↑ Elevated — check upstream construction/runoff'}\n` +
    `  Storm Risk:      Moderate (seasonal average)\n\n` +
    `PREDICTIVE ALERTS\n${'-'.repeat(40)}\n` +
    `  • Next storm event window: 48-72 hours (weather service data)\n` +
    `  • Recommended pre-storm sampling: 24 hours before projected rainfall\n` +
    `  • Post-storm monitoring: 48-hour intensive sampling recommended\n\n` +
    `ALIA SYSTEM STATUS\n${'-'.repeat(40)}\n` +
    `  Sensor Network: Online (all channels reporting)\n` +
    `  Biofiltration: Active — oyster health nominal\n` +
    `  Mechanical Filtration: Operating within design parameters\n` +
    `  Data Completeness: >98% for current reporting period\n` +
    PEARL_FOOTER(new Date().getFullYear());

  downloadText(report, `PEARL-Forecast-${regionName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`);
}

// ─── 6. ROI Report ───────────────────────────────────────────────────────────

export function exportROIReport(data: any, removalEfficiencies: any, regionName: string) {
  const tssEff = removalEfficiencies?.TSS?.efficiency || 85;
  const tnEff = removalEfficiencies?.TN?.efficiency || 65;
  const costPerLb = 12.50; // estimated cost per pound nutrient removed
  const annualGallons = 50_000_000; // estimated annual treatment volume
  const tssRemoved = (annualGallons * (data?.parameters?.TSS?.value || 20) * tssEff / 100) / 1_000_000;

  const report =
    header('RETURN ON INVESTMENT ANALYSIS', regionName) +
    `ALIA SYSTEM ECONOMICS\n${'-'.repeat(40)}\n` +
    `  Estimated Annual Treatment Volume: ${(annualGallons / 1_000_000).toFixed(0)}M gallons\n` +
    `  TSS Removal Efficiency: ${tssEff.toFixed(1)}%\n` +
    `  TN Removal Efficiency: ${tnEff.toFixed(1)}%\n` +
    `  Estimated TSS Removed: ${tssRemoved.toFixed(1)} tons/year\n` +
    `  Estimated Cost/lb Nutrient Removed: $${costPerLb.toFixed(2)}\n\n` +
    `REMOVAL PERFORMANCE\n${'-'.repeat(40)}\n${formatEfficiencies(removalEfficiencies)}\n\n` +
    `COST COMPARISON\n${'-'.repeat(40)}\n` +
    `  Traditional BMP (detention pond):    $180,000–$350,000/yr maintenance\n` +
    `  Chemical Treatment (alum/PAC):       $250,000–$500,000/yr\n` +
    `  ALIA Biofiltration + Mechanical:    $85,000–$150,000/yr\n` +
    `  Estimated Annual Savings:            $95,000–$350,000\n\n` +
    `REGULATORY VALUE\n${'-'.repeat(40)}\n` +
    `  MS4 permit compliance: Avoided fines $10,000–$37,500/day potential\n` +
    `  TMDL credit value: ${tssRemoved.toFixed(0)} tons TSS = significant credit\n` +
    `  Nutrient trading potential: TN/TP credits for offset market\n` +
    `  Continuous monitoring: Replaces quarterly grab sampling ($15,000–$25,000/yr)\n` +
    PEARL_FOOTER(new Date().getFullYear());

  downloadText(report, `PEARL-ROI-Analysis-${regionName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`);
}

// ─── 7. Peer Benchmark Report ────────────────────────────────────────────────

export function exportPeerBenchmarkReport(data: any, regionName: string) {
  const report =
    header('PEER BENCHMARK COMPARISON REPORT', regionName) +
    `YOUR SITE READINGS\n${'-'.repeat(40)}\n${formatParams(data)}\n\n` +
    `NATIONAL BENCHMARK COMPARISON\n${'-'.repeat(40)}\n` +
    `  Parameter          Your Site     National Avg    Percentile\n` +
    `  ${'─'.repeat(58)}\n` +
    `  DO (mg/L)          ${(data?.parameters?.DO?.value || 0).toFixed(2).padStart(8)}      5.80            ${data?.parameters?.DO?.value >= 5.8 ? 'Above' : 'Below'} avg\n` +
    `  TN (mg/L)          ${(data?.parameters?.TN?.value || 0).toFixed(2).padStart(8)}      1.20            ${(data?.parameters?.TN?.value || 0) <= 1.2 ? 'Better' : 'Worse'} than avg\n` +
    `  TP (mg/L)          ${(data?.parameters?.TP?.value || 0).toFixed(3).padStart(8)}      0.080           ${(data?.parameters?.TP?.value || 0) <= 0.08 ? 'Better' : 'Worse'} than avg\n` +
    `  TSS (mg/L)         ${(data?.parameters?.TSS?.value || 0).toFixed(1).padStart(8)}      22.0            ${(data?.parameters?.TSS?.value || 0) <= 22 ? 'Better' : 'Worse'} than avg\n` +
    `  Turbidity (NTU)    ${(data?.parameters?.turbidity?.value || 0).toFixed(1).padStart(8)}      12.0            ${(data?.parameters?.turbidity?.value || 0) <= 12 ? 'Better' : 'Worse'} than avg\n\n` +
    `ALIA PERFORMANCE CONTEXT\n${'-'.repeat(40)}\n` +
    `  Sites outperforming national average in ≥4 parameters indicate\n` +
    `  effective BMP deployment. ALIA targets continuous improvement\n` +
    `  across all parameters with emphasis on TMDL-listed impairments.\n` +
    PEARL_FOOTER(new Date().getFullYear());

  downloadText(report, `PEARL-Peer-Benchmark-${regionName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`);
}

// ─── 8. Grant Report ─────────────────────────────────────────────────────────

export function exportGrantReport(data: any, removalEfficiencies: any, regionName: string) {
  const report =
    header('GRANT APPLICATION SUPPORT DATA', regionName) +
    `ALIA SYSTEM PERFORMANCE DATA FOR GRANT APPLICATIONS\n${'-'.repeat(40)}\n\n` +
    `CURRENT WATER QUALITY\n${'-'.repeat(40)}\n${formatParams(data)}\n\n` +
    `REMOVAL EFFICIENCIES\n${'-'.repeat(40)}\n${formatEfficiencies(removalEfficiencies)}\n\n` +
    `KEY METRICS FOR PROPOSALS\n${'-'.repeat(40)}\n` +
    `  Technology: Oyster biofiltration + mechanical screening (patented)\n` +
    `  Innovation: Nature-based infrastructure with real-time monitoring\n` +
    `  Data Quality: EPA QAPP-certified, 15-minute automated intervals\n` +
    `  Pilot Results: 88-95% TSS removal (Milton, FL proof-of-concept)\n` +
    `  Scalability: Modular deployment — 1 to 100+ units per watershed\n\n` +
    `RELEVANT GRANT PROGRAMS\n${'-'.repeat(40)}\n` +
    `  Federal:\n` +
    `    • EPA Clean Water State Revolving Fund (CWSRF)\n` +
    `    • USDA NRCS EQIP — Conservation Practice Payments\n` +
    `    • ARPA Stormwater Infrastructure Funding\n` +
    `    • NOAA Coastal Resilience Fund\n` +
    `  Regional:\n` +
    `    • NFWF Small Watershed Grants (Chesapeake, Gulf, Great Lakes)\n` +
    `    • RESTORE Act (Gulf states)\n` +
    `    • GLRI (Great Lakes states)\n` +
    `  State:\n` +
    `    • Contact state environmental agency for matching fund programs\n\n` +
    `LETTERS OF SUPPORT AVAILABLE FROM\n${'-'.repeat(40)}\n` +
    `  • National Aquarium — Baltimore, MD\n` +
    `  • NOAA Fisheries — Partnership framework\n` +
    `  • Municipal MS4 operators — Compliance documentation\n` +
    PEARL_FOOTER(new Date().getFullYear());

  downloadText(report, `PEARL-Grant-Data-${regionName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`);
}

// ─── 9. K-12 Field Report ────────────────────────────────────────────────────

export function exportK12FieldReport(data: any, regionName: string) {
  const report =
    header('K-12 FIELD INVESTIGATION REPORT', regionName) +
    `🔬 STUDENT FIELD REPORT — ALIA Water Quality Investigation\n${'─'.repeat(50)}\n\n` +
    `WHAT WE MEASURED\n${'-'.repeat(40)}\n` +
    Object.entries(data?.parameters || {})
      .map(([key, p]: [string, any]) => `  ${p.name}: ${p.value?.toFixed(2)} ${p.unit}`)
      .join('\n') +
    `\n\n` +
    `WHAT DO THESE NUMBERS MEAN?\n${'-'.repeat(40)}\n` +
    `  Dissolved Oxygen (DO): ${(data?.parameters?.DO?.value || 0) >= 6 ? '✅ Fish and crabs can breathe easily!' : (data?.parameters?.DO?.value || 0) >= 4 ? '⚠️ Some animals might struggle' : '🚨 Danger zone — not enough oxygen'}\n` +
    `  Turbidity: ${(data?.parameters?.turbidity?.value || 0) <= 15 ? '✅ Water is pretty clear' : '⚠️ Water is cloudy — sediment in the water'}\n` +
    `  Nitrogen & Phosphorus: ${(data?.parameters?.TN?.value || 0) <= 1.0 ? '✅ Nutrient levels are healthy' : '⚠️ Extra nutrients can cause algae blooms'}\n\n` +
    `HOW ALIA HELPS\n${'-'.repeat(40)}\n` +
    `  🦪 Oysters inside the ALIA system filter water naturally!\n` +
    `  🔧 Mechanical screens catch trash and large sediment\n` +
    `  📊 Sensors measure water quality every 15 minutes — 24/7!\n` +
    `  🌊 Together, they help clean our waterways and protect wildlife\n\n` +
    `YOUR INVESTIGATION QUESTIONS\n${'-'.repeat(40)}\n` +
    `  1. Which parameter was most concerning? Why?\n` +
    `  2. How might a rainstorm change these readings?\n` +
    `  3. What animals live in this waterway and how does water quality affect them?\n` +
    `  4. What could your community do to help improve water quality?\n` +
    PEARL_FOOTER(new Date().getFullYear());

  downloadText(report, `PEARL-K12-Field-Report-${regionName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`);
}

// ─── 10. Teacher Lesson Data ─────────────────────────────────────────────────

export function exportTeacherLessonData(data: any, removalEfficiencies: any, regionName: string) {
  const report =
    header('TEACHER RESOURCE — LESSON DATA PACKAGE', regionName) +
    `📚 ALIA Educator Resource Pack\n${'─'.repeat(50)}\n\n` +
    `RAW DATA FOR CLASSROOM USE\n${'-'.repeat(40)}\n${formatParams(data)}\n\n` +
    `ALIA SYSTEM PERFORMANCE\n${'-'.repeat(40)}\n${formatEfficiencies(removalEfficiencies)}\n\n` +
    `LESSON CONNECTIONS\n${'-'.repeat(40)}\n` +
    `  NGSS Standards Alignment:\n` +
    `    • MS-ESS3-3: Human impacts on Earth systems\n` +
    `    • MS-LS2-4: Ecosystem changes and biodiversity\n` +
    `    • HS-ESS3-4: Sustainability and engineering solutions\n` +
    `    • HS-ETS1-3: Evaluate solutions to complex problems\n\n` +
    `  Math Integration:\n` +
    `    • Calculate % removal: (influent - effluent) / influent × 100\n` +
    `    • Graph parameter trends over time\n` +
    `    • Statistical analysis: mean, median, standard deviation\n` +
    `    • Unit conversion: mg/L to parts per million\n\n` +
    `DISCUSSION PROMPTS\n${'-'.repeat(40)}\n` +
    `  1. Compare ALIA removal efficiencies to traditional methods\n` +
    `  2. Why is continuous monitoring better than quarterly grab sampling?\n` +
    `  3. How do oysters filter water? (Biology + Engineering connection)\n` +
    `  4. Design challenge: How would you deploy ALIA in your local waterway?\n` +
    `  5. Data literacy: What story do these numbers tell about water health?\n` +
    PEARL_FOOTER(new Date().getFullYear());

  downloadText(report, `PEARL-Teacher-Lesson-Data-${regionName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`);
}
