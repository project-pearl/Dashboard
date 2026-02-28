'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, CheckCircle, Database, FileCheck, Clock, Lock, 
  AlertTriangle, Users, GitBranch, Server, Eye, Calendar,
  FileText, Download, Zap, Award
} from 'lucide-react';

interface DataIntegrityPanelProps {
  regionName?: string;
}

export function DataIntegrityPanel({ regionName = 'Middle Branch' }: DataIntegrityPanelProps) {
  
  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Shield className="h-6 w-6" />
          Data Integrity & Audit Trail
        </CardTitle>
        <CardDescription>
          Chain of custody, quality assurance, and regulatory defensibility for {regionName} monitoring data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Regulatory Certification Banner */}
        <div className="bg-blue-600 text-white p-4 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <Award className="h-6 w-6" />
            <h3 className="font-bold text-lg">Regulatory-Grade Monitoring</h3>
          </div>
          <p className="text-sm opacity-90">
            PIN monitoring meets EPA QAPP (Quality Assurance Project Plan) standards and MDE data quality requirements 
            for MS4 permit compliance. All data is traceable, auditable, and defensible.
          </p>
        </div>

        {/* Data Source & Sensors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-2 border-blue-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                Data Source
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Sensor Manufacturer:</span>
                  <span className="font-semibold">YSI EXO2 / Hach</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">MDE Accepted:</span>
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                    ✓ Yes
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">EPA Method:</span>
                  <span className="font-semibold text-xs">EPA QA/R-5, ASTM methods</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Deployment Type:</span>
                  <span className="font-semibold">Vessel-mounted continuous</span>
                </div>
              </div>
              
              <div className="bg-blue-50 p-3 rounded border border-blue-200 mt-3">
                <div className="text-xs font-semibold text-blue-900 mb-1">Monitored Parameters & Methods:</div>
                <div className="text-xs text-blue-800 space-y-0.5">
                  <div>• Dissolved Oxygen <span className="text-gray-600">(ASTM D888)</span></div>
                  <div>• Total Nitrogen <span className="text-gray-600">(EPA 351.2)</span></div>
                  <div>• Turbidity <span className="text-gray-600">(ASTM D6910, EPA 180.1)</span></div>
                  <div>• Total Phosphorus <span className="text-gray-600">(EPA 365.1)</span></div>
                  <div>• TSS <span className="text-gray-600">(EPA 160.2 calculated)</span></div>
                  <div>• E. coli / Bacteria <span className="text-gray-600">(EPA Method 1103.1)</span></div>
                  <div>• pH <span className="text-gray-600">(ASTM D1293, EPA 150.1)</span></div>
                  <div>• Flow Rate <span className="text-gray-600">(Continuous measurement)</span></div>
                  <div>• Temperature <span className="text-gray-600">(ASTM D1498)</span></div>
                </div>
              </div>
              
              <div className="bg-green-50 p-2 rounded border border-green-200 mt-2">
                <div className="text-xs text-green-900">
                  <strong>Regulatory Compliance:</strong> All sensors meet EPA QA/R-5 quality assurance requirements. 
                  Methods align with 40 CFR §122.26 (MS4 storm characterization). Labs ISO/IEC 17025 accredited.
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                Sampling Frequency
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Continuous Interval:</span>
                  <span className="font-semibold">1 minute</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Data Points/Day:</span>
                  <span className="font-semibold">1,440 per parameter</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Data Points/Year:</span>
                  <span className="font-semibold">525,600 per parameter</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Storm Event Capture:</span>
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                    100% (continuous)
                  </Badge>
                </div>
              </div>
              
              <div className="bg-amber-50 p-3 rounded border border-amber-200 mt-3">
                <div className="text-xs font-semibold text-amber-900 mb-1">
                  vs. Traditional Grab Sampling:
                </div>
                <div className="text-xs text-amber-800">
                  MDE requires 12 storm events + 4 baseflow samples = <strong>16 data points/year</strong>
                  <br />
                  PIN provides <strong>32,850× more data points</strong>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* QA/QC Procedures */}
        <Card className="border-2 border-green-300 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-green-900">
              <FileCheck className="h-5 w-5" />
              Quality Assurance / Quality Control (QA/QC)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Calibration */}
              <div className="bg-white p-4 rounded border border-green-200">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-5 w-5 text-green-600" />
                  <h4 className="font-semibold text-sm text-green-900">Calibration Protocol</h4>
                </div>
                <ul className="space-y-2 text-xs text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Weekly calibration</strong> using NIST-traceable standards</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Pre/post-deployment verification</strong> documented</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Calibration logs</strong> timestamped and stored</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Automated drift detection</strong> flags anomalies</span>
                  </li>
                </ul>
              </div>

              {/* Confirmatory Sampling */}
              <div className="bg-white p-4 rounded border border-green-200">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-5 w-5 text-green-600" />
                  <h4 className="font-semibold text-sm text-green-900">Confirmatory Sampling</h4>
                </div>
                <ul className="space-y-2 text-xs text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Monthly grab samples</strong> validate sensor accuracy</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Independent lab analysis</strong> (MDE-certified)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Statistical comparison</strong> (R² &gt; 0.85 target)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Bias correction</strong> if systematic deviation detected</span>
                  </li>
                </ul>
              </div>

              {/* Data Validation */}
              <div className="bg-white p-4 rounded border border-green-200">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-5 w-5 text-green-600" />
                  <h4 className="font-semibold text-sm text-green-900">Automated Validation</h4>
                </div>
                <ul className="space-y-2 text-xs text-gray-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Range checks:</strong> Flag values outside physical limits</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Rate-of-change:</strong> Detect sensor malfunctions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Pattern recognition:</strong> AI flags anomalies</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><strong>Data quality flags:</strong> All suspect data tagged</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* QA/QC Summary */}
            <div className="bg-green-100 border-2 border-green-400 rounded-lg p-3 mt-4">
              <p className="text-xs text-green-900">
                <strong>EPA QAPP Compliance:</strong> All QA/QC procedures documented in Quality Assurance Project Plan 
                submitted to MDE. Precision/accuracy targets: ±10% for nutrients, ±5% for DO/pH, ±15% for bacteria.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Chain of Custody */}
        <Card className="border-2 border-purple-300 bg-purple-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-purple-900">
              <GitBranch className="h-5 w-5" />
              Chain of Custody & Data Lineage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              
              {/* Data Flow Diagram */}
              <div className="bg-white p-4 rounded border border-purple-200">
                <h4 className="font-semibold text-sm text-purple-900 mb-3">Data Path (Sensor → MDE Report):</h4>
                <div className="flex items-center gap-2 text-xs overflow-x-auto pb-2">
                  <div className="bg-blue-100 px-3 py-2 rounded border border-blue-300 whitespace-nowrap">
                    <div className="font-semibold text-blue-900">1. Sensor Reading</div>
                    <div className="text-blue-700">YSI EXO2 probe</div>
                  </div>
                  <span className="text-gray-400">→</span>
                  <div className="bg-blue-100 px-3 py-2 rounded border border-blue-300 whitespace-nowrap">
                    <div className="font-semibold text-blue-900">2. Data Logger</div>
                    <div className="text-blue-700">Timestamped + GPS tagged</div>
                  </div>
                  <span className="text-gray-400">→</span>
                  <div className="bg-blue-100 px-3 py-2 rounded border border-blue-300 whitespace-nowrap">
                    <div className="font-semibold text-blue-900">3. Transmission</div>
                    <div className="text-blue-700">Cellular (encrypted)</div>
                  </div>
                  <span className="text-gray-400">→</span>
                  <div className="bg-blue-100 px-3 py-2 rounded border border-blue-300 whitespace-nowrap">
                    <div className="font-semibold text-blue-900">4. Cloud Database</div>
                    <div className="text-blue-700">AWS RDS (redundant)</div>
                  </div>
                  <span className="text-gray-400">→</span>
                  <div className="bg-blue-100 px-3 py-2 rounded border border-blue-300 whitespace-nowrap">
                    <div className="font-semibold text-blue-900">5. QA/QC Engine</div>
                    <div className="text-blue-700">Validation + flagging</div>
                  </div>
                  <span className="text-gray-400">→</span>
                  <div className="bg-green-100 px-3 py-2 rounded border border-green-300 whitespace-nowrap">
                    <div className="font-semibold text-green-900">6. MDE Report</div>
                    <div className="text-green-700">Certified dataset</div>
                  </div>
                </div>
              </div>

              {/* Audit Trail Features */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="h-4 w-4 text-purple-600" />
                    <span className="font-semibold text-sm">Immutable Records</span>
                  </div>
                  <ul className="text-xs text-gray-700 space-y-1">
                    <li>• Write-once database (no deletion/editing)</li>
                    <li>• Cryptographic hashing for tamper detection</li>
                    <li>• Version history for all data revisions</li>
                  </ul>
                </div>

                <div className="bg-white p-3 rounded border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-purple-600" />
                    <span className="font-semibold text-sm">Access Logging</span>
                  </div>
                  <ul className="text-xs text-gray-700 space-y-1">
                    <li>• Every data access logged (who, when, what)</li>
                    <li>• Role-based permissions (MS4, State, Public)</li>
                    <li>• API access requires authentication</li>
                  </ul>
                </div>

                <div className="bg-white p-3 rounded border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Server className="h-4 w-4 text-purple-600" />
                    <span className="font-semibold text-sm">Data Retention</span>
                  </div>
                  <ul className="text-xs text-gray-700 space-y-1">
                    <li>• Minimum 5 years (MDE requirement)</li>
                    <li>• Redundant backups (3 geographic locations)</li>
                    <li>• Point-in-time recovery capability</li>
                  </ul>
                </div>

                <div className="bg-white p-3 rounded border border-purple-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="h-4 w-4 text-purple-600" />
                    <span className="font-semibold text-sm">Transparency</span>
                  </div>
                  <ul className="text-xs text-gray-700 space-y-1">
                    <li>• All data downloadable by municipality</li>
                    <li>• QA/QC flags visible to regulators</li>
                    <li>• Calibration logs available on request</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Regulatory Audit Readiness */}
        <Card className="border-2 border-orange-300 bg-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-orange-900">
              <FileCheck className="h-5 w-5" />
              Regulatory Audit Readiness
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded border border-orange-200">
                  <h4 className="font-semibold text-sm text-orange-900 mb-3">
                    Available for MDE Review:
                  </h4>
                  <ul className="space-y-2 text-xs text-gray-700">
                    <li className="flex items-start gap-2">
                      <Download className="h-3 w-3 text-orange-500 mt-0.5 flex-shrink-0" />
                      <span><strong>Raw data exports:</strong> CSV, Excel, JSON formats</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Download className="h-3 w-3 text-orange-500 mt-0.5 flex-shrink-0" />
                      <span><strong>QA/QC reports:</strong> Calibration logs, validation results</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Download className="h-3 w-3 text-orange-500 mt-0.5 flex-shrink-0" />
                      <span><strong>Confirmatory sample results:</strong> Lab certifications</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Download className="h-3 w-3 text-orange-500 mt-0.5 flex-shrink-0" />
                      <span><strong>Equipment maintenance logs:</strong> Service records</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Download className="h-3 w-3 text-orange-500 mt-0.5 flex-shrink-0" />
                      <span><strong>Chain of custody forms:</strong> Digital signatures</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-white p-4 rounded border border-orange-200">
                  <h4 className="font-semibold text-sm text-orange-900 mb-3">
                    Third-Party Verification:
                  </h4>
                  <ul className="space-y-2 text-xs text-gray-700">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span><strong>Lab certifications:</strong> MDE-approved facilities only</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span><strong>Equipment calibration:</strong> Factory-certified technicians</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span><strong>Data integrity:</strong> Annual third-party audits</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span><strong>SOC 2 Type II:</strong> Security & compliance certification</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                      <span><strong>UMCES validation:</strong> Peer-reviewed methodology</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Audit Access */}
              <div className="bg-orange-100 border-2 border-orange-400 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Eye className="h-5 w-5 text-orange-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm text-orange-900 mb-1">
                      MDE Audit Portal Access
                    </h4>
                    <p className="text-xs text-orange-800">
                      Maryland Department of Environment has read-only access to all PIN data, 
                      calibration records, and audit logs 24/7 through secure portal. No prior notice required 
                      for MDE data inspection. All Baltimore City data available to MDE staff with appropriate 
                      credentials.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comparison to Traditional Monitoring */}
        <Card className="border-2 border-gray-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-gray-600" />
              Data Defensibility: PIN vs Traditional Grab Sampling
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left p-2 font-semibold">Criterion</th>
                    <th className="text-left p-2 font-semibold bg-green-50">PIN Continuous</th>
                    <th className="text-left p-2 font-semibold bg-red-50">Traditional Grab</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  <tr className="border-b border-gray-200">
                    <td className="p-2 font-medium">Data Points/Year</td>
                    <td className="p-2 bg-green-50">525,600 per parameter</td>
                    <td className="p-2 bg-red-50">16 per parameter</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-2 font-medium">Storm Event Capture</td>
                    <td className="p-2 bg-green-50">100% (continuous)</td>
                    <td className="p-2 bg-red-50">~75% (depends on staff availability)</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-2 font-medium">Chain of Custody</td>
                    <td className="p-2 bg-green-50">Automated digital (timestamped, GPS-tagged)</td>
                    <td className="p-2 bg-red-50">Manual paper forms (human error risk)</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-2 font-medium">Data Audit Trail</td>
                    <td className="p-2 bg-green-50">Complete (all access logged)</td>
                    <td className="p-2 bg-red-50">Limited (sample collection only)</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-2 font-medium">QA/QC Frequency</td>
                    <td className="p-2 bg-green-50">Real-time + weekly calibration</td>
                    <td className="p-2 bg-red-50">Per sample event (weeks delayed)</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-2 font-medium">Data Availability</td>
                    <td className="p-2 bg-green-50">Immediate (real-time upload)</td>
                    <td className="p-2 bg-red-50">1-3 weeks (lab turnaround)</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-2 font-medium">Sensor Drift Detection</td>
                    <td className="p-2 bg-green-50">Automated (hourly checks)</td>
                    <td className="p-2 bg-red-50">Not applicable (discrete samples)</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-2 font-medium">Statistical Power</td>
                    <td className="p-2 bg-green-50">High (n=525,600)</td>
                    <td className="p-2 bg-red-50">Low (n=16)</td>
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="p-2 font-medium">MDE Audit Access</td>
                    <td className="p-2 bg-green-50">24/7 portal access</td>
                    <td className="p-2 bg-red-50">Request + wait for municipality</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium">Regulatory Defensibility</td>
                    <td className="p-2 bg-green-50">✓ Higher (more data, better QA/QC)</td>
                    <td className="p-2 bg-red-50">✓ Established precedent</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Regulatory Acceptance Pathway - Safe Migration */}
        <Card className="border-2 border-purple-300 bg-purple-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-purple-900">
              <Calendar className="h-5 w-5" />
              Regulatory Acceptance Pathway: Safe Migration to Continuous Monitoring
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-purple-900 mb-4">
              PIN implementation follows a phased approach that reduces regulatory risk and builds confidence incrementally:
            </p>
            
            <div className="space-y-3">
              <div className="bg-white p-4 rounded border-2 border-purple-300">
                <div className="flex items-start gap-3">
                  <div className="bg-purple-100 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-purple-900">1</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm text-purple-900 mb-1">Phase 1: Augmentation</h4>
                    <p className="text-xs text-gray-700">
                      PIN operates <strong>alongside traditional grab sampling</strong>. Side-by-side data collection 
                      proves continuous monitoring captures storm events episodic sampling misses. No changes to current 
                      MS4 permit compliance approach. Full validation study conducted.
                    </p>
                    <div className="mt-2 text-xs text-purple-700">
                      <strong>Timeline:</strong> Year 1 | <strong>MS4 Cost:</strong> No savings (both methods running) | 
                      <strong>Goal:</strong> Prove equivalency
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded border-2 border-purple-300">
                <div className="flex items-start gap-3">
                  <div className="bg-purple-100 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-purple-900">2</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm text-purple-900 mb-1">Phase 2: Storm Events & Trend Reporting</h4>
                    <p className="text-xs text-gray-700">
                      After validation demonstrates equivalency, <strong>use PIN as primary data stream for storm 
                      characterization</strong> (per 40 CFR §122.26) and annual trend reporting. Traditional grab sampling 
                      continues for baseflow conditions and specific pollutants.
                    </p>
                    <div className="mt-2 text-xs text-purple-700">
                      <strong>Timeline:</strong> Year 1-2 | <strong>MS4 Cost:</strong> 10-20% savings | 
                      <strong>Goal:</strong> Primary for storms, confirmatory for baseflow
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded border-2 border-purple-300">
                <div className="flex items-start gap-3">
                  <div className="bg-purple-100 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-purple-900">3</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm text-purple-900 mb-1">Phase 3: Reduce Grab Frequency</h4>
                    <p className="text-xs text-gray-700">
                      Where PIN coverage is proven and MDE-accepted, <strong>reduce grab sampling frequency</strong> (e.g., 
                      quarterly instead of monthly for baseflow). Confirmatory sampling validates sensors meet QA/QC targets. 
                      Consultant scope shifts from full report writing to technical review.
                    </p>
                    <div className="mt-2 text-xs text-purple-700">
                      <strong>Timeline:</strong> Year 2-3 | <strong>MS4 Cost:</strong> 30-40% savings | 
                      <strong>Goal:</strong> Reduce episodic reliance where continuous proven
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded border-2 border-green-400 bg-green-50">
                <div className="flex items-start gap-3">
                  <div className="bg-green-200 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                    <span className="font-bold text-green-900">4</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm text-green-900 mb-1">Phase 4: Primary Data Stream</h4>
                    <p className="text-xs text-gray-700">
                      PIN becomes <strong>primary monitoring method</strong> with periodic validation sampling for sensor 
                      QA/QC per EPA QA/R-5. Traditional grab sampling retained for parameters not measured by sensors 
                      (e.g., metals, specific organics). Automated reporting fully operational.
                    </p>
                    <div className="mt-2 text-xs text-green-700">
                      <strong>Timeline:</strong> Year 3+ | <strong>MS4 Cost:</strong> 50%+ savings | 
                      <strong>Goal:</strong> Full operational efficiency
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-purple-100 border-2 border-purple-400 rounded-lg p-4 mt-4">
              <p className="text-xs text-purple-900">
                <strong>Key Principle:</strong> This phased approach reduces reliance on episodic sampling where continuous 
                monitoring provides better coverage - it does not eliminate grab sampling entirely. Each phase builds MDE 
                confidence through data, not promises. MS4 maintains compliance throughout all phases.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Line for Regulators */}
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-6 rounded-lg">
          <div className="flex items-start gap-4">
            <Shield className="h-8 w-8 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-lg mb-2">For MDE Regulators: Data You Can Trust</h3>
              <p className="text-sm opacity-90 mb-3">
                PIN monitoring provides more defensible data than traditional grab sampling because:
              </p>
              <ul className="text-sm space-y-1 opacity-90">
                <li>• <strong>32,850× more data points</strong> = statistical confidence in load calculations</li>
                <li>• <strong>Complete audit trail</strong> = every data point traceable from sensor to report</li>
                <li>• <strong>Real-time QA/QC</strong> = problems detected immediately, not weeks later</li>
                <li>• <strong>Immutable records</strong> = tamper-proof database for regulatory challenges</li>
                <li>• <strong>Third-party validation</strong> = UMCES peer review + independent lab confirmation</li>
              </ul>
              <p className="text-sm opacity-90 mt-3">
                MDE has 24/7 read-only access to all data and can audit at any time without notice.
              </p>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
