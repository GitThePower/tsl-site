import { ExpandMore } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Link,
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
import { League, MagicCard, MagicCardPool } from '../../../backend/src/types';

const getInitialSearchResults = (league: League): Record<string, MagicCardPool> => {
  const searchResults: Record<string, MagicCardPool> = {};
  if (league.cardPool) {
    Object.keys(league.cardPool).forEach((username) => {
      searchResults[username] = {} as MagicCardPool;
      const userCardList = {} as Record<string, MagicCard>;
      if (league.cardPool) {
        searchResults[username].decklistUrl = league.cardPool[username].decklistUrl;
        Object.values(league.cardPool[username].moxfieldContent.boards).forEach((board) => {
          Object.values(board.cards).forEach((card) => {
            const cardName = card.card.name;
            if (['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'].includes(cardName)) {
              // Do not add basics to the pool
            } else if (cardName in userCardList) {
              userCardList[cardName].quantity += card.quantity;
            } else {
              userCardList[cardName] = {
                quantity: card.quantity,
                mana_cost: card.card.mana_cost,
              }
            }
          });
        });
      }
      searchResults[username].cardList = Object.keys(userCardList).sort().reduce(
        (sorted, key) => {
          sorted[key] = userCardList[key];
          return sorted;
        },
        {} as Record<string, MagicCard>,
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
      filteredResults = Object.keys(searchResults).reduce((prev, username) => {
        const filteredUserPool = {} as MagicCardPool;
        filteredUserPool.cardList = {} as Record<string, { quantity: number; mana_cost: string; }>
        Object.keys(searchResults[username].cardList).forEach((cardName) => {
          if (cardName.toLowerCase().includes(searchTerm.toLowerCase())) {
            filteredUserPool.cardList[cardName] = searchResults[username].cardList[cardName];
          }
        });
        if (Object.keys(filteredUserPool.cardList).length > 0) {
          filteredUserPool.decklistUrl = searchResults[username].decklistUrl;
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
            <li>Pool is updated automatically at ~8pm EST every night</li>
            <li>Users are added manually. Message me if you don't see your pool listed and want to be added</li>
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
                {`${username} `}
                [<Link rel="noopener noreferrer" href={filteredResults[username].decklistUrl} target="_blank" underline="hover">
                  Decklist
                </Link>]
              </ListSubheader>
            }
          >
            {Object.keys(filteredResults[username].cardList).map((cardName: string) => (
              <ListItemButton>
                <ListItemText primary={`${cardName} x${filteredResults[username].cardList[cardName].quantity}`} />
                <ListItemIcon>
                  <ManaCost manaCost={filteredResults[username].cardList[cardName].mana_cost} />
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
