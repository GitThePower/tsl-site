import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  TextField,
} from '@mui/material';
import { useContext, useState } from 'react';
import { AppContext } from '../App';
import { League, MagicCardPool } from '../../../backend/src/types';
import ManaCost from './ManaCost';

const getInitialSearchResults = (league: League): Record<string, MagicCardPool> => {
  const searchResults: Record<string, MagicCardPool> = {};
  if (league.cardPool) {
    Object.keys(league.cardPool).forEach((username) => {
      const userPool: MagicCardPool = {};
      if (league.cardPool) {
        Object.values(league.cardPool[username].boards).forEach((board) => {
          Object.values(board.cards).forEach((card) => {
            const cardName = card.card.name;
            if (cardName in userPool) {
              userPool[cardName].quantity += card.quantity;
            } else {
              userPool[cardName] = {
                quantity: card.quantity,
                mana_cost: card.card.mana_cost,
              }
            }
          });
        });
      }
      searchResults[username] = Object.keys(userPool).sort().reduce(
        (sorted, key) => {
          sorted[key] = userPool[key];
          return sorted;
        },
        {} as MagicCardPool,
      );
    });
  }
  return Object.keys(searchResults).sort().reduce(
    (sorted, key) => {
      sorted[key] = searchResults[key];
      return sorted;
    },
    {} as Record<string, MagicCardPool>,
  );
};

const CardPool = () => {
  const { league } = useContext(AppContext);
  const [searchTerm, setSearchTerm] = useState('');

  const searchResults = getInitialSearchResults(league);
  let filteredResults = searchResults;
  if (searchTerm) {
    filteredResults = Object.keys(searchResults).reduce((prev: Record<string, MagicCardPool>, username: string) => {
      const filteredUserPool: MagicCardPool = {};
      Object.keys(searchResults[username]).forEach((cardName) => {
        if (cardName.toLowerCase().includes(searchTerm.toLowerCase())) {
          filteredUserPool[cardName] = searchResults[username][cardName];
        }
      });
      prev[username] = filteredUserPool;
      return prev;
    }, {} as Record<string, MagicCardPool>);
  }

  return (
    <Box sx={{ width: '100%', overflowY: 'auto' }}>
      <TextField
        label='Search'
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        fullWidth
        margin='normal'
      />
      {Object.keys(filteredResults).map((username: string) => (
        <List
          sx={{ width: '100%', maxWidth: 360 }}
          component="nav"
          aria-labelledby="nested-list-subheader"
          subheader={
            <ListSubheader component="div" id="nested-list-subheader">
              {username}
            </ListSubheader>
          }
        >
          {Object.keys(filteredResults[username]).map((cardName: string) => (
            <ListItemButton>
              <ListItemText primary={`${cardName} x${filteredResults[username][cardName].quantity}`} />
              <ListItemIcon>
                <ManaCost manaCost={filteredResults[username][cardName].mana_cost} />
              </ListItemIcon>
            </ListItemButton>
          ))}
        </List>
      ))}
    </Box>
  )
};

export default CardPool;
