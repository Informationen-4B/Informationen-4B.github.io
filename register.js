import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { setDoc, doc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

window.register = async () => {
  try{
    const user = await createUserWithEmailAndPassword(auth,email.value,password.value);

    await updateProfile(user.user,{
      displayName:name.value
    });

    await setDoc(doc(db,"users",user.user.uid),{
      name:name.value,
      email:email.value,
      role:"user",
      status:"pending"
    });

    error.innerText="Warte auf Freigabe";

  }catch(e){
    error.innerText=e.code;
  }
}
