import { ExpandMore } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  TextField,
  Typography,
} from '@mui/material';
import { useContext, useState } from 'react';
import { AppContext } from '../App';
import ManaCost from './ManaCost';
import { League, MagicCardPool } from '../../../backend/src/types';

const getInitialSearchResults = (league: League): Record<string, MagicCardPool> => {
  const searchResults: Record<string, MagicCardPool> = {};
  if (league.cardPool) {
    Object.keys(league.cardPool).forEach((username) => {
      const userPool: MagicCardPool = {};
      if (league.cardPool) {
        Object.values(league.cardPool[username].boards).forEach((board) => {
          Object.values(board.cards).forEach((card) => {
            const cardName = card.card.name;
            if (['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'].includes(cardName)) {
              // Do not add basics to the pool
            } else if (cardName in userPool) {
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
      if (Object.keys(filteredUserPool).length > 0) {
        prev[username] = filteredUserPool;
      }
      return prev;
    }, {} as Record<string, MagicCardPool>);
  }

  return (
    <Box sx={{ width: '100%', overflowY: 'auto' }}>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography sx={{ fontWeight: 'bold' }}>
            {'How it works'}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <ul>
            <li>Type the name of the card you are looking for in the search box</li>
            <li>Cards matching your search will appear under the name of the user who owns them</li>
            <li>Basic lands are not included in the pool</li>
          </ul>
        </AccordionDetails>
      </Accordion>
      <TextField
        label='Search'
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        fullWidth
        margin='normal'
      />
      <Box>
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
    </Box>
  )
};

export default CardPool;
