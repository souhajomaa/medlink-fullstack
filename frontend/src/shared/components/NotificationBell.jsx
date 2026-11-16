import { useState, useEffect, useRef } from 'react';
import { api } from '../api/axiosConfig';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Refresh 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.patient.notifications.list();
      setNotifications(res.data?.data || []);
      setUnread(res.data?.unread || 0);
    } catch (err) {
      console.error(err);
    }
  };

  const markRead = async (id) => {
    await api.patient.notifications.read(id);
    fetchNotifications();
  };

  const markAllRead = async () => {
    await api.patient.notifications.readAll();
    fetchNotifications();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-surface-container transition-colors"
      >
        <svg className="w-6 h-6 text-on-variant" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3A6 6 0 006 11v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-5 h-5 bg-error text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-surface border border-outline-variant rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="p-4 border-b border-outline-variant flex items-center justify-between">
            <h3 className="font-bold text-on-surface">Notifications</h3>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-primary hover:underline">
                Tout marquer comme lu
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-6 text-center text-on-variant text-sm">Aucune notification</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.is_read && markRead(n.id)}
                  className={`w-full p-4 text-left border-b border-outline-variant/50 hover:bg-surface-low transition-colors ${
                    !n.is_read ? 'bg-primary-50/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {!n.is_read && <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></span>}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-on-surface text-sm">{n.title}</p>
                      <p className="text-xs text-on-variant mt-1">{n.message}</p>
                      <p className="text-xs text-outline mt-2">
                        {new Date(n.created_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}