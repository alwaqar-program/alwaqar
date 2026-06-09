import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { useScrollRestoration } from '@/lib/use-scroll-restoration';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Search, Filter, MessagesSquare, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Interview, CommitteeMember, ResultGrade,
  RESULT_AR, RESULT_COLOR, getScorePercentage,
} from '@/lib/interview-types';
import { exportToCsv, CsvColumnDef } from '@/lib/csv-utils';

interface ApplicantLite {
  id: string;
  full_name: string | null;
  national_id: string | null;
  desired_branch: string | null;
}

interface JoinedRow extends Interview {
  applicant: ApplicantLite | null;
  committeeMemberName: string | null;
}

const CSV_COLUMNS: CsvColumnDef[] = [
  { key: 'applicant_name', header: 'الطالبة' },
  { key: 'applicant_id_num', header: 'رقم الهوية' },
  { key: 'committee', header: 'العضوة المُقابِلة' },
  { key: 'date', header: 'تاريخ المقابلة' },
  { key: 'score', header: 'الدرجة' },
  { key: 'max_score', header: 'الحد الأقصى' },
  { key: 'score_pct', header: 'النسبة المئوية' },
  { key: 'result_ar', header: 'النتيجة' },
  { key: 'errors_count', header: 'الأخطاء' },
  { key: 'lahn_count', header: 'اللحون' },
  { key: 'continuity_count', header: 'الترددات' },
  { key: 'requested_passage_change_ar', header: 'طلب تغيير المقطع' },
  { key: 'specialization', header: 'التخصص' },
  { key: 'will_attend_full_course', header: 'ستحضر كامل الدورة' },
  { key: 'companions_notes', header: 'ملاحظات المرافقات' },
  { key: 'strengths', header: 'نقاط القوة' },
  { key: 'weaknesses', header: 'نقاط الضعف' },
  { key: 'personal_notes', header: 'ملاحظات شخصية' },
  { key: 'exam_notes', header: 'ملاحظات الاختبار' },
];

const PAGE_SIZE = 25;

export default function InterviewsListPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { saveScroll, attemptRestore } = useScrollRestoration('interviews');
  const [rows, setRows] = useState<JoinedRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [resultFilter, setResultFilter] = useState<ResultGrade | 'all'>('all');
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const setPage = (newPage: number) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (newPage <= 1) p.delete('page');
      else p.set('page', String(newPage));
      return p;
    });
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [iRes, aRes, cRes] = await Promise.all([
        (supabase as any).from('interviews').select('*').order('created_at', { ascending: false }),
        (supabase as any).from('applicants').select('id,full_name,national_id,desired_branch'),
        (supabase as any).from('interview_committee').select('id,full_name,is_active,notes,created_at'),
      ]);
      if (iRes.error) {
        toast({ title: 'تعذّر التحميل', description: iRes.error.message, variant: 'destructive' });
        setLoading(false);
        return;
      }
      const apps: Record<string, ApplicantLite> = {};
      for (const a of (aRes.data ?? []) as ApplicantLite[]) apps[a.id] = a;
      const members: Record<string, CommitteeMember> = {};
      for (const m of (cRes.data ?? []) as CommitteeMember[]) members[m.id] = m;
      const joined: JoinedRow[] = (iRes.data as Interview[]).map((i) => ({
        ...i,
        applicant: apps[i.applicant_id] ?? null,
        // prefer the saved name (preserved even if member is later deleted)
        // then fall back to the current name via the FK
        committeeMemberName:
          i.committee_member_name
          ?? (i.committee_member_id ? members[i.committee_member_id]?.full_name ?? null : null),
      }));
      setRows(joined);
      setLoading(false);
    })();
  }, [toast]);

  // Restore scroll once the rows are rendered.
  useEffect(() => {
    if (!loading) attemptRestore();
  }, [loading, attemptRestore]);

  const committeeMembers = useMemo(() => {
    const names = new Map<string, string>();
    for (const r of rows) {
      if (r.committee_member_id && r.committeeMemberName) {
        names.set(r.committee_member_id, r.committeeMemberName);
      }
    }
    return Array.from(names.entries()).sort((a, b) => a[1].localeCompare(b[1], 'ar'));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (memberFilter !== 'all' && r.committee_member_id !== memberFilter) return false;
      if (resultFilter !== 'all' && r.result !== resultFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${r.applicant?.full_name || ''} ${r.applicant?.national_id || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, memberFilter, resultFilter]);

  // Reset to page 1 only when filters change AFTER the initial mount,
  // so navigating back from a detail page preserves the saved ?page=N
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (page !== 1) setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, memberFilter, resultFilter]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Summary stats
  const stats = useMemo(() => {
    const counts: Record<ResultGrade | 'total', number> = {
      total: filtered.length, excellent: 0, very_good: 0, good: 0, acceptable: 0, weak: 0,
    };
    for (const r of filtered) {
      if (r.result) counts[r.result]++;
    }
    return counts;
  }, [filtered]);

  // Export
  function handleExport() {
    const csv = filtered.map((r) => ({
      applicant_name: r.applicant?.full_name ?? '—',
      applicant_id_num: r.applicant?.national_id ?? '',
      committee: r.committeeMemberName ?? '—',
      date: new Date(r.created_at).toISOString().slice(0, 16).replace('T', ' '),
      score: r.score,
      max_score: r.max_score,
      score_pct: getScorePercentage(r.score, r.max_score) ?? '',
      result_ar: r.result ? RESULT_AR[r.result] : '',
      errors_count: r.errors_count,
      lahn_count: r.lahn_count,
      continuity_count: r.continuity_count,
      requested_passage_change_ar: r.requested_passage_change === null ? '' : (r.requested_passage_change ? 'نعم' : 'لا'),
      specialization: r.specialization || '',
      will_attend_full_course: r.will_attend_full_course === null ? '' : (r.will_attend_full_course ? 'نعم' : 'لا'),
      companions_notes: r.companions_notes || '',
      strengths: r.strengths || '',
      weaknesses: r.weaknesses || '',
      personal_notes: r.personal_notes || '',
      exam_notes: r.exam_notes || '',
    }));
    exportToCsv(csv, CSV_COLUMNS, 'مقابلات');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display flex items-center gap-2">
            <MessagesSquare size={24} />
            المقابلات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">سجل المقابلات التي أجرتها اللجنة</p>
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="gap-2"
        >
          <Download size={16} />
          تصدير CSV ({filtered.length})
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="الإجمالي" value={stats.total} />
        <Stat label="ممتاز" value={stats.excellent} color="text-emerald-600" />
        <Stat label="جيد جداً" value={stats.very_good} color="text-sky-600" />
        <Stat label="جيد" value={stats.good} color="text-amber-600" />
        <Stat label="مقبول" value={stats.acceptable} color="text-orange-600" />
        <Stat label="ضعيف" value={stats.weak} color="text-rose-600" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="relative lg:col-span-1">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="بحث بالاسم أو الهوية…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
            />
          </div>
          <Select value={memberFilter} onValueChange={setMemberFilter}>
            <SelectTrigger><SelectValue placeholder="العضوة المُقابِلة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل العضوات</SelectItem>
              {committeeMembers.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={resultFilter} onValueChange={(v) => setResultFilter(v as ResultGrade | 'all')}>
            <SelectTrigger><SelectValue placeholder="النتيجة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل النتائج</SelectItem>
              {(Object.entries(RESULT_AR) as [ResultGrade, string][]).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
        <CardContent className="pt-0 text-xs text-muted-foreground flex items-center gap-2">
          <Filter size={12} />
          عرض {filtered.length} من {rows.length}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-12 text-center text-muted-foreground">جارٍ التحميل…</p>
          ) : filtered.length === 0 ? (
            <p className="p-12 text-center text-muted-foreground">لا توجد مقابلات تطابق الفلاتر</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الطالبة</TableHead>
                    <TableHead className="text-right">العضوة</TableHead>
                    <TableHead className="text-right">الدرجة</TableHead>
                    <TableHead className="text-right">النسبة</TableHead>
                    <TableHead className="text-right">النتيجة</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => { if (r.applicant) { saveScroll(); navigate(`/applicants/${r.applicant.id}`); } }}
                    >
                      <TableCell className="font-medium">
                        {r.applicant?.full_name ?? '(محذوفة)'}
                        {r.applicant?.national_id && (
                          <p className="text-xs text-muted-foreground tabular-nums">{r.applicant.national_id}</p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{r.committeeMemberName ?? '—'}</TableCell>
                      <TableCell className="tabular-nums">
                        {r.score ?? '—'}<span className="text-muted-foreground text-xs">/{r.max_score}</span>
                      </TableCell>
                      <TableCell className="tabular-nums font-medium">
                        {getScorePercentage(r.score, r.max_score) ?? '—'}
                        <span className="text-muted-foreground text-xs">%</span>
                      </TableCell>
                      <TableCell>
                        {r.result
                          ? <Badge className={RESULT_COLOR[r.result]}>{RESULT_AR[r.result]}</Badge>
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString('ar-SA', {
                          year: 'numeric', month: 'short', day: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); if (r.applicant) { saveScroll(); navigate(`/applicants/${r.applicant.id}`); } }}
                        >
                          عرض الطالبة
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!loading && filtered.length > PAGE_SIZE && (
            <div className="border-t p-2">
              <PaginationBar page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 text-center">
        <p className={`text-2xl font-display tabular-nums ${color ?? ''}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}
