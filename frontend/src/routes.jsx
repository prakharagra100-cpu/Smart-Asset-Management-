import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/Layout/MainLayout';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AssetList from './pages/Admin/AssetList';
import AssetForm from './pages/Admin/AssetForm';
import Catalog from './pages/User/Catalog';
import UserHome from './pages/User/UserHome';
import MyBookings from './pages/User/MyBookings';
import TransferRequests from './pages/User/TransferRequests';
import BookingRequests from './pages/Admin/BookingRequests';
import AllBookingHistory from './pages/Admin/AllBookingHistory';
import TransferApprovals from './pages/Admin/TransferApprovals';

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      {/* Protected Routes inside Layout */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          {/* User Routes */}
          <Route path="/dashboard" element={<UserHome />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/my-bookings" element={<MyBookings />} />
          <Route path="/transfer-requests" element={<TransferRequests />} />
          
          {/* Admin specific routes */}
          <Route element={<ProtectedRoute requireAdmin={true} />}>
            <Route path="/admin-dashboard" element={<Dashboard />} />
            <Route path="/admin/assets" element={<AssetList />} />
            <Route path="/admin/assets/new" element={<AssetForm />} />
            <Route path="/admin/assets/:id/edit" element={<AssetForm />} />
            <Route path="/admin/bookings" element={<BookingRequests />} />
            <Route path="/admin/history" element={<AllBookingHistory />} />
            <Route path="/admin/transfers" element={<TransferApprovals />} />
          </Route>
        </Route>
      </Route>
      
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default AppRoutes;
