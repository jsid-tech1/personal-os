# Firestore API disabled — project-owner recovery

The screenshot is a Google Cloud `SERVICE_DISABLED` error for `personal-os-12b89`. App changes cannot enable a Google Cloud service without project-owner/admin authorization. Google sign-in and local saving can continue independently of Firestore.

## Required owner actions

1. Open [Firestore API](https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=personal-os-12b89), confirm the selected project, and choose **Enable**.
2. Open [Firebase → Firestore Database](https://console.firebase.google.com/project/personal-os-12b89/firestore). If no database exists, choose **Create database**, use the **default** database and **production mode**, and choose the appropriate region. Do not use public/test-mode rules as a workaround. Database location cannot be changed in place.
3. Publish the repository's `firestore.rules` in the Firebase console's Rules tab, or use an authorized Firebase CLI:

   ```
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules --project personal-os-12b89
   ```

4. Allow a few minutes for API activation to propagate. Return to **Profile → Cloud backup → Save cloud backup**. A successful save should show its timestamp. Test restore with a recovery copy before relying on cloud backup.

Do not put Google Cloud access tokens or service-account keys into browser JavaScript, chat, or Git. This machine currently has no verified authenticated project-owner CLI session; no API activation, database creation, region choice or production deployment is claimed.

## App repair

- Disabled-service responses are recognized before the generic permission-denied mapping.
- The app shows a short explanation, preserves local work, and provides direct API/database setup links instead of dumping the long Google error URL into the layout.
- Retry is available through the normal Save cloud backup action after configuration is corrected.
- Committed unresolved merge markers were also found in entry HTML, API files and API tests. Reconciled them to prevent duplicate app initialization and invalid server syntax. Preserved the newer DeepSeek planning transport, live voice endpoint, conversation handler, self-hosted typography and first-paint loader. Did not re-enable automatic cloud uploads over the newer manual-backup architecture.

Verification: 14 API/planning/integrity tests pass; six focused browser checks pass, including disabled-API recovery, local-data preservation, manual-backup retry and the newer DeepSeek flow. One additional legacy browser test still expects automatic adoption of an unowned pre-sign-in workspace; the newer account-isolation store does not adopt it. That unrelated expectation was not changed or bypassed. Build passes. Production API activation and owner/non-owner Firestore testing still require owner access.
