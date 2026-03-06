/**
 * @license
 * SPDX-License-Identifier: Apache-2.0.
 */

import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Send from './pages/Send';
import Groups from './pages/Groups';
import Settings from './pages/Settings';
import Campaigns from './pages/Campaigns';
import Status from './pages/Status';
import QueueActivity from './pages/QueueActivity';
import Admin from './pages/Admin';
import LicenseGuard from './components/LicenseGuard';

export default function App() {
  return (
    <Router>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: '#334155',
            color: '#fff',
            border: '1px solid #475569',
          },
        }}
      />
      <Routes>
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={
          <LicenseGuard>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/send" element={<Send />} />
                <Route path="/campaigns" element={<Campaigns />} />
                <Route path="/groups" element={<Groups />} />
                <Route path="/status" element={<Status />} />
                <Route path="/queueactivity" element={<QueueActivity />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Layout>
          </LicenseGuard>
        } />
      </Routes>
    </Router>
  );
}
