import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Replace with your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCGRAz4hNy9737rRC2XhGjihrroVFrBnyE",
	authDomain: "doctors-89de9.firebaseapp.com",
	projectId: "doctors-89de9",
	storageBucket: "doctors-89de9.firebasestorage.app",
	messagingSenderId: "843277629462",
	appId: "1:843277629462:web:c6ef4918f469d13dff5d37",
	measurementId: "G-RVBRHCX77H"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
