/* ══════════════════════════════════════════════════════════
   EXPEDIENTES CONTRACTUALES — Capa de datos
   IndexedDB local + sync con Supabase
══════════════════════════════════════════════════════════ */

const DB = {
  _dbName: 'expedientes_contractuales_v1',
  _dbVersion: 1,
  _db: null,
  _expedientes: [],   // cache en memoria
  _activeId: null,     // expediente activo

  /* ── Inicializar IndexedDB ── */
  async init(){
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this._dbName, this._dbVersion);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if(!db.objectStoreNames.contains('expedientes'))
          db.createObjectStore('expedientes');
        if(!db.objectStoreNames.contains('documentos'))
          db.createObjectStore('documentos');
        if(!db.objectStoreNames.contains('archivos'))
          db.createObjectStore('archivos');
        if(!db.objectStoreNames.contains('meta'))
          db.createObjectStore('meta');
      };
      req.onsuccess = e => { this._db = e.target.result; resolve(); };
      req.onerror = e => reject(e.target.error);
    });
  },

  /* ── Helpers IDB ── */
  _tx(store, mode='readonly'){
    return this._db.transaction(store, mode).objectStore(store);
  },
  _get(store, key){
    return new Promise((resolve, reject) => {
      const req = this._tx(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  _put(store, key, val){
    return new Promise((resolve, reject) => {
      const req = this._tx(store, 'readwrite').put(val, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  _del(store, key){
    return new Promise((resolve, reject) => {
      const req = this._tx(store, 'readwrite').delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },
  _getAll(store){
    return new Promise((resolve, reject) => {
      const req = this._tx(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },
  _getAllKeys(store){
    return new Promise((resolve, reject) => {
      const req = this._tx(store).getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  /* ══════════════════════════════════════════
     EXPEDIENTES
  ══════════════════════════════════════════ */

  async loadExpedientes(){
    // Intentar cargar de Supabase primero
    if(SB.isActive()){
      try {
        const cloud = await SB.fetchExpedientes();
        if(cloud.length > 0){
          this._expedientes = cloud;
          // Guardar en local como cache
          for(const exp of cloud){
            await this._put('expedientes', exp.id, exp);
          }
          return this._expedientes;
        }
      } catch(e){ console.warn('Cloud load failed, using local:', e); }
    }
    // Fallback: cargar de IndexedDB
    const keys = await this._getAllKeys('expedientes');
    const exps = [];
    for(const k of keys){
      const exp = await this._get('expedientes', k);
      if(exp) exps.push(exp);
    }
    this._expedientes = exps.sort((a,b) => (b.created_at||'').localeCompare(a.created_at||''));
    return this._expedientes;
  },

  async saveExpediente(exp){
    // Guardar local
    await this._put('expedientes', exp.id, exp);
    // Actualizar cache
    const idx = this._expedientes.findIndex(e => e.id === exp.id);
    if(idx >= 0) this._expedientes[idx] = exp;
    else this._expedientes.unshift(exp);
    // Sync con Supabase (debounced)
    if(SB.isActive()) SB.saveExpedienteDebounced(exp);
  },

  async deleteExpediente(id){
    await this._del('expedientes', id);
    this._expedientes = this._expedientes.filter(e => e.id !== id);
    // Borrar documentos locales de este expediente
    const allDocKeys = await this._getAllKeys('documentos');
    for(const k of allDocKeys){
      if(k.startsWith(id + '_')) await this._del('documentos', k);
    }
    // Borrar archivos locales
    const allFileKeys = await this._getAllKeys('archivos');
    for(const k of allFileKeys){
      if(k.startsWith(id + '/')) await this._del('archivos', k);
    }
    // Sync
    if(SB.isActive()) await SB.deleteExpediente(id);
    if(this._activeId === id) this._activeId = null;
  },

  getExpediente(id){
    return this._expedientes.find(e => e.id === id) || null;
  },

  /* ══════════════════════════════════════════
     DOCUMENTOS (metadata de cada PDF subido)
  ══════════════════════════════════════════ */

  async loadDocumentos(expedienteId){
    // Intentar Supabase
    if(SB.isActive()){
      try {
        const cloud = await SB.fetchDocumentos(expedienteId);
        if(cloud.length > 0){
          for(const doc of cloud) await this._put('documentos', doc.id, doc);
          return cloud;
        }
      } catch(e){ console.warn('Cloud docs load failed:', e); }
    }
    // Local
    const allKeys = await this._getAllKeys('documentos');
    const docs = [];
    for(const k of allKeys){
      const doc = await this._get('documentos', k);
      if(doc && doc.expediente_id === expedienteId) docs.push(doc);
    }
    return docs.sort((a,b) => (a.orden||0) - (b.orden||0));
  },

  async getDocumento(docId){
    return await this._get('documentos', docId);
  },

  async saveDocumento(doc){
    await this._put('documentos', doc.id, doc);
    if(SB.isActive()) await SB.saveDocumento(doc);
  },

  async deleteDocumento(docId){
    const doc = await this._get('documentos', docId);
    await this._del('documentos', docId);
    // Borrar archivo local
    if(doc && doc.storage_path){
      await this._del('archivos', doc.storage_path);
      if(SB.isActive()) await SB.deletePDF(doc.storage_path);
    }
    if(SB.isActive()) await SB.deleteDocumento(docId);
  },

  /* ══════════════════════════════════════════
     ARCHIVOS PDF (binarios en IndexedDB)
  ══════════════════════════════════════════ */

  async saveArchivo(path, arrayBuffer){
    await this._put('archivos', path, arrayBuffer);
  },

  async getArchivo(path){
    // Primero local
    const local = await this._get('archivos', path);
    if(local) return local;
    // Si no, descargar de Supabase
    if(SB.isActive()){
      const blob = await SB.downloadPDF(path);
      if(blob){
        const ab = await blob.arrayBuffer();
        await this._put('archivos', path, ab);
        return ab;
      }
    }
    return null;
  },

  /* ══════════════════════════════════════════
     UTILIDADES
  ══════════════════════════════════════════ */

  generateId(){
    return 'exp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
  }
};
