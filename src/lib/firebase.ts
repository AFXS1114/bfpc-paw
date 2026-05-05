
// src/lib/firebase.ts
import { initializeApp, getApps, getApp, FirebaseOptions } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Synchronized with Studio project credentials
const firebaseConfig: FirebaseOptions = {
  projectId: "studio-95806379-26728",
  appId: "1:358708284671:web:95db2e617319c5319d10ca",
  apiKey: "AIzaSyBB8dGyuHWZcxQ19OjxOCN1qzYPqvb2IfQ",
  authDomain: "studio-95806379-26728.firebaseapp.com",
  messagingSenderId: "358708284671"
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
