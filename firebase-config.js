// firebase-config.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDJ8uiR2qEUfXIuFEO21-40668WNpOdj2w",
  authDomain: "c0uchz0mb13.firebaseapp.com",
  projectId: "c0uchz0mb13",
  storageBucket: "c0uchz0mb13.firebasestorage.app",
  messagingSenderId: "1051521591004",
  appId: "1:1051521591004:web:1301f129fc0f3032f6f619",
  measurementId: "G-6BNDYZQRPE"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);