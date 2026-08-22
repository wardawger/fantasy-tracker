import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { LeagueProvider } from './context/LeagueContext';
import Dashboard from './components/Dashboard';
import Payments from './components/Payments';
import Payouts from './components/Payouts';

export default function App() {
  return (
    <LeagueProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
          <header className="bg-slate-800 border-b border-slate-700 p-4 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <h1 className="text-xl font-bold text-emerald-400">🏈 League Ledger</h1>
              <nav className="flex space-x-6 text-sm">
                <Link to="/" className="hover:text-emerald-400 transition">Dashboard</Link>
                <Link to="/payments" className="hover:text-emerald-400 transition">Payments</Link>
                <Link to="/payouts" className="hover:text-emerald-400 transition">Payout Ledger</Link>
              </nav>
            </div>
          </header>
          <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/payouts" element={<Payouts />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </LeagueProvider>
  );
}
