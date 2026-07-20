/* ══════════════════════════════════════════════════════════
   EXPEDIENTES CONTRACTUALES — Motor de PDF
   Usa pdf-lib para: portada, indice, foliar, unir PDFs
══════════════════════════════════════════════════════════ */

const { PDFDocument, rgb, StandardFonts, PageSizes } = PDFLib;

/* ══════════════════════════════════════════
   Helper: sanitizar texto para pdf-lib WinAnsi
   Remueve saltos de línea, tabs, control chars y
   sustituye caracteres Unicode no soportados por WinAnsi
══════════════════════════════════════════ */
function sanitizeForPdf(s){
  if(s == null) return '';
  return String(s)
    // Reemplazar saltos de línea, tabs y otros whitespace especial por espacio
    .replace(/[\r\n\t\v\f]+/g, ' ')
    // Eliminar caracteres de control (0x00-0x1F excepto ya reemplazados, y 0x7F DEL)
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Sustituciones comunes para caracteres Unicode que WinAnsi no puede codificar
    .replace(/[‘’‚‛]/g, "'")  // comillas simples curly → recta
    .replace(/[“”„‟]/g, '"')  // comillas dobles curly → recta
    .replace(/[–—―]/g, '-')        // en-dash, em-dash → guión
    .replace(/[…]/g, '...')                  // ellipsis → 3 puntos
    .replace(/[ ]/g, ' ')                    // NBSP → espacio normal
    .replace(/[​-‍﻿]/g, '')        // zero-width chars
    // Colapsar múltiples espacios en uno
    .replace(/\s+/g, ' ')
    .trim();
}

/* ══════════════════════════════════════════
   FUNCION PRINCIPAL: Generar expediente completo
══════════════════════════════════════════ */
async function generarPDFExpediente(expediente, documentos){

  // Ordenar documentos:
  // 1. Docs SIN pago_id → orden natural (por orden)
  // 2. Docs CON pago_id → agrupados por pago (según numero del pago), y dentro
  //    de cada pago en el orden estándar de DOCS_POR_PAGO
  const pagosPeriodicos = (expediente.datos && expediente.datos.pagos_periodicos) || [];
  const pagoById = {};
  pagosPeriodicos.forEach(p => pagoById[p.id] = p);
  // Orden dentro de cada pago: primero requeridos, luego habilitantes opcionales
  const ordenDocsPorPago = {};
  if(typeof DOCS_POR_PAGO !== 'undefined'){
    DOCS_POR_PAGO.forEach((dt, i) => { ordenDocsPorPago[dt.id] = i; });
  }
  if(typeof HABILITANTES_POR_PAGO !== 'undefined'){
    const offset = Object.keys(ordenDocsPorPago).length;
    HABILITANTES_POR_PAGO.forEach((dt, i) => { ordenDocsPorPago[dt.id] = offset + i; });
  }

  const docsSinPago = documentos.filter(d => !d.pago_id);
  const docsConPago = documentos.filter(d => d.pago_id);

  docsSinPago.sort((a, b) => (a.orden || 0) - (b.orden || 0));
  docsConPago.sort((a, b) => {
    const pa = pagoById[a.pago_id]?.numero || 999;
    const pb = pagoById[b.pago_id]?.numero || 999;
    if(pa !== pb) return pa - pb;
    return (ordenDocsPorPago[a.tipo] ?? 99) - (ordenDocsPorPago[b.tipo] ?? 99);
  });

  documentos = [...docsSinPago, ...docsConPago];

  // 1. Crear PDF final
  const pdfFinal = await PDFDocument.create();
  const fontBold = await pdfFinal.embedFont(StandardFonts.HelveticaBold);
  const fontNormal = await pdfFinal.embedFont(StandardFonts.Helvetica);

  // 2. Recopilar todos los PDFs (sin calcular folios todavía)
  const pdfDocs = [];

  for(const doc of documentos){
    try {
      const arrayBuffer = await DB.getArchivo(doc.storage_path);
      if(!arrayBuffer){
        console.warn('Archivo no encontrado:', doc.storage_path);
        continue;
      }
      const srcPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const pagCount = srcPdf.getPageCount();
      pdfDocs.push({
        doc,
        srcPdf,
        paginas: pagCount,
        folioInicio: 0 // se calcula después
      });
    } catch(e){
      console.warn('Error cargando PDF:', doc.nombre_archivo, e);
    }
  }

  if(!pdfDocs.length){
    throw new Error('No se pudieron cargar documentos PDF');
  }

  // Calcular cuántas páginas ocupará el índice
  // Aprox 22 items por página (basado en altura disponible)
  const ITEMS_POR_PAGINA_INDICE = 22;
  const paginasIndice = Math.max(1, Math.ceil(pdfDocs.length / ITEMS_POR_PAGINA_INDICE));

  // Calcular folios ahora que sabemos cuántas páginas ocupa el índice
  let folioContador = 1 + paginasIndice + 1; // portada (1) + índice (N) + primer doc
  let totalPaginas = 1 + paginasIndice;
  for(const item of pdfDocs){
    item.folioInicio = folioContador;
    folioContador += item.paginas;
    totalPaginas += item.paginas;
  }

  // 3. Generar PORTADA (pagina 1)
  await generarPortada(pdfFinal, expediente, totalPaginas, fontBold, fontNormal);

  // 4. Generar INDICE (multi-página)
  await generarIndice(pdfFinal, pdfDocs, fontBold, fontNormal, expediente);

  // Verificar que el índice ocupó la cantidad de páginas estimada
  const paginasIndiceReal = pdfFinal.getPageCount() - 1; // menos la portada
  if(paginasIndiceReal !== paginasIndice){
    // Recalcular folios con el número real de páginas del índice
    const diferencia = paginasIndiceReal - paginasIndice;
    folioContador = 1 + paginasIndiceReal + 1;
    totalPaginas = 1 + paginasIndiceReal;
    for(const item of pdfDocs){
      item.folioInicio = folioContador;
      folioContador += item.paginas;
      totalPaginas += item.paginas;
    }
    console.log(`\u00cdndice us\u00f3 ${paginasIndiceReal} p\u00e1g (estimado: ${paginasIndice}), folios recalculados`);
  }

  // 5. Copiar cada PDF y estampar folio
  let folioActual = 1 + paginasIndiceReal + 1; // después de portada + índice

  for(const item of pdfDocs){
    const copiedPages = await pdfFinal.copyPages(item.srcPdf, item.srcPdf.getPageIndices());

    for(const page of copiedPages){
      const added = pdfFinal.addPage(page);
      estamparFolio(added, folioActual, totalPaginas, fontBold);
      folioActual++;
    }
  }

  // 6. Estampar folio en portada e índice (todas sus páginas)
  const allPages = pdfFinal.getPages();
  estamparFolio(allPages[0], 1, totalPaginas, fontBold); // portada
  for(let i = 0; i < paginasIndiceReal; i++){
    estamparFolio(allPages[1 + i], 2 + i, totalPaginas, fontBold);
  }

  // 7. Descargar o retornar bytes
  const pdfBytes = await pdfFinal.save();
  if(arguments[2] && arguments[2].returnBytes){
    return pdfBytes.buffer;
  }
  descargarPDF(pdfBytes, `Expediente_Cto_${expediente.contrato_numero}_${expediente.anio}.pdf`);
}

/* ══════════════════════════════════════════
   GENERAR PDF DE UN PAGO INDIVIDUAL
   Portada + índice + soportes foliados de UN solo pago
══════════════════════════════════════════ */
async function generarPDFPago(expediente, pago, docsDelPago){
  const pdfFinal = await PDFDocument.create();
  const fontBold = await pdfFinal.embedFont(StandardFonts.HelveticaBold);
  const fontNormal = await pdfFinal.embedFont(StandardFonts.Helvetica);

  // Cargar todos los PDFs de este pago
  const pdfDocs = [];
  for(const doc of docsDelPago){
    try {
      const arrayBuffer = await DB.getArchivo(doc.storage_path);
      if(!arrayBuffer) continue;
      const srcPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      pdfDocs.push({ doc, srcPdf, paginas: srcPdf.getPageCount(), folioInicio: 0 });
    } catch(e){
      console.warn('Error cargando PDF del pago:', doc.nombre_archivo, e);
    }
  }
  if(!pdfDocs.length){ throw new Error('No se pudieron cargar documentos del pago'); }

  // Calcular folios: portada (1) + índice (1) + docs
  let folioContador = 3;
  let totalPaginas = 2;
  for(const item of pdfDocs){
    item.folioInicio = folioContador;
    folioContador += item.paginas;
    totalPaginas += item.paginas;
  }

  // 1. PORTADA del pago
  await generarPortadaPago(pdfFinal, expediente, pago, totalPaginas, fontBold, fontNormal);

  // 2. ÍNDICE del pago
  await generarIndicePago(pdfFinal, pago, pdfDocs, fontBold, fontNormal);

  // 3. Copiar cada doc y estampar folio
  let folioActual = 3;
  for(const item of pdfDocs){
    const copiedPages = await pdfFinal.copyPages(item.srcPdf, item.srcPdf.getPageIndices());
    for(const page of copiedPages){
      const added = pdfFinal.addPage(page);
      estamparFolio(added, folioActual, totalPaginas, fontBold);
      folioActual++;
    }
  }

  // 4. Estampar folio en portada e índice
  const allPages = pdfFinal.getPages();
  estamparFolio(allPages[0], 1, totalPaginas, fontBold);
  estamparFolio(allPages[1], 2, totalPaginas, fontBold);

  // 5. Descargar
  const pdfBytes = await pdfFinal.save();
  const nombreArchivo = `Pago_${String(pago.numero).padStart(2,'0')}_${pago.periodo.replace(/[^a-zA-Z0-9]+/g,'_')}_Cto_${expediente.contrato_numero}_${expediente.anio}.pdf`;
  descargarPDF(pdfBytes, nombreArchivo);
}

async function generarPortadaPago(pdfDoc, exp, pago, totalFolios, fontBold, fontNormal){
  const page = pdfDoc.addPage(PageSizes.Letter);
  const { width, height } = page.getSize();

  // Header decorativo
  page.drawRectangle({
    x: 0, y: height - 80,
    width: width, height: 80,
    color: rgb(0.15, 0.45, 0.20) // verde oscuro
  });
  page.drawText('SOPORTES DE PAGO', {
    x: width / 2 - fontBold.widthOfTextAtSize('SOPORTES DE PAGO', 20) / 2,
    y: height - 45,
    size: 20, font: fontBold,
    color: rgb(1, 1, 1)
  });
  page.drawText('EXPEDIENTE CONTRACTUAL', {
    x: width / 2 - fontNormal.widthOfTextAtSize('EXPEDIENTE CONTRACTUAL', 10) / 2,
    y: height - 65,
    size: 10, font: fontNormal,
    color: rgb(0.9, 0.95, 0.9)
  });

  // Bloque del pago (grande y destacado)
  const pagoBoxY = height - 180;
  page.drawRectangle({
    x: 60, y: pagoBoxY,
    width: width - 120, height: 90,
    color: rgb(0.90, 0.96, 0.91),
    borderColor: rgb(0.15, 0.45, 0.20),
    borderWidth: 1.5
  });
  const tituloPago = sanitizeForPdf(`PAGO ${String(pago.numero).padStart(2,'0')} — ${pago.periodo}`);
  page.drawText(tituloPago, {
    x: 75, y: pagoBoxY + 68,
    size: 14, font: fontBold,
    color: rgb(0.10, 0.35, 0.15)
  });
  let py = pagoBoxY + 48;
  if(pago.concepto){
    let concepto = sanitizeForPdf(pago.concepto);
    if(concepto.length > 95) concepto = concepto.substring(0, 95) + '...';
    page.drawText(`Concepto: ${concepto}`, {
      x: 75, y: py, size: 9, font: fontNormal,
      color: rgb(0.25, 0.25, 0.25)
    });
    py -= 14;
  }
  const info = [];
  if(pago.fecha_pago) info.push(`Fecha: ${sanitizeForPdf(pago.fecha_pago)}`);
  if(pago.valor_pagado) info.push(`Valor: $${Number(pago.valor_pagado).toLocaleString('es-CO')}`);
  if(pago.numero_factura) info.push(`Factura N°: ${sanitizeForPdf(pago.numero_factura)}`);
  if(info.length){
    page.drawText(info.join('   |   '), {
      x: 75, y: py, size: 10, font: fontBold,
      color: rgb(0.10, 0.35, 0.15)
    });
  }

  // Datos del contrato
  const instData = (typeof _instituciones !== 'undefined')
    ? _instituciones.find(i => i.nombre === exp.institucion)
    : null;

  const datos = [
    { label: 'INSTITUCIÓN', valor: sanitizeForPdf((exp.institucion || '').toUpperCase()) },
    { label: 'CONTRATO N°', valor: sanitizeForPdf(`${exp.contrato_numero || 'S/N'} DE ${exp.anio || ''}`) },
    { label: 'CONTRATISTA', valor: sanitizeForPdf((exp.contratista || '').toUpperCase()) },
    { label: 'NIT / CÉDULA', valor: sanitizeForPdf(exp.nit || 'N/A') },
    { label: 'VALOR TOTAL CONTRATO', valor: exp.valor ? '$' + Number(exp.valor).toLocaleString('es-CO') : 'N/A' },
    { label: 'OBJETO', valor: sanitizeForPdf(exp.objeto || 'N/A') }
  ];
  if(instData && instData.rector){
    datos.push({ label: 'RECTOR - ORD. GASTO', valor: sanitizeForPdf(instData.rector.toUpperCase() + (instData.cedulaRector ? ' - C.C. ' + instData.cedulaRector : '')) });
  }
  datos.push({ label: 'TOTAL SOPORTES', valor: `${totalFolios} folios totales` });

  let dy = pagoBoxY - 25;
  const boxX = 60;
  const boxW = width - 120;

  for(const d of datos){
    // Label
    page.drawText(d.label + ':', {
      x: boxX + 5, y: dy,
      size: 8, font: fontBold,
      color: rgb(0.4, 0.4, 0.4)
    });
    // Valor (truncar si es muy largo)
    const maxW = boxW - 15;
    let valorTexto = String(d.valor);
    while(fontBold.widthOfTextAtSize(valorTexto, 10) > maxW && valorTexto.length > 5){
      valorTexto = valorTexto.substring(0, valorTexto.length - 4) + '...';
    }
    page.drawText(valorTexto, {
      x: boxX + 5, y: dy - 13,
      size: 10, font: fontBold,
      color: rgb(0.1, 0.1, 0.1)
    });
    // Línea separadora
    page.drawLine({
      start: { x: boxX + 5, y: dy - 22 },
      end: { x: boxX + boxW - 5, y: dy - 22 },
      color: rgb(0.88, 0.88, 0.88), thickness: 0.5
    });
    dy -= 32;
    if(dy < 100) break;
  }

  // Footer
  const marca = 'LR TRIBUTARIAS  |  Expediente digital foliado';
  page.drawText(marca, {
    x: width / 2 - fontNormal.widthOfTextAtSize(marca, 8) / 2,
    y: 40, size: 8, font: fontNormal,
    color: rgb(0.5, 0.5, 0.5)
  });
}

async function generarIndicePago(pdfDoc, pago, pdfDocs, fontBold, fontNormal){
  const page = pdfDoc.addPage(PageSizes.Letter);
  const { width, height } = page.getSize();

  const titulo = sanitizeForPdf(`SOPORTES DEL PAGO ${String(pago.numero).padStart(2,'0')} — ${pago.periodo}`);
  page.drawText(titulo, {
    x: width / 2 - fontBold.widthOfTextAtSize(titulo, 14) / 2,
    y: height - 60,
    size: 14, font: fontBold,
    color: rgb(0.10, 0.35, 0.15)
  });
  page.drawLine({
    start: { x: 50, y: height - 70 },
    end: { x: width - 50, y: height - 70 },
    color: rgb(0.15, 0.45, 0.20), thickness: 2
  });

  let y = height - 100;
  page.drawText('N°', { x: 55, y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
  page.drawText('CÓDIGO', { x: 85, y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
  page.drawText('DOCUMENTO', { x: 145, y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
  page.drawText('PÁGS.', { x: 420, y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
  page.drawText('FOLIO', { x: 475, y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
  y -= 5;
  page.drawLine({
    start: { x: 50, y }, end: { x: width - 50, y },
    color: rgb(0.8, 0.8, 0.8), thickness: 0.5
  });
  y -= 20;

  // Combinar catálogos para nombres
  const catalogo = {};
  if(typeof DOCS_POR_PAGO !== 'undefined'){
    DOCS_POR_PAGO.forEach(dt => catalogo[dt.id] = { nombre: dt.nombre, codigo: dt.codigo, tipo: 'req' });
  }
  if(typeof HABILITANTES_POR_PAGO !== 'undefined'){
    HABILITANTES_POR_PAGO.forEach(dt => catalogo[dt.id] = { nombre: dt.nombre, codigo: dt.codigo, tipo: 'hab' });
  }

  pdfDocs.forEach((item, idx) => {
    const meta = catalogo[item.doc.tipo] || { nombre: item.doc.nombre_archivo || 'Documento', codigo: '?', tipo: '?' };
    const num = String(idx + 1).padStart(2, '0');
    if(idx % 2 === 0){
      page.drawRectangle({
        x: 50, y: y - 4, width: width - 100, height: 18,
        color: rgb(0.96, 0.97, 0.98)
      });
    }
    page.drawText(num, { x: 58, y, size: 10, font: fontBold, color: rgb(0.10, 0.35, 0.15) });
    page.drawText(sanitizeForPdf(meta.codigo), { x: 85, y, size: 9, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
    let nombreCorto = sanitizeForPdf(meta.nombre);
    if(nombreCorto.length > 42) nombreCorto = nombreCorto.substring(0, 42) + '...';
    page.drawText(nombreCorto, { x: 145, y, size: 10, font: fontNormal, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(String(item.paginas), { x: 432, y, size: 10, font: fontNormal, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(String(item.folioInicio), { x: 483, y, size: 10, font: fontBold, color: rgb(0.10, 0.35, 0.15) });
    y -= 22;
  });

  // Totales
  y -= 10;
  page.drawLine({
    start: { x: 50, y: y + 8 }, end: { x: width - 50, y: y + 8 },
    color: rgb(0.15, 0.45, 0.20), thickness: 1
  });
  page.drawText(`Total: ${pdfDocs.length} soportes de este pago`, {
    x: 145, y: y - 8, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3)
  });
}

/* ══════════════════════════════════════════
   PORTADA
══════════════════════════════════════════ */
async function generarPortada(pdfDoc, exp, totalFolios, fontBold, fontNormal){
  const page = pdfDoc.addPage(PageSizes.Letter);
  const { width, height } = page.getSize();
  const centerX = width / 2;

  // \u2550\u2550\u2550 PORTADA AHORRO DE TINTA \u2014 Solo texto negro + lineas finas \u2550\u2550\u2550

  // Titulo principal en negro
  page.drawText('EXPEDIENTE CONTRACTUAL', {
    x: centerX - fontBold.widthOfTextAtSize('EXPEDIENTE CONTRACTUAL', 22) / 2,
    y: height - 75,
    size: 22, font: fontBold,
    color: rgb(0, 0, 0)
  });

  const subtitulo = 'Contrataci\u00f3n Especial hasta 20 SMLMV';
  page.drawText(subtitulo, {
    x: centerX - fontNormal.widthOfTextAtSize(subtitulo, 11) / 2,
    y: height - 95,
    size: 11, font: fontNormal,
    color: rgb(0.2, 0.2, 0.2)
  });

  const subtitulo2 = 'Ley 715 de 2001 \u2013 Decreto 4791 de 2008';
  page.drawText(subtitulo2, {
    x: centerX - fontNormal.widthOfTextAtSize(subtitulo2, 9) / 2,
    y: height - 110,
    size: 9, font: fontNormal,
    color: rgb(0.3, 0.3, 0.3)
  });

  // Linea horizontal fina debajo del titulo
  page.drawLine({
    start: { x: 50, y: height - 125 },
    end: { x: width - 50, y: height - 125 },
    color: rgb(0, 0, 0),
    thickness: 1.5
  });

  // Marco central con solo borde (sin relleno)
  const marcoX = 60, marcoW = width - 120;
  const marcoY = 180, marcoH = height - 330;
  page.drawRectangle({
    x: marcoX, y: marcoY,
    width: marcoW, height: marcoH,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1
    // sin color de fondo
  });

  // Datos del expediente + institución
  const instData = (typeof getInstitucionData === 'function') ? getInstitucionData(exp.institucion) : null;
  const esAnterior = (exp.datos && exp.datos.tipo_vigencia === 'anterior');
  let y = marcoY + marcoH - 40;
  const datos = [
    { label: 'INSTITUCI\u00d3N EDUCATIVA', valor: (exp.institucion || '').toUpperCase() },
  ];
  if(instData && instData.nit){
    datos.push({ label: 'NIT INSTITUCI\u00d3N', valor: instData.nit });
  }
  if(instData && instData.municipio){
    datos.push({ label: 'MUNICIPIO', valor: instData.municipio.toUpperCase() });
  }
  if(instData && instData.rector){
    datos.push({ label: 'RECTOR(A) - ORDENADOR DEL GASTO', valor: instData.rector.toUpperCase() + (instData.cedulaRector ? ' - C.C. ' + instData.cedulaRector : '') });
  }
  datos.push({ label: 'CONTRATO N\u00b0', valor: `${exp.contrato_numero || 'S/N'} DE ${exp.anio || ''}` });
  datos.push({ label: 'CONTRATISTA', valor: (exp.contratista || '').toUpperCase() });
  datos.push({ label: 'NIT / C\u00c9DULA CONTRATISTA', valor: exp.nit || 'N/A' });
  datos.push({ label: 'VALOR', valor: exp.valor ? '$' + Number(exp.valor).toLocaleString('es-CO') : 'N/A' });
  datos.push({ label: 'OBJETO', valor: exp.objeto || 'N/A' });

  // Fechas del contrato
  if(exp.datos && exp.datos.fecha_contrato){
    datos.push({ label: 'FECHA DEL CONTRATO', valor: exp.datos.fecha_contrato });
  }
  if(exp.datos && exp.datos.fecha_inicio){
    datos.push({ label: 'FECHA ACTA DE INICIO', valor: exp.datos.fecha_inicio });
  }

  // Forma de pago
  const formaPagoKey = exp.datos && exp.datos.forma_pago;
  const formaPagoCfg = (formaPagoKey && typeof FORMAS_PAGO !== 'undefined') ? FORMAS_PAGO[formaPagoKey] : null;
  if(formaPagoCfg){
    let formaValor = formaPagoCfg.nombre.toUpperCase();
    if(formaPagoKey === 'anticipo_saldo' && exp.datos.pct_anticipo){
      formaValor += ` (${exp.datos.pct_anticipo}% ANTICIPO / ${100 - exp.datos.pct_anticipo}% SALDO)`;
    } else if(exp.datos.num_pagos && formaPagoKey !== 'pago_unico' && formaPagoKey !== 'anticipo_saldo'){
      formaValor += ` (${exp.datos.num_pagos} PAGOS)`;
    }
    datos.push({ label: 'FORMA DE PAGO', valor: formaValor });

    // Detalle de pagos periódicos (si existen) - una línea por pago
    const pagos = (exp.datos.pagos_periodicos || []).filter(p => p.fecha_pago || p.valor_pagado || p.numero_factura);
    if(pagos.length > 0){
      pagos.forEach((p, idx) => {
        const partes = [];
        if(p.fecha_pago) partes.push(p.fecha_pago);
        if(p.valor_pagado) partes.push('$' + Number(p.valor_pagado).toLocaleString('es-CO'));
        if(p.numero_factura) partes.push('Fact. ' + p.numero_factura);
        const label = idx === 0 ? 'PAGOS EJECUTADOS' : '';
        const nombrePago = `P${String(p.numero).padStart(2,'0')} ${p.periodo}`;
        const valor = partes.length ? `${nombrePago} — ${partes.join(' | ')}` : nombrePago;
        datos.push({ label, valor });
      });
    }
  }

  datos.push({ label: 'TOTAL FOLIOS', valor: String(totalFolios) });

  // Helper: word-wrap a string into lines that fit within maxWidth points
  function wrapText(text, font, fontSize, maxWidth){
    const words = String(text).split(/\s+/);
    const lines = [];
    let current = '';
    for(const word of words){
      const probe = current ? current + ' ' + word : word;
      if(font.widthOfTextAtSize(probe, fontSize) <= maxWidth){
        current = probe;
      } else {
        if(current) lines.push(current);
        // Si una sola palabra es muy larga, aceptarla igual
        current = word;
      }
    }
    if(current) lines.push(current);
    return lines.length ? lines : [''];
  }

  const valorMaxWidth = marcoW - 50; // ancho disponible dentro del marco
  const valorFontSize = 11;
  const lineHeight = 13; // separación entre líneas del mismo valor

  for(const d of datos){
    // Label (solo si tiene contenido - permite filas de continuación)
    if(d.label){
      page.drawText(d.label + ':', {
        x: marcoX + 25, y,
        size: 9, font: fontBold,
        color: rgb(0.4, 0.4, 0.4)
      });
    }
    // Wrap valor para que no se desborde (sanitizado para WinAnsi)
    const valorSanitizado = sanitizeForPdf(d.valor);
    const valorLineas = wrapText(valorSanitizado, fontBold, valorFontSize, valorMaxWidth);
    // Limitar a máximo 4 líneas
    const lineasMostrar = valorLineas.slice(0, 4);
    if(valorLineas.length > 4){
      lineasMostrar[3] = lineasMostrar[3].substring(0, Math.max(0, lineasMostrar[3].length - 4)) + '...';
    }

    let valorY = y - 14;
    for(const linea of lineasMostrar){
      page.drawText(linea, {
        x: marcoX + 25, y: valorY,
        size: valorFontSize, font: fontBold,
        color: rgb(0.1, 0.1, 0.1)
      });
      valorY -= lineHeight;
    }

    // Bajar 'y' según líneas usadas (filas de continuación son más compactas)
    const filaAltoBase = d.label ? 38 : 20;
    const filaAlto = filaAltoBase + Math.max(0, lineasMostrar.length - 1) * lineHeight;
    y -= filaAlto;

    // Línea separadora (solo para filas con label - no separar continuaciones)
    if(d.label && y > marcoY + 20){
      page.drawLine({
        start: { x: marcoX + 25, y: y + 10 },
        end: { x: marcoX + marcoW - 25, y: y + 10 },
        color: rgb(0.88, 0.88, 0.88),
        thickness: 0.5
      });
    }
  }

  // Pie de pagina
  const fecha = new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'long', year:'numeric' });

  // LR TRIBUTARIAS — marca de la empresa
  const empresa = 'LR TRIBUTARIAS';
  page.drawText(empresa, {
    x: centerX - fontBold.widthOfTextAtSize(empresa, 11) / 2,
    y: 55,
    size: 11, font: fontBold,
    color: rgb(0, 0, 0)
  });

  page.drawText(`Generado el ${fecha}`, {
    x: centerX - fontNormal.widthOfTextAtSize(`Generado el ${fecha}`, 9) / 2,
    y: 38,
    size: 9, font: fontNormal,
    color: rgb(0.4, 0.4, 0.4)
  });

  const sistema = 'Sistema de Expedientes Contractuales';
  page.drawText(sistema, {
    x: centerX - fontNormal.widthOfTextAtSize(sistema, 7) / 2,
    y: 25,
    size: 7, font: fontNormal,
    color: rgb(0.6, 0.6, 0.6)
  });
}

/* ══════════════════════════════════════════
   INDICE CON HIPERVINCULOS
══════════════════════════════════════════ */
async function generarIndice(pdfDoc, pdfDocs, fontBold, fontNormal, expediente){
  // Helper para dibujar el encabezado del índice en una página
  function dibujarCabecera(page, esContinuacion){
    const { width, height } = page.getSize();
    const titulo = esContinuacion ? '\u00cdNDICE DEL EXPEDIENTE (continuaci\u00f3n)' : '\u00cdNDICE DEL EXPEDIENTE';
    page.drawText(titulo, {
      x: width / 2 - fontBold.widthOfTextAtSize(titulo, 16) / 2,
      y: height - 60,
      size: 16, font: fontBold,
      color: rgb(0.102, 0.227, 0.361)
    });
    page.drawLine({
      start: { x: 50, y: height - 70 },
      end: { x: width - 50, y: height - 70 },
      color: rgb(0.831, 0.627, 0.090),
      thickness: 2
    });
    let y = height - 100;
    page.drawText('N\u00b0', { x: 55, y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('C\u00d3DIGO', { x: 80, y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('DOCUMENTO', { x: 130, y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('P\u00c1GS.', { x: 420, y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('FOLIO', { x: 480, y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
    y -= 5;
    page.drawLine({
      start: { x: 50, y },
      end: { x: width - 50, y },
      color: rgb(0.8, 0.8, 0.8),
      thickness: 0.5
    });
    return y - 18; // retorna el Y inicial para los items
  }

  // Mapa de fases regulatorias (etapa → label)
  const FASES = {
    'pre': '1. FASE PRECONTRACTUAL / PLANEACIÓN',
    'sel': '2. DOCUMENTOS DEL CONTRATISTA / HABILITANTES',
    'con': '3. FASE CONTRACTUAL / PERFECCIONAMIENTO',
    'eje': '4. FASE DE EJECUCIÓN',
    'pag': '5. FASE DE PAGO, LIQUIDACIÓN Y CIERRE',
    'ant': '6. DOCUMENTOS VIGENCIA ANTERIOR',
    'adi': '7. ADICIÓN / VIGENCIA ACTUAL',
    'hc':  '8. HECHOS CUMPLIDOS (HC)',
    'inf': '9. INFORMES ANUALES INSTITUCIONALES'
  };

  let page = pdfDoc.addPage(PageSizes.Letter);
  const { width } = page.getSize();
  let y = dibujarCabecera(page, false);

  // Función para dibujar encabezado de fase
  function dibujarHeaderFase(faseKey){
    if(y < 90){
      page = pdfDoc.addPage(PageSizes.Letter);
      y = dibujarCabecera(page, true);
    }
    y -= 6;
    page.drawRectangle({
      x: 50, y: y - 4,
      width: width - 100, height: 18,
      color: rgb(0.102, 0.227, 0.361) // azul oscuro
    });
    page.drawText(FASES[faseKey] || faseKey.toUpperCase(), {
      x: 58, y: y + 1,
      size: 9, font: fontBold,
      color: rgb(1, 1, 1) // blanco
    });
    y -= 22;
  }

  // Mapa de pagos periódicos (para mostrar header por cada pago)
  const pagosPeriodicos = (expediente && expediente.datos && expediente.datos.pagos_periodicos) || [];
  const pagoById = {};
  pagosPeriodicos.forEach(p => pagoById[p.id] = p);

  // Función para dibujar encabezado de PAGO PERIÓDICO
  function dibujarHeaderPago(pago){
    if(y < 110){
      page = pdfDoc.addPage(PageSizes.Letter);
      y = dibujarCabecera(page, true);
    }
    y -= 8;
    // Fondo verde suave para diferenciar
    page.drawRectangle({
      x: 60, y: y - 4,
      width: width - 120, height: 32,
      color: rgb(0.85, 0.94, 0.86), // verde muy suave
      borderColor: rgb(0.30, 0.65, 0.35),
      borderWidth: 0.8
    });
    const titulo = sanitizeForPdf(`PAGO ${String(pago.numero).padStart(2,'0')} — ${pago.periodo}`);
    page.drawText(titulo, {
      x: 68, y: y + 18,
      size: 10, font: fontBold,
      color: rgb(0.10, 0.40, 0.15)
    });
    // Concepto (truncado)
    if(pago.concepto){
      let concepto = sanitizeForPdf(pago.concepto);
      if(concepto.length > 75) concepto = concepto.substring(0, 75) + '...';
      page.drawText(`Concepto: ${concepto}`, {
        x: 68, y: y + 6,
        size: 8, font: fontNormal,
        color: rgb(0.25, 0.25, 0.25)
      });
    }
    // Fecha, valor, factura en la esquina derecha
    let infoX = width - 68;
    const infoParts = [];
    if(pago.fecha_pago) infoParts.push(sanitizeForPdf(pago.fecha_pago));
    if(pago.valor_pagado) infoParts.push('$' + Number(pago.valor_pagado).toLocaleString('es-CO'));
    if(pago.numero_factura) infoParts.push('Fact. ' + sanitizeForPdf(pago.numero_factura));
    if(infoParts.length){
      const info = infoParts.join('  |  ');
      const w = fontNormal.widthOfTextAtSize(info, 8);
      page.drawText(info, {
        x: infoX - w, y: y + 18,
        size: 8, font: fontBold,
        color: rgb(0.10, 0.40, 0.15)
      });
    }
    y -= 36;
  }

  // Items (paginar automáticamente, agrupar por fase Y por pago)
  let faseActual = null;
  let pagoActual = null;
  pdfDocs.forEach((item, idx) => {
    const docTipo = DOC_TIPOS.find(d => d.id === item.doc.tipo) || DOC_TIPOS_ADICION.find(d => d.id === item.doc.tipo);
    const faseDoc = docTipo ? docTipo.etapa : null;
    const pagoIdDoc = item.doc.pago_id || null;

    // Si cambia la fase, dibujar el encabezado
    if(faseDoc && faseDoc !== faseActual){
      dibujarHeaderFase(faseDoc);
      faseActual = faseDoc;
      pagoActual = null; // reset pago al cambiar de fase
    }

    // Si es un doc de pago periódico y el pago cambió, dibujar header del PAGO
    if(pagoIdDoc && pagoIdDoc !== pagoActual){
      const pago = pagoById[pagoIdDoc];
      if(pago){
        dibujarHeaderPago(pago);
        pagoActual = pagoIdDoc;
      }
    } else if(!pagoIdDoc){
      pagoActual = null;
    }

    if(y < 70){
      page = pdfDoc.addPage(PageSizes.Letter);
      y = dibujarCabecera(page, true);
      // Re-dibujar header de fase actual al continuar
      if(faseActual){
        dibujarHeaderFase(faseActual);
      }
      // Re-dibujar header de pago actual si aplica
      if(pagoActual && pagoById[pagoActual]){
        dibujarHeaderPago(pagoById[pagoActual]);
      }
    }

    const num = String(idx + 1).padStart(2, '0');
    const nombre = docTipo ? docTipo.nombre : (item.doc.nombre_archivo || 'Documento');

    if(idx % 2 === 0){
      page.drawRectangle({
        x: 50, y: y - 4,
        width: width - 100, height: 18,
        color: rgb(0.96, 0.97, 0.98)
      });
    }

    page.drawText(num, { x: 58, y, size: 10, font: fontBold, color: rgb(0.102, 0.227, 0.361) });

    const codigo = docTipo ? (docTipo.codigo || '') : '';
    if(codigo){
      page.drawText(sanitizeForPdf(codigo), { x: 80, y, size: 9, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
    }

    let nombreCorto = sanitizeForPdf(nombre);
    if(nombreCorto.length > 45) nombreCorto = nombreCorto.substring(0, 45) + '...';
    page.drawText(nombreCorto, { x: 130, y, size: 10, font: fontNormal, color: rgb(0.2, 0.2, 0.2) });

    page.drawText(String(item.paginas), { x: 432, y, size: 10, font: fontNormal, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(String(item.folioInicio), { x: 488, y, size: 10, font: fontBold, color: rgb(0.102, 0.227, 0.361) });

    y -= 22;
  });

  // Total en la última página del índice
  y -= 10;
  if(y < 60){
    page = pdfDoc.addPage(PageSizes.Letter);
    y = dibujarCabecera(page, true) - 20;
  }

  page.drawLine({
    start: { x: 50, y: y + 8 },
    end: { x: width - 50, y: y + 8 },
    color: rgb(0.831, 0.627, 0.090),
    thickness: 1
  });

  const totalDocs = `Total: ${pdfDocs.length} documentos`;
  page.drawText(totalDocs, {
    x: 130, y: y - 8,
    size: 10, font: fontBold,
    color: rgb(0.3, 0.3, 0.3)
  });

  const totalPags = pdfDocs.reduce((s, d) => s + d.paginas, 0);
  page.drawText(`${totalPags} p\u00e1ginas`, {
    x: 420, y: y - 8,
    size: 10, font: fontBold,
    color: rgb(0.3, 0.3, 0.3)
  });
}

/* ══════════════════════════════════════════
   ESTAMPAR FOLIO EN CADA PAGINA
══════════════════════════════════════════ */
function estamparFolio(page, folio, totalFolios, fontBold){
  const { width, height } = page.getSize();
  const texto = `Folio ${folio} de ${totalFolios}`;
  const fontSize = 8;
  const textWidth = fontBold.widthOfTextAtSize(texto, fontSize);

  // Fondo del sello
  const padX = 6, padY = 3;
  const boxX = width - textWidth - padX * 2 - 15;
  const boxY = height - 22;

  page.drawRectangle({
    x: boxX, y: boxY,
    width: textWidth + padX * 2,
    height: fontSize + padY * 2,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.102, 0.227, 0.361),
    borderWidth: 0.8,
    opacity: 0.92
  });

  page.drawText(texto, {
    x: boxX + padX,
    y: boxY + padY,
    size: fontSize,
    font: fontBold,
    color: rgb(0.102, 0.227, 0.361)
  });
}

/* ══════════════════════════════════════════
   DESCARGAR PDF
══════════════════════════════════════════ */
function descargarPDF(pdfBytes, fileName){
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
