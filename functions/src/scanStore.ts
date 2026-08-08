import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

export type ScanStoreOperation =
  | { operation: 'save'; scan: Record<string, unknown> }
  | { operation: 'getById'; id: string }
  | { operation: 'getLatest'; username: string };

export function normalizeGithubUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const username = value.trim().toLowerCase();
  return /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/.test(username) ? username : null;
}

export function parseScanStoreOperation(value: unknown): ScanStoreOperation | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  if (input.operation === 'getById' && typeof input.id === 'string' && /^[A-Za-z\d]{1,64}$/.test(input.id)) {
    return { operation: 'getById', id: input.id };
  }
  if (input.operation === 'getLatest' && normalizeGithubUsername(input.username)) {
    return { operation: 'getLatest', username: input.username as string };
  }
  if (input.operation === 'save' && input.scan && typeof input.scan === 'object' && !Array.isArray(input.scan)) {
    const scan = input.scan as Record<string, unknown>;
    if (!normalizeGithubUsername(scan.username) || typeof scan.timestamp !== 'string') return null;
    if (!Number.isFinite(Date.parse(scan.timestamp))) return null;
    if (JSON.stringify(scan).length > 500_000) return null;
    return { operation: 'save', scan };
  }
  return null;
}

function database() {
  if (getApps().length === 0) initializeApp();
  return getFirestore();
}

export async function executeScanStore(operation: ScanStoreOperation): Promise<{ id?: string; scan: Record<string, unknown> | null }> {
  const db = database();

  if (operation.operation === 'getById') {
    const snapshot = await db.collection('scans').doc(operation.id).get();
    logger.info('scanStore.getById', { id: operation.id, hit: snapshot.exists });
    return { scan: snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null };
  }

  const normalizedUsername = normalizeGithubUsername(
    operation.operation === 'save' ? operation.scan.username : operation.username,
  )!;
  const latestReference = db.collection('latestScans').doc(normalizedUsername);

  if (operation.operation === 'getLatest') {
    const latest = await latestReference.get();
    if (latest.exists) {
      logger.info('scanStore.getLatest', { username: normalizedUsername, hit: true, source: 'latestScans' });
      return { scan: latest.data() as Record<string, unknown> };
    }

    const legacy = await db.collection('scans')
      .where('username', '==', operation.username.trim())
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    if (legacy.empty) {
      logger.info('scanStore.getLatest', { username: normalizedUsername, hit: false });
      return { scan: null };
    }
    const document = legacy.docs[0];
    logger.info('scanStore.getLatest', { username: normalizedUsername, hit: true, source: 'legacyScans' });
    return { scan: { id: document.id, ...document.data() } };
  }

  const normalizedScan = { ...operation.scan, username: normalizedUsername };
  const scanReference = db.collection('scans').doc();
  const savedScan = { ...normalizedScan, id: scanReference.id };
  const batch = db.batch();
  batch.set(scanReference, normalizedScan);
  batch.set(latestReference, savedScan);
  await batch.commit();
  logger.info('scanStore.save', { username: normalizedUsername, id: scanReference.id });
  return { id: scanReference.id, scan: savedScan };
}
