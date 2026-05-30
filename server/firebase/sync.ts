// server/firebase/sync.ts — Firebase fallback for WebSocket
let firebaseApp: any = null

export async function initFirebase() {
  if (!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL) {
    console.log("[FIREBASE] Not configured — using WebSocket only")
    return null
  }
  try {
    const { initializeApp } = await import("firebase/app")
    const { getDatabase } = await import("firebase/database")
    firebaseApp = initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    })
    console.log("[FIREBASE] Initialized as fallback")
    return getDatabase(firebaseApp)
  } catch (e) {
    console.warn("[FIREBASE] Init failed:", e)
    return null
  }
}

export async function firebaseWrite(path: string, data: any) {
  try {
    const db = await initFirebase()
    if (!db) return false
    const { ref, set } = await import("firebase/database")
    await set(ref(db, path), data)
    return true
  } catch (e) { console.error("[FIREBASE] Write failed:", e); return false }
}
