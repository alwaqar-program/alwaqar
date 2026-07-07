import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileBarChart,
  GitBranch,
  Users,
  GraduationCap,
  UserCheck,
  BookOpen,
  DoorOpen,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  Mic,
  ClipboardCheck,
  FileCheck,
  Shield,
  FileSignature,
  AlertTriangle,
  CalendarOff,
  UserPlus,
  MessagesSquare,
  HeartHandshake,
  Baby,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import logoImg from '@/assets/logo.png';

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  roles?: string[];       // allowlist: يظهر فقط لهذه الأدوار
  hideForRoles?: string[]; // قائمة منع: يُخفى عمّن يملك أياً من هذه الأدوار (المدير يرى دائماً)
}

const navItems: NavItem[] = [
  { label: 'لوحة المعلومات', href: '/', icon: <LayoutDashboard size={20} /> },
  { label: 'التقرير اليومي', href: '/daily-report', icon: <FileBarChart size={20} /> },
  { label: 'المتقدمات', href: '/applicants', icon: <UserPlus size={20} />, hideForRoles: ['student_affairs'] },
  { label: 'المقابلات', href: '/interviews', icon: <MessagesSquare size={20} />, hideForRoles: ['student_affairs'] },
  { label: 'لجنة المقابلات', href: '/interview-committee', icon: <MessagesSquare size={20} />, roles: ['admin'] },
  { label: 'التسميع', href: '/recitation', icon: <Mic size={20} /> },
  { label: 'الحضور', href: '/attendance', icon: <ClipboardCheck size={20} /> },
  { label: 'الاختبارات', href: '/exams', icon: <FileCheck size={20} /> },
  { label: 'الطالبات', href: '/students', icon: <Users size={20} /> },
  { label: 'المرافقات', href: '/companions', icon: <HeartHandshake size={20} /> },
  { label: 'المبتدئات', href: '/mubtadiat', icon: <Baby size={20} /> },
  { label: 'الفروع', href: '/branches', icon: <GitBranch size={20} /> },
  { label: 'الحلقات', href: '/circles', icon: <BookOpen size={20} /> },
  { label: 'المعلمات', href: '/teachers', icon: <GraduationCap size={20} /> },
  { label: 'المشرفات', href: '/staff', icon: <UserCheck size={20} />, hideForRoles: ['student_affairs'] },
  { label: 'الغرف', href: '/rooms', icon: <DoorOpen size={20} /> },
  { label: 'التعهدات', href: '/pledges', icon: <FileSignature size={20} /> },
  { label: 'المخالفات', href: '/violations', icon: <AlertTriangle size={20} /> },
  { label: 'الاستئذان', href: '/leave-requests', icon: <CalendarOff size={20} /> },
  { label: 'المستخدمون', href: '/users', icon: <Shield size={20} />, roles: ['admin'] },
  { label: 'الإعدادات', href: '/settings', icon: <Settings size={20} />, roles: ['admin'] },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut, roles } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // دور «مُطّلع التقرير» يرى التقرير اليومي فقط (ما لم يكن مديراً أيضاً).
  const reportOnly = roles.includes('report_viewer' as any) && !roles.includes('admin' as any);
  const filteredItems = reportOnly
    ? navItems.filter(item => item.href === '/daily-report')
    : navItems.filter(item => {
        const isAdmin = roles.includes('admin' as any);
        // قائمة المنع تُخفي العنصر عمّن يملك دوراً ممنوعاً (إلا المدير يرى دائماً).
        if (!isAdmin && item.hideForRoles && item.hideForRoles.some(r => roles.includes(r as any))) return false;
        if (!item.roles) return true;
        return item.roles.some(r => roles.includes(r as any));
      });

  const roleLabels: Record<string, string> = {
    admin: 'إدارة',
    teacher: 'معلمة',
    student_affairs: 'شؤون طالبات',
    report_viewer: 'مُطّلع التقرير',
    housing_supervisor: 'مشرفة سكن',
    observer: 'مراقب',
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-foreground/20 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 right-0 h-full z-50 bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300',
          collapsed ? 'w-16' : 'w-64',
          mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center gap-3 p-4 border-b border-sidebar-border', collapsed && 'justify-center')}>
          <img src={logoImg} alt="شعار تمام" className="w-9 h-9 object-contain shrink-0" />
          {!collapsed && (
            <div className="overflow-hidden">
              <h2 className="font-display text-lg leading-tight">نظام الوقار</h2>
              <p className="text-xs text-sidebar-foreground/60">إدارة التحفيظ</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {filteredItems.map(item => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-body transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                  collapsed && 'justify-center px-0'
                )}
              >
                {item.icon}
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className={cn('p-3 border-t border-sidebar-border', collapsed && 'flex flex-col items-center')}>
          {!collapsed && (
            <div className="mb-2 px-2">
              <p className="text-sm font-medium truncate">{user?.email}</p>
              <p className="text-xs text-sidebar-foreground/60">
                {roles.map(r => roleLabels[r] || r).join('، ')}
              </p>
            </div>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors w-full"
          >
            <LogOut size={18} />
            {!collapsed && <span>تسجيل الخروج</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex absolute top-4 -left-3 w-6 h-6 rounded-full bg-card border border-border items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={14} className={cn('transition-transform', collapsed && 'rotate-180')} />
        </button>
      </aside>

      {/* Main content */}
      <main className={cn('flex-1 transition-all duration-300', collapsed ? 'lg:mr-16' : 'lg:mr-64')}>
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between p-4 border-b border-border bg-card">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </Button>
          <img src={logoImg} alt="شعار تمام" className="w-8 h-8 object-contain" />
          <div className="w-10" />
        </header>

        <div className="p-4 lg:p-6 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
