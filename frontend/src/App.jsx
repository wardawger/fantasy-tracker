import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { LeagueProvider } from './context/LeagueContext';
import Dashboard from './components/Dashboard';
import Payments from './components/Payments';
import Payouts from './components/Payouts';
import RedraftBonuses from './components/RedraftBonuses';

export default function App() {
  const [isOpen, setIsOpen] = useState(false);

  const closeMenu = () => setIsOpen(false);

  return (
    <LeagueProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
          <header className="bg-slate-800 border-b border-slate-700 p-4 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <h1 className="text-xl font-bold text-emerald-400">🏈 League Ledger</h1>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex space-x-6 text-sm font-semibold">
                <Link to="/" className="hover:text-emerald-400 transition">Dashboard</Link>
                <Link to="/payments" className="hover:text-emerald-400 transition">Payments</Link>
                <Link to="/payouts" className="hover:text-emerald-400 transition">Payout Ledger</Link>
                <Link to="/bonuses" className="hover:text-emerald-400 transition">Redraft Bonuses</Link>
              </nav>

              {/* Hamburger Button */}
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden text-slate-400 hover:text-emerald-400 transition focus:outline-none"
                aria-label="Toggle menu"
              >
                <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
                  {isOpen ? (
                    <path fillRule="evenodd" clipRule="evenodd" d="M18.278 16.864a1 1 0 0 1-1.414 1.414l-4.829-4.828-4.828 4.828a1 1 0 0 1-1.414-1.414l4.828-4.829-4.828-4.828a1 1 0 0 1 1.414-1.414l4.829 4.828 4.828-4.828a1 1 0 1 1 1.414 1.414l-4.828 4.828 4.828 4.829z" />
                  ) : (
                    <path fillRule="evenodd" d="M4 5h16a1 1 0 0 1 0 2H4a1 1 0 1 1 0-2zm0 6h16a1 1 0 0 1 0 2H4a1 1 0 0 1 0-2zm0 6h16a1 1 0 0 1 0 2H4a1 1 0 0 1 0-2z" />
                  )}
                </svg>
              </button>
            </div>

            {/* Mobile Navigation Dropdown */}
            {isOpen && (
              <nav className="md:hidden mt-4 pb-2 border-t border-slate-700 pt-4 flex flex-col space-y-3 font-semibold text-sm">
                <Link to="/" onClick={closeMenu} className="hover:text-emerald-400 transition px-2 py-1 rounded hover:bg-slate-700/50">Dashboard</Link>
                <Link to="/payments" onClick={closeMenu} className="hover:text-emerald-400 transition px-2 py-1 rounded hover:bg-slate-700/50">Payments</Link>
                <Link to="/payouts" onClick={closeMenu} className="hover:text-emerald-400 transition px-2 py-1 rounded hover:bg-slate-700/50">Payout Ledger</Link>
                <Link to="/bonuses" onClick={closeMenu} className="hover:text-emerald-400 transition px-2 py-1 rounded hover:bg-slate-700/50">Redraft Bonuses</Link>
              </nav>
            )}
          </header>
          <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/payouts" element={<Payouts />} />
              <Route path="/bonuses" element={<RedraftBonuses />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </LeagueProvider>
  );
}
