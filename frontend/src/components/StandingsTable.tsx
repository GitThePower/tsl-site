import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';

const StandingsTable = () => {
  return (
    <Box sx={{ width: '100%', overflowY: 'auto' }}>
      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label='simple table'>
          <TableHead>
            <TableRow>
              <TableCell sx={{ textAlign: 'center' }}>Rank</TableCell>
              <TableCell sx={{ textAlign: 'center' }}>Name</TableCell>
              <TableCell sx={{ textAlign: 'center' }}>Weekly Win %</TableCell>
              <TableCell sx={{ textAlign: 'center' }}>Overall Win %</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {/* Add your table rows and data here */}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
};

export default StandingsTable;
