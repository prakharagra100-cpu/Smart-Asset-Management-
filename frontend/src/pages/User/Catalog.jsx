import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useAuthStore } from '../../store/authStore';

const CATEGORIES = ["All Categories", "DSLR Cameras", "Studio Lighting Equipment", "Audio Systems", "Costumes", "Stage Props", "Recording Equipment", "Event Infrastructure"];

const Catalog = () => {
  const { user } = useAuthStore();
  const [assets, setAssets] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All Categories');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [dynamicAvailability, setDynamicAvailability] = useState(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  
  // Holders Modal State
  const [holdersModalOpen, setHoldersModalOpen] = useState(false);
  const [holdersAsset, setHoldersAsset] = useState(null);

  // Transfer request states
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferAsset, setTransferAsset] = useState(null);
  const [transferHolder, setTransferHolder] = useState(null);

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

  const [formData, setFormData] = useState({
    requested_quantity: 1,
    start_datetime: null,
    end_datetime: null,
    reason: ''
  });
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  useEffect(() => {
    const timer = setTimeout(() => fetchAssets(), 300);
    return () => clearTimeout(timer);
  }, [search, category]);

  useEffect(() => {
    const checkAvail = async () => {
      if (formData.start_datetime && formData.end_datetime && selectedAsset) {
        setCheckingAvailability(true);
        try {
          const res = await axiosClient.get(`/api/assets/${selectedAsset._id || selectedAsset.id}/availability`, {
            params: {
              start_date: formData.start_datetime.toISOString(),
              end_date: formData.end_datetime.toISOString()
            },
            timeout: 8000 // 8 second timeout to prevent infinite hangs
          });
          setDynamicAvailability(res.data);
          setFormData(prev => {
             if (prev.requested_quantity > res.data.available_quantity) {
                 return { ...prev, requested_quantity: res.data.available_quantity > 0 ? res.data.available_quantity : 1 };
             }
             return prev;
          });
        } catch (err) {
          console.error(err);
          setDynamicAvailability(null);
        } finally {
          setCheckingAvailability(false);
        }
      } else {
        setDynamicAvailability(null);
      }
    };
    
    const timer = setTimeout(() => {
      checkAvail();
    }, 500);
    
    return () => clearTimeout(timer);
  }, [formData.start_datetime, formData.end_datetime, selectedAsset]);

  const openModal = (asset) => {
    setSelectedAsset(asset);
    setFormData({ requested_quantity: 1, start_datetime: null, end_datetime: null, reason: '' });
    setBookingError('');
    setBookingSuccess(false);
    setDynamicAvailability(null);
    setModalOpen(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'requested_quantity') {
      const maxAllowed = transferHolder ? transferHolder.quantity : (dynamicAvailability ? dynamicAvailability.available_quantity : (selectedAsset ? selectedAsset.total_quantity : 1));
      let val = value === '' ? '' : parseInt(value);
      if (val !== '' && val > maxAllowed) val = maxAllowed;
      setFormData(prev => ({ ...prev, [name]: val }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBookingError('');
    setIsSubmitting(true);

    const maxAllowed = dynamicAvailability ? dynamicAvailability.available_quantity : selectedAsset.total_quantity;
    if (formData.requested_quantity > maxAllowed) {
      setBookingError(`Requested quantity (${formData.requested_quantity}) exceeds maximum available quantity (${maxAllowed}).`);
      setIsSubmitting(false);
      return;
    }

    try {
      await axiosClient.post('/api/bookings/', {
        asset_id: selectedAsset._id || selectedAsset.id,
        requested_quantity: formData.requested_quantity,
        start_date: formData.start_datetime.toISOString(),
        end_date: formData.end_datetime.toISOString(),
        reason: formData.reason
      });
      setBookingSuccess(true);
      setTimeout(() => {
        setModalOpen(false);
        fetchAssets(); // Refresh available quantity if applicable
      }, 2000);
    } catch (err) {
      setBookingError(err.response?.data?.detail || 'Failed to submit booking request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openHoldersModal = (asset) => {
    setHoldersAsset(asset);
    setHoldersModalOpen(true);
  };

  const openTransferModal = (asset, holder) => {
    setHoldersModalOpen(false); // Close holders modal if open
    setTransferAsset(asset);
    setTransferHolder(holder);
    setFormData({ requested_quantity: 1, start_datetime: null, end_datetime: null, reason: '' });
    setBookingError('');
    setBookingSuccess(false);
    setTransferModalOpen(true);
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    setBookingError('');
    
    try {
      await axiosClient.post('/api/transfers/', {
        asset_id: transferAsset._id || transferAsset.id,
        from_user_id: transferHolder.user_id,
        reason: formData.reason,
        original_booking_id: transferHolder.booking_id,
        requested_quantity: parseInt(formData.requested_quantity) || 1
      });
      setBookingSuccess(true);
      fetchAssets();
    } catch (err) {
      setBookingError(err.response?.data?.detail || 'Failed to send transfer request.');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Asset Catalog</h1>

      <div className="bg-white p-4 rounded shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search for an asset..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {error && <div className="text-red-600">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <p className="text-gray-500">Loading catalog...</p>
        ) : assets.length === 0 ? (
          <p className="text-gray-500">No assets found.</p>
        ) : assets.map(asset => (
          <div key={asset._id || asset.id} className="bg-white rounded shadow-sm border border-gray-100 p-5 flex flex-col">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900">{asset.asset_name}</h3>
              <p className="text-sm text-gray-500 mb-2">{asset.category}</p>
              <p className="text-sm text-gray-700 mb-4 break-words">{asset.description}</p>
              <div className="flex justify-between text-sm mb-4">
                <span className="text-gray-600">Total Units: <span className="font-bold">{asset.total_quantity}</span></span>
              </div>
              
              {asset.active_holders && asset.active_holders.length > 0 && (
                <div className="mt-4 pt-4 mb-4 border-t border-gray-100">
                  <button
                    onClick={() => openHoldersModal(asset)}
                    className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                  >
                    <span>View Current Holders</span>
                    <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-full text-xs font-bold text-gray-600">
                      {asset.active_holders.length}
                    </span>
                  </button>
                </div>
              )}
            </div>
            <button
              disabled={asset.total_quantity === 0}
              onClick={() => openModal(asset)}
              className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            >
              Request Asset
            </button>
          </div>
        ))}
      </div>

      {/* Booking Modal */}
      {modalOpen && selectedAsset && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-xl w-full">
            <h2 className="text-xl font-bold mb-4">Request {selectedAsset.asset_name}</h2>
            
            {bookingSuccess ? (
              <div className="bg-green-50 text-green-700 p-4 rounded text-center">
                Request submitted successfully!
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {bookingError && <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{bookingError}</div>}
                
                {checkingAvailability && <div className="text-sm text-blue-600 font-medium">Checking availability for selected dates...</div>}
                
                {dynamicAvailability && !checkingAvailability && (
                  <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 my-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-gray-700">Available for these dates:</span>
                      <span className={`text-sm font-bold ${dynamicAvailability.available_quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {dynamicAvailability.available_quantity} unit(s)
                      </span>
                    </div>
                    {dynamicAvailability.overlapping_pending_count > 0 && (
                      <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200 flex items-start gap-2">
                         <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                         <span>{dynamicAvailability.overlapping_pending_count} unit(s) of this asset have already been requested for overlapping dates.</span>
                      </div>
                    )}
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Quantity</label>
                  <input
                    type="number"
                    name="requested_quantity"
                    min="1"
                    max={dynamicAvailability ? dynamicAvailability.available_quantity : selectedAsset.total_quantity}
                    required
                    value={formData.requested_quantity}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Max available: {dynamicAvailability ? dynamicAvailability.available_quantity : selectedAsset.total_quantity}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Start Date & Time</label>
                    <DatePicker
                      selected={formData.start_datetime}
                      onChange={(date) => {
                        // If new start date is after current end date, push end date to match
                        setFormData(prev => ({ 
                          ...prev, 
                          start_datetime: date,
                          end_datetime: prev.end_datetime && date > prev.end_datetime ? date : prev.end_datetime
                        }));
                      }}
                      showTimeSelect
                      timeFormat="h:mm aa"
                      timeIntervals={15}
                      dateFormat="MMMM d, yyyy h:mm aa"
                      placeholderText="Select Start"
                      minDate={new Date()}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">End Date & Time</label>
                    <DatePicker
                      selected={formData.end_datetime}
                      onChange={(date) => setFormData(prev => ({ ...prev, end_datetime: date }))}
                      showTimeSelect
                      timeFormat="h:mm aa"
                      timeIntervals={15}
                      dateFormat="MMMM d, yyyy h:mm aa"
                      placeholderText="Select End"
                      minDate={formData.start_datetime || new Date()}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Reason for Request <span className="text-red-500">*</span></label>
                  <textarea
                    name="reason"
                    required
                    rows="2"
                    placeholder="Briefly explain why you need this asset..."
                    value={formData.reason}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  ></textarea>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                  <button 
                    type="submit" 
                    disabled={dynamicAvailability && dynamicAvailability.available_quantity === 0}
                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Submit Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Holders Modal */}
      {holdersModalOpen && holdersAsset && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Current Holders</h2>
              <button onClick={() => setHoldersModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="mb-4 text-sm text-gray-600">
              <span className="font-semibold text-gray-800">{holdersAsset.asset_name}</span> has {holdersAsset.active_holders.length} active {holdersAsset.active_holders.length === 1 ? 'holder' : 'holders'}.
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {holdersAsset.active_holders.map((holder, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row justify-between sm:items-center bg-gray-50 border border-gray-100 p-3 rounded-lg gap-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                      {holder.user_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-800 truncate" title={holder.user_name}>{holder.user_name}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">
                        {formatDate(holder.start_date)} - {formatDate(holder.end_date)}
                      </div>
                      <div className="text-xs text-gray-500 font-medium mt-0.5">{holder.quantity} {holder.quantity === 1 ? 'unit' : 'units'}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                      holder.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {holder.status}
                    </span>
                    {holder.user_id !== user?.id && (
                      <button
                        onClick={() => openTransferModal(holdersAsset, holder)}
                        className="px-3 py-1.5 bg-white border border-gray-200 shadow-sm text-blue-600 rounded-md hover:bg-blue-50 text-xs font-bold transition-colors"
                        title="Request P2P Transfer"
                      >
                        P2P Request
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
              <button onClick={() => setHoldersModalOpen(false)} className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded font-medium transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Request Modal */}
      {transferModalOpen && transferAsset && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Request Transfer</h3>
            <p className="text-sm text-gray-600 mb-4">You are requesting to take over <strong>{transferAsset.asset_name}</strong> from <strong>{transferHolder.user_name}</strong>.</p>
            
            {bookingError && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{bookingError}</div>}
            
            {bookingSuccess ? (
              <div className="text-center py-4">
                <div className="text-green-500 mb-2">✔ Request Sent</div>
                <p className="text-gray-600 text-sm mb-4">The current holder has been notified. You will get the asset if they accept and the admin approves.</p>
                <button onClick={() => setTransferModalOpen(false)} className="bg-blue-600 text-white px-4 py-2 rounded w-full">Close</button>
              </div>
            ) : (
              <form onSubmit={handleTransferSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Quantity to Request <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    name="requested_quantity"
                    min="1"
                    max={transferHolder.quantity}
                    required
                    value={formData.requested_quantity}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum available to request from this user: {transferHolder.quantity}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Reason for Request <span className="text-red-500">*</span></label>
                  <textarea
                    name="reason"
                    required
                    rows="2"
                    placeholder="Briefly explain why you need this transferred to you..."
                    value={formData.reason}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  ></textarea>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button type="button" onClick={() => setTransferModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded">Send Request</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Catalog;
