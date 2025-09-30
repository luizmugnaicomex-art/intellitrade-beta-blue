// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// TODO: Adicione os SDKs para os produtos Firebase que você deseja usar
// https://firebase.google.com/docs/web/setup#available-libraries

// A configuração do Firebase do seu aplicativo da web
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO_ID",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Inicialize o Firebase
const app = initializeApp(firebaseConfig);

// Exporte os serviços que você vai usar no resto do seu app
export const db = getFirestore(app);
export const auth = getAuth(app);
