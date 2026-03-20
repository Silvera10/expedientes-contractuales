/* ══════════════════════════════════════════════════════════
   EXPEDIENTES CONTRACTUALES — UI (renderizado de pantallas)
══════════════════════════════════════════════════════════ */

/* ── Catalogo de documentos requeridos (Ley 80) ── */
/*
  Reglas de validaci\u00f3n (vigencia):
    vigencia_dias : n\u00famero de d\u00edas m\u00e1ximo de antig\u00fcedad permitida (null = sin l\u00edmite)
    regla         : 'antes_contrato' | 'despues_contrato' | 'mes_pago' | 'vigente' | 'renovado' | null
                    antes_contrato  = debe ser anterior a fecha_contrato
                    despues_contrato= debe ser posterior o igual a fecha_contrato
                    mes_pago        = debe coincidir con el mes del pago
                    vigente         = vigente al momento de contratar (usa vigencia_dias)
                    renovado        = debe estar renovada (c\u00e1mara de comercio)
*/
const DOC_TIPOS = [
  // Fase 1: Precontractual
  { id:'cert_plan_compras',  nombre:'Certificaci\u00f3n Plan de Compras',    etapa:'pre', orden:1,  icon:'bi-clipboard2-check',    color:'#0d6efd', vigencia_dias:null, regla:'antes_contrato', codigo:'PRE-01' },
  { id:'estudio_previo',     nombre:'Estudio Previo / Necesidad',       etapa:'pre', orden:2,  icon:'bi-file-earmark-ruled',  color:'#0d6efd', vigencia_dias:null, regla:'antes_contrato', codigo:'PRE-02' },
  { id:'solicitud_cdp',      nombre:'Solicitud de CDP',                 etapa:'pre', orden:3,  icon:'bi-file-earmark-arrow-up', color:'#0d6efd', vigencia_dias:null, regla:'antes_contrato', codigo:'PRE-03' },
  { id:'cdp',                nombre:'CDP (Disponibilidad Presupuestal)', etapa:'pre', orden:4, icon:'bi-file-earmark-check',  color:'#0d6efd', vigencia_dias:null, regla:'antes_contrato', codigo:'PRE-04' },
  { id:'invitacion',         nombre:'Invitaci\u00f3n a Ofertar',             etapa:'pre', orden:5,  icon:'bi-envelope-paper',      color:'#fd7e14', vigencia_dias:null, regla:'antes_contrato', codigo:'PRE-05' },
  { id:'cotizaciones',       nombre:'Cotizaci\u00f3n(es) Recibidas',         etapa:'pre', orden:6,  icon:'bi-receipt',             color:'#fd7e14', vigencia_dias:null, regla:'antes_contrato', codigo:'PRE-06' },
  { id:'carta_propuesta',    nombre:'Carta de Propuesta',               etapa:'pre', orden:7,  icon:'bi-envelope-open',       color:'#fd7e14', vigencia_dias:null, regla:'antes_contrato', codigo:'PRE-07' },
  { id:'evaluacion',         nombre:'Evaluaci\u00f3n de Ofertas',            etapa:'pre', orden:8,  icon:'bi-table',               color:'#fd7e14', vigencia_dias:null, regla:'antes_contrato', codigo:'PRE-08' },
  { id:'aceptacion',         nombre:'Aceptaci\u00f3n de Oferta',             etapa:'pre', orden:9,  icon:'bi-check2-circle',       color:'#fd7e14', vigencia_dias:null, regla:'antes_contrato', codigo:'PRE-09' },

  // Fase 2: Documentos del contratista
  { id:'rut',                nombre:'RUT del Contratista',              etapa:'sel', orden:10, icon:'bi-person-vcard',        color:'#6f42c1', vigencia_dias:null, regla:'vigente', codigo:'DOC-01' },
  { id:'cedula',             nombre:'C\u00e9dula del Contratista',           etapa:'sel', orden:11, icon:'bi-person-badge',        color:'#6f42c1', vigencia_dias:null, regla:null, codigo:'DOC-02' },
  { id:'antec_policia',      nombre:'Antecedentes Polic\u00eda',             etapa:'sel', orden:12, icon:'bi-shield-check',        color:'#20c997', vigencia_dias:90,  regla:'vigente', codigo:'DOC-03' },
  { id:'antec_procuraduria', nombre:'Antecedentes Procuradur\u00eda',        etapa:'sel', orden:13, icon:'bi-shield-check',        color:'#20c997', vigencia_dias:90,  regla:'vigente', codigo:'DOC-04' },
  { id:'antec_contraloria',  nombre:'Antecedentes Contralor\u00eda',         etapa:'sel', orden:14, icon:'bi-shield-check',        color:'#20c997', vigencia_dias:90,  regla:'vigente', codigo:'DOC-05' },
  { id:'medidas_correctivas',nombre:'Medidas Correctivas',              etapa:'sel', orden:15, icon:'bi-shield-check',        color:'#20c997', vigencia_dias:90,  regla:'vigente', codigo:'DOC-06' },
  { id:'inhabilidades',      nombre:'Consulta de Inhabilidades',        etapa:'sel', orden:16, icon:'bi-shield-exclamation',  color:'#20c997', vigencia_dias:90,  regla:'vigente', codigo:'DOC-07' },
  { id:'redeam',             nombre:'REDEAM (Deudores Alimentarios)',   etapa:'sel', orden:17, icon:'bi-exclamation-triangle', color:'#e83e8c', vigencia_dias:90,  regla:'vigente', codigo:'DOC-08' },
  { id:'habeas_data',        nombre:'Habeas Data',                      etapa:'sel', orden:18, icon:'bi-fingerprint',         color:'#e83e8c', vigencia_dias:null, regla:null, codigo:'DOC-09' },
  { id:'seguridad_social',   nombre:'Seguridad Social (EPS+Pensi\u00f3n+ARL)', etapa:'sel', orden:19, icon:'bi-heart-pulse',      color:'#e83e8c', vigencia_dias:30,  regla:'mes_pago', codigo:'DOC-10' },
  { id:'camara_comercio',    nombre:'C\u00e1mara de Comercio',                etapa:'sel', orden:20, icon:'bi-shop',                color:'#6f42c1', vigencia_dias:30,  regla:'renovado', codigo:'DOC-11' },

  // Fase 3: Contractual
  { id:'contrato',           nombre:'Contrato Firmado',                 etapa:'con', orden:21, icon:'bi-file-earmark-medical', color:'#198754', vigencia_dias:null, regla:null, codigo:'CON-01' },
  { id:'rp',                 nombre:'Registro Presupuestal (RP)',       etapa:'con', orden:22, icon:'bi-file-earmark-lock',    color:'#198754', vigencia_dias:null, regla:'despues_contrato', codigo:'CON-02' },
  { id:'acta_inicio',        nombre:'Acta de Inicio',                   etapa:'con', orden:23, icon:'bi-play-circle',          color:'#17a2b8', vigencia_dias:null, regla:'despues_contrato', codigo:'CON-03' },

  // Fase 4: Ejecucion
  { id:'orden_compra',       nombre:'Orden de Compra / Servicio',       etapa:'eje', orden:24, icon:'bi-cart-check',           color:'#dc3545', vigencia_dias:null, regla:null, codigo:'EJE-01' },
  { id:'factura',            nombre:'Factura / Cuenta de Cobro',        etapa:'eje', orden:25, icon:'bi-receipt-cutoff',       color:'#dc3545', vigencia_dias:null, regla:'despues_contrato', codigo:'EJE-02' },
  { id:'informe_contratista',nombre:'Informe del Contratista',          etapa:'eje', orden:26, icon:'bi-file-earmark-person',  color:'#dc3545', vigencia_dias:null, regla:'despues_contrato', codigo:'EJE-03' },
  { id:'informe_supervisor', nombre:'Informe de Supervisi\u00f3n',           etapa:'eje', orden:27, icon:'bi-clipboard-check',     color:'#6c757d', vigencia_dias:null, regla:'despues_contrato', codigo:'EJE-04' },
  { id:'acta_recibido',      nombre:'Acta Recibo a Satisfacci\u00f3n',       etapa:'eje', orden:28, icon:'bi-check2-square',       color:'#6c757d', vigencia_dias:null, regla:'despues_contrato', codigo:'EJE-05' },

  // Fase 5: Pago y Liquidacion
  { id:'orden_pago',         nombre:'Orden de Pago',                    etapa:'pag', orden:29, icon:'bi-cash-coin',            color:'#343a40', vigencia_dias:null, regla:'despues_contrato', codigo:'PAG-01' },
  { id:'egreso',             nombre:'Comprobante de Egreso',            etapa:'pag', orden:30, icon:'bi-receipt',              color:'#343a40', vigencia_dias:null, regla:'despues_contrato', codigo:'PAG-02' },
  { id:'acta_liquidacion',   nombre:'Acta de Liquidaci\u00f3n',              etapa:'pag', orden:31, icon:'bi-file-earmark-x',      color:'#343a40', vigencia_dias:null, regla:'despues_contrato', codigo:'PAG-03' }
];

/* ── Documentos adicionales para vigencia anterior (adici\u00f3n) ── */
const DOC_TIPOS_ADICION = [
  // Documentos originales de la vigencia anterior
  { id:'cdp_original',       nombre:'CDP Original (vigencia anterior)',    etapa:'ant', orden:50, icon:'bi-file-earmark-check',  color:'#6c757d', codigo:'ANT-01' },
  { id:'rp_original',        nombre:'RP Original (compromiso anterior)',   etapa:'ant', orden:51, icon:'bi-file-earmark-lock',   color:'#6c757d', codigo:'ANT-02' },
  { id:'contrato_original',  nombre:'Contrato Original (vigencia anterior)', etapa:'ant', orden:52, icon:'bi-file-earmark-medical', color:'#6c757d', codigo:'ANT-03' },

  // Documentos de la adici\u00f3n/pr\u00f3rroga
  { id:'acuerdo_adicion',    nombre:'Acuerdo de Adici\u00f3n / Pr\u00f3rroga',      etapa:'adi', orden:60, icon:'bi-file-earmark-plus',   color:'#fd7e14', codigo:'ADI-01' },
  { id:'cdp_adicion',        nombre:'CDP Adici\u00f3n (vigencia actual)',       etapa:'adi', orden:61, icon:'bi-file-earmark-check',  color:'#0d6efd', codigo:'ADI-02' },
  { id:'rp_adicion',         nombre:'RP Adici\u00f3n (vigencia actual)',        etapa:'adi', orden:62, icon:'bi-file-earmark-lock',   color:'#198754', codigo:'ADI-03' },
  { id:'cert_cuenta_pagar',  nombre:'Certificaci\u00f3n Cuenta por Pagar',     etapa:'adi', orden:63, icon:'bi-file-earmark-text',   color:'#17a2b8', codigo:'ADI-04' }
];

const ETAPAS = [
  { key:'pre', label:'Fase Precontractual',            icon:'bi-1-circle-fill', css:'etapa-pre' },
  { key:'sel', label:'Documentos del Contratista',     icon:'bi-2-circle-fill', css:'etapa-sel' },
  { key:'con', label:'Fase Contractual',               icon:'bi-3-circle-fill', css:'etapa-con' },
  { key:'eje', label:'Fase de Ejecuci\u00f3n',              icon:'bi-4-circle-fill', css:'etapa-eje' },
  { key:'pag', label:'Pago y Liquidaci\u00f3n',               icon:'bi-5-circle-fill', css:'etapa-pag' }
];

const ETAPAS_ADICION = [
  { key:'ant', label:'Documentos Vigencia Original',   icon:'bi-clock-history',  css:'etapa-ant' },
  { key:'adi', label:'Adici\u00f3n / Vigencia Actual',       icon:'bi-plus-circle-fill', css:'etapa-adi' }
];

/* ══════════════════════════════════════════
   VALIDACION DE FECHAS Y VIGENCIAS
══════════════════════════════════════════ */
function validarDocumento(docTipo, doc, exp){
  // Si no tiene fecha de expedicion, no se puede validar
  if(!doc || !doc.fecha_expedicion) return { estado:'sin_fecha', msg:'Sin fecha de expedici\u00f3n', color:'var(--amarillo)' };
  if(!docTipo.regla) return { estado:'ok', msg:'Documento cargado', color:'var(--verde)' };

  const fechaDoc = new Date(doc.fecha_expedicion + 'T00:00:00');
  const fechaContrato = exp.datos?.fecha_contrato ? new Date(exp.datos.fecha_contrato + 'T00:00:00') : null;
  const hoy = new Date(); hoy.setHours(0,0,0,0);

  switch(docTipo.regla){
    case 'antes_contrato':
      if(!fechaContrato) return { estado:'sin_ref', msg:'Falta fecha del contrato', color:'var(--amarillo)' };
      if(fechaDoc > fechaContrato) return { estado:'error', msg:'Debe ser anterior a la fecha del contrato', color:'var(--rojo)' };
      return { estado:'ok', msg:'Fecha correcta (anterior al contrato)', color:'var(--verde)' };

    case 'despues_contrato':
      if(!fechaContrato) return { estado:'sin_ref', msg:'Falta fecha del contrato', color:'var(--amarillo)' };
      if(fechaDoc < fechaContrato) return { estado:'error', msg:'Debe ser posterior a la fecha del contrato', color:'var(--rojo)' };
      return { estado:'ok', msg:'Fecha correcta (posterior al contrato)', color:'var(--verde)' };

    case 'vigente':
      if(docTipo.vigencia_dias){
        const diasTranscurridos = Math.floor((hoy - fechaDoc) / (1000*60*60*24));
        if(diasTranscurridos > docTipo.vigencia_dias){
          return { estado:'vencido', msg:`Vencido (${diasTranscurridos} d\u00edas, m\u00e1x ${docTipo.vigencia_dias})`, color:'var(--rojo)' };
        }
        if(diasTranscurridos > docTipo.vigencia_dias - 15){
          return { estado:'por_vencer', msg:`Por vencer (${docTipo.vigencia_dias - diasTranscurridos} d\u00edas restantes)`, color:'var(--amarillo)' };
        }
        return { estado:'ok', msg:`Vigente (${docTipo.vigencia_dias - diasTranscurridos} d\u00edas restantes)`, color:'var(--verde)' };
      }
      return { estado:'ok', msg:'Documento vigente', color:'var(--verde)' };

    case 'mes_pago':
      // Debe ser del mes actual o del mes de pago
      const mesDoc = fechaDoc.getFullYear() * 100 + fechaDoc.getMonth();
      const mesHoy = hoy.getFullYear() * 100 + hoy.getMonth();
      if(mesDoc !== mesHoy){
        return { estado:'error', msg:'Debe ser del mes en curso del pago', color:'var(--rojo)' };
      }
      return { estado:'ok', msg:'Mes correcto', color:'var(--verde)' };

    case 'renovado':
      if(docTipo.vigencia_dias){
        const dias = Math.floor((hoy - fechaDoc) / (1000*60*60*24));
        if(dias > docTipo.vigencia_dias){
          return { estado:'vencido', msg:`Vencida — debe renovar (${dias} d\u00edas, m\u00e1x ${docTipo.vigencia_dias})`, color:'var(--rojo)' };
        }
        if(dias > docTipo.vigencia_dias - 7){
          return { estado:'por_vencer', msg:`Pr\u00f3xima a vencer (${docTipo.vigencia_dias - dias} d\u00edas)`, color:'var(--amarillo)' };
        }
      }
      return { estado:'ok', msg:'Vigente y renovada', color:'var(--verde)' };

    default:
      return { estado:'ok', msg:'Documento cargado', color:'var(--verde)' };
  }
}

/* Genera resumen de alertas de auditoria */
function generarAlertasAuditoria(docsCatalogo, subidosMap, exp){
  const alertas = { errores:[], advertencias:[], ok:0 };
  for(const docTipo of docsCatalogo){
    const cod = docTipo.codigo ? `[${docTipo.codigo}] ` : '';
    const doc = subidosMap[docTipo.id];
    if(!doc){
      alertas.errores.push(`${cod}Falta: ${docTipo.nombre}`);
      continue;
    }
    const val = validarDocumento(docTipo, doc, exp);
    if(val.estado === 'error' || val.estado === 'vencido'){
      alertas.errores.push(`${cod}${docTipo.nombre}: ${val.msg}`);
    } else if(val.estado === 'por_vencer' || val.estado === 'sin_fecha' || val.estado === 'sin_ref'){
      alertas.advertencias.push(`${cod}${docTipo.nombre}: ${val.msg}`);
    } else {
      alertas.ok++;
    }
  }
  return alertas;
}

/* ══════════════════════════════════════════
   TOAST (notificaciones)
══════════════════════════════════════════ */
function toast(msg, type='success'){
  const container = document.getElementById('toast-container');
  const div = document.createElement('div');
  div.className = 'toast-msg ' + type;
  div.textContent = msg;
  container.appendChild(div);
  setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, 3500);
}

/* ══════════════════════════════════════════
   TOGGLE AUTH FORMS
══════════════════════════════════════════ */
function toggleAuthForm(form){
  document.getElementById('form-login').style.display = form === 'login' ? '' : 'none';
  document.getElementById('form-register').style.display = form === 'register' ? '' : 'none';
  document.getElementById('auth-error').style.display = 'none';
}

/* ══════════════════════════════════════════
   RENDER: Lista de expedientes (panel izquierdo)
══════════════════════════════════════════ */
function renderListaExpedientes(){
  const el = document.getElementById('lista-expedientes');
  const filtro = DB._filtroInstitucion || '';
  const exps = filtro ? DB._expedientes.filter(e => e.institucion === filtro) : DB._expedientes;

  // Actualizar filtro de instituciones
  if(typeof cargarFiltroInstituciones === 'function') cargarFiltroInstituciones();

  if(!exps.length){
    el.innerHTML = '<div class="text-center py-4"><i class="bi bi-folder2-open text-muted" style="font-size:2rem"></i><p class="text-muted small mt-2">No hay expedientes.<br>Cree uno con el bot\u00f3n <strong>+</strong></p></div>';
    return;
  }

  el.innerHTML = exps.map(exp => {
    const active = DB._activeId === exp.id ? ' active' : '';
    const estadoBadge = exp.estado === 'bloqueado' ? '<span class="badge badge-bloqueado">Bloqueado</span>'
      : exp.estado === 'completo' ? '<span class="badge badge-completo">Completo</span>'
      : '<span class="badge badge-progreso">En progreso</span>';
    return `<div class="exp-item${active}" onclick="abrirExpediente('${exp.id}')">
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <div class="exp-numero">Cto N\u00b0 ${exp.contrato_numero || 'S/N'} / ${exp.anio || ''}</div>
          <div class="exp-contratista"><i class="bi bi-person me-1"></i>${exp.contratista || '\u2014'}</div>
          <div class="exp-contratista"><i class="bi bi-building me-1"></i>${exp.institucion || '\u2014'}</div>
        </div>
        <div class="exp-estado">${estadoBadge}</div>
      </div>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════════
   RENDER: Detalle del expediente (panel derecho)
══════════════════════════════════════════ */
async function renderDetalleExpediente(expId){
  const panel = document.getElementById('panel-detalle');
  const exp = DB.getExpediente(expId);
  if(!exp){
    panel.innerHTML = '<div class="text-center py-5 text-muted"><i class="bi bi-folder2-open" style="font-size:4rem;opacity:0.3"></i><p class="mt-2">Seleccione un expediente</p></div>';
    return;
  }

  // Cargar documentos subidos
  const docsSubidos = await DB.loadDocumentos(expId);
  const subidosMap = {};
  docsSubidos.forEach(d => { subidosMap[d.tipo] = d; });

  const esAnterior = (exp.datos && exp.datos.tipo_vigencia === 'anterior');
  const docsCatalogo = esAnterior ? [...DOC_TIPOS, ...DOC_TIPOS_ADICION] : DOC_TIPOS;
  const totalRequeridos = docsCatalogo.length;
  const totalSubidos = docsSubidos.filter(d => docsCatalogo.find(t => t.id === d.tipo)).length;
  const pct = Math.round((totalSubidos / totalRequeridos) * 100);
  const bloqueado = exp.estado === 'bloqueado';

  // Header del expediente
  let html = `
    <div class="card shadow-sm mb-3">
      <div class="card-body p-3">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <h5 class="mb-1" style="color:var(--azul)">
              <i class="bi bi-folder-fill me-2"></i>Contrato N\u00b0 ${exp.contrato_numero || 'S/N'} de ${exp.anio || ''}
            </h5>
            <div class="small text-muted">
              <i class="bi bi-building me-1"></i>${exp.institucion || '\u2014'}
              <span class="mx-2">|</span>
              <i class="bi bi-person me-1"></i>${exp.contratista || '\u2014'}
              ${exp.nit ? '<span class="mx-2">|</span><i class="bi bi-hash me-1"></i>' + exp.nit : ''}
              ${exp.valor ? '<span class="mx-2">|</span><i class="bi bi-cash me-1"></i>$' + Number(exp.valor).toLocaleString('es-CO') : ''}
            </div>
            ${exp.objeto ? '<div class="small mt-1" style="max-width:600px">' + exp.objeto + '</div>' : ''}
          </div>
          <div class="d-flex gap-1">
            ${!bloqueado ? `<button class="btn btn-outline-primary btn-sm py-0 px-2" onclick="editarExpediente('${exp.id}')" title="Editar datos"><i class="bi bi-pencil"></i></button>` : ''}
            ${!bloqueado ? `<button class="btn btn-outline-danger btn-sm py-0 px-2" onclick="eliminarExpediente('${exp.id}')" title="Eliminar"><i class="bi bi-trash"></i></button>` : ''}
            ${exp.estado === 'completo' ? `<button class="btn btn-outline-secondary btn-sm py-0 px-2" onclick="bloquearExpediente('${exp.id}')" title="Bloquear (solo lectura)"><i class="bi bi-lock"></i></button>` : ''}
          </div>
        </div>
        <!-- Barra de progreso -->
        <div class="mt-3">
          <div class="d-flex justify-content-between small mb-1">
            <span><strong>${totalSubidos}</strong> de <strong>${totalRequeridos}</strong> documentos</span>
            <span class="fw-bold" style="color:${pct === 100 ? 'var(--verde)' : pct >= 50 ? 'var(--dorado)' : 'var(--rojo)'}">${pct}%</span>
          </div>
          <div class="progress-bar-exp">
            <div class="fill" style="width:${pct}%;background:${pct === 100 ? 'var(--verde)' : pct >= 50 ? 'var(--dorado)' : 'var(--rojo)'}"></div>
          </div>
        </div>
      </div>
    </div>`;

  // Panel de auditoria
  const alertas = generarAlertasAuditoria(docsCatalogo, subidosMap, exp);
  if(alertas.errores.length > 0 || alertas.advertencias.length > 0){
    html += `<div class="card shadow-sm mb-3 border-0">
      <div class="card-body p-2">
        <div class="d-flex align-items-center gap-2 mb-2">
          <i class="bi bi-shield-exclamation" style="font-size:1.2rem;color:var(--rojo)"></i>
          <strong class="small">Control de Auditor\u00eda</strong>
          <span class="badge bg-danger">${alertas.errores.length} error${alertas.errores.length !== 1 ? 'es' : ''}</span>
          ${alertas.advertencias.length ? `<span class="badge bg-warning text-dark">${alertas.advertencias.length} advertencia${alertas.advertencias.length !== 1 ? 's' : ''}</span>` : ''}
          <span class="badge bg-success">${alertas.ok} OK</span>
        </div>
        ${alertas.errores.length ? `<div class="small mb-1" style="max-height:100px;overflow-y:auto">
          ${alertas.errores.map(e => `<div style="color:var(--rojo)"><i class="bi bi-x-circle-fill me-1"></i>${e}</div>`).join('')}
        </div>` : ''}
        ${alertas.advertencias.length ? `<div class="small" style="max-height:80px;overflow-y:auto">
          ${alertas.advertencias.map(a => `<div style="color:#b45309"><i class="bi bi-exclamation-triangle-fill me-1"></i>${a}</div>`).join('')}
        </div>` : ''}
      </div>
    </div>`;
  } else if(totalSubidos > 0){
    html += `<div class="alert alert-success py-2 small mb-3">
      <i class="bi bi-shield-check me-1"></i>
      <strong>Auditor\u00eda OK</strong> — Todos los documentos cargados con fechas v\u00e1lidas (${alertas.ok} documentos verificados)
    </div>`;
  }

  // Botones de accion
  html += `<div class="d-flex gap-2 mb-3 flex-wrap">
    ${!bloqueado ? `<button class="btn btn-success btn-sm fw-bold" onclick="abrirSplitter('${exp.id}')">
      <i class="bi bi-scissors me-2"></i>Subir PDF Completo (auto-detectar)
    </button>` : ''}
    <button class="btn btn-generar" onclick="generarExpedientePDF('${exp.id}')" ${totalSubidos === 0 ? 'disabled' : ''}>
      <i class="bi bi-file-earmark-pdf me-2"></i>Generar Expediente PDF Foliado
    </button>
    ${!bloqueado ? `<button class="btn btn-outline-secondary btn-sm" onclick="agregarDocExtra('${exp.id}')">
      <i class="bi bi-plus-lg me-1"></i>Agregar documento adicional
    </button>` : ''}
  </div>`;

  // Documentos por etapa
  ETAPAS.forEach(etapa => {
    const docs = DOC_TIPOS.filter(d => d.etapa === etapa.key);
    html += `<div class="mb-3">
      <div class="etapa-header ${etapa.css}">
        <i class="bi ${etapa.icon} me-1"></i>${etapa.label}
        <span class="float-end">${docs.filter(d => subidosMap[d.id]).length}/${docs.length}</span>
      </div>
      <div class="row g-2">`;

    docs.forEach(doc => {
      const subido = subidosMap[doc.id];
      html += renderDocSlot(doc, subido, exp.id, bloqueado, exp);
    });

    html += `</div></div>`;
  });

  // Secciones de vigencia anterior (si aplica)
  if(esAnterior){
    html += `<div class="alert alert-warning py-2 small mb-3">
      <i class="bi bi-clock-history me-1"></i>
      <strong>Contrato de vigencia anterior</strong> — Vigencia original: ${exp.datos.anio_original || '?'} | Vigencia de pago: ${exp.datos.anio_pago || '?'}
    </div>`;

    ETAPAS_ADICION.forEach(etapa => {
      const docs = DOC_TIPOS_ADICION.filter(d => d.etapa === etapa.key);
      html += `<div class="mb-3">
        <div class="etapa-header ${etapa.css}">
          <i class="bi ${etapa.icon} me-1"></i>${etapa.label}
          <span class="float-end">${docs.filter(d => subidosMap[d.id]).length}/${docs.length}</span>
        </div>
        <div class="row g-2">`;

      docs.forEach(doc => {
        const subido = subidosMap[doc.id];
        html += renderDocSlot(doc, subido, exp.id, bloqueado, exp);
      });

      html += `</div></div>`;
    });
  }

  // Documentos adicionales (los que no estan en el catalogo)
  const extras = docsSubidos.filter(d => !DOC_TIPOS.find(t => t.id === d.tipo) && !DOC_TIPOS_ADICION.find(t => t.id === d.tipo));
  if(extras.length){
    html += `<div class="mb-3">
      <div class="etapa-header" style="background:#f3f4f6;color:#374151">
        <i class="bi bi-paperclip me-1"></i>Documentos Adicionales
      </div>
      <div class="row g-2">`;
    extras.forEach(doc => {
      html += renderDocSlotExtra(doc, exp.id, bloqueado);
    });
    html += `</div></div>`;
  }

  panel.innerHTML = html;
}

/* ── Render un slot de documento (con validaci\u00f3n) ── */
function renderDocSlot(docTipo, subido, expId, bloqueado, exp){
  const uploaded = subido ? ' uploaded' : '';

  // Validacion
  let validacion = null;
  let semaforoHtml = '';
  if(subido){
    validacion = validarDocumento(docTipo, subido, exp || {});
    const semaforoClass = validacion.estado === 'ok' ? 'verde' : (validacion.estado === 'error' || validacion.estado === 'vencido') ? 'rojo' : 'amarillo';
    semaforoHtml = `<span class="semaforo ${semaforoClass}" title="${validacion.msg}"></span>`;
  }

  const icono = subido
    ? `<div class="doc-icon" style="background:${validacion && (validacion.estado==='error'||validacion.estado==='vencido') ? 'var(--rojo)' : 'var(--verde)'}"><i class="bi bi-check-lg"></i></div>`
    : `<div class="doc-icon" style="background:${docTipo.color}"><i class="bi ${docTipo.icon}"></i></div>`;

  let fechaHtml = '';
  if(subido){
    const fechaVal = subido.fecha_expedicion || '';
    fechaHtml = bloqueado
      ? (fechaVal ? `<div class="doc-meta"><i class="bi bi-calendar-event me-1"></i>Exp: ${fechaVal}</div>` : '')
      : `<div class="doc-meta mt-1">
           <input type="date" class="form-control form-control-sm" style="font-size:10px;padding:1px 4px;height:22px;width:130px"
             value="${fechaVal}" onchange="actualizarFechaDoc('${subido.id}','${expId}',this.value)" title="Fecha de expedici\u00f3n">
         </div>`;
  }

  const vigenciaInfo = (docTipo.vigencia_dias && !subido)
    ? `<div class="doc-meta" style="color:var(--azul2)"><i class="bi bi-clock me-1"></i>Vigencia: ${docTipo.vigencia_dias} d\u00edas</div>` : '';

  const validacionMsg = (subido && validacion && validacion.estado !== 'ok')
    ? `<div class="doc-meta" style="color:${validacion.color};font-weight:600"><i class="bi bi-exclamation-triangle me-1"></i>${validacion.msg}</div>` : '';

  const codigoTag = docTipo.codigo ? `<span class="badge bg-secondary me-1" style="font-size:9px;vertical-align:middle">${docTipo.codigo}</span>` : '';

  const info = subido
    ? `<div class="doc-name">${semaforoHtml} ${codigoTag}${docTipo.nombre}</div>
       <div class="doc-meta"><i class="bi bi-file-pdf me-1"></i>${subido.nombre_archivo || 'archivo.pdf'} &mdash; ${subido.paginas || 1} p\u00e1g.</div>
       ${fechaHtml}${validacionMsg}`
    : `<div class="doc-name">${codigoTag}${docTipo.nombre}</div>
       <div class="doc-meta text-danger"><i class="bi bi-x-circle me-1"></i>Sin cargar</div>${vigenciaInfo}`;

  const acciones = bloqueado ? '' : (subido
    ? `<button class="btn btn-outline-danger btn-sm py-0 px-1" onclick="quitarDocumento('${subido.id}','${expId}')" title="Quitar"><i class="bi bi-x-lg"></i></button>
       <button class="btn btn-outline-primary btn-sm py-0 px-1" onclick="reemplazarDocumento('${docTipo.id}','${expId}')" title="Reemplazar"><i class="bi bi-arrow-repeat"></i></button>`
    : `<label class="btn btn-outline-success btn-sm py-0 px-1 mb-0" title="Subir PDF">
         <i class="bi bi-upload"></i>
         <input type="file" accept=".pdf" style="display:none" onchange="subirDocumento(this,'${docTipo.id}','${expId}')">
       </label>`);

  return `<div class="col-md-6 col-lg-4">
    <div class="doc-slot${uploaded} d-flex align-items-center gap-2">
      ${icono}
      <div class="doc-info">${info}</div>
      <div class="doc-actions">${acciones}</div>
    </div>
  </div>`;
}

/* ── Render slot de documento extra ── */
function renderDocSlotExtra(doc, expId, bloqueado){
  const acciones = bloqueado ? ''
    : `<button class="btn btn-outline-danger btn-sm py-0 px-1" onclick="quitarDocumento('${doc.id}','${expId}')" title="Quitar"><i class="bi bi-x-lg"></i></button>`;

  return `<div class="col-md-6 col-lg-4">
    <div class="doc-slot uploaded d-flex align-items-center gap-2">
      <div class="doc-icon" style="background:#6c757d"><i class="bi bi-paperclip"></i></div>
      <div class="doc-info">
        <div class="doc-name">${doc.nombre_archivo || 'Documento'}</div>
        <div class="doc-meta"><i class="bi bi-file-pdf me-1"></i>${doc.paginas || 1} p\u00e1g.</div>
      </div>
      <div class="doc-actions">${acciones}</div>
    </div>
  </div>`;
}

/* ══════════════════════════════════════════
   FMT helpers
══════════════════════════════════════════ */
function fmtCOP(n){
  return '$' + Number(n).toLocaleString('es-CO');
}
