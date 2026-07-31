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
  // \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
  // \u2551 ORDEN CRONOL\u00d3GICO REGULATORIO (Colombia Compra Eficiente) \u2551
  // \u2551 Ley 80/1993, Ley 1150/2007, Ley 715/2001, Decreto 4791    \u2551
  // \u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563
  // \u2551 1. Planeaci\u00f3n (Precontractual)                            \u2551
  // \u2551 2. Habilitantes del Contratista                           \u2551
  // \u2551 3. Contractual (Perfeccionamiento)                        \u2551
  // \u2551 4. Ejecuci\u00f3n                                              \u2551
  // \u2551 5. Pago                                                   \u2551
  // \u2551 6. Liquidaci\u00f3n y Cierre                                   \u2551
  // \u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d

  // \u2500\u2500 1. FASE PRECONTRACTUAL / PLANEACI\u00d3N (etapa 'pre') \u2500\u2500
  { id:'cert_plan_compras',  nombre:'Certificaci\u00f3n Plan de Compras',    etapa:'pre', orden:1,  icon:'bi-clipboard2-check',    color:'#0d6efd', vigencia_dias:null, regla:'antes_contrato', codigo:'PRE-01' },
  { id:'estudio_previo',     nombre:'Estudio Previo / Necesidad',       etapa:'pre', orden:2,  icon:'bi-file-earmark-ruled',  color:'#0d6efd', vigencia_dias:null, regla:'antes_contrato', codigo:'PRE-02' },
  { id:'solicitud_cdp',      nombre:'Solicitud de CDP',                 etapa:'pre', orden:3,  icon:'bi-file-earmark-arrow-up', color:'#0d6efd', vigencia_dias:null, regla:'antes_contrato', codigo:'PRE-03' },
  { id:'cdp',                nombre:'CDP (Disponibilidad Presupuestal)', etapa:'pre', orden:4, icon:'bi-file-earmark-check',  color:'#0d6efd', vigencia_dias:null, regla:'antes_contrato', codigo:'PRE-04' },
  { id:'resolucion_mod_cdp', nombre:'Resoluci\u00f3n de Modificaci\u00f3n del CDP',etapa:'pre', orden:4.5,icon:'bi-arrow-repeat',     color:'#0d6efd', vigencia_dias:null, regla:null, codigo:'PRE-12' },
  { id:'acuerdo_consejo',    nombre:'Acuerdo del Consejo Directivo / Aprobaci\u00f3n',etapa:'pre',orden:4.7,icon:'bi-people-fill', color:'#198754', vigencia_dias:null, regla:'antes_contrato', codigo:'PRE-14' },
  { id:'invitacion',         nombre:'Invitaci\u00f3n a Ofertar',             etapa:'pre', orden:5,  icon:'bi-envelope-paper',      color:'#fd7e14', vigencia_dias:null, regla:'antes_contrato', codigo:'PRE-05' },
  { id:'cotizaciones',       nombre:'Cotizaci\u00f3n(es) Recibidas',         etapa:'pre', orden:6,  icon:'bi-receipt',             color:'#fd7e14', vigencia_dias:null, regla:'antes_contrato', codigo:'PRE-06' },
  { id:'carta_propuesta',    nombre:'Carta de Propuesta',               etapa:'pre', orden:7,  icon:'bi-envelope-open',       color:'#fd7e14', vigencia_dias:null, regla:'antes_contrato', codigo:'PRE-07' },
  { id:'acta_cierre_proceso',nombre:'Acta de Cierre del Proceso de Selecci\u00f3n',etapa:'pre',orden:7.5,icon:'bi-flag',          color:'#fd7e14', vigencia_dias:null, regla:'antes_contrato', codigo:'PRE-13' },
  { id:'evaluacion',         nombre:'Evaluaci\u00f3n de Ofertas',            etapa:'pre', orden:8,  icon:'bi-table',               color:'#fd7e14', vigencia_dias:null, regla:'antes_contrato', codigo:'PRE-08' },
  { id:'verificacion_requisitos',nombre:'Verificaci\u00f3n de Requisitos',  etapa:'pre', orden:8.5,icon:'bi-clipboard-check',     color:'#fd7e14', vigencia_dias:null, regla:'antes_contrato', codigo:'PRE-15' },
  { id:'aceptacion',         nombre:'Aceptaci\u00f3n de Oferta',             etapa:'pre', orden:9,  icon:'bi-check2-circle',       color:'#fd7e14', vigencia_dias:null, regla:'antes_contrato', codigo:'PRE-09' },
  { id:'comunicacion_no_seleccion',nombre:'Comunicaci\u00f3n de No Selecci\u00f3n',etapa:'pre',orden:9.5,icon:'bi-envelope-x',          color:'#6c757d', vigencia_dias:null, regla:'antes_contrato', codigo:'PRE-16' },
  { id:'recibo_secop',       nombre:'Recibo SECOP II / Colombia Compra',etapa:'pre', orden:10, icon:'bi-receipt',             color:'#6610f2', vigencia_dias:null, regla:null, codigo:'PRE-10' },
  { id:'anexos_fotos',       nombre:'Anexos / Fotograf\u00edas',              etapa:'pre', orden:11, icon:'bi-images',              color:'#e83e8c', vigencia_dias:null, regla:null, codigo:'PRE-11' },

  // \u2500\u2500 2. HABILITANTES DEL CONTRATISTA (etapa 'sel') \u2500\u2500
  { id:'rut',                nombre:'RUT del Contratista',              etapa:'sel', orden:20, icon:'bi-person-vcard',        color:'#6f42c1', vigencia_dias:null, regla:'vigente', codigo:'DOC-01' },
  { id:'cedula',             nombre:'C\u00e9dula del Contratista',           etapa:'sel', orden:21, icon:'bi-person-badge',        color:'#6f42c1', vigencia_dias:null, regla:null, codigo:'DOC-02' },
  { id:'antec_policia',      nombre:'Antecedentes Polic\u00eda',             etapa:'sel', orden:22, icon:'bi-shield-check',        color:'#20c997', vigencia_dias:90,  regla:'vigente', codigo:'DOC-03' },
  { id:'antec_procuraduria', nombre:'Antecedentes Procuradur\u00eda',        etapa:'sel', orden:23, icon:'bi-shield-check',        color:'#20c997', vigencia_dias:90,  regla:'vigente', codigo:'DOC-04' },
  { id:'antec_contraloria',  nombre:'Antecedentes Contralor\u00eda',         etapa:'sel', orden:24, icon:'bi-shield-check',        color:'#20c997', vigencia_dias:90,  regla:'vigente', codigo:'DOC-05' },
  { id:'medidas_correctivas',nombre:'Medidas Correctivas',              etapa:'sel', orden:25, icon:'bi-shield-check',        color:'#20c997', vigencia_dias:90,  regla:'vigente', codigo:'DOC-06' },
  { id:'inhabilidades',      nombre:'Consulta de Inhabilidades',        etapa:'sel', orden:26, icon:'bi-shield-exclamation',  color:'#20c997', vigencia_dias:90,  regla:'vigente', codigo:'DOC-07' },
  { id:'redeam',             nombre:'REDEAM (Deudores Alimentarios)',   etapa:'sel', orden:27, icon:'bi-exclamation-triangle', color:'#e83e8c', vigencia_dias:90,  regla:'vigente', codigo:'DOC-08' },
  { id:'habeas_data',        nombre:'Habeas Data',                      etapa:'sel', orden:28, icon:'bi-fingerprint',         color:'#e83e8c', vigencia_dias:null, regla:null, codigo:'DOC-09' },
  { id:'camara_comercio',    nombre:'C\u00e1mara de Comercio',                etapa:'sel', orden:30, icon:'bi-shop',                color:'#6f42c1', vigencia_dias:30,  regla:'renovado', codigo:'DOC-11' },
  { id:'hoja_vida',          nombre:'Hoja de Vida del Contratista',     etapa:'sel', orden:31, icon:'bi-person-lines-fill',  color:'#6f42c1', vigencia_dias:null, regla:null, codigo:'DOC-12' },

  // \u2500\u2500 3. FASE CONTRACTUAL / Perfeccionamiento (etapa 'con') \u2500\u2500
  { id:'contrato',           nombre:'Contrato Firmado',                 etapa:'con', orden:40, icon:'bi-file-earmark-medical', color:'#198754', vigencia_dias:null, regla:null, codigo:'CON-01' },
  { id:'rp',                 nombre:'Registro Presupuestal (RP)',       etapa:'con', orden:41, icon:'bi-file-earmark-lock',    color:'#198754', vigencia_dias:null, regla:'despues_contrato', codigo:'CON-02' },
  { id:'resolucion_rect_rp', nombre:'Resolución Rectificación RP',      etapa:'con', orden:41.5,icon:'bi-pencil-square',       color:'#fd7e14', vigencia_dias:null, regla:'despues_contrato', codigo:'CON-04' },
  { id:'poliza',             nombre:'Póliza / Garantía de Cumplimiento',etapa:'con', orden:41.7,icon:'bi-shield-fill-check',    color:'#0d6efd', vigencia_dias:null, regla:'despues_contrato', codigo:'CON-06' },
  { id:'condiciones_poliza', nombre:'Condiciones Generales de la Póliza',etapa:'con',orden:41.8,icon:'bi-file-earmark-text',    color:'#0d6efd', vigencia_dias:null, regla:'despues_contrato', codigo:'CON-07' },
  { id:'acta_inicio',        nombre:'Acta de Inicio',                   etapa:'con', orden:42, icon:'bi-play-circle',          color:'#17a2b8', vigencia_dias:null, regla:'despues_contrato', codigo:'CON-03' },
  { id:'otrosi',             nombre:'Otrosí / Modificación al Contrato',etapa:'con', orden:42.5,icon:'bi-file-plus',            color:'#6f42c1', vigencia_dias:null, regla:'despues_contrato', codigo:'CON-05' },

  // \u2500\u2500 4. FASE DE EJECUCI\u00d3N (etapa 'eje') \u2500\u2500
  { id:'orden_compra',       nombre:'Orden de Compra / Servicio',       etapa:'eje', orden:50, icon:'bi-cart-check',           color:'#dc3545', vigencia_dias:null, regla:null, codigo:'EJE-01' },
  { id:'informe_contratista',nombre:'Informe del Contratista',          etapa:'eje', orden:52, icon:'bi-file-earmark-person',  color:'#dc3545', vigencia_dias:null, regla:'despues_contrato', codigo:'EJE-03' },
  { id:'informe_supervisor', nombre:'Informe de Supervisi\u00f3n',           etapa:'eje', orden:53, icon:'bi-clipboard-check',     color:'#6c757d', vigencia_dias:null, regla:'despues_contrato', codigo:'EJE-04' },
  { id:'concepto_favorable_supervisor', nombre:'Concepto Favorable del Supervisor', etapa:'eje', orden:53.5, icon:'bi-hand-thumbs-up', color:'#20c997', vigencia_dias:null, regla:'despues_contrato', codigo:'EJE-08' },
  { id:'acta_recibido',      nombre:'Acta Recibo a Satisfacci\u00f3n',       etapa:'eje', orden:54, icon:'bi-check2-square',       color:'#6c757d', vigencia_dias:null, regla:'despues_contrato', codigo:'EJE-05' },
  { id:'entrada_almacen',    nombre:'Entrada de Almac\u00e9n',               etapa:'eje', orden:55, icon:'bi-box-seam',            color:'#fd7e14', vigencia_dias:null, regla:'despues_contrato', codigo:'EJE-06' },

  // \u2500\u2500 5. FASE DE PAGO (etapa 'pag') \u2500\u2500
  // Soportes de pago JUNTOS: Factura, Seguridad Social, Cert. Bancaria
  // (Decreto 4791/2008 - requisitos para autorizar pago)
  { id:'factura',            nombre:'Factura / Cuenta de Cobro',        etapa:'pag', orden:57, icon:'bi-receipt-cutoff',       color:'#dc3545', vigencia_dias:null, regla:'despues_contrato', codigo:'EJE-02' },
  { id:'seguridad_social',   nombre:'Seguridad Social (EPS+Pensi\u00f3n+ARL)',etapa:'pag', orden:58, icon:'bi-heart-pulse',         color:'#e83e8c', vigencia_dias:30,  regla:'mes_pago', codigo:'DOC-10' },
  { id:'cert_bancaria',      nombre:'Certificaci\u00f3n Bancaria',           etapa:'pag', orden:59, icon:'bi-bank',                 color:'#198754', vigencia_dias:90,  regla:'vigente', codigo:'DOC-13' },
  { id:'orden_pago',         nombre:'Orden de Pago',                    etapa:'pag', orden:60, icon:'bi-cash-coin',            color:'#343a40', vigencia_dias:null, regla:'despues_contrato', codigo:'PAG-01' },
  { id:'egreso',             nombre:'Comprobante de Egreso',            etapa:'pag', orden:61, icon:'bi-receipt',              color:'#343a40', vigencia_dias:null, regla:'despues_contrato', codigo:'PAG-02' },
  { id:'soporte_pago',       nombre:'Soporte de Pago Bancario',         etapa:'pag', orden:62, icon:'bi-bank',                 color:'#198754', vigencia_dias:null, regla:'despues_contrato', codigo:'PAG-04' },

  // \u2500\u2500 6. LIQUIDACI\u00d3N Y CIERRE (etapa 'pag', al final) \u2500\u2500
  // NOTA: El "Acta de Liquidaci\u00f3n" ES el cierre formal del contrato.
  // No existe documento separado "Acta de Cierre del Contrato"
  { id:'acta_aclaratoria',   nombre:'Acta(s) Aclaratoria(s)',           etapa:'pag', orden:65, icon:'bi-info-circle',          color:'#fd7e14', vigencia_dias:null, regla:'despues_contrato', codigo:'EJE-07' },
  { id:'acta_liquidacion',   nombre:'Acta de Liquidaci\u00f3n / Cierre del Contrato',etapa:'pag',orden:70,icon:'bi-file-earmark-x',color:'#343a40',vigencia_dias:null,regla:'despues_contrato', codigo:'PAG-03' },

  // \u2500\u2500 BLOQUE INF: Informes Anuales Institucionales (etapa 'inf') \u2500\u2500
  // Para entregar a Secretar\u00eda de Educaci\u00f3n y Alcald\u00eda
  { id:'inf_ejec_ingresos',  nombre:'Ejecuci\u00f3n Presupuestal de Ingresos',etapa:'inf', orden:90, icon:'bi-graph-up',            color:'#198754', vigencia_dias:null, regla:null, codigo:'INF-01' },
  { id:'inf_ejec_egresos',   nombre:'Ejecuci\u00f3n Presupuestal de Egresos', etapa:'inf', orden:91, icon:'bi-graph-down',          color:'#dc3545', vigencia_dias:null, regla:null, codigo:'INF-02' },
  { id:'inf_pac_ejecutado',  nombre:'PAC Ejecutado',                    etapa:'inf', orden:92, icon:'bi-calendar-check',      color:'#0d6efd', vigencia_dias:null, regla:null, codigo:'INF-03' },
  { id:'inf_relacion_gastos',nombre:'Relaci\u00f3n de Gastos',               etapa:'inf', orden:93, icon:'bi-list-columns',        color:'#fd7e14', vigencia_dias:null, regla:null, codigo:'INF-04' },
  { id:'inf_cierre_anual',   nombre:'Cierre Presupuestal Anual',        etapa:'inf', orden:94, icon:'bi-archive',             color:'#6f42c1', vigencia_dias:null, regla:null, codigo:'INF-05' },
  { id:'inf_contraloria',    nombre:'Reporte Contralor\u00eda',              etapa:'inf', orden:95, icon:'bi-shield-check',        color:'#0d6efd', vigencia_dias:null, regla:null, codigo:'INF-06' },
  { id:'inf_pac_anual',      nombre:'PAC Anual',                        etapa:'inf', orden:96, icon:'bi-calendar3',           color:'#17a2b8', vigencia_dias:null, regla:null, codigo:'INF-07' },
  { id:'inf_conciliacion',   nombre:'Conciliaci\u00f3n Presupuesto-Contabilidad',etapa:'inf',orden:97,icon:'bi-arrows-collapse',  color:'#6c757d', vigencia_dias:null, regla:null, codigo:'INF-08' },

  // Certificados FSE por trimestre (Secretar\u00eda de Educaci\u00f3n)
  { id:'inf_cert_t1',        nombre:'Certificado FSE Paz y Salvo - T1',  etapa:'inf', orden:98, icon:'bi-patch-check',         color:'#198754', vigencia_dias:null, regla:null, codigo:'INF-09' },
  { id:'inf_reporte_t1',     nombre:'Reporte Consolidado FSE - T1',      etapa:'inf', orden:98.5,icon:'bi-file-earmark-spreadsheet',color:'#0d6efd', vigencia_dias:null, regla:null, codigo:'INF-10' },
  { id:'inf_cert_t2',        nombre:'Certificado FSE Paz y Salvo - T2',  etapa:'inf', orden:99, icon:'bi-patch-check',         color:'#198754', vigencia_dias:null, regla:null, codigo:'INF-11' },
  { id:'inf_reporte_t2',     nombre:'Reporte Consolidado FSE - T2',      etapa:'inf', orden:99.5,icon:'bi-file-earmark-spreadsheet',color:'#0d6efd', vigencia_dias:null, regla:null, codigo:'INF-12' },
  { id:'inf_cert_t3',        nombre:'Certificado FSE Paz y Salvo - T3',  etapa:'inf', orden:100,icon:'bi-patch-check',         color:'#198754', vigencia_dias:null, regla:null, codigo:'INF-13' },
  { id:'inf_reporte_t3',     nombre:'Reporte Consolidado FSE - T3',      etapa:'inf', orden:100.5,icon:'bi-file-earmark-spreadsheet',color:'#0d6efd', vigencia_dias:null, regla:null, codigo:'INF-14' },
  { id:'inf_cert_t4',        nombre:'Certificado FSE Paz y Salvo - T4',  etapa:'inf', orden:101,icon:'bi-patch-check',         color:'#198754', vigencia_dias:null, regla:null, codigo:'INF-15' },
  { id:'inf_reporte_t4',     nombre:'Reporte Consolidado FSE - T4',      etapa:'inf', orden:101.5,icon:'bi-file-earmark-spreadsheet',color:'#0d6efd', vigencia_dias:null, regla:null, codigo:'INF-16' },

  // \u2500\u2500 BLOQUE HC: Hechos Cumplidos (etapa 'hc') \u2500\u2500
  { id:'hc_memorando',       nombre:'Memorando Interno (Contador-Rector)',etapa:'hc', orden:80, icon:'bi-envelope-paper',     color:'#795548', vigencia_dias:null, regla:null, codigo:'HC-01' },
  { id:'hc_comunicacion',    nombre:'Comunicaci\u00f3n al Consejo Directivo', etapa:'hc', orden:81, icon:'bi-megaphone',           color:'#795548', vigencia_dias:null, regla:null, codigo:'HC-02' },
  { id:'hc_solicitud_cdp',   nombre:'Solicitud de CDP HC',              etapa:'hc', orden:82, icon:'bi-file-earmark-arrow-up',color:'#795548', vigencia_dias:null, regla:null, codigo:'HC-03' },
  { id:'hc_estudios_previos',nombre:'Estudios Previos HC',              etapa:'hc', orden:83, icon:'bi-file-earmark-text',  color:'#795548', vigencia_dias:null, regla:null, codigo:'HC-04' },
  { id:'hc_resolucion',      nombre:'Resoluci\u00f3n del Rector',            etapa:'hc', orden:84, icon:'bi-award',               color:'#795548', vigencia_dias:null, regla:null, codigo:'HC-05' },
  { id:'hc_orden_prestacion',nombre:'Orden de Prestaci\u00f3n de Servicios HC', etapa:'hc', orden:85, icon:'bi-file-earmark-check', color:'#795548', vigencia_dias:null, regla:null, codigo:'HC-06' }
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
  { key:'pre', label:'1. Fase Precontractual / Planeaci\u00f3n',   icon:'bi-1-circle-fill', css:'etapa-pre' },
  { key:'sel', label:'2. Documentos del Contratista',         icon:'bi-2-circle-fill', css:'etapa-sel' },
  { key:'con', label:'3. Fase Contractual / Perfeccionamiento',icon:'bi-3-circle-fill', css:'etapa-con' },
  { key:'eje', label:'4. Fase de Ejecuci\u00f3n',                  icon:'bi-4-circle-fill', css:'etapa-eje' },
  { key:'pag', label:'5. Fase de Pago, Liquidaci\u00f3n y Cierre', icon:'bi-5-circle-fill', css:'etapa-pag' },
  { key:'hc',  label:'Hechos Cumplidos (HC)',                 icon:'bi-clipboard2-pulse', css:'etapa-hc' },
  { key:'inf', label:'Informes Anuales (Sec. Educaci\u00f3n)',     icon:'bi-file-earmark-bar-graph', css:'etapa-inf' }
];

const ETAPAS_ADICION = [
  { key:'ant', label:'Documentos Vigencia Original',   icon:'bi-clock-history',  css:'etapa-ant' },
  { key:'adi', label:'Adici\u00f3n / Vigencia Actual',       icon:'bi-plus-circle-fill', css:'etapa-adi' }
];

/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
   MODALIDADES DE PAGO (Ley 80/1993, Ley 1150/2007, Decreto 1082/2015)
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 */
const FORMAS_PAGO = {
  pago_unico: {
    nombre: 'Pago \u00fanico',
    icon: 'bi-cash',
    descripcion: 'Un \u00fanico pago al finalizar la ejecuci\u00f3n del contrato.',
    numPagos: 1,
    generarPeriodos: () => [{ id:'pago_1', numero:1, periodo:'Pago \u00danico', tipo:'unico' }]
  },
  mensual: {
    nombre: 'Pagos mensuales',
    icon: 'bi-calendar-month',
    descripcion: '12 pagos mensuales durante la vigencia del contrato (Enero\u2013Diciembre).',
    numPagos: 12,
    generarPeriodos: (n) => {
      const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const cnt = n || 12;
      return Array.from({length: cnt}, (_,i) => ({
        id:`pago_${i+1}`, numero:i+1, periodo:meses[i] || `Mes ${i+1}`, tipo:'mensual'
      }));
    }
  },
  bimestral: {
    nombre: 'Pagos bimestrales',
    icon: 'bi-calendar2',
    descripcion: '6 pagos bimestrales durante la vigencia (Ene-Feb, Mar-Abr, May-Jun, Jul-Ago, Sep-Oct, Nov-Dic).',
    numPagos: 6,
    generarPeriodos: (n) => {
      const bims = ['Ene-Feb','Mar-Abr','May-Jun','Jul-Ago','Sep-Oct','Nov-Dic'];
      const cnt = n || 6;
      return Array.from({length: cnt}, (_,i) => ({
        id:`pago_${i+1}`, numero:i+1, periodo:`Bimestre ${i+1} (${bims[i] || '?'})`, tipo:'bimestral'
      }));
    }
  },
  trimestral: {
    nombre: 'Pagos trimestrales',
    icon: 'bi-calendar3',
    descripcion: '4 pagos trimestrales durante la vigencia (T-I, T-II, T-III, T-IV).',
    numPagos: 4,
    generarPeriodos: (n) => {
      const trims = ['Ene-Mar','Abr-Jun','Jul-Sep','Oct-Dic'];
      const romanos = ['I','II','III','IV','V','VI','VII','VIII'];
      const cnt = n || 4;
      return Array.from({length: cnt}, (_,i) => ({
        id:`pago_${i+1}`, numero:i+1, periodo:`Trimestre ${romanos[i]} (${trims[i] || '?'})`, tipo:'trimestral'
      }));
    }
  },
  semestral: {
    nombre: 'Pagos semestrales',
    icon: 'bi-calendar-range',
    descripcion: '2 pagos semestrales (Ene-Jun, Jul-Dic).',
    numPagos: 2,
    generarPeriodos: (n) => {
      const sems = ['Ene-Jun','Jul-Dic'];
      const cnt = n || 2;
      return Array.from({length: cnt}, (_,i) => ({
        id:`pago_${i+1}`, numero:i+1, periodo:`Semestre ${['I','II'][i] || (i+1)} (${sems[i] || '?'})`, tipo:'semestral'
      }));
    }
  },
  anticipo_saldo: {
    nombre: 'Anticipos y saldo',
    icon: 'bi-cash-coin',
    descripcion: 'Un anticipo al inicio y saldo contra entrega/liquidaci\u00f3n (Art. 40 Ley 80/1993).',
    numPagos: 2,
    generarPeriodos: (n, pct) => {
      const anticipo = pct || 50;
      return [
        { id:'pago_1', numero:1, periodo:`Anticipo (${anticipo}%)`, tipo:'anticipo' },
        { id:'pago_2', numero:2, periodo:`Saldo (${100-anticipo}%)`, tipo:'saldo' }
      ];
    }
  },
  avance: {
    nombre: 'Pagos parciales por avance',
    icon: 'bi-graph-up-arrow',
    descripcion: 'Pagos seg\u00fan avance f\u00edsico/porcentual de la obra o servicio. Se agregan manualmente.',
    numPagos: 0,
    generarPeriodos: () => []
  },
  otro: {
    nombre: 'Otra forma de pago',
    icon: 'bi-three-dots',
    descripcion: 'Modalidad especial. Los pagos se agregan libremente.',
    numPagos: 0,
    generarPeriodos: () => []
  }
};

// Documentos que se repiten POR CADA PAGO (soportes contables/legales)
// ORDEN: OPCI\u00d3N C - Auditor\u00eda/Contralor\u00eda FOSE
// Primero verifica CUMPLIMIENTO (docs 1-5), luego AUTORIZACI\u00d3N y EJECUCI\u00d3N del pago (docs 6-8)
// Base legal: Art. 617 ET (factura), Ley 42/1993 (control fiscal), Ley 100 Art.282 (PILA),
// Ley 1474/2011 Art. 82-84 (supervisi\u00f3n), Decreto 1082/2015 (acta recibo)
const DOCS_POR_PAGO = [
  { id:'factura',            nombre:'Factura / Cuenta de Cobro', icon:'bi-receipt-cutoff', color:'#dc3545', codigo:'EJE-02', requerido:true },
  { id:'acta_recibido',      nombre:'Acta de Recibo a Satisfacci\u00f3n', icon:'bi-check2-square', color:'#6c757d', codigo:'EJE-05', requerido:true },
  { id:'informe_supervisor', nombre:'Informe de Supervisi\u00f3n',    icon:'bi-clipboard-check', color:'#6c757d', codigo:'EJE-04', requerido:true },
  { id:'informe_contratista',nombre:'Informe del Contratista',   icon:'bi-file-earmark-person', color:'#dc3545', codigo:'EJE-03', requerido:true },
  { id:'seguridad_social',   nombre:'Seguridad Social (PILA)',   icon:'bi-heart-pulse', color:'#20c997', codigo:'DOC-10', requerido:true },
  { id:'orden_pago',         nombre:'Orden de Pago',             icon:'bi-cash-coin', color:'#343a40', codigo:'PAG-01', requerido:true },
  { id:'egreso',             nombre:'Comprobante de Egreso',     icon:'bi-receipt', color:'#343a40', codigo:'PAG-02', requerido:true },
  { id:'soporte_pago',       nombre:'Soporte de Pago Bancario',  icon:'bi-bank', color:'#198754', codigo:'PAG-04', requerido:true }
];

// Habilitantes OPCIONALES por pago (renovaci\u00f3n cuando venza la vigencia de 3 meses)
// Se usan cuando: contrato > 3 meses, o cuando la entidad los pide por cada pago,
// o cuando el certificado inicial expir\u00f3 y se debe renovar.
// Base legal: Ley 190/1995 (Polic\u00eda), Ley 734/2002 (Procuradur\u00eda), Ley 610/2000 (Contralor\u00eda),
// Ley 1266/2008 (REDAM), Ley 1918/2018 (Delitos Sexuales), CNP (RNMC)
const HABILITANTES_POR_PAGO = [
  { id:'antec_procuraduria', nombre:'Antecedentes Procuradur\u00eda', icon:'bi-file-earmark-check', color:'#e83e8c', codigo:'DOC-05', vigencia:'3 meses' },
  { id:'antec_contraloria',  nombre:'Antecedentes Contralor\u00eda',  icon:'bi-file-earmark-check', color:'#0d6efd', codigo:'DOC-06', vigencia:'3 meses' },
  { id:'antec_policia',      nombre:'Antecedentes Polic\u00eda',      icon:'bi-shield-check',       color:'#198754', codigo:'DOC-04', vigencia:'3 meses' },
  { id:'redam',              nombre:'REDAM',                     icon:'bi-people',              color:'#6f42c1', codigo:'DOC-08', vigencia:'3 meses' },
  { id:'rnmc',               nombre:'RNMC',                      icon:'bi-exclamation-triangle',color:'#fd7e14', codigo:'DOC-08', vigencia:'3 meses' },
  { id:'delitos_sexuales',   nombre:'Delitos Sexuales',          icon:'bi-shield-x',            color:'#dc3545', codigo:'DOC-07', vigencia:'3 meses' }
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
  // Tipos que permiten múltiples documentos
  const TIPOS_MULTIPLES = ['invitacion', 'cotizaciones', 'carta_propuesta', 'otrosi', 'concepto_favorable_supervisor'];
  const subidosMap = {};
  const subidosMultiMap = {}; // tipo → [doc1, doc2, ...]
  docsSubidos.forEach(d => {
    if(TIPOS_MULTIPLES.includes(d.tipo)){
      if(!subidosMultiMap[d.tipo]) subidosMultiMap[d.tipo] = [];
      subidosMultiMap[d.tipo].push(d);
      // También poner el primero en subidosMap para compatibilidad
      if(!subidosMap[d.tipo]) subidosMap[d.tipo] = d;
    } else {
      subidosMap[d.tipo] = d;
    }
  });

  const esAnterior = (exp.datos && exp.datos.tipo_vigencia === 'anterior');
  const docsCatalogo = esAnterior ? [...DOC_TIPOS, ...DOC_TIPOS_ADICION] : DOC_TIPOS;
  const totalRequeridos = docsCatalogo.length;
  // Separar docs sin pago_id (regulares) y con pago_id (de pagos periódicos)
  const docsRegulares = docsSubidos.filter(d => !d.pago_id);
  const docsDePagos = docsSubidos.filter(d => d.pago_id);
  // Contar tipos únicos de docs regulares (dedup para catalogo)
  const tiposSubidos = new Set(docsRegulares.filter(d => docsCatalogo.find(t => t.id === d.tipo)).map(d => d.tipo));
  const totalSubidos = tiposSubidos.size;
  // Detectar expediente_completo (cargado via Foliar PDF Completo)
  const tieneExpedienteCompleto = docsSubidos.some(d => d.tipo === 'expediente_completo');
  // Contar extras (que no son expediente_completo ni del catalogo)
  const extrasCount = docsRegulares.filter(d => !docsCatalogo.find(t => t.id === d.tipo) && d.tipo !== 'expediente_completo').length;
  const pct = tieneExpedienteCompleto ? 100 : Math.round((totalSubidos / totalRequeridos) * 100);
  const bloqueado = exp.estado === 'bloqueado';

  // Estadísticas de pagos periódicos
  const totalDocsPagos = docsDePagos.length;
  const totalPeriodos = (exp.datos?.pagos_periodicos || []).length;
  // Total de PÁGINAS de todos los documentos (regulares + pagos + versiones anteriores no cuentan)
  const totalPaginas = docsSubidos.reduce((sum, d) => sum + (Number(d.paginas) || 0), 0);
  const totalDocsGlobal = docsSubidos.length;

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
            <span>
              ${tieneExpedienteCompleto
                ? '<span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i>Expediente completo cargado</span>'
                : `<strong>${totalSubidos}</strong> de <strong>${totalRequeridos}</strong> documentos base`}
              ${extrasCount > 0 ? ` <span class="badge bg-info text-dark ms-1">+${extrasCount} adicional${extrasCount !== 1 ? 'es' : ''}</span>` : ''}
              ${totalDocsPagos > 0 ? ` <span class="badge bg-primary ms-1" title="Documentos en ${totalPeriodos} pago${totalPeriodos !== 1 ? 's' : ''} periódico${totalPeriodos !== 1 ? 's' : ''}"><i class="bi bi-cash-stack me-1"></i>+${totalDocsPagos} de pagos</span>` : ''}
              ${totalDocsGlobal > 0 ? ` <span class="badge bg-dark ms-1" title="Total general: ${totalDocsGlobal} documento${totalDocsGlobal !== 1 ? 's' : ''} con ${totalPaginas} página${totalPaginas !== 1 ? 's' : ''}"><i class="bi bi-file-earmark-text me-1"></i>${totalDocsGlobal} docs · ${totalPaginas} págs</span>` : ''}
            </span>
            <span class="fw-bold" style="color:${pct === 100 ? 'var(--verde)' : pct >= 50 ? 'var(--dorado)' : 'var(--rojo)'}">${pct}%</span>
          </div>
          <div class="progress-bar-exp">
            <div class="fill" style="width:${pct}%;background:${pct === 100 ? 'var(--verde)' : pct >= 50 ? 'var(--dorado)' : 'var(--rojo)'}"></div>
          </div>
        </div>
      </div>
    </div>`;

  // Panel de auditoria (solo si no hay expediente completo cargado)
  const alertas = tieneExpedienteCompleto
    ? { errores: [], advertencias: [], ok: 1 }
    : generarAlertasAuditoria(docsCatalogo, subidosMap, exp);
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
    <label class="btn btn-warning btn-sm fw-bold mb-0" title="Sube PDF y/o HTML, organiza los documentos en orden correcto y folia">
      <i class="bi bi-sort-down me-2"></i>Foliar y Organizar
      <input type="file" accept=".pdf,.html,.htm,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.heic,.heif,.webp" multiple style="display:none" onchange="foliarYOrganizarPDF('${exp.id}', this)">
    </label>
    <button class="btn btn-generar" onclick="generarExpedientePDF('${exp.id}')" ${docsSubidos.length === 0 ? 'disabled' : ''}>
      <i class="bi bi-file-earmark-pdf me-2"></i>Generar Expediente PDF Foliado
    </button>
    ${!bloqueado && docsSubidos.length > 0 ? `<button class="btn btn-outline-danger btn-sm" onclick="borrarTodosDocumentos('${exp.id}')" title="Borra todos los PDFs subidos del expediente (mantiene el expediente)">
      <i class="bi bi-trash3 me-1"></i>Borrar todos los documentos
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
      if(TIPOS_MULTIPLES.includes(doc.id) && subidosMultiMap[doc.id] && subidosMultiMap[doc.id].length > 0){
        // Mostrar múltiples documentos numerados
        subidosMultiMap[doc.id].forEach((subido, i) => {
          const docConNumero = Object.assign({}, doc, { nombre: `${doc.nombre} ${i + 1}` });
          html += renderDocSlot(docConNumero, subido, exp.id, bloqueado, exp);
        });
        // Slot vacío para agregar más
        if(!bloqueado){
          const docMas = Object.assign({}, doc, { nombre: `${doc.nombre} ${subidosMultiMap[doc.id].length + 1}` });
          html += renderDocSlot(docMas, null, exp.id, bloqueado, exp);
        }
      } else {
        const subido = subidosMap[doc.id];
        html += renderDocSlot(doc, subido, exp.id, bloqueado, exp);
      }
    });

    html += `</div></div>`;
  });

  // ═══════════════════════════════════════
  // SECCIÓN: PAGOS PERIÓDICOS (si aplica)
  // ═══════════════════════════════════════
  const formaPago = exp.datos?.forma_pago;
  const cfgFormaPago = formaPago ? FORMAS_PAGO[formaPago] : null;
  if(cfgFormaPago && formaPago !== 'pago_unico'){
    html += renderSeccionPagosPeriodicos(exp, docsSubidos, bloqueado);
  }

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
        if(TIPOS_MULTIPLES.includes(doc.id) && subidosMultiMap[doc.id] && subidosMultiMap[doc.id].length > 0){
          subidosMultiMap[doc.id].forEach((subido, i) => {
            const docConNumero = Object.assign({}, doc, { nombre: `${doc.nombre} ${i + 1}` });
            html += renderDocSlot(docConNumero, subido, exp.id, bloqueado, exp);
          });
          if(!bloqueado){
            const docMas = Object.assign({}, doc, { nombre: `${doc.nombre} ${subidosMultiMap[doc.id].length + 1}` });
            html += renderDocSlot(docMas, null, exp.id, bloqueado, exp);
          }
        } else {
          const subido = subidosMap[doc.id];
          html += renderDocSlot(doc, subido, exp.id, bloqueado, exp);
        }
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
/* ══════════════════════════════════════════
   PAGOS PERIÓDICOS — Render de sección
══════════════════════════════════════════ */
function renderSeccionPagosPeriodicos(exp, docsSubidos, bloqueado){
  const formaPago = exp.datos.forma_pago;
  const cfg = FORMAS_PAGO[formaPago];
  const periodos = exp.datos.pagos_periodicos || [];

  const docsPorPago = {};
  docsSubidos.forEach(d => {
    if(d.pago_id){
      if(!docsPorPago[d.pago_id]) docsPorPago[d.pago_id] = {};
      docsPorPago[d.pago_id][d.tipo] = d;
    }
  });

  const totalDocsEsperados = periodos.length * DOCS_POR_PAGO.length;
  const totalDocsSubidos = periodos.reduce((sum, p) => {
    const pd = docsPorPago[p.id] || {};
    return sum + DOCS_POR_PAGO.filter(dt => pd[dt.id]).length;
  }, 0);
  // Contar TODOS los docs de pagos (requeridos + habilitantes) y páginas totales
  const totalDocsPagosGlobal = docsSubidos.filter(d => d.pago_id).length;
  const totalPaginasPagos = docsSubidos.filter(d => d.pago_id).reduce((s, d) => s + (Number(d.paginas) || 0), 0);

  let html = `<div class="mb-3">
    <div class="etapa-header etapa-pag" style="background:linear-gradient(90deg,#e8f5e9,#c8e6c9)">
      <i class="bi ${cfg.icon} me-1"></i>
      <strong>PAGOS PERIÓDICOS</strong> — ${cfg.nombre}
      <span class="float-end">
        ${totalDocsSubidos}/${totalDocsEsperados} req.
        ${totalDocsPagosGlobal > totalDocsSubidos ? `<span class="text-muted ms-1">(${totalDocsPagosGlobal} total)</span>` : ''}
        <span class="badge bg-dark ms-2"><i class="bi bi-file-earmark-text me-1"></i>${totalPaginasPagos} pág${totalPaginasPagos !== 1 ? 's' : ''}</span>
      </span>
    </div>
    <div class="alert alert-info small py-2 mb-2">
      <i class="bi bi-info-circle me-1"></i>
      Cada pago debe tener sus soportes: factura, orden de pago, egreso, soporte bancario, seguridad social, informes y acta de recibo.
      <br><strong><i class="bi bi-arrow-down-square me-1"></i>Arrastra archivos:</strong>
      a un <strong>slot específico</strong> para subirlo ahí, o al <strong>bloque completo del pago</strong> para que se auto-clasifiquen por nombre.
      ${(formaPago === 'avance' || formaPago === 'otro') ? `
      <br><button class="btn btn-outline-primary btn-sm mt-2" onclick="agregarPagoManual('${exp.id}')" ${bloqueado ? 'disabled' : ''}>
        <i class="bi bi-plus-circle me-1"></i>Agregar nuevo pago
      </button>` : ''}
    </div>`;

  if(periodos.length === 0){
    html += `<div class="alert alert-warning small py-2">
      <i class="bi bi-exclamation-triangle me-1"></i>
      No hay pagos definidos. ${formaPago === 'avance' || formaPago === 'otro'
        ? 'Haz clic en <strong>Agregar nuevo pago</strong> para crear el primero.'
        : 'Reabre el expediente y guarda la modalidad para generar los pagos.'}
    </div>`;
  }

  periodos.forEach(pago => {
    const docsDelPago = docsPorPago[pago.id] || {};
    const cargados = DOCS_POR_PAGO.filter(dt => docsDelPago[dt.id]).length;
    const total = DOCS_POR_PAGO.length;
    const pct = Math.round((cargados / total) * 100);
    const completo = pct === 100;
    // Sumar páginas TOTALES de este pago (incluyendo habilitantes opcionales)
    const paginasDelPago = docsSubidos
      .filter(d => d.pago_id === pago.id)
      .reduce((s, d) => s + (Number(d.paginas) || 0), 0);
    const docsTotalesDelPago = docsSubidos.filter(d => d.pago_id === pago.id).length;

    html += `<div class="card mb-2 shadow-sm pago-card" data-exp-id="${exp.id}" data-pago-id="${pago.id}"
      ondragover="event.preventDefault();this.classList.add('drag-over');"
      ondragleave="this.classList.remove('drag-over');"
      ondrop="event.preventDefault();this.classList.remove('drag-over');manejarDropEnPago('${exp.id}','${pago.id}',event);">
      <div class="card-header py-2"
           style="background:${completo ? '#d4edda' : '#fff3cd'}">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <strong>
              <i class="bi bi-calendar-check me-1"></i>
              PAGO ${String(pago.numero).padStart(2,'0')} — ${pago.periodo}
            </strong>
            ${pago.fecha_pago ? `<span class="ms-2 text-muted small"><i class="bi bi-calendar3 me-1"></i>${pago.fecha_pago}</span>` : ''}
            ${pago.valor_pagado ? `<span class="ms-2 text-muted small"><i class="bi bi-cash me-1"></i>$${Number(pago.valor_pagado).toLocaleString('es-CO')}</span>` : ''}
            ${pago.numero_factura ? `<span class="ms-2 text-muted small"><i class="bi bi-receipt me-1"></i>Fact. ${pago.numero_factura}</span>` : ''}
          </div>
          <div>
            <span class="badge ${completo ? 'bg-success' : 'bg-warning text-dark'}">${cargados}/${total} (${pct}%)</span>
            ${paginasDelPago > 0 ? `<span class="badge bg-dark ms-1" title="${docsTotalesDelPago} documento${docsTotalesDelPago !== 1 ? 's' : ''} en ${paginasDelPago} página${paginasDelPago !== 1 ? 's' : ''}"><i class="bi bi-file-earmark-text me-1"></i>${paginasDelPago} pág${paginasDelPago !== 1 ? 's' : ''}</span>` : ''}
            <button class="btn btn-sm btn-outline-primary ms-1" onclick="imprimirPagoIndividual('${exp.id}','${pago.id}')" title="Generar PDF solo de este pago (portada + índice + soportes foliados)"
                    ${cargados === 0 ? 'disabled' : ''}>
              <i class="bi bi-printer"></i>
            </button>
            ${!bloqueado ? `
            <button class="btn btn-sm btn-outline-secondary ms-1" onclick="editarPagoPeriodo('${exp.id}','${pago.id}')" title="Editar periodo, concepto, fecha, valor y factura">
              <i class="bi bi-pencil"></i>
            </button>
            ${(FORMAS_PAGO[exp.datos.forma_pago].numPagos === 0) ? `
            <button class="btn btn-sm btn-outline-danger ms-1" onclick="eliminarPagoPeriodo('${exp.id}','${pago.id}')" title="Eliminar este pago">
              <i class="bi bi-trash"></i>
            </button>` : ''}
            ` : ''}
          </div>
        </div>
        ${pago.concepto ? `<div class="small text-dark mt-1 fst-italic"><i class="bi bi-quote me-1"></i>${pago.concepto}</div>` : `<div class="small text-danger mt-1"><i class="bi bi-exclamation-circle me-1"></i>Falta concepto del pago — haz click en ✏️ para agregarlo</div>`}
      </div>
      <div class="card-body p-2">
        <div class="row g-2">`;

    DOCS_POR_PAGO.forEach(docTipo => {
      const subido = docsDelPago[docTipo.id];
      html += renderDocSlotPago(docTipo, subido, exp.id, pago.id, bloqueado);
    });

    html += `</div>`;

    // ─── Sección OPCIONAL: Habilitantes actualizados ───
    const habilitantesCargados = HABILITANTES_POR_PAGO.filter(dt => docsDelPago[dt.id]).length;
    html += `<div class="mt-3 pt-2 border-top">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <div class="small fw-bold text-muted">
          <i class="bi bi-shield-lock me-1"></i>HABILITANTES ACTUALIZADOS (opcional)
          <span class="badge bg-info ms-1" style="font-weight:normal">${habilitantesCargados}/${HABILITANTES_POR_PAGO.length}</span>
        </div>
        <button class="btn btn-sm btn-link p-0 text-decoration-none small"
                onclick="toggleHabilitantesPago('${pago.id}')" id="btn-hab-${pago.id}">
          ${habilitantesCargados > 0 ? '▼ Ocultar' : '▶ Mostrar'}
        </button>
      </div>
      <div class="small text-muted mb-2" style="font-size:0.75rem">
        <i class="bi bi-info-circle me-1"></i>Solo requeridos si el contrato dura más de 3 meses (vigencia de certificados)
        o si tu entidad los exige por cada pago.
      </div>
      <div id="habilitantes-${pago.id}" class="row g-2" style="display:${habilitantesCargados > 0 ? 'flex' : 'none'}">`;

    HABILITANTES_POR_PAGO.forEach(docTipo => {
      const subido = docsDelPago[docTipo.id];
      html += renderDocSlotPagoOpcional(docTipo, subido, exp.id, pago.id, bloqueado);
    });

    html += `</div></div>`;
    html += `</div></div>`;
  });

  html += `</div>`;
  return html;
}

function renderDocSlotPagoOpcional(docTipo, subido, expId, pagoId, bloqueado){
  const uploaded = subido ? ' uploaded' : '';
  const inputId = `input-hab-${pagoId}-${docTipo.id}`;
  const dropAttrs = !bloqueado && !subido
    ? `ondragover="event.preventDefault();event.stopPropagation();this.classList.add('drag-slot');"
       ondragleave="this.classList.remove('drag-slot');"
       ondrop="event.preventDefault();event.stopPropagation();this.classList.remove('drag-slot');manejarDropEnSlot('${expId}','${pagoId}','${docTipo.id}',event);"`
    : '';
  return `
    <div class="col-md-6 col-lg-4">
      <div class="doc-slot p-2 border rounded${uploaded}" style="min-height:60px;background:${subido ? '#e8f5e9' : '#fdfdfd'};border-style:dashed !important" ${dropAttrs}>
        <div class="d-flex align-items-start" style="gap:6px">
          <i class="bi ${docTipo.icon}" style="color:${docTipo.color};font-size:1rem"></i>
          <div class="flex-grow-1" style="min-width:0">
            <div class="fw-bold small text-truncate" title="${docTipo.nombre}">${docTipo.nombre}</div>
            <div class="small text-muted" style="font-size:0.7rem">${docTipo.codigo} • Vig. ${docTipo.vigencia}</div>
            ${subido ? `
              <div class="mt-1">
                <span class="badge bg-success small"><i class="bi bi-check-circle me-1"></i>Actualizado</span>
                ${!bloqueado ? `<button class="btn btn-sm btn-link text-danger p-0 ms-1"
                  onclick="quitarDocPago('${expId}','${pagoId}','${docTipo.id}')" title="Quitar"><i class="bi bi-x-circle"></i></button>` : ''}
              </div>
            ` : (!bloqueado ? `
              <label for="${inputId}" class="btn btn-sm btn-outline-secondary mt-1 py-0 px-2" style="font-size:0.7rem">
                <i class="bi bi-upload me-1"></i>Subir
              </label>
              <input type="file" id="${inputId}" style="display:none"
                     accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp"
                     onchange="subirDocPago('${expId}','${pagoId}','${docTipo.id}',this.files[0])">
            ` : '')}
          </div>
        </div>
      </div>
    </div>`;
}

function toggleHabilitantesPago(pagoId){
  const div = document.getElementById(`habilitantes-${pagoId}`);
  const btn = document.getElementById(`btn-hab-${pagoId}`);
  if(!div || !btn) return;
  const visible = div.style.display !== 'none';
  div.style.display = visible ? 'none' : 'flex';
  btn.textContent = visible ? '▶ Mostrar' : '▼ Ocultar';
}

function renderDocSlotPago(docTipo, subido, expId, pagoId, bloqueado){
  const uploaded = subido ? ' uploaded' : '';
  const inputId = `input-pago-${pagoId}-${docTipo.id}`;
  const dropAttrs = !bloqueado
    ? `ondragover="event.preventDefault();event.stopPropagation();this.classList.add('drag-slot');"
       ondragleave="this.classList.remove('drag-slot');"
       ondrop="event.preventDefault();event.stopPropagation();this.classList.remove('drag-slot');manejarDropEnSlot('${expId}','${pagoId}','${docTipo.id}',event);"`
    : '';
  const numVersionesAnteriores = subido?.versiones_anteriores?.length || 0;
  const versionActual = numVersionesAnteriores + 1;
  const tieneVersiones = numVersionesAnteriores > 0;
  return `
    <div class="col-md-6 col-lg-3">
      <div class="doc-slot p-2 border rounded${uploaded}" style="min-height:70px;background:${subido ? '#e8f5e9' : '#f8f9fa'}" ${dropAttrs}>
        <div class="d-flex align-items-start" style="gap:6px">
          <i class="bi ${docTipo.icon}" style="color:${docTipo.color};font-size:1.2rem"></i>
          <div class="flex-grow-1" style="min-width:0">
            <div class="fw-bold small text-truncate" title="${docTipo.nombre}">
              ${docTipo.nombre}
              ${tieneVersiones ? `<span class="badge bg-primary ms-1" style="font-size:0.6rem" title="Versión actual (${numVersionesAnteriores} anteriores)">v${versionActual}</span>` : ''}
            </div>
            <div class="small text-muted">${docTipo.codigo}</div>
            ${subido ? `
              <div class="mt-1">
                <span class="badge bg-success small"><i class="bi bi-check-circle me-1"></i>Cargado</span>
                ${tieneVersiones ? `<button class="btn btn-sm btn-link text-primary p-0 ms-1"
                  onclick="verVersionesDoc('${expId}','${pagoId}','${docTipo.id}')" title="Ver ${numVersionesAnteriores} versión${numVersionesAnteriores>1?'es':''} anterior${numVersionesAnteriores>1?'es':''}"><i class="bi bi-clock-history"></i></button>` : ''}
                ${!bloqueado ? `<label for="${inputId}" class="btn btn-sm btn-link text-warning p-0 ms-1" title="Reemplazar con nueva versión" style="cursor:pointer">
                  <i class="bi bi-arrow-repeat"></i>
                </label>
                <input type="file" id="${inputId}" style="display:none"
                       accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp"
                       onchange="subirDocPago('${expId}','${pagoId}','${docTipo.id}',this.files[0])">` : ''}
                ${!bloqueado ? `<button class="btn btn-sm btn-link text-danger p-0 ms-1"
                  onclick="quitarDocPago('${expId}','${pagoId}','${docTipo.id}')" title="Quitar"><i class="bi bi-x-circle"></i></button>` : ''}
              </div>
            ` : (!bloqueado ? `
              <label for="${inputId}" class="btn btn-sm btn-outline-primary mt-1 py-0 px-2" style="font-size:0.75rem">
                <i class="bi bi-upload me-1"></i>Subir
              </label>
              <input type="file" id="${inputId}" style="display:none"
                     accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp"
                     onchange="subirDocPago('${expId}','${pagoId}','${docTipo.id}',this.files[0])">
            ` : '<span class="badge bg-secondary small">Bloqueado</span>')}
          </div>
        </div>
      </div>
    </div>`;
}

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
    ? `<button class="btn btn-outline-success btn-sm py-0 px-1" onclick="descargarDocumento('${subido.id}')" title="Descargar"><i class="bi bi-download"></i></button>
       <button class="btn btn-outline-danger btn-sm py-0 px-1" onclick="quitarDocumento('${subido.id}','${expId}')" title="Quitar"><i class="bi bi-x-lg"></i></button>
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
    : `<button class="btn btn-outline-success btn-sm py-0 px-1" onclick="descargarDocumento('${doc.id}')" title="Descargar"><i class="bi bi-download"></i></button>
       <button class="btn btn-outline-danger btn-sm py-0 px-1" onclick="quitarDocumento('${doc.id}','${expId}')" title="Quitar"><i class="bi bi-x-lg"></i></button>`;

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
