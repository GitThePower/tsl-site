import {
  Box,
  CircularProgress,
  Tab,
  Tabs,
} from '@mui/material';
import { ChangeEvent, useContext, useEffect, useState } from 'react';
import api from '../actions/api';
import conditions from '../actions/conditions.ts';
import { AppContext } from '../App.tsx';
import CardCounts from '../components/CardCounts';
import CardPool from '../components/CardPool';
import Decklists from '../components/Decklists';
import Header from '../components/Header.tsx';
import LoginPageButton from '../components/LoginPageButton.tsx';
import ProfileButton from '../components/ProfileButton.tsx';
import { User } from '../../../backend/src/types';

const Home = () => {
  const { isLeagueLoading, session } = useContext(AppContext);
  const [isUsersLoading, setIsUsersLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [users, setUsers] = useState([] as User[]);

  useEffect(() => {
    const fillTable = async () => {
      try {
        const userResults = await api.listUsers();
        setUsers(userResults);
      } finally {
        setIsUsersLoading(false);
      }
    };
    fillTable();
  }, []);

  const handleTabChange = (event: ChangeEvent<unknown>, newValue: number) => {
    setTabValue(newValue);
    return event;
  };

  return (
    <div>
      <header>
        <Header HeaderButton={(conditions.sessionIsActive(session)) ?
          ProfileButton :
          LoginPageButton
        } />
      </header>
      <main>
        <Box sx={{ width: '100%', overflowY: 'auto' }}> {/* Make content scrollable */}
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant='scrollable'
            scrollButtons='auto'
          >
            <Tab label='Pool' />
            <Tab label='Decklists' />
            <Tab label='Card Counts' />
            {conditions.sessionIsActive(session) && (
              <Tab label='Reporting' />
            )}
          </Tabs>
          {isLeagueLoading || isUsersLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {tabValue === 0 && (
                <CardPool />
              )}
              {tabValue === 1 && (
                <Decklists users={users} />
              )}
              {tabValue === 2 && (
                <CardCounts />
              )}
              {tabValue === 3 && (
                <Box>TBD</Box>
              )}
            </>
          )}
        </Box>
      </main>
    </div>
  );
};

export default Home;
