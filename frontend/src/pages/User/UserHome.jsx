import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { Package, CalendarCheck, Clock, AlertTriangle, ArrowRight, UserCheck, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const UserHome = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    activeAssets: 0,
    overdueAssets: 0,
    pendingBookings: 0,
    incomingTransfers: 0,
    pendingSentTransfers: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [activeHoldings, setActiveHoldings] = useState([]);
  const [newestAssets, setNewestAssets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [bookingsRes, incomingRes, sentRes, assetsRes] = await Promise.all([
          axiosClient.get('/api/bookings/my-bookings'),
          axiosClient.get('/api/transfers/my-requests'),
          axiosClient.get('/api/transfers/sent-requests'),
          axiosClient.get('/api/assets/')
        ]);

        const bookings = bookingsRes.data;
        const incoming = incomingRes.data;
        const sent = sentRes.data;
        const allAssets = assetsRes.data;

        const now = new Date();

        // Calculate Stats
        let active = 0;
        let overdue = 0;
        let pending = 0;

        bookings.forEach(b => {
          if (b.status === 'Issued') {
            active++;
            if (new Date(b.end_date) < now) overdue++;
          } else if (b.status === 'Overdue') {
            active++;
            overdue++;
          } else if (b.status === 'Pending') {
            pending++;
          }
        });

        const incomingCount = incoming.filter(t => t.status === 'Pending User Approval').length;
        const sentPendingCount = sent.filter(t => t.status === 'Pending User Approval' || t.status === 'Pending Admin Approval').length;

        setStats({
          activeAssets: active,
          overdueAssets: overdue,
          pendingBookings: pending,
          incomingTransfers: incomingCount,
          pendingSentTransfers: sentPendingCount
        });

        const currentHoldings = bookings.filter(b => b.status === 'Issued' || b.status === 'Overdue');
        setActiveHoldings(currentHoldings);

        // Sort assets by ObjectId timestamp descending (which is essentially newest first)
        const sortedAssets = [...allAssets].sort((a, b) => (b._id || b.id).localeCompare(a._id || a.id));
        setNewestAssets(sortedAssets.slice(0, 3));

        // Compile Recent Activity (latest 5 items from bookings and sent transfers)
        const combinedActivity = [
          ...bookings.map(b => ({
            id: b.id,
            type: 'booking',
            name: b.asset_name,
            status: b.status,
            date: new Date(b.created_at || b.start_date) // Assuming there is some date, fallback to start_date
          })),
          ...sent.map(t => ({
            id: t.id,
            type: 'transfer',
            name: t.asset_name,
            status: t.status,
            date: new Date() // Transfers don't have created_at currently, we just append them
          }))
        ];

        // Sort by date descending (rough approximation since we don't have perfect timestamps for everything)
        combinedActivity.sort((a, b) => b.date - a.date);
        setRecentActivity(combinedActivity.slice(0, 4));

      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Loading Dashboard...</div>;
  }

  return (
    <div className="space-y-8 w-full max-w-full overflow-x-hidden pb-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold mb-2">Welcome back, {user?.username || user?.sub || 'User'}!</h1>
          <p className="text-blue-100 max-w-xl">
            This is your personal asset command center. Track your current holdings, manage incoming P2P requests, and request new assets from the catalog.
          </p>
        </div>
        <Package className="absolute right-8 -bottom-8 w-48 h-48 text-white opacity-10 transform rotate-12" />
      </div>

      {/* Actionable Alerts */}
      {(stats.overdueAssets > 0 || stats.incomingTransfers > 0) && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800">Action Required</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.overdueAssets > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-4">
                <div className="bg-red-100 p-2 rounded-full text-red-600">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-red-800">Overdue Assets</h3>
                  <p className="text-sm text-red-600 mt-1">You have {stats.overdueAssets} {stats.overdueAssets === 1 ? 'asset' : 'assets'} past the return date. Please return immediately.</p>
                  <Link to="/my-bookings" className="text-sm font-bold text-red-700 hover:text-red-800 mt-2 inline-flex items-center">
                    View My Bookings <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </div>
              </div>
            )}
            
            {stats.incomingTransfers > 0 && (
              <div className="bg-slate-800/50 border border-amber-500/30 rounded-xl p-5 flex items-start gap-4 shadow-lg backdrop-blur-sm">
                <div className="bg-amber-500/20 p-2 rounded-full text-amber-400 border border-amber-500/20">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-amber-400">Pending P2P Requests</h3>
                  <p className="text-sm text-slate-300 mt-1">Other users are waiting for your approval to transfer {stats.incomingTransfers} {stats.incomingTransfers === 1 ? 'asset' : 'assets'}.</p>
                  <Link to="/transfer-requests" className="text-sm font-bold text-amber-400 hover:text-amber-300 mt-2 inline-flex items-center transition-colors">
                    Review Requests <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recently Added to Catalog */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">New to Catalog</h2>
          <Link to="/catalog" className="text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center">
            View All <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {newestAssets.map((asset) => (
            <Link key={asset.id} to={`/catalog`} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-blue-200 transition-all flex flex-col h-full group">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-gradient-to-br from-indigo-50 to-blue-100 p-3 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{asset.asset_name}</h3>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{asset.category}</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2 mt-auto">{asset.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Current Holding Assets */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">Current Holding Assets</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {activeHoldings.length === 0 ? (
            <div className="p-8 text-center text-gray-500 flex flex-col items-center">
              <Package className="w-10 h-10 text-gray-300 mb-3" />
              <p>You don't currently hold any assets.</p>
              <Link to="/catalog" className="text-blue-600 font-bold hover:underline mt-2">Browse the catalog</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {activeHoldings.map((asset, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 flex flex-col">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                      <Package className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-gray-900 truncate">{asset.asset_name}</h3>
                  </div>
                  <div className="text-sm text-gray-600 flex justify-between mb-1">
                    <span>Quantity:</span>
                    <span className="font-semibold text-gray-900">{asset.requested_quantity}</span>
                  </div>
                  <div className="text-sm text-gray-600 flex justify-between">
                    <span>Return By:</span>
                    <span className={`font-semibold ${new Date(asset.end_date) < new Date() ? 'text-red-600' : 'text-gray-900'}`}>
                      {new Date(asset.end_date).toLocaleDateString()}
                    </span>
                  </div>
                  {new Date(asset.end_date) < new Date() && (
                    <div className="mt-3 text-xs font-bold text-red-600 bg-red-50 p-2 rounded text-center uppercase tracking-wider">
                      Overdue
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* At A Glance Stats */}
      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">At a Glance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Active Assets</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.activeAssets}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Pending Bookings</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.pendingBookings}</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Pending P2P Sent</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.pendingSentTransfers}</p>
            </div>
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
              <UserCheck className="w-6 h-6" />
            </div>
          </div>

        </div>
      </div>





    </div>
  );
};

export default UserHome;
