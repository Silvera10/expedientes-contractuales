/* ══════════════════════════════════════════════════════════
   EXPEDIENTES CONTRACTUALES — PDF Splitter
   Lee un PDF completo, detecta cada documento por palabras
   clave y permite separarlo automáticamente.
   Usa pdf.js (Mozilla) para extraer texto de cada página.
══════════════════════════════════════════════════════════ */

/* ── Palabras clave para detectar cada tipo de documento ── */
const DETECTOR_REGLAS = [
  // ═══════════════════════════════════════
  // FASE PRECONTRACTUAL
  // ═══════════════════════════════════════
  {
    tipo: 'cert_plan_compras',
    nombre: 'Certificación Plan de Compras',
    palabras: ['pre-01', 'plan de compras', 'certificación plan de compras', 'certificacion plan de compras', 'plan anual de adquisiciones', 'plan de adquisiciones', 'necesidad incluida en el plan anual', 'línea paa', 'linea paa', 'según línea paa', 'segun linea paa'],
    peso: 3
  },
  {
    tipo: 'estudio_previo',
    nombre: 'Estudio Previo / Necesidad',
    palabras: ['pre-02', 'estudio previo', 'estudios previos', 'estudio de necesidad', 'análisis del sector', 'analisis del sector', 'justificación de la contratación', 'justificacion de la contratacion', 'necesidad según línea paa', 'necesidad segun linea paa'],
    peso: 3
  },
  {
    tipo: 'solicitud_cdp',
    nombre: 'Solicitud de CDP',
    palabras: ['pre-03', 'solicitud de cdp', 'solicitud de disponibilidad', 'solicitud certificado de disponibilidad', 'solicitar cdp', 'solicitud disponibilidad presupuestal', 'se solicita expedir cdp', 'solicito expedir'],
    peso: 3
  },
  {
    tipo: 'cdp',
    nombre: 'CDP',
    palabras: ['pre-04', 'certificado de disponibilidad presupuestal', 'disponibilidad presupuestal', 'cdp no', 'cdp n°', 'cdp n.°', 'cdp numero', 'amparado con cdp'],
    peso: 3
  },
  {
    tipo: 'invitacion',
    nombre: 'Invitación a Ofertar',
    palabras: ['pre-05', 'invitación a ofertar', 'invitacion a ofertar', 'invitación a cotizar', 'invitacion a cotizar', 'invitación pública', 'invitacion publica', 'solicitud de cotización', 'solicitud de cotizacion', 'invita respetuosamente a presentar', 'proceso de mínima cuantía', 'proceso de minima cuantia', 'invita de manera general', 'presentar oferta', 'presentar cotización', 'presentar cotizacion', 'cronograma del proceso', 'requisitos habilitantes', 'régimen especial', 'regimen especial', 'decreto 4791', 'fondo de servicios educativos', 'ley de garantías', 'ley de garantias', 'presupuesto oficial', 'forma de pago', 'criterio de selección', 'criterio de seleccion'],
    peso: 2
  },
  {
    tipo: 'cotizaciones',
    nombre: 'Cotización(es)',
    palabras: ['pre-06', 'cotización', 'cotizacion', 'propuesta económica', 'propuesta economica', 'oferta económica', 'oferta economica', 'oferta o propuesta económica', 'oferta o propuesta economica', 'carta de presentación de oferta', 'carta de presentacion de oferta', 'valor de la propuesta', 'presupuesto de'],
    peso: 2
  },
  {
    tipo: 'carta_propuesta',
    nombre: 'Carta de Propuesta',
    palabras: ['pre-07', 'carta de respuesta', 'respuesta a invitación', 'respuesta a invitacion', 'carta de presentación', 'carta de presentacion', 'propuesta de servicios', 'carta de presentación de oferta', 'carta de presentacion de oferta', 'aceptación de condiciones', 'aceptacion de condiciones', 'escrito de aceptación', 'escrito de aceptacion'],
    peso: 3
  },
  {
    tipo: 'evaluacion',
    nombre: 'Evaluación de Ofertas',
    palabras: ['pre-08', 'evaluación de oferta', 'evaluacion de oferta', 'evaluación de ofertas', 'evaluacion de ofertas', 'evaluación de propuestas', 'evaluacion de propuestas', 'propuestas recibidas y evaluación', 'propuestas recibidas y evaluacion', 'verificación de requisitos habilitantes', 'verificacion de requisitos habilitantes', 'conclusiones de la evaluación', 'conclusiones de la evaluacion', 'se recomienda su selección', 'se recomienda su seleccion', 'seleccionado', 'metodología de evaluación', 'metodologia de evaluacion', 'informe de evaluación', 'informe de evaluacion', 'cuadro comparativo'],
    peso: 3
  },
  {
    tipo: 'aceptacion',
    nombre: 'Aceptación de Oferta',
    palabras: ['pre-09', 'aceptación de oferta', 'aceptacion de oferta', 'aceptación de la oferta', 'aceptacion de la oferta', 'adjudicación', 'adjudicacion', 'se acepta la oferta', 'comunicación de aceptación', 'comunicacion de aceptacion'],
    peso: 3
  },

  // ═══════════════════════════════════════
  // DOCUMENTOS DEL CONTRATISTA
  // ═══════════════════════════════════════
  {
    tipo: 'rut',
    nombre: 'RUT',
    palabras: ['doc-01', 'registro único tributario', 'registro unico tributario', 'dirección seccional', 'direccion seccional', 'actividad económica principal', 'actividad economica principal', 'dian', 'formulario del registro', 'responsabilidades tributarias', 'rut', 'nit', 'régimen tributario', 'regimen tributario', 'clasificación industrial', 'clasificacion industrial'],
    peso: 3
  },
  {
    tipo: 'cedula',
    nombre: 'Cédula',
    palabras: ['doc-02', 'cédula de ciudadanía', 'cedula de ciudadania', 'república de colombia', 'republica de colombia', 'registraduría', 'registraduria', 'identificación personal', 'identificacion personal', 'documento de identidad', 'fotocopia documento', 'cédula', 'cedula', 'número de identificación', 'numero de identificacion'],
    peso: 3
  },
  {
    tipo: 'antec_policia',
    nombre: 'Antecedentes Policía',
    palabras: ['doc-03', 'policía nacional', 'policia nacional', 'antecedentes judiciales', 'certificado judicial', 'no registra antecedentes', 'consulta en línea de antecedentes penales', 'consulta en linea de antecedentes penales', 'requerimientos judiciales', 'no tiene asuntos pendientes con las autoridades judiciales', 'antecedentes penales', 'antecedentes.policia.gov.co', 'dijin', 'artículo 248', 'articulo 248'],
    peso: 3
  },
  {
    tipo: 'antec_procuraduria',
    nombre: 'Antecedentes Procuraduría',
    palabras: ['doc-04', 'procuraduría general', 'procuraduria general', 'certificado de antecedentes disciplinarios', 'antecedentes disciplinarios', 'siri', 'procuraduría general de la nación', 'procuraduria general de la nacion', 'no registra sanciones ni inhabilidades vigentes', 'certificado de antecedentes', 'certificado ordinario', 'registro de sanciones e inhabilidades', 'procuraduria.gov.co'],
    peso: 3
  },
  {
    tipo: 'antec_contraloria',
    nombre: 'Antecedentes Contraloría',
    palabras: ['doc-05', 'contraloría general', 'contraloria general', 'antecedentes fiscales', 'certificado de antecedentes fiscales', 'responsabilidad fiscal', 'paz y salvo fiscal', 'boletín de responsables fiscales', 'boletin de responsables fiscales', 'no se encuentra reportado como responsable fiscal', 'sibor', 'contraloría delegada', 'contraloria delegada', 'intervención judicial y cobro coactivo', 'intervencion judicial y cobro coactivo'],
    peso: 3
  },
  {
    tipo: 'medidas_correctivas',
    nombre: 'Medidas Correctivas',
    palabras: ['doc-06', 'medidas correctivas', 'registro nacional de medidas', 'rnmc', 'código nacional de policía', 'codigo nacional de policia', 'convivencia', 'registro nacional de medidas correctivas', 'código de policía', 'codigo de policia', 'no tiene medidas correctivas pendientes por cumplir', 'consulta ciudadano', 'ley 1801 de 2016', 'código nacional de seguridad', 'codigo nacional de seguridad', 'srvcnpc.policia.gov.co', 'consulta rnmc'],
    peso: 3
  },
  {
    tipo: 'inhabilidades',
    nombre: 'Consulta de Inhabilidades',
    palabras: ['doc-07', 'consulta de inhabilidades', 'inhabilidades para contratar', 'registro de inhabilidades', 'certificado inhabilidades', 'no estar incurso en inhabilidad', 'inhabilidades por delitos sexuales', 'delitos sexuales contra menores'],
    peso: 3
  },
  {
    tipo: 'redeam',
    nombre: 'REDEAM',
    palabras: ['doc-08', 'redeam', 'redam', 'registro de deudores alimentarios', 'deudores alimentarios morosos', 'obligaciones alimentarias', 'icbf', 'no tener anotación en el registro', 'no tener anotacion en el registro'],
    peso: 3
  },
  {
    tipo: 'camara_comercio',
    nombre: 'Cámara de Comercio',
    palabras: ['doc-11', 'cámara de comercio', 'camara de comercio', 'certificado de existencia', 'representación legal', 'representacion legal', 'matrícula mercantil', 'matricula mercantil', 'registro mercantil', 'establecimiento de comercio', 'existencia y representación legal', 'existencia y representacion legal', 'renovación de la matrícula', 'renovacion de la matricula', 'persona natural comerciante', 'actividad comercial', 'rues', 'registro único empresarial', 'registro unico empresarial', 'confecámaras', 'confecamaras'],
    peso: 3
  },
  {
    tipo: 'habeas_data',
    nombre: 'Habeas Data',
    palabras: ['doc-09', 'habeas data', 'tratamiento de datos personales', 'datos personales', 'autorización de datos', 'autorizacion de datos', 'protección de datos', 'proteccion de datos', 'ley 1581', 'autorización tratamiento de datos', 'autorizacion tratamiento de datos', 'autoriza el tratamiento y publicidad'],
    peso: 3
  },
  {
    tipo: 'seguridad_social',
    nombre: 'Seguridad Social',
    palabras: ['doc-10', 'seguridad social', 'planilla integrada', 'pila', 'aportes parafiscales', 'afiliación vigente', 'afiliacion vigente', 'constancia de afiliación', 'constancia de afiliacion', 'planilla de pago', 'riesgos laborales', 'sistema general de seguridad social', 'sgss'],
    peso: 3
  },

  // ═══════════════════════════════════════
  // FASE CONTRACTUAL
  // ═══════════════════════════════════════
  {
    tipo: 'contrato',
    nombre: 'Contrato Firmado',
    palabras: ['con-01', 'contrato de prestación de servicios', 'contrato de prestacion de servicios', 'contrato de compraventa', 'contrato de suministro', 'entre los suscritos', 'hemos convenido en celebrar', 'cláusula primera', 'clausula primera', 'cláusula segunda', 'clausula segunda', 'cláusula tercera', 'clausula tercera', 'contrato n°', 'contrato n.°', 'contrato no.', 'obligaciones del contratista', 'duración del contrato', 'valor y forma de pago', 'causales de terminación', 'causales de terminacion', 'solución de controversias', 'solucion de controversias', 'domicilio contractual', 'perfeccionamiento del contrato'],
    peso: 3
  },
  {
    tipo: 'rp',
    nombre: 'Registro Presupuestal',
    palabras: ['con-02', 'registro presupuestal', 'rp no', 'rp n°', 'rp n.°', 'rp numero', 'certificado de registro presupuestal', 'compromiso presupuestal'],
    peso: 3
  },
  {
    tipo: 'acta_inicio',
    nombre: 'Acta de Inicio',
    palabras: ['con-03', 'acta de inicio', 'acta de iniciación', 'acta de iniciacion', 'inicio del contrato', 'se da inicio', 'fecha de inicio del contrato'],
    peso: 3
  },

  // ═══════════════════════════════════════
  // FASE EJECUCIÓN
  // ═══════════════════════════════════════
  {
    tipo: 'orden_compra',
    nombre: 'Orden de Compra / Servicio',
    palabras: ['eje-01', 'orden de compra', 'orden de compras', 'orden de suministro', 'orden de servicio', 'orden de trabajo'],
    peso: 3
  },
  {
    tipo: 'factura',
    nombre: 'Factura / Cuenta de Cobro',
    palabras: ['eje-02', 'factura de venta', 'factura electrónica', 'factura electronica', 'cuenta de cobro', 'factura no', 'factura n°', 'factura n.°', 'subtotal', 'total a pagar', 'valor neto'],
    peso: 3
  },
  {
    tipo: 'informe_contratista',
    nombre: 'Informe del Contratista',
    palabras: ['eje-03', 'informe del contratista', 'informe de actividades', 'informe de gestión', 'informe de gestion', 'actividades realizadas', 'informe de ejecución', 'informe de ejecucion', 'informe final de actividades'],
    peso: 3
  },
  {
    tipo: 'informe_supervisor',
    nombre: 'Informe de Supervisión',
    palabras: ['eje-04', 'informe de supervisión', 'informe de supervision', 'informe del supervisor', 'certificación de cumplimiento', 'certificacion de cumplimiento', 'el supervisor certifica', 'certifico que el contratista'],
    peso: 3
  },
  {
    tipo: 'acta_recibido',
    nombre: 'Acta Recibo a Satisfacción',
    palabras: ['eje-05', 'acta de recibo', 'recibo a satisfacción', 'recibo a satisfaccion', 'a entera satisfacción', 'a entera satisfaccion', 'recibido a conformidad', 'acta de recibido a satisfacción', 'acta de recibido a satisfaccion'],
    peso: 3
  },

  // ═══════════════════════════════════════
  // PAGO Y LIQUIDACIÓN
  // ═══════════════════════════════════════
  {
    tipo: 'orden_pago',
    nombre: 'Orden de Pago',
    palabras: ['pag-01', 'orden de pago', 'orden pago', 'autorización de pago', 'autorizacion de pago', 'solicitud de pago', 'autorizo el pago'],
    peso: 3
  },
  {
    tipo: 'egreso',
    nombre: 'Comprobante de Egreso',
    palabras: ['pag-02', 'comprobante de egreso', 'comprobante egreso', 'egreso no', 'egreso n°', 'egreso n.°', 'comprobante de pago', 'transferencia bancaria', 'pago neto'],
    peso: 3
  },
  {
    tipo: 'acta_liquidacion',
    nombre: 'Acta de Liquidación',
    palabras: ['pag-03', 'acta de liquidación', 'acta de liquidacion', 'liquidación del contrato', 'liquidacion del contrato', 'balance financiero del contrato', 'liquidación bilateral', 'liquidacion bilateral'],
    peso: 3
  },

  // ═══════════════════════════════════════
  // VIGENCIA ANTERIOR / ADICIÓN
  // ═══════════════════════════════════════
  {
    tipo: 'cdp_original',
    nombre: 'CDP Original (vigencia anterior)',
    palabras: ['ant-01', 'certificado de disponibilidad presupuestal', 'disponibilidad presupuestal', 'cdp no', 'cdp n°', 'cdp n.°', 'vigencia anterior'],
    peso: 2
  },
  {
    tipo: 'rp_original',
    nombre: 'RP Original (compromiso anterior)',
    palabras: ['ant-02', 'registro presupuestal', 'compromiso presupuestal', 'rp no', 'rp n°', 'rp n.°', 'vigencia anterior'],
    peso: 2
  },
  {
    tipo: 'contrato_original',
    nombre: 'Contrato Original (vigencia anterior)',
    palabras: ['ant-03', 'contrato de prestación de servicios', 'contrato de prestacion de servicios', 'contrato de compraventa', 'contrato de suministro', 'vigencia anterior'],
    peso: 2
  },
  {
    tipo: 'acuerdo_adicion',
    nombre: 'Acuerdo de Adición / Prórroga',
    palabras: ['adi-01', 'acuerdo de adición', 'acuerdo de adicion', 'adición al contrato', 'adicion al contrato', 'prórroga', 'prorroga', 'otro sí', 'otro si', 'otrosí', 'otrosi', 'modificatorio'],
    peso: 3
  },
  {
    tipo: 'cdp_adicion',
    nombre: 'CDP Adición (vigencia actual)',
    palabras: ['adi-02', 'certificado de disponibilidad presupuestal', 'disponibilidad presupuestal', 'cdp no', 'cdp n°', 'cdp n.°', 'adición', 'adicion'],
    peso: 2
  },
  {
    tipo: 'rp_adicion',
    nombre: 'RP Adición (vigencia actual)',
    palabras: ['adi-03', 'registro presupuestal', 'compromiso presupuestal', 'rp no', 'rp n°', 'rp n.°', 'adición', 'adicion'],
    peso: 2
  },
  {
    tipo: 'cert_cuenta_pagar',
    nombre: 'Certificación Cuenta por Pagar',
    palabras: ['adi-04', 'cuenta por pagar', 'cuentas por pagar', 'certificación de cuenta', 'certificacion de cuenta', 'rezago presupuestal', 'reserva presupuestal', 'vigencia expirada'],
    peso: 3
  }
];

/* ══════════════════════════════════════════
   ESTADO DEL SPLITTER
══════════════════════════════════════════ */
let _splitterData = {
  pdfBytes: null,       // ArrayBuffer del PDF original
  paginas: [],          // [{num, texto, tipoDetectado, confianza, tipoAsignado}]
  grupos: [],           // [{tipo, nombre, paginaDesde, paginaHasta}]
  expId: null,
  docsGuardados: 0      // Contador de documentos guardados en esta sesión
};

/* Umbral: si el texto extraido tiene menos de estos caracteres, usar OCR */
const OCR_UMBRAL = 30;

/* Worker de Tesseract reutilizable */
let _ocrWorker = null;

async function inicializarOCR(onProgreso){
  if(_ocrWorker) return _ocrWorker;
  try {
    if(typeof Tesseract === 'undefined'){
      console.warn('Tesseract.js no está cargado');
      return null;
    }
    if(onProgreso) onProgreso(0, 0, ' — Inicializando OCR (primera vez, espere)...');
    // Tesseract.js v4 API
    _ocrWorker = await Tesseract.createWorker({
      logger: (m) => {
        if(m.status === 'recognizing text' && onProgreso){
          // progress updates during recognition
        }
      }
    });
    await _ocrWorker.loadLanguage('spa');
    await _ocrWorker.initialize('spa');
    console.log('OCR Worker v4 inicializado correctamente (español)');
    return _ocrWorker;
  } catch(e){
    console.error('Error inicializando OCR:', e);
    // Fallback: intentar sin idioma específico
    try {
      _ocrWorker = await Tesseract.createWorker();
      await _ocrWorker.loadLanguage('eng');
      await _ocrWorker.initialize('eng');
      console.log('OCR Worker inicializado con inglés (fallback)');
      return _ocrWorker;
    } catch(e2){
      console.error('OCR fallback también falló:', e2);
      return null;
    }
  }
}

/* ══════════════════════════════════════════
   PATRONES DE INICIO DE DOCUMENTO
   Si el ENCABEZADO (parte superior) de una página
   contiene alguno de estos patrones, es inicio
   de un documento NUEVO. Si no, es continuación.
══════════════════════════════════════════ */
const DOCUMENT_START_PATTERNS = [
  // Certificados y constancias
  /certificad[oa]\s+de\s+disponibilidad\s+presupuestal/i,
  /certificad[oa]\s+de\s+registro\s+presupuestal/i,
  /certificad[oa]\s+de\s+antecedentes/i,
  /certificad[oa]\s+de\s+existencia/i,
  /certificaci[oó]n\s+plan\s+de\s+compras/i,
  /certificaci[oó]n\s+de\s+cuenta/i,
  /solicitud\s+de\s+cdp/i,
  /solicitud\s+de\s+disponibilidad/i,

  // Títulos de documentos contractuales
  /estudio[s]?\s+previo[s]?/i,
  /invitaci[oó]n\s+a\s+(ofertar|cotizar)/i,
  /invitaci[oó]n\s+p[uú]blica/i,
  /contrato\s+de\s+(prestaci[oó]n|compraventa|suministro|obra)/i,
  /acta\s+de\s+(inicio|liquidaci[oó]n|recib[oi])/i,
  /orden\s+de\s+(pago|compra|servicio|trabajo)/i,
  /informe\s+de\s+(supervisi[oó]n|actividades|gesti[oó]n)/i,
  /informe\s+del\s+(contratista|supervisor)/i,
  /evaluaci[oó]n\s+de\s+(ofertas|propuestas)/i,
  /aceptaci[oó]n\s+de\s+(la\s+)?oferta/i,
  /carta\s+de\s+(propuesta|presentaci[oó]n|respuesta)/i,
  /comprobante\s+de\s+egreso/i,
  /cuenta\s+de\s+cobro/i,
  /factura\s+(de\s+venta|electr[oó]nica)/i,
  /habeas\s+data/i,
  /acuerdo\s+de\s+adici[oó]n/i,

  // Entidades gubernamentales (encabezados de certificados)
  /polic[ií]a\s+nacional/i,
  /procuradur[ií]a\s+general/i,
  /contralor[ií]a\s+general/i,
  /registradur[ií]a/i,
  /c[aá]mara\s+de\s+comercio/i,
  /direcci[oó]n\s+de\s+impuestos/i,
  /registro\s+[uú]nico\s+tributario/i,
  /registro\s+nacional\s+de\s+medidas\s+correctivas/i,
  /consulta\s+de\s+inhabilidades/i,
  /consulta\s+(en\s+l[ií]nea\s+de\s+)?antecedentes/i,
  /redeam|redam/i,
  /rep[uú]blica\s+de\s+colombia/i,

  // Encabezados institucionales (típico inicio de documento)
  /fondo\s+de\s+servicios\s+educativos/i,

  // Documentos numerados
  /cdp\s*(n[°.oº]|no\.?|numero)\s*\d/i,
  /rp\s*(n[°.oº]|no\.?|numero)\s*\d/i,
  /contrato\s*(n[°.oº]|no\.?|numero)\s*\d/i,
  /egreso\s*(n[°.oº]|no\.?|numero)\s*\d/i,

  // Códigos FOSE (PRE-01, CON-01, DOC-01, EJE-01, PAG-01, etc.)
  /\b(PRE|DOC|CON|EJE|PAG|ANT|ADI)-\d{2}\b/,
];

/* ══════════════════════════════════════════
   EXTRAER TEXTO CON POSICIÓN (pdf.js + OCR)
   Separa texto del encabezado (top 20%) del resto
══════════════════════════════════════════ */
async function extraerTextoPaginas(arrayBuffer, onProgreso){
  const copiaParaPdfJs = arrayBuffer.slice(0);
  const pdf = await pdfjsLib.getDocument({ data: copiaParaPdfJs }).promise;
  const totalPags = pdf.numPages;
  const paginas = [];
  let ocrUsado = 0;

  if(onProgreso) onProgreso(0, totalPags, ' — Verificando páginas...');
  const ocrWorker = await inicializarOCR(onProgreso);

  for(let i = 1; i <= totalPags; i++){
    if(onProgreso) onProgreso(i, totalPags, ocrUsado > 0 ? ` (OCR: ${ocrUsado} págs)` : '');
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;

    // Extraer texto con posiciones
    const textContent = await page.getTextContent();
    let textoCompleto = '';
    let textoSuperior = ''; // Top 20% de la página

    const topThreshold = pageHeight * 0.80; // Y >= 80% de la altura = top 20%

    for(const item of textContent.items){
      const str = item.str || '';
      if(!str.trim()) continue;
      textoCompleto += str + ' ';
      const y = item.transform ? item.transform[5] : 0;
      if(y >= topThreshold){
        textoSuperior += str + ' ';
      }
    }

    textoCompleto = textoCompleto.trim();
    textoSuperior = textoSuperior.trim();

    // OCR si hay poco texto
    if(textoCompleto.length < OCR_UMBRAL && ocrWorker){
      try {
        if(onProgreso) onProgreso(i, totalPags, ` — OCR página ${i} de ${totalPags}...`);
        const ocrTexto = await ocrPagina(page, ocrWorker);
        textoCompleto = ocrTexto;
        // Para OCR, tomar las primeras líneas como "superior"
        const lineas = ocrTexto.split('\n');
        textoSuperior = lineas.slice(0, Math.max(3, Math.ceil(lineas.length * 0.2))).join(' ');
        ocrUsado++;
      } catch(e){
        console.warn('OCR falló en página ' + i + ':', e);
      }
    }

    const fechaDetectada = extraerFechaDelTexto(textoCompleto);

    paginas.push({
      num: i,
      texto: textoCompleto.toLowerCase(),
      textoSuperior: textoSuperior.toLowerCase(),
      tipoDetectado: null,
      confianza: 0,
      tipoAsignado: null,
      fechaDetectada,
      esInicio: false // se calcula en pasada 1
    });
  }

  if(onProgreso) onProgreso(totalPags, totalPags, ocrUsado > 0 ? ` — OCR en ${ocrUsado} páginas` : '');
  return paginas;
}

/* ══════════════════════════════════════════
   OCR: Renderizar página a canvas y leer con Tesseract
══════════════════════════════════════════ */
async function ocrPagina(page, worker){
  // Renderizar la página a un canvas temporal con buena resolución
  const scale = 2; // Resolución suficiente para OCR sin ser excesiva
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');

  await page.render({ canvasContext: ctx, viewport }).promise;

  try {
    // Tesseract v4 API: recognize devuelve { data: { text } }
    const result = await worker.recognize(canvas);
    canvas.remove();
    return (result && result.data && result.data.text) ? result.data.text : '';
  } catch(e){
    console.warn('OCR recognize falló:', e);
    canvas.remove();
    return '';
  }
}

/* ══════════════════════════════════════════
   EXTRAER FECHA DEL TEXTO
══════════════════════════════════════════ */
const MESES_MAP = {
  'enero':1,'febrero':2,'marzo':3,'abril':4,'mayo':5,'junio':6,
  'julio':7,'agosto':8,'septiembre':9,'octubre':10,'noviembre':11,'diciembre':12,
  'ene':1,'feb':2,'mar':3,'abr':4,'may':5,'jun':6,
  'jul':7,'ago':8,'sep':9,'oct':10,'nov':11,'dic':12
};

function extraerFechaDelTexto(texto){
  let m;

  // Normalizar espacios múltiples y saltos de línea
  texto = texto.replace(/\s+/g, ' ').trim();

  // Normalizar año de 2 dígitos a 4
  function normAnio(a){
    a = parseInt(a);
    if(a < 100) a += 2000;
    return a;
  }
  function valida(dia, mes, anio){
    return mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31 && anio >= 2020 && anio <= 2035;
  }
  function fmt(dia, mes, anio){
    return `${anio}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
  }

  // Patrón 1: "15 de diciembre de 2025" / "04 de junio del 2025" / "hoy miércoles 04 de junio de 2025"
  m = texto.match(/(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:de\s+|del\s+)?(\d{2,4})/i);
  if(m){
    const dia = parseInt(m[1]), mes = MESES_MAP[m[2].toLowerCase()], anio = normAnio(m[3]);
    if(mes && valida(dia, mes, anio)) return fmt(dia, mes, anio);
  }

  // Patrón 2: "diciembre 15 de 2025"
  m = texto.match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(\d{1,2})[\s,]+(?:de\s+|del\s+)?(\d{2,4})/i);
  if(m){
    const mes = MESES_MAP[m[1].toLowerCase()], dia = parseInt(m[2]), anio = normAnio(m[3]);
    if(mes && valida(dia, mes, anio)) return fmt(dia, mes, anio);
  }

  // Patrón 3: "15/12/2025" o "15-12-2025" o "15/12/25" (4 o 2 dígitos año)
  m = texto.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if(m){
    const dia = parseInt(m[1]), mes = parseInt(m[2]), anio = normAnio(m[3]);
    if(valida(dia, mes, anio)) return fmt(dia, mes, anio);
  }

  // Patrón 4: "2025-12-15" o "2025/12/15" (ISO)
  m = texto.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if(m){
    const anio = parseInt(m[1]), mes = parseInt(m[2]), dia = parseInt(m[3]);
    if(valida(dia, mes, anio)) return fmt(dia, mes, anio);
  }

  // Patrón 5: "Fecha: 15 de diciembre de 2025" o "Fecha Evaluación 17 de diciembre de 2025"
  m = texto.match(/fecha[^:]*[:\s]+(\d{1,2})\s+de\s+(\w+)\s+(?:de\s+|del\s+)?(\d{2,4})/i);
  if(m){
    const dia = parseInt(m[1]), mes = MESES_MAP[m[2].toLowerCase()], anio = normAnio(m[3]);
    if(mes && valida(dia, mes, anio)) return fmt(dia, mes, anio);
  }

  // Patrón 6: "Bogotá DC, 04 de junio del 2025" o "hoy miércoles 04 de junio de 2025"
  m = texto.match(/(\d{1,2})\s+de\s+(\w+)\s+(?:de\s+|del\s+)?(\d{2,4})/i);
  if(m){
    const dia = parseInt(m[1]), mes = MESES_MAP[m[2].toLowerCase()], anio = normAnio(m[3]);
    if(mes && valida(dia, mes, anio)) return fmt(dia, mes, anio);
  }

  // Patrón 7: "4/6/25, 9:03" (formato corto con hora, común en impresiones web)
  m = texto.match(/(\d{1,2})[\/](\d{1,2})[\/](\d{2})[,\s]/);
  if(m){
    const dia = parseInt(m[1]), mes = parseInt(m[2]), anio = normAnio(m[3]);
    if(valida(dia, mes, anio)) return fmt(dia, mes, anio);
  }

  return null;
}

/* ══════════════════════════════════════════
   PATRONES DE ENTIDADES GUBERNAMENTALES
   Estos aparecen frecuentemente en tablas de
   requisitos dentro de invitaciones/estudios previos.
   Se requiere filtro de contexto para evitar
   falsos positivos.
══════════════════════════════════════════ */
const ENTITY_ONLY_PATTERNS = [
  /polic[ií]a\s+nacional/i,
  /procuradur[ií]a\s+general/i,
  /contralor[ií]a\s+general/i,
  /c[aá]mara\s+de\s+comercio/i,
  /registradur[ií]a/i,
  /direcci[oó]n\s+de\s+impuestos/i,
  /registro\s+[uú]nico\s+tributario/i,
  /registro\s+nacional\s+de\s+medidas\s+correctivas/i,
  /consulta\s+de\s+inhabilidades/i,
  /consulta\s+(en\s+l[ií]nea\s+de\s+)?antecedentes/i,
  /redeam|redam/i,
  /rep[uú]blica\s+de\s+colombia/i,
];

/* Palabras que indican que la página es parte de un documento
   contractual más grande (invitación, estudio previo, etc.) y que
   las menciones de entidades son solo requisitos, no documentos aparte */
const CONTEXT_CONTRACTUAL_KEYWORDS = [
  'requisitos habilitantes', 'documentos requeridos', 'documentos exigidos',
  'documentos habilitantes', 'presupuesto oficial', 'criterio de selección',
  'criterio de seleccion', 'fundamento legal', 'cronograma del proceso',
  'forma de pago', 'plazo de ejecución', 'plazo de ejecucion',
  'obligaciones del contratista', 'obligaciones del contratante',
  'cláusula', 'clausula', 'régimen especial', 'regimen especial',
  'tabla de requisitos', 'documentación requerida', 'documentacion requerida',
  'causales de terminación', 'causales de terminacion',
  'documentos del contrato', 'perfeccionamiento del contrato',
  'solución de controversias', 'solucion de controversias',
  'domicilio contractual', 'entre los suscritos',
  'hemos convenido en celebrar', 'inhabilidades e incompatibilidades',
  'ley 1474', 'análisis de riesgos', 'analisis de riesgos',
  'evaluación de las propuestas', 'evaluacion de las propuestas'
];

/* ══════════════════════════════════════════
   PASADA 1: DETECTAR LÍMITES DE DOCUMENTOS
   Analiza el encabezado de cada página para
   determinar si es inicio de documento nuevo
   o continuación del anterior.
══════════════════════════════════════════ */
function detectarLimites(paginas){
  for(let i = 0; i < paginas.length; i++){
    const pag = paginas[i];

    // La primera página siempre es inicio
    if(i === 0){
      pag.esInicio = true;
      continue;
    }

    // Revisar si el encabezado (top 20%) contiene un patrón de inicio
    const textoTop = pag.textoSuperior || '';
    const textoFull = pag.texto || '';
    let esInicio = false;
    let esPatronEntidad = false;

    for(const patron of DOCUMENT_START_PATTERNS){
      if(patron.test(textoTop)){
        esInicio = true;
        // Verificar si el patrón que coincidió es de entidad gubernamental
        esPatronEntidad = ENTITY_ONLY_PATTERNS.some(ep => ep.test(textoTop));
        break;
      }
    }

    // FILTRO ANTI-FALSOS POSITIVOS: si el patrón es de entidad gubernamental,
    // verificar que NO estemos dentro de un documento contractual que simplemente
    // menciona esas entidades en una tabla de requisitos
    if(esInicio && esPatronEntidad){
      const enContextoContractual = CONTEXT_CONTRACTUAL_KEYWORDS.some(kw => textoFull.includes(kw));
      if(enContextoContractual){
        // La página menciona una entidad PERO está en contexto de un doc contractual
        // (invitación, estudio previo, contrato) → NO es inicio de doc separado
        esInicio = false;
      }

      // También verificar si la página anterior es del mismo documento multi-página
      if(esInicio && i > 0){
        const prevTexto = paginas[i-1].texto || '';
        const prevEsContractual = CONTEXT_CONTRACTUAL_KEYWORDS.some(kw => prevTexto.includes(kw));
        if(prevEsContractual){
          // La página anterior es contractual, esta probablemente es continuación
          esInicio = false;
        }
      }
    }

    // Páginas con poco texto total (firmas, sellos, páginas casi vacías)
    // NUNCA son inicio de documento nuevo — son continuación
    if(!esInicio && textoFull.length < 300){
      // Página corta sin patrón de inicio = continuación segura
      pag.esInicio = false;
      continue;
    }

    // Si no se detectó por patrón, verificar si el encabezado es significativamente
    // diferente al documento anterior (cambio de entidad/tipo)
    if(!esInicio && textoTop.length > 20){
      const topAnterior = paginas[i-1].textoSuperior || '';
      if(topAnterior.length > 20){
        const similitud = calcularSimilitud(textoTop, topAnterior);
        if(similitud < 0.12){
          // Solo dividir por baja similitud si NO estamos en contexto contractual
          const enContexto = CONTEXT_CONTRACTUAL_KEYWORDS.some(kw => textoFull.includes(kw));
          const prevEnContexto = CONTEXT_CONTRACTUAL_KEYWORDS.some(kw => (paginas[i-1].texto || '').includes(kw));
          if(!enContexto && !prevEnContexto){
            esInicio = true;
          }
        }
      }
    }

    pag.esInicio = esInicio;
  }
}

/* Calcular similitud entre dos textos (Jaccard de palabras) */
function calcularSimilitud(texto1, texto2){
  const palabras1 = new Set(texto1.split(/\s+/).filter(w => w.length > 3));
  const palabras2 = new Set(texto2.split(/\s+/).filter(w => w.length > 3));
  if(palabras1.size === 0 || palabras2.size === 0) return 0;
  let interseccion = 0;
  for(const w of palabras1){ if(palabras2.has(w)) interseccion++; }
  const union = new Set([...palabras1, ...palabras2]).size;
  return union > 0 ? interseccion / union : 0;
}

/* ══════════════════════════════════════════
   PASADA 2: CLASIFICAR CADA GRUPO
   Usa el texto COMBINADO de todas las páginas
   del grupo, dando 3x peso a la primera página.
══════════════════════════════════════════ */
function clasificarGrupo(paginasDelGrupo){
  let mejorTipo = null;
  let mejorPuntaje = 0;

  for(const regla of DETECTOR_REGLAS){
    let puntaje = 0;
    for(let i = 0; i < paginasDelGrupo.length; i++){
      const texto = paginasDelGrupo[i].texto;
      const peso = (i === 0) ? 3.0 : 1.0; // Primera página pesa 3x
      for(const palabra of regla.palabras){
        if(texto.includes(palabra)){
          puntaje += regla.peso * peso;
        }
      }
    }
    if(puntaje > mejorPuntaje){
      mejorPuntaje = puntaje;
      mejorTipo = regla.tipo;
    }
  }

  return { tipo: mejorTipo, confianza: mejorPuntaje };
}

/* ══════════════════════════════════════════
   FORMAR GRUPOS A PARTIR DE LÍMITES Y CLASIFICAR
══════════════════════════════════════════ */
function detectarYAgrupar(paginas){
  // Pasada 1: detectar donde empieza cada documento
  detectarLimites(paginas);

  // Encontrar los índices de inicio
  const inicios = [];
  for(let i = 0; i < paginas.length; i++){
    if(paginas[i].esInicio) inicios.push(i);
  }

  // Si no se detectó ningún inicio más que la primera página, tratar cada página como documento separado
  if(inicios.length <= 1 && paginas.length > 1){
    // Fallback: cada página es un documento
    for(let i = 0; i < paginas.length; i++){
      paginas[i].esInicio = true;
      inicios.push(i);
    }
    // Quitar el duplicado del 0
    const unicos = [...new Set(inicios)];
    inicios.length = 0;
    inicios.push(...unicos);
  }

  // Pasada 2: clasificar cada grupo usando texto combinado
  const grupos = [];
  for(let b = 0; b < inicios.length; b++){
    const desde = inicios[b];
    const hasta = (b + 1 < inicios.length) ? inicios[b + 1] - 1 : paginas.length - 1;

    const paginasGrupo = paginas.slice(desde, hasta + 1);
    const { tipo, confianza } = clasificarGrupo(paginasGrupo);

    const regla = DETECTOR_REGLAS.find(r => r.tipo === tipo);
    const fechas = paginasGrupo.map(p => p.fechaDetectada).filter(Boolean);

    // Asignar tipo a cada página del grupo
    for(const pag of paginasGrupo){
      pag.tipoDetectado = tipo;
      pag.confianza = confianza;
      pag.tipoAsignado = tipo;
    }

    grupos.push({
      tipo: tipo || 'no_identificado',
      nombre: regla ? regla.nombre : 'No identificado',
      paginaDesde: desde + 1,  // 1-based
      paginaHasta: hasta + 1,
      confianza,
      fechaDetectada: fechas[0] || null
    });
  }

  return grupos;
}

/* ══════════════════════════════════════════
   INICIAR ANALISIS (llamado desde el input file)
══════════════════════════════════════════ */
async function iniciarAnalisisPDF(input){
  const file = input.files[0];
  if(!file) return;

  const esHTML = file.name.endsWith('.html') || file.name.endsWith('.htm') || file.type === 'text/html';
  const esPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf');

  if(!esPDF && !esHTML){
    toast('Solo se permiten archivos PDF o HTML', 'danger');
    input.value = '';
    return;
  }

  // Mostrar paso 2 (analizando)
  document.getElementById('splitter-paso1').style.display = 'none';
  document.getElementById('splitter-paso2').style.display = '';
  document.getElementById('splitter-paso3').style.display = 'none';
  document.getElementById('splitter-footer').style.display = 'none';

  try {
    if(esHTML){
      // ── FLUJO HTML: extraer texto directo del HTML, convertir a PDF para storage ──
      const progresoEl = document.getElementById('splitter-progreso');
      const barEl = document.getElementById('splitter-progress-bar');
      if(progresoEl) progresoEl.textContent = 'Leyendo HTML...';
      if(barEl) barEl.style.width = '30%';

      const htmlText = await file.text();

      // Extraer texto plano del HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlText;
      const textoPlano = (tempDiv.textContent || tempDiv.innerText || '').trim();

      if(progresoEl) progresoEl.textContent = 'Convirtiendo HTML a PDF...';
      if(barEl) barEl.style.width = '50%';

      // Convertir HTML a PDF para almacenamiento
      const container = document.createElement('div');
      container.innerHTML = htmlText;
      // Visible pero fuera de pantalla para que html2canvas funcione
      container.style.cssText = 'position:fixed;left:0;top:0;width:210mm;z-index:-1;opacity:0;';
      document.body.appendChild(container);

      try {
        const opts = {
          margin: [10, 10, 10, 10],
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] }
        };

        // Paso a paso para obtener acceso al jsPDF
        const worker = html2pdf().set(opts).from(container);
        await worker.toContainer();
        await worker.toCanvas();
        await worker.toImg();
        await worker.toPdf();

        // Acceder al jsPDF interno y obtener ArrayBuffer
        const jsPdfObj = worker.get('pdf');
        const pdfArrayBuffer = jsPdfObj.output('arraybuffer');

        _splitterData.pdfBytes = new Uint8Array(pdfArrayBuffer).buffer;
        console.log('HTML convertido a PDF:', _splitterData.pdfBytes.byteLength, 'bytes');
      } finally {
        document.body.removeChild(container);
      }

      if(progresoEl) progresoEl.textContent = 'Clasificando documento...';
      if(barEl) barEl.style.width = '80%';

      // Crear página virtual con el texto del HTML
      const textoLower = textoPlano.toLowerCase();
      const fechaDetectada = extraerFechaDelTexto(textoPlano);

      const pagina = {
        num: 1,
        texto: textoLower,
        textoSuperior: textoLower.substring(0, Math.ceil(textoLower.length * 0.2)),
        tipoDetectado: null,
        confianza: 0,
        tipoAsignado: null,
        fechaDetectada,
        esInicio: true
      };

      _splitterData.paginas = [pagina];

      // Clasificar usando el texto completo
      const { tipo, confianza } = clasificarGrupo([pagina]);
      pagina.tipoDetectado = tipo;
      pagina.confianza = confianza;
      pagina.tipoAsignado = tipo;

      const regla = DETECTOR_REGLAS.find(r => r.tipo === tipo);
      _splitterData.grupos = [{
        tipo: tipo || 'no_identificado',
        nombre: regla ? regla.nombre : 'No identificado',
        paginaDesde: 1,
        paginaHasta: 1,
        confianza,
        fechaDetectada
      }];

      if(barEl) barEl.style.width = '100%';

      // Mostrar resultados
      mostrarResultadosSplitter();

    } else {
      // ── FLUJO PDF: extraer texto con pdf.js ──
      const arrayBuffer = await file.arrayBuffer();

      // Guardar una COPIA del ArrayBuffer (pdf.js puede detach el original)
      _splitterData.pdfBytes = arrayBuffer.slice(0);

      // Extraer texto de cada pagina (con OCR si es necesario)
      const paginas = await extraerTextoPaginas(arrayBuffer, (pag, total, extra) => {
        const progresoEl = document.getElementById('splitter-progreso');
        const barEl = document.getElementById('splitter-progress-bar');
        if(total > 0){
          const pct = Math.round((pag / total) * 100);
          progresoEl.textContent = `Leyendo página ${pag} de ${total}${extra || ''}`;
          if(barEl) barEl.style.width = pct + '%';
        } else {
          progresoEl.textContent = extra || 'Inicializando...';
        }
      });

      _splitterData.paginas = paginas;

      // Sistema de 2 pasadas: detectar límites + clasificar grupos
      _splitterData.grupos = detectarYAgrupar(paginas);

      // Mostrar resultados
      mostrarResultadosSplitter();
    }

  } catch(e){
    console.error('Error analizando PDF:', e);
    toast('Error al analizar el PDF: ' + e.message, 'danger');
    // Volver al paso 1
    document.getElementById('splitter-paso1').style.display = '';
    document.getElementById('splitter-paso2').style.display = 'none';
  }

  input.value = '';
}

/* ══════════════════════════════════════════
   MOSTRAR RESULTADOS DEL ANALISIS
══════════════════════════════════════════ */
function mostrarResultadosSplitter(){
  const grupos = _splitterData.grupos;
  const paginas = _splitterData.paginas;
  const detectados = grupos.filter(g => g.tipo !== 'no_identificado').length;
  const noDetectados = grupos.filter(g => g.tipo === 'no_identificado').length;

  document.getElementById('splitter-paso2').style.display = 'none';
  document.getElementById('splitter-paso3').style.display = '';
  document.getElementById('splitter-footer').style.display = '';

  document.getElementById('splitter-resumen').textContent =
    `${paginas.length} páginas analizadas — ${detectados} documentos detectados` +
    (noDetectados > 0 ? `, ${noDetectados} sin identificar` : '');

  // Opciones para el select (incluye tipos de adición) con códigos
  const opciones = [...DOC_TIPOS, ...DOC_TIPOS_ADICION].map(d =>
    `<option value="${d.id}">${d.codigo ? d.codigo + ' — ' : ''}${d.nombre}</option>`
  ).join('');

  // Generar thumbnails de las páginas
  generarThumbnails();

  let html = '<table class="table table-sm table-hover small">';
  html += '<thead><tr><th style="width:80px">Vista</th><th>Págs.</th><th>Documento Detectado</th><th>Fecha</th><th>Confianza</th><th>Asignar como</th></tr></thead><tbody>';

  grupos.forEach((grupo, idx) => {
    const pags = grupo.paginaDesde === grupo.paginaHasta
      ? `${grupo.paginaDesde}`
      : `${grupo.paginaDesde}-${grupo.paginaHasta}`;

    const totalPags = grupo.paginaHasta - grupo.paginaDesde + 1;

    const confianzaIcon = grupo.tipo === 'no_identificado'
      ? '<span class="semaforo rojo"></span> No detectado'
      : grupo.confianza >= 6
        ? '<span class="semaforo verde"></span> Alta'
        : grupo.confianza >= 3
          ? '<span class="semaforo amarillo"></span> Media'
          : '<span class="semaforo rojo"></span> Baja';

    const selected = grupo.tipo !== 'no_identificado' ? grupo.tipo : '';

    // Texto extraído (primeros 60 chars) para ayudar al usuario
    const pag1 = _splitterData.paginas[grupo.paginaDesde - 1];
    const textoCorto = pag1 && pag1.texto ? pag1.texto.substring(0, 80).trim() : '';
    const textoInfo = textoCorto
      ? `<div class="text-muted" style="font-size:9px;max-width:200px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis" title="${textoCorto}">${textoCorto}</div>`
      : '<div style="font-size:9px;color:var(--rojo)">⚠ Sin texto (imagen)</div>';

    html += `<tr>
      <td><canvas id="thumb-${grupo.paginaDesde}" width="70" height="90" style="border:1px solid #ddd;border-radius:4px;cursor:pointer" onclick="ampliarPagina(${grupo.paginaDesde})" title="Click para ampliar"></canvas></td>
      <td><strong>${pags}</strong><br><span class="text-muted">(${totalPags} pág${totalPags > 1 ? 's' : ''})</span></td>
      <td>${grupo.nombre}${textoInfo}</td>
      <td>${grupo.fechaDetectada ? `<span class="text-success"><i class="bi bi-calendar-check me-1"></i>${grupo.fechaDetectada}</span>` : '<span class="text-muted">—</span>'}</td>
      <td>${confianzaIcon}</td>
      <td>
        <select class="form-select form-select-sm" onchange="cambiarAsignacion(${idx}, this.value)" style="font-size:11px">
          <option value="">— Sin asignar —</option>
          ${opciones}
        </select>
      </td>
    </tr>`;

    // Auto-seleccionar el valor detectado en el select
    setTimeout(() => {
      const selects = document.querySelectorAll('#splitter-resultados select');
      if(selects[idx] && selected){
        selects[idx].value = selected;
      }
    }, 100);
  });

  html += '</tbody></table>';
  document.getElementById('splitter-resultados').innerHTML = html;

  // Renderizar thumbnails después de que el HTML esté en el DOM
  setTimeout(() => renderThumbnails(), 200);
}

/* ══════════════════════════════════════════
   GENERAR THUMBNAILS DE LAS PÁGINAS
══════════════════════════════════════════ */
async function generarThumbnails(){
  // Se llama antes de insertar HTML, los canvas se renderizan después
}

async function renderThumbnails(){
  try {
    const copiaBytes = _splitterData.pdfBytes.slice(0);
    const pdf = await pdfjsLib.getDocument({ data: copiaBytes }).promise;

    for(const grupo of _splitterData.grupos){
      const canvas = document.getElementById(`thumb-${grupo.paginaDesde}`);
      if(!canvas) continue;

      const page = await pdf.getPage(grupo.paginaDesde);
      const viewport = page.getViewport({ scale: 0.15 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
    }
  } catch(e){
    console.warn('Error renderizando thumbnails:', e);
  }
}

/* ── Ampliar página en ventana emergente ── */
async function ampliarPagina(numPag){
  try {
    const copiaBytes = _splitterData.pdfBytes.slice(0);
    const pdf = await pdfjsLib.getDocument({ data: copiaBytes }).promise;
    const page = await pdf.getPage(numPag);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    // Mostrar en ventana nueva
    const win = window.open('', '_blank', 'width=700,height=900');
    win.document.write(`<html><head><title>Página ${numPag}</title></head><body style="margin:0;display:flex;justify-content:center;background:#333"><img src="${canvas.toDataURL()}" style="max-width:100%;height:auto"></body></html>`);
  } catch(e){
    console.warn('Error ampliando página:', e);
  }
}

/* ── Cambiar asignacion manual ── */
function cambiarAsignacion(grupoIdx, nuevoTipo){
  const grupo = _splitterData.grupos[grupoIdx];
  if(!grupo) return;

  grupo.tipo = nuevoTipo || 'no_identificado';
  const regla = DETECTOR_REGLAS.find(r => r.tipo === nuevoTipo);
  grupo.nombre = regla ? regla.nombre : 'No identificado';

  // Actualizar paginas individuales
  for(let i = grupo.paginaDesde; i <= grupo.paginaHasta; i++){
    const pag = _splitterData.paginas[i - 1];
    if(pag) pag.tipoAsignado = nuevoTipo || null;
  }
}

/* ══════════════════════════════════════════
   CONFIRMAR Y SEPARAR EL PDF
══════════════════════════════════════════ */
async function confirmarSeparacion(){
  const expId = _splitterData.expId;
  if(!expId){
    toast('No hay expediente seleccionado', 'danger');
    return;
  }

  const grupos = _splitterData.grupos.filter(g => g.tipo && g.tipo !== 'no_identificado');
  if(!grupos.length){
    toast('No hay documentos asignados para separar', 'warning');
    return;
  }

  toast('Separando y guardando documentos...', 'info');

  try {
    // Usar copia fresca del ArrayBuffer para PDFLib
    const copiaBytes = _splitterData.pdfBytes.slice(0);
    const srcPdf = await PDFLib.PDFDocument.load(copiaBytes, { ignoreEncryption: true });

    for(const grupo of grupos){
      // Extraer paginas de este grupo
      const newPdf = await PDFLib.PDFDocument.create();
      const pageIndices = [];
      for(let i = grupo.paginaDesde - 1; i < grupo.paginaHasta; i++){
        pageIndices.push(i);
      }
      const copiedPages = await newPdf.copyPages(srcPdf, pageIndices);
      copiedPages.forEach(p => newPdf.addPage(p));

      const pdfBytes = await newPdf.save();
      const paginas = grupo.paginaHasta - grupo.paginaDesde + 1;

      // Nombre organizado con número de orden
      const docTipoDef = DOC_TIPOS.find(d => d.id === grupo.tipo) || DOC_TIPOS_ADICION.find(d => d.id === grupo.tipo);
      const ordenNum = docTipoDef ? String(docTipoDef.orden).padStart(2,'0') : '99';
      const nombreLimpio = (docTipoDef ? docTipoDef.nombre : grupo.nombre)
        .replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 40);
      const storagePath = `${expId}/${ordenNum}_${nombreLimpio}_${Date.now()}.pdf`;

      // Guardar archivo local
      await DB.saveArchivo(storagePath, pdfBytes.buffer);

      // Subir a Supabase
      if(SB.isActive()){
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        await SB.uploadPDF(storagePath, blob);
      }

      // Guardar metadata
      const docId = `${expId}_${grupo.tipo}`;
      const doc = {
        id: docId,
        expediente_id: expId,
        tipo: grupo.tipo,
        orden: (DOC_TIPOS.find(d => d.id === grupo.tipo) || DOC_TIPOS_ADICION.find(d => d.id === grupo.tipo))?.orden || 99,
        nombre_archivo: `${ordenNum}_${nombreLimpio}.pdf`,
        storage_path: storagePath,
        paginas,
        fecha_expedicion: grupo.fechaDetectada || null,
        created_at: new Date().toISOString()
      };
      await DB.saveDocumento(doc);
    }

    _splitterData.docsGuardados += grupos.length;

    // Actualizar estado
    await actualizarEstadoExpediente(expId);

    // Re-render el detalle detrás del modal
    renderDetalleExpediente(expId);

    toast(`${grupos.length} documentos asignados. Total esta sesión: ${_splitterData.docsGuardados}`);

    // Volver al paso 1 para cargar más documentos
    mostrarPasoCargarMas();

  } catch(e){
    console.error('Error separando PDF:', e);
    toast('Error al separar: ' + e.message, 'danger');
  }
}

/* ══════════════════════════════════════════
   MOSTRAR PASO "CARGAR MÁS" DESPUÉS DE CONFIRMAR
══════════════════════════════════════════ */
function mostrarPasoCargarMas(){
  document.getElementById('splitter-paso1').style.display = '';
  document.getElementById('splitter-paso2').style.display = 'none';
  document.getElementById('splitter-paso3').style.display = 'none';
  document.getElementById('splitter-footer').style.display = 'none';

  // Reemplazar contenido del paso 1 con mensaje de éxito + opciones
  const paso1 = document.getElementById('splitter-paso1');
  paso1.innerHTML = `
    <div class="text-center py-4">
      <i class="bi bi-check-circle-fill" style="font-size:3rem;color:#198754"></i>
      <h5 class="mt-2 text-success">${_splitterData.docsGuardados} documento(s) asignados</h5>
      <p class="text-muted small">¿Desea cargar más documentos para este expediente?</p>
      <div class="d-flex justify-content-center gap-3 mt-3">
        <label class="btn btn-success btn-lg">
          <i class="bi bi-upload me-2"></i>Cargar otro archivo
          <input type="file" accept=".pdf,.html,.htm" style="display:none" onchange="iniciarAnalisisPDF(this)">
        </label>
        <button class="btn btn-outline-secondary btn-lg" onclick="finalizarSplitter()">
          <i class="bi bi-check-lg me-2"></i>Finalizar
        </button>
      </div>
    </div>
  `;
}

/* ── Finalizar y cerrar modal ── */
function finalizarSplitter(){
  bootstrap.Modal.getInstance(document.getElementById('modalSplitter')).hide();
  // Restaurar paso 1 original para la próxima vez
  restaurarPaso1Original();
  toast(`Carga completa: ${_splitterData.docsGuardados} documentos asignados al expediente`);
}

/* ── Restaurar el HTML original del paso 1 ── */
function restaurarPaso1Original(){
  const paso1 = document.getElementById('splitter-paso1');
  paso1.innerHTML = `
    <div class="text-center py-4">
      <i class="bi bi-file-earmark-pdf" style="font-size:3rem;color:#dc3545"></i>
      <h5 class="mt-2">Suba el documento del expediente</h5>
      <p class="text-muted small">Acepta <strong>PDF</strong> y <strong>HTML</strong> — La app detectará automáticamente qué documento es</p>
      <label class="btn btn-success btn-lg mt-2">
        <i class="bi bi-upload me-2"></i>Seleccionar archivo
        <input type="file" accept=".pdf,.html,.htm" style="display:none" onchange="iniciarAnalisisPDF(this)">
      </label>
    </div>
  `;
}

/* ══════════════════════════════════════════
   ABRIR MODAL DEL SPLITTER
══════════════════════════════════════════ */
function abrirSplitter(expId){
  _splitterData = { pdfBytes: null, paginas: [], grupos: [], expId, docsGuardados: 0 };

  // Reset UI
  document.getElementById('splitter-exp-id').value = expId;
  restaurarPaso1Original();
  document.getElementById('splitter-paso1').style.display = '';
  document.getElementById('splitter-paso2').style.display = 'none';
  document.getElementById('splitter-paso3').style.display = 'none';
  document.getElementById('splitter-footer').style.display = 'none';

  new bootstrap.Modal(document.getElementById('modalSplitter')).show();
}
