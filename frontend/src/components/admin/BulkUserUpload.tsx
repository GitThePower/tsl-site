import { League, User } from '../../../../backend/src/types';
import api, { ApiError } from '../../actions/api';
import {
  ReconciledImportRow,
  buildCredentialsCsv,
  detectColumns,
  normalizeUsername,
  parseCsv,
  reconcileCsvRows,
  reconcileEditableRow,
} from '../../utils/csvUserImport';
import {
  Alert,
  Button,
  Checkbox,
  Chip,
  FormControl,
  InputLabel,
  LinearProgress,
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
import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { v4 } from 'uuid';

interface BulkUserUploadProps {
  activeLeagueName: string;
  leagues: League[];
  onUsersChanged: () => Promise<void>;
  users: User[];
}

interface RowExecutionFailure {
  error: string;
  row: ReconciledImportRow;
}

interface UploadSummary {
  createdCredentials: Array<{ password: string; username: string }>;
  failures: RowExecutionFailure[];
  updatedCount: number;
}

const withRateLimitRetry = async <T,>(fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ApiError && err.status === 429 && attempt < maxRetries) {
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
        continue;
      }
      throw err;
    }
  }
};

const actionChipProps = (action: ReconciledImportRow['action']) => {
  if (action === 'create') {
    return { color: 'success' as const, label: 'Create' };
  }
  if (action === 'update') {
    return { color: 'primary' as const, label: 'Update' };
  }
  if (action === 'error') {
    return { color: 'error' as const, label: 'Error' };
  }
  return { color: 'default' as const, label: 'Unchanged' };
};

const BulkUserUpload = (props: BulkUserUploadProps) => {
  const { activeLeagueName, leagues, onUsersChanged, users } = props;
  const [copiedBanner, setCopiedBanner] = useState('');
  const [csvText, setCsvText] = useState('');
  const [decklistCol, setDecklistCol] = useState<number>(-1);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [rows, setRows] = useState<ReconciledImportRow[]>([]);
  const [targetLeague, setTargetLeague] = useState(activeLeagueName);
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null);
  const [usernameCol, setUsernameCol] = useState<number>(-1);

  const parsedCsv = useMemo(() => parseCsv(csvText), [csvText]);

  useEffect(() => {
    if (!targetLeague && (activeLeagueName || leagues[0]?.leaguename)) {
      setTargetLeague(activeLeagueName || leagues[0]?.leaguename || '');
    }
  }, [activeLeagueName, leagues, targetLeague]);

  useEffect(() => {
    const detected = detectColumns(parsedCsv.headers);
    setUsernameCol(detected.usernameCol);
    setDecklistCol(detected.decklistCol);
  }, [parsedCsv.headers]);

  useEffect(() => {
    if (isSubmitting) {
      return;
    }
    if (parsedCsv.rows.length === 0) {
      setRows([]);
      setDuplicateCount(0);
      return;
    }
    const reconciled = reconcileCsvRows(
      parsedCsv.rows,
      usernameCol,
      decklistCol,
      users,
      targetLeague,
    );
    setRows(reconciled.rows);
    setDuplicateCount(reconciled.duplicateCount);
  }, [decklistCol, isSubmitting, parsedCsv.rows, targetLeague, usernameCol, users]);

  const duplicatePreviewUsernames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const normalized = normalizeUsername(row.username).toLowerCase();
      if (normalized) {
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      }
    }
    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([key]) => key),
    );
  }, [rows]);

  const counts = useMemo(() => {
    let create = 0;
    let error = 0;
    let unchanged = 0;
    let update = 0;
    for (const row of rows) {
      if (row.action === 'create') create++;
      else if (row.action === 'update') update++;
      else if (row.action === 'error') error++;
      else unchanged++;
    }
    return { create, error, unchanged, update };
  }, [rows]);

  const executableRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.selected &&
          (row.action === 'create' || row.action === 'update') &&
          !duplicatePreviewUsernames.has(normalizeUsername(row.username).toLowerCase()),
      ),
    [duplicatePreviewUsernames, rows],
  );

  const selectableRows = useMemo(
    () => rows.filter((row) => row.action === 'create' || row.action === 'update'),
    [rows],
  );

  const allSelected =
    selectableRows.length > 0 && selectableRows.every((row) => row.selected);

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    setCsvText(text);
    setUploadSummary(null);
    event.target.value = '';
  };

  const handleClear = () => {
    setCsvText('');
    setRows([]);
    setDuplicateCount(0);
    setUploadSummary(null);
    setCopiedBanner('');
  };

  const handleRowEdit = (rowId: string, field: 'decklistUrl' | 'username', value: string) => {
    setRows((prevRows) =>
      prevRows.map((row) => {
        if (row.id !== rowId) {
          return row;
        }
        const updated = {
          ...row,
          [field]: value,
        };
        return reconcileEditableRow(updated, users, targetLeague);
      }),
    );
  };

  const handleRowSelectToggle = (rowId: string, checked: boolean) => {
    setRows((prevRows) =>
      prevRows.map((row) => (row.id === rowId ? { ...row, selected: checked } : row)),
    );
  };

  const handleSelectAllToggle = (checked: boolean) => {
    setRows((prevRows) =>
      prevRows.map((row) =>
        row.action === 'create' || row.action === 'update'
          ? { ...row, selected: checked }
          : row,
      ),
    );
  };

  const executeRows = async (
    rowsToProcess: ReconciledImportRow[],
    existingCredentials: Array<{ password: string; username: string }> = [],
    priorUpdatedCount = 0,
  ) => {
    if (rowsToProcess.length === 0 || !targetLeague) {
      return;
    }

    setIsSubmitting(true);
    setCopiedBanner('');
    setProgress({ completed: 0, total: rowsToProcess.length });

    const createdCredentials = [...existingCredentials];
    const failures: RowExecutionFailure[] = [];
    let updatedCount = priorUpdatedCount;

    for (let idx = 0; idx < rowsToProcess.length; idx++) {
      const row = rowsToProcess[idx];
      try {
        if (row.action === 'create') {
          const password = v4();
          await withRateLimitRetry(() =>
            api.createUser({
              leagues: [{ decklistUrl: row.decklistUrl, leaguename: targetLeague }],
              password,
              roles: ['player'],
              username: row.username,
            }),
          );
          createdCredentials.push({ password, username: row.username });
        } else if (row.action === 'update') {
          const existingLeagues = row.existingUser?.leagues ?? [];
          const otherLeagues = existingLeagues.filter((entry) => entry.leaguename !== targetLeague);
          const mergedLeagues = [
            ...otherLeagues,
            { decklistUrl: row.decklistUrl, leaguename: targetLeague },
          ];
          await withRateLimitRetry(() =>
            api.updateUser(row.username, { leagues: mergedLeagues }),
          );
          updatedCount++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Request failed';
        failures.push({ error: message, row });
      }
      setProgress({ completed: idx + 1, total: rowsToProcess.length });
    }

    setUploadSummary({
      createdCredentials,
      failures,
      updatedCount,
    });
    setIsSubmitting(false);
    await onUsersChanged();
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBanner(`Copied ${label} to clipboard.`);
    } catch {
      setCopiedBanner('Clipboard copy failed in this browser context.');
    }
  };

  const handleDownloadCredentials = () => {
    if (!uploadSummary || uploadSummary.createdCredentials.length === 0) {
      return;
    }
    const csv = buildCredentialsCsv(uploadSummary.createdCredentials);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tsl-new-user-passwords-${targetLeague || 'league'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant='h6'>Import Roster CSV</Typography>
          <Typography variant='body2' color='text.secondary'>
            Upload or paste a Google Form CSV export. Rows match existing users case-insensitively by normalized Discord username, preserve other league memberships, and generate UUID v4 passwords for new users.
          </Typography>

          <Stack direction={{ sm: 'row', xs: 'column' }} spacing={2} alignItems={{ sm: 'center' }}>
            <FormControl size='small' sx={{ minWidth: 240 }}>
              <InputLabel id='target-league-label'>Target League</InputLabel>
              <Select
                labelId='target-league-label'
                label='Target League'
                value={targetLeague}
                disabled={isSubmitting}
                onChange={(event) => setTargetLeague(event.target.value)}
              >
                {leagues.map((league) => (
                  <MenuItem key={league.leaguename} value={league.leaguename || ''}>
                    {league.leaguename}{league.isActive ? ' (Active)' : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button component='label' variant='outlined' disabled={isSubmitting}>
              Upload .csv File
              <input
                hidden
                accept='.csv,text/csv'
                type='file'
                onChange={handleFileUpload}
              />
            </Button>

            {csvText && (
              <Button variant='text' color='inherit' disabled={isSubmitting} onClick={handleClear}>
                Clear
              </Button>
            )}
          </Stack>

          <TextField
            label='Paste CSV Content'
            multiline
            minRows={4}
            maxRows={10}
            fullWidth
            disabled={isSubmitting}
            placeholder='Timestamp,First and Last Name,Moxfield Decklist,Player #,What is your Discord Username?'
            value={csvText}
            onChange={(event) => {
              setCsvText(event.target.value);
              setUploadSummary(null);
            }}
          />

          {parsedCsv.headers.length > 0 && (
            <Stack direction={{ sm: 'row', xs: 'column' }} spacing={2}>
              <FormControl size='small' sx={{ minWidth: 240 }}>
                <InputLabel id='username-col-label'>Username Column</InputLabel>
                <Select
                  labelId='username-col-label'
                  label='Username Column'
                  value={usernameCol}
                  disabled={isSubmitting}
                  onChange={(event) => setUsernameCol(Number(event.target.value))}
                >
                  <MenuItem value={-1}>-- Select Column --</MenuItem>
                  {parsedCsv.headers.map((header, idx) => (
                    <MenuItem key={`${header}-${idx}`} value={idx}>
                      {header || `Column ${idx + 1}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size='small' sx={{ minWidth: 240 }}>
                <InputLabel id='decklist-col-label'>Moxfield Decklist Column</InputLabel>
                <Select
                  labelId='decklist-col-label'
                  label='Moxfield Decklist Column'
                  value={decklistCol}
                  disabled={isSubmitting}
                  onChange={(event) => setDecklistCol(Number(event.target.value))}
                >
                  <MenuItem value={-1}>-- Select Column --</MenuItem>
                  {parsedCsv.headers.map((header, idx) => (
                    <MenuItem key={`${header}-${idx}`} value={idx}>
                      {header || `Column ${idx + 1}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          )}
        </Stack>
      </Paper>

      {duplicateCount > 0 && (
        <Alert severity='info'>
          {duplicateCount} duplicate username row(s) in the CSV were merged by keeping the latest submission.
        </Alert>
      )}

      {duplicatePreviewUsernames.size > 0 && (
        <Alert severity='warning'>
          Duplicate usernames detected after inline edits ({Array.from(duplicatePreviewUsernames).join(', ')}). Resolve duplicates before applying those rows.
        </Alert>
      )}

      {isSubmitting && (
        <Paper sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Typography variant='body2'>
              Applying changes sequentially ({progress.completed} / {progress.total})...
            </Typography>
            <LinearProgress
              variant='determinate'
              value={progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}
            />
          </Stack>
        </Paper>
      )}

      {uploadSummary && (
        <Paper sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Alert severity={uploadSummary.failures.length > 0 ? 'warning' : 'success'}>
              Created {uploadSummary.createdCredentials.length} user(s), updated {uploadSummary.updatedCount} user(s)
              {uploadSummary.failures.length > 0
                ? `, and ${uploadSummary.failures.length} row(s) failed.`
                : '.'}
            </Alert>

            {copiedBanner && <Alert severity='info'>{copiedBanner}</Alert>}

            {uploadSummary.failures.length > 0 && (
              <Stack spacing={1}>
                <Stack direction='row' justifyContent='space-between' alignItems='center'>
                  <Typography variant='subtitle2'>Failed Rows</Typography>
                  <Button
                    size='small'
                    variant='outlined'
                    disabled={isSubmitting}
                    onClick={() =>
                      executeRows(
                        uploadSummary.failures.map((item) => item.row),
                        uploadSummary.createdCredentials,
                        uploadSummary.updatedCount,
                      )
                    }
                  >
                    Retry Failed ({uploadSummary.failures.length})
                  </Button>
                </Stack>
                {uploadSummary.failures.map((failure) => (
                  <Alert key={failure.row.id} severity='error'>
                    <strong>{failure.row.username}</strong>: {failure.error}
                  </Alert>
                ))}
              </Stack>
            )}

            {uploadSummary.createdCredentials.length > 0 && (
              <Stack spacing={1}>
                <Stack
                  direction={{ sm: 'row', xs: 'column' }}
                  justifyContent='space-between'
                  alignItems={{ sm: 'center' }}
                  spacing={1}
                >
                  <Typography variant='subtitle1'>
                    New User Passwords (shown once)
                  </Typography>
                  <Stack direction='row' spacing={1}>
                    <Button
                      size='small'
                      variant='outlined'
                      onClick={() =>
                        copyText(
                          uploadSummary.createdCredentials
                            .map((item) => `${item.username}: ${item.password}`)
                            .join('\n'),
                          'all credentials',
                        )
                      }
                    >
                      Copy All
                    </Button>
                    <Button size='small' variant='contained' onClick={handleDownloadCredentials}>
                      Download CSV
                    </Button>
                  </Stack>
                </Stack>
                <TableContainer component={Paper} variant='outlined'>
                  <Table size='small'>
                    <TableHead>
                      <TableRow>
                        <TableCell>Username</TableCell>
                        <TableCell>Initial Password</TableCell>
                        <TableCell align='right'>Copy</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {uploadSummary.createdCredentials.map((cred) => (
                        <TableRow key={cred.username}>
                          <TableCell>{cred.username}</TableCell>
                          <TableCell>
                            <code>{cred.password}</code>
                          </TableCell>
                          <TableCell align='right'>
                            <Button
                              size='small'
                              onClick={() => copyText(cred.password, `${cred.username}'s password`)}
                            >
                              Copy
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Stack>
            )}
          </Stack>
        </Paper>
      )}

      {rows.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack
              direction={{ sm: 'row', xs: 'column' }}
              justifyContent='space-between'
              alignItems={{ sm: 'center' }}
              spacing={2}
            >
              <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                <Chip color='success' label={`Create: ${counts.create}`} size='small' />
                <Chip color='primary' label={`Update: ${counts.update}`} size='small' />
                <Chip label={`Unchanged: ${counts.unchanged}`} size='small' />
                <Chip color='error' label={`Error: ${counts.error}`} size='small' />
              </Stack>

              <Button
                variant='contained'
                disabled={isSubmitting || executableRows.length === 0 || !targetLeague}
                onClick={() => executeRows(executableRows)}
              >
                Apply {executableRows.length} Change{executableRows.length === 1 ? '' : 's'}
              </Button>
            </Stack>

            <TableContainer>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell padding='checkbox'>
                      <Checkbox
                        checked={allSelected}
                        disabled={isSubmitting || selectableRows.length === 0}
                        onChange={(event) => handleSelectAllToggle(event.target.checked)}
                      />
                    </TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Username</TableCell>
                    <TableCell>Moxfield Decklist URL</TableCell>
                    <TableCell>Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const chip = actionChipProps(row.action);
                    const isDuplicateEdit = duplicatePreviewUsernames.has(
                      normalizeUsername(row.username).toLowerCase(),
                    );
                    const canSelect =
                      (row.action === 'create' || row.action === 'update') && !isDuplicateEdit;

                    return (
                      <TableRow key={row.id}>
                        <TableCell padding='checkbox'>
                          <Checkbox
                            checked={canSelect && row.selected}
                            disabled={isSubmitting || !canSelect}
                            onChange={(event) => handleRowSelectToggle(row.id, event.target.checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip color={chip.color} label={chip.label} size='small' />
                        </TableCell>
                        <TableCell sx={{ minWidth: 180 }}>
                          <TextField
                            size='small'
                            fullWidth
                            disabled={isSubmitting}
                            value={row.username}
                            onChange={(event) => handleRowEdit(row.id, 'username', event.target.value)}
                          />
                          {row.rawUsername && row.rawUsername !== row.username && (
                            <Typography variant='caption' color='text.secondary'>
                              CSV: {row.rawUsername}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ minWidth: 280 }}>
                          <TextField
                            size='small'
                            fullWidth
                            disabled={isSubmitting}
                            value={row.decklistUrl}
                            onChange={(event) => handleRowEdit(row.id, 'decklistUrl', event.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          {isDuplicateEdit ? (
                            <Typography variant='caption' color='error'>
                              Duplicate username in preview
                            </Typography>
                          ) : row.action === 'error' ? (
                            <Typography variant='caption' color='error'>
                              {row.error}
                            </Typography>
                          ) : row.action === 'update' ? (
                            <Typography variant='caption' color='text.secondary'>
                              {row.existingDecklistUrl
                                ? `Replaces: ${row.existingDecklistUrl}`
                                : `Adds to ${targetLeague}`}
                            </Typography>
                          ) : row.action === 'create' ? (
                            <Typography variant='caption' color='text.secondary'>
                              New user + {targetLeague}
                            </Typography>
                          ) : (
                            <Typography variant='caption' color='text.secondary'>
                              Already up to date
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
};

export default BulkUserUpload;
