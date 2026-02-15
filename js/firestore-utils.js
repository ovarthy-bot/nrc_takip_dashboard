// Firestore utility functions
// This file provides helper functions for Firestore operations

const FirestoreUtils = {
    // Wait for Firestore to be initialized
    waitForFirestore: function () {
        return new Promise((resolve) => {
            const checkFirestore = () => {
                if (window.firestoreDB) {
                    resolve(window.firestoreDB);
                } else {
                    setTimeout(checkFirestore, 50);
                }
            };
            checkFirestore();
        });
    },

    // Import Firestore functions dynamically
    getFirestoreFunctions: async function () {
        const { doc, setDoc, getDoc, deleteDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        return { doc, setDoc, getDoc, deleteDoc, serverTimestamp };
    }
};
