import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TUS CREDENCIALES DE FIREBASE (Cópialas de la consola de Firebase)
const firebaseConfig = {
  apiKey: "AIzaSyDomrFDQwToUH9HKtlAQVJ6X1jWwppwFHY",
  authDomain: "comprobacionmaf.firebaseapp.com",
  projectId: "comprobacionmaf",
  storageBucket: "comprobacionmaf.firebasestorage.app",
  messagingSenderId: "773054789582",
  appId: "1:773054789582:web:d6bddafd4b33271889dd9f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };