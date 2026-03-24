// Firebase Configuration and Initialization

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBMPqA7rqm_OpfTkDYYN2_8sbt8mP8BFXo",
    authDomain: "nrc-takip-3bd3c.firebaseapp.com",
    projectId: "nrc-takip-3bd3c",
    storageBucket: "nrc-takip-3bd3c.firebasestorage.app",
    messagingSenderId: "240783448341",
    appId: "1:240783448341:web:81e43d5ab8768c3837f11c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('Firebase initialized successfully');

// Export for use in other modules
export { app, db, collection, doc, setDoc, getDoc, getDocs, writeBatch };
