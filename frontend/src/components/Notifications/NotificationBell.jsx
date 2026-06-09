import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, X, Package, AlertTriangle, Clock, Users, AlertCircle } from 'lucide-react';
import axiosClient from '../../api/axiosClient';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const fetchNotifications = async () => {
    try {
      const response = await axiosClient.get('/api/notifications/');
      setNotifications(response.data);
      setUnreadCount(response.data.filter(n => !n.is_read).length);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Poll every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (id, e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      await axiosClient.put(`/api/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  const markAllAsRead = async (e) => {
    e.stopPropagation();
    try {
      await axiosClient.put('/api/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  const handleNotificationClick = (notif, e) => {
    if (!notif.is_read) {
      markAsRead(notif.id, e);
    }
    setIsOpen(false);
    
    // Route based on notification type
    switch (notif.type) {
      case 'new_booking':
        navigate('/admin/bookings');
        break;
      case 'booking_approved':
      case 'booking_approved_partial':
      case 'booking_rejected':
      case 'booking_returned':
      case 'deadline_warning':
      case 'overdue':
      case 'p2p_completed':
        navigate('/my-bookings');
        break;
      case 'p2p_request':
      case 'p2p_rejected':
      case 'p2p_approved_partial':
        navigate('/transfer-requests');
        break;
      case 'p2p_admin_approval':
        navigate('/admin/transfers');
        break;
      default:
        break;
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'booking_approved': return <Check className="w-4 h-4 text-green-500" />;
      case 'booking_approved_partial': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'booking_rejected': return <X className="w-4 h-4 text-red-500" />;
      case 'booking_returned': return <Check className="w-4 h-4 text-emerald-400" />;
      case 'deadline_warning': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'overdue': return <AlertTriangle className="w-4 h-4 text-purple-500" />;
      case 'new_booking': return <Package className="w-4 h-4 text-indigo-500" />;
      case 'p2p_rejected': return <X className="w-4 h-4 text-red-500" />;
      case 'p2p_approved_partial': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'p2p_completed': return <Check className="w-4 h-4 text-green-500" />;
      case 'p2p_request': 
      case 'p2p_admin_approval': return <Users className="w-4 h-4 text-cyan-500" />;
      default: return <Bell className="w-4 h-4 text-blue-500" />;
    }
  };

  const getBgColor = (type, isRead) => {
    if (isRead) return 'bg-slate-800/40';
    switch (type) {
      case 'booking_approved': return 'bg-green-500/10 border border-green-500/30';
      case 'booking_approved_partial': return 'bg-yellow-500/10 border border-yellow-500/30';
      case 'booking_rejected': return 'bg-red-500/10 border border-red-500/30';
      case 'booking_returned': return 'bg-emerald-500/10 border border-emerald-500/30';
      case 'deadline_warning': return 'bg-amber-500/10 border border-amber-500/30';
      case 'overdue': return 'bg-purple-500/10 border border-purple-500/30';
      case 'new_booking': return 'bg-indigo-500/10 border border-indigo-500/30';
      case 'p2p_rejected': return 'bg-red-500/10 border border-red-500/30';
      case 'p2p_approved_partial': return 'bg-yellow-500/10 border border-yellow-500/30';
      case 'p2p_completed': return 'bg-green-500/10 border border-green-500/30';
      case 'p2p_request':
      case 'p2p_admin_approval': return 'bg-cyan-500/10 border border-cyan-500/30';
      default: return 'bg-blue-500/10 border border-blue-500/30';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-slate-800/60 transition-colors focus:outline-none"
      >
        <Bell className="w-6 h-6 text-slate-300 hover:text-white transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-slate-900/95 backdrop-blur-xl border border-slate-700 shadow-2xl rounded-2xl z-50 overflow-hidden">
          <div className="sticky top-0 bg-slate-900/90 backdrop-blur-md p-4 border-b border-slate-800 flex justify-between items-center z-10">
            <h3 className="font-bold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>
          
          <div className="divide-y divide-slate-800/50">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                You have no notifications.
              </div>
            ) : (
              notifications.map(notif => (
                <div 
                  key={notif.id} 
                  className={`p-4 transition-all duration-200 hover:bg-slate-800/50 ${getBgColor(notif.type, notif.is_read)} cursor-pointer`}
                  onClick={(e) => handleNotificationClick(notif, e)}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5 shrink-0">
                      {getIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <p className={`text-sm font-semibold truncate ${notif.is_read ? 'text-slate-400' : 'text-slate-200'}`}>
                          {notif.title}
                        </p>
                        {!notif.is_read && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 ml-2 mt-1.5"></span>
                        )}
                      </div>
                      <p className={`text-xs ${notif.is_read ? 'text-slate-500' : 'text-slate-300'} break-words whitespace-pre-wrap`}>
                        {notif.message}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-2 font-mono">
                        {new Date(notif.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
