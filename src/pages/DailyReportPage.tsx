import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import { dailyNisab } from '@/lib/program-target';
import { isSponsor } from '@/lib/circle-type';
import { Cohort, COHORTS, cohortSubjectColumn } from '@/lib/cohorts';
import {
  weightedPercent, evalTier, EvalTier, HIFZ_BUCKETS, hifzBucketIndex,
} from '@/lib/report-metrics';

// ثوابت التحويل (مطابقة للوحة المعلومات).
const PAGES_PER_JUZ = 20;
const PAGES_PER_KHATMA = 604;

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ar = (n: number, digits = 0) =>
  n.toLocaleString('ar-EG', { minimumFractionDigits: digits, maximumFractionDigits: digits });
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

// ---------- charts (CSS/SVG، صديقة للطباعة) ----------
function Donut({ pct, label, color }: { pct: number; label: string; color: string }) {
  const r = 52, c = 2 * Math.PI * r;
  const shown = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 120 120" className="w-32 h-32 -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${(shown / 100) * c} ${c}`} />
        <text x="60" y="60" transform="rotate(90 60 60)" textAnchor="middle" dominantBaseline="central"
          className="fill-foreground font-bold" style={{ fontSize: 22 }}>{ar(Math.round(pct))}٪</text>
      </svg>
      <span className="text-sm font-medium text-center">{label}</span>
    </div>
  );
}

function HBar({ label, value, max, right, color }: { label: string; value: number; max: number; right: string; color: string }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 font-medium">{label}</span>
      <div className="flex-1 h-6 rounded bg-muted overflow-hidden">
        <div className="h-full rounded flex items-center justify-end pl-2 text-[11px] text-white"
          style={{ width: `${w}%`, backgroundColor: color }}>{value > 0 ? ar(value) : ''}</div>
      </div>
      <span className="w-14 shrink-0 text-left font-semibold">{right}</span>
    </div>
  );
}

// ---------- types ----------
interface Circle { id: string; circle_name: string; branch_id: string; circle_type: string; }
interface Branch { id: string; branch_name: string; juz_count: number; }
interface Member {
  key: string; id: string; cohort: Cohort; full_name: string; circle_id: string | null; room_id: string | null;
}
interface RecRow { circle_id: string | null; pages: number; thabit: boolean; subj: Record<string, string | null>; }
interface AttRow { status: string; subj: Record<string, string | null>; }

const TIER_COLOR: Record<EvalTier, string> = {
  'ممتاز': 'hsl(var(--success))', 'جيد': 'hsl(var(--accent))', 'ضعيف': 'hsl(var(--destructive))',
};

export default function DailyReportPage() {
  const today = toISO(new Date());
  const [date, setDate] = useState(today);
  const [loading, setLoading] = useState(true);
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
        supabase.from('students').select(memberSel),
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
          .map(r => ({ key: `${cohort}:${r.id}`, id: r.id, cohort, full_name: r.full_name, circle_id: r.circle_id, room_id: r.room_id ?? null }));
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
    // فهرسة سجلات اليوم حسب معرّف الفاعل لكل فئة.
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

    const rows = members.map(m => {
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
      // المطلوب اليومي: الحرم = ما أنجزته (تُتمّ دائماً)؛ العادية = نصاب الفرع.
      const target = sponsor ? rec.pages : (dailyNisab(juz) ?? 0);
      const hasTarget = sponsor ? rec.pages > 0 : (dailyNisab(juz) ?? 0) > 0;
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

    // إجماليات
    const completed = rows.reduce((s, r) => s + r.pages, 0);
    const required = rows.reduce((s, r) => s + (r.sponsor ? r.pages : (r.hasTarget ? r.target : 0)), 0);
    const withTarget = rows.filter(r => r.hasTarget || r.sponsor);
    const doneCount = rows.filter(r => r.done === true).length;
    const presentCount = rows.filter(r => r.present).length;
    const pct = required > 0 ? (completed / required) * 100 : 0;

    // حسب الفرع
    const byBranch = branches.filter(b => true).map(b => {
      const rs = rows.filter(r => circleById.get(r.circle_id || '')?.branch_id === b.id);
      const comp = rs.reduce((s, r) => s + r.pages, 0);
      const req = rs.reduce((s, r) => s + (r.sponsor ? r.pages : (r.hasTarget ? r.target : 0)), 0);
      const done = rs.filter(r => r.done === true).length;
      const nCircles = new Set(rs.map(r => r.circle_id)).size;
      return { id: b.id, name: b.branch_name, juz: b.juz_count, count: rs.length, nCircles, completed: comp, required: req, done, pct: req > 0 ? (comp / req) * 100 : 0 };
    }).filter(x => x.count > 0).sort((a, b) => b.juz - a.juz);

    // حسب الحلقة
    const byCircle = circles.map(c => {
      const rs = rows.filter(r => r.circle_id === c.id);
      const comp = rs.reduce((s, r) => s + r.pages, 0);
      const req = rs.reduce((s, r) => s + (r.sponsor ? r.pages : (r.hasTarget ? r.target : 0)), 0);
      return { id: c.id, name: c.circle_name, branch: branchById.get(c.branch_id)?.branch_name ?? '—', juz: branchById.get(c.branch_id)?.juz_count ?? 0, count: rs.length, completed: comp, pct: req > 0 ? (comp / req) * 100 : 0 };
    }).filter(x => x.count > 0).sort((a, b) => b.pct - a.pct);

    // توزيع الحفظ (لأصحاب المطلوب فقط)
    const hifzHist = HIFZ_BUCKETS.map(() => 0);
    withTarget.forEach(r => { hifzHist[hifzBucketIndex(r.hifzPct)]++; });

    // التقييم
    const tierCount: Record<EvalTier, number> = { 'ممتاز': 0, 'جيد': 0, 'ضعيف': 0 };
    rows.forEach(r => { tierCount[r.tier]++; });

    // المتعثرات (عجز في الحفظ)
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
  }, [members, circles, branches, recRows, attRows, rooms]);

  const maxHist = Math.max(1, ...report.hifzHist);

  return (
    <div className="space-y-6">
      {/* أدوات التحكم — تختفي عند الطباعة */}
      <div className="flex items-end justify-between flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-display text-foreground">التقرير اليومي التفصيلي</h1>
          <p className="text-sm text-muted-foreground mt-1">حصيلة اليوم لكل الفروع والحلقات — قابل للطباعة/‏PDF</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">التاريخ</Label>
            <Input type="date" dir="ltr" className="h-10 w-[160px]" value={date} max={today}
              onChange={e => setDate(e.target.value || today)} />
          </div>
          <Button onClick={() => window.print()} disabled={loading}><Printer size={18} /> طباعة / PDF</Button>
        </div>
      </div>

      {loading ? (
        <Card className="animate-pulse"><CardContent className="h-96" /></Card>
      ) : (
        <div id="daily-report" className="space-y-8 bg-background">
          {/* ترويسة التقرير */}
          <section className="text-center border-b pb-6">
            <img src={logoImg} alt="" className="h-16 w-16 object-contain mx-auto mb-3" />
            <h2 className="text-2xl font-display text-primary">التقرير اليومي التفصيلي — دورة الوقار</h2>
            <p className="text-muted-foreground mt-1">جمعية تعلَّم للقرآن الكريم وعلومه</p>
            <p className="text-foreground font-medium mt-3">{hijri(date)}</p>
            <p className="text-sm text-muted-foreground">{greg(date)}</p>
          </section>

          {/* منجزات اليوم */}
          <section>
            <SectionTitle>منجزات اليوم</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="عدد الطالبات" value={ar(report.totalMembers)} />
              <Stat label="عدد الحلقات" value={ar(report.nCircles)} />
              <Stat label="عدد المعلمات" value={ar(teacherCount)} />
              <Stat label="عدد الغرف" value={ar(report.nRooms)} />
              <Stat label="الأوجه المطلوبة" value={ar(report.required, 1)} />
              <Stat label="الأوجه المنجزة" value={ar(report.completed, 1)} accent />
              <Stat label="الأجزاء المنجزة" value={ar(report.juz, 1)} />
              <Stat label="تعادل من الختمات" value={ar(report.khatma, 2)} />
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              بلغت نسبة الإنجاز في الحفظ <strong className="text-primary">{ar(Math.round(report.pct))}٪</strong>،
              بإجمالي {ar(report.completed, 1)} وجهًا، أي ما يعادل {ar(report.khatma, 2)} ختمة و{ar(report.juz, 1)} جزءًا.
            </p>
          </section>

          {/* لوحة المؤشرات */}
          <section>
            <SectionTitle>لوحة المؤشرات التنفيذية</SectionTitle>
            <div className="grid grid-cols-2 gap-6 max-w-lg mx-auto">
              <Donut pct={report.donePct} label="نسبة إتمام المطلوب" color="hsl(var(--success))" />
              <Donut pct={report.attPct} label="متوسط الحضور" color="hsl(var(--primary))" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
              <Stat label="نسبة الإنجاز" value={`${ar(Math.round(report.pct))}٪`} accent />
              <Stat label="نسبة إتمام المطلوب" value={`${ar(Math.round(report.donePct))}٪`} />
              <Stat label="متوسط الحضور" value={`${ar(Math.round(report.attPct))}٪`} />
              <Stat label="تعادل من الختمات" value={ar(report.khatma, 2)} />
            </div>
          </section>

          {/* أداء الفروع */}
          <section>
            <SectionTitle>مؤشر أداء الفروع</SectionTitle>
            <div className="space-y-2">
              {report.byBranch.map(b => (
                <HBar key={b.id} label={b.name} value={b.done} max={b.count}
                  right={`${ar(Math.round(b.pct))}٪`} color="hsl(var(--primary))" />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">الشريط: عدد من أتممن المطلوب مقابل إجمالي الطالبات في الفرع · النسبة = نسبة الإنجاز.</p>
          </section>

          {/* الإنجاز الكلي */}
          <section className="text-center">
            <SectionTitle>الإنجاز الكلي: المطلوب مقابل المنجز</SectionTitle>
            <div className="flex items-end justify-center gap-8 h-48">
              <Bar label="المنجز" value={report.completed} max={Math.max(report.completed, report.required)} color="hsl(var(--primary))" />
              <Bar label="المطلوب" value={report.required} max={Math.max(report.completed, report.required)} color="hsl(var(--accent))" />
            </div>
            <div className="mt-3 inline-flex items-center justify-center h-20 w-20 rounded-full text-white font-bold text-lg"
              style={{ backgroundColor: 'hsl(var(--success))' }}>{ar(Math.round(report.pct))}٪</div>
          </section>

          {/* توزيع نسبة إنجاز الحفظ */}
          <section>
            <SectionTitle>توزيع نسبة إنجاز الحفظ</SectionTitle>
            <div className="flex items-end justify-around gap-2 h-56 border-b pb-1">
              {report.hifzHist.map((n, i) => (
                <div key={i} className="flex flex-col items-center justify-end gap-1 flex-1">
                  <span className="text-sm font-semibold">{ar(n)}</span>
                  <div className="w-full max-w-[56px] rounded-t"
                    style={{ height: `${(n / maxHist) * 100}%`, backgroundColor: i === 0 ? 'hsl(var(--destructive))' : i <= 2 ? 'hsl(var(--accent))' : 'hsl(var(--success))', minHeight: n > 0 ? 6 : 0 }} />
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">{HIFZ_BUCKETS[i].label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">عدد الطالبات في كل شريحة من شرائح نسبة إنجاز الحفظ.</p>
          </section>

          {/* المتعثرات */}
          <section>
            <SectionTitle danger>الطالبات المتعثرات في التسميع</SectionTitle>
            {report.struggling.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">لا توجد متعثرات — أتمّت الجميع المطلوب. ما شاء الله.</p>
            ) : (
              <Card><Table>
                <TableHeader><TableRow>
                  <TableHead>الطالبة</TableHead><TableHead>الحلقة</TableHead><TableHead>مقدار العجز</TableHead>
                  <TableHead>سبب العجز</TableHead><TableHead>خطة التعويض</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {report.struggling.map(r => (
                    <TableRow key={r.key}>
                      <TableCell className="font-medium">{r.full_name}</TableCell>
                      <TableCell className="text-sm">{r.circleName}</TableCell>
                      <TableCell className="text-destructive font-semibold">{ar(r.deficit, 1)}</TableCell>
                      <TableCell className="text-sm">{r.reason}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.plan}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></Card>
            )}
            <p className="text-sm font-medium mt-3">عدد المتعثرات في الحفظ: {ar(report.struggling.length)} من أصل {ar(report.totalMembers)} طالبة.</p>
          </section>

          {/* أداء الحلقات */}
          <section>
            <SectionTitle>مؤشر أداء الحلقات</SectionTitle>
            <Card><Table>
              <TableHeader><TableRow>
                <TableHead>الحلقة</TableHead><TableHead>الفرع</TableHead><TableHead>عدد الطالبات</TableHead>
                <TableHead>الأوجه المنجزة</TableHead><TableHead>نسبة الإنجاز</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {report.byCircle.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm">{c.branch}</TableCell>
                    <TableCell>{ar(c.count)}</TableCell>
                    <TableCell>{ar(c.completed, 1)}</TableCell>
                    <TableCell className="font-semibold">{ar(Math.round(c.pct))}٪</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></Card>
          </section>

          {/* التقييم — عدّادات */}
          <section>
            <SectionTitle>مؤشرات التقييم (النسبة الموزونة)</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="ممتاز" value={ar(report.tierCount['ممتاز'])} color="hsl(var(--success))" />
              <Stat label="جيد" value={ar(report.tierCount['جيد'])} color="hsl(var(--accent))" />
              <Stat label="ضعيف" value={ar(report.tierCount['ضعيف'])} color="hsl(var(--destructive))" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              النسبة الموزونة = ٢٠٪ حضور + الحفظ + التثبيت + بند الإنذارات (١٠٪ ثابتة — لا يوجد نظام إنذارات بعد).
              السُّلّم: ممتاز ٨٠–١٠٠+ · جيد ٦٠–٧٩ · ضعيف أقل من ٦٠.
            </p>
          </section>

          {/* الحصيلة التفصيلية */}
          <section>
            <SectionTitle>الحصيلة التفصيلية للطالبات</SectionTitle>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>الطالبة</TableHead><TableHead>الفرع</TableHead><TableHead>الحلقة</TableHead>
                  <TableHead>الغرفة</TableHead><TableHead>الحضور</TableHead><TableHead>الأوجه</TableHead>
                  <TableHead>نسبة الحفظ</TableHead><TableHead>المطلوب</TableHead>
                  <TableHead>الموزونة</TableHead><TableHead>التقييم</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {report.rows.map(r => (
                    <TableRow key={r.key}>
                      <TableCell className="font-medium whitespace-nowrap">{r.full_name}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.branchName}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.circleName}</TableCell>
                      <TableCell className="text-sm">{r.room || '—'}</TableCell>
                      <TableCell>{r.hasAtt ? `${ar(r.attPct)}٪` : '—'}</TableCell>
                      <TableCell>{ar(r.pages, 1)}</TableCell>
                      <TableCell>{r.sponsor || r.hasTarget ? `${ar(Math.round(r.hifzPct))}٪` : '—'}</TableCell>
                      <TableCell className="text-sm">{r.done === null ? '—' : r.done ? 'أتمّت' : 'لم تُتم'}</TableCell>
                      <TableCell className="font-semibold">{ar(Math.round(r.weighted))}٪</TableCell>
                      <TableCell><span className="px-2 py-0.5 rounded text-xs text-white" style={{ backgroundColor: TIER_COLOR[r.tier] }}>{r.tier}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <p className="text-xs text-muted-foreground text-center border-t pt-4">
            تقرير دورة الوقار · جمعية تعلَّم للقرآن الكريم وعلومه · حلقات الحرم مستهدفها اليومي = ما أنجزته (تُتمّ دائماً).
          </p>
        </div>
      )}
    </div>
  );
}

// ---------- small presentational helpers ----------
function SectionTitle({ children, danger }: { children: ReactNode; danger?: boolean }) {
  return (
    <h3 className="text-lg font-display text-white px-4 py-2 rounded-md mb-4"
      style={{ backgroundColor: danger ? 'hsl(var(--destructive))' : 'hsl(var(--primary))' }}>{children}</h3>
  );
}
function Stat({ label, value, accent, color }: { label: string; value: string; accent?: boolean; color?: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-xl font-bold" style={{ color: color ?? (accent ? 'hsl(var(--primary))' : undefined) }}>{value}</div>
    </div>
  );
}
function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const h = max > 0 ? Math.max(4, (value / max) * 100) : 0;
  return (
    <div className="flex flex-col items-center justify-end gap-1 h-full">
      <span className="text-sm font-semibold">{ar(Math.round(value))}</span>
      <div className="w-16 rounded-t" style={{ height: `${h}%`, backgroundColor: color }} />
      <span className="text-sm">{label}</span>
    </div>
  );
}
