import { MagicCard, MagicCardCounts, MagicCardPool } from '../../../backend/src/types';
import { AppContext } from '../App';
import ManaCost from './ManaCost';
import { ExpandMore } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { ChangeEvent, useContext, useMemo, useState } from 'react';

const WUBRGC_MAP: Record<string, number> = {
  B: 2,
  C: 5,
  G: 4,
  R: 3,
  U: 1,
  W: 0,
};

const CANONICAL_NAMES: Record<string, string> = {
  '': 'Colorless',
  B: 'Mono-Black',
  BG: 'Golgari',
  BR: 'Rakdos',
  BRG: 'Jund',
  G: 'Mono-Green',
  R: 'Mono-Red',
  RG: 'Gruul',
  U: 'Mono-Blue',
  UB: 'Dimir',
  UBG: 'Sultai',
  UBR: 'Grixis',
  UBRG: 'UBRG',
  UR: 'Izzet',
  URG: 'Temur',
  W: 'Mono-White',
  WB: 'Orzhov',
  WBG: 'Abzan',
  WBR: 'Mardu',
  WBRG: 'WBRG',
  WG: 'Selesnya',
  WR: 'Boros',
  WRG: 'Naya',
  WU: 'Azorius',
  WUB: 'Esper',
  WUBG: 'WUBG',
  WUBR: 'WUBR',
  WUBRG: 'WUBRG',
  WUG: 'Bant',
  WUR: 'Jeskai',
  WURG: 'WURG',
};

interface DeckColorPlayer {
  decklistUrl: string;
  username: string;
}

interface DeckColorGroup {
  colorKey: string;
  colors: string[];
  label: string;
  manaCost: string;
  players: DeckColorPlayer[];
}

const getColorInfo = (colors: string[]): { label: string; manaCost: string } => {
  const sortedColors = [...colors].sort((a, b) => (WUBRGC_MAP[a] ?? 99) - (WUBRGC_MAP[b] ?? 99));
  const key = sortedColors.join('');
  const label = CANONICAL_NAMES[key] ?? (key.length > 0 ? key : 'Colorless');
  const manaCost = sortedColors.length === 0 ? '{C}' : sortedColors.map((c) => `{${c}}`).join('');
  return {
    label,
    manaCost,
  };
};

const CardStats = () => {
  const { league } = useContext(AppContext);
  const [cardPopupOpen, setCardPopupOpen] = useState(false);
  const [colorModalOpen, setColorModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCard, setSelectedCard] = useState({} as MagicCard);
  const [selectedColorGroup, setSelectedColorGroup] = useState<DeckColorGroup | null>(null);
  const [subTabValue, setSubTabValue] = useState(0);

  const handleCardClick = (card: MagicCard) => {
    setSelectedCard(card);
    setCardPopupOpen(true);
  };

  const handleCloseCardPopup = () => {
    setCardPopupOpen(false);
  };

  const handleColorClick = (group: DeckColorGroup) => {
    setSelectedColorGroup(group);
    setColorModalOpen(true);
  };

  const handleCloseColorModal = () => {
    setColorModalOpen(false);
  };

  const handleSubTabChange = (_: ChangeEvent<unknown>, newValue: number) => {
    setSubTabValue(newValue);
  };

  const cardStatsList = useMemo(() => {
    const cardCounts = league.cardCounts || ({} as MagicCardCounts);
    return Object.values(cardCounts).map((card) => {
      const total = card.quantity || 0;
      const mainboard = card.mainboardQuantity || 0;
      const percentage = total > 0 ? Math.round((mainboard / total) * 100) : 0;
      return {
        card,
        mainboard,
        name: card.name,
        percentage,
        total,
      };
    });
  }, [league.cardCounts]);

  const sortedCardStats = useMemo(() => {
    return [...cardStatsList].sort((a, b) => {
      if (b.percentage !== a.percentage) {
        return b.percentage - a.percentage;
      }
      if (b.total !== a.total) {
        return b.total - a.total;
      }
      return a.name.localeCompare(b.name);
    });
  }, [cardStatsList]);

  const filteredCardStats = useMemo(() => {
    if (!searchTerm.trim()) {
      return sortedCardStats;
    }
    const lower = searchTerm.toLowerCase();
    return sortedCardStats.filter((item) => item.name.toLowerCase().includes(lower));
  }, [searchTerm, sortedCardStats]);

  const deckColorGroups = useMemo(() => {
    const cardPool = league.cardPool || ({} as Record<string, MagicCardPool>);
    const groupsMap = new Map<string, DeckColorGroup>();

    Object.entries(cardPool).forEach(([username, userPool]) => {
      let userColors = userPool.colors;
      if (!userColors) {
        const detectedColors = new Set<string>();
        Object.values(userPool.cardList || {}).forEach((card) => {
          if ((card.mainboardQuantity || 0) > 0 && card.mana_cost) {
            const symbols = card.mana_cost.match(/[WUBRG]/g);
            if (symbols) {
              symbols.forEach((s) => detectedColors.add(s));
            }
          }
        });
        userColors = Array.from(detectedColors).sort(
          (a, b) => (WUBRGC_MAP[a] ?? 99) - (WUBRGC_MAP[b] ?? 99),
        );
      }

      const sortedColors = [...userColors].sort(
        (a, b) => (WUBRGC_MAP[a] ?? 99) - (WUBRGC_MAP[b] ?? 99),
      );
      const colorKey = sortedColors.join('');
      const info = getColorInfo(sortedColors);

      if (!groupsMap.has(colorKey)) {
        groupsMap.set(colorKey, {
          colorKey,
          colors: sortedColors,
          label: info.label,
          manaCost: info.manaCost,
          players: [],
        });
      }

      groupsMap.get(colorKey)!.players.push({
        decklistUrl: userPool.decklistUrl,
        username,
      });
    });

    return Array.from(groupsMap.values())
      .filter((group) => group.players.length > 0)
      .sort((a, b) => {
        if (b.players.length !== a.players.length) {
          return b.players.length - a.players.length;
        }
        return a.label.localeCompare(b.label);
      });
  }, [league.cardPool]);

  return (
    <Box sx={{ overflowY: 'auto', width: '100%' }}>
      {league.poolSyncError && (
        <Alert severity='warning' sx={{ mb: 2 }}>
          Some or all card pools failed to sync during the latest update. Displayed data may be incomplete or out of date.
        </Alert>
      )}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography sx={{ fontWeight: 'bold' }}>
            {'How it works'}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {subTabValue === 0 ? (
            <ul>
              <li>Displays card utilization across the league: the percentage and ratio of copies in mainboards versus total copies in all card pools</li>
              <li>Type the name of the card you are looking for in the search box to filter</li>
              <li>Sorted by utilization percentage from highest to lowest</li>
              <li>Basic lands are not included in the stats</li>
              <li>Stats are updated automatically alongside the card pool at ~8pm EST on Sunday, Monday, Wednesday, and Friday nights</li>
            </ul>
          ) : (
            <ul>
              <li>Displays deck color combinations played across the league and the number of players playing each combination</li>
              <li>Color combinations are determined by the colors of non-basic cards in each player's mainboard</li>
              <li>Sorted by player count from most to least popular</li>
              <li>Click any color combination to view the players and links to their decklists</li>
              <li>Stats are updated automatically alongside the card pool at ~8pm EST on Sunday, Monday, Wednesday, and Friday nights</li>
            </ul>
          )}
        </AccordionDetails>
      </Accordion>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', my: 2 }}>
        <Tabs
          aria-label='card stats sub tabs'
          onChange={handleSubTabChange}
          value={subTabValue}
        >
          <Tab label='Utilization' />
          <Tab label='Deck Colors' />
        </Tabs>
      </Box>

      {subTabValue === 0 && (
        <Box>
          <TextField
            fullWidth
            label='Search'
            margin='normal'
            onChange={(event) => setSearchTerm(event.target.value)}
            value={searchTerm}
          />
          <Box>
            <List
              aria-labelledby='card-utilization-list'
              component='nav'
              sx={{ maxWidth: 420, width: '100%' }}
            >
              {filteredCardStats.map((item) => (
                <ListItemButton
                  key={item.name}
                  onClick={() => handleCardClick(item.card)}
                >
                  <ListItemText
                    primary={`${item.name} - ${item.percentage}% (${item.mainboard}/${item.total})`}
                  />
                  <ListItemIcon>
                    <ManaCost manaCost={item.card.mana_cost} />
                  </ListItemIcon>
                </ListItemButton>
              ))}
            </List>
          </Box>
        </Box>
      )}

      {subTabValue === 1 && (
        <Box>
          <List
            aria-labelledby='deck-colors-list'
            component='nav'
            sx={{ maxWidth: 420, width: '100%' }}
          >
            {deckColorGroups.map((group) => (
              <ListItemButton
                key={group.colorKey || 'Colorless'}
                onClick={() => handleColorClick(group)}
              >
                <ListItemText
                  primary={`${group.label} x${group.players.length}`}
                />
                <ListItemIcon>
                  <ManaCost manaCost={group.manaCost} />
                </ListItemIcon>
              </ListItemButton>
            ))}
          </List>
        </Box>
      )}

      {/* Scryfall Card Image Modal */}
      <Dialog onClose={handleCloseCardPopup} open={cardPopupOpen}>
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
          <Button onClick={handleCloseCardPopup}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Deck Colors Players Modal */}
      <Dialog
        fullWidth
        maxWidth='xs'
        onClose={handleCloseColorModal}
        open={colorModalOpen}
      >
        <DialogTitle>
          {selectedColorGroup ? `${selectedColorGroup.label} Players` : 'Players'}
        </DialogTitle>
        <DialogContent dividers>
          <List dense>
            {selectedColorGroup?.players
              .slice()
              .sort((a, b) => a.username.localeCompare(b.username))
              .map((player) => (
                <ListItem
                  key={player.username}
                  sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}
                >
                  <Typography>{player.username}</Typography>
                  {player.decklistUrl ? (
                    <Link
                      href={player.decklistUrl}
                      rel='noopener noreferrer'
                      target='_blank'
                      underline='hover'
                    >
                      {'Decklist'}
                    </Link>
                  ) : (
                    <Typography color='text.secondary'>{'No URL'}</Typography>
                  )}
                </ListItem>
              ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseColorModal}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CardStats;
