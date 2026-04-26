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

    // 2. Si el usuario eligi\u00f3 modo local, saltar Supabase
    const modoLocal = localStorage.getItem('modo_local') === '1';
    if(modoLocal){
      SB._configured = false;
      SB.client = null;
      document.getElementById('user-name').textContent = 'Usuario Local';
      const syncEl = document.getElementById('sync-status');
      if(syncEl){
        syncEl.className = 'badge bg-secondary';
        syncEl.innerHTML = '<i class="bi bi-laptop"></i>';
        syncEl.title = 'Modo local (sin nube)';
      }
    } else {
      // Inicializar Supabase normalmente
      SB.init();

      // Verificar sesion (con timeout para evitar bloqueo si Supabase cay\u00f3)
      if(SB.isActive()){
        try {
          const userPromise = SB.getUser();
          const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000));
          const user = await Promise.race([userPromise, timeoutPromise]);
          if(!user){
            document.getElementById('auth-overlay').style.display = 'flex';
            document.getElementById('app-container').style.display = 'none';
            return;
          }
          const nombre = user.user_metadata?.nombre || user.email;
          document.getElementById('user-name').textContent = nombre;
        } catch(err){
          // Supabase no responde - mostrar login con opci\u00f3n local
          console.warn('Supabase no disponible:', err.message);
          document.getElementById('auth-overlay').style.display = 'flex';
          document.getElementById('app-container').style.display = 'none';
          const errEl = document.getElementById('auth-error');
          if(errEl){
            errEl.style.display = 'block';
            errEl.innerHTML = 'Servidor de nube no disponible. Use <b>"Entrar en modo local"</b> para trabajar sin conexi\u00f3n.';
          }
          return;
        }
      }
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

    // 7. Restaurar backup autom\u00e1tico si estaba configurado
    await restaurarBackupAutomaticoAlIniciar();
    actualizarIndicadorBackupAuto();

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
/* ── Entrar en modo local (sin Supabase) ── */
async function entrarModoLocal(){
  try {
    // Marcar flag en localStorage para recordar la preferencia
    localStorage.setItem('modo_local', '1');

    // Desactivar Supabase
    SB._configured = false;
    SB.client = null;

    // Mostrar app
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('app-container').style.display = '';
    document.getElementById('user-name').textContent = 'Usuario Local';

    // Cargar datos locales
    await DB.loadExpedientes();
    await cargarInstituciones();
    cargarFiltroInstituciones();
    renderListaExpedientes();
    verificarAlertaBackup();
    await restaurarBackupAutomaticoAlIniciar();
    actualizarIndicadorBackupAuto();

    // Indicador de modo offline
    const syncEl = document.getElementById('sync-status');
    if(syncEl){
      syncEl.className = 'badge bg-secondary';
      syncEl.innerHTML = '<i class="bi bi-laptop"></i>';
      syncEl.title = 'Modo local (sin nube)';
    }

    toast('Modo local activado. Usa los backups ZIP para respaldar tus datos.', 'info');
  } catch(e){
    console.error('Error modo local:', e);
    toast('Error: ' + e.message, 'danger');
  }
}

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
  // Limpiar flag de modo local
  localStorage.removeItem('modo_local');
  try { await SB.logout(); } catch(e){}
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
  const btnEditar = document.getElementById('btn-editar-institucion');
  if(select.value === '__nueva__'){
    camposNueva.style.display = '';
    document.getElementById('inst-nombre').value = '';
    document.getElementById('inst-nit').value = '';
    document.getElementById('inst-municipio').value = '';
    document.getElementById('inst-rector').value = '';
    document.getElementById('inst-cedula-rector').value = '';
    document.getElementById('inst-nombre').focus();
    if(btnEditar) btnEditar.style.display = 'none';
  } else if(select.value && select.value !== ''){
    camposNueva.style.display = 'none';
    if(btnEditar) btnEditar.style.display = '';
  } else {
    camposNueva.style.display = 'none';
    if(btnEditar) btnEditar.style.display = 'none';
  }
}

function editarInstitucion(){
  const select = document.getElementById('exp-institucion-select');
  const nombre = select.value;
  if(!nombre || nombre === '__nueva__') return;

  const inst = getInstitucionData(nombre);
  if(!inst) return;

  // Mostrar campos con datos actuales
  const camposNueva = document.getElementById('campos-nueva-institucion');
  camposNueva.style.display = '';
  document.getElementById('inst-nombre').value = inst.nombre || '';
  document.getElementById('inst-nit').value = inst.nit || '';
  document.getElementById('inst-municipio').value = inst.municipio || '';
  document.getElementById('inst-rector').value = inst.rector || '';
  document.getElementById('inst-cedula-rector').value = inst.cedulaRector || '';

  // Marcar que estamos editando
  select.value = '__nueva__';
  select.dataset.editando = nombre; // guardar nombre original para renombrar
}

async function guardarInstitucionEditada(nombreOriginal, datosNuevos){
  const inst = _instituciones.find(i => i.nombre.toLowerCase() === nombreOriginal.toLowerCase());
  if(!inst) return;

  const nombreViejo = inst.nombre;
  const nombreNuevo = datosNuevos.nombre;

  // Actualizar datos de la institución
  Object.assign(inst, datosNuevos);

  // Si cambió el nombre, actualizar todos los expedientes que usen el nombre viejo
  if(nombreViejo !== nombreNuevo){
    for(const exp of DB._expedientes){
      if(exp.institucion === nombreViejo){
        exp.institucion = nombreNuevo;
        await DB.saveExpediente(exp);
      }
    }
  }

  await guardarInstituciones();
  cargarFiltroInstituciones();
  cargarSelectInstituciones();
  renderListaExpedientes();
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
  const panel = document.getElementById('info-institucion');
  if(!panel) return;

  panel.innerHTML = `
    <div class="px-2 py-2" style="background:#fff3cd;border-bottom:1px solid #ffc107;font-size:11px">
      <div class="fw-bold text-warning mb-2"><i class="bi bi-pencil me-1"></i>Editar Institucion</div>
      <div class="mb-1">
        <input type="text" id="edit-inst-nombre" class="form-control form-control-sm" value="${inst.nombre}" placeholder="Nombre *" style="font-size:11px">
      </div>
      <div class="row mb-1">
        <div class="col-6"><input type="text" id="edit-inst-nit" class="form-control form-control-sm" value="${inst.nit || ''}" placeholder="NIT" style="font-size:11px"></div>
        <div class="col-6"><input type="text" id="edit-inst-municipio" class="form-control form-control-sm" value="${inst.municipio || ''}" placeholder="Municipio" style="font-size:11px"></div>
      </div>
      <div class="row mb-1">
        <div class="col-6"><input type="text" id="edit-inst-rector" class="form-control form-control-sm" value="${inst.rector || ''}" placeholder="Rector(a)" style="font-size:11px"></div>
        <div class="col-6"><input type="text" id="edit-inst-cedula" class="form-control form-control-sm" value="${inst.cedulaRector || ''}" placeholder="Cedula Rector" style="font-size:11px"></div>
      </div>
      <div class="d-flex gap-1 mt-2">
        <button class="btn btn-success btn-sm py-0 px-2" style="font-size:10px" onclick="guardarEdicionInstitucion('${inst.nombre.replace(/'/g, "\\'")}')"><i class="bi bi-check-lg me-1"></i>Guardar</button>
        <button class="btn btn-secondary btn-sm py-0 px-2" style="font-size:10px" onclick="mostrarInfoInstitucion('${inst.nombre.replace(/'/g, "\\'")}')"><i class="bi bi-x-lg me-1"></i>Cancelar</button>
      </div>
    </div>`;
}

async function guardarEdicionInstitucion(nombreOriginal){
  const nuevoNombre = document.getElementById('edit-inst-nombre').value.trim();
  if(!nuevoNombre){
    toast('El nombre es obligatorio', 'danger');
    return;
  }

  const datosNuevos = {
    nombre: nuevoNombre,
    nit: document.getElementById('edit-inst-nit').value.trim(),
    municipio: document.getElementById('edit-inst-municipio').value.trim(),
    rector: document.getElementById('edit-inst-rector').value.trim(),
    cedulaRector: document.getElementById('edit-inst-cedula').value.trim()
  };

  const inst = _instituciones.find(i => i.nombre.toLowerCase() === nombreOriginal.toLowerCase());
  if(!inst){
    toast('Institucion no encontrada', 'danger');
    return;
  }

  const nombreViejo = inst.nombre;
  Object.assign(inst, datosNuevos);

  // Si cambio el nombre, actualizar expedientes
  if(nombreViejo !== nuevoNombre){
    for(const exp of DB._expedientes){
      if(exp.institucion === nombreViejo){
        exp.institucion = nuevoNombre;
        await DB.saveExpediente(exp);
      }
    }
    // Actualizar filtro
    DB._filtroInstitucion = nuevoNombre;
    document.getElementById('filtro-institucion').value = nuevoNombre;
  }

  await guardarInstituciones();
  cargarFiltroInstituciones();
  mostrarInfoInstitucion(nuevoNombre);
  renderListaExpedientes();
  toast('Datos de la institucion actualizados');
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
    // Nueva institución o editando existente
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

    // Si estamos editando una existente (renombrar)
    const editando = selectInst.dataset.editando;
    if(editando){
      await guardarInstitucionEditada(editando, nuevaInst);
      delete selectInst.dataset.editando;
    } else {
      // Verificar que no exista
      const existente = _instituciones.find(i => i.nombre.toLowerCase() === institucion.toLowerCase());
      if(existente){
        Object.assign(existente, nuevaInst);
      } else {
        _instituciones.push(nuevaInst);
      }
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
   CONVERTIR HTML a PDF — Usado por Foliar PDF Completo y Organizar
══════════════════════════════════════════════════════════ */
async function convertirHTMLaPDF(htmlText){
  // Crear div visible para html2canvas
  const renderDiv = document.createElement('div');
  renderDiv.id = 'html-pdf-render-organizar';
  renderDiv.style.cssText = 'position:fixed;left:0;top:0;width:816px;z-index:1;background:#fff;overflow:hidden;';

  const parser = new DOMParser();
  const htmlDoc = parser.parseFromString(htmlText, 'text/html');
  let allStyles = '';
  htmlDoc.querySelectorAll('style').forEach(s => {
    let css = s.textContent;
    css = css.replace(/@page[^{]*\{[^}]*\}/g, '');
    css = css.replace(/@media\s+print\s*\{[\s\S]*?\}\s*\}/g, '');
    css = css.replace(/\bbody\b/g, '#html-pdf-render-organizar');
    allStyles += css + '\n';
  });

  renderDiv.innerHTML = `
    <style>
      #html-pdf-render-organizar {
        font-family: Arial, sans-serif; font-size: 11pt; color: #000;
        padding: 40px 50px; box-sizing: border-box;
        word-wrap: break-word; overflow-wrap: break-word;
      }
      #html-pdf-render-organizar * { box-sizing: border-box; max-width: 100%; }
      #html-pdf-render-organizar table { width: 100%; table-layout: fixed; border-collapse: collapse; }
      #html-pdf-render-organizar td, #html-pdf-render-organizar th { word-wrap: break-word; overflow-wrap: break-word; padding: 4px 6px; }
      #html-pdf-render-organizar img { max-width: 100%; height: auto; }
      ${allStyles}
    </style>
    ${htmlDoc.body.innerHTML}
  `;
  renderDiv.querySelectorAll('.no-print, .print-btn, button[onclick*="print"]').forEach(el => el.remove());
  document.body.appendChild(renderDiv);

  await new Promise(r => setTimeout(r, 800));
  const contentHeight = renderDiv.scrollHeight;

  const canvas = await html2canvas(renderDiv, {
    scale: 2, useCORS: true, backgroundColor: '#ffffff',
    scrollX: 0, scrollY: -window.scrollY,
    width: 816, height: contentHeight
  });

  document.body.removeChild(renderDiv);

  // Cortar el canvas en páginas Letter y construir PDF
  const pdfDoc = await PDFLib.PDFDocument.create();
  const pageW = 612, pageH = 792, margin = 30;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;
  const scale = contentW / canvas.width;
  const pxPerPage = Math.floor(contentH / scale);

  // Leer pixels del canvas para detectar espacios en blanco
  const fullCtx = canvas.getContext('2d');
  const imgData = fullCtx.getImageData(0, 0, canvas.width, canvas.height);

  // Función: contar píxeles no-blancos en una fila (menor = más blanco)
  const rowDarkness = (y) => {
    if(y < 0 || y >= canvas.height) return canvas.width;
    const tolerance = 15;
    let darkPixels = 0;
    for(let x = 0; x < canvas.width; x++){
      const idx = (y * canvas.width + x) * 4;
      const r = imgData.data[idx], g = imgData.data[idx+1], b = imgData.data[idx+2];
      if(r < 255-tolerance || g < 255-tolerance || b < 255-tolerance) darkPixels++;
    }
    return darkPixels;
  };

  const isWhiteRow = (y) => rowDarkness(y) / canvas.width < 0.02; // 98% blanco

  // Encontrar mejor punto de corte cerca del target
  const findSafeBreak = (targetY) => {
    const maxLookback = Math.floor(pxPerPage * 0.30); // hasta 30% hacia arriba

    // Paso 1: buscar filas completamente blancas
    for(let offset = 0; offset <= maxLookback; offset++){
      const y = targetY - offset;
      if(y <= 0) break;
      if(isWhiteRow(y)) return y;
    }

    // Paso 2 (fallback): buscar la fila MAS clara en el rango
    let bestY = targetY;
    let bestDarkness = rowDarkness(targetY);
    for(let offset = 1; offset <= maxLookback; offset++){
      const y = targetY - offset;
      if(y <= 0) break;
      const d = rowDarkness(y);
      if(d < bestDarkness){
        bestDarkness = d;
        bestY = y;
      }
    }
    return bestY;
  };

  let currentY = 0;
  while(currentY < canvas.height){
    let endY = Math.min(currentY + pxPerPage, canvas.height);
    // Si no es la última página, buscar corte seguro
    if(endY < canvas.height){
      endY = findSafeBreak(endY);
    }
    const srcH = endY - currentY;
    if(srcH <= 0) break;

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = srcH;
    const ctx = pageCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, currentY, canvas.width, srcH, 0, 0, canvas.width, srcH);
    const jpgData = pageCanvas.toDataURL('image/jpeg', 0.92);
    const jpgBytes = await fetch(jpgData).then(r => r.arrayBuffer());
    const jpgImage = await pdfDoc.embedJpg(jpgBytes);
    const page = pdfDoc.addPage([pageW, pageH]);
    const drawH = srcH * scale;
    page.drawImage(jpgImage, {
      x: margin,
      y: pageH - margin - drawH,
      width: contentW,
      height: drawH
    });

    currentY = endY;
  }

  const bytes = await pdfDoc.save();
  return bytes.buffer;
}

/* ══════════════════════════════════════════════════════════
   FOLIAR PDF COMPLETO — Sube un PDF y agrega carátula + índice + foliación
══════════════════════════════════════════════════════════ */
async function foliarPDFCompleto(expId, inputEl){
  const files = Array.from(inputEl.files);
  inputEl.value = '';
  if(!files.length) return;

  if(_generandoPDF){
    toast('Ya se esta procesando un PDF, espere...', 'warning');
    return;
  }
  _generandoPDF = true;

  const exp = DB.getExpediente(expId);
  if(!exp){
    toast('Expediente no encontrado', 'danger');
    _generandoPDF = false;
    return;
  }

  toast(files.length > 1
    ? `Combinando ${files.length} archivos y foliando...`
    : 'Procesando PDF... Agregando caratula, indice y foliacion...', 'info');

  try {
    // Combinar multiples PDFs y HTMLs en uno
    const srcPdf = await PDFLib.PDFDocument.create();
    for(const f of files){
      const esHTML = f.name.toLowerCase().endsWith('.html') || f.name.toLowerCase().endsWith('.htm');
      let buf;
      if(esHTML){
        const htmlText = await f.text();
        buf = await convertirHTMLaPDF(htmlText);
      } else {
        buf = await f.arrayBuffer();
      }
      const tempPdf = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
      for(const sp of tempPdf.getPages()){
        try { sp.node.delete(PDFLib.PDFName.of('Annots')); } catch(e){}
      }
      const copied = await srcPdf.copyPages(tempPdf, tempPdf.getPageIndices());
      copied.forEach(p => srcPdf.addPage(p));
    }
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

    // 3. Limpiar anotaciones del PDF fuente ANTES de copiar
    const srcPages = srcPdf.getPages();
    for(const sp of srcPages){
      try { sp.node.delete(PDFLib.PDFName.of('Annots')); } catch(e){}
    }

    // Copiar todas las páginas del PDF original
    const copiedPages = await pdfFinal.copyPages(srcPdf, srcPdf.getPageIndices());
    for(const page of copiedPages){
      pdfFinal.addPage(page);
    }

    // Limpiar anotaciones de las páginas copiadas también
    const finalPages = pdfFinal.getPages();
    for(const fp of finalPages){
      try { fp.node.delete(PDFLib.PDFName.of('Annots')); } catch(e){}
    }

    // 4. Estampar folio en TODAS las páginas
    const allPages = pdfFinal.getPages();
    for(let i = 0; i < allPages.length; i++){
      estamparFolio(allPages[i], i + 1, totalFolios, fontBold);
    }

    // 5. Guardar PDF combinado en el expediente
    const pdfCombinadoBytes = await srcPdf.save();
    const storagePath = `${expId}/expediente_completo_${Date.now()}.pdf`;
    await DB.saveArchivo(storagePath, pdfCombinadoBytes.buffer);

    // Guardar metadata del documento
    const nombreArchivo = files.length === 1 ? files[0].name : `${files.length}_archivos_combinados.pdf`;
    const docId = `${expId}_expediente_completo`;
    const doc = {
      id: docId,
      expediente_id: expId,
      tipo: 'expediente_completo',
      orden: 0,
      nombre_archivo: `Expediente Completo (${nombreArchivo})`,
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
    const nombreDescarga = `Expediente_Cto_${exp.contrato_numero}_${exp.anio}.pdf`;
    descargarPDF(pdfBytes, nombreDescarga);

    // Actualizar vista
    await actualizarEstadoExpediente(expId);
    renderDetalleExpediente(expId);

    toast(`\u2713 Guardado en el expediente: ${totalFolios} folios (car\u00e1tula + \u00edndice + ${totalPaginasDoc} p\u00e1ginas). Tambi\u00e9n descargado.`, 'success');

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
  const files = Array.from(inputEl.files);
  inputEl.value = '';
  if(!files.length) return;

  if(_generandoPDF){
    toast('Ya se esta procesando un PDF, espere...', 'warning');
    return;
  }
  _generandoPDF = true;

  const exp = DB.getExpediente(expId);
  if(!exp){
    toast('Expediente no encontrado', 'danger');
    _generandoPDF = false;
    return;
  }

  toast(files.length > 1
    ? `Combinando ${files.length} archivos, analizando y organizando...`
    : 'Analizando PDF... Detectando documentos y organizando...', 'info');

  try {
    // Convertir HTML a PDF si es necesario, combinar todos y RASTREAR texto original
    // textoPorArchivo[i] = texto completo del archivo i (ya en lowercase)
    // rangosArchivo[i] = { inicio, fin } rangos de páginas del PDF combinado
    const combinado = await PDFLib.PDFDocument.create();
    const textoPorArchivo = [];
    const rangosArchivo = [];
    let paginaActual = 0;

    for(const f of files){
      const esHTML = f.name.toLowerCase().endsWith('.html') || f.name.toLowerCase().endsWith('.htm');
      let buf;
      let textoArchivo = '';

      if(esHTML){
        const htmlText = await f.text();
        // Extraer texto plano del HTML para clasificación
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlText;
        tempDiv.querySelectorAll('style, script, link').forEach(el => el.remove());
        textoArchivo = (tempDiv.textContent || tempDiv.innerText || '').toLowerCase();
        buf = await convertirHTMLaPDF(htmlText);
      } else {
        buf = await f.arrayBuffer();
      }

      const tempPdf = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
      // Intentar copiar sin tocar anotaciones primero (preserva contenido completo)
      let copied;
      try {
        copied = await combinado.copyPages(tempPdf, tempPdf.getPageIndices());
      } catch(copyErr){
        console.warn('copyPages error, reintentando sin Annots:', copyErr.message);
        for(const sp of tempPdf.getPages()){
          try { sp.node.delete(PDFLib.PDFName.of('Annots')); } catch(e){}
        }
        copied = await combinado.copyPages(tempPdf, tempPdf.getPageIndices());
      }
      copied.forEach(p => combinado.addPage(p));

      const numPagsArchivo = copied.length;
      rangosArchivo.push({
        inicio: paginaActual + 1,
        fin: paginaActual + numPagsArchivo,
        esHTML,
        nombre: f.name
      });
      textoPorArchivo.push(textoArchivo);
      paginaActual += numPagsArchivo;
    }

    const combinadoBytes = await combinado.save();
    const arrayBuffer = combinadoBytes.buffer;

    // 1. Extraer texto de cada página con pdf.js (para PDFs) o usar texto HTML
    const pdfJs = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;
    const totalPags = pdfJs.numPages;
    const paginasTexto = [];

    for(let i = 1; i <= totalPags; i++){
      // Determinar a qué archivo pertenece esta página
      const rangoIdx = rangosArchivo.findIndex(r => i >= r.inicio && i <= r.fin);
      const rango = rangosArchivo[rangoIdx];
      let texto = '';

      if(rango && rango.esHTML){
        // Para HTML: usar el texto extraído directamente del archivo original
        // Solo la primera página del HTML tiene el texto completo (para clasificación)
        if(i === rango.inicio){
          texto = textoPorArchivo[rangoIdx];
        } else {
          // Páginas siguientes del mismo HTML: texto vacío (se agruparán con la anterior)
          texto = '';
        }
      } else {
        // Para PDF: extraer texto con pdf.js
        const page = await pdfJs.getPage(i);
        const content = await page.getTextContent();
        texto = content.items.map(item => item.str).join(' ').toLowerCase();
      }
      paginasTexto.push({ num: i, texto, chars: texto.trim().length });
    }

    // Detectar si es PDF escaneado (sin texto) — ignorar páginas secundarias de HTMLs
    const paginasPrincipales = paginasTexto.filter((p, idx) => {
      const rango = rangosArchivo.find(r => p.num >= r.inicio && p.num <= r.fin);
      return !rango || !rango.esHTML || p.num === rango.inicio;
    });
    const paginasSinTexto = paginasPrincipales.filter(p => p.chars < 20).length;
    if(paginasSinTexto > paginasPrincipales.length * 0.5){
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

    // 3. Agrupar páginas
    // ESTRATEGIA MIXTA:
    // - Si hay varios archivos subidos → cada archivo es un documento independiente
    // - Si hay un solo archivo (PDF con varias secciones) → usar lógica pegajosa
    const grupos = [];

    if(files.length > 1){
      // Un grupo por cada archivo subido
      // Mapa de palabras en nombres de archivo → tipo FOSE
      // Se usa cuando el archivo NO tiene código FOSE explícito
      const MAPA_NOMBRES = [
        // Orden por especificidad: primero los más específicos
        { pats: ['plan de compras', 'plan compras', 'certificacion plan'], tipo: 'cert_plan_compras' },
        { pats: ['estudio previo', 'estudios previos'], tipo: 'estudio_previo' },
        { pats: ['solicitud cdp', 'solicitud de cdp'], tipo: 'solicitud_cdp' },
        { pats: ['cdp'], tipo: 'cdp' },
        { pats: ['invitacion', 'invitación'], tipo: 'invitacion' },
        { pats: ['cotizacion', 'cotización', 'cotizaciones'], tipo: 'cotizaciones' },
        { pats: ['carta de participacion', 'carta de participación', 'carta propuesta', 'carta de propuesta'], tipo: 'carta_propuesta' },
        { pats: ['evaluacion', 'evaluación', 'evaluacion oferta', 'evaluación oferta'], tipo: 'evaluacion_ofertas' },
        { pats: ['aceptacion de oferta', 'aceptación de oferta'], tipo: 'aceptacion_oferta' },
        { pats: ['co1.receipt', 'co1.ntc', 'co1.noc', 'co1.req', 'co1.pcons', 'secop ii', 'secop 2', 'recibo secop', 'colombia compra', 'tvec', 'tienda virtual'], tipo: 'recibo_secop' },
        { pats: ['anexos', 'anexo', 'fotos', 'fotografias', 'fotografías', 'registro fotografico', 'registro fotográfico', 'soporte fotografico', 'soporte fotográfico', 'evidencia fotografica', 'evidencia fotográfica', 'imagenes', 'imágenes'], tipo: 'anexos_fotos' },
        { pats: ['resolucion modificacion cdp', 'resolución modificación cdp', 'modificacion del cdp', 'modificación del cdp', 'modificacion cdp', 'modificación cdp', 'resolucion modificatoria cdp', 'resolución modificatoria cdp', 'ampliacion cdp', 'ampliación cdp', 'reduccion cdp', 'reducción cdp'], tipo: 'resolucion_mod_cdp' },
        // Hechos Cumplidos
        { pats: ['memorando interno', 'memorando contador', 'memorando del contador', 'memorando hc', 'memorando hechos cumplidos'], tipo: 'hc_memorando' },
        { pats: ['comunicacion consejo directivo', 'comunicación consejo directivo', 'consejo directivo', 'oficio consejo directivo'], tipo: 'hc_comunicacion' },
        { pats: ['solicitud cdp hc', 'solicitud cdp hechos cumplidos'], tipo: 'hc_solicitud_cdp' },
        { pats: ['estudios previos hc', 'estudio previo hc', 'estudios previos hechos cumplidos', 'estudio previo hechos cumplidos'], tipo: 'hc_estudios_previos' },
        { pats: ['resolucion rector', 'resolución rector', 'resolucion rectoral', 'resolución rectoral', 'resolucion hc', 'resolución hc', 'acto administrativo hc'], tipo: 'hc_resolucion' },
        { pats: ['orden prestacion servicios hc', 'orden prestación servicios hc', 'ops hc', 'ops hechos cumplidos'], tipo: 'hc_orden_prestacion' },
        { pats: ['referencia bancaria', 'cert bancaria', 'certificacion bancaria', 'certificación bancaria', 'cuenta bancaria'], tipo: 'cert_bancaria' },
        { pats: ['rut'], tipo: 'rut' },
        { pats: ['cedula', 'cédula'], tipo: 'cedula' },
        { pats: ['policia nacional', 'policía nacional', 'antecedentes policia', 'antecedentes policía'], tipo: 'antec_policia' },
        { pats: ['procuraduria', 'procuraduría'], tipo: 'antec_procuraduria' },
        { pats: ['contraloria', 'contraloría'], tipo: 'antec_contraloria' },
        { pats: ['rnmc', 'medidas correctivas'], tipo: 'medidas_correctivas' },
        { pats: ['inhabilidades', 'consulta de inhabilidades'], tipo: 'inhabilidades' },
        { pats: ['redeam', 'redam', 'redan', 'deudores alimentarios'], tipo: 'redeam' },
        { pats: ['habeas data'], tipo: 'habeas_data' },
        { pats: ['seguridad social', 'planilla', 'pila', 'eps', 'pension'], tipo: 'seguridad_social' },
        { pats: ['camara de comercio', 'cámara de comercio'], tipo: 'camara_comercio' },
        { pats: ['hoja de vida', 'hv persona natural'], tipo: 'hoja_vida' },
        { pats: ['carta juramentada'], tipo: 'habeas_data' }, // carta juramentada suele ser habeas data
        { pats: ['contrato firmado', 'contrato'], tipo: 'contrato' },
        { pats: ['registro presupuestal', 'rp '], tipo: 'rp' },
        { pats: ['acta de inicio'], tipo: 'acta_inicio' },
        { pats: ['orden de compra', 'orden compra'], tipo: 'orden_compra' },
        { pats: ['informe contratista', 'informe del contratista'], tipo: 'informe_contratista' },
        { pats: ['informe supervisor', 'informe de supervision', 'informe de supervisión', 'informe del supervisor'], tipo: 'informe_supervisor' },
        { pats: ['acta recibido', 'acta de recibido', 'acta de recibo'], tipo: 'acta_recibido' },
        { pats: ['factura', 'cuenta de cobro'], tipo: 'factura_cobro' },
        { pats: ['orden de pago', 'orden pago'], tipo: 'orden_pago' },
        { pats: ['comprobante de egreso', 'egreso'], tipo: 'comprobante_egreso' },
        { pats: ['acta de liquidacion', 'acta de liquidación', 'liquidacion', 'liquidación'], tipo: 'acta_liquidacion' }
      ];

      for(const rango of rangosArchivo){
        const paginasDelArchivo = paginasTexto.filter(p => p.num >= rango.inicio && p.num <= rango.fin);

        // PASO 1: Intentar clasificar por CÓDIGO FOSE en el nombre (PRE-01, DOC-02, etc.)
        let tipo = null;
        let confianza = 0;

        const nombreLower = (rango.nombre || '').toLowerCase();
        const codigoMatch = nombreLower.match(/\b(pre|con|doc|eje|pag|ant|adi)-(\d{2})\b/i);
        if(codigoMatch){
          const codigoBuscado = (codigoMatch[1] + '-' + codigoMatch[2]).toUpperCase();
          const tipoDef = [...DOC_TIPOS, ...DOC_TIPOS_ADICION].find(d => d.codigo === codigoBuscado);
          if(tipoDef){
            tipo = tipoDef.id;
            confianza = 100;
            console.log(`\u2713 "${rango.nombre}" \u2192 ${codigoBuscado} (c\u00f3digo FOSE)`);
          }
        }

        // PASO 2: Buscar por palabras en el nombre del archivo
        if(!tipo){
          const nombreLimpio = nombreLower.replace(/[_\-\.]/g, ' ').replace(/\s+/g, ' ');
          for(const entry of MAPA_NOMBRES){
            if(entry.pats.some(p => nombreLimpio.includes(p))){
              const tipoDef = [...DOC_TIPOS, ...DOC_TIPOS_ADICION].find(d => d.id === entry.tipo);
              if(tipoDef){
                tipo = entry.tipo;
                confianza = 50;
                console.log(`\u2713 "${rango.nombre}" \u2192 ${tipoDef.codigo} (nombre)`);
                break;
              }
            }
          }
        }

        // PASO 3: Si todavía no hay tipo, usar análisis de texto del contenido
        if(!tipo || tipo === 'no_identificado'){
          const textoCombinado = paginasDelArchivo.map(p => p.texto).join(' ');
          const nombreLimpioParaTexto = nombreLower.replace(/[_\-\.]/g, ' ');
          const textoConNombre = nombreLimpioParaTexto + ' ' + textoCombinado;
          const pagParaClasificar = { texto: textoConNombre, textoSuperior: '' };
          const res = clasificarGrupo([pagParaClasificar]);
          if(res.tipo){
            tipo = res.tipo;
            confianza = res.confianza;
            console.log(`\u2713 "${rango.nombre}" \u2192 ${tipo} (texto, conf=${confianza})`);
          } else {
            console.log(`\u2717 "${rango.nombre}" sin clasificar`);
          }
        }

        grupos.push({
          tipo: tipo || 'no_identificado',
          confianza: confianza || 0,
          confianzaMax: confianza || 0,
          paginas: paginasDelArchivo.map(p => p.num)
        });
      }
    } else {
      // Un solo archivo: usar lógica pegajosa por página
      let grupoActual = null;
      const CONFIANZA_CORTE_MINIMA = 10;
      const CONFIANZA_MAXIMA_RATIO = 0.7;

      for(const pag of paginasTexto){
        const esPaginaCortaOFirmas = pag.chars < 200;

        if(!grupoActual){
          grupoActual = {
            tipo: pag.tipo || 'no_identificado',
            confianza: pag.confianza || 0,
            confianzaMax: pag.confianza || 0,
            paginas: [pag.num]
          };
          continue;
        }

        let puntajeContinuidad = 0;
        if(grupoActual.tipo && grupoActual.tipo !== 'no_identificado'){
          const reglaGrupo = DETECTOR_REGLAS.find(r => r.tipo === grupoActual.tipo);
          if(reglaGrupo){
            for(const pal of reglaGrupo.palabras){
              if(pag.texto.includes(pal)) puntajeContinuidad += reglaGrupo.peso;
            }
          }
        }

        const deteccionFuerte = pag.tipo && pag.confianza >= CONFIANZA_CORTE_MINIMA;
        const tipoDiferente = pag.tipo && pag.tipo !== grupoActual.tipo;
        const confianzaSuficiente = pag.confianza >= grupoActual.confianzaMax * CONFIANZA_MAXIMA_RATIO;
        const sinContinuidad = puntajeContinuidad === 0;

        if(deteccionFuerte && !esPaginaCortaOFirmas && tipoDiferente && confianzaSuficiente && sinContinuidad){
          grupos.push(grupoActual);
          grupoActual = {
            tipo: pag.tipo,
            confianza: pag.confianza,
            confianzaMax: pag.confianza,
            paginas: [pag.num]
          };
        } else {
          // Pegajoso: página pertenece al grupo actual
          grupoActual.paginas.push(pag.num);
          if((!grupoActual.tipo || grupoActual.tipo === 'no_identificado') && pag.tipo){
            grupoActual.tipo = pag.tipo;
            grupoActual.confianza = pag.confianza;
          }
          if(pag.confianza > grupoActual.confianzaMax){
            grupoActual.confianzaMax = pag.confianza;
          }
        }
      }
      if(grupoActual) grupos.push(grupoActual);
    }

    // 4. Asignar orden y nombre a cada grupo según DOC_TIPOS
    const todosLosTipos = [...DOC_TIPOS, ...DOC_TIPOS_ADICION];
    for(const grupo of grupos){
      const tipoDef = todosLosTipos.find(d => d.id === grupo.tipo);
      grupo.orden = tipoDef ? tipoDef.orden : 99;
      grupo.nombre = tipoDef ? tipoDef.nombre : 'Documento sin clasificar';
      grupo.codigo = tipoDef ? (tipoDef.codigo || '') : '';
      grupo.paginaDesde = grupo.paginas[0];
      grupo.paginaHasta = grupo.paginas[grupo.paginas.length - 1];
    }

    // Ordenar grupos según el orden del catálogo FOSE
    grupos.sort((a, b) => a.orden - b.orden);

    console.log('Grupos detectados (ordenados):', grupos.map(g => `${g.codigo} ${g.nombre} (${g.paginas.length} págs, conf: ${g.confianza})`));

    // 5. Mostrar resultados en el modal del splitter para que el usuario revise
    _splitterData.expId = expId;
    _splitterData.pdfBytes = arrayBuffer;
    _splitterData.grupos = grupos;
    _splitterData.paginas = paginasTexto.map(p => ({
      texto: p.texto,
      textoSuperior: '',
      tipoAsignado: p.tipo
    }));
    _splitterData.modoOrganizar = true; // flag para saber que es organizar

    // Abrir modal del splitter
    const modalSplitter = new bootstrap.Modal(document.getElementById('modalSplitter'));
    modalSplitter.show();
    document.getElementById('splitter-exp-id').value = expId;

    // Mostrar resultados
    mostrarResultadosSplitter();

    toast(`${grupos.length} documentos detectados en ${totalPags} p\u00e1ginas. Revise y corrija las asignaciones.`, 'info');

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

/* ══════════════════════════════════════════════════════════
   BACKUP AUTOMATICO
══════════════════════════════════════════════════════════ */
let _backupDirHandle = null;  // FileSystemDirectoryHandle
let _backupIntervalId = null;
let _backupIntervalMin = 0;

async function configurarBackupAutomatico(){
  if(!window.showDirectoryPicker){
    toast('Tu navegador no soporta backup automatico en carpeta. Usa Chrome o Edge.', 'warning');
    return;
  }
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    _backupDirHandle = handle;
    // Guardar handle en IndexedDB (persiste entre recargas)
    await DB._put('meta', 'backup_dir_handle', handle);

    // Preguntar intervalo
    const minutos = prompt('\u00bfCada cu\u00e1ntos minutos hacer backup autom\u00e1tico?\n\n15 = cada 15 min\n30 = cada 30 min\n60 = cada hora\n\n(m\u00ednimo 5 min)', '30');
    if(!minutos) return;
    const min = Math.max(5, parseInt(minutos) || 30);
    await DB._put('meta', 'backup_interval_min', min);
    iniciarBackupAutomatico(min);

    // Hacer un backup inicial inmediato
    await ejecutarBackupSilencioso();
    toast(`Backup autom\u00e1tico configurado: cada ${min} minutos en la carpeta seleccionada`, 'success');
  } catch(e){
    if(e.name !== 'AbortError'){
      console.error('Error configurando backup:', e);
      toast('Error: ' + e.message, 'danger');
    }
  }
}

async function desactivarBackupAutomatico(){
  if(_backupIntervalId){
    clearInterval(_backupIntervalId);
    _backupIntervalId = null;
  }
  _backupDirHandle = null;
  _backupIntervalMin = 0;
  await DB._del('meta', 'backup_dir_handle');
  await DB._del('meta', 'backup_interval_min');
  toast('Backup autom\u00e1tico desactivado', 'info');
  actualizarIndicadorBackupAuto();
}

function iniciarBackupAutomatico(minutos){
  if(_backupIntervalId) clearInterval(_backupIntervalId);
  _backupIntervalMin = minutos;
  _backupIntervalId = setInterval(ejecutarBackupSilencioso, minutos * 60 * 1000);
  actualizarIndicadorBackupAuto();
}

async function ejecutarBackupSilencioso(){
  if(!_backupDirHandle || typeof JSZip === 'undefined') return;

  try {
    // Verificar permiso de escritura
    const perm = await _backupDirHandle.queryPermission({ mode: 'readwrite' });
    if(perm !== 'granted'){
      const req = await _backupDirHandle.requestPermission({ mode: 'readwrite' });
      if(req !== 'granted'){
        console.warn('Permiso denegado para backup autom\u00e1tico');
        return;
      }
    }

    const zip = new JSZip();
    const expedientes = DB._expedientes || [];
    zip.file('expedientes.json', JSON.stringify(expedientes, null, 2));

    const allDocKeys = await DB._getAllKeys('documentos');
    const allDocs = [];
    for(const k of allDocKeys){
      const doc = await DB._get('documentos', k);
      if(doc) allDocs.push(doc);
    }
    zip.file('documentos.json', JSON.stringify(allDocs, null, 2));

    const allArchivoKeys = await DB._getAllKeys('archivos');
    let archivosExportados = 0;
    for(const path of allArchivoKeys){
      const ab = await DB._get('archivos', path);
      if(ab){
        zip.file('archivos/' + path, ab);
        archivosExportados++;
      }
    }

    zip.file('backup_info.json', JSON.stringify({
      fecha: new Date().toISOString(),
      version: '1.0',
      automatico: true,
      totalExpedientes: expedientes.length,
      totalDocumentos: allDocs.length,
      totalArchivos: archivosExportados
    }, null, 2));

    const blob = await zip.generateAsync({
      type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 }
    });

    // Escribir en la carpeta seleccionada
    const fecha = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const nombre = `Backup_Auto_${fecha}.zip`;
    const fileHandle = await _backupDirHandle.getFileHandle(nombre, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();

    // Borrar backups automaticos anteriores (mantener solo el mas reciente)
    try {
      const entries = [];
      for await (const [name, handle] of _backupDirHandle.entries()){
        if(handle.kind === 'file' && name.startsWith('Backup_Auto_') && name.endsWith('.zip') && name !== nombre){
          entries.push(name);
        }
      }
      for(const oldName of entries){
        try {
          await _backupDirHandle.removeEntry(oldName);
          console.log(`Backup anterior eliminado: ${oldName}`);
        } catch(delErr){
          console.warn('No se pudo borrar ' + oldName + ':', delErr.message);
        }
      }
    } catch(e){
      console.warn('Error limpiando backups anteriores:', e);
    }

    await DB._put('meta', 'ultimo_backup', Date.now());
    console.log(`Backup autom\u00e1tico: ${nombre}`);
    actualizarIndicadorBackupAuto();
  } catch(e){
    console.error('Error backup autom\u00e1tico:', e);
  }
}

async function restaurarBackupAutomaticoAlIniciar(){
  try {
    const handle = await DB._get('meta', 'backup_dir_handle');
    const min = await DB._get('meta', 'backup_interval_min');
    if(handle && min){
      // Verificar que el handle todavía es válido
      const perm = await handle.queryPermission({ mode: 'readwrite' });
      if(perm === 'granted' || perm === 'prompt'){
        _backupDirHandle = handle;
        iniciarBackupAutomatico(min);
        // Si hace m\u00e1s del intervalo desde el \u00faltimo backup, correr uno inmediato
        const ultimoBackup = await DB._get('meta', 'ultimo_backup');
        const ahora = Date.now();
        const transcurrido = ultimoBackup ? (ahora - ultimoBackup) / 60000 : Infinity;
        if(transcurrido >= min){
          console.log(`Corriendo backup inmediato (\u00faltimo hace ${Math.round(transcurrido)} min)`);
          setTimeout(() => ejecutarBackupSilencioso(), 3000);
        }
      }
    }
  } catch(e){
    console.warn('No se pudo restaurar backup autom\u00e1tico:', e);
  }
}

/* ── Forzar backup ahora a la carpeta configurada ── */
async function hacerBackupAhora(){
  if(!_backupDirHandle){
    toast('No hay carpeta de backup configurada. Haz clic en el escudo para configurarla.', 'warning');
    return;
  }
  toast('Ejecutando backup ahora...', 'info');
  await ejecutarBackupSilencioso();
  toast('Backup guardado en la carpeta configurada', 'success');
}

function actualizarIndicadorBackupAuto(){
  const el = document.getElementById('backup-auto-status');
  if(!el) return;
  if(_backupIntervalId && _backupIntervalMin){
    el.innerHTML = `<i class="bi bi-shield-check text-success"></i> Auto: ${_backupIntervalMin}min`;
    el.title = 'Backup autom\u00e1tico activo';
  } else {
    el.innerHTML = '<i class="bi bi-shield-slash text-muted"></i>';
    el.title = 'Backup autom\u00e1tico desactivado';
  }
}

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
