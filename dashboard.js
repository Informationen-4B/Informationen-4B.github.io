import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { addDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

onAuthStateChanged(auth,user=>{
  if(!user) location.href="login.html";
  load();
});

window.logout=()=>signOut(auth);

async function load(){
  const snap = await getDocs(collection(db,"events"));
  list.innerHTML="";
  snap.forEach(d=>{
    const li=document.createElement("li");
    li.innerText=d.data().title+" ("+d.data().type+") - "+d.data().date;
    list.appendChild(li);
  });
}

window.addEvent=async()=>{
  try{
    await addDoc(collection(db,"events"),{
      title:title.value,
      date:date.value,
      type:type.value
    });
    load();
  }catch(e){
    error.innerText=e.code;
  }
}
