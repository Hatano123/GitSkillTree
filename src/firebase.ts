import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { 
  getFirestore, collection, addDoc, getDocs, doc, getDoc, query, where, orderBy, limit 
} from 'firebase/firestore';
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
const db = getFirestore(app);

// Analytics is only supported in browser environment and if measurementId is provided
let analytics = null;
if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
  try {
    analytics = getAnalytics(app);
  } catch (e) {
    console.warn("Analytics initialization failed: ", e);
  }
}

export { app, db, analytics };

export async function saveScan(scan: Omit<ScanRecord, 'id'>): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, 'scans'), scan);
    return docRef.id;
  } catch (e) {
    console.error("Error adding document to Firestore: ", e);
    return 'local-dummy-' + Date.now();
  }
}

export async function getScanById(id: string): Promise<ScanRecord | null> {
  try {
    const docRef = doc(db, 'scans', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as ScanRecord;
    }
  } catch (e) {
    console.error("Error fetching document by ID:", e);
  }
  return null;
}

export async function getLatestScanByUsername(username: string): Promise<ScanRecord | null> {
  try {
    const q = query(
      collection(db, 'scans'),
      where('username', '==', username.trim()),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as ScanRecord;
    }
  } catch (e) {
    console.error("Error querying latest scan for user:", e);
  }
  return null;
}

export async function getRecentScans(limitCount = 5): Promise<ScanRecord[]> {
  try {
    const q = query(collection(db, 'scans'), orderBy('timestamp', 'desc'), limit(limitCount));
    const querySnapshot = await getDocs(q);
    const scans: ScanRecord[] = [];
    querySnapshot.forEach((doc) => {
      scans.push({ id: doc.id, ...doc.data() } as ScanRecord);
    });
    return scans;
  } catch (e) {
    console.error("Error getting documents: ", e);
    return [];
  }
}
