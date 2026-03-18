# Klassenplaner 4B (GitHub Pages + Firebase)

Diese Website ermöglicht:

- Registrierung mit **Name, E-Mail, Passwort**.
- Anmeldung mit **E-Mail + Passwort**.
- **Admin-Freigabe** für neue User.
- Rollen:
  - `admin` (du als Coder, alle Rechte)
  - `representative` (2 Klassensprecherinnen, dürfen Termine eintragen)
  - `deputy` (Klassensprecher-Stellvertretung, darf Termine eintragen)
  - `student` (darf nur sehen, wenn freigeschaltet)
- Tabs pro Fach mit Badge (z. B. `HÜ/Test/SA/MÜ`), wenn Termine eingetragen sind.

## Wichtig zum Fehler `identitytoolkit ... REPLACE_ME`

Wenn du diesen Fehler siehst, sind in `firebase-config.js` noch Platzhalterwerte aktiv oder die Datei wurde nicht korrekt geladen.

## 1) Firebase-Projekt anlegen

1. Öffne [https://console.firebase.google.com](https://console.firebase.google.com)
2. Erstelle ein Projekt.
3. Aktiviere **Authentication > Sign-in method > Email/Password**.
4. Erstelle **Cloud Firestore** (Production oder Test, danach Regeln setzen).
5. Bei **Project settings > Your apps > Web app** die Config kopieren.

## 2) `firebase-config.js` ausfüllen

Im Repo gibt es:

- `firebase-config.js` (Projektwerte sind bereits eingetragen; Rollen-E-Mails bitte anpassen)
- `firebase-config.example.js` (Beispiel)

Trage in `firebase-config.js` ein:

- `firebaseConfig` (`apiKey`, `authDomain`, `projectId`, ...)
- `rootAdminEmail`
- `classRep1Email`
- `classRep2Email`
- `deputyRepEmail`

## 3) Firestore-Regeln setzen

Nutze als Start diese Regeln (Datei: `firestore.rules`):

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow create: if request.auth != null && request.auth.uid == uid;
      allow read: if request.auth != null;
      allow update: if request.auth != null && (
        request.auth.uid == uid ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin'
      );
      allow delete: if false;
    }

    match /events/{eventId} {
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.approved == true;

      allow create: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'representative', 'deputy'];

      allow update, delete: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
