import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { can } from '@/lib/ems';

// Renders children only if the current user has the required capability.
// Otherwise redirects to the dashboard (or a custom fallback).
export default function RoleGuard({ cap, children, fallback = '/' }) {
  const { user } = useAuth();
  if (!can(user, cap)) return <Navigate to={fallback} replace />;
  return children;
}