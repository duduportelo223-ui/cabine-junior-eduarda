/*
 * Galeria LOCAL: fotos e vídeos ficam guardados só neste aparelho (IndexedDB).
 * Não há envio para internet — cada convidado vê apenas o que tirou no próprio celular.
 */
(function () {
  const DB_NAME = 'je-photobooth';
  const STORE = 'items';
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB indisponível'));
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function run(mode, fn) {
    return open().then(
      (db) =>
        new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, mode);
          const out = fn(tx.objectStore(STORE));
          tx.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        })
    );
  }

  const LocalGallery = {
    // type: 'photo' | 'video'; thumb: sempre um Blob jpeg leve para a grade.
    add({ type, blob, thumb }) {
      return run('readwrite', (s) => s.add({ type, blob, thumb: thumb || blob, createdAt: Date.now() }));
    },
    all() {
      return run('readonly', (s) => s.getAll()).then((rows) => (rows || []).sort((a, b) => b.createdAt - a.createdAt));
    },
    remove(id) {
      return run('readwrite', (s) => s.delete(id));
    },
    count() {
      return run('readonly', (s) => s.count());
    },
  };

  window.LocalGallery = LocalGallery;
})();
