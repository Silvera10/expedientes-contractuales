/* ══════════════════════════════════════════════════════════
   EXPEDIENTES CONTRACTUALES — Supabase (Auth + Storage + DB)
   Misma instancia que FOSE Unified, tablas con prefijo exp_
══════════════════════════════════════════════════════════ */

const SUPABASE_URL = 'https://ejmhhegmqaztavjguojw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqbWhoZWdtcWF6dGF2amd1b2p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNTYxODgsImV4cCI6MjA4ODgzMjE4OH0.1WR3fhwj9Kr95puAmkCuMlcCJcoDLNlwc6sE_NZfnLQ';
const STORAGE_BUCKET = 'expedientes';

const SB = {
  client: null,
  _configured: false,
  _saveTimer: null,
  _saveQueue: null,

  /* ── Inicializar ── */
  init(){
    if(typeof supabase === 'undefined' || !supabase.createClient){
      console.warn('Supabase JS no cargado');
      this._configured = false;
      return;
    }
    this.client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    this._configured = true;
    window.addEventListener('beforeunload', () => this._flush());
  },

  isActive(){ return this._configured && this.client !== null; },

  /* ══════════════════════════════════════════
     AUTH
  ══════════════════════════════════════════ */

  async getUser(){
    if(!this.isActive()) return null;
    const { data } = await this.client.auth.getSession();
    return data.session?.user || null;
  },

  async login(email, password){
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if(error) throw new Error(error.message);
    return data.user;
  },

  async register(email, password, nombre){
    const { data, error } = await this.client.auth.signUp({
      email, password,
      options: { data: { nombre } }
    });
    if(error) throw new Error(error.message);
    return data.user;
  },

  async logout(){
    if(!this.isActive()) return;
    this._flush();
    await this.client.auth.signOut();
  },

  /* ══════════════════════════════════════════
     EXPEDIENTES CRUD
  ══════════════════════════════════════════ */

  async fetchExpedientes(){
    const user = await this.getUser();
    if(!user) return [];
    const { data, error } = await this.client
      .from('exp_expedientes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if(error){ console.warn('fetchExpedientes:', error.message); return []; }
    return data || [];
  },

  async saveExpediente(exp){
    if(!this.isActive()) return;
    const user = await this.getUser();
    if(!user) return;
    const row = {
      id: exp.id,
      user_id: user.id,
      institucion: exp.institucion || '',
      contrato_numero: exp.contrato_numero || '',
      contratista: exp.contratista || '',
      nit: exp.nit || '',
      valor: exp.valor || '',
      objeto: exp.objeto || '',
      anio: exp.anio || new Date().getFullYear(),
      estado: exp.estado || 'en_progreso',
      datos: exp.datos || {}
    };
    const { error } = await this.client
      .from('exp_expedientes').upsert(row);
    if(error) console.error('saveExpediente:', error.message);
  },

  /* Guardar con debounce (2 seg) */
  saveExpedienteDebounced(exp){
    this._saveQueue = exp;
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._flush(), 2000);
    this.updateSyncUI('syncing');
  },

  async _flush(){
    clearTimeout(this._saveTimer);
    if(!this._saveQueue) return;
    const exp = this._saveQueue;
    this._saveQueue = null;
    try {
      await this.saveExpediente(exp);
      this.updateSyncUI('ok');
    } catch(e){
      console.error('Flush error:', e);
      this.updateSyncUI('error');
    }
  },

  async deleteExpediente(id){
    if(!this.isActive()) return;
    // Storage files se borran por cascade o manualmente
    const { error } = await this.client
      .from('exp_expedientes').delete().eq('id', id);
    if(error) console.error('deleteExpediente:', error.message);
  },

  /* ══════════════════════════════════════════
     DOCUMENTOS (registros en BD)
  ══════════════════════════════════════════ */

  async fetchDocumentos(expedienteId){
    if(!this.isActive()) return [];
    const { data, error } = await this.client
      .from('exp_documentos')
      .select('*')
      .eq('expediente_id', expedienteId)
      .order('orden');
    if(error){ console.warn('fetchDocumentos:', error.message); return []; }
    return data || [];
  },

  async saveDocumento(doc){
    if(!this.isActive()) return;
    const { error } = await this.client
      .from('exp_documentos').upsert(doc);
    if(error) console.error('saveDocumento:', error.message);
  },

  async deleteDocumento(docId){
    if(!this.isActive()) return;
    const { error } = await this.client
      .from('exp_documentos').delete().eq('id', docId);
    if(error) console.error('deleteDocumento:', error.message);
  },

  /* ══════════════════════════════════════════
     STORAGE (subir / descargar / borrar PDFs)
  ══════════════════════════════════════════ */

  async uploadPDF(filePath, file){
    if(!this.isActive()) return null;
    const { data, error } = await this.client.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, { upsert: true });
    if(error){ console.error('uploadPDF:', error.message); return null; }
    return data.path;
  },

  async downloadPDF(filePath){
    if(!this.isActive()) return null;
    const { data, error } = await this.client.storage
      .from(STORAGE_BUCKET)
      .download(filePath);
    if(error){ console.error('downloadPDF:', error.message); return null; }
    return data; // Blob
  },

  async deletePDF(filePath){
    if(!this.isActive()) return;
    const { error } = await this.client.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);
    if(error) console.error('deletePDF:', error.message);
  },

  /* ══════════════════════════════════════════
     UI SYNC INDICATOR
  ══════════════════════════════════════════ */

  updateSyncUI(status){
    const el = document.getElementById('sync-status');
    if(!el) return;
    el.classList.remove('bg-success','bg-warning','bg-danger','bg-secondary');
    switch(status){
      case 'ok':
        el.classList.add('bg-success');
        el.innerHTML = '<i class="bi bi-cloud-check"></i>';
        el.title = 'Sincronizado — ' + new Date().toLocaleTimeString('es-CO');
        break;
      case 'syncing':
        el.classList.add('bg-warning');
        el.innerHTML = '<i class="bi bi-cloud-arrow-up"></i>';
        el.title = 'Guardando...';
        break;
      case 'error':
        el.classList.add('bg-danger');
        el.innerHTML = '<i class="bi bi-cloud-slash"></i>';
        el.title = 'Error de sincronizaci\u00f3n';
        break;
      default:
        el.classList.add('bg-secondary');
        el.innerHTML = '<i class="bi bi-cloud-slash"></i>';
        el.title = 'Sin conexi\u00f3n';
    }
  }
};
