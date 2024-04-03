import React, { useState } from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import StandingsTable from '../components/StandingsTable';
import CardPool from '../components/CardPool';

const Home = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.ChangeEvent<unknown>, newValue: number) => {
    console.log(event);
    setTabValue(newValue);
  };

  return (
    <Box sx={{ width: '100%', overflowY: 'auto' }}> {/* Make content scrollable */}
      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab label="Standings" />
        <Tab label="Pool" />
        <Tab label="Activity" />
        <Tab label="Reporting" />
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
      {tabValue === 3 && (
        <Box>TBD</Box>
      )}
    </Box>
  );
};

export default Home;
