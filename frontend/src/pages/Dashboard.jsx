import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { Package, ClipboardList, AlertCircle, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const Dashboard = () => {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState({ total_assets: 0, pending_requests: 0, active_allocations: 0, overdue_returns: 0 });
  const [actionRequired, setActionRequired] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [overdueReturnsList, setOverdueReturnsList] = useState([]);
  
  // Analytics State
  const [utilizationData, setUtilizationData] = useState([]);
  const [trendsData, setTrendsData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [kpiRes, pendingRes, p2pRes, assetsRes, overdueRes, utilRes, trendRes, catRes] = await Promise.all([
          axiosClient.get('/api/analytics/kpis'),
          axiosClient.get('/api/bookings/?status=Pending&limit=5'),
          axiosClient.get('/api/transfers/admin-pending'),
          axiosClient.get('/api/assets/?limit=50'),
          axiosClient.get('/api/bookings/?status=Overdue&limit=8'),
          axiosClient.get('/api/analytics/utilization'),
          axiosClient.get('/api/analytics/trends'),
          axiosClient.get('/api/analytics/category-distribution')
        ]);
        
        setKpis(kpiRes.data);
        
        const combinedPending = [
          ...pendingRes.data.map(b => ({ ...b, type: 'booking' })),
          ...p2pRes.data.map(t => ({ ...t, type: 'p2p', user_name: t.requester_name }))
        ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
        
        setActionRequired(combinedPending);
        
        const criticalAssets = assetsRes.data.filter(a => a.status === 'Low Stock' || a.status === 'Unavailable' || a.max_deficit > 0).slice(0, 5);
        setLowStock(criticalAssets);
        
        setOverdueReturnsList(overdueRes.data);
        
        setUtilizationData(utilRes.data);
        setTrendsData(trendRes.data);
        setCategoryData(catRes.data);
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  if (isLoading) return <div className="p-8 text-center text-slate-500">Loading Operational Dashboard...</div>;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Analytics Dashboard</h1>
          <p className="text-slate-400 mt-1">Real-time insights into asset utilization and platform operations.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-800/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-slate-700/50 flex items-center space-x-5 hover:bg-slate-800/80 transition-colors">
          <div className="p-4 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/20 shadow-inner"><Package className="h-7 w-7" /></div>
          <div>
            <p className="text-sm text-slate-400 font-medium uppercase tracking-wider mb-1">Total Assets</p>
            <p className="text-3xl font-black text-white">{kpis.total_assets}</p>
          </div>
        </div>
        <div className="bg-slate-800/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-slate-700/50 flex items-center space-x-5 hover:bg-slate-800/80 transition-colors">
          <div className="p-4 bg-yellow-500/20 text-yellow-400 rounded-xl border border-yellow-500/20 shadow-inner"><ClipboardList className="h-7 w-7" /></div>
          <div>
            <p className="text-sm text-slate-400 font-medium uppercase tracking-wider mb-1">Pending Requests</p>
            <p className="text-3xl font-black text-white">{kpis.pending_requests}</p>
          </div>
        </div>
        <div className="bg-slate-800/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-slate-700/50 flex items-center space-x-5 hover:bg-slate-800/80 transition-colors">
          <div className="p-4 bg-green-500/20 text-green-400 rounded-xl border border-green-500/20 shadow-inner"><TrendingUp className="h-7 w-7" /></div>
          <div>
            <p className="text-sm text-slate-400 font-medium uppercase tracking-wider mb-1">Active Allocations</p>
            <p className="text-3xl font-black text-white">{kpis.active_allocations}</p>
          </div>
        </div>
        <div className="bg-slate-800/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-slate-700/50 flex items-center space-x-5 hover:bg-slate-800/80 transition-colors">
          <div className="p-4 bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 shadow-inner"><AlertCircle className="h-7 w-7" /></div>
          <div>
            <p className="text-sm text-slate-400 font-medium uppercase tracking-wider mb-1">Overdue Returns</p>
            <p className="text-3xl font-black text-white">{kpis.overdue_returns}</p>
          </div>
        </div>
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Widget 1: Action Required */}
        <div className="bg-slate-800/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-slate-700/50 flex flex-col h-96">
          <div className="flex items-center justify-between gap-2 mb-4 pb-4 border-b border-slate-700/50 shrink-0">
            <h2 className="text-lg font-bold text-white flex items-center min-w-0">
              <ClipboardList className="h-5 w-5 mr-2 text-yellow-500 shrink-0" />
              <span className="truncate">Action Required</span>
            </h2>
            <Link to="/admin/bookings" className="text-sm text-blue-400 hover:text-blue-300 flex items-center shrink-0 whitespace-nowrap font-medium">
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {actionRequired.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No pending requests.</p>
            ) : (
              <ul className="space-y-3">
                {actionRequired.map(req => (
                  <li 
                    key={req.id || req._id} 
                    onClick={() => req.type === 'p2p' ? navigate('/admin/transfers') : navigate('/admin/bookings')}
                    className="p-3 bg-slate-700/30 rounded-xl border border-slate-600/30 text-sm hover:bg-slate-700/50 transition-colors cursor-pointer"
                  >
                    <div className="font-bold text-white truncate flex items-center gap-2">
                      {req.user_name}
                      {req.type === 'p2p' && <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-black uppercase tracking-wider border border-purple-500/20">P2P</span>}
                    </div>
                    <div className="text-slate-400 truncate mt-1">Requested <span className="font-semibold text-slate-300">{req.asset_name}</span></div>
                    <div className="text-xs text-slate-500 mt-2 font-medium">{new Date(req.created_at).toLocaleDateString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Widget 2: Low Stock Alerts */}
        <div className="bg-slate-800/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-slate-700/50 flex flex-col h-96">
          <div className="flex items-center justify-between gap-2 mb-4 pb-4 border-b border-slate-700/50 shrink-0">
            <h2 className="text-lg font-bold text-white flex items-center min-w-0">
              <AlertTriangle className="h-5 w-5 mr-2 text-red-500 shrink-0" />
              <span className="truncate">Low Inventory</span>
            </h2>
            <Link to="/admin/assets" className="text-sm text-blue-400 hover:text-blue-300 flex items-center shrink-0 whitespace-nowrap font-medium">
              Inventory <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {lowStock.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">All assets are well stocked.</p>
            ) : (
              <ul className="space-y-3">
                {lowStock.map(asset => (
                  <li key={asset.id || asset._id} className="p-3 bg-slate-700/30 rounded-xl border border-slate-600/30 flex justify-between items-center text-sm gap-2 hover:bg-slate-700/50 transition-colors">
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate">{asset.asset_name}</div>
                      <div className="text-xs text-slate-400 mt-1 truncate">{asset.category}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {asset.max_deficit > 0 ? (
                        <span className="px-2 py-1 text-[10px] font-bold tracking-wider rounded border shrink-0 bg-purple-500/10 text-purple-400 border-purple-500/20 max-w-[200px] text-center leading-tight">
                          {asset.max_deficit} units deficit from {new Date(asset.deficit_start).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})} to {new Date(asset.deficit_end).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'})}
                        </span>
                      ) : (
                        <span className={`px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded border shrink-0 ${asset.status === 'Unavailable' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                          {asset.status}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Widget 3: Overdue Returns */}
        <div className="bg-slate-800/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-slate-700/50 flex flex-col h-96">
          <div className="flex items-center justify-between gap-2 mb-4 pb-4 border-b border-slate-700/50 shrink-0">
            <h2 className="text-lg font-bold text-white flex items-center min-w-0">
              <AlertCircle className="h-5 w-5 mr-2 text-red-500 shrink-0" />
              <span className="truncate">Overdue Returns</span>
            </h2>
            <Link to="/admin/bookings" className="text-sm text-blue-400 hover:text-blue-300 flex items-center shrink-0 whitespace-nowrap font-medium">
              View All <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {overdueReturnsList.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No overdue returns right now.</p>
            ) : (
              <div className="space-y-3">
                {overdueReturnsList.map(act => (
                  <div key={act.id || act._id} className="flex items-start space-x-3 p-3 bg-slate-700/30 rounded-xl border border-slate-600/30 hover:bg-slate-700/50 transition-colors">
                    <div className="mt-0.5 p-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 shrink-0 shadow-inner">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm leading-tight mt-0.5">
                        <span className="font-bold text-white">{act.user_name}</span>
                        <span className="text-slate-400"> holds </span>
                        <span className="font-semibold text-slate-300">{act.asset_name}</span>
                      </div>
                      <div className="text-xs font-bold text-red-400 mt-2 flex items-center">
                        <Clock className="w-3 h-3 mr-1" /> Due: {new Date(act.end_date + (act.end_date.endsWith('Z') ? '' : 'Z')).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts Section */}
      <h2 className="text-2xl font-bold text-white mt-10 mb-6 flex items-center border-b border-slate-700/50 pb-4">
        <TrendingUp className="mr-3 text-blue-400" /> Advanced Analytics
      </h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Bar Chart - Asset Utilization */}
        <div className="bg-slate-800/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-slate-700/50">
          <h3 className="text-lg font-bold text-white mb-6">Most Frequently Utilized Assets</h3>
          <div className="h-96 w-full">
            {utilizationData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={utilizationData} margin={{ top: 5, right: 30, left: 0, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    tick={{fill: '#94a3b8', fontSize: 12}} 
                    angle={-45} 
                    textAnchor="end" 
                    height={80} 
                    interval={0} 
                    tickFormatter={(value) => value.length > 15 ? `${value.substring(0, 15)}...` : value}
                  />
                  <YAxis stroke="#94a3b8" tick={{fill: '#94a3b8', fontSize: 12}} allowDecimals={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '0.75rem', color: '#fff' }}
                    itemStyle={{ color: '#60a5fa' }}
                    wrapperStyle={{ zIndex: 1000 }}
                    cursor={{fill: '#334155', opacity: 0.4}}
                  />
                  <Bar dataKey="requests" name="Total Requests" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">Not enough data to display chart.</div>
            )}
          </div>
        </div>

        {/* Chart 2: Pie Chart - Category Distribution */}
        <div className="bg-slate-800/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-slate-700/50">
          <h3 className="text-lg font-bold text-white mb-6">Asset Category Distribution</h3>
          <div className="h-96 w-full">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={90}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: '#334155', borderRadius: '0.75rem', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    wrapperStyle={{ zIndex: 1000 }}
                    position={{ x: 10, y: 10 }}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">Not enough data to display chart.</div>
            )}
          </div>
        </div>
        
        {/* Chart 3: Line Graph - Booking Trends */}
        <div className="bg-slate-800/60 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-slate-700/50 lg:col-span-2">
          <h3 className="text-lg font-bold text-white mb-6">Booking Trends (Last 30 Days)</h3>
          <div className="h-80 w-full">
            {trendsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendsData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="date" stroke="#94a3b8" tick={{fill: '#94a3b8', fontSize: 12}} />
                  <YAxis stroke="#94a3b8" tick={{fill: '#94a3b8', fontSize: 12}} allowDecimals={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '0.75rem', color: '#fff' }}
                    itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                    wrapperStyle={{ zIndex: 1000 }}
                  />
                  <Line type="monotone" dataKey="bookings" name="New Bookings" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">Not enough data to display chart.</div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default Dashboard;
