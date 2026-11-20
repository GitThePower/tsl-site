import { League, User, UserLeague, UserRole } from '../../../../backend/src/types';
import api from '../../actions/api';
import { isValidMoxfieldUrl } from '../../utils/csvUserImport';
import { Delete } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
import { useMemo, useState } from 'react';
import { v4 } from 'uuid';

interface UserManagementProps {
  activeLeagueName: string;
  currentUsername: string;
  leagues: League[];
  onUsersChanged: () => Promise<void>;
  users: User[];
}

const UserManagement = (props: UserManagementProps) => {
  const { activeLeagueName, currentUsername, leagues, onUsersChanged, users } = props;

  const [actionError, setActionError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [credentialBanner, setCredentialBanner] = useState<{ label: string; password: string; username: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editLeaguesTarget, setEditLeaguesTarget] = useState<User | null>(null);
  const [editedLeagues, setEditedLeagues] = useState<UserLeague[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [newEntryDecklistUrl, setNewEntryDecklistUrl] = useState('');
  const [newEntryLeagueName, setNewEntryLeagueName] = useState('');
  const [newUserDecklistUrl, setNewUserDecklistUrl] = useState('');
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  const [newUserLeagueName, setNewUserLeagueName] = useState(activeLeagueName);
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [resetPasswordTarget, setResetPasswordTarget] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const sorted = [...users].sort((a, b) => (a.username || '').localeCompare(b.username || ''));
    if (!query) {
      return sorted;
    }
    return sorted.filter((user) => {
      const nameMatch = (user.username || '').toLowerCase().includes(query);
      const roleMatch = (user.roles ?? ['player']).some((role) => role.toLowerCase().includes(query));
      const leagueMatch = (user.leagues ?? []).some((entry) => entry.leaguename.toLowerCase().includes(query));
      return nameMatch || roleMatch || leagueMatch;
    });
  }, [searchQuery, users]);

  const openAddDialog = () => {
    setActionError('');
    setNewUserUsername('');
    setNewUserPassword(v4());
    setNewUserIsAdmin(false);
    setNewUserLeagueName(activeLeagueName || '');
    setNewUserDecklistUrl('');
    setAddOpen(true);
  };

  const handleCreateUser = async () => {
    const trimmedUsername = newUserUsername.trim();
    const trimmedUrl = newUserDecklistUrl.trim();
    if (!trimmedUsername || !newUserPassword) {
      setActionError('Username and password are required.');
      return;
    }
    if (trimmedUrl && !newUserLeagueName) {
      setActionError('Select a league for the decklist URL.');
      return;
    }
    if (newUserLeagueName && trimmedUrl && !isValidMoxfieldUrl(trimmedUrl)) {
      setActionError('Decklist URL must be a valid Moxfield deck URL.');
      return;
    }

    setIsBusy(true);
    setActionError('');
    try {
      const roles: UserRole[] = newUserIsAdmin ? ['admin', 'player'] : ['player'];
      const userLeagues: UserLeague[] = newUserLeagueName && trimmedUrl
        ? [{ decklistUrl: trimmedUrl, leaguename: newUserLeagueName }]
        : [];
      await api.createUser({
        leagues: userLeagues,
        password: newUserPassword,
        roles,
        username: trimmedUsername,
      });
      setAddOpen(false);
      setCredentialBanner({
        label: 'Created user',
        password: newUserPassword,
        username: trimmedUsername,
      });
      await onUsersChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create user.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleAdmin = async (user: User) => {
    if (!user.username) {
      return;
    }
    setIsBusy(true);
    setActionError('');
    try {
      const currentRoles = user.roles ?? ['player'];
      const isAdmin = currentRoles.includes('admin');
      const nextRoles: UserRole[] = isAdmin
        ? ['player']
        : Array.from(new Set([...currentRoles, 'admin'] as UserRole[]));
      await api.updateUser(user.username, { roles: nextRoles });
      await onUsersChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update roles.');
    } finally {
      setIsBusy(false);
    }
  };

  const openEditLeagues = (user: User) => {
    setActionError('');
    setEditLeaguesTarget(user);
    setEditedLeagues((user.leagues ?? []).map((entry) => ({ ...entry })));
    setNewEntryLeagueName('');
    setNewEntryDecklistUrl('');
  };

  const handleAddLeagueEntry = () => {
    const trimmedUrl = newEntryDecklistUrl.trim();
    if (!newEntryLeagueName || !trimmedUrl) {
      setActionError('Select a league and enter a Moxfield decklist URL.');
      return;
    }
    if (!isValidMoxfieldUrl(trimmedUrl)) {
      setActionError('Decklist URL must be a valid Moxfield deck URL.');
      return;
    }
    setActionError('');
    setEditedLeagues((prev) => [
      ...prev.filter((entry) => entry.leaguename !== newEntryLeagueName),
      { decklistUrl: trimmedUrl, leaguename: newEntryLeagueName },
    ]);
    setNewEntryLeagueName('');
    setNewEntryDecklistUrl('');
  };

  const handleSaveLeagues = async () => {
    if (!editLeaguesTarget?.username) {
      return;
    }
    for (const entry of editedLeagues) {
      if (!entry.decklistUrl.trim() || !isValidMoxfieldUrl(entry.decklistUrl)) {
        setActionError(`Invalid Moxfield URL for ${entry.leaguename}.`);
        return;
      }
    }

    setIsBusy(true);
    setActionError('');
    try {
      await api.updateUser(editLeaguesTarget.username, {
        leagues: editedLeagues.map((entry) => ({
          decklistUrl: entry.decklistUrl.trim(),
          leaguename: entry.leaguename,
        })),
      });
      setEditLeaguesTarget(null);
      await onUsersChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update user leagues.');
    } finally {
      setIsBusy(false);
    }
  };

  const openResetPassword = (username: string) => {
    setActionError('');
    setResetPasswordTarget(username);
    setResetPasswordValue(v4());
  };

  const handleConfirmResetPassword = async () => {
    if (!resetPasswordTarget || !resetPasswordValue) {
      setActionError('Password cannot be empty.');
      return;
    }
    setIsBusy(true);
    setActionError('');
    try {
      await api.updateUser(resetPasswordTarget, { password: resetPasswordValue });
      setCredentialBanner({
        label: 'Reset password for',
        password: resetPasswordValue,
        username: resetPasswordTarget,
      });
      setResetPasswordTarget(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reset password.');
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
    try {
      await api.deleteUser(deleteTarget);
      setDeleteTarget(null);
      await onUsersChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete user.');
    } finally {
      setIsBusy(false);
    }
  };

  const unassignedLeagues = leagues.filter(
    (league) => !editedLeagues.some((entry) => entry.leaguename === league.leaguename),
  );

  return (
    <Stack spacing={2}>
      {actionError && <Alert severity='error'>{actionError}</Alert>}

      {credentialBanner && (
        <Alert
          severity='success'
          onClose={() => setCredentialBanner(null)}
          action={(
            <Button
              color='inherit'
              size='small'
              onClick={() => navigator.clipboard.writeText(credentialBanner.password)}
            >
              Copy Password
            </Button>
          )}
        >
          {credentialBanner.label} <strong>{credentialBanner.username}</strong> — Temporary password (shown once):{' '}
          <code>{credentialBanner.password}</code>
        </Alert>
      )}

      <Stack direction={{ sm: 'row', xs: 'column' }} justifyContent='space-between' spacing={2}>
        <TextField
          label='Search users by username, role, or league'
          size='small'
          sx={{ minWidth: 300 }}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        <Button variant='contained' disabled={isBusy} onClick={openAddDialog}>
          Add User
        </Button>
      </Stack>

      <TableContainer component={Paper}>
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Roles</TableCell>
              <TableCell>Leagues</TableCell>
              <TableCell align='right'>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUsers.map((user) => {
              const username = user.username || '';
              const roles = user.roles && user.roles.length > 0 ? user.roles : ['player'];
              const isAdmin = roles.includes('admin');
              const isSelf = username === currentUsername;

              return (
                <TableRow key={username}>
                  <TableCell>{username}</TableCell>
                  <TableCell>
                    <Stack direction='row' spacing={0.5}>
                      {roles.map((role) => (
                        <Chip
                          key={role}
                          color={role === 'admin' ? 'secondary' : 'default'}
                          label={role}
                          size='small'
                        />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {(user.leagues ?? []).length === 0 ? (
                      <Typography variant='caption' color='text.secondary'>
                        None
                      </Typography>
                    ) : (
                      <Stack spacing={0.5}>
                        {(user.leagues ?? []).map((entry) => (
                          <Box key={entry.leaguename}>
                            <Typography variant='caption'>
                              <strong>{entry.leaguename}</strong>:{' '}
                              <a href={entry.decklistUrl} target='_blank' rel='noopener noreferrer'>
                                {entry.decklistUrl}
                              </a>
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </TableCell>
                  <TableCell align='right'>
                    <Stack direction='row' spacing={1} justifyContent='flex-end' flexWrap='wrap' useFlexGap>
                      <Button size='small' disabled={isBusy} onClick={() => openEditLeagues(user)}>
                        Edit Leagues
                      </Button>
                      <Button
                        size='small'
                        disabled={isBusy || isSelf}
                        onClick={() => handleToggleAdmin(user)}
                      >
                        {isAdmin ? 'Remove Admin' : 'Make Admin'}
                      </Button>
                      <Button
                        size='small'
                        disabled={isBusy}
                        onClick={() => openResetPassword(username)}
                      >
                        Reset Password
                      </Button>
                      <Button
                        color='error'
                        size='small'
                        disabled={isBusy || isSelf}
                        onClick={() => setDeleteTarget(username)}
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

      <Dialog open={addOpen} onClose={() => !isBusy && setAddOpen(false)} fullWidth maxWidth='sm'>
        <DialogTitle>Add User</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label='Username'
              fullWidth
              value={newUserUsername}
              onChange={(event) => setNewUserUsername(event.target.value)}
            />
            <Stack direction='row' spacing={1} alignItems='center'>
              <TextField
                label='Initial Password'
                fullWidth
                value={newUserPassword}
                onChange={(event) => setNewUserPassword(event.target.value)}
              />
              <Button variant='outlined' onClick={() => setNewUserPassword(v4())}>
                Regenerate
              </Button>
            </Stack>
            <FormControlLabel
              control={(
                <Checkbox
                  checked={newUserIsAdmin}
                  onChange={(event) => setNewUserIsAdmin(event.target.checked)}
                />
              )}
              label='Grant admin role'
            />
            <FormControl fullWidth size='small'>
              <InputLabel id='add-user-league-label'>Initial League (Optional)</InputLabel>
              <Select
                labelId='add-user-league-label'
                label='Initial League (Optional)'
                value={newUserLeagueName}
                onChange={(event) => setNewUserLeagueName(event.target.value)}
              >
                <MenuItem value=''>None</MenuItem>
                {leagues.map((league) => (
                  <MenuItem key={league.leaguename} value={league.leaguename || ''}>
                    {league.leaguename}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {newUserLeagueName && (
              <TextField
                label='Moxfield Decklist URL'
                fullWidth
                placeholder='https://moxfield.com/decks/...'
                value={newUserDecklistUrl}
                onChange={(event) => setNewUserDecklistUrl(event.target.value)}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={isBusy} onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button variant='contained' disabled={isBusy} onClick={handleCreateUser}>
            Create User
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(editLeaguesTarget)}
        onClose={() => !isBusy && setEditLeaguesTarget(null)}
        fullWidth
        maxWidth='md'
      >
        <DialogTitle>Edit Leagues for {editLeaguesTarget?.username}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {editedLeagues.length === 0 && (
              <Typography variant='body2' color='text.secondary'>
                No league memberships yet.
              </Typography>
            )}
            {editedLeagues.map((entry, idx) => (
              <Stack key={entry.leaguename} direction='row' spacing={1} alignItems='center'>
                <Typography sx={{ minWidth: 160 }} variant='body2'>
                  <strong>{entry.leaguename}</strong>
                </Typography>
                <TextField
                  size='small'
                  fullWidth
                  value={entry.decklistUrl}
                  onChange={(event) => {
                    const nextUrl = event.target.value;
                    setEditedLeagues((prev) =>
                      prev.map((item, itemIdx) =>
                        itemIdx === idx ? { ...item, decklistUrl: nextUrl } : item,
                      ),
                    );
                  }}
                />
                <IconButton
                  aria-label={`Remove ${entry.leaguename}`}
                  color='error'
                  onClick={() =>
                    setEditedLeagues((prev) => prev.filter((_, itemIdx) => itemIdx !== idx))
                  }
                >
                  <Delete />
                </IconButton>
              </Stack>
            ))}

            {unassignedLeagues.length > 0 && (
              <Stack direction={{ sm: 'row', xs: 'column' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ pt: 1 }}>
                <FormControl size='small' sx={{ minWidth: 180 }}>
                  <InputLabel id='add-entry-league-label'>Add League</InputLabel>
                  <Select
                    labelId='add-entry-league-label'
                    label='Add League'
                    value={newEntryLeagueName}
                    onChange={(event) => setNewEntryLeagueName(event.target.value)}
                  >
                    {unassignedLeagues.map((league) => (
                      <MenuItem key={league.leaguename} value={league.leaguename || ''}>
                        {league.leaguename}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  size='small'
                  fullWidth
                  label='Moxfield Decklist URL'
                  value={newEntryDecklistUrl}
                  onChange={(event) => setNewEntryDecklistUrl(event.target.value)}
                />
                <Button variant='outlined' onClick={handleAddLeagueEntry}>
                  Add
                </Button>
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={isBusy} onClick={() => setEditLeaguesTarget(null)}>Cancel</Button>
          <Button variant='contained' disabled={isBusy} onClick={handleSaveLeagues}>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(resetPasswordTarget)}
        onClose={() => !isBusy && setResetPasswordTarget(null)}
        fullWidth
        maxWidth='sm'
      >
        <DialogTitle>Reset Password for {resetPasswordTarget}</DialogTitle>
        <DialogContent>
          <Stack direction='row' spacing={1} alignItems='center' sx={{ mt: 1 }}>
            <TextField
              label='New Password'
              fullWidth
              value={resetPasswordValue}
              onChange={(event) => setResetPasswordValue(event.target.value)}
            />
            <Button variant='outlined' onClick={() => setResetPasswordValue(v4())}>
              Regenerate
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={isBusy} onClick={() => setResetPasswordTarget(null)}>Cancel</Button>
          <Button variant='contained' disabled={isBusy} onClick={handleConfirmResetPassword}>
            Reset Password
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => !isBusy && setDeleteTarget(null)}>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete user <strong>{deleteTarget}</strong>? This action cannot be undone.
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

export default UserManagement;
