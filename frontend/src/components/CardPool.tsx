import { ExpandMore } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { MagicCard, MagicCardPool } from '../../../backend/src/types';

const CardPool = () => {
  const { league } = useContext(AppContext);
  const [openPopup, setOpenPopup] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCard, setSelectedCard] = useState({} as MagicCard);

  const handleCardClick = (card: MagicCard) => {
    setSelectedCard(card);
    setOpenPopup(true);
  };

  const handleClosePopup = () => {
    setOpenPopup(false);
  };

  const searchResults = league.cardPool || {} as Record<string, MagicCardPool>;
  let filteredResults = searchResults;
  if (searchTerm) {
      filteredResults = Object.keys(searchResults).reduce((prev, username) => {
        const filteredUserPool = {} as MagicCardPool;
        filteredUserPool.cardList = {} as Record<string, MagicCard>
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
            key={username}
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
              <ListItemButton key={`${username}-${cardName}`} onClick={() => handleCardClick(filteredResults[username].cardList[cardName])}>
                <ListItemText primary={`${cardName} x${filteredResults[username].cardList[cardName].quantity}`} />
                <ListItemIcon>
                  <ManaCost manaCost={filteredResults[username].cardList[cardName].mana_cost} />
                </ListItemIcon>
              </ListItemButton>
            ))}
          </List>
        ))}
      </Box>
      <Dialog open={openPopup} onClose={handleClosePopup}>
        <DialogTitle>{selectedCard.name ? selectedCard.name : 'Popup'}</DialogTitle>
        <DialogContent>
          {selectedCard && (
              <img 
                src={
                  selectedCard.scryfall_id ?
                  `https://api.scryfall.com/cards/${selectedCard.scryfall_id}?format=image` :
                  undefined
                } 
                alt={selectedCard.name} 
                style={{ width: '100%' }}
              />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePopup}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
};

export default CardPool;
