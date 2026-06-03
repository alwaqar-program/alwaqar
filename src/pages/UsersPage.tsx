import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Shield, UserPlus, Users } from 'lucide-react';

const roleLabels: Record<string, string> = {
  admin: 'مدير النظام',
  teacher: 'معلمة',
  student_affairs: 'شؤون طالبات',
  housing_supervisor: 'مشرفة سكن',
  observer: 'مراقب',
};

const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  teacher: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  student_affairs: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  housing_supervisor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  observer: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

interface UserWithRole {
  user_id: string;
  role: string;
  full_name: string;
  email: string;
  created_at: string;
}

export default function UsersPage() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    role: '',
  });

  const fetchUsers = async () => {
    setLoading(true);
    // Get user_roles with profiles
    const { data: rolesData, error } = await supabase
      .from('user_roles')
      .select('user_id, role, created_at');

    if (error) {
      toast.error('خطأ في جلب المستخدمين');
      setLoading(false);
      return;
    }

    // Get profiles
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, full_name');

    const profileMap = new Map(profilesData?.map(p => [p.user_id, p.full_name]) || []);

    const combined: UserWithRole[] = (rolesData || []).map(r => ({
      user_id: r.user_id,
      role: r.role,
      full_name: profileMap.get(r.user_id) || 'غير معروف',
      email: '',
      created_at: r.created_at,
    }));

    setUsers(combined);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.full_name || !form.role) {
      toast.error('جميع الحقول مطلوبة');
      return;
    }
    if (form.password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('create-user', {
        body: {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          role: form.role,
        },
      });

      if (res.error || res.data?.error) {
        toast.error(res.data?.error || res.error?.message || 'خطأ في إنشاء المستخدم');
      } else {
        toast.success('تم إنشاء المستخدم بنجاح');
        setDialogOpen(false);
        setForm({ email: '', password: '', full_name: '', role: '' });
        fetchUsers();
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ');
    }
    setCreating(false);
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-display text-foreground">إدارة المستخدمين</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Shield size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">هذه الصفحة متاحة للمدير فقط</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display text-foreground">إدارة المستخدمين والأدوار</h1>
          <p className="text-sm text-muted-foreground mt-1">إضافة مستخدمين جدد وتعيين صلاحياتهم</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus size={18} />
              إضافة مستخدم
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="font-display">إضافة مستخدم جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>الاسم الكامل</Label>
                <Input
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  placeholder="اسم المستخدم"
                />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="user@example.com"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>كلمة المرور</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="6 أحرف على الأقل"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>الدور</Label>
                <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الدور" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">مدير النظام</SelectItem>
                    <SelectItem value="teacher">معلمة</SelectItem>
                    <SelectItem value="student_affairs">شؤون طالبات</SelectItem>
                    <SelectItem value="housing_supervisor">مشرفة سكن</SelectItem>
                    <SelectItem value="observer">مراقب</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={creating} className="w-full gap-2">
                {creating ? 'جارٍ الإنشاء...' : (
                  <>
                    <Plus size={18} />
                    إنشاء المستخدم
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Object.entries(roleLabels).map(([role, label]) => {
          const count = users.filter(u => u.role === role).length;
          return (
            <Card key={role}>
              <CardContent className="pt-4 pb-3 px-4 text-center">
                <p className="text-2xl font-display text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Users table */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Users size={20} />
            المستخدمون ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">جارٍ التحميل...</p>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا يوجد مستخدمون</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">الدور</TableHead>
                    <TableHead className="text-right">تاريخ الإضافة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u, i) => (
                    <TableRow key={`${u.user_id}-${u.role}-${i}`}>
                      <TableCell className="font-medium">{u.full_name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={roleColors[u.role] || ''}>
                          {roleLabels[u.role] || u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(u.created_at).toLocaleDateString('ar-SA')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
