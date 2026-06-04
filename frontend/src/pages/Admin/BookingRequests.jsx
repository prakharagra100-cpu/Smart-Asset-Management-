import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { CheckCircle, XCircle, Package, ArrowLeftRight } from 'lucide-react';

const BookingRequests = () => {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState('Pending Approval');
  
  const [availabilities, setAvailabilities] = useState({});
  const [approvedQuantities, setApprovedQuantities] = useState({});

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const response = await axiosClient.get('/api/bookings/');
      setBookings(response.data);
    } catch (err) {
      setError('Failed to load bookings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  useEffect(() => {
    const fetchAvailabilities = async () => {
      const pendingBookings = bookings.filter(b => b.status === 'Pending');
      const newAvails = { ...availabilities };
      const newQuants = { ...approvedQuantities };
      
      await Promise.all(pendingBookings.map(async (b) => {
        const id = b._id || b.id;
        if (newAvails[id] === undefined) {
          try {
            const res = await axiosClient.get(`/api/assets/${b.asset_id}/availability?start_date=${b.start_date}&end_date=${b.end_date}`);
            newAvails[id] = res.data.available_quantity;
            // Default selection to max possible but no more than requested
            newQuants[id] = Math.min(b.requested_quantity, res.data.available_quantity) || 0;
          } catch (e) {
            console.error("Failed to fetch availability for", id);
          }
        }
      }));
      setAvailabilities(newAvails);
      setApprovedQuantities(newQuants);
    };
    
    if (bookings.length > 0) {
      fetchAvailabilities();
    }
  }, [bookings]);

  const handleAction = async (bookingId, action) => {
    try {
      let url = `/api/bookings/${bookingId}/${action}`;
      if (action === 'approve') {
        const qty = approvedQuantities[bookingId];
        if (qty > 0) {
          url += `?approved_quantity=${qty}`;
        }
      }
      await axiosClient.put(url);
      fetchBookings();
    } catch (err) {
      alert(err.response?.data?.detail || `Failed to ${action} booking.`);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Approved': return 'bg-green-100 text-green-800';
      case 'Issued': return 'bg-blue-100 text-blue-800';
      case 'Returned': return 'bg-gray-100 text-gray-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      case 'Overdue': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Filter out Returned and Rejected entirely as requested
  const activeBookings = bookings.filter(b => b.status !== 'Returned' && b.status !== 'Rejected');

  let displayedBookings = [];
  if (activeTab === 'Pending Approval') {
    displayedBookings = activeBookings.filter(b => b.status === 'Pending');
  } else if (activeTab === 'Pending Issue') {
    displayedBookings = activeBookings.filter(b => b.status === 'Approved');
  } else if (activeTab === 'Pending Return') {
    displayedBookings = activeBookings.filter(b => b.status === 'Issued' || b.status === 'Overdue');
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Booking Requests</h1>

      {/* Main Tabs */}
      <div className="border-b border-slate-700/50">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('Pending Approval')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'Pending Approval' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
            }`}
          >
            Pending Approval
          </button>
          <button
            onClick={() => setActiveTab('Pending Issue')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'Pending Issue' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
            }`}
          >
            Pending Issue
          </button>
          <button
            onClick={() => setActiveTab('Pending Return')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'Pending Return' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
            }`}
          >
            Pending Return
          </button>
        </nav>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded">{error}</div>}

      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-slate-800/60 backdrop-blur-md rounded-xl shadow-lg border border-slate-700/50 p-8 text-center text-slate-500">Loading requests...</div>
        ) : displayedBookings.length === 0 ? (
          <div className="bg-slate-800/60 backdrop-blur-md rounded-xl shadow-lg border border-slate-700/50 p-8 text-center text-slate-500">No booking requests found in this category.</div>
        ) : displayedBookings.map((booking) => (
          <div key={booking._id || booking.id} className="bg-slate-800/60 backdrop-blur-md rounded-xl shadow-lg border border-slate-700/50 p-5 flex flex-col md:flex-row gap-6 hover:bg-slate-700/30 transition-colors">
            
            {/* User & Asset Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-lg shrink-0 border border-blue-500/20">
                  {booking.user_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-white truncate">{booking.user_name}</h3>
                  <p className="text-sm text-slate-400 truncate">
                    {booking.status === 'Pending' || booking.status === 'Rejected' ? 'Requested' : 'Approved'} <span className="font-semibold text-slate-300">{booking.approved_quantity || booking.requested_quantity}x {booking.asset_name}</span>
                  </p>
                </div>
              </div>
              
              {booking.reason && (
                <div className="mt-3 ml-13 p-3 bg-slate-900/40 rounded-lg text-sm text-slate-300 border border-slate-700/50 break-words whitespace-pre-wrap">
                  <span className="font-semibold text-slate-400 block mb-1">Reason:</span>
                  {booking.reason}
                </div>
              )}
            </div>
            
            {/* Dates */}
            <div className="flex-1 flex flex-col justify-center gap-2 min-w-0">
              <div className="flex items-center gap-2 text-sm text-slate-400 min-w-0">
                <div className="w-10 font-medium text-slate-500 shrink-0">From:</div>
                <div className="bg-slate-900/40 px-2 py-1 rounded text-slate-300 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap flex-1 border border-slate-700/30">{formatDate(booking.start_date)}</div>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400 min-w-0">
                <div className="w-10 font-medium text-slate-500 shrink-0">To:</div>
                <div className="bg-slate-900/40 px-2 py-1 rounded text-slate-300 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap flex-1 border border-slate-700/30">{formatDate(booking.end_date)}</div>
              </div>
            </div>

            {/* Status & Actions */}
            <div className="flex flex-col items-end justify-center gap-3 border-t md:border-t-0 md:border-l border-slate-700/50 pt-4 md:pt-0 md:pl-6 shrink-0 w-full md:w-48">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(booking.status)}`}>
                {booking.status}
              </span>
              <div className="flex flex-col gap-2 w-full">
                {booking.status === 'Pending' && (() => {
                  const id = booking._id || booking.id;
                  const maxAvail = availabilities[id];
                  const isLoadingAvail = maxAvail === undefined;
                  const maxOptions = Math.min(booking.requested_quantity, maxAvail || 0);

                  return (
                    <>
                      {!isLoadingAvail && maxOptions > 0 && (
                        <div className="w-full flex flex-col gap-1 mb-1">
                          <div className="text-[10px] text-slate-400 text-center uppercase tracking-wider font-semibold">
                            Max Available: {maxAvail}
                          </div>
                          <div className="w-full flex items-center justify-between text-xs text-slate-300 bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                            <span>Approve Qty:</span>
                            <select 
                              value={approvedQuantities[id] || maxOptions}
                              onChange={(e) => setApprovedQuantities({...approvedQuantities, [id]: parseInt(e.target.value)})}
                              className="bg-slate-800 text-white text-xs border border-slate-600 rounded px-1 py-0.5 focus:outline-none focus:border-blue-500"
                            >
                              {Array.from({length: maxOptions}, (_, i) => i + 1).map(num => (
                                <option key={num} value={num}>{num}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                      {!isLoadingAvail && maxOptions === 0 && (
                        <div className="w-full mb-1 text-center text-xs text-red-400 font-bold bg-red-500/10 py-1.5 rounded-lg border border-red-500/20">
                          Out of Stock
                        </div>
                      )}
                      <button 
                        onClick={() => handleAction(id, 'approve')} 
                        disabled={isLoadingAvail || maxOptions === 0}
                        className={`w-full px-3 py-2 text-white rounded-lg transition flex items-center justify-center text-sm font-medium ${isLoadingAvail || maxOptions === 0 ? 'bg-green-600/30 text-green-100/50 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
                        title="Approve"
                      >
                        <CheckCircle className="h-4 w-4 mr-1.5" /> Approve
                      </button>
                      <button onClick={() => handleAction(id, 'reject')} className="w-full px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition flex items-center justify-center text-sm font-medium" title="Reject">
                        <XCircle className="h-4 w-4 mr-1.5" /> Reject
                      </button>
                    </>
                  );
                })()}
                {booking.status === 'Approved' && (() => {
                  const isPremature = new Date(booking.start_date) > new Date();
                  return (
                    <div className="w-full flex flex-col gap-1">
                      <button 
                        onClick={() => !isPremature && handleAction(booking._id || booking.id, 'issue')} 
                        disabled={isPremature}
                        className={`w-full px-3 py-2 text-white rounded-lg transition flex items-center justify-center text-sm font-medium ${isPremature ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`} 
                        title={isPremature ? "Cannot issue before start date" : "Issue Asset"}
                      >
                        <Package className="h-4 w-4 mr-1.5" /> Issue Asset
                      </button>
                      {isPremature && (
                        <span className="text-[10px] text-slate-500 text-center uppercase tracking-wider font-bold">
                          Available on {formatDate(booking.start_date)}
                        </span>
                      )}
                    </div>
                  );
                })()}
                {(booking.status === 'Issued' || booking.status === 'Overdue') && (
                  <button onClick={() => handleAction(booking._id || booking.id, 'return')} className="w-full px-3 py-2 bg-slate-700 text-white border border-slate-600 rounded-lg hover:bg-slate-600 transition flex items-center justify-center text-sm font-medium" title="Process Return">
                    <ArrowLeftRight className="h-4 w-4 mr-1.5" /> Return Asset
                  </button>
                )}
              </div>
            </div>
            
          </div>
        ))}
      </div>
    </div>
  );
};

export default BookingRequests;
