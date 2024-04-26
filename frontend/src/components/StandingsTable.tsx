import {
  Box,
  Paper,
  Table,
  TableBody,
  TableContainer,
  TableHead,
} from '@mui/material';
import { useEffect, useState } from 'react';
import StandingsTableRow from './StandingsTableRow';
import api from '../actions/api';
import { User } from '../../../backend/src/types';

const StandingsTable = () => {
  const [users, setUsers] = useState([] as User[]);

  useEffect(() => {
    const fillTable = async () => {
      const userResults = await api.listUsers();
      setUsers(userResults);
    };
    fillTable();
  });

  return (
    <Box sx={{ width: '100%', overflowY: 'auto' }}>
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label='simple table'>
          <TableHead>
            <StandingsTableRow
              rank={'Rank'}
              name={'Name'}
              weeklyWPrcnt={'Weekly Win %'}
              overallWPrcnt={'Overall Win %'}
            />
          </TableHead>
          <TableBody>
            {users.map((user, idx) =>
              <StandingsTableRow
                rank={`${idx + 1}`}
                name={user.username || ''}
                weeklyWPrcnt={`${0}`}
                overallWPrcnt={`${0}`}
              />)}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
};

export default StandingsTable;
