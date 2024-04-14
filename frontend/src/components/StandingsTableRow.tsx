import {
  TableCell,
  TableRow,
} from '@mui/material';

interface StandingsTableRowProps {
  rank: string;
  name: string;
  weeklyWPrcnt: string;
  overallWPrcnt: string;
}

const StandingsTableRow = (props: StandingsTableRowProps) => {
  return (
    <TableRow>
      <TableCell sx={{ textAlign: 'center' }}>{props.rank}</TableCell>
      <TableCell sx={{ textAlign: 'center' }}>{props.name}</TableCell>
      <TableCell sx={{ textAlign: 'center' }}>{props.weeklyWPrcnt}</TableCell>
      <TableCell sx={{ textAlign: 'center' }}>{props.overallWPrcnt}</TableCell>
    </TableRow>
  )
};

export default StandingsTableRow;
