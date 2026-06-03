import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserPlus, Users, CheckCircle, XCircle } from 'lucide-react';

interface Stats {
  total: number;
  registered: number;
  incomplete: number;
  accepted: number;
  rejected: number;
  byAge: Record<string, number>;
  byBranch: Record<string, number>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const { data, error } = await supabase.from('applicants').select('status, age_category, desired_branch');
      if (error) {
        console.error(error);
        return;
      }
      const s: Stats = {
        total: data.length,
        registered: data.filter((r) => r.status === 'registered').length,
        incomplete: data.filter((r) => r.status === 'incomplete').length,
        accepted: data.filter((r) => r.status === 'accepted').length,
        rejected: data.filter((r) => r.status === 'rejected').length,
        byAge: {},
        byBranch: {},
      };
      data.forEach((r) => {
        const a = r.age_category || 'غير محدد';
        s.byAge[a] = (s.byAge[a] || 0) + 1;
        const b = r.desired_branch || 'غير محدد';
        s.byBranch[b] = (s.byBranch[b] || 0) + 1;
      });
      setStats(s);
      setLoading(false);
    }
    loadStats();
  }, []);

  if (loading) return <div className="p-8 text-slate-500">جاري التحميل…</div>;
  if (!stats) return <div className="p-8 text-rose-600">تعذّر تحميل البيانات</div>;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-3xl font-display font-bold text-slate-900">لوحة التحكم</h2>
        <p className="text-slate-600 mt-1">نظرة عامة على بيانات الدورة الرابعة عشرة 1447هـ</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI title="إجمالي المتقدمات" value={stats.total} icon={UserPlus} color="text-brand-600" />
        <KPI title="مسجّلات" value={stats.registered} icon={Users} color="text-sky-600" />
        <KPI title="مقبولات" value={stats.accepted} icon={CheckCircle} color="text-emerald-600" />
        <KPI title="مرفوضات / ناقصة" value={stats.rejected + stats.incomplete} icon={XCircle} color="text-rose-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="التوزيع حسب الفئة العمرية">
          {Object.entries(stats.byAge).map(([k, v]) => (
            <Bar key={k} label={ageLabel(k)} value={v} total={stats.total} />
          ))}
        </Card>
        <Card title="التوزيع حسب الفرع المراد">
          {Object.entries(stats.byBranch).map(([k, v]) => (
            <Bar key={k} label={branchLabel(k)} value={v} total={stats.total} />
          ))}
        </Card>
      </div>
    </div>
  );
}

function KPI({ title, value, icon: Icon, color }: { title: string; value: number; icon: typeof UserPlus; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-600 text-sm">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1 tabular-nums">{value}</p>
        </div>
        <Icon size={32} className={color} />
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Bar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-700">{label}</span>
        <span className="text-slate-500 tabular-nums">{value} ({pct}%)</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ageLabel(k: string): string {
  const map: Record<string, string> = { under_16: 'أقل من 16', '16_to_35': '16 - 35', over_35: 'أعلى من 35' };
  return map[k] || k;
}
function branchLabel(k: string): string {
  const map: Record<string, string> = { '5_juz': '5 أجزاء', '10_juz': '10 أجزاء', '20_juz': '20 جزء', '30_juz': '30 جزء' };
  return map[k] || k;
}
