import {
  Box,
  Paper,
  Table,
  TableBody,
  TableContainer,
  TableHead,
} from '@mui/material';
import { v4 } from 'uuid';
import StandingsTableRow from './StandingsTableRow';
import { User } from '../../../backend/src/types';

interface StandingsTableProps {
  users: User[];
}

const StandingsTable = (props: StandingsTableProps) => {
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
            {props.users.map((user, idx) =>
              <StandingsTableRow
                key={`${user.username}${v4()}`}
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
