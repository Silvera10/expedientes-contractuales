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
    // PASO 1: Pre-procesar cada expediente para obtener bytes y n\u00famero de p\u00e1ginas
    toast(`Procesando ${exps.length} expediente(s)...`, 'info');
    const procesados = [];
    let expedientesSinDocs = 0;

    for(let i = 0; i < exps.length; i++){
      const exp = exps[i];
      toast(`Procesando ${i+1}/${exps.length}: ${exp.contrato_numero}...`, 'info');

      let foliadoBytes = null;
      const foliadoPath = await DB._get('meta', `foliado_${exp.id}`);
      if(foliadoPath){
        foliadoBytes = await DB.getArchivo(foliadoPath);
      }
      if(!foliadoBytes){
        const docs = await DB.loadDocumentos(exp.id);
        if(!docs.length){ expedientesSinDocs++; continue; }
        try {
          foliadoBytes = await generarPDFExpediente(exp, docs, { returnBytes: true });
        } catch(e){
          console.warn('Error generando ' + exp.contrato_numero + ':', e);
          continue;
        }
      }
      if(!foliadoBytes) continue;

      const tempPdf = await PDFLib.PDFDocument.load(foliadoBytes, { ignoreEncryption: true });
      procesados.push({ exp, bytes: foliadoBytes, pages: tempPdf.getPageCount() });
    }

    if(procesados.length === 0){
      const msg = expedientesSinDocs > 0
        ? `Ninguno de los ${exps.length} expedientes tiene documentos cargados.`
        : 'No se pudo generar el informe.';
      toast(msg, 'warning');
      _generandoPDF = false;
      return;
    }

    // PASO 2: Calcular cu\u00e1ntas p\u00e1ginas tendr\u00e1 la portada+\u00edndice
    // 1 p\u00e1gina header + N p\u00e1ginas tabla (15 contratos por p\u00e1gina)
    const CONTRATOS_POR_PAG = 15;
    const paginasTabla = Math.ceil(procesados.length / CONTRATOS_POR_PAG);
    const paginasPreliminar = 1 + paginasTabla; // header + tabla

    // PASO 3: Calcular folio de inicio de cada expediente en el PDF combinado
    let folioActual = paginasPreliminar + 1;
    for(const p of procesados){
      p.folioInicio = folioActual;
      folioActual += p.pages;
    }
    const totalFolios = folioActual - 1;

    // PASO 4: Crear PDF y generar portada
    const pdfFinal = await PDFLib.PDFDocument.create();
    const fontBold = await pdfFinal.embedFont(PDFLib.StandardFonts.HelveticaBold);
    const fontNormal = await pdfFinal.embedFont(PDFLib.StandardFonts.Helvetica);

    const portada = pdfFinal.addPage(PDFLib.PageSizes.Letter);
    const { width, height } = portada.getSize();
    const centerX = width / 2;

    // Header de portada (negro, sin tinta de fondo)
    portada.drawText('INFORME ANUAL DE EXPEDIENTES CONTRACTUALES', {
      x: centerX - fontBold.widthOfTextAtSize('INFORME ANUAL DE EXPEDIENTES CONTRACTUALES', 16) / 2,
      y: height - 60, size: 16, font: fontBold, color: PDFLib.rgb(0,0,0)
    });
    const periodo = trimestre ? `TRIMESTRE ${trimestre} DE ${anio}` : `VIGENCIA ${anio}`;
    portada.drawText(periodo, {
      x: centerX - fontBold.widthOfTextAtSize(periodo, 13) / 2,
      y: height - 82, size: 13, font: fontNormal, color: PDFLib.rgb(0.2,0.2,0.2)
    });

    // L\u00ednea separadora
    portada.drawLine({
      start: { x: 50, y: height - 95 }, end: { x: width - 50, y: height - 95 },
      color: PDFLib.rgb(0, 0, 0), thickness: 1.5
    });

    // Datos instituci\u00f3n
    const instData = getInstitucionData(filtro);
    let yp = height - 120;
    const infos = [
      { l: 'INSTITUCI\u00d3N EDUCATIVA', v: filtro.toUpperCase() }
    ];
    if(instData?.nit) infos.push({ l: 'NIT', v: instData.nit });
    if(instData?.municipio) infos.push({ l: 'MUNICIPIO', v: instData.municipio.toUpperCase() });
    if(instData?.rector) infos.push({ l: 'RECTOR(A) - ORDENADOR DEL GASTO', v: instData.rector.toUpperCase() + (instData.cedulaRector ? ' - C.C. ' + instData.cedulaRector : '') });

    const valorTotal = procesados.reduce((s, p) => s + (Number(p.exp.valor) || 0), 0);
    infos.push({ l: 'TOTAL EXPEDIENTES', v: String(procesados.length) });
    infos.push({ l: 'VALOR TOTAL CONTRATADO', v: '$' + valorTotal.toLocaleString('es-CO') });
    infos.push({ l: 'TOTAL FOLIOS', v: String(totalFolios) });

    for(const info of infos){
      portada.drawText(sanitizarWinAnsi(info.l + ':'), { x: 60, y: yp, size: 8, font: fontBold, color: PDFLib.rgb(0.4,0.4,0.4) });
      // wrap larga
      const valSafe = sanitizarWinAnsi(info.v);
      const maxW = width - 120;
      let valShow = valSafe;
      if(fontBold.widthOfTextAtSize(valSafe, 11) > maxW){
        // truncar
        while(valShow.length > 0 && fontBold.widthOfTextAtSize(valShow + '...', 11) > maxW){
          valShow = valShow.slice(0, -1);
        }
        valShow += '...';
      }
      portada.drawText(valShow, { x: 60, y: yp - 14, size: 11, font: fontBold, color: PDFLib.rgb(0.1,0.1,0.1) });
      yp -= 32;
    }

    // Pie de portada con LR Tributarias
    portada.drawText('LR TRIBUTARIAS', {
      x: centerX - fontBold.widthOfTextAtSize('LR TRIBUTARIAS', 11) / 2,
      y: 55, size: 11, font: fontBold, color: PDFLib.rgb(0, 0, 0)
    });
    const fechaGen = new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' });
    portada.drawText(`Generado el ${fechaGen}`, {
      x: centerX - fontNormal.widthOfTextAtSize(`Generado el ${fechaGen}`, 9) / 2,
      y: 38, size: 9, font: fontNormal, color: PDFLib.rgb(0.4,0.4,0.4)
    });

    // PASO 5: Generar tabla de contratos (puede ocupar varias p\u00e1ginas)
    function dibujarCabeceraTabla(page, esContinuacion){
      const { width: w, height: h } = page.getSize();
      const titulo = esContinuacion ? 'TABLA DE CONTRATOS (continuaci\u00f3n)' : 'TABLA DE CONTRATOS DEL INFORME';
      page.drawText(titulo, {
        x: w/2 - fontBold.widthOfTextAtSize(titulo, 14) / 2,
        y: h - 50, size: 14, font: fontBold, color: PDFLib.rgb(0,0,0)
      });
      page.drawLine({
        start: { x: 30, y: h - 60 }, end: { x: w - 30, y: h - 60 },
        color: PDFLib.rgb(0,0,0), thickness: 1
      });
      // Cabecera columnas
      let y = h - 80;
      page.drawText('N\u00b0', { x: 35, y, size: 9, font: fontBold, color: PDFLib.rgb(0.3,0.3,0.3) });
      page.drawText('CONTRATO', { x: 55, y, size: 9, font: fontBold, color: PDFLib.rgb(0.3,0.3,0.3) });
      page.drawText('CONTRATISTA', { x: 130, y, size: 9, font: fontBold, color: PDFLib.rgb(0.3,0.3,0.3) });
      page.drawText('OBJETO', { x: 260, y, size: 9, font: fontBold, color: PDFLib.rgb(0.3,0.3,0.3) });
      page.drawText('VALOR', { x: 460, y, size: 9, font: fontBold, color: PDFLib.rgb(0.3,0.3,0.3) });
      page.drawText('FOLIO', { x: 540, y, size: 9, font: fontBold, color: PDFLib.rgb(0.3,0.3,0.3) });
      y -= 4;
      page.drawLine({
        start: { x: 30, y }, end: { x: w - 30, y },
        color: PDFLib.rgb(0.7,0.7,0.7), thickness: 0.5
      });
      return y - 14;
    }

    function truncar(txt, maxW, fontSize, font){
      let t = String(txt || '');
      if(font.widthOfTextAtSize(t, fontSize) <= maxW) return t;
      while(t.length > 0 && font.widthOfTextAtSize(t + '...', fontSize) > maxW){
        t = t.slice(0, -1);
      }
      return t + '...';
    }

    let paginaTabla = pdfFinal.addPage(PDFLib.PageSizes.Letter);
    let yTabla = dibujarCabeceraTabla(paginaTabla, false);
    let itemsEnPagina = 0;

    for(let i = 0; i < procesados.length; i++){
      const p = procesados[i];
      const exp = p.exp;

      // Si la p\u00e1gina actual est\u00e1 llena, crear una nueva
      if(itemsEnPagina >= CONTRATOS_POR_PAG || yTabla < 80){
        paginaTabla = pdfFinal.addPage(PDFLib.PageSizes.Letter);
        yTabla = dibujarCabeceraTabla(paginaTabla, true);
        itemsEnPagina = 0;
      }

      // Fondo alterno
      if(i % 2 === 0){
        paginaTabla.drawRectangle({
          x: 30, y: yTabla - 6, width: width - 60, height: 26,
          color: PDFLib.rgb(0.96, 0.97, 0.98)
        });
      }

      // N\u00b0 fila
      paginaTabla.drawText(String(i+1).padStart(2,'0'), {
        x: 35, y: yTabla, size: 9, font: fontBold, color: PDFLib.rgb(0,0,0)
      });
      // Contrato
      paginaTabla.drawText(sanitizarWinAnsi(truncar(exp.contrato_numero + '/' + exp.anio, 70, 9, fontNormal)), {
        x: 55, y: yTabla, size: 9, font: fontNormal, color: PDFLib.rgb(0,0,0)
      });
      // Contratista
      paginaTabla.drawText(sanitizarWinAnsi(truncar(exp.contratista || '\u2014', 125, 9, fontNormal)), {
        x: 130, y: yTabla, size: 9, font: fontNormal, color: PDFLib.rgb(0,0,0)
      });
      // Objeto
      paginaTabla.drawText(sanitizarWinAnsi(truncar(exp.objeto || '\u2014', 195, 8, fontNormal)), {
        x: 260, y: yTabla, size: 8, font: fontNormal, color: PDFLib.rgb(0.2,0.2,0.2)
      });
      // Valor
      const valTxt = exp.valor ? '$' + Number(exp.valor).toLocaleString('es-CO') : '\u2014';
      paginaTabla.drawText(sanitizarWinAnsi(truncar(valTxt, 75, 9, fontBold)), {
        x: 460, y: yTabla, size: 9, font: fontBold, color: PDFLib.rgb(0,0,0)
      });
      // Folio
      paginaTabla.drawText(String(p.folioInicio), {
        x: 540, y: yTabla, size: 9, font: fontBold, color: PDFLib.rgb(0,0,0)
      });

      yTabla -= 22;
      itemsEnPagina++;
    }

    // Total al final de la tabla
    yTabla -= 8;
    if(yTabla > 60){
      paginaTabla.drawLine({
        start: { x: 30, y: yTabla + 8 }, end: { x: width - 30, y: yTabla + 8 },
        color: PDFLib.rgb(0,0,0), thickness: 1
      });
      paginaTabla.drawText(`Total: ${procesados.length} contratos`, {
        x: 35, y: yTabla - 5, size: 10, font: fontBold, color: PDFLib.rgb(0,0,0)
      });
      paginaTabla.drawText(`Valor total: $${valorTotal.toLocaleString('es-CO')}`, {
        x: 250, y: yTabla - 5, size: 10, font: fontBold, color: PDFLib.rgb(0,0,0)
      });
      paginaTabla.drawText(`${totalFolios} folios`, {
        x: 470, y: yTabla - 5, size: 10, font: fontBold, color: PDFLib.rgb(0,0,0)
      });
    }

    // PASO 6: Agregar cada expediente al PDF final
    let expedientesIncluidos = 0;
    for(const p of procesados){
      const srcPdf = await PDFLib.PDFDocument.load(p.bytes, { ignoreEncryption: true });
      try {
        const srcPages2 = srcPdf.getPages();
        for(const sp of srcPages2){ try { sp.node.delete(PDFLib.PDFName.of('Annots')); } catch(e){} }
      } catch(e){}
      const copiedPages = await pdfFinal.copyPages(srcPdf, srcPdf.getPageIndices());
      for(const page of copiedPages){ pdfFinal.addPage(page); }
      expedientesIncluidos++;
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
  document.getElementById('exp-forma-pago').value = 'pago_unico';
  document.getElementById('exp-num-pagos').value = 1;
  document.getElementById('exp-pct-anticipo').value = 50;
  onFormaPagoChange();
  document.getElementById('modal-titulo').textContent = 'Nuevo Expediente';
  new bootstrap.Modal(document.getElementById('modalExpediente')).show();
}

function toggleVigenciaAnterior(){
  const tipo = document.getElementById('exp-tipo-vigencia').value;
  document.getElementById('campos-vigencia-anterior').style.display = tipo === 'anterior' ? '' : 'none';
}

function onFormaPagoChange(){
  const forma = document.getElementById('exp-forma-pago').value;
  const cfg = FORMAS_PAGO[forma];
  const desc = document.getElementById('forma-pago-desc');
  const detalles = document.getElementById('forma-pago-detalles');
  const colNumPagos = document.getElementById('col-num-pagos');
  const colPctAnticipo = document.getElementById('col-pct-anticipo');
  const inputNumPagos = document.getElementById('exp-num-pagos');

  if(!cfg){ return; }
  desc.innerHTML = `<i class="bi ${cfg.icon} me-1"></i>${cfg.descripcion}`;

  // Mostrar/ocultar campos condicionales
  if(forma === 'pago_unico'){
    detalles.style.display = 'none';
  } else if(forma === 'anticipo_saldo'){
    detalles.style.display = '';
    colNumPagos.style.display = 'none';
    colPctAnticipo.style.display = '';
  } else if(forma === 'avance' || forma === 'otro'){
    detalles.style.display = '';
    colNumPagos.style.display = '';
    colPctAnticipo.style.display = 'none';
    inputNumPagos.value = 0;
    inputNumPagos.placeholder = 'Se agregan manualmente';
  } else {
    // mensual/bimestral/trimestral/semestral
    detalles.style.display = '';
    colNumPagos.style.display = '';
    colPctAnticipo.style.display = 'none';
    inputNumPagos.value = cfg.numPagos;
    inputNumPagos.max = cfg.numPagos;
  }
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
  // Cargar forma de pago
  const formaPago = (exp.datos && exp.datos.forma_pago) || 'pago_unico';
  document.getElementById('exp-forma-pago').value = formaPago;
  if(exp.datos && exp.datos.num_pagos){
    document.getElementById('exp-num-pagos').value = exp.datos.num_pagos;
  }
  if(exp.datos && exp.datos.pct_anticipo){
    document.getElementById('exp-pct-anticipo').value = exp.datos.pct_anticipo;
  }
  onFormaPagoChange();
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

  // Forma de pago + generación de periodos
  const formaPago = document.getElementById('exp-forma-pago').value || 'pago_unico';
  const numPagos = Number(document.getElementById('exp-num-pagos').value) || 1;
  const pctAnticipo = Number(document.getElementById('exp-pct-anticipo').value) || 50;
  datos.forma_pago = formaPago;
  datos.num_pagos = numPagos;
  datos.pct_anticipo = pctAnticipo;
  // Solo regenerar periodos si NO existen o si cambió la modalidad
  const modalidadCambio = existing?.datos?.forma_pago !== formaPago
                       || existing?.datos?.num_pagos !== numPagos
                       || existing?.datos?.pct_anticipo !== pctAnticipo;
  if(!datos.pagos_periodicos || datos.pagos_periodicos.length === 0 || modalidadCambio){
    const cfg = FORMAS_PAGO[formaPago];
    if(cfg){
      const periodosNuevos = cfg.generarPeriodos(numPagos, pctAnticipo);
      // Preservar fecha_pago y valor de periodos existentes si el ID coincide
      if(datos.pagos_periodicos){
        periodosNuevos.forEach(p => {
          const anterior = datos.pagos_periodicos.find(x => x.id === p.id);
          if(anterior){
            p.fecha_pago = anterior.fecha_pago;
            p.valor_pagado = anterior.valor_pagado;
          }
        });
      }
      datos.pagos_periodicos = periodosNuevos;
    }
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

/* ══════════════════════════════════════════
   PAGOS PERIÓDICOS — Handlers
══════════════════════════════════════════ */
async function subirDocPago(expId, pagoId, tipoId, file){
  if(!file) return;

  const validExt = /\.(pdf|jpg|jpeg|png|heic|heif|webp)$/i;
  if(!validExt.test(file.name)){
    toast('Formato no soportado. Use PDF, JPG, PNG o HEIC.', 'danger');
    return;
  }
  if(file.size > 15 * 1024 * 1024){
    toast('Archivo demasiado grande (máx 15MB)', 'danger');
    return;
  }

  try {
    const docId = `${expId}_${pagoId}_${tipoId}`;
    const docExistente = await DB.getDocumento(docId);

    // Si YA existe un doc en este slot, preguntar si es reemplazo (versión nueva)
    let motivoCambio = null;
    if(docExistente){
      const versionActual = 1 + (docExistente.versiones_anteriores?.length || 0);
      const nuevaVersion = versionActual + 1;
      const confirmar = confirm(
        `Ya existe un documento en este slot (${docExistente.nombre_archivo}).\n\n` +
        `¿Deseas reemplazarlo con una NUEVA VERSIÓN?\n\n` +
        `• El actual pasará a "versiones anteriores" (v${versionActual})\n` +
        `• El nuevo será la versión activa (v${nuevaVersion})\n` +
        `• En el PDF final solo aparece la versión activa\n\n` +
        `Aceptar = crear v${nuevaVersion}\nCancelar = mantener el actual`
      );
      if(!confirmar) return;
      motivoCambio = prompt(
        `Motivo del cambio (opcional):\n` +
        `Ej: "Corrección de valor por error tipográfico"\n` +
        `Ej: "Reemplazo por observación del supervisor"\n` +
        `Ej: "Actualización de fecha"`,
        ''
      );
      if(motivoCambio === null) return; // canceló
    }

    toast(`Subiendo ${file.name}...`, 'info');
    let arrayBuffer = await file.arrayBuffer();
    let mimeType = file.type || 'application/octet-stream';

    // Si es imagen, convertir a PDF
    if(/\.(jpg|jpeg|png|heic|heif|webp)$/i.test(file.name)){
      arrayBuffer = await convertirImagenaPDF(file);
      mimeType = 'application/pdf';
    }

    // Contar páginas
    let paginas = 1;
    try {
      const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      paginas = pdfDoc.getPageCount();
    } catch(e){ console.warn('No se pudo contar páginas:', e); }

    const storagePath = `${expId}/pago_${pagoId}_${tipoId}_${Date.now()}.pdf`;
    await DB.saveArchivo(storagePath, arrayBuffer);
    if(SB.isActive()){ await SB.uploadPDF(storagePath, new Blob([arrayBuffer], {type: mimeType})); }

    // Si es un reemplazo, mover el anterior a versiones_anteriores
    let versiones_anteriores = [];
    if(docExistente){
      versiones_anteriores = docExistente.versiones_anteriores || [];
      versiones_anteriores.push({
        num_version: versiones_anteriores.length + 1,
        storage_path: docExistente.storage_path,
        nombre_archivo: docExistente.nombre_archivo,
        paginas: docExistente.paginas,
        created_at: docExistente.created_at,
        reemplazado_at: new Date().toISOString(),
        motivo: motivoCambio || null
      });
    }

    const doc = {
      id: docId,
      expediente_id: expId,
      tipo: tipoId,
      pago_id: pagoId,
      orden: 99,
      nombre_archivo: file.name,
      storage_path: storagePath,
      paginas,
      created_at: new Date().toISOString(),
      versiones_anteriores
    };
    await DB.saveDocumento(doc);
    await actualizarEstadoExpediente(expId);
    renderDetalleExpediente(expId);
    const versionActual = 1 + versiones_anteriores.length;
    toast(docExistente
      ? `${file.name} guardado como v${versionActual} (anterior conservada)`
      : `${file.name} agregado al PAGO`);
  } catch(e){
    console.error('subirDocPago error:', e);
    toast('Error al subir: ' + e.message, 'danger');
  }
}

/* ══════════════════════════════════════════
   VERSIONES DE DOCUMENTOS (historial de correcciones)
══════════════════════════════════════════ */
async function verVersionesDoc(expId, pagoId, tipoId){
  const docId = `${expId}_${pagoId}_${tipoId}`;
  const doc = await DB.getDocumento(docId);
  if(!doc){ toast('Documento no encontrado', 'danger'); return; }

  const versionesAnteriores = doc.versiones_anteriores || [];
  const versionActualNum = versionesAnteriores.length + 1;

  const catalogoDoc = [...(typeof DOCS_POR_PAGO !== 'undefined' ? DOCS_POR_PAGO : []),
                       ...(typeof HABILITANTES_POR_PAGO !== 'undefined' ? HABILITANTES_POR_PAGO : [])]
                       .find(dt => dt.id === tipoId);
  const nombreDoc = catalogoDoc?.nombre || tipoId;

  // Construir modal HTML
  const modalId = 'modalVersionesDoc';
  let existente = document.getElementById(modalId);
  if(existente) existente.remove();

  let filasVersiones = `
    <tr class="table-success">
      <td><strong>v${versionActualNum}</strong> <span class="badge bg-success ms-1">ACTIVA</span></td>
      <td>${escapeHtml(doc.nombre_archivo)}</td>
      <td>${doc.paginas || '?'} págs.</td>
      <td>${formatearFecha(doc.created_at)}</td>
      <td><em class="text-muted">—</em></td>
      <td>
        <button class="btn btn-sm btn-outline-primary" onclick="descargarDocumento('${docId}')" title="Descargar versión actual">
          <i class="bi bi-download"></i>
        </button>
      </td>
    </tr>`;

  // Ordenar versiones anteriores por num_version desc (más reciente primero)
  const ordenadas = [...versionesAnteriores].sort((a,b) => (b.num_version||0) - (a.num_version||0));
  ordenadas.forEach((v, idx) => {
    filasVersiones += `
      <tr>
        <td><strong>v${v.num_version}</strong></td>
        <td>${escapeHtml(v.nombre_archivo)}</td>
        <td>${v.paginas || '?'} págs.</td>
        <td>${formatearFecha(v.created_at)}<br><small class="text-muted">Reemplazada ${formatearFecha(v.reemplazado_at)}</small></td>
        <td>${v.motivo ? '<em>' + escapeHtml(v.motivo) + '</em>' : '<span class="text-muted">Sin motivo</span>'}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary" onclick="descargarVersionAnterior('${docId}',${v.num_version})" title="Descargar esta versión">
            <i class="bi bi-download"></i>
          </button>
          <button class="btn btn-sm btn-outline-success" onclick="restaurarVersion('${docId}',${v.num_version})" title="Convertir esta versión en la activa">
            <i class="bi bi-arrow-counterclockwise"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="eliminarVersion('${docId}',${v.num_version})" title="Eliminar permanentemente esta versión">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>`;
  });

  const modalHtml = `
    <div class="modal fade" id="${modalId}" tabindex="-1">
      <div class="modal-dialog modal-xl">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white">
            <h5 class="modal-title">
              <i class="bi bi-clock-history me-2"></i>
              Historial de versiones — ${escapeHtml(nombreDoc)}
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info small mb-3">
              <i class="bi bi-info-circle me-1"></i>
              <strong>Trazabilidad — Ley 594/2000:</strong>
              Este slot tiene <strong>${versionActualNum} versiones</strong> (${versionesAnteriores.length} corrección${versionesAnteriores.length!==1?'es':''} anterior${versionesAnteriores.length!==1?'es':''}).
              En el PDF final del expediente solo aparece la <span class="badge bg-success">ACTIVA</span>.
              Las versiones anteriores se conservan para auditoría.
            </div>
            <div class="table-responsive">
              <table class="table table-sm table-hover align-middle">
                <thead class="table-light">
                  <tr>
                    <th>Versión</th>
                    <th>Archivo</th>
                    <th>Páginas</th>
                    <th>Fechas</th>
                    <th>Motivo del cambio</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>${filasVersiones}</tbody>
              </table>
            </div>
            <div class="small text-muted mt-2">
              <i class="bi bi-arrow-counterclockwise me-1"></i>
              <strong>Restaurar:</strong> convierte esa versión en la activa (la actual pasa a anterior).
              <br>
              <i class="bi bi-trash me-1"></i>
              <strong>Eliminar:</strong> borra permanentemente esa versión (no se puede deshacer).
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
          </div>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  new bootstrap.Modal(document.getElementById(modalId)).show();
}

async function descargarVersionAnterior(docId, numVersion){
  const doc = await DB.getDocumento(docId);
  if(!doc || !doc.versiones_anteriores) return;
  const version = doc.versiones_anteriores.find(v => v.num_version === numVersion);
  if(!version || !version.storage_path){
    toast('Versión no encontrada', 'danger');
    return;
  }
  try {
    const bytes = await DB.getArchivo(version.storage_path);
    if(!bytes){ toast('Archivo no encontrado', 'danger'); return; }
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `v${numVersion}_${version.nombre_archivo || 'documento.pdf'}`;
    a.click();
    URL.revokeObjectURL(url);
  } catch(e){
    toast('Error al descargar: ' + e.message, 'danger');
  }
}

async function restaurarVersion(docId, numVersion){
  const doc = await DB.getDocumento(docId);
  if(!doc || !doc.versiones_anteriores) return;
  const version = doc.versiones_anteriores.find(v => v.num_version === numVersion);
  if(!version) return;

  if(!confirm(
    `¿Convertir la versión v${numVersion} en la ACTIVA?\n\n` +
    `Archivo: ${version.nombre_archivo}\n` +
    `Motivo: ${version.motivo || 'Sin motivo'}\n\n` +
    `La versión actualmente activa pasará a versiones anteriores.`
  )) return;

  try {
    // La versión actual pasa a anteriores
    const versionActualNum = doc.versiones_anteriores.length + 1;
    doc.versiones_anteriores.push({
      num_version: versionActualNum,
      storage_path: doc.storage_path,
      nombre_archivo: doc.nombre_archivo,
      paginas: doc.paginas,
      created_at: doc.created_at,
      reemplazado_at: new Date().toISOString(),
      motivo: `Restaurada v${numVersion} en lugar de esta`
    });

    // La versión seleccionada pasa a ser activa
    doc.storage_path = version.storage_path;
    doc.nombre_archivo = version.nombre_archivo;
    doc.paginas = version.paginas;
    doc.created_at = version.created_at;

    // Remover la versión restaurada del array
    doc.versiones_anteriores = doc.versiones_anteriores.filter(v => v.num_version !== numVersion);

    await DB.saveDocumento(doc);

    // Cerrar modal y recargar
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalVersionesDoc'));
    if(modal) modal.hide();
    renderDetalleExpediente(doc.expediente_id);
    toast(`Versión v${numVersion} restaurada como activa`);
  } catch(e){
    toast('Error al restaurar: ' + e.message, 'danger');
  }
}

async function eliminarVersion(docId, numVersion){
  const doc = await DB.getDocumento(docId);
  if(!doc || !doc.versiones_anteriores) return;
  const version = doc.versiones_anteriores.find(v => v.num_version === numVersion);
  if(!version) return;

  if(!confirm(
    `¿Eliminar PERMANENTEMENTE la versión v${numVersion}?\n\n` +
    `Archivo: ${version.nombre_archivo}\n` +
    `Motivo: ${version.motivo || 'Sin motivo'}\n\n` +
    `⚠️ Esta acción NO se puede deshacer.`
  )) return;

  try {
    if(version.storage_path){
      await DB.deleteArchivo(version.storage_path);
      if(SB.isActive()) await SB.deletePDF(version.storage_path);
    }
    doc.versiones_anteriores = doc.versiones_anteriores.filter(v => v.num_version !== numVersion);
    await DB.saveDocumento(doc);

    // Recargar el modal
    const parts = docId.split('_');
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalVersionesDoc'));
    if(modal) modal.hide();
    renderDetalleExpediente(doc.expediente_id);
    toast(`Versión v${numVersion} eliminada`);
  } catch(e){
    toast('Error al eliminar: ' + e.message, 'danger');
  }
}

function escapeHtml(s){
  if(s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatearFecha(iso){
  if(!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-CO', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  } catch { return iso; }
}

async function quitarDocPago(expId, pagoId, tipoId){
  const docId = `${expId}_${pagoId}_${tipoId}`;
  const doc = await DB.getDocumento(docId);
  const numVersiones = doc?.versiones_anteriores?.length || 0;
  const msg = numVersiones > 0
    ? `¿Quitar este documento del pago?\n\n⚠️ También se eliminarán las ${numVersiones} versiones anteriores conservadas.\n\nEsta acción NO se puede deshacer.`
    : '¿Quitar este documento del pago?';
  if(!confirm(msg)) return;
  try {
    if(doc && doc.storage_path){
      await DB.deleteArchivo(doc.storage_path);
      if(SB.isActive()) await SB.deletePDF(doc.storage_path);
    }
    // Eliminar también los storage_path de las versiones anteriores
    if(doc?.versiones_anteriores){
      for(const v of doc.versiones_anteriores){
        if(v.storage_path){
          try {
            await DB.deleteArchivo(v.storage_path);
            if(SB.isActive()) await SB.deletePDF(v.storage_path);
          } catch(err){ console.warn('No se pudo eliminar versión anterior:', err); }
        }
      }
    }
    await DB.deleteDocumento(docId);
    await actualizarEstadoExpediente(expId);
    renderDetalleExpediente(expId);
    toast(numVersiones > 0 ? `Documento y ${numVersiones} versiones eliminados` : 'Documento eliminado');
  } catch(e){
    console.error('quitarDocPago error:', e);
    toast('Error: ' + e.message, 'danger');
  }
}

async function editarPagoPeriodo(expId, pagoId){
  const exp = DB.getExpediente(expId);
  if(!exp || !exp.datos || !exp.datos.pagos_periodicos) return;
  const pago = exp.datos.pagos_periodicos.find(p => p.id === pagoId);
  if(!pago) return;

  const conceptoActual = pago.concepto || `Pago correspondiente al ${pago.periodo} del contrato ${exp.contrato_numero || 'S/N'} de ${exp.anio || ''} - ${exp.objeto || ''}`.substring(0, 200);
  const nuevoConcepto = prompt(`Concepto del pago (${pago.periodo}):\nEj: "Servicios de aseo prestados durante enero-marzo 2026"`, conceptoActual);
  if(nuevoConcepto === null) return;

  const nuevaFecha = prompt(`Fecha del pago (${pago.periodo}):\nFormato AAAA-MM-DD`, pago.fecha_pago || '');
  if(nuevaFecha === null) return;

  const nuevoValor = prompt(`Valor pagado ${pago.periodo} (solo números, sin puntos):`, pago.valor_pagado || '');
  if(nuevoValor === null) return;

  const nuevaFactura = prompt(`N° de Factura o Cuenta de Cobro (${pago.periodo}) - opcional:`, pago.numero_factura || '');
  if(nuevaFactura === null) return;

  pago.concepto = nuevoConcepto.trim() || null;
  pago.fecha_pago = nuevaFecha.trim() || null;
  pago.valor_pagado = nuevoValor.trim() ? Number(nuevoValor.replace(/[^\d]/g,'')) : null;
  pago.numero_factura = nuevaFactura.trim() || null;
  exp.updated_at = new Date().toISOString();
  await DB.saveExpediente(exp);
  renderDetalleExpediente(expId);
  toast('Pago actualizado');
}

async function agregarPagoManual(expId){
  const exp = DB.getExpediente(expId);
  if(!exp || !exp.datos) return;
  if(!exp.datos.pagos_periodicos) exp.datos.pagos_periodicos = [];

  const nombrePeriodo = prompt('Nombre del pago (ej: "Avance 30%", "Pago Enero", "Cuota 1"):');
  if(!nombrePeriodo || !nombrePeriodo.trim()) return;

  const numero = exp.datos.pagos_periodicos.length + 1;
  const nuevoPago = {
    id: `pago_${Date.now()}`,
    numero,
    periodo: nombrePeriodo.trim(),
    tipo: 'manual'
  };
  exp.datos.pagos_periodicos.push(nuevoPago);
  exp.updated_at = new Date().toISOString();
  await DB.saveExpediente(exp);
  renderDetalleExpediente(expId);
  toast(`Pago "${nombrePeriodo}" agregado`);
}

/* ══════════════════════════════════════════
   DRAG & DROP en pagos periódicos
══════════════════════════════════════════ */

// Patrones para detectar tipo de documento por nombre de archivo
// Retorna el id del tipo de doc que corresponde, o null si no se detecta
function detectarTipoDocPago(nombreArchivo){
  const n = nombreArchivo.toLowerCase()
    .replace(/[_\-\.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Orden: primero patrones más específicos
  const patrones = [
    { pats: ['factura', 'cta cobro', 'cuenta cobro', 'cuenta de cobro'], tipo: 'factura' },
    { pats: ['pila', 'seguridad social', 'planilla', 'aportes'], tipo: 'seguridad_social' },
    { pats: ['informe supervis', 'inf supervisor', 'informe del supervisor'], tipo: 'informe_supervisor' },
    { pats: ['informe contratista', 'inf contratista', 'informe del contratista', 'informe actividades'], tipo: 'informe_contratista' },
    { pats: ['acta recibo', 'acta de recibo', 'recibo satisfaccion', 'recibo a satisfaccion', 'acta entrega'], tipo: 'acta_recibido' },
    { pats: ['orden pago', 'orden de pago'], tipo: 'orden_pago' },
    { pats: ['egreso', 'comprobante egreso', 'comprobante de egreso'], tipo: 'egreso' },
    { pats: ['soporte pago', 'soporte bancario', 'soporte banco', 'comprobante transferencia', 'transferencia', 'consignacion'], tipo: 'soporte_pago' },
    // Habilitantes opcionales
    { pats: ['procuraduria', 'procuraduría'], tipo: 'antec_procuraduria' },
    { pats: ['contraloria', 'contraloría'], tipo: 'antec_contraloria' },
    { pats: ['policia', 'policía', 'antecedentes judiciales'], tipo: 'antec_policia' },
    { pats: ['redam', 'deudores alimentarios'], tipo: 'redam' },
    { pats: ['rnmc', 'medidas correctivas'], tipo: 'rnmc' },
    { pats: ['delitos sexuales', 'inhabilidad sexual'], tipo: 'delitos_sexuales' }
  ];

  for(const p of patrones){
    for(const pat of p.pats){
      if(n.includes(pat)) return p.tipo;
    }
  }
  return null;
}

async function manejarDropEnSlot(expId, pagoId, tipoId, event){
  const files = event.dataTransfer?.files;
  if(!files || files.length === 0) return;
  if(files.length > 1){
    toast('Solo se puede arrastrar UN archivo a este slot. Usa el bloque completo del pago para varios.', 'warning');
    return;
  }
  await subirDocPago(expId, pagoId, tipoId, files[0]);
}

async function imprimirPagoIndividual(expId, pagoId){
  try {
    const exp = DB.getExpediente(expId);
    if(!exp) { toast('Expediente no encontrado', 'danger'); return; }
    const pago = (exp.datos && exp.datos.pagos_periodicos || []).find(p => p.id === pagoId);
    if(!pago) { toast('Pago no encontrado', 'danger'); return; }

    const allDocs = await DB.loadDocumentos(expId);
    const docsDelPago = allDocs.filter(d => d.pago_id === pagoId);

    if(docsDelPago.length === 0){
      toast('Este pago no tiene documentos cargados', 'warning');
      return;
    }

    // Ordenar: primero requeridos, luego habilitantes (según orden estándar)
    const ordenTipos = {};
    DOCS_POR_PAGO.forEach((dt, i) => ordenTipos[dt.id] = i);
    HABILITANTES_POR_PAGO.forEach((dt, i) => ordenTipos[dt.id] = DOCS_POR_PAGO.length + i);
    docsDelPago.sort((a, b) => (ordenTipos[a.tipo] ?? 99) - (ordenTipos[b.tipo] ?? 99));

    toast(`Generando PDF del PAGO ${String(pago.numero).padStart(2,'0')}...`, 'info');
    await generarPDFPago(exp, pago, docsDelPago);
    toast(`PDF del PAGO ${String(pago.numero).padStart(2,'0')} generado`);
  } catch(e){
    console.error('imprimirPagoIndividual error:', e);
    toast('Error generando PDF: ' + e.message, 'danger');
  }
}

async function manejarDropEnPago(expId, pagoId, event){
  const files = event.dataTransfer?.files;
  if(!files || files.length === 0) return;

  // Cargar docs ya subidos a este pago para evitar sobreescritura
  const docsSubidos = await DB.loadDocumentos(expId);
  const tiposCargadosEnPago = new Set(
    docsSubidos.filter(d => d.pago_id === pagoId).map(d => d.tipo)
  );

  const resultados = {
    exitosos: [],
    duplicados: [],
    sinDetectar: []
  };

  for(const file of files){
    const tipoDetectado = detectarTipoDocPago(file.name);

    if(!tipoDetectado){
      resultados.sinDetectar.push(file.name);
      continue;
    }

    if(tiposCargadosEnPago.has(tipoDetectado)){
      resultados.duplicados.push({ nombre: file.name, tipo: tipoDetectado });
      continue;
    }

    try {
      await subirDocPago(expId, pagoId, tipoDetectado, file);
      tiposCargadosEnPago.add(tipoDetectado);
      resultados.exitosos.push({ nombre: file.name, tipo: tipoDetectado });
    } catch(e){
      console.error('Error subiendo', file.name, e);
    }
  }

  // Resumen final
  let msg = '';
  if(resultados.exitosos.length){
    msg += `✅ ${resultados.exitosos.length} clasificados: ${resultados.exitosos.map(r=>r.tipo).join(', ')}. `;
  }
  if(resultados.duplicados.length){
    msg += `⚠️ ${resultados.duplicados.length} ya existían: ${resultados.duplicados.map(r=>r.tipo).join(', ')}. `;
  }
  if(resultados.sinDetectar.length){
    msg += `❓ ${resultados.sinDetectar.length} sin clasificar (arrástralos a su slot): ${resultados.sinDetectar.join(', ')}.`;
  }
  toast(msg || 'Sin archivos procesados', resultados.sinDetectar.length ? 'warning' : 'success');
}

async function eliminarPagoPeriodo(expId, pagoId){
  const exp = DB.getExpediente(expId);
  if(!exp || !exp.datos || !exp.datos.pagos_periodicos) return;
  const pago = exp.datos.pagos_periodicos.find(p => p.id === pagoId);
  if(!pago) return;
  if(!confirm(`¿Eliminar el PAGO "${pago.periodo}" y todos sus documentos?`)) return;

  // Borrar todos los docs de este pago
  const docs = await DB.loadDocumentos(expId);
  const docsDelPago = docs.filter(d => d.pago_id === pagoId);
  for(const d of docsDelPago){
    if(d.storage_path){
      await DB.deleteArchivo(d.storage_path);
      if(SB.isActive()) await SB.deletePDF(d.storage_path);
    }
    await DB.deleteDocumento(d.id);
  }

  // Eliminar el pago del array y re-numerar
  exp.datos.pagos_periodicos = exp.datos.pagos_periodicos.filter(p => p.id !== pagoId);
  exp.datos.pagos_periodicos.forEach((p, i) => p.numero = i + 1);
  exp.updated_at = new Date().toISOString();
  await DB.saveExpediente(exp);
  renderDetalleExpediente(expId);
  toast(`PAGO "${pago.periodo}" eliminado`);
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
   BORRAR TODOS LOS DOCUMENTOS DEL EXPEDIENTE
══════════════════════════════════════════ */
async function borrarTodosDocumentos(expId){
  const exp = DB.getExpediente(expId);
  if(!exp) return;
  const docs = await DB.loadDocumentos(expId);
  if(!docs.length){
    toast('No hay documentos para borrar', 'info');
    return;
  }
  if(!confirm(`¿Borrar TODOS los ${docs.length} documentos del expediente?\n\nEl expediente se mantiene, solo se borran los archivos subidos.\n\nEsta acción no se puede deshacer.`)){
    return;
  }
  toast(`Borrando ${docs.length} documentos...`, 'info');
  try {
    let borrados = 0;
    for(const d of docs){
      try {
        await DB.deleteDocumento(d.id);
        borrados++;
      } catch(e){
        console.warn('Error borrando ' + d.id + ':', e);
      }
    }
    // Borrar también el PDF foliado generado si existe
    try {
      const foliadoPath = await DB._get('meta', `foliado_${expId}`);
      if(foliadoPath){
        await DB._del('archivos', foliadoPath);
        await DB._del('meta', `foliado_${expId}`);
      }
    } catch(e){}

    await actualizarEstadoExpediente(expId);
    renderDetalleExpediente(expId);
    toast(`✓ ${borrados} documentos borrados. Expediente vacío listo para subir de nuevo.`, 'success');
  } catch(e){
    console.error('Error borrando documentos:', e);
    toast('Error: ' + e.message, 'danger');
  }
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
/* ══════════════════════════════════════════════════════════
   LIMPIAR ESTRUCTURA DE PDF con pdf-lib
   pdf-lib es tolerante a PDFs con startxref incorrecto
   y al re-guardarlo genera un PDF con estructura limpia
   que pdf.js sí puede leer.
══════════════════════════════════════════════════════════ */
async function limpiarPDFConPdfLib(buf){
  const original = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
  const nuevo = await PDFLib.PDFDocument.create();
  const indices = original.getPageIndices();
  let copied;
  try {
    copied = await nuevo.copyPages(original, indices);
  } catch(e){
    // Intentar sin Annots
    for(const sp of original.getPages()){
      try { sp.node.delete(PDFLib.PDFName.of('Annots')); } catch(_){}
    }
    copied = await nuevo.copyPages(original, indices);
  }
  copied.forEach(p => nuevo.addPage(p));
  const bytes = await nuevo.save({ useObjectStreams: false });
  return bytes.buffer;
}

/* ══════════════════════════════════════════════════════════
   REPARAR PDF problemático: rasterizar páginas a imagen
   y crear un nuevo PDF limpio (para PDFs escaneados con
   estructura dañada que pdf.js/pdf-lib no maneja bien)
══════════════════════════════════════════════════════════ */
async function repararPDFRasterizando(buf){
  // Cargar con pdf.js
  const pdfJs = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
  const numPaginas = pdfJs.numPages;
  const pdfNuevo = await PDFLib.PDFDocument.create();

  for(let i = 1; i <= numPaginas; i++){
    const page = await pdfJs.getPage(i);
    const viewport = page.getViewport({ scale: 2 }); // alta resolución
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    // Fondo blanco por si la página tiene transparencia
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    try {
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch(e){
      console.warn(`Reparar PDF: error renderizando página ${i}:`, e.message);
      continue;
    }

    // Verificar si la página tiene contenido (no completamente blanca)
    const datos = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let tienePuntoNoBlanco = false;
    for(let p = 0; p < datos.length; p += 4 * 1000){ // muestreo cada 1000 píxeles
      if(datos[p] < 250 || datos[p+1] < 250 || datos[p+2] < 250){
        tienePuntoNoBlanco = true;
        break;
      }
    }
    if(!tienePuntoNoBlanco){
      console.warn(`Página ${i} quedó completamente en blanco después de renderizar`);
    }

    // Exportar como JPEG y embeber
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const jpgBytes = await fetch(dataUrl).then(r => r.arrayBuffer());
    const jpg = await pdfNuevo.embedJpg(jpgBytes);

    // Crear página con la imagen (mismas proporciones que el viewport)
    const aspect = viewport.width / viewport.height;
    const pageW = 612; // Letter width
    const pageH = pageW / aspect;
    const nuevaPag = pdfNuevo.addPage([pageW, pageH]);
    nuevaPag.drawImage(jpg, { x: 0, y: 0, width: pageW, height: pageH });
  }

  const bytes = await pdfNuevo.save();
  return bytes.buffer;
}

/* ══════════════════════════════════════════════════════════
   CONVERTIR IMAGEN (JPG, PNG, HEIC) a PDF
══════════════════════════════════════════════════════════ */
async function convertirImagenaPDF(file){
  const pdfDoc = await PDFLib.PDFDocument.create();
  const buf = await file.arrayBuffer();
  const ext = file.name.toLowerCase().split('.').pop();

  let imgBytes = buf;
  // HEIC/HEIF necesitan conversion previa via canvas
  if(['heic', 'heif', 'webp'].includes(ext)){
    // Renderizar imagen en canvas y exportar como JPEG
    const blob = new Blob([buf], { type: file.type || 'image/' + ext });
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = url;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      imgBytes = await fetch(dataUrl).then(r => r.arrayBuffer());
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // Embed imagen (jpg o png)
  let embedded;
  try {
    if(ext === 'png'){
      embedded = await pdfDoc.embedPng(imgBytes);
    } else {
      embedded = await pdfDoc.embedJpg(imgBytes);
    }
  } catch(e){
    // Si falló como tipo original, reintentar como el otro
    try { embedded = await pdfDoc.embedJpg(imgBytes); }
    catch(e2){ embedded = await pdfDoc.embedPng(imgBytes); }
  }

  // Crear página tamaño Carta con la imagen centrada
  const pageW = 612, pageH = 792;
  const margin = 30;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;
  const imgW = embedded.width;
  const imgH = embedded.height;
  const scale = Math.min(maxW / imgW, maxH / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;

  const page = pdfDoc.addPage([pageW, pageH]);
  page.drawImage(embedded, { x, y, width: drawW, height: drawH });

  const bytes = await pdfDoc.save();
  return bytes.buffer;
}

/* ══════════════════════════════════════════════════════════
   CONVERTIR EXCEL/CSV a PDF — Para informes anuales
══════════════════════════════════════════════════════════ */
async function convertirExcelaPDF(file){
  if(typeof XLSX === 'undefined'){
    throw new Error('Librería XLSX no cargada');
  }
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });

  // Construir HTML con las hojas del libro
  let htmlPartes = `<html><head><meta charset="utf-8"><style>
    body { font-family: Arial, sans-serif; font-size: 9pt; padding: 20px; }
    h2 { font-size: 14pt; color: #000; border-bottom: 1.5pt solid #000; padding-bottom: 4px; margin: 16px 0 10px; }
    h3 { font-size: 10pt; color: #444; margin: 14px 0 6px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 14px; }
    th, td { border: 0.5pt solid #888; padding: 3px 5px; text-align: left; vertical-align: top; font-size: 8pt; }
    th { background: #e9e9e9; font-weight: bold; }
    tr:nth-child(even) td { background: #fafafa; }
  </style></head><body>`;
  htmlPartes += `<h2>${file.name.replace(/\.(xlsx|xls|csv)$/i, '').replace(/[_-]/g, ' ')}</h2>`;

  let textoTotal = '';
  for(const sheetName of wb.SheetNames){
    const ws = wb.Sheets[sheetName];
    if(!ws) continue;
    htmlPartes += `<h3>Hoja: ${sheetName}</h3>`;
    // Generar HTML de la tabla
    let htmlTabla = XLSX.utils.sheet_to_html(ws, { editable: false });
    // Quitar <html><body> exteriores y solo dejar la tabla
    htmlTabla = htmlTabla.replace(/^[\s\S]*?<table/i, '<table').replace(/<\/table>[\s\S]*$/i, '</table>');
    htmlPartes += htmlTabla;
    // Extraer texto para clasificación
    const csv = XLSX.utils.sheet_to_csv(ws);
    textoTotal += ' ' + csv;
  }
  htmlPartes += '</body></html>';

  const pdfBytes = await convertirHTMLaPDF(htmlPartes);
  return {
    pdfBytes,
    texto: (file.name + ' ' + textoTotal).toLowerCase()
  };
}

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
      /* Limites para imagenes (firmas, logos, sellos) - evita que se agranden */
      #html-pdf-render-organizar img { max-width: 220px !important; max-height: 110px !important; height: auto !important; width: auto !important; object-fit: contain; }
      /* Firmas (clases comunes) - mas pequenas aun */
      #html-pdf-render-organizar img.firma, #html-pdf-render-organizar img.signature, #html-pdf-render-organizar [class*="firma"] img, #html-pdf-render-organizar [class*="signature"] img { max-width: 180px !important; max-height: 80px !important; }
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
      const nombre = f.name.toLowerCase();
      const esHTML = nombre.endsWith('.html') || nombre.endsWith('.htm');
      const esExcel = nombre.endsWith('.xlsx') || nombre.endsWith('.xls') || nombre.endsWith('.csv');
      const esImagen = ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp'].some(e => nombre.endsWith(e));
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
      } else if(esExcel){
        // Convertir Excel/CSV a HTML primero, luego a PDF
        const result = await convertirExcelaPDF(f);
        buf = result.pdfBytes;
        textoArchivo = result.texto;
      } else if(esImagen){
        // Convertir imagen a PDF (foto de cartelera, escaneado con celular, etc.)
        buf = await convertirImagenaPDF(f);
        textoArchivo = nombre; // solo el nombre del archivo para clasificación
      } else {
        buf = await f.arrayBuffer();

        // DETECCIÓN: si es un PDF problemático (no se puede renderizar con pdf.js),
        // rasterizarlo a imagen para garantizar que el contenido aparezca en el PDF final
        if(nombre.endsWith('.pdf')){
          try {
            const testPdf = await pdfjsLib.getDocument({ data: buf.slice(0) }).promise;
            const firstPage = await testPdf.getPage(1);
            const tv = firstPage.getViewport({ scale: 1 });
            const testCanvas = document.createElement('canvas');
            testCanvas.width = Math.min(tv.width, 200);
            testCanvas.height = Math.min(tv.height, 200);
            const tctx = testCanvas.getContext('2d');
            tctx.fillStyle = '#ffffff';
            tctx.fillRect(0, 0, testCanvas.width, testCanvas.height);
            await firstPage.render({ canvasContext: tctx, viewport: firstPage.getViewport({ scale: testCanvas.width / tv.width }) }).promise;
            // Verificar si quedó en blanco
            const datos = tctx.getImageData(0, 0, testCanvas.width, testCanvas.height).data;
            let tieneContenido = false;
            for(let p = 0; p < datos.length; p += 4 * 100){
              if(datos[p] < 250 || datos[p+1] < 250 || datos[p+2] < 250){ tieneContenido = true; break; }
            }
            if(!tieneContenido){
              console.warn(`⚠ "${nombre}" rinde en blanco con pdf.js → reparando con rasterización`);
              buf = await repararPDFRasterizando(buf);
            }
          } catch(testErr){
            console.warn(`⚠ "${nombre}" no se puede renderizar (${testErr.message}) → reparando con rasterización`);
            try { buf = await repararPDFRasterizando(await f.arrayBuffer()); }
            catch(repErr){ console.error('No se pudo reparar:', repErr); }
          }
        }
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
      toast('PDF escaneado detectado \u2014 se clasificar\u00e1 por nombre de archivo (sin lectura de contenido).', 'info');
      console.log(`\u26a0\ufe0f ${paginasSinTexto}/${paginasPrincipales.length} p\u00e1ginas sin texto extra\u00edble \u2014 continuando con clasificaci\u00f3n por nombre`);
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
        { pats: ['comunicacion no seleccion', 'comunicación no selección', 'comunicacion de no seleccion', 'comunicación de no selección', 'no seleccion', 'no selección', 'oferente no seleccionado', 'proponente no seleccionado', 'no fue seleccionado', 'no fue seleccionada', 'notificacion no seleccion', 'notificación no selección', 'carta no seleccion', 'carta no selección', 'rechazo oferta', 'oferta no aceptada', 'oferta descartada'], tipo: 'comunicacion_no_seleccion' },
        { pats: ['aceptacion de oferta', 'aceptación de oferta', 'aceptacion oferta', 'aceptación oferta', 'oferta aceptada', 'aprobacion oferta', 'aprobación oferta'], tipo: 'aceptacion_oferta' },
        { pats: ['co1 receipt', 'co1 ntc', 'co1 noc', 'co1 req', 'co1 pcons', 'secop ii', 'secop 2', 'recibo secop', 'colombia compra', 'tvec', 'tienda virtual'], tipo: 'recibo_secop' },
        { pats: ['anexos', 'anexo', 'fotos', 'foto', 'fotografias', 'fotografías', 'fotografia', 'fotografía', 'registro fotografico', 'registro fotográfico', 'soporte fotografico', 'soporte fotográfico', 'evidencia fotografica', 'evidencia fotográfica', 'imagenes', 'imágenes', 'imagen', 'cartelera', 'mural', 'publicacion fisica', 'publicación física', 'fijacion publica', 'fijación pública', 'img_', 'whatsapp image'], tipo: 'anexos_fotos' },
        { pats: ['resolucion modificacion cdp', 'resolución modificación cdp', 'modificacion del cdp', 'modificación del cdp', 'modificacion cdp', 'modificación cdp', 'resolucion modificatoria cdp', 'resolución modificatoria cdp', 'ampliacion cdp', 'ampliación cdp', 'reduccion cdp', 'reducción cdp'], tipo: 'resolucion_mod_cdp' },
        { pats: ['acuerdo del consejo directivo', 'acuerdo consejo directivo', 'aprobacion consejo directivo', 'aprobación consejo directivo', 'sesion consejo directivo', 'sesión consejo directivo', 'acuerdo aprobacion', 'acuerdo aprobación', 'acuerdo cd '], tipo: 'acuerdo_consejo' },
        { pats: ['verificacion de requisitos', 'verificación de requisitos', 'verificacion requisitos', 'verificación requisitos', 'verificacion habilitantes', 'verificación habilitantes', 'acta verificacion requisitos', 'acta verificación requisitos', 'lista chequeo requisitos', 'check list requisitos', 'cumple requisitos'], tipo: 'verificacion_requisitos' },
        { pats: ['acta aclaratoria', 'actas aclaratorias', 'acta de aclaracion', 'acta de aclaración', 'acta complementaria', 'acta de correccion', 'acta de corrección', 'acta de precision', 'acta de precisión'], tipo: 'acta_aclaratoria' },
        // Hechos Cumplidos
        { pats: ['memorando interno', 'memorando contador', 'memorando del contador', 'memorando hc', 'memorando hechos cumplidos'], tipo: 'hc_memorando' },
        { pats: ['comunicacion consejo directivo', 'comunicación consejo directivo', 'consejo directivo', 'oficio consejo directivo'], tipo: 'hc_comunicacion' },
        { pats: ['solicitud cdp hc', 'solicitud cdp hechos cumplidos'], tipo: 'hc_solicitud_cdp' },
        { pats: ['estudios previos hc', 'estudio previo hc', 'estudios previos hechos cumplidos', 'estudio previo hechos cumplidos'], tipo: 'hc_estudios_previos' },
        { pats: ['resolucion rector', 'resolución rector', 'resolucion rectoral', 'resolución rectoral', 'resolucion hc', 'resolución hc', 'acto administrativo hc'], tipo: 'hc_resolucion' },
        { pats: ['orden prestacion servicios hc', 'orden prestación servicios hc', 'ops hc', 'ops hechos cumplidos'], tipo: 'hc_orden_prestacion' },
        // Informes Anuales Institucionales (a Secretaría de Educación)
        { pats: ['01_ejec_ingresos', 'ejec_ingresos', 'ejec ingresos', 'ejecucion de ingresos', 'ejecución de ingresos', 'ejecucion presupuestal ingresos', 'ejecución presupuestal ingresos'], tipo: 'inf_ejec_ingresos' },
        { pats: ['02_ejec_egresos', 'ejec_egresos', 'ejec egresos', 'ejecucion de egresos', 'ejecución de egresos', 'ejecucion presupuestal egresos', 'ejecución presupuestal egresos'], tipo: 'inf_ejec_egresos' },
        { pats: ['03_pac_ejecutado', 'pac_ejecutado', 'pac ejecutado'], tipo: 'inf_pac_ejecutado' },
        { pats: ['10_relacion_gastos', 'relacion_gastos', 'relacion gastos', 'relación gastos', 'relación de gastos', 'relacion de gastos'], tipo: 'inf_relacion_gastos' },
        { pats: ['cierre_2026anual', 'cierre anual', 'cierre presupuestal', 'cierre 2026', 'cierre 2027', 'cierre 2028', 'cierre fiscal'], tipo: 'inf_cierre_anual' },
        { pats: ['contraloria_2026anual', 'contraloria anual', 'contraloría anual', 'reporte contraloria', 'reporte contraloría', 'sirec', 'sireci'], tipo: 'inf_contraloria' },
        { pats: ['pac_2026anual', 'pac anual', 'pac 2026', 'pac 2027', 'pac 2028', 'programa anual mensualizado'], tipo: 'inf_pac_anual' },
        { pats: ['conc-ppto-cont', 'conc_ppto_cont', 'conc ppto cont', 'conciliacion ppto', 'conciliación ppto', 'conciliacion presupuesto contabilidad', 'conciliación presupuesto contabilidad'], tipo: 'inf_conciliacion' },
        // Certificados FSE — la detección del trimestre se hace por contenido en pdf-splitter.js
        // Los archivos del portal FSE tienen nombres genéricos sin trimestre
        // por eso aquí solo identificamos el tipo (certificado vs reporte)
        // El trimestre lo detectamos en el contenido del PDF que dice "PRIMER TRIMESTRE", "SEGUNDO TRIMESTRE", etc.
        { pats: ['referencia bancaria', 'cert bancaria', 'cert bancario', 'certificacion bancaria', 'certificación bancaria', 'certificado bancario', 'certificado bancaria', 'cuenta bancaria', 'cuenta bancario', 'certificado banco', 'certificacion banco', 'certificación banco'], tipo: 'cert_bancaria' },
        { pats: ['rut'], tipo: 'rut' },
        { pats: ['cedula', 'cédula'], tipo: 'cedula' },
        { pats: ['policia nacional', 'policía nacional', 'antecedentes policia', 'antecedentes policía'], tipo: 'antec_policia' },
        { pats: ['procuraduria', 'procuraduría'], tipo: 'antec_procuraduria' },
        { pats: ['contraloria', 'contraloría'], tipo: 'antec_contraloria' },
        { pats: ['rnmc', 'medidas correctivas'], tipo: 'medidas_correctivas' },
        { pats: ['inhabilidades', 'consulta de inhabilidades', 'delitos sexuales', 'certificado delitos sexuales', 'delito sexual', 'inhabilidad para contratar', 'pedofilo', 'agresor sexual', 'consulta sirec', 'consulta sireci'], tipo: 'inhabilidades' },
        { pats: ['redeam', 'redam', 'redan', 'deudores alimentarios'], tipo: 'redeam' },
        { pats: ['habeas data'], tipo: 'habeas_data' },
        { pats: ['seguridad social', 'planilla', 'pila', 'eps', 'pension'], tipo: 'seguridad_social' },
        { pats: ['camara de comercio', 'cámara de comercio'], tipo: 'camara_comercio' },
        { pats: ['hoja de vida', 'hv persona natural'], tipo: 'hoja_vida' },
        { pats: ['carta juramentada'], tipo: 'habeas_data' }, // carta juramentada suele ser habeas data
        // IMPORTANTE: 'cuenta de cobro' y 'factura' ANTES de 'contrato' para evitar false positive
        { pats: ['cuenta de cobro', 'cta de cobro', 'cta cobro', 'cuenta cobro', 'factura', 'factura electronica', 'factura electrónica'], tipo: 'factura' },
        { pats: ['contrato firmado', 'contrato de prestacion', 'contrato de prestación', 'contrato de compraventa', 'contrato de suministro', 'contrato laboral', 'contrato pdf', 'contrato.pdf'], tipo: 'contrato' },
        { pats: ['resolucion rectificacion rp', 'resolución rectificación rp', 'rectificacion rp', 'rectificación rp', 'rectificacion del rp', 'rectificación del rp', 'rectificacion registro presupuestal', 'rectificación registro presupuestal', 'rectifica rp', 'rectifica el rp', 'corrige rp', 'corrige el rp', 'modificacion rp', 'modificación rp', 'resolucion rp', 'resolución rp'], tipo: 'resolucion_rect_rp' },
        { pats: ['registro presupuestal', 'rp '], tipo: 'rp' },
        { pats: ['acta de inicio'], tipo: 'acta_inicio' },
        { pats: ['orden de compra', 'orden compra'], tipo: 'orden_compra' },
        { pats: ['informe contratista', 'informe del contratista'], tipo: 'informe_contratista' },
        { pats: ['informe supervisor', 'informe de supervision', 'informe de supervisión', 'informe del supervisor'], tipo: 'informe_supervisor' },
        { pats: ['acta recibido', 'acta de recibido', 'acta de recibo'], tipo: 'acta_recibido' },
        { pats: ['entrada de almacen', 'entrada de almacén', 'entrada almacen', 'entrada almacén', 'entrada_almacen', 'comprobante de entrada', 'ingreso al almacen', 'ingreso al almacén', 'recepcion bienes', 'recepción bienes', 'kardex'], tipo: 'entrada_almacen' },
        { pats: ['orden de pago', 'orden pago'], tipo: 'orden_pago' },
        { pats: ['comprobante de egreso', 'comprobante egreso', 'egreso'], tipo: 'egreso' },
        { pats: ['soporte de pago', 'soporte pago', 'comprobante de pago', 'comprobante bancario', 'transferencia bancaria', 'transferencia electronica', 'transferencia electrónica', 'consignacion', 'consignación', 'recibo bancario', 'soporte bancario', 'pago bancolombia', 'pago davivienda', 'pago bbva', 'pago popular', 'pago bogota', 'pago bogotá', 'pago avvillas', 'pago av villas', 'pago colpatria', 'pago caja social', 'pago agrario', 'pse', 'transferencia ach', 'soporte transferencia', 'comprobante transferencia', 'pago.pdf', 'pago pdf', 'nominaproveedoreslibranzas', 'nomina proveedores libranzas', 'nómina proveedores libranzas', 'nomina proveedores', 'nómina proveedores', 'libranzas', 'proveedoreslibranzas'], tipo: 'soporte_pago' },
        { pats: ['acta de liquidacion', 'acta de liquidación', 'liquidacion', 'liquidación'], tipo: 'acta_liquidacion' },
        // IMPORTANTE: orden estricto - primero las MÁS ESPECÍFICAS
        // Acta de Cierre del CONTRATO = Acta de Liquidación (cierre del contrato)
        { pats: ['acta de cierre del contrato', 'acta cierre del contrato', 'cierre del contrato', 'cierre contractual', 'cierre definitivo del contrato', 'acta de archivo', 'expediente cerrado', 'cierre y archivo', 'acta de liquidacion', 'acta de liquidación', 'balance financiero del contrato'], tipo: 'acta_liquidacion' },
        // Acta de Cierre del PROCESO de selección (lo común en FOSE)
        // El nombre genérico 'acta de cierre' o 'acta cierre' se asume como cierre del proceso
        { pats: ['acta de cierre del proceso', 'cierre del proceso', 'cierre proceso de seleccion', 'cierre proceso de selección', 'cierre recepcion ofertas', 'cierre recepción ofertas', 'cierre invitacion', 'cierre invitación', 'acta de cierre', 'acta cierre'], tipo: 'acta_cierre_proceso' }
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

        // PASO 1.5: Detecci\u00f3n especial FSE con trimestre por contenido
        // Los archivos del portal FSE tienen nombres espec\u00edficos:
        // - certificado_paz_y_salvo_reporte_f.pdf
        // - reportePDF_CUS_FSE_007.pdf
        // NO debe confundir con "Certificado Bancario" u otros certificados generales
        if(!tipo){
          const textoFSE = paginasDelArchivo.map(p => p.texto).join(' ').toLowerCase();
          // Requerir indicadores ESTRICTOS en el nombre Y en el contenido
          const nombreEsFSE = nombreLower.includes('paz_y_salvo') || nombreLower.includes('paz y salvo') || nombreLower.includes('paz-y-salvo') || nombreLower.includes('cus_fse') || nombreLower.includes('cus fse') || nombreLower.includes('reportepdf_cus_fse') || nombreLower.includes('reporte_archivos_cargados') || nombreLower.includes('certificado_paz_y_salvo') || nombreLower.includes('reportepdf');
          const contenidoEsFSE = textoFSE.includes('fondos de servicios educativos') || textoFSE.includes('certificado de informaci\u00f3n reportada') || textoFSE.includes('certificado de informacion reportada') || textoFSE.includes('reporte archivos cargados fse') || textoFSE.includes('secretar\u00eda de educaci\u00f3n de bol\u00edvar') || textoFSE.includes('secretaria de educacion de bolivar');

          const esCertificadoFSE = nombreEsFSE && nombreLower.includes('certificado') && (contenidoEsFSE || textoFSE.includes('paz y salvo'));
          const esReporteFSE = nombreEsFSE && (nombreLower.includes('reportepdf') || nombreLower.includes('cus_fse') || nombreLower.includes('cus fse')) && (contenidoEsFSE || textoFSE.includes('reporte archivos cargados'));

          if(esCertificadoFSE || esReporteFSE){
            // Detectar trimestre
            let trimestre = null;
            if(textoFSE.match(/primer\s+trimestre|trimestre\s*\[?1\]?|trimestre\s+1\b|t1\b/i)) trimestre = 1;
            else if(textoFSE.match(/segundo\s+trimestre|trimestre\s*\[?2\]?|trimestre\s+2\b|t2\b/i)) trimestre = 2;
            else if(textoFSE.match(/tercer\s+trimestre|trimestre\s*\[?3\]?|trimestre\s+3\b|t3\b/i)) trimestre = 3;
            else if(textoFSE.match(/cuarto\s+trimestre|trimestre\s*\[?4\]?|trimestre\s+4\b|t4\b/i)) trimestre = 4;

            if(trimestre){
              if(esCertificadoFSE){
                tipo = `inf_cert_t${trimestre}`;
                confianza = 90;
                console.log(`\u2713 "${rango.nombre}" \u2192 INF-0${8+trimestre} Certificado FSE T${trimestre} (contenido)`);
              } else if(esReporteFSE){
                tipo = `inf_reporte_t${trimestre}`;
                confianza = 90;
                console.log(`\u2713 "${rango.nombre}" \u2192 INF-${9+trimestre} Reporte FSE T${trimestre} (contenido)`);
              }
            }
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

    // 3.5 Exportar catálogo de instituciones (y otros metadatos)
    try {
      const allMetaKeys = await DB._getAllKeys('meta');
      const allMeta = {};
      for(const k of allMetaKeys){
        const val = await DB._get('meta', k);
        if(val !== undefined && val !== null) allMeta[k] = val;
      }
      zip.file('meta.json', JSON.stringify(allMeta, null, 2));
    } catch(err){
      console.warn('No se pudo exportar meta:', err);
    }

    // 4. Metadata del backup
    const meta = {
      fecha: new Date().toISOString(),
      version: '1.1',
      totalExpedientes: expedientes.length,
      totalDocumentos: allDocs.length,
      totalArchivos: archivosExportados,
      totalInstituciones: (_instituciones || []).length
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

    // 4.5 Restaurar meta (instituciones y otros metadatos)
    const metaFile = zip.file('meta.json');
    if(metaFile){
      try {
        const allMeta = JSON.parse(await metaFile.async('text'));
        for(const [k, v] of Object.entries(allMeta)){
          await DB._put('meta', k, v);
        }
      } catch(err){
        console.warn('No se pudo restaurar meta:', err);
      }
    }

    // 5. Recargar app (expedientes, instituciones, filtro y lista)
    await DB.loadExpedientes();
    await cargarInstituciones();
    cargarFiltroInstituciones();
    renderListaExpedientes();

    toast('Backup restaurado: ' + (info.totalExpedientes || 0) + ' expedientes, ' + archivosRestaurados + ' archivos, ' + (_instituciones?.length || 0) + ' instituciones');

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
