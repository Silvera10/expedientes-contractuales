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

    // 5. Cargar expedientes e instituciones
    await DB.loadExpedientes();
    await cargarInstituciones();
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
/* ── Catálogo de instituciones (guardado en IndexedDB meta) ── */
let _instituciones = []; // cache en memoria

async function cargarInstituciones(){
  try {
    const data = await DB._get('meta', 'instituciones');
    _instituciones = data || [];
  } catch(e){
    _instituciones = [];
  }
  // Migrar instituciones antiguas (solo nombre) desde expedientes
  const nombres = new Set(_instituciones.map(i => i.nombre.toLowerCase()));
  DB._expedientes.forEach(e => {
    if(e.institucion && !nombres.has(e.institucion.toLowerCase())){
      _instituciones.push({ nombre: e.institucion, nit: '', municipio: '', rector: '', cedulaRector: '' });
      nombres.add(e.institucion.toLowerCase());
    }
  });
  await guardarInstituciones();
}

async function guardarInstituciones(){
  await DB._put('meta', 'instituciones', _instituciones);
}

function getInstituciones(){
  return _instituciones.map(i => i.nombre).sort();
}

function getInstitucionData(nombre){
  return _instituciones.find(i => i.nombre.toLowerCase() === nombre.toLowerCase()) || null;
}

function cargarFiltroInstituciones(){
  const select = document.getElementById('filtro-institucion');
  if(!select) return;
  const nombres = getInstituciones();
  const valorActual = select.value;
  select.innerHTML = '<option value="">Todas las instituciones</option>' +
    nombres.map(i => `<option value="${i}"${i === valorActual ? ' selected' : ''}>${i}</option>`).join('');
}

function cargarSelectInstituciones(){
  const select = document.getElementById('exp-institucion-select');
  if(!select) return;
  const nombres = getInstituciones();
  select.innerHTML = '<option value="">— Seleccione —</option>' +
    nombres.map(i => `<option value="${i}">${i}</option>`).join('') +
    '<option value="__nueva__">+ Agregar nueva instituci\u00f3n...</option>';
}

function onInstitucionSelect(){
  const select = document.getElementById('exp-institucion-select');
  const camposNueva = document.getElementById('campos-nueva-institucion');
  if(select.value === '__nueva__'){
    camposNueva.style.display = '';
    document.getElementById('inst-nombre').value = '';
    document.getElementById('inst-nit').value = '';
    document.getElementById('inst-municipio').value = '';
    document.getElementById('inst-rector').value = '';
    document.getElementById('inst-cedula-rector').value = '';
    document.getElementById('inst-nombre').focus();
  } else {
    camposNueva.style.display = 'none';
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

/* ══════════════════════════════════════════════════════════
   GENERAR INFORME POR TRIMESTRE — Todos los expedientes en un solo PDF
══════════════════════════════════════════════════════════ */
async function generarInformeAnual(){
  const filtro = document.getElementById('filtro-institucion').value;
  if(!filtro){
    toast('Seleccione una instituci\u00f3n en el filtro primero', 'warning');
    return;
  }

  // Preguntar trimestre
  const trimestre = prompt('Ingrese el trimestre (1, 2, 3 o 4).\nDejar vac\u00edo para generar todos los del a\u00f1o:');
  const anio = new Date().getFullYear();

  let exps = DB._expedientes.filter(e => e.institucion === filtro);

  if(trimestre && ['1','2','3','4'].includes(trimestre.trim())){
    const t = parseInt(trimestre.trim());
    const mesInicio = (t - 1) * 3; // 0,3,6,9
    const mesFin = mesInicio + 2;   // 2,5,8,11
    exps = exps.filter(e => {
      const fecha = e.datos?.fecha_contrato || e.created_at;
      if(!fecha) return false;
      const mes = new Date(fecha).getMonth();
      return mes >= mesInicio && mes <= mesFin;
    });
  }

  if(!exps.length){
    toast('No hay expedientes para el per\u00edodo seleccionado', 'warning');
    return;
  }

  if(_generandoPDF){
    toast('Ya se est\u00e1 generando un PDF, espere...', 'warning');
    return;
  }
  _generandoPDF = true;

  toast(`Generando informe con ${exps.length} expediente(s)... Esto puede tardar.`, 'info');

  try {
    const pdfFinal = await PDFLib.PDFDocument.create();
    const fontBold = await pdfFinal.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const fontNormal = await pdfFinal.embedFont(PDFLib.StandardFonts.Helvetica);

    // Portada general del informe
    const portada = pdfFinal.addPage(PDFLib.PageSizes.Letter);
    const { width, height } = portada.getSize();
    const centerX = width / 2;

    portada.drawRectangle({ x: 0, y: height - 120, width, height: 120, color: PDFLib.rgb(0.102, 0.227, 0.361) });
    portada.drawRectangle({ x: 0, y: height - 124, width, height: 4, color: PDFLib.rgb(0.831, 0.627, 0.090) });

    const tit = 'INFORME DE EXPEDIENTES CONTRACTUALES';
    portada.drawText(tit, { x: centerX - fontBold.widthOfTextAtSize(tit, 18) / 2, y: height - 55, size: 18, font: fontBold, color: PDFLib.rgb(1,1,1) });

    const periodo = trimestre ? `TRIMESTRE ${trimestre} DE ${anio}` : `A\u00d1O ${anio}`;
    portada.drawText(periodo, { x: centerX - fontBold.widthOfTextAtSize(periodo, 14) / 2, y: height - 80, size: 14, font: fontNormal, color: PDFLib.rgb(0.9,0.9,0.9) });

    const instData = getInstitucionData(filtro);
    let yp = height - 180;
    const infos = [
      { l: 'INSTITUCI\u00d3N', v: filtro.toUpperCase() },
    ];
    if(instData?.nit) infos.push({ l: 'NIT', v: instData.nit });
    if(instData?.municipio) infos.push({ l: 'MUNICIPIO', v: instData.municipio.toUpperCase() });
    if(instData?.rector) infos.push({ l: 'RECTOR(A)', v: instData.rector.toUpperCase() });
    infos.push({ l: 'TOTAL EXPEDIENTES', v: String(exps.length) });

    for(const info of infos){
      portada.drawText(sanitizarWinAnsi(info.l + ':'), { x: 80, y: yp, size: 9, font: fontBold, color: PDFLib.rgb(0.4,0.4,0.4) });
      portada.drawText(sanitizarWinAnsi(info.v), { x: 80, y: yp - 16, size: 12, font: fontBold, color: PDFLib.rgb(0.1,0.1,0.1) });
      yp -= 42;
    }

    // Agregar cada expediente foliado
    let expedientesIncluidos = 0;
    for(const exp of exps){
      // Buscar PDF foliado guardado
      const foliadoPath = await DB._get('meta', `foliado_${exp.id}`);
      if(!foliadoPath) continue;

      const foliadoBytes = await DB.getArchivo(foliadoPath);
      if(!foliadoBytes) continue;

      const srcPdf = await PDFLib.PDFDocument.load(foliadoBytes, { ignoreEncryption: true });
      try {
        const srcPages2 = srcPdf.getPages();
        for(const sp of srcPages2){ try { sp.node.delete(PDFLib.PDFName.of('Annots')); } catch(e){} }
      } catch(e){}
      const copiedPages = await pdfFinal.copyPages(srcPdf, srcPdf.getPageIndices());
      for(const page of copiedPages){
        pdfFinal.addPage(page);
      }
      expedientesIncluidos++;
    }

    if(expedientesIncluidos === 0){
      toast('Ninguno de los expedientes tiene PDF foliado guardado. Use "Foliar PDF Completo" primero en cada expediente.', 'warning');
      _generandoPDF = false;
      return;
    }

    const pdfBytes = await pdfFinal.save();
    const nombreArchivo = `Informe_${filtro.replace(/\s+/g, '_')}_${trimestre ? 'T' + trimestre : ''}${anio}.pdf`;
    descargarPDF(pdfBytes, sanitizarWinAnsi(nombreArchivo));

    toast(`Informe generado: ${expedientesIncluidos} expedientes en un solo PDF`);

  } catch(e){
    console.error('Error generando informe:', e);
    toast('Error al generar informe: ' + e.message, 'danger');
  } finally {
    _generandoPDF = false;
  }
}

function filtrarPorInstitucion(){
  const filtro = document.getElementById('filtro-institucion').value;
  DB._filtroInstitucion = filtro;
  mostrarInfoInstitucion(filtro);
  renderListaExpedientes();
}

function mostrarInfoInstitucion(nombre){
  const panel = document.getElementById('info-institucion');
  if(!panel) return;
  if(!nombre){
    panel.style.display = 'none';
    return;
  }
  const inst = getInstitucionData(nombre);
  if(!inst){
    panel.style.display = 'none';
    return;
  }
  const expCount = DB._expedientes.filter(e => e.institucion === nombre).length;
  panel.style.display = '';
  panel.innerHTML = `
    <div class="px-2 py-2" style="background:#e8f4fd;border-bottom:1px solid #bee5eb;font-size:11px">
      <div class="fw-bold text-primary mb-1"><i class="bi bi-building me-1"></i>${inst.nombre}</div>
      ${inst.nit ? `<div><strong>NIT:</strong> ${inst.nit}</div>` : ''}
      ${inst.municipio ? `<div><strong>Municipio:</strong> ${inst.municipio}</div>` : ''}
      ${inst.rector ? `<div><strong>Rector(a):</strong> ${inst.rector}</div>` : ''}
      ${inst.cedulaRector ? `<div><strong>C.C.:</strong> ${inst.cedulaRector}</div>` : ''}
      <div class="mt-1"><strong>Expedientes:</strong> ${expCount}
        <button class="btn btn-outline-secondary py-0 px-1 ms-2" style="font-size:9px" onclick="editarInstitucion('${inst.nombre.replace(/'/g, "\\'")}')" title="Editar datos"><i class="bi bi-pencil"></i> Editar</button>
      </div>
    </div>`;
}

function editarInstitucion(nombre){
  const inst = getInstitucionData(nombre);
  if(!inst) return;
  const nuevoNit = prompt('NIT de la instituci\u00f3n:', inst.nit || '');
  if(nuevoNit === null) return;
  const nuevoMunicipio = prompt('Municipio / Departamento:', inst.municipio || '');
  if(nuevoMunicipio === null) return;
  const nuevoRector = prompt('Nombre del Rector(a):', inst.rector || '');
  if(nuevoRector === null) return;
  const nuevaCedula = prompt('C\u00e9dula del Rector(a):', inst.cedulaRector || '');
  if(nuevaCedula === null) return;
  inst.nit = nuevoNit;
  inst.municipio = nuevoMunicipio;
  inst.rector = nuevoRector;
  inst.cedulaRector = nuevaCedula;
  guardarInstituciones();
  mostrarInfoInstitucion(nombre);
  toast('Datos de la instituci\u00f3n actualizados');
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
  let institucion = '';

  if(selectInst.value === '__nueva__'){
    // Nueva institución: guardar en catálogo
    institucion = document.getElementById('inst-nombre').value.trim();
    if(!institucion){
      toast('Ingrese el nombre de la instituci\u00f3n', 'danger');
      return;
    }
    const nuevaInst = {
      nombre: institucion,
      nit: document.getElementById('inst-nit').value.trim(),
      municipio: document.getElementById('inst-municipio').value.trim(),
      rector: document.getElementById('inst-rector').value.trim(),
      cedulaRector: document.getElementById('inst-cedula-rector').value.trim()
    };
    // Verificar que no exista
    const existente = _instituciones.find(i => i.nombre.toLowerCase() === institucion.toLowerCase());
    if(existente){
      // Actualizar datos
      Object.assign(existente, nuevaInst);
    } else {
      _instituciones.push(nuevaInst);
    }
    await guardarInstituciones();
  } else if(selectInst.value && selectInst.value !== ''){
    institucion = selectInst.value;
  }

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

async function descargarDocumento(docId){
  try {
    const doc = await DB.getDocumento(docId);
    if(!doc || !doc.storage_path){
      toast('No se encontró el archivo', 'danger');
      return;
    }
    const bytes = await DB.getArchivo(doc.storage_path);
    if(!bytes){
      toast('Archivo no encontrado en almacenamiento', 'danger');
      return;
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.nombre_archivo || 'documento.pdf';
    a.click();
    URL.revokeObjectURL(url);
  } catch(e){
    console.error('Error descargando documento:', e);
    toast('Error al descargar: ' + e.message, 'danger');
  }
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
    await generarIndiceFoliar(pdfFinal, exp, file.name, totalPaginasDoc, totalFolios, fontBold, fontNormal);

    // 3. Copiar todas las páginas del PDF original
    // Intentar copiar normalmente, si falla por anotaciones, copiar sin ellas
    try {
      const copiedPages = await pdfFinal.copyPages(srcPdf, srcPdf.getPageIndices());
      for(const page of copiedPages){
        pdfFinal.addPage(page);
      }
    } catch(copyErr) {
      console.warn('Error copiando con anotaciones, intentando sin ellas:', copyErr.message);
      // Quitar anotaciones problemáticas y reintentar
      const srcPages = srcPdf.getPages();
      for(const sp of srcPages){
        try { sp.node.delete(PDFLib.PDFName.of('Annots')); } catch(e){}
      }
      const copiedPages2 = await pdfFinal.copyPages(srcPdf, srcPdf.getPageIndices());
      for(const page of copiedPages2){
        pdfFinal.addPage(page);
      }
    }

    // 4. Estampar folio en TODAS las páginas
    const allPages = pdfFinal.getPages();
    for(let i = 0; i < allPages.length; i++){
      estamparFolio(allPages[i], i + 1, totalFolios, fontBold);
    }

    // 5. Guardar PDF original en el expediente
    const storagePath = `${expId}/expediente_completo_${Date.now()}.pdf`;
    await DB.saveArchivo(storagePath, arrayBuffer);

    // Guardar metadata del documento
    const docId = `${expId}_expediente_completo`;
    const doc = {
      id: docId,
      expediente_id: expId,
      tipo: 'expediente_completo',
      orden: 0,
      nombre_archivo: file.name,
      storage_path: storagePath,
      paginas: totalPaginasDoc,
      fecha_expedicion: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };
    await DB.saveDocumento(doc);

    // 6. Guardar PDF foliado final
    const pdfBytes = await pdfFinal.save();
    const foliadoPath = `${expId}/expediente_foliado_${Date.now()}.pdf`;
    await DB.saveArchivo(foliadoPath, pdfBytes.buffer);
    await DB._put('meta', `foliado_${expId}`, foliadoPath);

    // 7. Descargar
    const nombreArchivo = `Expediente_Cto_${exp.contrato_numero}_${exp.anio}.pdf`;
    descargarPDF(pdfBytes, nombreArchivo);

    // Actualizar vista
    await actualizarEstadoExpediente(expId);
    renderDetalleExpediente(expId);

    toast(`Expediente foliado: ${totalFolios} folios. Guardado en el expediente.`);

  } catch(e){
    console.error('Error foliando PDF:', e);
    toast('Error al foliar PDF: ' + e.message, 'danger');
  } finally {
    _generandoPDF = false;
  }
}

/* ══════════════════════════════════════════════════════════
   FOLIAR Y ORGANIZAR — Detecta documentos, reordena y folia
══════════════════════════════════════════════════════════ */
async function foliarYOrganizarPDF(expId, inputEl){
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

  toast('Analizando PDF... Detectando documentos y organizando...', 'info');

  try {
    const arrayBuffer = await file.arrayBuffer();

    // 1. Extraer texto de cada página con pdf.js
    const pdfJs = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
    const totalPags = pdfJs.numPages;
    const paginasTexto = [];

    for(let i = 1; i <= totalPags; i++){
      const page = await pdfJs.getPage(i);
      const content = await page.getTextContent();
      const texto = content.items.map(item => item.str).join(' ').toLowerCase();
      paginasTexto.push({ num: i, texto, chars: texto.trim().length });
    }

    // Detectar si es PDF escaneado (sin texto)
    const paginasSinTexto = paginasTexto.filter(p => p.chars < 20).length;
    if(paginasSinTexto > totalPags * 0.5){
      toast('Este PDF es escaneado (im\u00e1genes). Use "Foliar PDF Completo" en su lugar \u2014 ese bot\u00f3n no necesita leer texto.', 'warning');
      _generandoPDF = false;
      return;
    }

    // 2. Clasificar cada página individualmente
    console.log('=== AN\u00c1LISIS POR P\u00c1GINA ===');
    for(const pag of paginasTexto){
      const result = clasificarGrupo([pag]);
      pag.tipo = result.tipo;
      pag.confianza = result.confianza;
      const preview = pag.texto.substring(0, 80).replace(/\s+/g, ' ');
      console.log(`P\u00e1g ${pag.num}: [${pag.tipo || '?'}] conf=${pag.confianza} chars=${pag.chars} "${preview}..."`);
    }

    // 3. Agrupar páginas consecutivas: solo cortar cuando hay tipo DIFERENTE
    const grupos = [];
    let grupoActual = null;
    const CONFIANZA_MINIMA = 3; // bajado de 5 a 3 para detectar más documentos

    for(const pag of paginasTexto){
      const tieneDeteccionClara = pag.tipo && pag.confianza >= CONFIANZA_MINIMA;
      const esPaginaFirmas = pag.chars < 150; // poco texto = firmas/sellos

      if(!grupoActual){
        // Primera página: crear grupo
        grupoActual = {
          tipo: pag.tipo || 'no_identificado',
          confianza: pag.confianza || 0,
          paginas: [pag.num]
        };
      } else if(tieneDeteccionClara && !esPaginaFirmas && pag.tipo !== grupoActual.tipo){
        // Tipo diferente con confianza + no es página de firmas → nuevo grupo
        grupos.push(grupoActual);
        grupoActual = {
          tipo: pag.tipo,
          confianza: pag.confianza,
          paginas: [pag.num]
        };
      } else {
        // Misma tipo, sin tipo, poco texto, o baja confianza → sigue en el mismo grupo
        grupoActual.paginas.push(pag.num);
      }
    }
    if(grupoActual) grupos.push(grupoActual);

    // 4. Asignar orden a cada grupo según DOC_TIPOS
    const todosLosTipos = [...DOC_TIPOS, ...DOC_TIPOS_ADICION];
    for(const grupo of grupos){
      const tipoDef = todosLosTipos.find(d => d.id === grupo.tipo);
      grupo.orden = tipoDef ? tipoDef.orden : 99;
      grupo.nombre = tipoDef ? tipoDef.nombre : 'Documento sin clasificar';
      grupo.codigo = tipoDef ? (tipoDef.codigo || '') : '';
    }

    // 5. Reordenar grupos por orden FOSE
    grupos.sort((a, b) => a.orden - b.orden);

    console.log('Grupos detectados:', grupos.map(g => `${g.codigo} ${g.nombre} (${g.paginas.length} págs, conf: ${g.confianza})`));

    // 6. Construir PDF reordenado
    const srcPdf = await PDFLib.PDFDocument.load(arrayBuffer.slice(0), { ignoreEncryption: true });
    const totalFolios = totalPags + 2; // +2 carátula e índice

    const pdfFinal = await PDFLib.PDFDocument.create();
    const fontBold = await pdfFinal.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const fontNormal = await pdfFinal.embedFont(PDFLib.StandardFonts.Helvetica);

    // Carátula (folio 1)
    await generarPortada(pdfFinal, exp, totalFolios, fontBold, fontNormal);

    // Índice detallado (folio 2)
    await generarIndiceOrganizado(pdfFinal, exp, grupos, totalFolios, fontBold, fontNormal);

    // Quitar anotaciones problemáticas antes de copiar
    try {
      const srcPages = srcPdf.getPages();
      for(const sp of srcPages){
        try { sp.node.delete(PDFLib.PDFName.of('Annots')); } catch(e){}
      }
    } catch(e){ console.warn('No se pudieron limpiar anotaciones:', e); }

    // Copiar páginas en el nuevo orden
    for(const grupo of grupos){
      const indices = grupo.paginas.map(p => p - 1); // pdf-lib usa 0-based
      const copiedPages = await pdfFinal.copyPages(srcPdf, indices);
      for(const page of copiedPages){
        pdfFinal.addPage(page);
      }
    }

    // Estampar folio en todas las páginas
    const allPages = pdfFinal.getPages();
    for(let i = 0; i < allPages.length; i++){
      estamparFolio(allPages[i], i + 1, totalFolios, fontBold);
    }

    // Descargar
    const pdfBytes = await pdfFinal.save();
    const nombreArchivo = `Expediente_Cto_${exp.contrato_numero}_${exp.anio}_Organizado.pdf`;
    descargarPDF(pdfBytes, nombreArchivo);

    toast(`Expediente organizado: ${grupos.length} documentos detectados, ${totalFolios} folios`);

  } catch(e){
    console.error('Error organizando PDF:', e);
    toast('Error al organizar PDF: ' + e.message, 'danger');
  } finally {
    _generandoPDF = false;
  }
}

/* Índice detallado para PDF organizado */
async function generarIndiceOrganizado(pdfDoc, exp, grupos, totalFolios, fontBold, fontNormal){
  const page = pdfDoc.addPage(PDFLib.PageSizes.Letter);
  const { width, height } = page.getSize();
  const azul = PDFLib.rgb(0.102, 0.227, 0.361);
  const gris = PDFLib.rgb(0.3, 0.3, 0.3);
  const dorado = PDFLib.rgb(0.831, 0.627, 0.090);

  // Título
  const titulo = '\u00cdNDICE DEL EXPEDIENTE';
  page.drawText(titulo, {
    x: width / 2 - fontBold.widthOfTextAtSize(titulo, 16) / 2,
    y: height - 55,
    size: 16, font: fontBold, color: azul
  });

  const subtitulo = sanitizarWinAnsi(`Contrato N. ${exp.contrato_numero || ''} de ${exp.anio || ''} - ${exp.contratista || ''}`);
  const subCorto = subtitulo.length > 70 ? subtitulo.substring(0, 70) + '...' : subtitulo;
  page.drawText(subCorto, {
    x: width / 2 - fontNormal.widthOfTextAtSize(subCorto, 10) / 2,
    y: height - 72,
    size: 10, font: fontNormal, color: gris
  });

  page.drawLine({
    start: { x: 50, y: height - 80 },
    end: { x: width - 50, y: height - 80 },
    color: dorado, thickness: 2
  });

  // Cabecera
  let y = height - 100;
  page.drawText('N.', { x: 55, y, size: 9, font: fontBold, color: gris });
  page.drawText('COD.', { x: 75, y, size: 9, font: fontBold, color: gris });
  page.drawText('DOCUMENTO', { x: 120, y, size: 9, font: fontBold, color: gris });
  page.drawText('PAGS.', { x: 400, y, size: 9, font: fontBold, color: gris });
  page.drawText('FOLIO', { x: 460, y, size: 9, font: fontBold, color: gris });

  y -= 5;
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, color: PDFLib.rgb(0.8, 0.8, 0.8), thickness: 0.5 });

  // Filas
  let folioActual = 3; // empieza en folio 3 (después de carátula e índice)
  grupos.forEach((grupo, idx) => {
    y -= 17;
    if(y < 60) return; // protección contra overflow

    // Fondo alterno
    if(idx % 2 === 0){
      page.drawRectangle({
        x: 50, y: y - 4,
        width: width - 100, height: 17,
        color: PDFLib.rgb(0.96, 0.97, 0.98)
      });
    }

    const num = String(idx + 1).padStart(2, '0');
    page.drawText(num, { x: 58, y, size: 9, font: fontBold, color: azul });

    // Código FOSE
    if(grupo.codigo){
      page.drawText(grupo.codigo, { x: 75, y, size: 8, font: fontBold, color: PDFLib.rgb(0.4, 0.4, 0.4) });
    }

    // Nombre
    const nombreSafe = sanitizarWinAnsi(grupo.nombre);
    const nombreCorto = nombreSafe.length > 40 ? nombreSafe.substring(0, 40) + '...' : nombreSafe;
    page.drawText(nombreCorto, { x: 120, y, size: 9, font: fontNormal, color: PDFLib.rgb(0.1, 0.1, 0.1) });

    // Páginas
    page.drawText(String(grupo.paginas.length), { x: 410, y, size: 9, font: fontNormal, color: gris });

    // Folio inicio
    page.drawText(String(folioActual), { x: 468, y, size: 9, font: fontBold, color: azul });

    folioActual += grupo.paginas.length;
  });

  // Total
  y -= 22;
  page.drawLine({ start: { x: 50, y: y + 8 }, end: { x: width - 50, y: y + 8 }, color: dorado, thickness: 1 });

  const totalText = sanitizarWinAnsi(`Total: ${grupos.length} documentos | ${totalFolios} folios`);
  page.drawText(totalText, {
    x: 120, y: y - 5,
    size: 10, font: fontBold, color: gris
  });
}

/* Índice simple para PDF foliado completo */
async function generarIndiceFoliar(pdfDoc, exp, nombreArchivo, totalPaginas, totalFolios, fontBold, fontNormal){
  const page = pdfDoc.addPage(PDFLib.PageSizes.Letter);
  const { width, height } = page.getSize();
  const azul = PDFLib.rgb(0.102, 0.227, 0.361);
  const gris = PDFLib.rgb(0.3, 0.3, 0.3);
  const dorado = PDFLib.rgb(0.831, 0.627, 0.090);

  // Título
  const titulo = '\u00cdNDICE DEL EXPEDIENTE';
  page.drawText(titulo, {
    x: width / 2 - fontBold.widthOfTextAtSize(titulo, 16) / 2,
    y: height - 60,
    size: 16, font: fontBold, color: azul
  });

  // Subtítulo con datos del expediente
  const subtitulo = sanitizarWinAnsi(`Contrato N. ${exp.contrato_numero || ''} de ${exp.anio || ''} - ${exp.contratista || ''}`);
  const subCorto = subtitulo.length > 70 ? subtitulo.substring(0, 70) + '...' : subtitulo;
  page.drawText(subCorto, {
    x: width / 2 - fontNormal.widthOfTextAtSize(subCorto, 10) / 2,
    y: height - 78,
    size: 10, font: fontNormal, color: gris
  });

  // Línea dorada
  page.drawLine({
    start: { x: 50, y: height - 88 },
    end: { x: width - 50, y: height - 88 },
    color: dorado, thickness: 2
  });

  // Resumen de foliación
  let y = height - 115;
  page.drawRectangle({
    x: 50, y: y - 8,
    width: width - 100, height: 28,
    color: PDFLib.rgb(0.94, 0.96, 0.98),
    borderColor: azul, borderWidth: 0.5
  });

  const resumen = sanitizarWinAnsi(`TOTAL FOLIOS: ${totalFolios}  |  Caratula: Folio 1  |  Indice: Folio 2  |  Documentos: Folios 3 al ${totalFolios}`);
  page.drawText(resumen, {
    x: 60, y: y,
    size: 9, font: fontBold, color: azul
  });

  // Cabecera tabla
  y -= 40;
  page.drawText('N.', { x: 55, y, size: 10, font: fontBold, color: gris });
  page.drawText('DESCRIPCI\u00d3N', { x: 80, y, size: 10, font: fontBold, color: gris });
  page.drawText('P\u00c1GINAS', { x: 380, y, size: 10, font: fontBold, color: gris });
  page.drawText('FOLIO INICIO', { x: 445, y, size: 10, font: fontBold, color: gris });

  y -= 5;
  page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, color: PDFLib.rgb(0.8, 0.8, 0.8), thickness: 0.5 });

  // Fila 1: Carátula
  y -= 18;
  page.drawText('01', { x: 58, y, size: 9, font: fontNormal, color: gris });
  page.drawText('Caratula del Expediente', { x: 80, y, size: 9, font: fontNormal, color: gris });
  page.drawText('1', { x: 400, y, size: 9, font: fontNormal, color: gris });
  page.drawText('1', { x: 470, y, size: 9, font: fontBold, color: azul });

  // Fila 2: Índice
  y -= 18;
  page.drawRectangle({ x: 50, y: y - 4, width: width - 100, height: 18, color: PDFLib.rgb(0.96, 0.97, 0.98) });
  page.drawText('02', { x: 58, y, size: 9, font: fontNormal, color: gris });
  page.drawText('Indice del Expediente', { x: 80, y, size: 9, font: fontNormal, color: gris });
  page.drawText('1', { x: 400, y, size: 9, font: fontNormal, color: gris });
  page.drawText('2', { x: 470, y, size: 9, font: fontBold, color: azul });

  // Fila 3: Documento principal
  y -= 18;
  const nombreLimpio = sanitizarWinAnsi(nombreArchivo.replace(/\.pdf$/i, '').replace(/[_\-]/g, ' '));
  const nombreDesc = nombreLimpio === 'download'
    ? sanitizarWinAnsi(`Expediente Contractual Cto ${exp.contrato_numero || ''} de ${exp.anio || ''}`)
    : nombreLimpio;
  const nombreCorto = nombreDesc.length > 45 ? nombreDesc.substring(0, 45) + '...' : nombreDesc;
  page.drawText('03', { x: 58, y, size: 9, font: fontBold, color: azul });
  page.drawText(nombreCorto, { x: 80, y, size: 9, font: fontBold, color: PDFLib.rgb(0.1, 0.1, 0.1) });
  page.drawText(String(totalPaginas), { x: 400, y, size: 9, font: fontBold, color: PDFLib.rgb(0.1, 0.1, 0.1) });
  page.drawText('3', { x: 470, y, size: 9, font: fontBold, color: azul });

  // Total
  y -= 25;
  page.drawLine({ start: { x: 50, y: y + 8 }, end: { x: width - 50, y: y + 8 }, color: dorado, thickness: 1 });

  const totalText = sanitizarWinAnsi(`Total: ${totalFolios} folios (${totalPaginas} paginas de documentos + caratula + indice)`);
  page.drawText(totalText, {
    x: 80, y: y - 8,
    size: 10, font: fontBold, color: gris
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
