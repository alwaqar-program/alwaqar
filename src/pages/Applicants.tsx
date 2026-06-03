import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Eye, AlertCircle } from 'lucide-react';
import { supabase, type Applicant, type ApplicantStatus, type AgeCategory, type Branch } from '../lib/supabase';
import { STATUS_AR, STATUS_COLOR, AGE_AR, AGE_COLOR, BRANCH_AR, BRANCH_COLOR } from '../lib/labels';
import Badge from '../components/Badge';

const PAGE_SIZE = 25;

export default function Applicants() {
  const [data, setData] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicantStatus | ''>('');
  const [ageFilter, setAgeFilter] = useState<AgeCategory | ''>('');
  const [branchFilter, setBranchFilter] = useState<Branch | ''>('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('applicants')
        .select('*')
        .order('submission_number', { ascending: false });
      if (error) setError(error.message);
      else setData(data as Applicant[]);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    return data.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (ageFilter && r.age_category !== ageFilter) return false;
      if (branchFilter && r.desired_branch !== branchFilter) return false;
      if (search) {
        const q = search.trim().toLowerCase();
        const hay = `${r.full_name || ''} ${r.national_id || ''} ${r.phone || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, search, statusFilter, ageFilter, branchFilter]);

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Reset page when filters change
  useEffect(() => setPage(1), [search, statusFilter, ageFilter, branchFilter]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-900">المتقدمات</h2>
          <p className="text-slate-600 mt-1">إدارة طلبات الانضمام لدورة الوقار</p>
        </div>
        <div className="text-sm text-slate-500 tabular-nums">
          {filtered.length} من {data.length}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative lg:col-span-2">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الهوية أو الجوال…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ApplicantStatus | '')}
          className="px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">جميع الحالات</option>
          {Object.entries(STATUS_AR).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <select
            value={ageFilter}
            onChange={(e) => setAgeFilter(e.target.value as AgeCategory | '')}
            className="px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">كل الأعمار</option>
            {Object.entries(AGE_AR).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value as Branch | '')}
            className="px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">كل الفروع</option>
            {Object.entries(BRANCH_AR).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">جاري تحميل البيانات…</div>
        ) : error ? (
          <div className="p-12 text-center text-rose-600 flex flex-col items-center gap-2">
            <AlertCircle size={32} />
            <div>{error}</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">لا توجد نتائج</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-xs font-semibold text-slate-600 uppercase">
                  <th className="px-4 py-3">الاسم</th>
                  <th className="px-4 py-3">الهوية</th>
                  <th className="px-4 py-3">الجوال</th>
                  <th className="px-4 py-3">المدينة</th>
                  <th className="px-4 py-3">الفئة العمرية</th>
                  <th className="px-4 py-3">الفرع</th>
                  <th className="px-4 py-3">الأجزاء</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paged.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{r.full_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 tabular-nums">{r.national_id || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 tabular-nums">{r.phone || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{r.city || '—'}</td>
                    <td className="px-4 py-3">
                      {r.age_category ? <Badge color={AGE_COLOR[r.age_category]}>{AGE_AR[r.age_category]}</Badge> : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {r.desired_branch ? <Badge color={BRANCH_COLOR[r.desired_branch]}>{BRANCH_AR[r.desired_branch]}</Badge> : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600 tabular-nums">{r.memorized_juz_count ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge color={STATUS_COLOR[r.status]}>{STATUS_AR[r.status]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/applicants/${r.id}`}
                        className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-800 text-sm"
                      >
                        <Eye size={16} />
                        عرض
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <div className="text-sm text-slate-600 tabular-nums">
              صفحة {page} من {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                السابق
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
