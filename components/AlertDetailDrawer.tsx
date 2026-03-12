'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  XCircle,
  Info,
  CloudRain,
  CheckCircle,
  Shield,
  Send,
  Clock,
} from 'lucide-react';
import { PATTERN_LABELS } from '@/lib/alerts/triggers/sentinelTrigger';
import type { AlertEvent, AlertSeverity } from '@/lib/alerts/types';

const SEV_STYLE: Record<AlertSeverity, { bg: string; text: string; icon: typeof XCircle }> = {
  anomaly: { bg: 'bg-purple-100', text: 'text-purple-700', icon: AlertTriangle },
  critical: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
  warning: { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle },
  info: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Info },
};

interface Props {
  alert: AlertEvent | null;
  open: boolean;
  onClose: () => void;
}

export function AlertDetailDrawer({ alert, open, onClose }: Props) {
  if (!alert) return null;

  const meta = (alert.metadata || {}) as Record<string, unknown>;
  const patterns = Array.isArray(meta.activePatterns) ? (meta.activePatterns as string[]) : [];
  const rationale = Array.isArray(meta.rationale) ? (meta.rationale as string[]) : [];
  const cbrnIndicators = Array.isArray(meta.cbrnIndicators)
    ? (meta.cbrnIndicators as { category: string; confidence: number }[])
    : [];
  const sev = SEV_STYLE[alert.severity] || SEV_STYLE.info;
  const SevIcon = sev.icon;
  const downgradeReason = typeof meta.classificationDowngradeReason === 'string'
    ? meta.classificationDowngradeReason
    : null;
  const weatherDriven = typeof meta.weatherContext === 'string' && meta.weatherContext;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-3 border-b border-slate-200">
          {/* Header — Title + badges */}
          <SheetTitle className="text-base leading-snug">{alert.title}</SheetTitle>
          <SheetDescription asChild>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <Badge className={`text-2xs ${sev.bg} ${sev.text}`}>
                <SevIcon className="h-3 w-3 mr-0.5" />
                {alert.severity}
              </Badge>
              <Badge variant="secondary" className="text-2xs">{alert.type}</Badge>
              {typeof meta.stage === 'string' && (
                <Badge variant="secondary" className="text-2xs bg-violet-100 text-violet-700">
                  {meta.stage}
                </Badge>
              )}
              <span className="text-2xs text-slate-400 ml-auto">
                <Clock className="inline h-3 w-3 mr-0.5" />
                {new Date(alert.createdAt).toLocaleString()}
              </span>
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Watershed Context */}
          <section>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Watershed Context
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-800">{alert.entityLabel}</span>
              {typeof meta.level === 'string' && (
                <Badge
                  variant="secondary"
                  className={`text-2xs ${
                    meta.level === 'CRITICAL'
                      ? 'bg-red-100 text-red-700'
                      : meta.level === 'WATCH'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {meta.level}
                </Badge>
              )}
            </div>
          </section>

          {/* Downgrade Notice */}
          {downgradeReason && (
            <section className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-amber-800">Severity Downgraded</span>
                  <p className="text-xs text-amber-700 mt-0.5">{downgradeReason}</p>
                </div>
              </div>
            </section>
          )}

          {/* Trigger Evidence */}
          <section>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Trigger Evidence
            </h4>
            {patterns.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {patterns.map((p) => (
                  <Badge key={p} variant="secondary" className="text-2xs bg-indigo-100 text-indigo-700">
                    {PATTERN_LABELS[p] || p}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-slate-400 mb-2">
                Score-only signal — monitoring for pattern emergence.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {meta.score != null && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-center">
                  <div className="text-2xs text-slate-500">Score</div>
                  <div className="text-sm font-bold text-slate-800">{String(meta.score)}</div>
                </div>
              )}
              {meta.confidence != null && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-center">
                  <div className="text-2xs text-slate-500">Confidence</div>
                  <div className="text-sm font-bold text-slate-800">
                    {(Number(meta.confidence) * 100).toFixed(0)}%
                  </div>
                </div>
              )}
              {meta.eventCount != null && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-center">
                  <div className="text-2xs text-slate-500">Events</div>
                  <div className="text-sm font-bold text-slate-800">{String(meta.eventCount)}</div>
                </div>
              )}
            </div>
          </section>

          {/* Weather Context */}
          {weatherDriven && (
            <section className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <CloudRain className="h-4 w-4 text-sky-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-sky-800">Weather-Driven Event</span>
              </div>
              <p className="text-xs text-sky-700 mt-0.5">
                Active NWS warning: {meta.weatherContext as string}
              </p>
            </section>
          )}

          {!weatherDriven && meta.stage === 'external_alert' && (
            <section className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span className="text-xs text-emerald-700">
                  No active severe weather warnings for this region.
                </span>
              </div>
            </section>
          )}

          {/* Rationale */}
          {rationale.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Rationale
              </h4>
              <ul className="space-y-1">
                {rationale.map((r, i) => (
                  <li key={i} className="flex gap-1.5 text-xs text-slate-600">
                    <span className="text-slate-400 flex-shrink-0">-</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* CBRN Indicators */}
          {cbrnIndicators.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                CBRN Indicators
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {cbrnIndicators.map((ind, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="text-2xs bg-rose-100 text-rose-700"
                  >
                    <Shield className="h-3 w-3 mr-0.5" />
                    {ind.category.toUpperCase()} — {(ind.confidence * 100).toFixed(0)}%
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {/* Dispatch Status */}
          <section>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Dispatch Status
            </h4>
            <div className="flex items-center gap-2 text-xs">
              {alert.sent ? (
                <>
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-2xs">
                    <Send className="h-3 w-3 mr-0.5" /> Sent
                  </Badge>
                  {alert.sentAt && (
                    <span className="text-slate-400">
                      {new Date(alert.sentAt).toLocaleString()}
                    </span>
                  )}
                  {alert.recipientEmail && (
                    <span className="text-slate-500">{alert.recipientEmail}</span>
                  )}
                </>
              ) : alert.error === 'log_only' ? (
                <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 text-2xs">
                  Logged Only
                </Badge>
              ) : alert.error ? (
                <Badge variant="secondary" className="bg-red-100 text-red-700 text-2xs">
                  Error: {alert.error}
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-2xs">
                  Pending
                </Badge>
              )}
            </div>
          </section>

          {/* Action Stubs */}
          <section className="flex items-center gap-2 pt-2 border-t border-slate-200">
            <Button variant="outline" size="sm" disabled className="text-xs">
              Mark Reviewed
            </Button>
            <Button variant="outline" size="sm" disabled className="text-xs">
              Suppress 24h
            </Button>
          </section>

          {/* Original Body */}
          <section className="pt-2 border-t border-slate-200">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Original Alert
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">{alert.body}</p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
