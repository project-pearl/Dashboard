'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const PARAM_OPTIONS = [
  { key: 'DO', label: 'Dissolved Oxygen', unit: 'mg/L' },
  { key: 'pH', label: 'pH', unit: 'SU' },
  { key: 'temperature', label: 'Temperature', unit: 'deg C' },
  { key: 'turbidity', label: 'Turbidity', unit: 'NTU' },
  { key: 'bacteria', label: 'E. coli / Bacteria', unit: 'CFU/100mL' },
  { key: 'TN', label: 'Total Nitrogen', unit: 'mg/L' },
  { key: 'TP', label: 'Total Phosphorus', unit: 'mg/L' },
  { key: 'conductivity', label: 'Conductivity', unit: 'uS/cm' },
] as const;

interface WaterSampleUploadFormProps {
  mode: 'citizen' | 'student';
  userId: string;
  stateAbbr: string;
  teacherUid?: string;
  onSubmitted?: () => void;
}

export function WaterSampleUploadForm({ mode, userId, stateAbbr, teacherUid, onSubmitted }: WaterSampleUploadFormProps) {
  const [parameter, setParameter] = useState('');
  const [value, setValue] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locationName, setLocationName] = useState('');
  const [sampleDate, setSampleDate] = useState(new Date().toISOString().slice(0, 16));
  // Citizen-specific
  const [volunteerId, setVolunteerId] = useState('');
  const [calibrated, setCalibrated] = useState(false);
  const [duplicateCollected, setDuplicateCollected] = useState(false);
  const [blankCollected, setBlankCollected] = useState(false);
  // Student-specific
  const [studentName, setStudentName] = useState('');
  const [teamName, setTeamName] = useState('');
  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const selectedParam = PARAM_OPTIONS.find(p => p.key === parameter);
  const isCitizen = mode === 'citizen';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!parameter || !value || !latitude || !longitude) return;

    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch('/api/uploads/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parameter,
          value: parseFloat(value),
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          location_name: locationName || undefined,
          sample_date: sampleDate ? new Date(sampleDate).toISOString() : undefined,
          user_id: userId,
          user_role: isCitizen ? 'NGO' : 'K12',
          state_abbr: stateAbbr,
          volunteer_id: isCitizen ? volunteerId || undefined : undefined,
          qa_checklist: isCitizen ? { calibrated, duplicateCollected, blankCollected } : undefined,
          student_name: !isCitizen ? studentName || undefined : undefined,
          team_name: !isCitizen ? teamName || undefined : undefined,
          teacher_uid: !isCitizen ? teacherUid || undefined : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setResult({ success: true, message: 'Sample submitted for review!' });
        // Reset form
        setValue('');
        setLocationName('');
        onSubmitted?.();
      } else {
        setResult({ success: false, message: data.error || 'Submission failed' });
      }
    } catch {
      setResult({ success: false, message: 'Network error — please try again' });
    } finally {
      setSubmitting(false);
    }
  }

  const accentColor = isCitizen ? 'amber' : 'indigo';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList size={16} className={`text-${accentColor}-600`} />
          {isCitizen ? 'Submit Field Reading' : 'Record Lab Result'}
        </CardTitle>
        <CardDescription>
          {isCitizen
            ? 'Enter water quality measurements from your field monitoring session'
            : 'Enter your water quality measurements from the lab or field'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Parameter + Value row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1 block">Parameter</label>
              <select
                value={parameter}
                onChange={e => setParameter(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-300 bg-white px-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select parameter...</option>
                {PARAM_OPTIONS.map(p => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1 block">Value</label>
              <input
                type="number"
                step="any"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="e.g. 7.2"
                className="w-full h-9 rounded-md border border-slate-300 px-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1 block">Unit</label>
              <div className="h-9 rounded-md border border-slate-200 bg-slate-50 px-2 flex items-center text-xs text-slate-500">
                {selectedParam?.unit || '—'}
              </div>
            </div>
          </div>

          {/* Location row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1 block">Station / Site Name</label>
              <input
                type="text"
                value={locationName}
                onChange={e => setLocationName(e.target.value)}
                placeholder="e.g. Mill Creek - Site A"
                className="w-full h-9 rounded-md border border-slate-300 px-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1 block">Latitude</label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={e => setLatitude(e.target.value)}
                placeholder="e.g. 39.2904"
                className="w-full h-9 rounded-md border border-slate-300 px-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1 block">Longitude</label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={e => setLongitude(e.target.value)}
                placeholder="e.g. -76.6122"
                className="w-full h-9 rounded-md border border-slate-300 px-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          {/* Date/time */}
          <div className="max-w-xs">
            <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1 block">Sample Date & Time</label>
            <input
              type="datetime-local"
              value={sampleDate}
              onChange={e => setSampleDate(e.target.value)}
              className="w-full h-9 rounded-md border border-slate-300 px-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Citizen-specific: Volunteer ID + QA checklist */}
          {isCitizen && (
            <div className="space-y-3 border-t pt-3">
              <div className="max-w-xs">
                <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1 block">Volunteer ID</label>
                <input
                  type="text"
                  value={volunteerId}
                  onChange={e => setVolunteerId(e.target.value)}
                  placeholder="e.g. VOL-2024-042"
                  className="w-full h-9 rounded-md border border-slate-300 px-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-2 block">QA/QC Checklist</label>
                <div className="flex flex-wrap gap-3">
                  {[
                    { key: 'calibrated', label: 'Equipment calibrated', checked: calibrated, set: setCalibrated },
                    { key: 'duplicate', label: 'Duplicate sample collected', checked: duplicateCollected, set: setDuplicateCollected },
                    { key: 'blank', label: 'Field blank collected', checked: blankCollected, set: setBlankCollected },
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={e => item.set(e.target.checked)}
                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs text-slate-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Student-specific: Student name + Team name */}
          {!isCitizen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t pt-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1 block">Student Name</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  placeholder="Your name"
                  className="w-full h-9 rounded-md border border-slate-300 px-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide mb-1 block">Team Name</label>
                <input
                  type="text"
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  placeholder="e.g. Team River Hawks"
                  className="w-full h-9 rounded-md border border-slate-300 px-2 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-3 pt-1">
            <Button
              type="submit"
              disabled={submitting || !parameter || !value || !latitude || !longitude}
              className={`${isCitizen ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white`}
            >
              {submitting ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              {submitting ? 'Submitting...' : 'Submit Reading'}
            </Button>
            <Badge variant="secondary" className="text-[10px]">Status: PENDING until approved</Badge>
          </div>

          {/* Result message */}
          {result && (
            <div className={`flex items-center gap-2 p-2 rounded-md text-xs ${
              result.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}>
              {result.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {result.message}
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
