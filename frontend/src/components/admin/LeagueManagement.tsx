import { League, User } from '../../../../backend/src/types';
import api from '../../actions/api';
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';

interface LeagueManagementProps {
  leagues: League[];
  onLeaguesChanged: () => Promise<void>;
  users: User[];
}

const LeagueManagement = (props: LeagueManagementProps) => {
  const { leagues, onLeaguesChanged, users } = props;
  const [actionError, setActionError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [newLeagueActive, setNewLeagueActive] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const handleCreateLeague = async () => {
    const trimmedName = newLeagueName.trim();
    if (!trimmedName) {
      setActionError('League name is required.');
      return;
    }

    setIsBusy(true);
    setActionError('');
    setStatusMessage('');
    try {
      await api.createLeague({
        isActive: newLeagueActive,
        leaguename: trimmedName,
      });
      setNewLeagueName('');
      setNewLeagueActive(false);
      setStatusMessage(`Created league "${trimmedName}".`);
      await onLeaguesChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create league.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSetActive = async (leaguename: string) => {
    setIsBusy(true);
    setActionError('');
    setStatusMessage('');
    try {
      await api.updateLeague(leaguename, { isActive: true });
      setStatusMessage(`Switched active league to "${leaguename}".`);
      await onLeaguesChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to switch active league.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setIsBusy(true);
    setActionError('');
    setStatusMessage('');
    try {
      await api.deleteLeague(deleteTarget);
      setStatusMessage(`Deleted league "${deleteTarget}".`);
      setDeleteTarget(null);
      await onLeaguesChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete league.');
    } finally {
      setIsBusy(false);
    }
  };

  const sortedLeagues = [...leagues].sort((a, b) => {
    if (a.isActive !== b.isActive) {
      return a.isActive ? -1 : 1;
    }
    return (a.leaguename || '').localeCompare(b.leaguename || '');
  });

  return (
    <Stack spacing={3}>
      {actionError && <Alert severity='error'>{actionError}</Alert>}
      {statusMessage && <Alert severity='success'>{statusMessage}</Alert>}

      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant='h6'>Create New League</Typography>
          <Stack direction={{ sm: 'row', xs: 'column' }} spacing={2} alignItems={{ sm: 'center' }}>
            <TextField
              label='League Name'
              size='small'
              sx={{ minWidth: 260 }}
              disabled={isBusy}
              value={newLeagueName}
              onChange={(event) => setNewLeagueName(event.target.value)}
            />
            <FormControlLabel
              control={(
                <Checkbox
                  checked={newLeagueActive}
                  disabled={isBusy}
                  onChange={(event) => setNewLeagueActive(event.target.checked)}
                />
              )}
              label='Set as active league'
            />
            <Button
              variant='contained'
              disabled={isBusy || !newLeagueName.trim()}
              onClick={handleCreateLeague}
            >
              Create League
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <TableContainer component={Paper}>
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell>League Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Pool Sync</TableCell>
              <TableCell>Players</TableCell>
              <TableCell align='right'>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedLeagues.map((league) => {
              const name = league.leaguename || '';
              const playerCount = users.filter((user) =>
                user.leagues?.some((entry) => entry.leaguename === name),
              ).length;

              return (
                <TableRow key={name}>
                  <TableCell>{name}</TableCell>
                  <TableCell>
                    <Chip
                      color={league.isActive ? 'success' : 'default'}
                      label={league.isActive ? 'Active' : 'Inactive'}
                      size='small'
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      color={league.poolSyncError ? 'error' : 'default'}
                      label={league.poolSyncError ? 'Sync Error' : 'OK'}
                      size='small'
                    />
                  </TableCell>
                  <TableCell>{playerCount}</TableCell>
                  <TableCell align='right'>
                    <Stack direction='row' spacing={1} justifyContent='flex-end'>
                      {!league.isActive && (
                        <Button
                          size='small'
                          variant='outlined'
                          disabled={isBusy}
                          onClick={() => handleSetActive(name)}
                        >
                          Set Active
                        </Button>
                      )}
                      <Button
                        color='error'
                        size='small'
                        disabled={isBusy || Boolean(league.isActive)}
                        onClick={() => setDeleteTarget(name)}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={Boolean(deleteTarget)} onClose={() => !isBusy && setDeleteTarget(null)}>
        <DialogTitle>Delete League</DialogTitle>
        <DialogContent>
          <Typography>
            Delete inactive league <strong>{deleteTarget}</strong> and its stored S3 card pool files? User league references will remain untouched unless removed separately.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={isBusy} onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color='error' variant='contained' disabled={isBusy} onClick={handleConfirmDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default LeagueManagement;
