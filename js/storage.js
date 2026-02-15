const Storage = {
    // Firebase Config (Kullanıcı burayı doldurmalı)
    config: { databaseURL: "https://PROJE_ID.firebaseio.com" },
    
    initFirebase: function() {
        if (!firebase.apps.length) {
            try { firebase.initializeApp(this.config); } catch(e) { console.warn("Firebase config eksik."); }
        }
    },

    saveAll: async function(data, timestamp) {
        const payload = { data, timestamp };
        localStorage.setItem('nrc_dashboard_data', JSON.stringify(payload));
        try { await firebase.database().ref('maintenance_data').set(payload); } catch(e) {}
    },

    loadAll: function() {
        return JSON.parse(localStorage.getItem('nrc_dashboard_data'));
    },

    saveMappings: async function(mappings) {
        localStorage.setItem('nrc_mappings', JSON.stringify(mappings));
        try { await firebase.database().ref('aircraft_mappings').set(mappings); } catch(e) {}
    },

    loadMappings: function() {
        return JSON.parse(localStorage.getItem('nrc_mappings')) || {};
    }
};
