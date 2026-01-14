import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TUS CREDENCIALES DE FIREBASE (Cópialas de la consola de Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyDTTvNOTFf34CzmH8ZbO8ZqTv1iPxz5CIA",
  authDomain: "gastosmaf-4331f.firebaseapp.com",
  projectId: "gastosmaf-4331f",
  storageBucket: "gastosmaf-4331f.firebasestorage.app",
  messagingSenderId: "781006798727",
  appId: "1:781006798727:web:eeff50e436f23f8c6e5d22"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };