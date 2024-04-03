import {
  Box,
  TextField,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { MagicCardPool } from '../../../backend/src/types';

const CardPool = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState({} as MagicCardPool);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchDataFromAPI = async () => {
      setIsLoading(true);
      try {
        const data = await Promise.resolve({ 'Inside Source': 5 });
        setSearchResults(data);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDataFromAPI();
  }, []); // Empty dependency array: Execute only once on page load


  let filteredResults = searchResults;

  if (searchTerm) {
    filteredResults = Object.keys(searchResults).reduce((prev: MagicCardPool, key: string) => {
      // Implement your filtering logic based on item properties and searchTerm
      if (key.toLowerCase().includes(searchTerm.toLowerCase())) {
        prev[key] = searchResults[key];
      }
      return prev;
    }, {} as MagicCardPool);
  }

  return (
    <Box sx={{ width: '100%', overflowY: 'auto' }}>
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
          {Object.keys(filteredResults).map((cardName: string) => (
            <li key={cardName}>
              {cardName}
            </li>
          ))}
        </ul>
      )}
    </Box>
  )
};

export default CardPool;
