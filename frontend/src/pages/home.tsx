import {
  Box,
  Tab,
  Tabs,
} from '@mui/material';
import { ChangeEvent, useState } from 'react';
import CardPool from '../components/CardPool';
import StandingsTable from '../components/StandingsTable';

const Home = () => {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: ChangeEvent<unknown>, newValue: number) => {
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
    </Box>
  );
};

export default Home;
