import React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';

const Home = () => {
  const [tabValue, setTabValue] = React.useState(0);

  const handleTabChange = (event: React.ChangeEvent<unknown>, newValue: number) => {
    console.log(event);
    setTabValue(newValue);
  };

  return (
    <Box sx={{ width: '100%', overflowY: 'auto' }}> {/* Make content scrollable */}
      <Tabs
        value={tabValue}
        onChange={handleTabChange}
        // centered
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab label="Standings" />
        <Tab label="Pool" />
        <Tab label="Activity" />
        <Tab label="Reporting" />
      </Tabs>
      {tabValue === 0 && (
        <Box>
          <TableContainer component={Paper}>
            <Table sx={{ minWidth: 650 }} aria-label="simple table">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ textAlign: 'center' }}>Rank</TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>Name</TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>Points</TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>
                    Round 1 <br /> W - L
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>
                    Round 2 <br /> W - L
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>Win %</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Add your table rows and data here */}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
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
