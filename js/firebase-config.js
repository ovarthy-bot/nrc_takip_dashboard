// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBnA80pK9CTZmMezjIbQZnVa-vdXWNl8ho",
    authDomain: "nrc-takip.firebaseapp.com",
    databaseURL: "https://nrc-takip-default-rtdb.firebaseio.com",
    projectId: "nrc-takip",
    storageBucket: "nrc-takip.firebasestorage.app",
    messagingSenderId: "844697253551",
    appId: "1:844697253551:web:5c92aa497e4b63c674465a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
