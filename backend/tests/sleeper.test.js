import { fetchUsers, fetchRosters, fetchWeeklyMatchups } from '../src/sleeper.js';

describe('Sleeper Client API Tests', () => {
  const KEEPER_ID = '1387435648129966080';

  test('should pull users listings', async () => {
    const users = await fetchUsers(KEEPER_ID);
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
  }, 10000);

  test('should pull rosters', async () => {
    const rosters = await fetchRosters(KEEPER_ID);
    expect(Array.isArray(rosters)).toBe(true);
    expect(rosters.length).toBeGreaterThan(0);
  }, 10000);
});
