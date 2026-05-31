import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { Plus, Edit2, Trash2, X, Users } from 'lucide-react';
const CATEGORIES = ["All Categories", "DSLR Cameras", "Studio Lighting Equipment", "Audio Systems", "Costumes", "Stage Props", "Recording Equipment", "Event Infrastructure"];

const AssetList = () => {
  const [assets, setAssets] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState(null);
  
  const [expandedAssetId, setExpandedAssetId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedAssetId(prev => prev === id ? null : id);
  };

  const fetchAssets = async () => {
    setIsLoading(true);
    try {
      let url = '/api/assets/?limit=50';
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (category && category !== "All Categories") url += `&category=${encodeURIComponent(category)}`;
      
      const response = await axiosClient.get(url);
      setAssets(response.data);
    } catch (err) {
      setError('Failed to fetch assets.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  useEffect(() => {
    // Debounce search slightly
    const timer = setTimeout(() => {
      fetchAssets();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, category]);

  const handleDeleteConfirm = async () => {
    if (!assetToDelete) return;
    try {
      await axiosClient.delete(`/api/assets/${assetToDelete._id || assetToDelete.id}`);
      setDeleteModalOpen(false);
      setAssetToDelete(null);
      fetchAssets();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete asset.');
      setDeleteModalOpen(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">Manage Inventory</h1>
          <p className="text-slate-400 mt-1">View, track, and manage all platform assets.</p>
        </div>
        <Link 
          to="/admin/assets/new" 
          className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-300 font-semibold"
        >
          <Plus className="h-5 w-5" />
          <span>Add New Asset</span>
        </Link>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-center shadow-lg shadow-red-500/5">
          {error}
        </div>
      )}

      {/* Main Glass Card */}
      <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
        
        {/* Filters Bar */}
        <div className="p-5 border-b border-slate-700/50 bg-slate-900/20 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search assets by name or description..."
              className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-inner"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all appearance-none cursor-pointer min-w-[200px] shadow-inner"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map(c => <option key={c} value={c} className="bg-slate-800 text-white">{c}</option>)}
          </select>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700/50">
            <thead className="bg-slate-900/40">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Asset Name</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Total</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50 bg-transparent">
              {isLoading ? (
                <tr><td colSpan="4" className="px-6 py-12 text-center text-slate-500 font-medium">Loading inventory...</td></tr>
              ) : assets.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center">
                      <div className="bg-slate-800/50 p-4 rounded-full mb-3">
                        <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                      </div>
                      <p className="font-semibold text-lg text-slate-400">No assets found</p>
                      <p className="text-sm mt-1 text-slate-500">Try adjusting your search or category filters.</p>
                    </div>
                  </td>
                </tr>
              ) : assets.map((asset) => {
                const isExpanded = expandedAssetId === (asset._id || asset.id);
                const hasHolders = asset.active_holders && asset.active_holders.length > 0;
                return (
                  <React.Fragment key={asset._id || asset.id}>
                    <tr className={`hover:bg-slate-700/30 transition-colors ${isExpanded ? 'bg-slate-700/20' : ''}`}>
                      <td className="px-6 py-4">
                        <div 
                          className={`font-semibold ${hasHolders ? 'cursor-pointer text-blue-400 hover:text-blue-300 flex items-center group' : 'text-slate-200'}`}
                          onClick={() => hasHolders && toggleExpand(asset._id || asset.id)}
                          title={hasHolders ? "Click to view active holders" : ""}
                        >
                          {asset.asset_name}
                          {hasHolders && (
                            <span className="ml-3 px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-md text-xs font-bold group-hover:bg-blue-500/30 transition-colors">
                              {asset.active_holders.length} active
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">{asset.category}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-300">{asset.total_quantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-4">
                          {hasHolders && (
                            <button 
                              onClick={() => toggleExpand(asset._id || asset.id)}
                              className="text-slate-400 hover:text-blue-400 transition-colors p-1.5 hover:bg-slate-700/50 rounded-lg flex items-center gap-1"
                              title={isExpanded ? "Hide Holders" : "View Holders"}
                            >
                              <Users className="h-4 w-4" />
                            </button>
                          )}
                          <Link to={`/admin/assets/${asset._id || asset.id}/edit`} className="text-slate-400 hover:text-blue-400 transition-colors p-1.5 hover:bg-slate-700/50 rounded-lg" title="Edit Asset">
                            <Edit2 className="h-4 w-4" />
                          </Link>
                          <button 
                            onClick={() => { setAssetToDelete(asset); setDeleteModalOpen(true); }}
                            className="text-slate-400 hover:text-rose-400 transition-colors p-1.5 hover:bg-slate-700/50 rounded-lg" title="Delete Asset"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && hasHolders && (
                      <tr className="bg-slate-900/50">
                        <td colSpan="4" className="px-8 py-6">
                          <div className="bg-slate-800/60 rounded-xl border border-slate-700/50 p-5 shadow-inner backdrop-blur-md">
                            <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2">
                              <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                              Currently Issued To
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {asset.active_holders.map((holder, idx) => (
                                <div key={idx} className="flex items-center space-x-3 p-4 bg-slate-900/40 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-colors">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white truncate">{holder.user_name}</p>
                                    <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                                      {formatDate(holder.start_date)} - {formatDate(holder.end_date)}
                                    </div>
                                    <p className="text-xs font-medium text-slate-500 truncate mt-0.5">{holder.quantity} unit(s) held</p>
                                  </div>
                                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold border ${
                                    holder.status === 'Approved' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                  }`}>
                                    {holder.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Premium Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-rose-500/20 p-2 rounded-full">
                <Trash2 className="h-6 w-6 text-rose-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Confirm Deletion</h3>
            </div>
            <p className="text-slate-400 mb-8 leading-relaxed">
              Are you absolutely sure you want to permanently delete <strong className="text-white">"{assetToDelete?.asset_name}"</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteModalOpen(false)} 
                className="px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteConfirm} 
                className="px-5 py-2.5 text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-500/20 transition-colors"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetList;
