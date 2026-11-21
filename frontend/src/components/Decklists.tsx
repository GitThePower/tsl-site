import {
  Box,
  Paper,
  Table,
  TableBody,
  TableContainer,
  TableHead,
} from '@mui/material';
import { useContext } from 'react';
import { v4 } from 'uuid';
import DecklistsRow from './DecklistsRow';
import { AppContext } from '../App';
import { User } from '../../../backend/src/types';

interface DecklistsProps {
  users: User[];
}

const Decklists = (props: DecklistsProps) => {
  const { league } = useContext(AppContext);
  const leagueDecklists = props.users
    .map((user) => ({
      decklistUrl: league.leaguename
        ? user.leagues?.find((userLeague) => userLeague.leaguename === league.leaguename)?.decklistUrl?.trim() || ''
        : '',
      username: user.username || '',
    }))
    .filter((entry) => Boolean(entry.decklistUrl))
    .sort((a, b) => a.username.localeCompare(b.username));

  return (
    <Box sx={{ width: '100%', overflowY: 'auto' }}>
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label='simple table'>
          <TableHead>
            <DecklistsRow
              decklistUrl={'Decklist URL'}
              name={'Name'}
            />
          </TableHead>
          <TableBody>
            {leagueDecklists.map((entry) => (
              <DecklistsRow
                key={`${entry.username}${v4()}`}
                decklistUrl={entry.decklistUrl}
                name={entry.username}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default Decklists;
