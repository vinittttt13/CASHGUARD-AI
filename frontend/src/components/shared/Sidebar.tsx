'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { 
  LayoutDashboard, 
  BarChart2, 
  Bell, 
  BrainCircuit, 
  Settings, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Analytics', href: '/analytics', icon: BarChart2 },
  { label: 'Alerts', href: '/alerts', icon: Bell },
  { label: 'Intelligence', href: '/intelligence', icon: BrainCircuit },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={`relative flex flex-col h-screen border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex items-center justify-between p-4 h-16 border-b border-gray-200 dark:border-gray-800">
        {!isCollapsed && (
          <span className="text-xl font-bold text-gray-800 dark:text-gray-100 truncate">
            CyberGuard AI
          </span>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none"
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-4 py-3 mx-2 rounded-md transition-colors ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Icon size={20} className={`shrink-0 ${isCollapsed ? 'mx-auto' : 'mr-3'}`} />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Admin User
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full mt-1 w-max">
                Analyst
              </span>
            </div>
          )}
          {isCollapsed && (
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
              AU
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
