# Demo Day — seven minutes, then three minutes of Q&A

Course slot: L13, Friday 27 November, from 2:15pm (as written in the source; confirm the calendar year with the course).

## Before the demo

Deploy using `FIREBASE_SETUP.md`. Test the returned HTTPS URL on a phone, using a real Google account and the published Firestore rules. Prepare a clean account for the first-use story and another browser signed into the same account for restore. Keep the original workspace exported. Rehearse the Google account chooser rather than assuming it will already be signed in.

## Timed script

| Time | Show | Say |
| --- | --- | --- |
| 0:00–0:45 | Public landing page, including phone layout | “Personal OS is a daily planner for design students managing coursework and portfolio deadlines.” Describe one real situation from class. |
| 0:45–1:30 | Continue with Google → empty Today | Explain that the same button creates an account and signs returning users in. Point out the empty workspace and first task form. |
| 1:30–2:30 | Add a real task, e.g. finish the project proposal | Pick date and duration. Show it in Today, then Plan my day; explain proposals require approval. |
| 2:30–3:15 | Complete the task and reload | Show updated progress and that the task remains completed. Explain browser-local autosave. |
| 3:15–4:15 | Save cloud backup; restore on the second device | Show the real success message and explicit replacement confirmation. Explain one cloud snapshot per UID and manual saving. |
| 4:15–5:00 | Sign out / account isolation, one handled error if time allows | Explain that another account has its own workspace. A cancelled sign-in or offline backup gives a recoverable message. |
| 5:00–6:15 | Process log, proposal, selected test evidence | Describe how AI was directed, the shared-key bug, the empty-state discovery, and the completion-test correction. Show original evidence for milestones if available. |
| 6:15–7:00 | Stack diagram in words and next step | Browser → Firebase Auth for identity → Firestore for explicit snapshots. State that the planner is local rules, not a model. Close with one real user learning and the next change it justifies. |

## Three-minute Q&A preparation

- **Where does this data live?** Account-scoped localStorage; explicit Firestore snapshot under the Firebase UID.
- **What happens when I click this?** Name the view handler, store action, render/persist step, and network call if there is one.
- **How does it know who I am?** Firebase auth observer and verified UID, not the editable profile name.
- **Can someone change another account's things?** Explain deployed `request.auth.uid == userId` rules and show actual non-owner test evidence.
- **Is the assistant AI?** The current planner is deterministic local logic. AI tools helped build the application; an AI feature is optional in the brief.
- **What failed?** Use the actual process log. Do not claim every sprint went smoothly or every deadline was met without records.
- **What if the network fails?** Already-open authenticated work can save locally. Cloud operations need a connection and show an error. Fresh launch depends on SDK/auth loading.

If the public service fails during rehearsal, fix it before presenting. A recording or local walkthrough can explain behavior during an outage, but it is not evidence that the deployed requirement was met.
