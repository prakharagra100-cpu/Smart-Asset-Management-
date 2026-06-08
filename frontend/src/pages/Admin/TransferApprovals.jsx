import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';

const TransferApprovals = () => {
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const response = await axiosClient.get('/api/transfers/admin-pending');
      setRequests(response.data);
    } catch (err) {
      setError('Failed to fetch transfer approvals.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleRespond = async (transferId, approve) => {
    try {
      await axiosClient.put(`/api/transfers/${transferId}/admin-respond?approve=${approve}`);
      fetchRequests();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to process approval.');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">P2P Transfer Approvals</h1>
      <p className="text-slate-400">Review user-consented peer-to-peer asset transfers.</p>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded">{error}</div>}

      <div className="bg-slate-800/60 backdrop-blur-md rounded-xl shadow-lg border border-slate-700/50 overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center text-slate-500">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="p-6 text-center text-slate-500">No pending admin approvals.</div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {requests.map(req => (
              <div key={req.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-700/30 transition-colors">
                <div>
                  <h3 className="text-lg font-bold text-white">{req.asset_name}</h3>
                  <div className="flex items-center space-x-2 text-sm mt-2">
                    <span className="bg-slate-700/50 border border-slate-600/50 px-2 py-1 rounded text-slate-300">From: <strong className="text-white">{req.holder_name}</strong></span>
                    <span className="text-slate-500">→</span>
                    <span className="bg-blue-500/20 border border-blue-500/30 px-2 py-1 rounded text-blue-400">To: <strong className="text-white">{req.requester_name}</strong></span>
                  </div>
                  <div className="mt-2 text-sm text-slate-300 bg-slate-800/80 p-2 rounded border border-slate-700/50 inline-block">
                    The holder has agreed to transfer <strong className="text-blue-400">{req.approved_quantity || req.requested_quantity}</strong> unit(s) 
                    <span className="text-slate-500 ml-2">(Original request: {req.requested_quantity})</span>
                  </div>
                  <div className="mt-3 bg-slate-800/50 p-3 rounded-lg text-sm text-slate-300 border border-slate-700/50 break-words whitespace-pre-wrap">
                    <span className="font-semibold block mb-1 text-slate-400">Requester's Reason:</span>
                    {req.reason}
                  </div>
                </div>
                <div className="flex space-x-3 shrink-0">
                  <button 
                    onClick={() => handleRespond(req.id, false)}
                    className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded transition"
                  >
                    Reject
                  </button>
                  <button 
                    onClick={() => handleRespond(req.id, true)}
                    className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded transition"
                  >
                    Authorize Transfer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransferApprovals;
