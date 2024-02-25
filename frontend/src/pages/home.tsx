import React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';

const Home = () => {
  const [tabValue, setTabValue] = React.useState(0);

  const handleTabChange = (event: React.ChangeEvent<unknown>, newValue: number) => {
    console.log(event);
    setTabValue(newValue);
  };

  return (
    <Box sx={{ width: '100%', overflowY: 'auto' }}> {/* Make content scrollable */}
      <Tabs value={tabValue} onChange={handleTabChange} centered>
        <Tab label="Standings" />
        <Tab label="Pool" />
        <Tab label="Activity" />
        <Tab label="Reporting" />
      </Tabs>
      {tabValue === 0 && ( 
         <Box>TBD</Box>
       )}
       {tabValue === 1 && ( 
         <Box>
           {/* Your Content for Section 2 Here */}
           <h2>TBD</h2>
           <p>Content to go here...</p> 
         </Box>
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
