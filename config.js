// ================================================================
//  config.js  —  CREDENCIALES FIREBASE
//  ⚠️  Este archivo está en .gitignore — NO lo subas al repo público
//  ⚠️  Compártelo solo con el equipo por un canal privado
// ================================================================

firebase.initializeApp({
  apiKey:            "AIzaSyDH-ODpz5XS0vYF-KGzf1v1q0t_jtCH2qY",
  authDomain:        "datos-53cd1.firebaseapp.com",
  databaseURL:       "https://datos-53cd1-default-rtdb.firebaseio.com/",
  projectId:         "datos-53cd1",
  storageBucket:     "datos-53cd1.appspot.com",
  messagingSenderId: "116551372390",
  appId:             "1:116551372390:web:e7b8aff5894b14af05a7a7"
});

window._DB   = firebase.database();
window._AUTH = firebase.auth();
