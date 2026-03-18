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

## 1) Firebase-Projekt anlegen

1. Öffne [https://console.firebase.google.com](https://console.firebase.google.com)
2. Erstelle ein Projekt.
3. Aktiviere **Authentication > Sign-in method > Email/Password**.
4. Erstelle **Cloud Firestore** (Production oder Test, danach Regeln setzen).
5. Bei **Project settings > Your apps > Web app** die Config kopieren.

## 2) Config in `app.js` eintragen

In `app.js` folgende Werte ersetzen:

- `firebaseConfig` (`apiKey`, `authDomain`, `projectId`, ...)
- `ROOT_ADMIN_EMAIL`
- `CLASS_REP_1_EMAIL`
- `CLASS_REP_2_EMAIL`
- `DEPUTY_REP_EMAIL`

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
```

## 4) Auf GitHub hochladen

1. Repository erstellen (oder dieses nutzen).
2. Dateien pushen.
3. In GitHub unter **Settings > Pages**:
   - Source: `Deploy from a branch`
   - Branch: `main` (oder dein Branch) / `/root`
4. Nach 1–2 Minuten ist die Seite online.

## 5) Optional: Firebase Hosting statt GitHub Pages

Wenn du Server-seitige Funktionen später willst (z. B. E-Mail-Freigabe-Workflows), ist Firebase Hosting + Cloud Functions besser.

---

## Hinweis

Die Seite funktioniert client-seitig. Sicherheit passiert über Firebase Auth + Firestore Rules.
