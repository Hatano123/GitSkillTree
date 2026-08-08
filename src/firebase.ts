import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { ScanRecord } from './types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app, 'asia-northeast1');

let analytics = null;
if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
  try {
    analytics = getAnalytics(app);
  } catch (error) {
    console.warn('Analytics initialization failed:', error);
  }
}

export { app, analytics };

type ScanStoreRequest =
  | { operation: 'save'; scan: Omit<ScanRecord, 'id'> }
  | { operation: 'getById'; id: string }
  | { operation: 'getLatest'; username: string };

type ScanStoreResponse = { id?: string; scan: ScanRecord | null };
const scanStore = httpsCallable<ScanStoreRequest, ScanStoreResponse>(functions, 'scanStore');

export async function saveScan(scan: Omit<ScanRecord, 'id'>): Promise<string> {
  const result = await scanStore({ operation: 'save', scan });
  if (!result.data.id) throw new Error('スキャン結果を保存できませんでした。');
  return result.data.id;
}

export async function getScanById(id: string): Promise<ScanRecord | null> {
  const result = await scanStore({ operation: 'getById', id });
  return result.data.scan;
}

export async function getLatestScanByUsername(username: string): Promise<ScanRecord | null> {
  const result = await scanStore({ operation: 'getLatest', username });
  return result.data.scan;
}
