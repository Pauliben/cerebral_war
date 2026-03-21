// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCV22rPoBMWETDAxIRJNssA5K6CrK_A-Bc",
  authDomain: "cerebral-war.firebaseapp.com",
  projectId: "cerebral-war",
  storageBucket: "cerebral-war.firebasestorage.app",
  messagingSenderId: "920141610086",
  appId: "1:920141610086:web:bf0f41f22ce2a4baf7c1a7",
  measurementId: "G-DTP6XGN7CN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);