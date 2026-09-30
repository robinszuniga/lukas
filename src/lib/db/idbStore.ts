/** Guarda y carga los bytes de la base SQLite en IndexedDB (persistencia del navegador). */
const IDB_NAME = 'lukas'
const STORE = 'sqlite'
const KEY = 'main.db'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function loadDatabaseBytes(): Promise<Uint8Array | null> {
  const idb = await openDB()
  try {
    return await new Promise((resolve, reject) => {
      const tx = idb.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(KEY)
      req.onsuccess = () => resolve(req.result instanceof Uint8Array ? req.result : null)
      req.onerror = () => reject(req.error)
    })
  } finally {
    idb.close()
  }
}

export async function saveDatabaseBytes(bytes: Uint8Array): Promise<void> {
  const idb = await openDB()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(bytes, KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    idb.close()
  }
}
