// Firebase Config - Kullanıcı tarafından doldurulmalı
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "ID",
    appId: "APP_ID"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const Storage = {
    saveData: async (data) => {
        localStorage.setItem('nrc_data', JSON.stringify(data));
        // Firebase Sync
        try { await db.ref('dashboard_data').set(data); } catch(e) { console.error("Firebase Hatası:", e); }
    },
    loadData: () => JSON.parse(localStorage.getItem('nrc_data')),
    
    saveMappings: (mappings) => {
        localStorage.setItem('nrc_mappings', JSON.stringify(mappings));
        db.ref('aircraft_mappings').set(mappings);
    },
    loadMappings: () => JSON.parse(localStorage.getItem('nrc_mappings')) || {}
};
