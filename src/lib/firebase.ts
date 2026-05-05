
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, FirebaseOptions } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Synchronized with Studio project credentials
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyByV02yQsF8ycteDW83vRI_HJWzxeCD3kA",
  authDomain: "bfpc-paw.firebaseapp.com",
  projectId: "bfpc-paw",
  storageBucket: "bfpc-paw.firebasestorage.app",
  messagingSenderId: "14462727123",
  appId: "1:14462727123:web:b05d3fd1c3d263c701f526",
  measurementId: "G-X5T4JZGGZF"
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const db = getFirestore(app);

export { app, db };
