import {
  TableCell,
  TableRow,
} from '@mui/material';

interface DecklistsRowProps {
  decklistUrl: string;
  name: string;
}

const DecklistsRow = (props: DecklistsRowProps) => {
  return (
    <TableRow>
      <TableCell sx={{ textAlign: 'center' }}>{props.name}</TableCell>
      <TableCell sx={{ textAlign: 'center' }}>
        {
          (props.decklistUrl.includes('https')) ?
            <a href={props.decklistUrl} target="_blank" rel="noopener noreferrer">
              <>{props.decklistUrl}</>
            </a> :
            <div>{props.decklistUrl}</div>
        }
      </TableCell>
    </TableRow>
  )
};

export default DecklistsRow;
