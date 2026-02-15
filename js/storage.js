const Storage = {
    KEY: 'nrc_dashboard_data',

    save: function (data) {
        try {
            localStorage.setItem(this.KEY, JSON.stringify(data));
            console.log('Data saved to localStorage');
            return true;
        } catch (e) {
            console.error('Error saving data:', e);
            return false;
        }
    },

    load: function () {
        try {
            const data = localStorage.getItem(this.KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Error loading data:', e);
            return null;
        }
    },

    clear: function () {
        try {
            localStorage.removeItem(this.KEY);
            console.log('Data cleared from localStorage');
            return true;
        } catch (e) {
            console.error('Error clearing data:', e);
            return false;
        }
    }
};
