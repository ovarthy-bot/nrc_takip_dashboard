const Storage = {
    COLLECTION: 'nrc_dashboard',
    DOC_ID: 'main_data',
    KEY: 'nrc_dashboard_data', // Fallback for localStorage

    // Save data to Firestore
    save: async function (data) {
        try {
            // Wait for Firestore to be ready
            const db = await FirestoreUtils.waitForFirestore();
            const { doc, setDoc, serverTimestamp } = await FirestoreUtils.getFirestoreFunctions();

            // Save to Firestore
            const docRef = doc(db, this.COLLECTION, this.DOC_ID);
            await setDoc(docRef, {
                headers: data.headers || [],
                data: data.data || [],
                lastUpdated: serverTimestamp()
            });

            console.log('Data saved to Firestore');

            // Also save to localStorage as backup
            localStorage.setItem(this.KEY, JSON.stringify(data));

            return true;
        } catch (e) {
            console.error('Error saving data to Firestore:', e);

            // Fallback to localStorage
            try {
                localStorage.setItem(this.KEY, JSON.stringify(data));
                console.log('Data saved to localStorage (fallback)');
                return true;
            } catch (localErr) {
                console.error('Error saving to localStorage:', localErr);
                return false;
            }
        }
    },

    // Load data from Firestore
    load: async function () {
        try {
            // Wait for Firestore to be ready
            const db = await FirestoreUtils.waitForFirestore();
            const { doc, getDoc } = await FirestoreUtils.getFirestoreFunctions();

            // Load from Firestore
            const docRef = doc(db, this.COLLECTION, this.DOC_ID);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const firestoreData = docSnap.data();
                console.log('Data loaded from Firestore');
                return {
                    headers: firestoreData.headers || [],
                    data: firestoreData.data || []
                };
            } else {
                console.log('No data found in Firestore, checking localStorage...');

                // Try localStorage as fallback
                const localData = localStorage.getItem(this.KEY);
                if (localData) {
                    const parsed = JSON.parse(localData);
                    console.log('Data loaded from localStorage');

                    // Migrate to Firestore
                    await this.save(parsed);
                    console.log('Data migrated from localStorage to Firestore');

                    return parsed;
                }

                return null;
            }
        } catch (e) {
            console.error('Error loading data from Firestore:', e);

            // Fallback to localStorage
            try {
                const data = localStorage.getItem(this.KEY);
                if (data) {
                    console.log('Data loaded from localStorage (fallback)');
                    return JSON.parse(data);
                }
                return null;
            } catch (localErr) {
                console.error('Error loading from localStorage:', localErr);
                return null;
            }
        }
    },

    // Clear data from Firestore
    clear: async function () {
        try {
            // Wait for Firestore to be ready
            const db = await FirestoreUtils.waitForFirestore();
            const { doc, deleteDoc } = await FirestoreUtils.getFirestoreFunctions();

            // Delete from Firestore
            const docRef = doc(db, this.COLLECTION, this.DOC_ID);
            await deleteDoc(docRef);

            console.log('Data cleared from Firestore');

            // Also clear localStorage
            localStorage.removeItem(this.KEY);

            return true;
        } catch (e) {
            console.error('Error clearing data from Firestore:', e);

            // Fallback to localStorage
            try {
                localStorage.removeItem(this.KEY);
                console.log('Data cleared from localStorage (fallback)');
                return true;
            } catch (localErr) {
                console.error('Error clearing localStorage:', localErr);
                return false;
            }
        }
    }
};
