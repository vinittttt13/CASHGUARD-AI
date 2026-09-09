'use client';

import { Menu, Search } from 'lucide-react';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import NotificationBell from './NotificationBell';

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  
  const getBreadcrumb = () => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return 'Dashboard';
    return parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' / ');
  };

  return (
    <header className="h-16 flex items-center justify-between px-4 lg:px-8 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 z-10 sticky top-0">
      <div className="flex items-center flex-1">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
        >
          <Menu size={24} />
        </button>
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100 hidden sm:block">
          {getBreadcrumb()}
        </h1>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        <div className="relative hidden md:block">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search..."
            className="w-64 pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-full bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-gray-200"
          />
        </div>
        
        <NotificationBell />
        <ThemeToggle />
        
        <div className="relative cursor-pointer">
          <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm border-2 border-white dark:border-gray-800 shadow-sm">
            JD
          </div>
        </div>
      </div>
    </header>
  );
}
