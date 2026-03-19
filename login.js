import { auth } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

window.login = async () => {
  try{
    await signInWithEmailAndPassword(auth,email.value,password.value);
    window.location.href = "dashboard.html";
  }catch(e){
    error.innerText = e.code;
  }
}
