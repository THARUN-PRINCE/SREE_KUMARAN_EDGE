import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBXNVMpshwho3fF9I8lhrntetW512b3-8s",
  authDomain: "sree-kumaran-edge.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://sree-kumaran-edge-default-rtdb.firebaseio.com",
  projectId: "sree-kumaran-edge",
  storageBucket: "sree-kumaran-edge.firebasestorage.app",
  messagingSenderId: "565085839711",
  appId: "1:565085839711:web:6deaa0a1e904a8748c56ea",
  measurementId: "G-83FGL7P5DY",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
