import {
  Box,
  Tab,
  Tabs,
} from '@mui/material';
import { ChangeEvent, useContext, useState } from 'react';
import conditions from '../actions/conditions.ts';
import { AppContext } from '../App.tsx';
import CardPool from '../components/CardPool';
import Header from '../components/Header.tsx';
import LoginPageButton from '../components/LoginPageButton.tsx';
import ProfileButton from '../components/ProfileButton.tsx';
import StandingsTable from '../components/StandingsTable';

const Home = () => {
  const { session } = useContext(AppContext);
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: ChangeEvent<unknown>, newValue: number) => {
    console.log(event);
    setTabValue(newValue);
  };

  return (
    <div>
      <header>
        <Header HeaderButton={(conditions.sessionIsActive(session)) ?
          ProfileButton :
          LoginPageButton
        }/>
      </header>
      <main>
        <Box sx={{ width: '100%', overflowY: 'auto' }}> {/* Make content scrollable */}
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant='scrollable'
            scrollButtons='auto'
          >
            <Tab label='Standings' />
            <Tab label='Pool' />
            {conditions.sessionIsActive(session) && (
              <Tab label='Reporting' />
            )}
          </Tabs>
          {tabValue === 0 && (
            <StandingsTable />
          )}
          {tabValue === 1 && (
            <CardPool />
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
