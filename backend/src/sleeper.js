const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';

export async function fetchUsers(leagueId) {
  const res = await fetch(`${SLEEPER_BASE_URL}/league/${leagueId}/users`);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return res.json();
}

export async function fetchRosters(leagueId) {
  const res = await fetch(`${SLEEPER_BASE_URL}/league/${leagueId}/rosters`);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return res.json();
}

export async function fetchWeeklyMatchups(leagueId, week) {
  const res = await fetch(`${SLEEPER_BASE_URL}/league/${leagueId}/matchups/${week}`);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return res.json();
}

export async function fetchWinnersBracket(leagueId) {
  const res = await fetch(`${SLEEPER_BASE_URL}/league/${leagueId}/winners_bracket`);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return res.json();
}
