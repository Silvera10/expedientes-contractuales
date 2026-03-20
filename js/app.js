/* ══════════════════════════════════════════════════════════
   EXPEDIENTES CONTRACTUALES — App principal
   Lógica de negocio, CRUD, subida de PDFs
══════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════
   INICIALIZACION
══════════════════════════════════════════ */
async function initApp(){
  try {
    // 1. Inicializar IndexedDB
    await DB.init();

    // 2. Inicializar Supabase
    SB.init();

    // 3. Verificar sesion
    if(SB.isActive()){
      const user = await SB.getUser();
      if(!user){
        document.getElementById('auth-overlay').style.display = 'flex';
        document.getElementById('app-container').style.display = 'none';
        return;
      }
      // Mostrar nombre
      const nombre = user.user_metadata?.nombre || user.email;
      document.getElementById('user-name').textContent = nombre;
    }

    // 4. Mostrar app
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('app-container').style.display = '';

    // 5. Cargar expedientes
    await DB.loadExpedientes();
    renderListaExpedientes();

    SB.updateSyncUI('ok');
  } catch(e){
    console.error('initApp error:', e);
    toast('Error al iniciar: ' + e.message, 'danger');
  }
}

/* ── Arrancar al cargar la pagina ── */
document.addEventListener('DOMContentLoaded', initApp);

/* ══════════════════════════════════════════
   AUTH
══════════════════════════════════════════ */
async function doLogin(){
  const email = document.getElementById('auth-email')?.value.trim();
  const pass = document.getElementById('auth-pass')?.value;
  const errEl = document.getElementById('auth-error');

  if(!email || !pass){
    errEl.style.display = 'block';
    errEl.textContent = 'Ingrese correo y contrase\u00f1a';
    return;
  }
  try {
    errEl.style.display = 'none';
    const btn = document.getElementById('btn-login');
    btn.disabled = true; btn.textContent = 'Ingresando...';
    await SB.login(email, pass);
    await initApp();
  } catch(e){
    errEl.style.display = 'block';
    errEl.textContent = e.message;
  } finally {
    const btn = document.getElementById('btn-login');
    if(btn){ btn.disabled = false; btn.innerHTML = '<i class="bi bi-box-arrow-in-right me-1"></i>Ingresar'; }
  }
}

async function doRegister(){
  const nombre = document.getElementById('reg-nombre')?.value.trim();
  const email = document.getElementById('reg-email')?.value.trim();
  const pass = document.getElementById('reg-pass')?.value;
  const errEl = document.getElementById('auth-error');

  if(!nombre || !email || !pass){
    errEl.style.display = 'block';
    errEl.textContent = 'Complete todos los campos';
    return;
  }
  if(pass.length < 6){
    errEl.style.display = 'block';
    errEl.textContent = 'La contrase\u00f1a debe tener m\u00ednimo 6 caracteres';
    return;
  }
  try {
    errEl.style.display = 'none';
    const btn = document.getElementById('btn-register');
    btn.disabled = true; btn.textContent = 'Creando cuenta...';
    await SB.register(email, pass, nombre);
    toast('Cuenta creada. Revise su correo para confirmar.', 'info');
    toggleAuthForm('login');
  } catch(e){
    errEl.style.display = 'block';
    errEl.textContent = e.message;
  } finally {
    const btn = document.getElementById('btn-register');
    if(btn){ btn.disabled = false; btn.innerHTML = '<i class="bi bi-person-plus me-1"></i>Crear cuenta'; }
  }
}

async function doLogout(){
  if(!confirm('\u00bfCerrar sesi\u00f3n?')) return;
  await SB.logout();
  DB._expedientes = [];
  DB._activeId = null;
  document.getElementById('auth-overlay').style.display = 'flex';
  document.getElementById('app-container').style.display = 'none';
}

/* ══════════════════════════════════════════
   CRUD EXPEDIENTES
══════════════════════════════════════════ */
function nuevoExpediente(){
  document.getElementById('exp-id').value = '';
  document.getElementById('exp-institucion').value = '';
  document.getElementById('exp-numero').value = '';
  document.getElementById('exp-anio').value = new Date().getFullYear();
  document.getElementById('exp-contratista').value = '';
  document.getElementById('exp-nit').value = '';
  document.getElementById('exp-valor').value = '';
  document.getElementById('exp-objeto').value = '';
  document.getElementById('exp-fecha-contrato').value = '';
  document.getElementById('exp-fecha-inicio').value = '';
  document.getElementById('exp-tipo-vigencia').value = 'actual';
  document.getElementById('exp-anio-original').value = new Date().getFullYear() - 1;
  document.getElementById('exp-anio-pago').value = new Date().getFullYear();
  document.getElementById('campos-vigencia-anterior').style.display = 'none';
  document.getElementById('modal-titulo').textContent = 'Nuevo Expediente';
  new bootstrap.Modal(document.getElementById('modalExpediente')).show();
}

function toggleVigenciaAnterior(){
  const tipo = document.getElementById('exp-tipo-vigencia').value;
  document.getElementById('campos-vigencia-anterior').style.display = tipo === 'anterior' ? '' : 'none';
}

function editarExpediente(id){
  const exp = DB.getExpediente(id);
  if(!exp) return;
  document.getElementById('exp-id').value = exp.id;
  document.getElementById('exp-institucion').value = exp.institucion || '';
  document.getElementById('exp-numero').value = exp.contrato_numero || '';
  document.getElementById('exp-anio').value = exp.anio || '';
  document.getElementById('exp-contratista').value = exp.contratista || '';
  document.getElementById('exp-nit').value = exp.nit || '';
  document.getElementById('exp-valor').value = exp.valor || '';
  document.getElementById('exp-objeto').value = exp.objeto || '';
  document.getElementById('exp-fecha-contrato').value = (exp.datos && exp.datos.fecha_contrato) || '';
  document.getElementById('exp-fecha-inicio').value = (exp.datos && exp.datos.fecha_inicio) || '';
  const tipoVig = (exp.datos && exp.datos.tipo_vigencia) || 'actual';
  document.getElementById('exp-tipo-vigencia').value = tipoVig;
  document.getElementById('exp-anio-original').value = (exp.datos && exp.datos.anio_original) || exp.anio - 1 || '';
  document.getElementById('exp-anio-pago').value = (exp.datos && exp.datos.anio_pago) || exp.anio || '';
  document.getElementById('campos-vigencia-anterior').style.display = tipoVig === 'anterior' ? '' : 'none';
  document.getElementById('modal-titulo').textContent = 'Editar Expediente';
  new bootstrap.Modal(document.getElementById('modalExpediente')).show();
}

async function guardarExpediente(){
  const institucion = document.getElementById('exp-institucion').value.trim();
  const numero = document.getElementById('exp-numero').value.trim();
  const anio = document.getElementById('exp-anio').value.trim();
  const contratista = document.getElementById('exp-contratista').value.trim();

  if(!institucion || !numero || !anio || !contratista){
    toast('Complete los campos obligatorios (*)', 'danger');
    return;
  }

  // Verificar duplicado
  const existeId = document.getElementById('exp-id').value;
  const duplicado = DB._expedientes.find(e =>
    e.id !== existeId &&
    e.contrato_numero === numero &&
    e.anio == anio &&
    e.institucion.toLowerCase() === institucion.toLowerCase()
  );
  if(duplicado){
    toast('Ya existe un expediente con ese N\u00b0 de contrato, a\u00f1o e instituci\u00f3n', 'danger');
    return;
  }

  const id = existeId || DB.generateId();
  const now = new Date().toISOString();
  const existing = DB.getExpediente(id);

  const tipoVigencia = document.getElementById('exp-tipo-vigencia').value;
  const datos = existing?.datos || {};
  datos.tipo_vigencia = tipoVigencia;
  datos.fecha_contrato = document.getElementById('exp-fecha-contrato').value || null;
  datos.fecha_inicio = document.getElementById('exp-fecha-inicio').value || null;
  if(tipoVigencia === 'anterior'){
    datos.anio_original = Number(document.getElementById('exp-anio-original').value) || null;
    datos.anio_pago = Number(document.getElementById('exp-anio-pago').value) || null;
  }

  const exp = {
    id,
    institucion,
    contrato_numero: numero,
    anio: Number(anio),
    contratista,
    nit: document.getElementById('exp-nit').value.trim(),
    valor: document.getElementById('exp-valor').value.trim(),
    objeto: document.getElementById('exp-objeto').value.trim(),
    estado: existing?.estado || 'en_progreso',
    datos,
    created_at: existing?.created_at || now,
    updated_at: now
  };

  await DB.saveExpediente(exp);
  bootstrap.Modal.getInstance(document.getElementById('modalExpediente')).hide();
  renderListaExpedientes();
  toast(existeId ? 'Expediente actualizado' : 'Expediente creado');

  // Abrir el expediente recien creado
  abrirExpediente(id);
}

async function eliminarExpediente(id){
  const exp = DB.getExpediente(id);
  if(!exp) return;

  if(exp.estado === 'bloqueado'){
    toast('Este expediente est\u00e1 bloqueado y no se puede eliminar', 'danger');
    return;
  }

  // Doble confirmacion
  const msg = `\u00bfEliminar expediente Contrato N\u00b0 ${exp.contrato_numero}/${exp.anio}?\n\nEsta acci\u00f3n NO se puede deshacer.\nSe eliminar\u00e1n todos los documentos adjuntos.\n\nEscriba el n\u00famero del contrato para confirmar:`;
  const confirmacion = prompt(msg);
  if(confirmacion !== exp.contrato_numero){
    toast('Eliminaci\u00f3n cancelada — n\u00famero no coincide', 'warning');
    return;
  }

  await DB.deleteExpediente(id);
  document.getElementById('panel-detalle').innerHTML = '<div class="text-center py-5 text-muted"><i class="bi bi-folder2-open" style="font-size:4rem;opacity:0.3"></i><p class="mt-2">Seleccione un expediente</p></div>';
  renderListaExpedientes();
  toast('Expediente eliminado');
}

async function bloquearExpediente(id){
  if(!confirm('\u00bfBloquear este expediente? Ya no se podr\u00e1 editar ni eliminar.')) return;
  const exp = DB.getExpediente(id);
  if(!exp) return;
  exp.estado = 'bloqueado';
  exp.updated_at = new Date().toISOString();
  await DB.saveExpediente(exp);
  renderListaExpedientes();
  renderDetalleExpediente(id);
  toast('Expediente bloqueado (solo lectura)');
}

function abrirExpediente(id){
  DB._activeId = id;
  renderListaExpedientes();
  renderDetalleExpediente(id);
}

/* ══════════════════════════════════════════
   SUBIR / QUITAR / REEMPLAZAR DOCUMENTOS
══════════════════════════════════════════ */
async function subirDocumento(input, tipoId, expId){
  const file = input.files[0];
  if(!file) return;

  // Validar que sea PDF
  if(file.type !== 'application/pdf'){
    toast('Solo se permiten archivos PDF', 'danger');
    input.value = '';
    return;
  }

  // Validar tamano (max 10MB)
  if(file.size > 10 * 1024 * 1024){
    toast('El archivo es demasiado grande (m\u00e1x 10MB)', 'danger');
    input.value = '';
    return;
  }

  try {
    toast('Subiendo documento...', 'info');

    // Leer archivo
    const arrayBuffer = await file.arrayBuffer();

    // Contar paginas del PDF
    let paginas = 1;
    try {
      const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      paginas = pdfDoc.getPageCount();
    } catch(e){
      console.warn('No se pudo contar p\u00e1ginas:', e);
      toast('Advertencia: el PDF puede estar protegido. Se subir\u00e1 pero podr\u00eda no foliarse correctamente.', 'warning');
    }

    // Path en storage
    const storagePath = `${expId}/${tipoId}_${Date.now()}.pdf`;

    // Guardar archivo local
    await DB.saveArchivo(storagePath, arrayBuffer);

    // Subir a Supabase Storage
    if(SB.isActive()){
      await SB.uploadPDF(storagePath, file);
    }

    // Guardar metadata
    const docId = `${expId}_${tipoId}`;
    const doc = {
      id: docId,
      expediente_id: expId,
      tipo: tipoId,
      orden: (DOC_TIPOS.find(d => d.id === tipoId) || DOC_TIPOS_ADICION.find(d => d.id === tipoId))?.orden || 99,
      nombre_archivo: file.name,
      storage_path: storagePath,
      paginas,
      created_at: new Date().toISOString()
    };
    await DB.saveDocumento(doc);

    // Actualizar estado del expediente
    await actualizarEstadoExpediente(expId);

    // Re-render
    renderDetalleExpediente(expId);
    toast(`${file.name} cargado (${paginas} p\u00e1g.)`);

  } catch(e){
    console.error('subirDocumento error:', e);
    toast('Error al subir: ' + e.message, 'danger');
  }

  input.value = '';
}

async function actualizarFechaDoc(docId, expId, fecha){
  const docs = await DB.loadDocumentos(expId);
  const doc = docs.find(d => d.id === docId);
  if(!doc) return;
  doc.fecha_expedicion = fecha || null;
  await DB.saveDocumento(doc);
  renderDetalleExpediente(expId);
}

async function quitarDocumento(docId, expId){
  if(!confirm('\u00bfQuitar este documento del expediente?')) return;
  await DB.deleteDocumento(docId);
  await actualizarEstadoExpediente(expId);
  renderDetalleExpediente(expId);
  toast('Documento quitado');
}

function reemplazarDocumento(tipoId, expId){
  // Crear input file temporal
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf';
  input.onchange = async function(){
    // Primero borrar el existente
    const docId = `${expId}_${tipoId}`;
    await DB.deleteDocumento(docId);
    // Luego subir el nuevo
    await subirDocumento(this, tipoId, expId);
  };
  input.click();
}

async function agregarDocExtra(expId){
  const nombre = prompt('Nombre del documento adicional:');
  if(!nombre) return;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf';
  input.onchange = async function(){
    const file = this.files[0];
    if(!file) return;
    if(file.type !== 'application/pdf'){
      toast('Solo se permiten archivos PDF', 'danger');
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      let paginas = 1;
      try {
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        paginas = pdfDoc.getPageCount();
      } catch(e){ console.warn('PDF protegido:', e); }

      const tipoId = 'extra_' + Date.now();
      const storagePath = `${expId}/${tipoId}.pdf`;

      await DB.saveArchivo(storagePath, arrayBuffer);
      if(SB.isActive()) await SB.uploadPDF(storagePath, file);

      const doc = {
        id: `${expId}_${tipoId}`,
        expediente_id: expId,
        tipo: tipoId,
        orden: 100 + Date.now() % 1000,
        nombre_archivo: nombre + ' (' + file.name + ')',
        storage_path: storagePath,
        paginas,
        created_at: new Date().toISOString()
      };
      await DB.saveDocumento(doc);
      renderDetalleExpediente(expId);
      toast(`Documento adicional "${nombre}" cargado`);
    } catch(e){
      toast('Error: ' + e.message, 'danger');
    }
  };
  input.click();
}

/* ══════════════════════════════════════════
   ACTUALIZAR ESTADO DEL EXPEDIENTE
══════════════════════════════════════════ */
async function actualizarEstadoExpediente(expId){
  const exp = DB.getExpediente(expId);
  if(!exp || exp.estado === 'bloqueado') return;

  const docs = await DB.loadDocumentos(expId);
  const esAnterior = (exp.datos && exp.datos.tipo_vigencia === 'anterior');
  const catalogo = esAnterior ? [...DOC_TIPOS, ...DOC_TIPOS_ADICION] : DOC_TIPOS;
  const totalRequeridos = catalogo.length;
  const subidos = docs.filter(d => catalogo.find(t => t.id === d.tipo)).length;

  exp.estado = subidos >= totalRequeridos ? 'completo' : 'en_progreso';
  exp.updated_at = new Date().toISOString();
  await DB.saveExpediente(exp);
  renderListaExpedientes();
}

/* ══════════════════════════════════════════
   GENERAR EXPEDIENTE PDF (llama a pdf-engine)
══════════════════════════════════════════ */
async function generarExpedientePDF(expId){
  const exp = DB.getExpediente(expId);
  if(!exp){ toast('Expediente no encontrado', 'danger'); return; }

  const docs = await DB.loadDocumentos(expId);
  if(!docs.length){
    toast('No hay documentos cargados', 'warning');
    return;
  }

  toast('Generando expediente PDF foliado... Esto puede tardar unos segundos.', 'info');

  try {
    await generarPDFExpediente(exp, docs);
    toast('Expediente PDF generado y descargado exitosamente');
  } catch(e){
    console.error('Error generando PDF:', e);
    toast('Error al generar PDF: ' + e.message, 'danger');
  }
}
