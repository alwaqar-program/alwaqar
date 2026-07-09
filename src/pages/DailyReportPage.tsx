import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Download } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import { dailyNisab, nisabDayFactor } from '@/lib/program-target';
import { isSponsor, CIRCLE_TYPE_FILTERS } from '@/lib/circle-type';
import { type HaramFilter } from '@/lib/harvest';
import { Cohort, COHORTS, cohortSubjectColumn } from '@/lib/cohorts';
import {
  weightedPercent, evalTier, EvalTier, HIFZ_BUCKETS, hifzBucketIndex,
} from '@/lib/report-metrics';

// ثوابت التحويل (مطابقة للوحة المعلومات).
const PAGES_PER_JUZ = 20;
const PAGES_PER_KHATMA = 604;

// ألوان الهوية عبر متغيّرات CSS ليعمل مبدّل التصاميم (٥ تصاميم) والطباعة معاً.
const INK = 'var(--rep-ink)';
const GOLD = 'var(--rep-gold)';
const GOLD_SOFT = 'var(--rep-gold-soft)';
const PAPER = 'var(--rep-paper)';
const GREEN = 'var(--rep-green)';
const RED = 'var(--rep-red)';

// التصاميم الخمسة (لوحات ألوان). التصميم الأول = «مُذهَّب» الحالي.
const DESIGNS = [
  { id: 'gilded', name: 'مُذهَّب', ink: 'hsl(158 35% 25%)', gold: 'hsl(43 60% 50%)' },
  { id: 'royal', name: 'ملكي', ink: 'hsl(222 47% 22%)', gold: 'hsl(40 58% 50%)' },
  { id: 'sepia', name: 'سِدر', ink: 'hsl(28 38% 26%)', gold: 'hsl(30 62% 46%)' },
  { id: 'emerald', name: 'زُمُرّد', ink: 'hsl(180 42% 20%)', gold: 'hsl(40 55% 50%)' },
  { id: 'slate', name: 'رُخام', ink: 'hsl(215 28% 26%)', gold: 'hsl(210 40% 46%)' },
];

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ar = (n: number, digits = 0) =>
  n.toLocaleString('ar-EG', { maximumFractionDigits: digits }); // بلا أصفار عشرية زائدة (٢٧ لا ٢٧٫٠)
const hijri = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    }).format(new Date(iso + 'T00:00:00')) + ' هـ';
  } catch { return iso; }
};
const greg = (iso: string) => {
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    }).format(new Date(iso + 'T00:00:00'));
  } catch { return iso; }
};

// ---------- الميدالية المُذهَّبة (العنصر المميّز — خاتم ذهبي على غرار روندل ۝) ----------
function Medallion({ pct }: { pct: number }) {
  const arcR = 66, arcC = 2 * Math.PI * arcR;
  const shown = Math.max(0, Math.min(100, pct));
  return (
    <svg viewBox="0 0 200 200" className="w-48 h-48">
      {/* خاتم ذهبي مصمَت (قرص ذهب ثم قلب رَقّي) */}
      <circle cx="100" cy="100" r="94" fill={GOLD} />
      <circle cx="100" cy="100" r="84" fill={PAPER} />
      {/* مسنّنات التذهيب على الحافة الذهبية */}
      {Array.from({ length: 60 }).map((_, i) => {
        const a = (i / 60) * 2 * Math.PI, x1 = 100 + 93 * Math.cos(a), y1 = 100 + 93 * Math.sin(a),
          x2 = 100 + 86 * Math.cos(a), y2 = 100 + 86 * Math.sin(a);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--rep-gold)" strokeWidth="0.8" opacity="0.55" />;
      })}
      {/* مسار الإنجاز بالحبر */}
      <circle cx="100" cy="100" r={arcR} fill="none" stroke="var(--rep-track)" strokeWidth="11" />
      <circle cx="100" cy="100" r={arcR} fill="none" stroke={INK} strokeWidth="11" strokeLinecap="round"
        transform="rotate(-90 100 100)" strokeDasharray={`${(shown / 100) * arcC} ${arcC}`} />
      {/* القيمة */}
      <text x="100" y="96" textAnchor="middle" style={{ fontFamily: 'Amiri, serif', fontSize: 42, fontWeight: 700, fill: INK }}>{ar(Math.round(pct))}٪</text>
      <text x="100" y="120" textAnchor="middle" style={{ fontFamily: 'Cairo, sans-serif', fontSize: 12, fill: 'var(--rep-ink-soft)' }}>نسبة الإنجاز</text>
    </svg>
  );
}

// ---------- حالة عدم وجود بيانات ----------
function EmptyState() {
  return (
    <div className="rounded-xl py-10 px-6 text-center" style={{ border: `1px dashed ${GOLD}`, background: 'var(--rep-panel)' }}>
      <div style={{ color: GOLD, fontFamily: 'Amiri, serif', fontSize: 30 }}>۝</div>
      <h4 className="font-display text-2xl mt-1" style={{ color: INK }}>لم يُسجَّل تسميع لهذا اليوم بعد</h4>
      <p className="text-sm mt-1" style={{ color: 'var(--rep-ink-soft)' }}>
        عند تسجيل التسميع والحضور ستظهر الحصيلة التفصيلية والمؤشرات تلقائياً. جرّبي اختيار يوم آخر.
      </p>
    </div>
  );
}

// حلقة مؤشر صغيرة أنيقة
function Ring({ pct, label, color }: { pct: number; label: string; color: string }) {
  const r = 40, c = 2 * Math.PI * r, shown = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 100 100" className="w-24 h-24">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--rep-track)" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          transform="rotate(-90 50 50)" strokeDasharray={`${(shown / 100) * c} ${c}`} />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="central"
          style={{ fontFamily: 'Amiri, serif', fontSize: 19, fontWeight: 700, fill: INK }}>{ar(Math.round(pct))}٪</text>
      </svg>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

function HBar({ label, value, max, right }: { label: string; value: number; max: number; right: string }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-32 shrink-0">{label}</span>
      <div className="flex-1 h-7 rounded-sm overflow-hidden" style={{ background: 'var(--rep-track)' }}>
        <div className="h-full flex items-center justify-end pl-2 text-[11px] font-semibold"
          style={{ width: `${w}%`, background: INK, color: PAPER }}>{value > 0 ? ar(value) : ''}</div>
      </div>
      <span className="w-14 shrink-0 text-left font-bold" style={{ color: INK }}>{right}</span>
    </div>
  );
}

// ---------- types ----------
interface Circle { id: string; circle_name: string; branch_id: string; circle_type: string; }
interface Branch { id: string; branch_name: string; juz_count: number; }
// registered: طالبة مقبولة فعلاً (admission_status='registered'). النصاب المطلوب
// يُحتسب لها فقط — مطابقةً للوحة المعلومات (المرافقات/المبتدئات وغير المقبولات لا نصاب لهنّ).
interface Member { key: string; id: string; cohort: Cohort; full_name: string; circle_id: string | null; room_id: string | null; registered: boolean; }
interface RecRow { circle_id: string | null; pages: number; thabit: boolean; subj: Record<string, string | null>; }
interface AttRow { status: string; subj: Record<string, string | null>; }

const TIER_STYLE: Record<EvalTier, { bg: string; fg: string }> = {
  'ممتاز': { bg: 'hsl(145 50% 92%)', fg: 'hsl(145 63% 28%)' },
  'جيد': { bg: 'hsl(43 60% 90%)', fg: 'hsl(38 70% 32%)' },
  'ضعيف': { bg: 'hsl(0 65% 94%)', fg: 'hsl(0 65% 42%)' },
};

export default function DailyReportPage() {
  const today = toISO(new Date());
  const [date, setDate] = useState(today);
  const [design, setDesign] = useState<string>(() => {
    try { return localStorage.getItem('report-design') || 'gilded'; } catch { return 'gilded'; }
  });
  useEffect(() => { try { localStorage.setItem('report-design', design); } catch { /* ignore */ } }, [design]);
  const [loading, setLoading] = useState(true);
  const [haramFilter, setHaramFilter] = useState<HaramFilter>('');
  const [circles, setCircles] = useState<Circle[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [rooms, setRooms] = useState<Record<string, string>>({});
  const [recRows, setRecRows] = useState<RecRow[]>([]);
  const [attRows, setAttRows] = useState<AttRow[]>([]);
  const [teacherCount, setTeacherCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const memberSel = 'id, full_name, circle_id, room_id, is_active';
      const [cRes, bRes, tRes, rmRes, stRes, coRes, beRes, recRes, attRes] = await Promise.all([
        supabase.from('circles').select('id, circle_name, branch_id, circle_type').eq('is_active', true),
        supabase.from('branches').select('id, branch_name, juz_count'),
        supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('rooms').select('id, room_number'),
        // admission_status للطالبات فقط: النصاب يُحتسب للمقبولات (registered) — مطابقةً للوحة.
        supabase.from('students').select(`${memberSel}, admission_status`),
        supabase.from('companions').select(memberSel),
        supabase.from('beginners').select(memberSel),
        supabase.from('recitation_log')
          .select('circle_id, pages_recited, thabit_confirmed, student_id, companion_id, beginner_id')
          .eq('date', date).eq('is_deleted', false),
        supabase.from('attendance')
          .select('status, student_id, companion_id, beginner_id').eq('date', date).eq('is_deleted', false),
      ]);
      setCircles(cRes.data || []);
      setBranches(bRes.data || []);
      setTeacherCount(tRes.count || 0);
      setRooms(Object.fromEntries((rmRes.data || []).map((r: any) => [r.id, r.room_number])));
      const toMembers = (rows: any[] | null, cohort: Cohort): Member[] =>
        (rows || []).filter(r => r.is_active !== false && r.circle_id)
          .map(r => ({
            key: `${cohort}:${r.id}`, id: r.id, cohort, full_name: r.full_name,
            circle_id: r.circle_id, room_id: r.room_id ?? null,
            // النصاب للطالبات المقبولات فقط؛ المرافقات/المبتدئات بلا نصاب مطلوب.
            registered: cohort === 'student' && r.admission_status === 'registered',
          }));
      setMembers([
        ...toMembers(stRes.data, 'student'),
        ...toMembers(coRes.data, 'companion'),
        ...toMembers(beRes.data, 'beginner'),
      ]);
      setRecRows((recRes.data || []).map((r: any) => ({
        circle_id: r.circle_id, pages: Number(r.pages_recited) || 0, thabit: !!r.thabit_confirmed,
        subj: { student_id: r.student_id, companion_id: r.companion_id, beginner_id: r.beginner_id },
      })));
      setAttRows((attRes.data || []).map((a: any) => ({
        status: a.status, subj: { student_id: a.student_id, companion_id: a.companion_id, beginner_id: a.beginner_id },
      })));
      setLoading(false);
    };
    load();
  }, [date]);

  // ---------- core per-member computation ----------
  const report = useMemo(() => {
    const branchById = new Map(branches.map(b => [b.id, b]));
    const circleById = new Map(circles.map(c => [c.id, c]));
    const recBy = new Map<string, { pages: number; thabit: boolean }>();
    for (const r of recRows) {
      for (const c of COHORTS) {
        const id = r.subj[cohortSubjectColumn(c)];
        if (id) { const k = `${c}:${id}`; const cur = recBy.get(k) || { pages: 0, thabit: false }; cur.pages += r.pages; cur.thabit = cur.thabit || r.thabit; recBy.set(k, cur); }
      }
    }
    const attBy = new Map<string, Set<string>>();
    for (const a of attRows) {
      for (const c of COHORTS) {
        const id = a.subj[cohortSubjectColumn(c)];
        if (id) { const k = `${c}:${id}`; const s = attBy.get(k) || new Set(); s.add(a.status); attBy.set(k, s); }
      }
    }
    const PRESENTISH = new Set(['present', 'late', 'excused', 'exempted']);

    // فلتر النطاق: الكل / تابعة للحرم (العادية) / حلقاتنا (الحرم) — يفلتر التقرير كله.
    const visibleMembers = haramFilter === ''
      ? members
      : members.filter(m => {
          const sp = isSponsor(circleById.get(m.circle_id || '')?.circle_type);
          return haramFilter === 'sponsor' ? sp : !sp;
        });

    const rows = visibleMembers.map(m => {
      const circle = m.circle_id ? circleById.get(m.circle_id) : undefined;
      const branch = circle ? branchById.get(circle.branch_id) : undefined;
      const sponsor = isSponsor(circle?.circle_type);
      const juz = branch?.juz_count ?? 0;
      const rec = recBy.get(m.key) || { pages: 0, thabit: false };
      const statuses = attBy.get(m.key);
      const hasAtt = !!statuses && statuses.size > 0;
      const present = hasAtt && [...statuses].some(s => PRESENTISH.has(s));
      const absent = hasAtt && !present;
      const attPct = present ? 100 : 0;
      // مطابقة اللوحة: النصاب المطلوب للطالبات المقبولات فقط (المرافقات/المبتدئات وغير
      // المقبولات لا نصاب لهنّ، لكن صفحاتهنّ تبقى ضمن «المنجزة»). أيام الفترة الصباحية = 50٪.
      const nisabEligible = m.registered && juz > 0;
      const target = sponsor ? rec.pages : (nisabEligible ? (dailyNisab(juz) ?? 0) * nisabDayFactor(date) : 0);
      const hasTarget = sponsor ? rec.pages > 0 : (nisabEligible && (dailyNisab(juz) ?? 0) > 0);
      const hifzPct = sponsor ? 100 : (target > 0 ? (rec.pages / target) * 100 : 0);
      const weighted = weightedPercent({
        juzCount: sponsor ? 30 : juz, attendancePct: attPct, hifzPct, thabitPct: rec.thabit ? 100 : 0,
      });
      const tier = evalTier(weighted);
      const done = sponsor ? true : (hasTarget ? rec.pages >= target : null);
      const deficit = (!sponsor && hasTarget) ? rec.pages - target : 0;
      return {
        ...m, circleName: circle?.circle_name ?? '—', branchName: branch?.branch_name ?? '—', juz, sponsor,
        room: m.room_id ? (rooms[m.room_id] ?? '') : '', pages: rec.pages, thabit: rec.thabit,
        present, absent, hasAtt, attPct, target, hasTarget, hifzPct, weighted, tier, done, deficit,
      };
    });

    const completed = rows.reduce((s, r) => s + r.pages, 0);
    const required = rows.reduce((s, r) => s + (r.sponsor ? r.pages : (r.hasTarget ? r.target : 0)), 0);
    const withTarget = rows.filter(r => r.hasTarget || r.sponsor);
    const doneCount = rows.filter(r => r.done === true).length;
    const presentCount = rows.filter(r => r.present).length;
    const pct = required > 0 ? (completed / required) * 100 : 0;

    const byBranch = branches.map(b => {
      const rs = rows.filter(r => circleById.get(r.circle_id || '')?.branch_id === b.id);
      const comp = rs.reduce((s, r) => s + r.pages, 0);
      const req = rs.reduce((s, r) => s + (r.sponsor ? r.pages : (r.hasTarget ? r.target : 0)), 0);
      const done = rs.filter(r => r.done === true).length;
      const nCircles = new Set(rs.map(r => r.circle_id)).size;
      return { id: b.id, name: b.branch_name, juz: b.juz_count, count: rs.length, nCircles, completed: comp, required: req, done, pct: req > 0 ? (comp / req) * 100 : 0 };
    }).filter(x => x.count > 0).sort((a, b) => b.juz - a.juz);

    const byCircle = circles.map(c => {
      const rs = rows.filter(r => r.circle_id === c.id);
      const comp = rs.reduce((s, r) => s + r.pages, 0);
      const req = rs.reduce((s, r) => s + (r.sponsor ? r.pages : (r.hasTarget ? r.target : 0)), 0);
      return { id: c.id, name: c.circle_name, branch: branchById.get(c.branch_id)?.branch_name ?? '—', juz: branchById.get(c.branch_id)?.juz_count ?? 0, count: rs.length, completed: comp, pct: req > 0 ? (comp / req) * 100 : 0 };
    }).filter(x => x.count > 0).sort((a, b) => b.pct - a.pct);

    const hifzHist = HIFZ_BUCKETS.map(() => 0);
    withTarget.forEach(r => { hifzHist[hifzBucketIndex(r.hifzPct)]++; });

    const tierCount: Record<EvalTier, number> = { 'ممتاز': 0, 'جيد': 0, 'ضعيف': 0 };
    rows.forEach(r => { tierCount[r.tier]++; });

    const struggling = rows.filter(r => !r.sponsor && r.hasTarget && r.pages < r.target)
      .sort((a, b) => a.deficit - b.deficit)
      .map(r => ({
        ...r,
        reason: r.pages === 0 ? (r.absent ? 'غائبة — لم تُسمِّع' : 'لم تُسمِّع اليوم') : 'تقصير في الحفظ',
        plan: `تسميع المطلوب اليومي + تعويض العجز (${ar(Math.abs(r.deficit), 1)} وجهًا)`,
      }));

    const nCircles = new Set(rows.map(r => r.circle_id)).size;
    const nRooms = new Set(rows.map(r => r.room_id).filter(Boolean)).size;

    return {
      rows: rows.sort((a, b) => b.weighted - a.weighted),
      completed, required, pct, juz: completed / PAGES_PER_JUZ, khatma: completed / PAGES_PER_KHATMA,
      totalMembers: rows.length, withTarget: withTarget.length, doneCount, presentCount,
      donePct: withTarget.length ? (doneCount / withTarget.length) * 100 : 0,
      attPct: rows.length ? (presentCount / rows.length) * 100 : 0,
      byBranch, byCircle, hifzHist, tierCount, struggling, nCircles, nRooms,
    };
  }, [members, circles, branches, recRows, attRows, rooms, haramFilter]);

  const maxHist = Math.max(1, ...report.hifzHist);
  // لا تسميع مُسجَّل لهذا اليوم → نعرض حالة فارغة بدل إغراق الصفحة بالأصفار والمتعثرات.
  const noData = recRows.length === 0;
  const STRUGGLE_CAP = 20; // حدّ عرض المتعثرات في التقرير المطبوع

  return (
    <div className="space-y-6">
      <style>{`
        /* التصميم الأول «مُذهَّب» = الافتراضي */
        #daily-report {
          --rep-ink: hsl(158 35% 25%); --rep-gold: hsl(43 60% 50%); --rep-gold-soft: hsl(43 55% 88%);
          --rep-paper: hsl(43 45% 97%); --rep-green: hsl(145 63% 42%); --rep-red: hsl(0 72% 51%);
          --rep-ink-soft: hsl(158 18% 40%); --rep-panel: hsl(158 30% 97%); --rep-track: hsl(43 30% 90%);
          color: var(--rep-ink);
        }
        #daily-report[data-design="royal"] {
          --rep-ink: hsl(222 47% 22%); --rep-gold: hsl(40 58% 50%); --rep-gold-soft: hsl(40 45% 86%);
          --rep-paper: hsl(40 40% 98%); --rep-green: hsl(158 45% 38%); --rep-red: hsl(0 65% 50%);
          --rep-ink-soft: hsl(222 20% 42%); --rep-panel: hsl(222 35% 97%); --rep-track: hsl(40 30% 89%);
        }
        #daily-report[data-design="sepia"] {
          --rep-ink: hsl(28 38% 26%); --rep-gold: hsl(30 62% 46%); --rep-gold-soft: hsl(32 45% 85%);
          --rep-paper: hsl(38 44% 96%); --rep-green: hsl(120 35% 36%); --rep-red: hsl(8 62% 48%);
          --rep-ink-soft: hsl(28 22% 42%); --rep-panel: hsl(34 40% 95%); --rep-track: hsl(32 35% 88%);
        }
        #daily-report[data-design="emerald"] {
          --rep-ink: hsl(180 42% 20%); --rep-gold: hsl(40 55% 50%); --rep-gold-soft: hsl(168 32% 85%);
          --rep-paper: hsl(168 38% 98%); --rep-green: hsl(152 55% 38%); --rep-red: hsl(358 62% 50%);
          --rep-ink-soft: hsl(180 18% 38%); --rep-panel: hsl(168 34% 96%); --rep-track: hsl(168 28% 88%);
        }
        #daily-report[data-design="slate"] {
          --rep-ink: hsl(215 28% 26%); --rep-gold: hsl(210 40% 46%); --rep-gold-soft: hsl(214 25% 87%);
          --rep-paper: hsl(210 22% 98%); --rep-green: hsl(160 42% 40%); --rep-red: hsl(0 60% 52%);
          --rep-ink-soft: hsl(215 14% 44%); --rep-panel: hsl(214 30% 97%); --rep-track: hsl(214 22% 90%);
        }
        #daily-report .fig-num { font-variant-numeric: tabular-nums; }
        @media print {
          #daily-report, #daily-report * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* أدوات التحكم — تختفي عند الطباعة */}
      <div className="flex items-end justify-between flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-display text-foreground">التقرير اليومي التفصيلي</h1>
          <p className="text-sm text-muted-foreground mt-1">حصيلة اليوم لكل الفروع والحلقات — قابل للطباعة/‏PDF</p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          {circles.some(c => isSponsor(c.circle_type)) && (
            <div className="space-y-1.5">
              <Label className="text-xs">النطاق</Label>
              <div className="flex items-center gap-1.5">
                {CIRCLE_TYPE_FILTERS.map(([val, label]) => (
                  <Button
                    key={val}
                    type="button"
                    size="sm"
                    variant={haramFilter === val ? 'default' : 'outline'}
                    className="h-10 px-3 text-xs"
                    onClick={() => setHaramFilter(val as HaramFilter)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">التصميم</Label>
            <div className="flex items-center gap-1.5">
              {DESIGNS.map(d => (
                <button key={d.id} type="button" onClick={() => setDesign(d.id)} title={d.name}
                  aria-label={d.name} aria-pressed={design === d.id}
                  className={`h-10 w-10 rounded-md border transition ${
                    design === d.id ? 'ring-2 ring-primary ring-offset-1' : 'opacity-70 hover:opacity-100'}`}
                  style={{ background: `linear-gradient(135deg, ${d.ink} 50%, ${d.gold} 50%)`, borderColor: d.gold }} />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">التاريخ</Label>
            <Input type="date" dir="ltr" className="h-10 w-[160px]" value={date} max={today}
              onChange={e => setDate(e.target.value || today)} />
          </div>
          <Button onClick={() => window.print()} disabled={loading}><Download size={18} /> تحميل PDF</Button>
        </div>
      </div>

      {loading ? (
        <Card className="animate-pulse"><CardContent className="h-96" /></Card>
      ) : (
        <div id="daily-report" data-design={design} className="mx-auto max-w-4xl rounded-lg shadow-sm border print:border-0 print:shadow-none"
          style={{ background: PAPER, borderColor: GOLD_SOFT }}>
          {/* المسطرة العلوية الذهبية */}
          <div style={{ height: 6, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_SOFT}, ${GOLD})` }} />

          <div className="px-8 py-8 space-y-10">
            {/* الترويسة */}
            <header className="text-center">
              <img src={logoImg} alt="" className="h-16 w-16 object-contain mx-auto mb-3" />
              <p className="text-xs tracking-widest" style={{ color: GOLD }}>جمعية تعلَّم للقرآن الكريم وعلومه</p>
              <h2 className="font-display text-4xl mt-2 leading-tight" style={{ color: INK }}>التقرير اليومي التفصيلي</h2>
              <p className="font-display text-xl mt-1" style={{ color: 'var(--rep-ink-soft)' }}>دورة الوقار</p>
              <div className="flex items-center justify-center gap-3 my-4">
                <span className="h-px w-16" style={{ background: GOLD }} />
                <span style={{ color: GOLD, fontFamily: 'Amiri, serif', fontSize: 20 }}>۝</span>
                <span className="h-px w-16" style={{ background: GOLD }} />
              </div>
              <p className="font-display text-lg" style={{ color: INK }}>{hijri(date)}</p>
              <p className="text-sm text-muted-foreground">{greg(date)}</p>
            </header>

            {/* الميدالية + المؤشرات */}
            {!noData && (
            <section className="rounded-lg p-6" style={{ background: 'var(--rep-panel)', border: `1px solid ${GOLD_SOFT}` }}>
              <div className="grid md:grid-cols-3 gap-6 items-center">
                <div className="flex justify-center"><Medallion pct={report.pct} /></div>
                <div className="md:col-span-2 grid grid-cols-3 gap-y-5 gap-x-2 text-center">
                  <Fig value={ar(report.completed, 1)} label="الأوجه المنجزة" hero />
                  <Fig value={ar(report.required, 1)} label="الأوجه المطلوبة" />
                  <Fig value={ar(report.juz, 1)} label="الأجزاء المنجزة" />
                  <Fig value={ar(report.khatma, 2)} label="تعادل من الختمات" />
                  <Fig value={`${ar(Math.round(report.donePct))}٪`} label="أتممن المطلوب" />
                  <Fig value={`${ar(Math.round(report.attPct))}٪`} label="متوسط الحضور" />
                </div>
              </div>
            </section>
            )}

            {/* أرقام الدورة */}
            <section>
              <SecHead title="منجزات اليوم" />
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-x-reverse text-center" style={{ borderColor: GOLD_SOFT }}>
                <Tally value={ar(report.totalMembers)} label="الطالبات" />
                <Tally value={ar(report.nCircles)} label="الحلقات" />
                <Tally value={ar(teacherCount)} label="المعلمات" />
                <Tally value={ar(report.nRooms)} label="الغرف" />
              </div>
              {!noData && (
                <p className="text-sm leading-relaxed mt-4" style={{ color: 'var(--rep-ink-soft)' }}>
                  بلغت نسبة الإنجاز في الحفظ <strong style={{ color: INK }}>{ar(Math.round(report.pct))}٪</strong>،
                  بإجمالي {ar(report.completed, 1)} وجهًا، أي ما يعادل {ar(report.khatma, 2)} ختمة و{ar(report.juz, 1)} جزءًا.
                </p>
              )}
            </section>

            {noData && <EmptyState />}

            {!noData && (<>
            {/* أداء الفروع */}
            <section>
              <SecHead title="مؤشر أداء الفروع" />
              <div className="space-y-2.5">
                {report.byBranch.map(b => (
                  <HBar key={b.id} label={b.name} value={b.done} max={b.count} right={`${ar(Math.round(b.pct))}٪`} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">الشريط: عدد من أتممن المطلوب مقابل إجمالي الطالبات في الفرع · النسبة على اليسار = نسبة الإنجاز.</p>
            </section>

            {/* المؤشرات التنفيذية */}
            <section>
              <SecHead title="المؤشرات التنفيذية" />
              <div className="flex items-start justify-center gap-12">
                <Ring pct={report.donePct} label="نسبة إتمام المطلوب" color={GREEN} />
                <Ring pct={report.attPct} label="متوسط الحضور" color={INK} />
                <Ring pct={Math.min(100, report.pct)} label="نسبة الإنجاز" color={GOLD} />
              </div>
            </section>

            {/* توزيع نسبة إنجاز الحفظ */}
            <section>
              <SecHead title="توزيع نسبة إنجاز الحفظ" />
              <div className="flex items-end justify-around gap-2 h-52 border-b pt-2" style={{ borderColor: GOLD_SOFT }}>
                {report.hifzHist.map((n, i) => (
                  <div key={i} className="flex flex-col items-center justify-end gap-1 flex-1 h-full">
                    <span className="text-sm font-bold" style={{ color: INK }}>{ar(n)}</span>
                    <div className="w-full max-w-[52px] rounded-t-sm"
                      style={{ height: `${(n / maxHist) * 100}%`, background: i === 0 ? RED : i <= 2 ? GOLD : INK, minHeight: n > 0 ? 6 : 0 }} />
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">{HIFZ_BUCKETS[i].label}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">عدد الطالبات في كل شريحة من شرائح نسبة إنجاز الحفظ.</p>
            </section>

            {/* المتعثرات */}
            <section>
              <SecHead title="الطالبات المتعثرات في التسميع" danger />
              {report.struggling.length === 0 ? (
                <p className="text-sm text-muted-foreground py-5 text-center rounded-lg" style={{ border: `1px dashed ${GOLD_SOFT}` }}>
                  لا توجد متعثرات — أتمّت الجميع المطلوب. ما شاء الله.
                </p>
              ) : (
                <RepTable head={['الطالبة', 'الحلقة', 'مقدار العجز', 'سبب العجز', 'خطة التعويض']}>
                  {report.struggling.slice(0, STRUGGLE_CAP).map(r => (
                    <tr key={r.key}>
                      <Td bold>{r.full_name}</Td>
                      <Td>{r.circleName}</Td>
                      <Td><span style={{ color: RED, fontWeight: 700 }}>{ar(r.deficit, 1)}</span></Td>
                      <Td>{r.reason}</Td>
                      <Td muted>{r.plan}</Td>
                    </tr>
                  ))}
                </RepTable>
              )}
              <p className="text-sm font-medium mt-3" style={{ color: INK }}>
                عدد المتعثرات في الحفظ: {ar(report.struggling.length)} من أصل {ar(report.totalMembers)} طالبة.
                {report.struggling.length > STRUGGLE_CAP && (
                  <span className="text-muted-foreground font-normal"> — يُعرض أعلى {ar(STRUGGLE_CAP)} عجزًا؛ التفاصيل الكاملة في جدول الحصيلة أدناه.</span>
                )}
              </p>
            </section>

            {/* أداء الحلقات */}
            <section>
              <SecHead title="مؤشر أداء الحلقات" />
              <RepTable head={['الحلقة', 'الفرع', 'الطالبات', 'الأوجه المنجزة', 'نسبة الإنجاز']}>
                {report.byCircle.map(c => (
                  <tr key={c.id}>
                    <Td bold>{c.name}</Td>
                    <Td>{c.branch}</Td>
                    <Td>{ar(c.count)}</Td>
                    <Td>{ar(c.completed, 1)}</Td>
                    <Td><span style={{ fontWeight: 700, color: INK }}>{ar(Math.round(c.pct))}٪</span></Td>
                  </tr>
                ))}
              </RepTable>
            </section>

            {/* التقييم */}
            <section>
              <SecHead title="مؤشرات التقييم" />
              <div className="grid grid-cols-3 gap-3">
                <TierStat tier="ممتاز" n={report.tierCount['ممتاز']} />
                <TierStat tier="جيد" n={report.tierCount['جيد']} />
                <TierStat tier="ضعيف" n={report.tierCount['ضعيف']} />
              </div>
              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                النسبة الموزونة = ٢٠٪ حضور + الحفظ + التثبيت + بند الإنذارات (١٠٪ ثابتة — لا يوجد نظام إنذارات بعد).
                السُّلّم: ممتاز ٨٠–١٠٠ فأكثر · جيد ٦٠–٧٩ · ضعيف أقل من ٦٠.
              </p>
            </section>

            {/* الحصيلة التفصيلية */}
            <section>
              <SecHead title="الحصيلة التفصيلية للطالبات" />
              <div className="overflow-x-auto">
                <RepTable head={['الطالبة', 'الفرع', 'الحلقة', 'الغرفة', 'الحضور', 'الأوجه', 'نسبة الحفظ', 'المطلوب', 'الموزونة', 'التقييم']}>
                  {report.rows.map(r => (
                    <tr key={r.key}>
                      <Td bold nowrap>{r.full_name}</Td>
                      <Td nowrap>{r.branchName}</Td>
                      <Td nowrap>{r.circleName}</Td>
                      <Td>{r.room || '—'}</Td>
                      <Td>{r.hasAtt ? `${ar(r.attPct)}٪` : '—'}</Td>
                      <Td>{ar(r.pages, 1)}</Td>
                      <Td>{r.sponsor || r.hasTarget ? `${ar(Math.round(r.hifzPct))}٪` : '—'}</Td>
                      <Td>{r.done === null ? '—' : r.done ? 'أتمّت' : 'لم تُتم'}</Td>
                      <Td><span style={{ fontWeight: 700, color: INK }}>{ar(Math.round(r.weighted))}٪</span></Td>
                      <Td><TierPill tier={r.tier} /></Td>
                    </tr>
                  ))}
                </RepTable>
              </div>
            </section>
            </>)}

            <footer className="text-center pt-4" style={{ borderTop: `1px solid ${GOLD_SOFT}` }}>
              <span style={{ color: GOLD, fontFamily: 'Amiri, serif', fontSize: 18 }}>۝</span>
              <p className="text-xs text-muted-foreground mt-1">
                جمعية تعلَّم للقرآن الكريم وعلومه · حلقات الحرم مستهدفها اليومي = ما أنجزته (تُتمّ دائماً).
              </p>
            </footer>
          </div>
          <div style={{ height: 6, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_SOFT}, ${GOLD})` }} />
        </div>
      )}
    </div>
  );
}

// ---------- presentational helpers ----------
function SecHead({ title, danger }: { title: string; danger?: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span style={{ color: danger ? RED : GOLD, fontFamily: 'Amiri, serif', fontSize: 22, lineHeight: 1 }}>۝</span>
      <h3 className="font-display text-2xl whitespace-nowrap" style={{ color: danger ? RED : INK }}>{title}</h3>
      <span className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${GOLD_SOFT}, transparent)` }} />
    </div>
  );
}
function Fig({ value, label, hero }: { value: string; label: string; hero?: boolean }) {
  return (
    <div>
      <div className={`fig-num font-display ${hero ? 'text-3xl' : 'text-2xl'}`} style={{ color: hero ? INK : 'var(--rep-ink-soft)' }}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
function Tally({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-3 py-2">
      <div className="fig-num font-display text-3xl" style={{ color: INK }}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
function TierStat({ tier, n }: { tier: EvalTier; n: number }) {
  const s = TIER_STYLE[tier];
  return (
    <div className="rounded-lg py-4 text-center" style={{ background: s.bg }}>
      <div className="fig-num font-display text-3xl" style={{ color: s.fg }}>{ar(n)}</div>
      <div className="text-sm font-medium mt-1" style={{ color: s.fg }}>{tier}</div>
    </div>
  );
}
function TierPill({ tier }: { tier: EvalTier }) {
  const s = TIER_STYLE[tier];
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: s.bg, color: s.fg }}>{tier}</span>;
}
function RepTable({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${GOLD_SOFT}` }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: INK }}>
            {head.map((h, i) => <th key={i} className="text-right font-medium px-3 py-2.5" style={{ color: PAPER }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Td({ children, bold, muted, nowrap }: { children: ReactNode; bold?: boolean; muted?: boolean; nowrap?: boolean }) {
  return (
    <td className={`px-3 py-2 border-t ${nowrap ? 'whitespace-nowrap' : ''} ${bold ? 'font-medium' : ''}`}
      style={{ borderColor: GOLD_SOFT, color: muted ? 'var(--rep-ink-soft)' : undefined }}>{children}</td>
  );
}
