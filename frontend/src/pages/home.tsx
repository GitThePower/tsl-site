import {
  Box,
  Tab,
  Tabs,
} from '@mui/material';
import { ChangeEvent, useContext, useEffect, useState } from 'react';
import api from '../actions/api';
import conditions from '../actions/conditions.ts';
import { AppContext } from '../App.tsx';
import CardPool from '../components/CardPool';
import Header from '../components/Header.tsx';
import LoginPageButton from '../components/LoginPageButton.tsx';
import ProfileButton from '../components/ProfileButton.tsx';
import StandingsTable from '../components/StandingsTable';
import { User } from '../../../backend/src/types';

const Home = () => {
  const { session } = useContext(AppContext);
  const [tabValue, setTabValue] = useState(0);
  const [users, setUsers] = useState([] as User[]);

  useEffect(() => {
    const fillTable = async () => {
      const userResults = await api.listUsers();
      setUsers(userResults);
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
            {conditions.sessionIsActive(session) && (
              <Tab label='Standings' />
            )}
            {conditions.sessionIsActive(session) && (
              <Tab label='Reporting' />
            )}
          </Tabs>
          {tabValue === 0 && (
            <CardPool />
          )}
          {tabValue === 1 && (
            <StandingsTable users={users} />
          )}
          {tabValue === 2 && (
            <Box>TBD</Box>
          )}
        </Box>
      </main>
    </div>
  );
};

export default Home;
