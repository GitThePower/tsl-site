import type { User } from '../../../backend/src/types';

export type ImportRowAction = 'create' | 'error' | 'unchanged' | 'update';

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export interface ReconcileResult {
  duplicateCount: number;
  rows: ReconciledImportRow[];
}

export interface ReconciledImportRow {
  action: ImportRowAction;
  decklistUrl: string;
  error?: string;
  existingDecklistUrl?: string;
  existingUser?: User;
  id: string;
  rawUsername: string;
  selected: boolean;
  sourceRowNumber: number;
  username: string;
}

const MOXFIELD_DECK_URL_REGEX = /^https?:\/\/(www\.)?moxfield\.com\/decks\/[A-Za-z0-9_-]+(\/.*|\?.*)?$/;

export const normalizeUsername = (raw: string): string => raw.trim().replace(/^@+/, '').trim();

export const isValidMoxfieldUrl = (url: string): boolean => MOXFIELD_DECK_URL_REGEX.test(url.trim());

export const parseCsv = (rawText: string): ParsedCsv => {
  const text = rawText.replace(/^\uFEFF/, '');
  if (!text.trim()) {
    return { headers: [], rows: [] };
  }

  const parsedRows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentField);
      currentField = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') {
        i++;
      }
      currentRow.push(currentField);
      parsedRows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else if (ch === '\n') {
      currentRow.push(currentField);
      parsedRows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += ch;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    parsedRows.push(currentRow);
  }

  const nonEmptyRows = parsedRows.filter((row) => row.some((cell) => cell.trim().length > 0));
  if (nonEmptyRows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = nonEmptyRows[0].map((header) => header.trim());
  const rows = nonEmptyRows.slice(1);
  return { headers, rows };
};

export const detectColumns = (headers: string[]): { decklistCol: number; usernameCol: number } => {
  let usernameCol = headers.findIndex((header) => /discord/i.test(header));
  if (usernameCol === -1) {
    usernameCol = headers.findIndex((header) => /username|user\s*name/i.test(header));
  }

  const decklistCol = headers.findIndex((header) => /moxfield|decklist|deck\s*list|deck\s*url/i.test(header));

  return { decklistCol, usernameCol };
};

export const evaluateImportRow = (
  usernameInput: string,
  decklistUrlInput: string,
  existingUsers: User[],
  targetLeagueName: string,
): Pick<ReconciledImportRow, 'action' | 'decklistUrl' | 'error' | 'existingDecklistUrl' | 'existingUser' | 'username'> => {
  const normalizedUsername = normalizeUsername(usernameInput);
  const trimmedUrl = decklistUrlInput.trim();

  if (!targetLeagueName) {
    return {
      action: 'error',
      decklistUrl: trimmedUrl,
      error: 'Select a target league',
      username: normalizedUsername,
    };
  }

  if (!normalizedUsername) {
    return {
      action: 'error',
      decklistUrl: trimmedUrl,
      error: 'Username is required',
      username: normalizedUsername,
    };
  }

  if (!trimmedUrl) {
    return {
      action: 'error',
      decklistUrl: trimmedUrl,
      error: 'Decklist URL is required',
      username: normalizedUsername,
    };
  }

  if (!isValidMoxfieldUrl(trimmedUrl)) {
    return {
      action: 'error',
      decklistUrl: trimmedUrl,
      error: 'Invalid Moxfield decklist URL',
      username: normalizedUsername,
    };
  }

  const existingUser = existingUsers.find(
    (user) => (user.username || '').toLowerCase() === normalizedUsername.toLowerCase(),
  );

  if (existingUser) {
    const resolvedUsername = existingUser.username || normalizedUsername;
    const existingEntry = existingUser.leagues?.find((entry) => entry.leaguename === targetLeagueName);
    const action: ImportRowAction = existingEntry?.decklistUrl === trimmedUrl ? 'unchanged' : 'update';

    return {
      action,
      decklistUrl: trimmedUrl,
      existingDecklistUrl: existingEntry?.decklistUrl,
      existingUser,
      username: resolvedUsername,
    };
  }

  return {
    action: 'create',
    decklistUrl: trimmedUrl,
    username: normalizedUsername,
  };
};

export const reconcileCsvRows = (
  rows: string[][],
  usernameCol: number,
  decklistCol: number,
  existingUsers: User[],
  targetLeagueName: string,
): ReconcileResult => {
  const dedupedEntries = new Map<string, {
    rawDecklist: string;
    rawUsername: string;
    sourceRowNumber: number;
  }>();
  let duplicateCount = 0;

  rows.forEach((row, idx) => {
    const rawUsername = usernameCol >= 0 ? (row[usernameCol] ?? '') : '';
    const rawDecklist = decklistCol >= 0 ? (row[decklistCol] ?? '') : '';

    if (!rawUsername.trim() && !rawDecklist.trim()) {
      return;
    }

    const normalized = normalizeUsername(rawUsername);
    const key = normalized ? normalized.toLowerCase() : `__empty_${idx}`;
    if (normalized && dedupedEntries.has(key)) {
      duplicateCount++;
    }

    dedupedEntries.set(key, {
      rawDecklist,
      rawUsername,
      sourceRowNumber: idx + 2,
    });
  });

  const reconciledRows: ReconciledImportRow[] = [];
  Array.from(dedupedEntries.values()).forEach((entry, index) => {
    const evaluation = evaluateImportRow(
      entry.rawUsername,
      entry.rawDecklist,
      existingUsers,
      targetLeagueName,
    );
    reconciledRows.push({
      ...evaluation,
      id: `row-${entry.sourceRowNumber}-${index}`,
      rawUsername: entry.rawUsername.trim(),
      selected: evaluation.action === 'create' || evaluation.action === 'update',
      sourceRowNumber: entry.sourceRowNumber,
    });
  });

  return {
    duplicateCount,
    rows: reconciledRows,
  };
};

export const reconcileEditableRow = (
  row: ReconciledImportRow,
  existingUsers: User[],
  targetLeagueName: string,
): ReconciledImportRow => {
  const evaluation = evaluateImportRow(
    row.username,
    row.decklistUrl,
    existingUsers,
    targetLeagueName,
  );
  const nextSelected = evaluation.action === 'create' || evaluation.action === 'update'
    ? (row.action === 'error' || row.action === 'unchanged' ? true : row.selected)
    : false;

  return {
    ...row,
    ...evaluation,
    selected: nextSelected,
  };
};

const escapeCsvCell = (value: string): string => {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

export const buildCredentialsCsv = (
  credentials: Array<{ password: string; username: string }>,
): string => {
  const lines = ['username,password'];
  for (const item of credentials) {
    lines.push(`${escapeCsvCell(item.username)},${escapeCsvCell(item.password)}`);
  }
  return lines.join('\n');
};
