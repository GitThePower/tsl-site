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
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import { useContext, useState } from 'react';
import { MagicCard, MagicCardCounts } from '../../../backend/src/types';
import { AppContext } from '../App';
import ManaCost from './ManaCost';

const CardCounts = () => {
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

  const searchResults = league.cardCounts || ({} as MagicCardCounts);
  let filteredCards = Object.keys(searchResults);
  if (searchTerm) {
    filteredCards = filteredCards.filter((cardName) =>
      cardName.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }

  return (
    <Box sx={{ overflowY: 'auto', width: '100%' }}>
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography sx={{ fontWeight: 'bold' }}>
            {'How it works'}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <ul>
            <li>Type the name of the card you are looking for in the search box</li>
            <li>Displays the total count of each card across all players in the league</li>
            <li>Basic lands are not included in the counts</li>
            <li>Counts are updated automatically alongside the card pool at ~8pm EST every night</li>
          </ul>
        </AccordionDetails>
      </Accordion>
      <TextField
        fullWidth
        label='Search'
        margin='normal'
        onChange={(event) => setSearchTerm(event.target.value)}
        value={searchTerm}
      />
      <Box>
        <List
          aria-labelledby='card-counts-list'
          component='nav'
          sx={{ maxWidth: 360, width: '100%' }}
        >
          {filteredCards.map((cardName) => (
            <ListItemButton
              key={cardName}
              onClick={() => handleCardClick(searchResults[cardName])}
            >
              <ListItemText
                primary={`${cardName} x${searchResults[cardName].quantity}`}
              />
              <ListItemIcon>
                <ManaCost manaCost={searchResults[cardName].mana_cost} />
              </ListItemIcon>
            </ListItemButton>
          ))}
        </List>
      </Box>
      <Dialog onClose={handleClosePopup} open={openPopup}>
        <DialogTitle>{selectedCard.name ? selectedCard.name : 'Popup'}</DialogTitle>
        <DialogContent>
          {selectedCard && (
            <img
              alt={selectedCard.name}
              src={
                selectedCard.scryfall_id
                  ? `https://api.scryfall.com/cards/${selectedCard.scryfall_id}?format=image`
                  : undefined
              }
              style={{ width: '100%' }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClosePopup}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CardCounts;
