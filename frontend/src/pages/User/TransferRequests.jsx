import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { Package, Clock, CheckCircle, XCircle, UserCheck } from 'lucide-react';

const TransferRequests = () => {
  const [requests, setRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [approvedQuantities, setApprovedQuantities] = useState({});

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const [incomingRes, sentRes] = await Promise.all([
        axiosClient.get('/api/transfers/my-requests'),
        axiosClient.get('/api/transfers/sent-requests')
      ]);
      setRequests(incomingRes.data);
      setSentRequests(sentRes.data);
    } catch (err) {
      setError('Failed to fetch transfer requests.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleRespond = async (transferId, accept, maxTransferable) => {
    try {
      let url = `/api/transfers/${transferId}/user-respond?accept=${accept}`;
      if (accept) {
        const qty = approvedQuantities[transferId] !== undefined ? approvedQuantities[transferId] : maxTransferable;
        if (qty === '' || isNaN(qty) || qty < 1) {
          setError('Please enter a valid quantity.');
          return;
        }
        url += `&approved_quantity=${qty}`;
      }
      await axiosClient.put(url);
      fetchRequests();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to respond to request.');
    }
  };

  const getStatusDisplay = (status, holderName = 'User 2') => {
    switch(status) {
      case 'Pending User Approval': return { text: `Pending approval by ${holderName}`, color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: <UserCheck className="w-4 h-4 mr-1.5" /> };
      case 'Pending Admin Approval': return { text: 'Pending approval by Admin', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: <Clock className="w-4 h-4 mr-1.5" /> };
      case 'Completed': return { text: 'Approved & Transferred', color: 'bg-green-100 text-green-800 border-green-200', icon: <CheckCircle className="w-4 h-4 mr-1.5" /> };
      case 'Rejected by User': return { text: 'Rejected by User', color: 'bg-red-100 text-red-800 border-red-200', icon: <XCircle className="w-4 h-4 mr-1.5" /> };
      case 'Rejected by Admin': return { text: 'Rejected by Admin', color: 'bg-red-100 text-red-800 border-red-200', icon: <XCircle className="w-4 h-4 mr-1.5" /> };
      case 'Rejected': return { text: 'Rejected', color: 'bg-red-100 text-red-800 border-red-200', icon: <XCircle className="w-4 h-4 mr-1.5" /> };
      default: return { text: status, color: 'bg-gray-100 text-gray-800 border-gray-200', icon: null };
    }
  };

  return (
    <div className="space-y-10 w-full max-w-full overflow-x-hidden pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Incoming Transfer Requests</h1>
        <p className="text-gray-600 mb-6">These users are requesting to take over assets you currently hold.</p>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-6 border border-red-100">{error}</div>}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden w-full max-w-full">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : requests.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center text-gray-500">
              <Package className="h-10 w-10 text-gray-300 mb-3" />
              No pending incoming transfer requests.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {requests.map(req => {
                const maxTransferable = req.requested_quantity; // Should be min(req.requested_quantity, held_quantity) but we only know requested here. The user knows what they hold.
                const selectedQty = approvedQuantities[req.id] !== undefined ? approvedQuantities[req.id] : req.requested_quantity;
                return (
                <div key={req.id} className="p-6 flex flex-col md:flex-row justify-between gap-6 hover:bg-slate-700/30 transition-colors w-full min-w-0">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 truncate">{req.asset_name}</h3>
                    <p className="text-sm text-gray-600 mt-1 truncate">Requested by: <span className="font-semibold text-gray-900">{req.requester_name}</span></p>
                    <p className="text-sm text-gray-600 mt-1 truncate">Quantity Requested: <span className="font-semibold text-blue-600">{req.requested_quantity} unit(s)</span></p>
                    <div className="mt-3 bg-white p-3 rounded-lg text-sm text-gray-600 border border-gray-100 break-words whitespace-pre-wrap">
                      <span className="font-semibold text-gray-700 block mb-1">Reason for request:</span>
                      {req.reason}
                    </div>
                  </div>
                  <div className="flex flex-col items-start md:items-end gap-3 shrink-0">
                    <div className="flex flex-col gap-1 w-full max-w-[200px]">
                      <label className="text-xs text-gray-500 font-bold uppercase tracking-wider">Approve Quantity</label>
                      <input 
                        type="number" 
                        min="1" 
                        max={maxTransferable} 
                        value={selectedQty}
                        onChange={(e) => setApprovedQuantities({...approvedQuantities, [req.id]: e.target.value === '' ? '' : parseInt(e.target.value)})}
                        className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>
                    <div className="flex gap-3 w-full">
                      <button 
                        onClick={() => handleRespond(req.id, false, maxTransferable)}
                        className="flex-1 px-4 py-2 border border-red-200 text-red-600 font-medium hover:bg-red-50 rounded-lg transition"
                      >
                        Decline
                      </button>
                      <button 
                        onClick={() => handleRespond(req.id, true, maxTransferable)}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-lg transition"
                      >
                        Accept
                      </button>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-10">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Sent Transfer Requests</h2>
        <p className="text-gray-600 mb-6">Track the status of P2P requests you have sent to other users.</p>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden w-full max-w-full">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : sentRequests.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center text-gray-500">
              <Package className="h-10 w-10 text-gray-300 mb-3" />
              You haven't sent any P2P transfer requests.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {sentRequests.map(req => {
                const statusInfo = getStatusDisplay(req.status, req.holder_name);
                return (
                  <div key={req.id} className="p-6 flex flex-col md:flex-row justify-between gap-6 hover:bg-slate-700/30 transition-colors w-full min-w-0">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 truncate">{req.asset_name}</h3>
                      <p className="text-sm text-gray-600 mt-1 truncate">Current Holder: <span className="font-semibold text-gray-900">{req.holder_name}</span></p>
                      <p className="text-sm text-gray-600 mt-1 truncate">Quantity Requested: <span className="font-semibold text-blue-600">{req.requested_quantity} unit(s)</span></p>
                      <div className="mt-3 bg-white p-3 rounded-lg text-sm text-gray-600 border border-gray-100 break-words whitespace-pre-wrap">
                        <span className="font-semibold text-gray-700 block mb-1">Your reason:</span>
                        {req.reason}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-start md:items-end justify-center shrink-0 w-full md:w-64 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
                      <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Approval Stage</div>
                      <span className={`px-4 py-2 rounded-full text-xs font-bold flex items-center border ${statusInfo.color}`}>
                        {statusInfo.icon}
                        {statusInfo.text}
                      </span>
                      {req.status === 'Pending User Approval' && (
                        <p className="text-xs text-gray-500 mt-2 text-left md:text-right">Waiting for {req.holder_name} to accept.</p>
                      )}
                      {req.status === 'Pending Admin Approval' && (
                        <p className="text-xs text-gray-500 mt-2 text-left md:text-right">{req.holder_name} accepted! Waiting for admin final approval.</p>
                      )}
                      {req.status === 'Completed' && (
                        <p className="text-xs text-green-600 mt-2 text-left md:text-right">Asset is yours! View it in My Bookings.</p>
                      )}
                      {req.status === 'Rejected by User' && (
                        <p className="text-xs text-red-600 mt-2 text-left md:text-right">{req.holder_name} declined your transfer request.</p>
                      )}
                      {req.status === 'Rejected by Admin' && (
                        <p className="text-xs text-red-600 mt-2 text-left md:text-right">Admin denied the transfer request.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransferRequests;
