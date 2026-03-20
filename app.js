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
  deleteDoc,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

let firebaseConfig = {};
// ⭐ ÄNDERE DIESE E-MAILS! Setze hier deine E-Mail damit du auto-freigeschaltet wirst
let ROOT_ADMIN_EMAIL = "Matthias.HANDL@ahsbruck.at"; // Ändere zu deiner E-Mail!
let CLASS_REP_1_EMAIL = "klassensprecherin1@example.com";
let CLASS_REP_2_EMAIL = "klassensprecherin2@example.com";
let DEPUTY_REP_EMAIL = "stellvertreter@example.com";

const authSection = document.getElementById("auth-section");
const appSection = document.getElementById("app-section");
const pendingSection = document.getElementById("pending-section");
const setupSection = document.getElementById("setup-section");
const adminPanel = document.getElementById("admin-panel");
const editorPanel = document.getElementById("editor-panel");
const pendingUsersEl = document.getElementById("pending-users");
const tabsEl = document.getElementById("tabs");
const eventsContainer = document.getElementById("events-container");
const userInfo = document.getElementById("user-info");
const logoutBtn = document.getElementById("logout-btn");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

let auth = null;
let db = null;
let currentRole = null;
let currentSubject = null;
let allEvents = [];
let editingEventId = null;

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

bootstrap();

async function bootstrap() {
  const runtimeConfig = await loadRuntimeConfig();
  firebaseConfig = runtimeConfig.firebaseConfig || {};
  ROOT_ADMIN_EMAIL = runtimeConfig.rootAdminEmail || ROOT_ADMIN_EMAIL;
  CLASS_REP_1_EMAIL = runtimeConfig.classRep1Email || CLASS_REP_1_EMAIL;
  CLASS_REP_2_EMAIL = runtimeConfig.classRep2Email || CLASS_REP_2_EMAIL;
  DEPUTY_REP_EMAIL = runtimeConfig.deputyRepEmail || DEPUTY_REP_EMAIL;

  if (isFirebaseConfigured(firebaseConfig)) {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    wireAuthState();
  } else {
    showSetupNotice();
  }
}

async function loadRuntimeConfig() {
  try {
    const res = await fetch("./firebase-config.json", { cache: "no-store" });
    if (res.ok) return await res.json();
  } catch (_) {
    // fallback
  }
  return window.CLASSPLANNER_CONFIG || {};
}

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!auth || !db) return;

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

    toast(approved ? "✅ Account erstellt und direkt freigeschaltet." : "⏳ Registriert. Warte auf Freischaltung.");
  } catch (err) {
    toast(`❌ Fehler bei Registrierung: ${friendlyAuthError(err)}`);
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!auth) return;

  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    toast("✅ Angemeldet!");
  } catch (err) {
    toast(`❌ Login fehlgeschlagen: ${friendlyAuthError(err)}`);
  }
});

logoutBtn.addEventListener("click", () => auth && signOut(auth));

// Event Bearbeitung starten
function startEditEvent(eventId) {
  const event = allEvents.find(e => e.id === eventId);
  if (!event) return;
  
  editingEventId = eventId;
  document.getElementById("event-subject").value = event.subject;
  document.getElementById("event-type").value = event.type;
  document.getElementById("event-date").value = event.date;
  document.getElementById("event-title").value = event.title;
  document.getElementById("event-participants").value = event.participants?.join(", ") || "";
  
  const submitBtn = document.querySelector("#event-form button[type='submit']");
  const cancelBtn = document.getElementById("cancel-edit-btn");
  submitBtn.textContent = "Änderungen speichern";
  cancelBtn.classList.remove("hidden");
  
  editorPanel.scrollIntoView({ behavior: "smooth" });
}

// Event Bearbeitung abbrechen
function cancelEditEvent() {
  editingEventId = null;
  document.getElementById("event-form").reset();
  const submitBtn = document.querySelector("#event-form button[type='submit']");
  const cancelBtn = document.getElementById("cancel-edit-btn");
  submitBtn.textContent = "Speichern";
  cancelBtn.classList.add("hidden");
}

document.getElementById("event-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!auth || !db) return;
  if (!["admin", "representative", "deputy"].includes(currentRole)) {
    toast("❌ Keine Berechtigung zum Eintragen.");
    return;
  }

  const subject = document.getElementById("event-subject").value;
  const type = document.getElementById("event-type").value;
  const date = document.getElementById("event-date").value;
  const title = document.getElementById("event-title").value.trim();
  const participantsRaw = document.getElementById("event-participants").value.trim();
  const participants = participantsRaw ? participantsRaw.split(",").map((n) => n.trim()).filter(Boolean) : [];

  try {
    if (editingEventId) {
      await updateDoc(doc(db, "events", editingEventId), {
        subject,
        type,
        date,
        title,
        participants,
        updatedAt: new Date().toISOString(),
      });
      toast("✅ Termin aktualisiert.");
      editingEventId = null;
    } else {
      await addDoc(collection(db, "events"), {
        subject,
        type,
        date,
        title,
        participants,
        createdBy: auth.currentUser.uid,
        createdAt: new Date().toISOString(),
      });
      toast("✅ Termin gespeichert.");
    }
    e.target.reset();
    cancelEditEvent();
    await loadEvents();
  } catch (err) {
    toast(`❌ Speichern fehlgeschlagen: ${err.message}`);
  }
});

document.getElementById("cancel-edit-btn").addEventListener("click", cancelEditEvent);

// ⭐ WICHTIG: Diese Funktion kontrolliert das Routing nach dem Login!
function wireAuthState() {
  onAuthStateChanged(auth, async (user) => {
    // Nicht angemeldet
    if (!user) {
      authSection.classList.remove("hidden");
      appSection.classList.add("hidden");
      pendingSection.classList.add("hidden");
      userInfo.classList.add("hidden");
      logoutBtn.classList.add("hidden");
      return;
    }

    try {
      const userDoc = await ensureUserDoc(user);
      const profile = userDoc.data();
      currentRole = profile.role;

      // Zeige Benutzerinfo
      userInfo.textContent = `👤 ${profile.name} (${profile.role})`;
      userInfo.classList.remove("hidden");
      logoutBtn.classList.remove("hidden");

      // ⭐ WICHTIG: Wenn nicht freigeschaltet -> warte auf Admin
      if (!profile.approved) {
        console.warn("Benutzer nicht freigeschaltet:", profile.email);
        authSection.classList.add("hidden");
        appSection.classList.add("hidden");
        pendingSection.classList.remove("hidden");
        toast("⏳ Dein Account wartet auf Freischaltung durch einen Admin.");
        return;
      }

      // ✅ FREIGESCHALTET - Zeige alles!
      console.log("✅ Benutzer freigeschaltet. Zeige Dashboard...");
      authSection.classList.add("hidden");
      pendingSection.classList.add("hidden");
      appSection.classList.remove("hidden");

      // Zeige Admin-Panel nur für Admins
      adminPanel.classList.toggle("hidden", currentRole !== "admin");
      
      // Zeige Editor-Panel nur für Lehrer/Vertreter
      editorPanel.classList.toggle("hidden", !["admin", "representative", "deputy"].includes(currentRole));

      // Lade Daten
      if (currentRole === "admin") await loadPendingUsers();
      await loadEvents();
      
      toast(`✅ Willkommen, ${profile.name}!`);
    } catch (err) {
      console.error("Auth Error:", err);
      toast(`❌ Fehler: ${err.message}`);
    }
  });
}

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
    pendingUsersEl.innerHTML = "<p>✅ Keine offenen Freigaben.</p>";
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
      toast("✅ User freigeschaltet.");
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
    .map((e) => {
      const canEdit = ["admin", "representative", "deputy"].includes(currentRole) && e.createdBy === auth.currentUser.uid;
      return `
        <article class="event" data-event-id="${e.id}">
          <div class="event-content">
            <strong>${e.type}: ${e.title}</strong><br>
            <small>📅 ${formatDate(e.date)}</small>
            ${e.participants?.length ? `<br><small>👥 ${e.participants.join(", ")}</small>` : ""}
          </div>
          ${canEdit ? `
            <div class="event-actions">
              <button class="edit-btn" data-id="${e.id}" title="Bearbeiten">✏️</button>
              <button class="delete-btn" data-id="${e.id}" title="Löschen">🗑️</button>
            </div>
          ` : ""}
        </article>
      `;
    })
    .join("");

  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => startEditEvent(btn.dataset.id));
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (confirm("🗑️ Diesen Termin wirklich löschen?")) {
        try {
          await deleteDoc(doc(db, "events", btn.dataset.id));
          toast("✅ Termin gelöscht!");
          await loadEvents();
        } catch (err) {
          toast(`❌ Fehler beim Löschen: ${err.message}`);
        }
      }
    });
  });
}

function formatDate(v) {
  if (!v) return "-";
  const d = new Date(`${v}T00:00:00`);
  return d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function showSetupNotice() {
  setupSection.classList.remove("hidden");
  disableAuthForms();
  toast("❌ Firebase ist noch nicht konfiguriert. Bitte firebase-config.json eintragen.");
}

function disableAuthForms() {
  [...loginForm.elements, ...registerForm.elements].forEach((el) => {
    if ("disabled" in el) el.disabled = true;
  });
}

function isFirebaseConfigured(config) {
  const required = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId"];
  return required.every((key) => {
    const value = (config[key] || "").trim();
    return value && value !== "REPLACE_ME";
  });
}

function friendlyAuthError(err) {
  const code = err?.code || "";
  if (code.includes("auth/email-already-in-use")) return "Diese E-Mail wird bereits verwendet.";
  if (code.includes("auth/invalid-email")) return "Ungültige E-Mail-Adresse.";
  if (code.includes("auth/weak-password")) return "Passwort ist zu kurz (mind. 6 Zeichen).";
  if (code.includes("auth/invalid-credential")) return "E-Mail oder Passwort sind falsch.";
  if (code.includes("auth/api-key-not-valid")) return "Firebase API-Key ist ungültig. Prüfe firebase-config.json.";
  if (code.includes("auth/configuration-not-found")) {
    return "Auth-Konfiguration fehlt: In Firebase unter Authentication > Sign-in method E-Mail/Passwort aktivieren und unter Authorized domains deine GitHub-Domain eintragen.";
  }
  return err?.message || "Unbekannter Fehler";
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}
