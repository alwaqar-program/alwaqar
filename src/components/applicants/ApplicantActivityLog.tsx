import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Pencil, Plus, Trash2, RotateCcw, ArrowRight } from 'lucide-react';
import {
  ActivityLogEntry, ACTION_AR, FIELD_AR, STATUS_AR,
  ApplicantStatus,
} from '@/lib/applicant-labels';

interface Props {
  applicantId: string;
  refreshKey?: number;
}

const ACTION_ICONS = {
  created: Plus,
  updated: Pencil,
  status_changed: ArrowRight,
  deleted: Trash2,
  restored: RotateCcw,
};

const ACTION_COLOR = {
  created: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  updated: 'bg-sky-50 text-sky-700 border-sky-200',
  status_changed: 'bg-violet-50 text-violet-700 border-violet-200',
  deleted: 'bg-rose-50 text-rose-700 border-rose-200',
  restored: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function ApplicantActivityLog({ applicantId, refreshKey }: Props) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('applicant_activity_log')
        .select('*')
        .eq('applicant_id', applicantId)
        .order('created_at', { ascending: false });
      if (!error) setEntries((data ?? []) as ActivityLogEntry[]);
      setLoading(false);
    })();
  }, [applicantId, refreshKey]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock size={18} />
          سجل الإجراءات
          {!loading && (
            <Badge variant="outline" className="ms-auto tabular-nums">
              {entries.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد إجراءات مُسجَّلة بعد.</p>
        ) : (
          <ol className="space-y-3">
            {entries.map((entry) => {
              const Icon = ACTION_ICONS[entry.action];
              const colorCls = ACTION_COLOR[entry.action];
              return (
                <li key={entry.id} className={`border rounded-lg p-3 ${colorCls}`}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{ACTION_AR[entry.action]}</span>
                        <span className="text-xs opacity-70 tabular-nums">
                          {new Date(entry.created_at).toLocaleString('ar-SA', {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                        {entry.actor_email && (
                          <span className="text-xs opacity-70 flex items-center gap-1">
                            <User size={11} />
                            {entry.actor_email}
                          </span>
                        )}
                      </div>

                      {entry.changes && Object.keys(entry.changes).length > 0 && (
                        <div className="bg-white/60 rounded p-2 text-xs space-y-1">
                          {Object.entries(entry.changes).map(([field, diff]) => (
                            <div key={field} className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{FIELD_AR[field] || field}:</span>
                              <span className="line-through opacity-60">
                                {formatVal(field, diff.old)}
                              </span>
                              <ArrowRight size={11} className="opacity-60" />
                              <span>{formatVal(field, diff.new)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {entry.notes && (
                        <p className="text-xs italic opacity-80">
                          ملاحظة: {entry.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function formatVal(field: string, val: unknown): string {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'نعم' : 'لا';
  if (field === 'status' && typeof val === 'string') return STATUS_AR[val as ApplicantStatus] ?? val;
  return String(val);
}
