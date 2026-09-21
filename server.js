// --- FIREBASE SETUP - FIXED ---
let db = null;
try {
  let serviceAccount;
  // Agar base64 me dala hai toh
  if(process.env.FIREBASE_SERVICE_ACCOUNT.startsWith('{')){
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    // Base64 decode
    const jsonStr = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8');
    serviceAccount = JSON.parse(jsonStr);
  }
  
  // Private key ka \n fix
  if(serviceAccount.private_key){
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
  console.log("✅ Firebase Connected");
} catch (e) {
  console.log("⚠️ Firebase not connected:", e.message);
}
