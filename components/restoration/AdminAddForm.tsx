'use client';

import React, { useState } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import type { Pillar, ModuleCategory, PartnerStrength } from '@/components/treatment/treatmentData';
import { MODULE_CATS } from '@/components/treatment/treatmentData';

interface AdminAddFormProps {
  type: 'module' | 'partner' | 'event';
  onAdd: (item: any) => void;
  onClose: () => void;
}

export default function AdminAddForm({ type, onAdd, onClose }: AdminAddFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [costPer, setCostPer] = useState('');
  const [value, setValue] = useState('');
  const [cost, setCost] = useState('');
  const [frequency, setFrequency] = useState('Quarterly');
  const [volunteers, setVolunteers] = useState('10');
  const [categorizing, setCategorizing] = useState(false);
  const [autoCategory, setAutoCategory] = useState('');
  const [autoPillars, setAutoPillars] = useState<Pillar[]>([]);
  const [autoStrengths, setAutoStrengths] = useState<PartnerStrength[]>([]);

  const handleAutoCategorize = async () => {
    if (!name && !description) return;
    setCategorizing(true);
    try {
      const res = await fetch('/api/ai-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name, description }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.category) {
          setAutoCategory(data.category);
          setCategory(data.category);
        }
        if (data.pillars) setAutoPillars(data.pillars);
        if (data.strengths) setAutoStrengths(data.strengths);
      }
    } catch {
      // Silently fail — user can still manually categorize
    } finally {
      setCategorizing(false);
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const id = `custom_${Date.now()}`;
    const pillars = autoPillars.length > 0 ? autoPillars : ['SW' as Pillar];

    if (type === 'module') {
      onAdd({
        id,
        cat: (category || 'Emerging') as ModuleCategory,
        name: name.trim(),
        icon: '\u2699\ufe0f',
        costPer: Number(costPer) || 10000,
        defUnits: 1,
        gpm: 0,
        salMax: 99,
        mo: 3,
        doBoost: 0,
        tss: 0, bac: 0, nit: 0, pho: 0, pfas: 0, trash: 0,
        isBMP: false,
        desc: description.trim(),
        pillars,
        sizeRange: ['XS' as const, 'XL' as const],
        experimental: true,
      });
    } else if (type === 'partner') {
      onAdd({
        id,
        name: name.trim(),
        icon: '\ud83e\udd1d',
        type: autoCategory || category || 'Custom Partner',
        value: Number(value) || 10000,
        grant: false,
        desc: description.trim(),
        pillars,
        strengths: autoStrengths.length > 0 ? autoStrengths : undefined,
      });
    } else {
      onAdd({
        id,
        name: name.trim(),
        icon: '\ud83c\udf1f',
        cat: autoCategory || category || 'Custom',
        freq: frequency,
        cost: Number(cost) || 1000,
        volunteers: Number(volunteers) || 0,
        desc: description.trim(),
        pillars,
      });
    }
    onClose();
  };

  const typeLabel = type === 'module' ? 'Treatment Module' : type === 'partner' ? 'Partner' : 'Community Event';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-800">Add Custom {typeLabel}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Name */}
          <div>
            <label className="text-[10px] font-medium text-slate-500 block mb-1">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"
              placeholder={`${typeLabel} name...`}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] font-medium text-slate-500 block mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500 h-16 resize-none"
              placeholder="Brief description..."
            />
          </div>

          {/* Type-specific fields */}
          {type === 'module' && (
            <>
              <div>
                <label className="text-[10px] font-medium text-slate-500 block mb-1">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">Select category...</option>
                  {MODULE_CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-slate-500 block mb-1">Cost Per Unit ($)</label>
                <input
                  type="number"
                  value={costPer}
                  onChange={e => setCostPer(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  placeholder="10000"
                />
              </div>
            </>
          )}

          {type === 'partner' && (
            <div>
              <label className="text-[10px] font-medium text-slate-500 block mb-1">In-Kind Value ($)</label>
              <input
                type="number"
                value={value}
                onChange={e => setValue(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"
                placeholder="10000"
              />
            </div>
          )}

          {type === 'event' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-slate-500 block mb-1">Cost/yr ($)</label>
                  <input
                    type="number"
                    value={cost}
                    onChange={e => setCost(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    placeholder="1000"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-slate-500 block mb-1">Volunteers</label>
                  <input
                    type="number"
                    value={volunteers}
                    onChange={e => setVolunteers(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-slate-500 block mb-1">Frequency</label>
                <select
                  value={frequency}
                  onChange={e => setFrequency(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  {['Monthly', 'Quarterly', 'Semi-annual', 'Bi-annual', 'Annual'].map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Auto-categorize result */}
          {(autoCategory || autoPillars.length > 0 || autoStrengths.length > 0) && (
            <div className="bg-purple-50 rounded-md px-3 py-2 text-[9px] text-purple-700 space-y-0.5">
              {autoCategory && <p><strong>Category:</strong> {autoCategory}</p>}
              {autoPillars.length > 0 && <p><strong>Pillars:</strong> {autoPillars.join(', ')}</p>}
              {autoStrengths.length > 0 && <p><strong>Strengths:</strong> {autoStrengths.join(', ')}</p>}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={handleAutoCategorize}
            disabled={categorizing || (!name && !description)}
            className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-40 rounded-md transition-colors"
          >
            {categorizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Auto-Categorize
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[10px] font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="px-4 py-1.5 text-[10px] font-semibold text-white bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-300 rounded-md transition-colors"
          >
            Add {typeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
