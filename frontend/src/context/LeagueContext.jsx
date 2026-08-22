import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const LeagueContext = createContext();

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:20129';

export const LeagueProvider = ({ children }) => {
  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshData = async () => {
    setLoading(true);
    try {
      await axios.get(`${API_BASE}/api/sync-members`);
      const memRes = await axios.get(`${API_BASE}/api/members`);
      const payRes = await axios.get(`${API_BASE}/api/payments`);
      const weekRes = await axios.get(`${API_BASE}/api/weekly`);
      setMembers(memRes.data);
      setPayments(payRes.data);
      setWeekly(weekRes.data);
    } catch (err) {
      console.error("Error refreshing data:", err);
    } finally {
      setLoading(false);
    }
  };

  const addPayment = async (payload) => {
    await axios.post(`${API_BASE}/api/payments`, payload);
    await refreshData();
  };

  const deletePayment = async (id) => {
    await axios.delete(`${API_BASE}/api/payments/${id}`);
    await refreshData();
  };

  const refreshWeekResults = async (week) => {
    await axios.get(`${API_BASE}/api/refresh/weekly/${week}`);
    await refreshData();
  };

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <LeagueContext.Provider value={{
      members, payments, weekly, loading, refreshData, addPayment, deletePayment, refreshWeekResults
    }}>
      {children}
    </LeagueContext.Provider>
  );
};
