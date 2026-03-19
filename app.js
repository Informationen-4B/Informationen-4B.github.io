// React + Firebase Klassenplaner (einfaches Starterprojekt)
// Du brauchst: Firebase Projekt -> Authentication (Email/Password) + Firestore

import { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";

// 🔥 HIER DEINE FIREBASE DATEN EINTRAGEN
const firebaseConfig = {
  apiKey: "DEIN_API_KEY",
  authDomain: "DEIN_PROJECT.firebaseapp.com",
  projectId: "DEIN_PROJECT_ID",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const subjects = [
  "Mathe","Deutsch","Englisch","Geschichte","Geographie","Religion",
  "Physik","Physik Labor","Chemie","Chemie Labor","Biologie",
  "Grafisches Zeichnen","Digitale Grundbildung","Italienisch","Sport"
];

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("Mathe");
  const [entries, setEntries] = useState([]);
  const [newEntry, setNewEntry] = useState("");

  const register = async () => {
    const res = await createUserWithEmailAndPassword(auth, email, password);
    await addDoc(collection(db, "users"), {
      uid: res.user.uid,
      name,
      email,
      approved: false,
      role: "student"
    });
    alert("Account erstellt – warte auf Freigabe");
  };

  const login = async () => {
    const res = await signInWithEmailAndPassword(auth, email, password);
    setUser(res.user);
  };

  const loadEntries = async () => {
    const querySnapshot = await getDocs(collection(db, selectedSubject));
    setEntries(querySnapshot.docs.map(doc => doc.data()));
  };

  const addEntry = async () => {
    await addDoc(collection(db, selectedSubject), {
      text: newEntry,
      date: new Date().toLocaleDateString()
    });
    setNewEntry("");
    loadEntries();
  };

  useEffect(() => {
    if (user) loadEntries();
  }, [selectedSubject, user]);

  if (!user) {
    return (
      <div className="p-4">
        <h1>Login / Registrierung</h1>
        <input placeholder="Name" onChange={e => setName(e.target.value)} />
        <input placeholder="Email" onChange={e => setEmail(e.target.value)} />
        <input placeholder="Passwort" type="password" onChange={e => setPassword(e.target.value)} />
        <button onClick={register}>Registrieren</button>
        <button onClick={login}>Login</button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h1>Klassenplaner</h1>

      <div className="flex gap-2 flex-wrap">
        {subjects.map(sub => (
          <button key={sub} onClick={() => setSelectedSubject(sub)}>
            {sub}
          </button>
        ))}
      </div>

      <h2>{selectedSubject}</h2>

      <ul>
        {entries.map((e, i) => (
          <li key={i}>{e.date} - {e.text}</li>
        ))}
      </ul>

      <div>
        <input placeholder="Neuer Termin (z.B. Mathe Test)" value={newEntry} onChange={e => setNewEntry(e.target.value)} />
        <button onClick={addEntry}>Eintragen</button>
      </div>
    </div>
  );
}
