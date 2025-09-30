// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// TODO: Adicione os SDKs para os produtos Firebase que você deseja usar
// https://firebase.google.com/docs/web/setup#available-libraries

// A configuração do Firebase do seu aplicativo da web
const firebaseConfig = {
  apiKey: "AIzaSyDkfqg7GlqzTNHLUomJ5TCaQgM40qMLMEg",
  authDomain: "intellitrade-beta-blue-ba2ec.firebaseapp.com",
  projectId: "intellitrade-beta-blue-ba2ec",
  storageBucket: "intellitrade-beta-blue-ba2ec.firebasestorage.app",
  messagingSenderId: "125413376169",
  appId: "1:125413376169:web:673c9fabd6299af27c69b8"
  measurementId: "G-EVN5N56J1X"
};

// Inicialize o Firebase
const app = initializeApp(firebaseConfig);

// Exporte os serviços que você vai usar no resto do seu app
export const db = getFirestore(app);
export const auth = getAuth(app);
