import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { Package, Calendar, Clock, AlertTriangle, CheckCircle, XCircle, History } from 'lucide-react';

const MyBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('Active'); // Active, Pending, History

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
    const fetchBookings = async () => {
      try {
        const response = await axiosClient.get('/api/bookings/my-bookings');
        setBookings(response.data);
      } catch (err) {
        setError('Failed to load your bookings.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchBookings();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'Issued': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Returned': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'Rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'Overdue': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Pending': return <Clock className="h-4 w-4 mr-1.5" />;
      case 'Approved': return <CheckCircle className="h-4 w-4 mr-1.5" />;
      case 'Issued': return <Package className="h-4 w-4 mr-1.5" />;
      case 'Returned': return <History className="h-4 w-4 mr-1.5" />;
      case 'Rejected': return <XCircle className="h-4 w-4 mr-1.5" />;
      case 'Overdue': return <AlertTriangle className="h-4 w-4 mr-1.5" />;
      default: return null;
    }
  };

  let displayedBookings = [];
  if (activeTab === 'Active') {
    displayedBookings = bookings.filter(b => ['Approved', 'Issued', 'Overdue'].includes(b.status));
  } else if (activeTab === 'Pending') {
    displayedBookings = bookings.filter(b => b.status === 'Pending');
  } else if (activeTab === 'History') {
    displayedBookings = bookings.filter(b => ['Returned', 'Rejected'].includes(b.status));
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">My Bookings</h1>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-100">{error}</div>}

      <div className="border-b border-gray-200 w-full">
        <nav className="-mb-px flex space-x-8 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('Active')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'Active' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Active & Pending Return
          </button>
          <button
            onClick={() => setActiveTab('Pending')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'Pending' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Pending Approval
          </button>
          <button
            onClick={() => setActiveTab('History')}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'History' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            History (Returned/Rejected)
          </button>
        </nav>
      </div>

      <div className="space-y-4 mt-6 w-full max-w-full">
        {isLoading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500 w-full">
            <div className="animate-pulse flex flex-col items-center">
              <div className="h-8 w-8 bg-gray-200 rounded-full mb-4"></div>
              <div>Loading your bookings...</div>
            </div>
          </div>
        ) : displayedBookings.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center flex flex-col items-center justify-center w-full">
            <Package className="h-12 w-12 text-gray-300 mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No {activeTab.toLowerCase()} bookings</h3>
            <p className="text-gray-500 mt-1">You don't have any requests in this category right now.</p>
          </div>
        ) : (
          displayedBookings.map((booking) => (
            <div key={booking._id || booking.id} className="w-full max-w-full overflow-hidden bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-5 flex flex-col md:flex-row gap-4 md:gap-6 hover:shadow-md transition-shadow">
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-4 mb-3">
                  <div className="h-12 w-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
                    <Package className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold text-gray-900 truncate">{booking.asset_name}</h3>
                    <p className="text-sm text-gray-500 font-medium truncate">Quantity requested: <span className="text-gray-800">{booking.requested_quantity}</span></p>
                  </div>
                </div>
                
                {booking.reason && (
                  <div className="mt-2 md:ml-16 p-3 bg-gray-50 rounded-lg text-sm text-gray-600 border border-gray-100 break-words whitespace-pre-wrap">
                    <span className="font-semibold text-gray-700 block mb-1">Reason:</span>
                    {booking.reason}
                  </div>
                )}
              </div>
              
              <div className="flex-1 flex flex-col justify-center gap-3 min-w-0">
                <div className="flex items-center gap-3 text-sm text-gray-600 min-w-0">
                  <div className="w-10 font-medium text-gray-800 shrink-0">From:</div>
                  <div className="bg-gray-50 px-3 py-1.5 rounded-md border border-gray-100 text-gray-700 flex items-center shadow-sm min-w-0 overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                    <Calendar className="h-3.5 w-3.5 mr-2 text-gray-400 shrink-0" />
                    <span className="truncate">{formatDate(booking.start_date)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600 min-w-0">
                  <div className="w-10 font-medium text-gray-800 shrink-0">To:</div>
                  <div className="bg-gray-50 px-3 py-1.5 rounded-md border border-gray-100 text-gray-700 flex items-center shadow-sm min-w-0 overflow-hidden text-ellipsis whitespace-nowrap flex-1">
                    <Calendar className="h-3.5 w-3.5 mr-2 text-gray-400 shrink-0" />
                    <span className="truncate">{formatDate(booking.end_date)}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end justify-center border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6 shrink-0 w-full md:w-48">
                <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">Current Status</div>
                <span className={`px-4 py-2 rounded-full text-xs font-bold flex items-center border whitespace-nowrap ${getStatusColor(booking.status)}`}>
                  {getStatusIcon(booking.status)}
                  {booking.status}
                </span>
                {booking.status === 'Overdue' && (
                  <p className="text-xs text-red-500 mt-3 font-medium text-right break-words w-full">Please return this asset immediately.</p>
                )}
              </div>
              
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MyBookings;
