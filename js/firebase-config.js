// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDVKuFoudpThq6jSN94WDnN99ayLuuxlAQ",
  authDomain: "ssi-inventory.firebaseapp.com",
  projectId: "ssi-inventory",
  storageBucket: "ssi-inventory.firebasestorage.app",
  messagingSenderId: "90864108725",
  appId: "1:90864108725:web:625c8234c0a30fadecaafc",
  measurementId: "G-3MB28HND66"
};

// Initialize Firebase (using compat version for easier integration)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

console.log('✅ Firebase initialized successfully');
