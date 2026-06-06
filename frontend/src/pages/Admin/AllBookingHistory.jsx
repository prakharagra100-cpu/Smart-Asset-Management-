import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import { Clock, CheckCircle, Package, ArrowRight, AlertTriangle, User, Calendar, FileText, ChevronDown, ChevronUp, Trash2, PlusCircle, Search } from 'lucide-react';

const AllBookingHistory = () => {
  const [bookings, setBookings] = useState([]);
  const [systemEvents, setSystemEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState({});
  const [searchUser, setSearchUser] = useState('');
  const [searchAsset, setSearchAsset] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bookingsRes, eventsRes] = await Promise.all([
          axiosClient.get('/api/bookings/'),
          axiosClient.get('/api/audit/system-events')
        ]);
        setBookings(bookingsRes.data);
        setSystemEvents(eventsRes.data);
      } catch (err) {
        console.error("Failed to load history", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleExpand = (id) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

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

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    // The backend uses naive UTC datetimes, we must append 'Z' to ensure the browser converts to local timezone
    let dStr = dateString;
    if (!dStr.endsWith('Z')) dStr += 'Z';
    
    return new Date(dStr).toLocaleString(undefined, { 
      year: 'numeric', month: 'short', day: 'numeric', 
      hour: '2-digit', minute: '2-digit'
    });
  };

  const filteredItems = [
    ...bookings.filter(b => !b.is_p2p_child).map(b => ({ ...b, itemType: 'booking' })),
    ...systemEvents.map(e => ({ ...e, itemType: 'system_event' }))
  ].filter(item => {
    let matchUser = true;
    let matchAsset = true;
    const sUser = searchUser.toLowerCase();
    const sAsset = searchAsset.toLowerCase();

    if (sUser) {
      if (item.itemType === 'booking') {
        // Check main user, or any user involved in a transfer
        const mainUserMatch = item.user_name?.toLowerCase().includes(sUser);
        const transferMatch = item.transfers?.some(t => 
          t.from_user_name?.toLowerCase().includes(sUser) || 
          t.to_user_name?.toLowerCase().includes(sUser)
        );
        matchUser = mainUserMatch || transferMatch;
      } else {
        matchUser = item.actor_username?.toLowerCase().includes(sUser);
      }
    }

    if (sAsset) {
      if (item.itemType === 'booking') {
        matchAsset = item.asset_name?.toLowerCase().includes(sAsset);
      } else {
        matchAsset = item.target_name?.toLowerCase().includes(sAsset);
      }
    }

    let matchDate = true;
    const itemDate = new Date(item.updated_at || item.created_at);
    if (fromDate) {
      matchDate = matchDate && itemDate >= new Date(fromDate);
    }
    if (toDate) {
      matchDate = matchDate && itemDate <= new Date(toDate);
    }

    return matchUser && matchAsset && matchDate;
  }).sort((a, b) => {
    const getLatestDate = (item) => {
      let maxDate = new Date(item.updated_at || item.created_at).getTime();
      if (item.transfers) {
        item.transfers.forEach(t => {
          const tDate = new Date(t.updated_at || t.created_at).getTime();
          if (tDate > maxDate) maxDate = tDate;
        });
      }
      return maxDate;
    };
    return getLatestDate(b) - getLatestDate(a);
  });

  const maxDateTime = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Master Audit Log</h1>
          <p className="text-gray-500 mt-1">Complete lifecycle timelines of every asset booking, transfer, and system event.</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Search User</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Filter by username..."
              className="pl-10 block w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 px-3 border"
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Search Asset</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Package className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Filter by asset name..."
              className="pl-10 block w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 px-3 border"
              value={searchAsset}
              onChange={(e) => setSearchAsset(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">From</label>
          <input
            type="datetime-local"
            className="block w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 px-3 border text-gray-700"
            value={fromDate}
            max={toDate || maxDateTime}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">To</label>
          <input
            type="datetime-local"
            className="block w-full border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-2 px-3 border text-gray-700"
            value={toDate}
            min={fromDate}
            max={maxDateTime}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading master audit log...</div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
          <FileText className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          No audit history matching your filters.
        </div>
      ) : (
        <div className="space-y-6">
          {filteredItems.map((item) => {
            if (item.itemType === 'booking') {
              const booking = item;
              const id = booking._id || booking.id;
              const isExpanded = expandedCards[id];
              
              return (
                <div key={`booking-${id}`} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-md">
                  {/* Card Header (Always Visible) */}
                  <div 
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between cursor-pointer select-none gap-4"
                    onClick={() => toggleExpand(id)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="bg-blue-50 p-3 rounded-lg text-blue-600 shrink-0">
                        <Package className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">{booking.asset_name}</h2>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
                          <span className="flex items-center gap-1"><User className="w-4 h-4" /> Original Requester: <strong>{booking.user_name}</strong></span>
                          <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> Scheduled: {formatDate(booking.start_date)}</span>
                          <span className="text-xs text-gray-400 font-mono">ID: {id.substring(0, 8)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 self-start md:self-center">
                      <div className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </div>
                      <div className="text-gray-400">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Timeline View */}
                  {isExpanded && (() => {
                    const timelineEvents = [];

                    // 1. Request Submitted
                    timelineEvents.push({
                      type: 'submitted',
                      date: new Date(booking.created_at).getTime(),
                      render: () => (
                        <div className="relative pl-6">
                          <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-blue-500 ring-4 ring-gray-50"></div>
                          <div className="text-sm font-bold text-gray-900">Request Submitted</div>
                          <div className="text-xs text-gray-500 mt-0.5">{formatDate(booking.created_at)}</div>
                          <div className="mt-2 text-sm text-gray-700 bg-white p-3 rounded shadow-sm border border-gray-200 inline-block">
                            <strong>{booking.user_name}</strong> requested {booking.original_requested_quantity || booking.requested_quantity} unit(s) to Admin [Direct Booking].
                            {booking.reason && <p className="italic text-gray-500 mt-1">"{booking.reason}"</p>}
                          </div>
                        </div>
                      )
                    });

                    // 2. Request Approved
                    if (booking.approved_at) {
                      timelineEvents.push({
                        type: 'approved',
                        date: new Date(booking.approved_at).getTime(),
                        render: () => (
                          <div className="relative pl-6">
                            <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-teal-500 ring-4 ring-gray-50"></div>
                            <div className="text-sm font-bold text-gray-900">Request Approved</div>
                            <div className="mt-1 text-sm text-gray-600">
                              admin approved <strong>{booking.initial_approved_quantity || booking.approved_quantity || booking.requested_quantity}</strong> out of {booking.original_requested_quantity || booking.requested_quantity} unit(s) on {formatDate(booking.approved_at)}
                            </div>
                          </div>
                        )
                      });
                    }

                    // P2P Transfers
                    if (booking.transfers) {
                      booking.transfers.forEach((t) => {
                        // Push the entire P2P transfer block as ONE event based on its creation date
                        timelineEvents.push({
                          type: 'transfer_block',
                          date: new Date(t.created_at).getTime(),
                          transfer: t, // Keep a reference to update running quantity later
                          render: () => (
                            <div className="relative pl-6">
                              <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full ring-4 ring-gray-50 ${t.status === 'Completed' ? 'bg-purple-500' : 'bg-gray-400'}`}></div>
                              <div className="text-sm font-bold text-gray-900 mb-3">P2P Transfer</div>
                              
                              <div className="relative border-l-2 border-purple-200 ml-2 space-y-6 pb-6">
                                <div className="relative pl-6 mt-2">
                                  <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-purple-300 ring-4 ring-gray-50"></div>
                                  <div className="text-sm font-bold text-gray-800">Transfer Requested</div>
                                  <div className="mt-1 text-sm text-gray-600">
                                    <strong>{t.to_user_name}</strong> requested <strong>{t.requested_quantity}</strong> unit(s) from <strong>{t.from_user_name}</strong> on {formatDate(t.created_at)}
                                  </div>
                                </div>

                                {t.user_approved_at && (
                                  <div className="relative pl-6">
                                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-purple-400 ring-4 ring-gray-50"></div>
                                    <div className="text-sm font-bold text-gray-800">User Approved</div>
                                    <div className="mt-1 text-sm text-gray-600">
                                      <strong>{t.from_user_name}</strong> approved <strong>{t.approved_quantity || t.requested_quantity}</strong> out of {t.requested_quantity} unit(s) on {formatDate(t.user_approved_at)}
                                    </div>
                                  </div>
                                )}

                                {t.admin_approved_at && (
                                  <div className="relative pl-6">
                                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-purple-600 ring-4 ring-gray-50"></div>
                                    <div className="text-sm font-bold text-gray-800">Admin Approved</div>
                                    <div className="mt-1 text-sm text-gray-600">
                                      admin authorized the transfer of <strong>{t.approved_quantity || t.requested_quantity}</strong> unit(s) on {formatDate(t.admin_approved_at)}
                                    </div>
                                  </div>
                                )}

                                {t.status.includes('Rejected') && (
                                  <div className="relative pl-6">
                                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-red-500 ring-4 ring-gray-50"></div>
                                    <div className="text-sm font-bold text-red-600">Transfer Rejected</div>
                                    <div className="mt-1 text-sm text-red-500">
                                      status: {t.status} on {formatDate(t.updated_at)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        });

                        if (t.new_booking_issued_at) {
                          timelineEvents.push({
                            type: 'child_issued',
                            date: new Date(t.new_booking_issued_at).getTime(),
                            render: () => (
                              <div className="relative pl-6">
                                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-indigo-500 ring-4 ring-gray-50"></div>
                                <div className="text-sm font-bold text-gray-900">Asset Issued</div>
                                <div className="mt-1 text-sm text-gray-600"><strong>{t.approved_quantity || t.requested_quantity}</strong> unit(s) issued to <strong>{t.to_user_name}</strong> on {formatDate(t.new_booking_issued_at)}</div>
                              </div>
                            )
                          });
                        }

                        if (t.new_booking_returned_at) {
                          timelineEvents.push({
                            type: 'child_returned',
                            date: new Date(t.new_booking_returned_at).getTime(),
                            render: () => (
                              <div className="relative pl-6">
                                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-gray-500 ring-4 ring-gray-50"></div>
                                <div className="text-sm font-bold text-gray-900">Asset Returned</div>
                                <div className="mt-1 text-sm text-gray-600"><strong>{t.approved_quantity || t.requested_quantity}</strong> unit(s) returned by <strong>{t.to_user_name}</strong> on {formatDate(t.new_booking_returned_at)}</div>
                              </div>
                            )
                          });
                        }
                      });
                    }

                    // Sort the events chronologically!
                    timelineEvents.sort((a, b) => a.date - b.date);

                    let finalTimelineEvents = [];
                    let currentQuantity = booking.initial_approved_quantity || booking.approved_quantity || booking.requested_quantity;
                    
                    let issuedInserted = false;
                    let returnedInserted = false;

                    const issuedTime = booking.issued_at ? new Date(booking.issued_at).getTime() : Infinity;
                    const returnedTime = booking.returned_at ? new Date(booking.returned_at).getTime() : Infinity;

                    const insertIssued = (qty) => {
                      if (!issuedInserted && booking.issued_at) {
                        finalTimelineEvents.push({
                          type: 'issued',
                          date: issuedTime,
                          render: () => (
                            <div className="relative pl-6">
                              <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-indigo-500 ring-4 ring-gray-50"></div>
                              <div className="text-sm font-bold text-gray-900">Asset Issued</div>
                              <div className="mt-1 text-sm text-gray-600"><strong>{qty}</strong> unit(s) issued to <strong>{booking.user_name}</strong> on {formatDate(booking.issued_at)}</div>
                            </div>
                          )
                        });
                        issuedInserted = true;
                      }
                    };

                    const insertReturned = (qty) => {
                      if (!returnedInserted && booking.returned_at) {
                        finalTimelineEvents.push({
                          type: 'returned',
                          date: returnedTime,
                          render: () => (
                            <div className="relative pl-6">
                              <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-green-500 ring-4 ring-gray-50"></div>
                              <div className="text-sm font-bold text-gray-900">Asset Returned</div>
                              <div className="mt-1 text-sm text-gray-600"><strong>{qty}</strong> unit(s) returned by <strong>{booking.user_name}</strong> on {formatDate(booking.returned_at)}</div>
                            </div>
                          )
                        });
                        returnedInserted = true;
                      }
                    };

                    for (const ev of timelineEvents) {
                      // Inject issued or returned if their chronological time has arrived!
                      if (ev.date > issuedTime && !issuedInserted) insertIssued(currentQuantity);
                      if (ev.date > returnedTime && !returnedInserted) insertReturned(currentQuantity);
                      
                      finalTimelineEvents.push(ev);
                      
                      // If it's a completed transfer, subtract the quantity for subsequent events
                      if (ev.type === 'transfer_block' && ev.transfer.status === 'Completed' && ev.transfer.admin_approved_at) {
                        currentQuantity -= (ev.transfer.approved_quantity || ev.transfer.requested_quantity);
                      }
                    }

                    // Flush any remaining
                    if (!issuedInserted) insertIssued(currentQuantity);
                    if (!returnedInserted) insertReturned(currentQuantity);

                    // Add Rejected if exists
                    if (booking.status === 'Rejected') {
                      finalTimelineEvents.push({
                        type: 'rejected',
                        date: new Date(booking.updated_at).getTime(),
                        render: () => (
                          <div className="relative pl-6">
                            <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-red-500 ring-4 ring-gray-50"></div>
                            <div className="text-sm font-bold text-gray-900">Request Rejected</div>
                            <div className="text-xs text-gray-500 mt-0.5">{formatDate(booking.updated_at)}</div>
                            <div className="mt-1 text-sm text-red-600">Admin denied this booking request.</div>
                          </div>
                        )
                      });
                    }

                    return (
                      <div className="px-5 pb-6 pt-2 border-t border-gray-100 bg-gray-50">
                        <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                          <Clock className="w-4 h-4" /> Activity Timeline
                        </h3>
                        <div className="relative border-l-2 border-gray-200 ml-3 space-y-8">
                          {finalTimelineEvents.map((ev, idx) => (
                            <React.Fragment key={idx}>
                              {ev.render()}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            } else {
              // System Event Card
              const event = item;
              const isCreated = event.event_type === 'ASSET_CREATED';
              
              return (
                 <div key={`event-${event.id}`} className={`bg-white rounded-xl shadow-sm border ${isCreated ? 'border-green-200' : 'border-red-200'} p-5 flex flex-col md:flex-row items-start gap-4 transition-all duration-200 hover:shadow-md`}>
                    <div className={`p-3 rounded-lg shrink-0 ${isCreated ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {isCreated ? <PlusCircle className="w-6 h-6" /> : <Trash2 className="w-6 h-6" />}
                    </div>
                    <div className="flex-1 w-full">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <h2 className="text-lg font-bold text-gray-900">{isCreated ? 'Asset Added to Inventory' : 'Asset Permanently Deleted'}</h2>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isCreated ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {event.event_type}
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-600 mt-1.5">{event.description}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-gray-500 bg-gray-50 p-2 rounded border border-gray-100">
                        <span className="flex items-center gap-1"><User className="w-4 h-4" /> Admin: <strong className="text-gray-700">{event.admin_name}</strong></span>
                        <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {formatDate(event.created_at)}</span>
                        <span className="text-xs text-gray-400 font-mono ml-auto">Asset: {event.asset_name}</span>
                      </div>
                    </div>
                 </div>
              );
            }
          })}
        </div>
      )}
    </div>
  );
};

export default AllBookingHistory;
