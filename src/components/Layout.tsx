import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, UserPlus, Users, Settings as SettingsIcon } from 'lucide-react';

const navItems = [
  { to: '/', label: 'لوحة التحكم', icon: LayoutDashboard, end: true },
  { to: '/applicants', label: 'المتقدمات', icon: UserPlus },
  { to: '/students', label: 'الطالبات', icon: Users },
  { to: '/settings', label: 'الإعدادات', icon: SettingsIcon },
];

export default function Layout() {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-brand-800 text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-brand-700">
          <h1 className="text-2xl font-display font-bold">منصة الوقار</h1>
          <p className="text-brand-200 text-sm mt-1">قسم البنات</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-brand-700 text-white'
                    : 'text-brand-100 hover:bg-brand-700/50'
                }`
              }
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-brand-700 text-brand-200 text-xs">
          الدورة 14 — 1447هـ
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto bg-slate-50">
        <Outlet />
      </main>
    </div>
  );
}
