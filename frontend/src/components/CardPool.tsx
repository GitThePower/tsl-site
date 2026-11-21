import { MagicCard, MagicCardPool } from '../../../backend/src/types';
import scryfall from '../actions/scryfall';
import { AppContext } from '../App';
import {
  CARD_TYPES,
  COLOR_MATCH_MODES,
  COLOR_OPTIONS,
  CardColorCode,
  CardPoolFilters,
  CardRarity,
  CardType,
  ColorMatchMode,
  DEFAULT_CARD_POOL_FILTERS,
  RARITY_OPTIONS,
  areFiltersEqual,
  detectMissingFilterMetadata,
  filterCardPool,
  formatCardSecondaryText,
  isManaValueRangeInvalid,
} from '../utils/cardPoolFilter';
import ManaCost from './ManaCost';
import { ExpandMore, Search } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
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
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { FormEvent, MouseEvent, useContext, useMemo, useState } from 'react';

const COLOR_LABELS: Record<CardColorCode, string> = {
  B: 'Black',
  C: 'Colorless',
  G: 'Green',
  R: 'Red',
  U: 'Blue',
  W: 'White',
};

const COLOR_MATCH_MODE_LABELS: Record<ColorMatchMode, string> = {
  exactly: 'Exactly',
  exclude: 'Exclude',
  include: 'Include',
};

const RARITY_LABELS: Record<CardRarity, string> = {
  common: 'Common',
  mythic: 'Mythic',
  rare: 'Rare',
  uncommon: 'Uncommon',
};

const toggleArrayItem = <T extends string>(items: T[], item: T): T[] =>
  items.includes(item) ? items.filter((existing) => existing !== item) : [...items, item];

const CardPool = () => {
  const { league } = useContext(AppContext);
  const [appliedFilters, setAppliedFilters] = useState<CardPoolFilters | null>(null);
  const [draftFilters, setDraftFilters] = useState<CardPoolFilters>(DEFAULT_CARD_POOL_FILTERS);
  const [openPopup, setOpenPopup] = useState(false);
  const [selectedCard, setSelectedCard] = useState({} as MagicCard);

  const poolData = useMemo(
    () => league.cardPool || ({} as Record<string, MagicCardPool>),
    [league.cardPool],
  );

  const manaValueRangeInvalid = isManaValueRangeInvalid(
    draftFilters.minManaValue,
    draftFilters.maxManaValue,
  );

  const hasUnappliedChanges =
    appliedFilters !== null && !areFiltersEqual(draftFilters, appliedFilters);

  const searchResult = useMemo(
    () => (appliedFilters ? filterCardPool(poolData, appliedFilters) : null),
    [appliedFilters, poolData],
  );

  const missingMetadataFields = useMemo(
    () => (appliedFilters ? detectMissingFilterMetadata(poolData, appliedFilters) : []),
    [appliedFilters, poolData],
  );

  const handleCardClick = (card: MagicCard) => {
    setSelectedCard(card);
    setOpenPopup(true);
  };

  const handleClosePopup = () => {
    setOpenPopup(false);
  };

  const handleColorsChange = (_: MouseEvent<HTMLElement>, newColors: CardColorCode[]) => {
    setDraftFilters((prev) => ({
      ...prev,
      colors: newColors,
    }));
  };

  const handleColorMatchModeChange = (
    _: MouseEvent<HTMLElement>,
    newMode: ColorMatchMode | null,
  ) => {
    if (newMode !== null) {
      setDraftFilters((prev) => ({
        ...prev,
        colorMatchMode: newMode,
      }));
    }
  };

  const handleToggleType = (cardType: CardType) => {
    setDraftFilters((prev) => ({
      ...prev,
      types: toggleArrayItem(prev.types, cardType),
    }));
  };

  const handleToggleRarity = (rarity: CardRarity) => {
    setDraftFilters((prev) => ({
      ...prev,
      rarities: toggleArrayItem(prev.rarities, rarity),
    }));
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (manaValueRangeInvalid) {
      return;
    }
    setAppliedFilters({
      ...draftFilters,
      colors: [...draftFilters.colors],
      rarities: [...draftFilters.rarities],
      types: [...draftFilters.types],
    });
  };

  const handleClear = () => {
    setDraftFilters(DEFAULT_CARD_POOL_FILTERS);
    setAppliedFilters(null);
  };

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
          <ul>
            <li>Enter a card name and/or select Color, Type, Mana Value, and Rarity filters, then click Search (or press Enter)</li>
            <li>Leave all filters empty and click Search to browse the full pool</li>
            <li>Cards matching your search will appear under the name of the user who owns them</li>
            <li>Basic lands are not included in the pool</li>
            <li>Pool is updated automatically at ~8pm EST on Sunday, Monday, Wednesday, and Friday nights</li>
            <li>Users are added manually. Message me if you don't see your pool listed and want to be added</li>
          </ul>
        </AccordionDetails>
      </Accordion>

      <Paper
        component='form'
        onSubmit={handleSearch}
        sx={{ my: 2, p: 2 }}
        variant='outlined'
      >
        <Stack spacing={2}>
          <TextField
            fullWidth
            label='Card Name'
            onChange={(event) => {
              const value = event.target.value;
              setDraftFilters((prev) => ({
                ...prev,
                name: value,
              }));
            }}
            placeholder='Search by card name...'
            size='small'
            value={draftFilters.name}
          />

          <Box>
            <Typography color='text.secondary' sx={{ display: 'block', mb: 0.75 }} variant='caption'>
              {'Color'}
            </Typography>
            <Stack
              alignItems={{ sm: 'center', xs: 'flex-start' }}
              direction={{ sm: 'row', xs: 'column' }}
              flexWrap='wrap'
              gap={1.5}
            >
              <ToggleButtonGroup
                aria-label='Card colors'
                color='primary'
                onChange={handleColorsChange}
                size='small'
                value={draftFilters.colors}
              >
                {COLOR_OPTIONS.map((color) => (
                  <ToggleButton
                    aria-label={COLOR_LABELS[color]}
                    key={color}
                    title={COLOR_LABELS[color]}
                    value={color}
                  >
                    <i
                      className={`ms ms-${color.toLowerCase()} ms-cost ms-shadow`}
                      style={{ fontSize: '1.1rem' }}
                    />
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>

              <ToggleButtonGroup
                aria-label='Color match mode'
                color='primary'
                exclusive
                onChange={handleColorMatchModeChange}
                size='small'
                value={draftFilters.colorMatchMode}
              >
                {COLOR_MATCH_MODES.map((mode) => (
                  <ToggleButton key={mode} value={mode}>
                    {COLOR_MATCH_MODE_LABELS[mode]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Stack>
          </Box>

          <Box>
            <Typography color='text.secondary' sx={{ display: 'block', mb: 0.75 }} variant='caption'>
              {'Card Type'}
            </Typography>
            <Stack direction='row' flexWrap='wrap' gap={0.75} sx={{ mb: 1.5 }}>
              {CARD_TYPES.map((cardType) => {
                const isSelected = draftFilters.types.includes(cardType);
                return (
                  <Chip
                    clickable
                    color={isSelected ? 'primary' : 'default'}
                    key={cardType}
                    label={cardType}
                    onClick={() => handleToggleType(cardType)}
                    size='small'
                    variant={isSelected ? 'filled' : 'outlined'}
                  />
                );
              })}
            </Stack>
            <TextField
              label='Subtype / Supertype'
              onChange={(event) => {
                const value = event.target.value;
                setDraftFilters((prev) => ({
                  ...prev,
                  subtype: value,
                }));
              }}
              placeholder='e.g. Elf, Equipment, Legendary'
              size='small'
              sx={{ maxWidth: 340, width: '100%' }}
              value={draftFilters.subtype}
            />
          </Box>

          <Stack
            alignItems={{ md: 'flex-start', xs: 'stretch' }}
            direction={{ md: 'row', xs: 'column' }}
            gap={2}
          >
            <Box>
              <Typography color='text.secondary' sx={{ display: 'block', mb: 0.75 }} variant='caption'>
                {'Mana Value'}
              </Typography>
              <Stack direction='row' gap={1.5}>
                <TextField
                  error={manaValueRangeInvalid}
                  helperText={manaValueRangeInvalid ? 'Min cannot exceed Max' : undefined}
                  label='Min MV'
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraftFilters((prev) => ({
                      ...prev,
                      minManaValue: value,
                    }));
                  }}
                  size='small'
                  slotProps={{ htmlInput: { min: 0, step: 1 } }}
                  sx={{ width: 130 }}
                  type='number'
                  value={draftFilters.minManaValue}
                />
                <TextField
                  error={manaValueRangeInvalid}
                  label='Max MV'
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraftFilters((prev) => ({
                      ...prev,
                      maxManaValue: value,
                    }));
                  }}
                  size='small'
                  slotProps={{ htmlInput: { min: 0, step: 1 } }}
                  sx={{ width: 130 }}
                  type='number'
                  value={draftFilters.maxManaValue}
                />
              </Stack>
            </Box>

            <Box>
              <Typography color='text.secondary' sx={{ display: 'block', mb: 0.75 }} variant='caption'>
                {'Rarity'}
              </Typography>
              <Stack direction='row' flexWrap='wrap' gap={0.75} sx={{ pt: { md: 0.5, xs: 0 } }}>
                {RARITY_OPTIONS.map((rarity) => {
                  const isSelected = draftFilters.rarities.includes(rarity);
                  return (
                    <Chip
                      clickable
                      color={isSelected ? 'primary' : 'default'}
                      key={rarity}
                      label={RARITY_LABELS[rarity]}
                      onClick={() => handleToggleRarity(rarity)}
                      size='small'
                      variant={isSelected ? 'filled' : 'outlined'}
                    />
                  );
                })}
              </Stack>
            </Box>
          </Stack>

          <Stack alignItems='center' direction='row' flexWrap='wrap' gap={1.5}>
            <Button
              disabled={manaValueRangeInvalid}
              startIcon={<Search />}
              type='submit'
              variant='contained'
            >
              {'Search'}
            </Button>
            <Button onClick={handleClear} type='button' variant='outlined'>
              {'Clear'}
            </Button>
            {hasUnappliedChanges && (
              <Typography color='text.secondary' variant='body2'>
                {'Filters changed — click Search to update results.'}
              </Typography>
            )}
          </Stack>
        </Stack>
      </Paper>

      {appliedFilters === null && (
        <Typography color='text.secondary' sx={{ my: 3 }}>
          {'Set your filters above and click Search to view matching cards (or click Search with no filters to browse the full pool).'}
        </Typography>
      )}

      {searchResult !== null && (
        <Box>
          {missingMetadataFields.length > 0 && (
            <Alert severity='info' sx={{ mb: 2 }}>
              {`Some cards in the current pool do not yet have ${missingMetadataFields.join(', ')} data. Those fields will populate after the next scheduled pool sync.`}
            </Alert>
          )}
          {searchResult.matchingPlayerCount === 0 ? (
            <Typography color='text.secondary' sx={{ my: 2 }}>
              {'No cards match your current filters.'}
            </Typography>
          ) : (
            <>
              <Typography color='text.secondary' sx={{ mb: 1 }} variant='body2'>
                {`Showing ${searchResult.matchingCardEntries} matching card ${searchResult.matchingCardEntries === 1 ? 'entry' : 'entries'} (${searchResult.totalCardCopies} total ${searchResult.totalCardCopies === 1 ? 'copy' : 'copies'}) across ${searchResult.matchingPlayerCount} ${searchResult.matchingPlayerCount === 1 ? 'player' : 'players'}`}
              </Typography>
              <Box>
                {Object.keys(searchResult.filteredPool).map((username: string) => (
                  <List
                    aria-labelledby={`pool-list-subheader-${username}`}
                    component='nav'
                    key={username}
                    subheader={
                      <ListSubheader component='div' id={`pool-list-subheader-${username}`}>
                        {`${username} `}
                        [
                        <Link
                          href={searchResult.filteredPool[username].decklistUrl}
                          rel='noopener noreferrer'
                          target='_blank'
                          underline='hover'
                        >
                          {'Decklist'}
                        </Link>
                        ]
                      </ListSubheader>
                    }
                    sx={{ maxWidth: 520, width: '100%' }}
                  >
                    {Object.keys(searchResult.filteredPool[username].cardList).map((cardName: string) => {
                      const card = searchResult.filteredPool[username].cardList[cardName];
                      return (
                        <ListItemButton
                          key={`${username}-${cardName}`}
                          onClick={() => handleCardClick(card)}
                        >
                          <ListItemText
                            primary={`${cardName} x${card.quantity}`}
                            secondary={formatCardSecondaryText(card)}
                          />
                          <ListItemIcon sx={{ minWidth: 'auto', ml: 2 }}>
                            <ManaCost manaCost={card.mana_cost} />
                          </ListItemIcon>
                        </ListItemButton>
                      );
                    })}
                  </List>
                ))}
              </Box>
            </>
          )}
        </Box>
      )}

      <Dialog onClose={handleClosePopup} open={openPopup}>
        <DialogTitle>{selectedCard.name ? selectedCard.name : 'Popup'}</DialogTitle>
        <DialogContent>
          {selectedCard && (
            <img
              alt={selectedCard.name}
              onError={(e) => {
                const target = e.currentTarget;
                const fallbackUrl = scryfall.getScryfallApiImageUrl(selectedCard.scryfall_id);
                if (fallbackUrl && target.src !== fallbackUrl) {
                  target.src = fallbackUrl;
                }
              }}
              src={scryfall.getScryfallImageUrl(selectedCard.scryfall_id)}
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

export default CardPool;
