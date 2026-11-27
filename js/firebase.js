/* Cloud Firestore is optional. Nothing connects or leaves the device on startup. */
(function () {
  "use strict";
  const config = {
    apiKey: "AIzaSyCZJYFfeLI89OwqMnQmbXpMRCHx-NANnSs",
    authDomain: "personal-os-12b89.firebaseapp.com",
    projectId: "personal-os-12b89",
    storageBucket: "personal-os-12b89.firebasestorage.app",
    messagingSenderId: "754045514880",
    appId: "1:754045514880:web:e717bc09de1a4109be2265",
  };
  const sdk = "https://www.gstatic.com/firebasejs/13.4.0";
  let connection;

  function connect() {
    if (!connection) {
      connection = Promise.all([
        import(`${sdk}/firebase-app.js`),
        import(`${sdk}/firebase-firestore.js`),
      ]).then(([firebase, firestore]) => {
        const app = firebase.initializeApp(config);
        return { app, db: firestore.getFirestore(app) };
      }).catch((err) => {
        connection = null;
        throw err;
      });
    }
    return connection;
  }

  window.POS.firebase = { connect };
})();
