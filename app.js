import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  updateDoc,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

/**
 * TODO: Mit deinen Firebase-Zugangsdaten ersetzen.
 * Diese Website kann danach direkt auf GitHub Pages gehostet werden.
 */
const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

/**
 * Diese 4 E-Mails erhalten spezielle Rechte.
 * Tipp: Passe sie auf eure echten Mail-Adressen an.
 */
const ROOT_ADMIN_EMAIL = "dein.name@example.com";
const CLASS_REP_1_EMAIL = "klassensprecherin1@example.com";
const CLASS_REP_2_EMAIL = "klassensprecherin2@example.com";
const DEPUTY_REP_EMAIL = "stellvertreter@example.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const pendingSection = document.getElementById("pending-section");
const adminPanel = document.getElementById("admin-panel");
const editorPanel = document.getElementById("editor-panel");
const pendingUsersEl = document.getElementById("pending-users");
const tabsEl = document.getElementById("tabs");
const eventsContainer = document.getElementById("events-container");
const userInfo = document.getElementById("user-info");
const logoutBtn = document.getElementById("logout-btn");

let currentRole = null;
let currentSubject = null;
let allEvents = [];

const SUBJECTS = [
  "Mathematik",
  "Deutsch",
  "Englisch",
  "Informatik",
  "Biologie",
  "Geschichte",
  "Geografie",
  "Physik",
  "Chemie",
  "Sonstiges",
];

document.getElementById("register-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("register-name").value.trim();
  const email = document.getElementById("register-email").value.trim().toLowerCase();
  const password = document.getElementById("register-password").value;

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const { role, approved } = deriveInitialRole(email);

    await setDoc(doc(db, "users", cred.user.uid), {
      name,
      email,
      role,
      approved,
      createdAt: new Date().toISOString(),
    });

    toast(approved ? "Account erstellt und direkt freigeschaltet." : "Registriert. Warte auf Freischaltung.");
  } catch (err) {
    toast(`Fehler bei Registrierung: ${err.message}`);
  }
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    toast(`Login fehlgeschlagen: ${err.message}`);
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

document.getElementById("event-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!["admin", "representative", "deputy"].includes(currentRole)) {
    toast("Keine Berechtigung zum Eintragen.");
    return;
  }

  const subject = document.getElementById("event-subject").value;
  const type = document.getElementById("event-type").value;
  const date = document.getElementById("event-date").value;
  const title = document.getElementById("event-title").value.trim();
  const participantsRaw = document.getElementById("event-participants").value.trim();
  const participants = participantsRaw ? participantsRaw.split(",").map((n) => n.trim()).filter(Boolean) : [];

  try {
    await addDoc(collection(db, "events"), {
      subject,
      type,
      date,
      title,
      participants,
      createdBy: auth.currentUser.uid,
      createdAt: new Date().toISOString(),
    });
    e.target.reset();
    toast("Termin gespeichert.");
    await loadEvents();
  } catch (err) {
    toast(`Speichern fehlgeschlagen: ${err.message}`);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    authSection.classList.remove("hidden");
    appSection.classList.add("hidden");
    pendingSection.classList.add("hidden");
    userInfo.classList.add("hidden");
    logoutBtn.classList.add("hidden");
    return;
  }

  const userDoc = await ensureUserDoc(user);
  const profile = userDoc.data();
  currentRole = profile.role;

  userInfo.textContent = `${profile.name} (${profile.role})`;
  userInfo.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");

  if (!profile.approved) {
    authSection.classList.add("hidden");
    appSection.classList.add("hidden");
    pendingSection.classList.remove("hidden");
    return;
  }

  authSection.classList.add("hidden");
  pendingSection.classList.add("hidden");
  appSection.classList.remove("hidden");

  adminPanel.classList.toggle("hidden", currentRole !== "admin");
  editorPanel.classList.toggle("hidden", !["admin", "representative", "deputy"].includes(currentRole));

  if (currentRole === "admin") await loadPendingUsers();
  await loadEvents();
});

async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap;

  const { role, approved } = deriveInitialRole(user.email);
  await setDoc(ref, {
    name: user.displayName || user.email,
    email: user.email,
    role,
    approved,
    createdAt: new Date().toISOString(),
  });
  return getDoc(ref);
}

function deriveInitialRole(email) {
  const lower = (email || "").toLowerCase();
  if (lower === ROOT_ADMIN_EMAIL.toLowerCase()) return { role: "admin", approved: true };
  if ([CLASS_REP_1_EMAIL, CLASS_REP_2_EMAIL].map((v) => v.toLowerCase()).includes(lower)) {
    return { role: "representative", approved: true };
  }
  if (lower === DEPUTY_REP_EMAIL.toLowerCase()) return { role: "deputy", approved: true };
  return { role: "student", approved: false };
}

async function loadPendingUsers() {
  const q = query(collection(db, "users"), where("approved", "==", false));
  const snap = await getDocs(q);
  if (snap.empty) {
    pendingUsersEl.innerHTML = "<p>Keine offenen Freigaben.</p>";
    return;
  }

  pendingUsersEl.innerHTML = "";
  snap.forEach((d) => {
    const u = d.data();
    const row = document.createElement("div");
    row.className = "event";
    row.innerHTML = `
      <div>
        <strong>${u.name}</strong><br>
        <small>${u.email}</small>
      </div>
      <div>
        <button data-id="${d.id}" class="approve-btn">Freigeben</button>
      </div>
    `;
    pendingUsersEl.appendChild(row);
  });

  document.querySelectorAll(".approve-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await updateDoc(doc(db, "users", btn.dataset.id), { approved: true });
      toast("User freigeschaltet.");
      await loadPendingUsers();
    });
  });
}

async function loadEvents() {
  const q = query(collection(db, "events"), orderBy("date", "asc"));
  const snap = await getDocs(q);
  allEvents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderTabs();
  renderEvents(currentSubject || SUBJECTS[0]);
}

function renderTabs() {
  const upcoming = {};
  for (const event of allEvents) {
    if (!upcoming[event.subject]) upcoming[event.subject] = new Set();
    upcoming[event.subject].add(event.type);
  }

  tabsEl.innerHTML = "";
  SUBJECTS.forEach((subject, idx) => {
    const btn = document.createElement("button");
    btn.className = `tab ${currentSubject === subject || (!currentSubject && idx === 0) ? "active" : ""}`;
    btn.textContent = subject;

    const types = [...(upcoming[subject] || [])];
    if (types.length) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = types.join("/");
      btn.appendChild(badge);
    }

    btn.addEventListener("click", () => renderEvents(subject));
    tabsEl.appendChild(btn);
  });
}

function renderEvents(subject) {
  currentSubject = subject;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.firstChild?.textContent === subject));

  const items = allEvents.filter((e) => e.subject === subject);
  if (!items.length) {
    eventsContainer.innerHTML = `<p>Keine Termine für <strong>${subject}</strong>.</p>`;
    return;
  }

  eventsContainer.innerHTML = items
    .map(
      (e) => `
      <article class="event">
        <div>
          <strong>${e.type}: ${e.title}</strong><br>
          <small>Datum: ${formatDate(e.date)}</small>
          ${e.participants?.length ? `<br><small>Namen: ${e.participants.join(", ")}</small>` : ""}
        </div>
      </article>
    `
    )
    .join("");
}

function formatDate(v) {
  if (!v) return "-";
  const d = new Date(`${v}T00:00:00`);
  return d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}
