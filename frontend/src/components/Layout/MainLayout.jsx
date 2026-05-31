import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Package, LogOut, Home, KeySquare, CalendarCheck, Menu, X } from 'lucide-react';
import NotificationBell from '../Notifications/NotificationBell';

const MainLayout = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = user?.role === 'admin';

  const NavItem = ({ to, icon: Icon, label }) => (
    <Link 
      to={to} 
      onClick={() => setIsSidebarOpen(false)}
      className="flex items-center space-x-3 p-3 hover:bg-slate-800/50 text-slate-300 hover:text-blue-400 rounded-lg transition-colors font-medium"
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 text-white shadow-md sticky top-0 z-30">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-1 hover:bg-blue-700 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
              aria-label="Open Menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex items-center space-x-2">
              <Package className="h-6 w-6" />
              <span className="text-xl font-bold hidden sm:inline">Smart Asset Platform</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm hidden sm:inline">Welcome, {user?.username || user?.sub || 'User'}</span>
            <NotificationBell />
            <button 
              onClick={handleLogout}
              className="flex items-center space-x-1 hover:bg-blue-700 px-3 py-1.5 rounded transition font-medium"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <div 
        className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} w-72 bg-slate-900/95 backdrop-blur-xl shadow-2xl border-r border-slate-800 z-50 transition-transform duration-300 ease-in-out flex flex-col`}
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-transparent">
          <span className="text-lg font-bold text-white tracking-wider uppercase text-sm">Navigation</span>
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="p-4 space-y-1 overflow-y-auto flex-1">
          {isAdmin ? (
            <>
              <NavItem to="/admin-dashboard" icon={Home} label="Dashboard" />
              <NavItem to="/admin/assets" icon={Package} label="Manage Inventory" />
              <NavItem to="/admin/bookings" icon={CalendarCheck} label="Booking Requests" />
              <NavItem to="/admin/transfers" icon={Package} label="P2P Approvals" />
              <NavItem to="/admin/history" icon={Package} label="Master Audit Log" />
            </>
          ) : (
            <>
              <NavItem to="/dashboard" icon={Home} label="Home" />
              <NavItem to="/catalog" icon={Package} label="Browse Catalog" />
              <NavItem to="/my-bookings" icon={CalendarCheck} label="My Bookings" />
              <NavItem to="/transfer-requests" icon={Package} label="P2P Requests" />
            </>
          )}
        </nav>
        
        <div className="p-5 border-t border-slate-800 bg-transparent text-xs text-slate-500 text-center">
          Smart Asset Platform &copy; 2026
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 container mx-auto px-4 py-6 w-full">
        <main className="flex-1 min-w-0 bg-slate-900/40 backdrop-blur-sm rounded-xl shadow-lg p-4 sm:p-6 overflow-x-hidden border border-slate-800/50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
