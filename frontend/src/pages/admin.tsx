import { League, User } from '../../../backend/src/types';
import api from '../actions/api';
import { AppContext } from '../App';
import BulkUserUpload from '../components/admin/BulkUserUpload';
import LeagueManagement from '../components/admin/LeagueManagement';
import UserManagement from '../components/admin/UserManagement';
import Header from '../components/Header';
import LogoutButton from '../components/LogoutButton';
import {
  Alert,
  Box,
  CircularProgress,
  Tab,
  Tabs,
} from '@mui/material';
import { ChangeEvent, useCallback, useContext, useEffect, useState } from 'react';

const Admin = () => {
  const { league, refreshActiveLeague, session } = useContext(AppContext);
  const [isLoading, setIsLoading] = useState(true);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loadError, setLoadError] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [users, setUsers] = useState<User[]>([]);

  const loadData = useCallback(async () => {
    setLoadError('');
    try {
      const [userResults, leagueResults] = await Promise.all([
        api.listUsers(),
        api.listLeagues(),
      ]);
      setUsers(userResults);
      setLeagues(leagueResults);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load admin data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLeaguesChanged = async () => {
    try {
      await refreshActiveLeague();
    } catch (err) {
      console.error(err);
    }
    await loadData();
  };

  const activeLeagueName =
    leagues.find((item) => item.isActive)?.leaguename || league.leaguename || '';

  const handleTabChange = (_event: ChangeEvent<unknown>, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <div>
      <header>
        <Header HeaderButton={LogoutButton} />
      </header>
      <main>
        <Box sx={{ p: 2, width: '100%' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant='scrollable'
            scrollButtons='auto'
            sx={{ mb: 2 }}
          >
            <Tab label='Bulk CSV Upload' />
            <Tab label='Users' />
            <Tab label='Leagues' />
          </Tabs>

          {loadError && (
            <Alert severity='error' sx={{ mb: 2 }}>
              {loadError}
            </Alert>
          )}

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {tabValue === 0 && (
                <BulkUserUpload
                  activeLeagueName={activeLeagueName}
                  leagues={leagues}
                  onUsersChanged={loadData}
                  users={users}
                />
              )}
              {tabValue === 1 && (
                <UserManagement
                  activeLeagueName={activeLeagueName}
                  currentUsername={session.username || ''}
                  leagues={leagues}
                  onUsersChanged={loadData}
                  users={users}
                />
              )}
              {tabValue === 2 && (
                <LeagueManagement
                  leagues={leagues}
                  onLeaguesChanged={handleLeaguesChanged}
                  users={users}
                />
              )}
            </>
          )}
        </Box>
      </main>
    </div>
  );
};

export default Admin;
