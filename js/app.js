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
    cargarFiltroInstituciones();
    renderListaExpedientes();

    // 6. Verificar si necesita backup
    verificarAlertaBackup();

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
/* ══════════════════════════════════════════
   CATÁLOGO DE INSTITUCIONES
══════════════════════════════════════════ */
function getInstituciones(){
  const instituciones = new Set();
  DB._expedientes.forEach(e => {
    if(e.institucion) instituciones.add(e.institucion);
  });
  return [...instituciones].sort();
}

function cargarFiltroInstituciones(){
  const select = document.getElementById('filtro-institucion');
  if(!select) return;
  const instituciones = getInstituciones();
  const valorActual = select.value;
  select.innerHTML = '<option value="">Todas las instituciones</option>' +
    instituciones.map(i => `<option value="${i}"${i === valorActual ? ' selected' : ''}>${i}</option>`).join('');
}

function cargarSelectInstituciones(){
  const select = document.getElementById('exp-institucion-select');
  if(!select) return;
  const instituciones = getInstituciones();
  select.innerHTML = '<option value="">— Seleccione —</option>' +
    instituciones.map(i => `<option value="${i}">${i}</option>`).join('') +
    '<option value="__nueva__">+ Agregar nueva institución...</option>';
}

function onInstitucionSelect(){
  const select = document.getElementById('exp-institucion-select');
  const input = document.getElementById('exp-institucion');
  if(select.value === '__nueva__'){
    input.style.display = '';
    input.value = '';
    input.focus();
  } else {
    input.style.display = 'none';
    input.value = select.value;
  }
}

async function descargarTodosExpedientes(){
  const filtro = DB._filtroInstitucion || '';
  const exps = filtro ? DB._expedientes.filter(e => e.institucion === filtro) : DB._expedientes;

  if(!exps.length){
    toast('No hay expedientes para descargar', 'warning');
    return;
  }

  toast(`Generando ${exps.length} expediente(s)... Espere por favor`, 'info');

  let descargados = 0;
  for(const exp of exps){
    try {
      const docs = await DB.loadDocumentos(exp.id);
      if(!docs.length) continue;
      await generarPDFExpediente(exp, docs);
      descargados++;
      // Pequeña pausa entre descargas para no saturar el navegador
      await new Promise(r => setTimeout(r, 500));
    } catch(e){
      console.warn('Error generando expediente:', exp.contrato_numero, e);
    }
  }

  if(descargados > 0){
    toast(`${descargados} expediente(s) descargados`, 'success');
  } else {
    toast('Ningún expediente tiene documentos para descargar', 'warning');
  }
}

function filtrarPorInstitucion(){
  const filtro = document.getElementById('filtro-institucion').value;
  DB._filtroInstitucion = filtro;
  renderListaExpedientes();
}

function nuevoExpediente(){
  document.getElementById('exp-id').value = '';
  document.getElementById('exp-institucion').value = '';
  cargarSelectInstituciones();
  document.getElementById('exp-institucion-select').value = '';
  document.getElementById('exp-institucion').style.display = 'none';
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
  cargarSelectInstituciones();
  const selectInst = document.getElementById('exp-institucion-select');
  const inputInst = document.getElementById('exp-institucion');
  if(exp.institucion && [...selectInst.options].some(o => o.value === exp.institucion)){
    selectInst.value = exp.institucion;
    inputInst.value = exp.institucion;
    inputInst.style.display = 'none';
  } else {
    selectInst.value = '__nueva__';
    inputInst.value = exp.institucion || '';
    inputInst.style.display = '';
  }
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
  const selectInst = document.getElementById('exp-institucion-select');
  const institucion = (selectInst.value === '__nueva__' || selectInst.value === '')
    ? document.getElementById('exp-institucion').value.trim()
    : selectInst.value;
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
let _generandoPDF = false;
async function generarExpedientePDF(expId){
  // Protección contra doble clic
  if(_generandoPDF){
    toast('Ya se está generando un PDF, espere...', 'warning');
    return;
  }
  _generandoPDF = true;

  const exp = DB.getExpediente(expId);
  if(!exp){ toast('Expediente no encontrado', 'danger'); _generandoPDF = false; return; }

  const docs = await DB.loadDocumentos(expId);
  if(!docs.length){
    toast('No hay documentos cargados', 'warning');
    _generandoPDF = false;
    return;
  }

  toast('Generando expediente PDF foliado... Esto puede tardar unos segundos.', 'info');

  try {
    await generarPDFExpediente(exp, docs);
    toast('Expediente PDF generado y descargado exitosamente');
  } catch(e){
    console.error('Error generando PDF:', e);
    toast('Error al generar PDF: ' + e.message, 'danger');
  } finally {
    _generandoPDF = false;
  }
}

/* ══════════════════════════════════════════════════════════
   FOLIAR PDF COMPLETO — Sube un PDF y agrega carátula + índice + foliación
══════════════════════════════════════════════════════════ */
async function foliarPDFCompleto(expId, inputEl){
  const file = inputEl.files[0];
  inputEl.value = '';
  if(!file) return;

  if(_generandoPDF){
    toast('Ya se est\u00e1 procesando un PDF, espere...', 'warning');
    return;
  }
  _generandoPDF = true;

  const exp = DB.getExpediente(expId);
  if(!exp){
    toast('Expediente no encontrado', 'danger');
    _generandoPDF = false;
    return;
  }

  toast('Procesando PDF... Agregando car\u00e1tula, \u00edndice y foliaci\u00f3n...', 'info');

  try {
    const arrayBuffer = await file.arrayBuffer();
    const srcPdf = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const totalPaginasDoc = srcPdf.getPageCount();
    const totalFolios = totalPaginasDoc + 2; // +2 por carátula e índice

    // Crear PDF final
    const pdfFinal = await PDFLib.PDFDocument.create();
    const fontBold = await pdfFinal.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const fontNormal = await pdfFinal.embedFont(PDFLib.StandardFonts.Helvetica);

    // 1. Generar CARÁTULA (folio 1)
    await generarPortada(pdfFinal, exp, totalFolios, fontBold, fontNormal);

    // 2. Generar ÍNDICE simple (folio 2)
    await generarIndiceFoliar(pdfFinal, file.name, totalPaginasDoc, fontBold, fontNormal);

    // 3. Copiar todas las páginas del PDF original
    const copiedPages = await pdfFinal.copyPages(srcPdf, srcPdf.getPageIndices());
    for(const page of copiedPages){
      pdfFinal.addPage(page);
    }

    // 4. Estampar folio en TODAS las páginas
    const allPages = pdfFinal.getPages();
    for(let i = 0; i < allPages.length; i++){
      estamparFolio(allPages[i], i + 1, totalFolios, fontBold);
    }

    // 5. Descargar
    const pdfBytes = await pdfFinal.save();
    const nombreArchivo = `Expediente_Cto_${exp.contrato_numero}_${exp.anio}.pdf`;
    descargarPDF(pdfBytes, nombreArchivo);

    toast(`Expediente foliado generado: ${totalFolios} folios (car\u00e1tula + \u00edndice + ${totalPaginasDoc} p\u00e1ginas)`);

  } catch(e){
    console.error('Error foliando PDF:', e);
    toast('Error al foliar PDF: ' + e.message, 'danger');
  } finally {
    _generandoPDF = false;
  }
}

/* Índice simple para PDF foliado completo */
async function generarIndiceFoliar(pdfDoc, nombreArchivo, totalPaginas, fontBold, fontNormal){
  const page = pdfDoc.addPage(PDFLib.PageSizes.Letter);
  const { width, height } = page.getSize();

  // Título
  const titulo = '\u00cdNDICE DEL EXPEDIENTE';
  page.drawText(titulo, {
    x: width / 2 - fontBold.widthOfTextAtSize(titulo, 16) / 2,
    y: height - 60,
    size: 16, font: fontBold,
    color: PDFLib.rgb(0.102, 0.227, 0.361)
  });

  // Línea dorada
  page.drawLine({
    start: { x: 50, y: height - 70 },
    end: { x: width - 50, y: height - 70 },
    color: PDFLib.rgb(0.831, 0.627, 0.090),
    thickness: 2
  });

  // Cabecera
  let y = height - 100;
  page.drawText('N\u00b0', { x: 55, y, size: 10, font: fontBold, color: PDFLib.rgb(0.3, 0.3, 0.3) });
  page.drawText('DESCRIPCI\u00d3N', { x: 90, y, size: 10, font: fontBold, color: PDFLib.rgb(0.3, 0.3, 0.3) });
  page.drawText('P\u00c1GINAS', { x: 400, y, size: 10, font: fontBold, color: PDFLib.rgb(0.3, 0.3, 0.3) });
  page.drawText('FOLIO', { x: 480, y, size: 10, font: fontBold, color: PDFLib.rgb(0.3, 0.3, 0.3) });

  y -= 5;
  page.drawLine({
    start: { x: 50, y },
    end: { x: width - 50, y },
    color: PDFLib.rgb(0.8, 0.8, 0.8),
    thickness: 0.5
  });

  // Fila única: el documento completo
  y -= 20;
  page.drawRectangle({
    x: 50, y: y - 4,
    width: width - 100, height: 18,
    color: PDFLib.rgb(0.96, 0.97, 0.98)
  });

  page.drawText('01', { x: 58, y, size: 10, font: fontBold, color: PDFLib.rgb(0.102, 0.227, 0.361) });

  // Nombre del archivo (truncar si es muy largo)
  const nombreLimpio = sanitizarWinAnsi(nombreArchivo.replace(/\.pdf$/i, '').replace(/[_\-]/g, ' '));
  const nombreCorto = nombreLimpio.length > 50 ? nombreLimpio.substring(0, 50) + '...' : nombreLimpio;
  page.drawText(nombreCorto, { x: 90, y, size: 10, font: fontNormal, color: PDFLib.rgb(0.2, 0.2, 0.2) });

  page.drawText(String(totalPaginas), { x: 415, y, size: 10, font: fontNormal, color: PDFLib.rgb(0.4, 0.4, 0.4) });
  page.drawText('3', { x: 488, y, size: 10, font: fontBold, color: PDFLib.rgb(0.102, 0.227, 0.361) });

  // Total
  y -= 30;
  page.drawLine({
    start: { x: 50, y: y + 8 },
    end: { x: width - 50, y: y + 8 },
    color: PDFLib.rgb(0.831, 0.627, 0.090),
    thickness: 1
  });

  const totalText = `Total: ${totalPaginas} p\u00e1ginas | Folios: 1 al ${totalPaginas + 2}`;
  page.drawText(totalText, {
    x: 90, y: y - 8,
    size: 10, font: fontBold,
    color: PDFLib.rgb(0.3, 0.3, 0.3)
  });
}

/* ══════════════════════════════════════════════════════════
   BACKUP / RESTORE — Copia de seguridad ZIP
══════════════════════════════════════════════════════════ */

async function descargarBackupZIP(){
  if(typeof JSZip === 'undefined'){
    toast('Error: libreria JSZip no cargada', 'danger');
    return;
  }

  toast('Generando copia de seguridad... Esto puede tardar unos segundos.', 'info');

  try {
    const zip = new JSZip();

    // 1. Exportar todos los expedientes
    const expedientes = DB._expedientes || [];
    zip.file('expedientes.json', JSON.stringify(expedientes, null, 2));

    // 2. Exportar todos los documentos
    const allDocKeys = await DB._getAllKeys('documentos');
    const allDocs = [];
    for(const k of allDocKeys){
      const doc = await DB._get('documentos', k);
      if(doc) allDocs.push(doc);
    }
    zip.file('documentos.json', JSON.stringify(allDocs, null, 2));

    // 3. Exportar archivos PDF
    const allArchivoKeys = await DB._getAllKeys('archivos');
    let archivosExportados = 0;
    for(const path of allArchivoKeys){
      const ab = await DB._get('archivos', path);
      if(ab){
        zip.file('archivos/' + path, ab);
        archivosExportados++;
      }
    }

    // 4. Metadata del backup
    const meta = {
      fecha: new Date().toISOString(),
      version: '1.0',
      totalExpedientes: expedientes.length,
      totalDocumentos: allDocs.length,
      totalArchivos: archivosExportados
    };
    zip.file('backup_info.json', JSON.stringify(meta, null, 2));

    // 5. Generar y descargar
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const fecha = new Date().toISOString().slice(0,10);
    const nombre = 'Backup_Expedientes_' + fecha + '.zip';

    // Intentar usar "Guardar como" para elegir carpeta (File System Access API)
    if(window.showSaveFilePicker){
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: nombre,
          types: [{
            description: 'Archivo ZIP',
            accept: { 'application/zip': ['.zip'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } catch(e){
        // Usuario cancelo el dialogo, descargar normal
        if(e.name !== 'AbortError'){
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = nombre;
          a.click();
          URL.revokeObjectURL(a.href);
        } else {
          toast('Backup cancelado', 'warning');
          return;
        }
      }
    } else {
      // Navegador sin soporte, descarga normal
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nombre;
      a.click();
      URL.revokeObjectURL(a.href);
    }

    // Guardar fecha del ultimo backup
    await DB._put('meta', 'ultimo_backup', Date.now());
    verificarAlertaBackup();

    toast('Copia de seguridad descargada: ' + nombre + ' (' + expedientes.length + ' expedientes, ' + archivosExportados + ' archivos)');

  } catch(e){
    console.error('Error generando backup:', e);
    toast('Error al generar backup: ' + e.message, 'danger');
  }
}

async function restaurarBackupZIP(input){
  const file = input.files[0];
  if(!file) return;

  if(!confirm('IMPORTANTE: Restaurar un backup reemplazara los datos actuales.\n\nLos expedientes y documentos que ya existan se actualizaran.\n\nDesea continuar?')){
    input.value = '';
    return;
  }

  toast('Restaurando copia de seguridad...', 'info');

  try {
    const zip = await JSZip.loadAsync(file);

    // 1. Verificar que es un backup valido
    const infoFile = zip.file('backup_info.json');
    if(!infoFile){
      toast('El archivo ZIP no es un backup valido de Expedientes', 'danger');
      input.value = '';
      return;
    }
    const info = JSON.parse(await infoFile.async('text'));

    // 2. Restaurar expedientes
    const expFile = zip.file('expedientes.json');
    if(expFile){
      const expedientes = JSON.parse(await expFile.async('text'));
      for(const exp of expedientes){
        await DB._put('expedientes', exp.id, exp);
        if(SB.isActive()) await SB.saveExpediente(exp);
      }
    }

    // 3. Restaurar documentos
    const docFile = zip.file('documentos.json');
    if(docFile){
      const documentos = JSON.parse(await docFile.async('text'));
      for(const doc of documentos){
        await DB._put('documentos', doc.id, doc);
        if(SB.isActive()) await SB.saveDocumento(doc);
      }
    }

    // 4. Restaurar archivos PDF
    let archivosRestaurados = 0;
    const archivoEntries = zip.folder('archivos');
    if(archivoEntries){
      const files = [];
      archivoEntries.forEach((relativePath, zipEntry) => {
        if(!zipEntry.dir) files.push({ path: relativePath, entry: zipEntry });
      });
      for(const f of files){
        const ab = await f.entry.async('arraybuffer');
        await DB.saveArchivo(f.path, ab);
        if(SB.isActive()){
          const blob = new Blob([ab], { type: 'application/pdf' });
          await SB.uploadPDF(f.path, blob);
        }
        archivosRestaurados++;
      }
    }

    // 5. Recargar app
    await DB.loadExpedientes();
    cargarFiltroInstituciones();
    renderListaExpedientes();

    toast('Backup restaurado: ' + (info.totalExpedientes || 0) + ' expedientes, ' + archivosRestaurados + ' archivos');

  } catch(e){
    console.error('Error restaurando backup:', e);
    toast('Error al restaurar: ' + e.message, 'danger');
  }

  input.value = '';
}

/* ── Alerta de backup pendiente ── */
async function verificarAlertaBackup(){
  try {
    const ultimo = await DB._get('meta', 'ultimo_backup');
    const alertEl = document.getElementById('backup-alert');
    if(!alertEl) return;

    if(!ultimo){
      // Nunca ha hecho backup
      alertEl.style.display = '';
      alertEl.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>Sin backup';
      return;
    }

    const diasSinBackup = Math.floor((Date.now() - ultimo) / (1000 * 60 * 60 * 24));
    if(diasSinBackup >= 7){
      alertEl.style.display = '';
      alertEl.innerHTML = '<i class="bi bi-exclamation-triangle me-1"></i>' + diasSinBackup + 'd sin backup';
    } else {
      alertEl.style.display = 'none';
    }
  } catch(e){
    console.warn('verificarAlertaBackup:', e);
  }
}
