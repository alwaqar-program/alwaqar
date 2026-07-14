import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { NumberStepper } from '@/components/ui/number-stepper';
import { useToast } from '@/hooks/use-toast';
import { BookOpen } from 'lucide-react';
import logoImg from '@/assets/logo.png';
import {
  allVerseOptions, parseVerseKey, globalIndexOfKey, pageOfVerse, type MushafPageRef,
} from '@/lib/quran-verses';

// التاريخ بمكوّناته المحلية (لا UTC) — متوافق مع تخزين التواريخ YYYY-MM-DD في النظام.
const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface MushafRow { page_number: number; surah_number: number; verse_start: number; sort_order: number; }
interface StaffRec {
  id: string; staff_name: string; from_surah: string | null; to_surah: string | null;
  from_verse: number | null; to_verse: number | null; pages_recited: number | null;
}

// رابط عام منفصل لتسجيل تسميع المنسوبات/الطاقم — مستقل تماماً عن تسميع الطالبات،
// ويُحتسب فقط ضمن «الحصيلة التراكمية» في اللوحة.
export default function StaffRecitationPage() {
  const { toast } = useToast();
  const today = toISO(new Date());

  const [staffName, setStaffName] = useState('');
  const [date, setDate] = useState(today);
  const [fromVerse, setFromVerse] = useState('');
  const [toVerse, setToVerse] = useState('');
  const [errorCount, setErrorCount] = useState(0);
  const [lahnCount, setLahnCount] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [mushafPages, setMushafPages] = useState<MushafRow[]>([]);
  const [recent, setRecent] = useState<StaffRec[]>([]);

  const verseOpts = useMemo(() => allVerseOptions(), []);
  const pageRefs = useMemo<MushafPageRef[]>(
    () => mushafPages.map(p => ({
      page_number: p.page_number, surah_number: p.surah_number,
      verse_start: p.verse_start, sort_order: p.sort_order,
    })),
    [mushafPages],
  );

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('mushaf_reference')
        .select('page_number, surah_number, verse_start, sort_order')
        .order('sort_order');
      setMushafPages((data as MushafRow[] | null) || []);
    })();
  }, []);

  const loadRecent = async () => {
    // قد لا يكون الجدول موجوداً قبل تشغيل ترحيل 48 — نتجاهل الخطأ بهدوء.
    const { data } = await (supabase as any).from('staff_recitation_log')
      .select('id, staff_name, from_surah, to_surah, from_verse, to_verse, pages_recited')
      .eq('date', date).eq('is_deleted', false)
      .order('created_at', { ascending: false });
    setRecent((data as StaffRec[] | null) || []);
  };
  useEffect(() => { loadRecent(); /* eslint-disable-line */ }, [date]);

  const save = async () => {
    const name = staffName.trim();
    if (!name) { toast({ title: 'الرجاء إدخال اسم المنسوبة', variant: 'destructive' }); return; }
    if (!fromVerse || !toVerse) { toast({ title: 'حدّدي بداية ونهاية التسميع', variant: 'destructive' }); return; }
    const fromG = globalIndexOfKey(fromVerse);
    const toG = globalIndexOfKey(toVerse);
    if (fromG != null && toG != null && fromG > toG) {
      toast({ title: 'ترتيب غير صحيح', description: 'البداية يجب أن تسبق النهاية في ترتيب المصحف.', variant: 'destructive' });
      return;
    }
    const fromRef = parseVerseKey(fromVerse);
    const toRef = parseVerseKey(toVerse);
    const fromPage = fromRef ? pageOfVerse(pageRefs, fromRef.surah, fromRef.verse) : null;
    const toPage = toRef ? pageOfVerse(pageRefs, toRef.surah, toRef.verse) : null;

    setSaving(true);
    const { error } = await (supabase as any).from('staff_recitation_log').insert({
      staff_name: name,
      date,
      from_surah: fromRef?.surah ?? null, from_verse: fromRef?.verse ?? null,
      to_surah: toRef?.surah ?? null, to_verse: toRef?.verse ?? null,
      from_page: fromPage?.page_number ?? null, to_page: toPage?.page_number ?? null,
      from_sort_order: fromPage?.sort_order ?? null, to_sort_order: toPage?.sort_order ?? null,
      error_count: errorCount, lahn_count: lahnCount,
      notes: notes.trim() || null,
      recorded_by: 'رابط عام (منسوبات)',
    });
    setSaving(false);
    if (error) { toast({ title: 'تعذّر الحفظ', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'تم حفظ التسميع' });
    // إبقاء الاسم والتاريخ لتسهيل تتابع الإدخال؛ تصفير حقول التسميع.
    setFromVerse(''); setToVerse(''); setErrorCount(0); setLahnCount(0); setNotes('');
    loadRecent();
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Card>
          <CardContent className="pt-6 space-y-5">
            <div className="flex items-center gap-3">
              <img src={logoImg} alt="شعار" className="w-12 h-12 object-contain" />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-display text-foreground">تسجيل تسميع المنسوبات</h1>
                  <Badge variant="secondary" className="text-[11px]">رابط منفصل</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  سجّلي ما حفظتِه وسمّعتِه؛ يُحتسب ضمن الحصيلة التراكمية للدورة.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">اسم المنسوبة</Label>
                <Input value={staffName} onChange={e => setStaffName(e.target.value)} placeholder="الاسم..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">تاريخ التسميع</Label>
                <Input type="date" dir="ltr" value={date} max={today} onChange={e => setDate(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">من (السورة | الآية)</Label>
                <SearchableSelect options={verseOpts} value={fromVerse} onValueChange={setFromVerse}
                  placeholder="اختاري بداية التسميع" searchPlaceholder="ابحثي عن آية..." allowClear />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">إلى (السورة | الآية)</Label>
                <SearchableSelect options={verseOpts} value={toVerse} onValueChange={setToVerse}
                  placeholder="اختاري نهاية التسميع" searchPlaceholder="ابحثي عن آية..." allowClear />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">عدد الأخطاء</Label>
                <NumberStepper value={errorCount} onChange={setErrorCount} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">عدد اللحون</Label>
                <NumberStepper value={lahnCount} onChange={setLahnCount} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">ملاحظات (اختياري)</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="ملاحظات..." />
            </div>

            <Button className="w-full" onClick={save} disabled={saving}>
              {saving ? 'جارٍ الحفظ...' : 'حفظ التسميع'}
            </Button>
          </CardContent>
        </Card>

        {/* تسميعات اليوم المُدخَلة عبر هذا الرابط */}
        <Card>
          <CardContent className="pt-5">
            <h2 className="text-sm font-medium text-foreground mb-3">تسميعات هذا اليوم ({recent.length})</h2>
            {recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <BookOpen size={34} className="text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">لا توجد تسميعات مُسجّلة لهذا اليوم بعد.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recent.map(r => (
                  <div key={r.id} className="flex items-center justify-between p-2 rounded-lg border border-border/50 text-sm">
                    <div>
                      <p className="font-medium">{r.staff_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.from_surah}{r.from_verse ? ` (${r.from_verse})` : ''} ← {r.to_surah}{r.to_verse ? ` (${r.to_verse})` : ''}
                      </p>
                    </div>
                    <Badge variant="outline">{r.pages_recited ?? 0} صفحة</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
