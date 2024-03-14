import React, { useEffect, useState } from 'react';
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
import { TextField } from '@mui/material';
import { MagicCard } from '../../../backend/types';

const Home = () => {
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([] as MagicCard[]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchDataFromAPI = async () => {
      setIsLoading(true);
      try {
        const data = await Promise.resolve([{ name: 'Inside Source', count: 5 }]);
        setSearchResults(data);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDataFromAPI();
  }, []); // Empty dependency array: Execute only once on page load

  const handleTabChange = (event: React.ChangeEvent<unknown>, newValue: number) => {
    console.log(event);
    setTabValue(newValue);
  };

  let filteredResults = searchResults;

  if (searchTerm) {
    filteredResults = searchResults.filter((item) => {
      // Implement your filtering logic based on item properties and searchTerm
      return item.name.toLowerCase().includes(searchTerm.toLowerCase());
      // Example: Assuming the data has a 'title' property
    });
  }

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
          <TextField
            label="Search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            fullWidth
            margin="normal"
          />
          {isLoading ? (
            <div>Loading...</div>
          ) : (
            <ul>
              {filteredResults.map((item: MagicCard) => (
                <li key={item.name}>
                  {item.name}
                </li>
              ))}
            </ul>
          )}
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
