import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { Save, ArrowLeft } from 'lucide-react';

const CATEGORIES = ["DSLR Cameras", "Studio Lighting Equipment", "Audio Systems", "Costumes", "Stage Props", "Recording Equipment", "Event Infrastructure"];

const AssetForm = () => {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    asset_name: '',
    category: CATEGORIES[0],
    description: '',
    total_quantity: 1
  });
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isEditing) {
      fetchAsset();
    }
  }, [id]);

  const fetchAsset = async () => {
    try {
      const response = await axiosClient.get(`/api/assets/${id}`);
      const asset = response.data;
      setFormData({
        asset_name: asset.asset_name,
        category: asset.category,
        description: asset.description,
        total_quantity: asset.total_quantity
      });
    } catch (err) {
      setError('Failed to fetch asset details.');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'total_quantity' ? parseInt(value) || 0 : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (isEditing) {
        await axiosClient.put(`/api/assets/${id}`, formData);
      } else {
        await axiosClient.post('/api/assets/', formData);
      }
      navigate('/admin/assets');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save asset.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate('/admin/assets')} className="text-gray-500 hover:text-blue-600">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">{isEditing ? 'Edit Asset' : 'Add New Asset'}</h1>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded shadow-sm border border-gray-100 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Asset Name</label>
          <input
            type="text"
            name="asset_name"
            required
            value={formData.asset_name}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Category</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            name="description"
            rows={3}
            value={formData.description}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Total Quantity</label>
          <input
            type="number"
            name="total_quantity"
            min="1"
            required
            value={formData.total_quantity}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
          {isEditing && (
            <p className="text-xs text-gray-500 mt-1">Note: Decreasing quantity below active bookings will result in an error.</p>
          )}
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center items-center space-x-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{isLoading ? 'Saving...' : 'Save Asset'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default AssetForm;
