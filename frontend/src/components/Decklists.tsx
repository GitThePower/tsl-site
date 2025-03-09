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
  props.users.sort((a, b) => (a.username || '').localeCompare(b.username || ''));
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
            {props.users.map((user) => {
              const decklistUrl = user.leagues?.find((userLeague) => userLeague.leaguename === league.leaguename)?.decklistUrl;
              return <DecklistsRow
                key={`${user.username}${v4()}`}
                decklistUrl={decklistUrl || ''}
                name={user.username || ''}
              />
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
};

export default Decklists;
