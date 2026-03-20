// Neue Firebase-Importe hinzufügen:
import { deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// In renderEvents() ändern zu:
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
       <article class="event" data-id="${e.id}">
         <div>
           <strong>${e.type}: ${e.title}</strong><br>
           <small>Datum: ${formatDate(e.date)}</small>
           ${e.participants?.length ? `<br><small>Namen: ${e.participants.join(", ")}</small>` : ""}
         </div>
         <div class="event-actions">
           ${canEditEvent(e) ? `
             <button class="edit-btn" data-id="${e.id}">✏️ Bearbeiten</button>
             <button class="delete-btn danger" data-id="${e.id}">🗑️ Löschen</button>
           ` : ""}
         </div>
       </article>
     `
     )
     .join("");

   // Event-Listener für Edit/Delete
   document.querySelectorAll(".delete-btn").forEach((btn) => {
     btn.addEventListener("click", async () => {
       if (confirm("Wirklich löschen?")) {
         try {
           await deleteDoc(doc(db, "events", btn.dataset.id));
           toast("Termin gelöscht.");
           await loadEvents();
         } catch (err) {
           toast(`Fehler beim Löschen: ${err.message}`);
         }
       }
     });
   });

   document.querySelectorAll(".edit-btn").forEach((btn) => {
     btn.addEventListener("click", () => editEvent(btn.dataset.id));
   });
}

// Hilfsfunktion
function canEditEvent(event) {
  return ["admin", "representative", "deputy"].includes(currentRole) && 
         event.createdBy === auth.currentUser.uid;
}

async function editEvent(eventId) {
  const event = allEvents.find(e => e.id === eventId);
  if (!event) return;
  
  document.getElementById("event-subject").value = event.subject;
  document.getElementById("event-type").value = event.type;
  document.getElementById("event-date").value = event.date;
  document.getElementById("event-title").value = event.title;
  document.getElementById("event-participants").value = event.participants?.join(", ") || "";
  
  // Scrolle zum Formular
  document.getElementById("editor-panel").scrollIntoView({ behavior: "smooth" });
  
  // Speichern überschreiben
  const form = document.getElementById("event-form");
  form.dataset.editId = eventId;
}

// Event-Form Handler anpassen:
document.getElementById("event-form").addEventListener("submit", async (e) => {
   e.preventDefault();
   if (!auth || !db) return;
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
   const form = document.getElementById("event-form");

   try {
     if (form.dataset.editId) {
       // Update
       await updateDoc(doc(db, "events", form.dataset.editId), {
         subject, type, date, title, participants,
         updatedAt: new Date().toISOString()
       });
       toast("Termin aktualisiert.");
       delete form.dataset.editId;
     } else {
       // Create
       await addDoc(collection(db, "events"), {
         subject, type, date, title, participants,
         createdBy: auth.currentUser.uid,
         createdAt: new Date().toISOString(),
       });
       toast("Termin gespeichert.");
     }
     e.target.reset();
     await loadEvents();
   } catch (err) {
     toast(`Fehler: ${err.message}`);
   }
});
