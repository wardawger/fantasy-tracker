import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const LeagueContext = createContext();

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:20129';

export const LeagueProvider = ({ children }) => {
  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [champions, setChampions] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshData = async () => {
    setLoading(true);
    try {
      await axios.get(`${API_BASE}/api/sync-members`);
      const memRes = await axios.get(`${API_BASE}/api/members`);
      const payRes = await axios.get(`${API_BASE}/api/payments`);
      const weekRes = await axios.get(`${API_BASE}/api/weekly`);
      const championsRes = await axios.get(`${API_BASE}/api/champions`);
      setMembers(memRes.data);
      setPayments(payRes.data);
      setWeekly(weekRes.data);
      setChampions(championsRes.data);
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

  const updatePayment = async (id, payload) => {
    await axios.put(`${API_BASE}/api/payments/${id}`, payload);
    await refreshData();
  };

  const optIn = async (memberId, league, optedIn) => {
    await axios.post(`${API_BASE}/api/members/${memberId}/opt-in`, { league, optedIn });
    await refreshData();
  };

  const setVenmoUsername = async (memberId, venmoUsername) => {
    await axios.post(`${API_BASE}/api/members/${memberId}/venmo`, { venmoUsername });
    await refreshData();
  };

  const refreshWeekResults = async (week) => {
    await axios.get(`${API_BASE}/api/refresh/weekly/${week}`);
    await refreshData();
  };

  const refreshChampion = async (league) => {
    await axios.get(`${API_BASE}/api/refresh/champions/${league}`);
    await refreshData();
  };

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <LeagueContext.Provider value={{
      members, payments, weekly, champions, loading, refreshData, addPayment, deletePayment, updatePayment, optIn, setVenmoUsername, refreshWeekResults, refreshChampion
    }}>
      {children}
    </LeagueContext.Provider>
  );
};
