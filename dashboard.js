import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, getDocs, addDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let currentUser;
let currentSubject = "Mathe";

onAuthStateChanged(auth, async user => {
  if(!user){
    location.href="login.html";
    return;
  }

  currentUser = user;
  checkRole();
  load();
});

window.logout = () => signOut(auth);

async function checkRole(){
  const snap = await getDocs(collection(db,"users"));
  snap.forEach(d=>{
    if(d.id===currentUser.uid){
      const data=d.data();

      if(data.status!=="approved"){
        status.innerText="Nicht freigeschaltet";
      }

      if(data.role==="admin"){
        adminArea.classList.remove("hidden");
      }

      if(data.role==="admin" || data.role==="sprecher"){
        addArea.classList.remove("hidden");
      }
    }
  });
}

window.load = async (subject) => {
  if(subject) currentSubject = subject;

  const snap = await getDocs(collection(db,"events"));
  list.innerHTML="";

  snap.forEach(d=>{
    const data=d.data();
    if(data.subject===currentSubject){
      const li=document.createElement("li");
      li.innerText=data.title+" ("+data.type+") - "+data.date;
      list.appendChild(li);
    }
  });
}

window.addEvent = async () => {
  try{
    await addDoc(collection(db,"events"),{
      title:title.value,
      date:date.value,
      type:type.value,
      subject:currentSubject
    });
    load();
  }catch(e){
    error.innerText=e.code;
  }
}
