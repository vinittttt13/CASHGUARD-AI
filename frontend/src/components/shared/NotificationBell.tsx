'use client';

import { Bell } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAlerts, acknowledgeAlert } from '@/hooks/useAlerts';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { alerts, mutate } = useAlerts();

  const unreadAlerts = alerts?.filter((a: any) => !a.acknowledged) || [];
  const displayAlerts = alerts?.slice(0, 5) || [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    await Promise.all(unreadAlerts.map((a: any) => acknowledgeAlert(a.id || a._id)));
    mutate();
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors focus:outline-none"
      >
        <Bell size={20} />
        {unreadAlerts.length > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Notifications</h3>
            {unreadAlerts.length > 0 && (
              <button 
                onClick={handleMarkAllRead}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {displayAlerts.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400 text-sm">
                No new notifications
              </div>
            ) : (
              displayAlerts.map((alert: any) => (
                <div 
                  key={alert.id || alert._id || Math.random()} 
                  className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${!alert.acknowledged ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                >
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {alert.title || 'New Alert'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                    {alert.description || 'Details unavailable'}
                  </p>
                  <span className="text-[10px] text-gray-400 mt-2 block">
                    {alert.createdAt ? new Date(alert.createdAt).toLocaleString() : 'Just now'}
                  </span>
                </div>
              ))
            )}
          </div>
          
          <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <button className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:underline py-1">
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
