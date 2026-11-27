# Cloud Firestore setup

The optional client points to the Firebase project `personal-os-12b89`. Today’s app still reads and writes `localStorage`; opening the app does not load the Firebase SDK, send analytics, or upload data. `POS.firebase.connect()` loads the SDK on demand and returns the Firebase app and Firestore client. It does not sign in or read or write documents.

To provision the database:

1. In the Firebase console for `personal-os-12b89`, open **Build → Firestore Database** and create the default database in **Production mode** if it does not already exist.
2. Review [firestore.rules](firestore.rules) against any existing rules. To deploy this ruleset, sign in to the Firebase CLI and run `firebase deploy --only firestore:rules --project personal-os-12b89` from this directory. This replaces the deployed rules for the default database.

The rules deny all client access except to documents under `users/{uid}/data/`, where the signed-in user must match `uid`. An app sign-in and an opt-in save or sync flow are not included. Do not use test-mode rules to work around that.
