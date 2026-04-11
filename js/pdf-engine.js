/* ══════════════════════════════════════════════════════════
   EXPEDIENTES CONTRACTUALES — Motor de PDF
   Usa pdf-lib para: portada, indice, foliar, unir PDFs
══════════════════════════════════════════════════════════ */

const { PDFDocument, rgb, StandardFonts, PageSizes } = PDFLib;

/* ══════════════════════════════════════════
   FUNCION PRINCIPAL: Generar expediente completo
══════════════════════════════════════════ */
async function generarPDFExpediente(expediente, documentos){

  // Ordenar documentos por orden
  documentos.sort((a, b) => (a.orden || 0) - (b.orden || 0));

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
  await generarIndice(pdfFinal, pdfDocs, fontBold, fontNormal);

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

  // 7. Descargar
  const pdfBytes = await pdfFinal.save();
  descargarPDF(pdfBytes, `Expediente_Cto_${expediente.contrato_numero}_${expediente.anio}.pdf`);
}

/* ══════════════════════════════════════════
   PORTADA
══════════════════════════════════════════ */
async function generarPortada(pdfDoc, exp, totalFolios, fontBold, fontNormal){
  const page = pdfDoc.addPage(PageSizes.Letter);
  const { width, height } = page.getSize();
  const centerX = width / 2;

  // Fondo decorativo superior
  page.drawRectangle({
    x: 0, y: height - 120,
    width, height: 120,
    color: rgb(0.102, 0.227, 0.361) // azul oscuro
  });

  // Linea dorada
  page.drawRectangle({
    x: 0, y: height - 124,
    width, height: 4,
    color: rgb(0.831, 0.627, 0.090) // dorado
  });

  // Titulo en franja
  page.drawText('EXPEDIENTE CONTRACTUAL', {
    x: centerX - fontBold.widthOfTextAtSize('EXPEDIENTE CONTRACTUAL', 22) / 2,
    y: height - 55,
    size: 22, font: fontBold,
    color: rgb(1, 1, 1)
  });

  const subtitulo = 'Contrataci\u00f3n Especial hasta 20 SMLMV';
  page.drawText(subtitulo, {
    x: centerX - fontNormal.widthOfTextAtSize(subtitulo, 11) / 2,
    y: height - 75,
    size: 11, font: fontNormal,
    color: rgb(0.9, 0.9, 0.9)
  });

  const subtitulo2 = 'Ley 715 de 2001 \u2013 Decreto 4791 de 2008';
  page.drawText(subtitulo2, {
    x: centerX - fontNormal.widthOfTextAtSize(subtitulo2, 9) / 2,
    y: height - 90,
    size: 9, font: fontNormal,
    color: rgb(0.8, 0.8, 0.8)
  });

  // Marco central
  const marcoX = 60, marcoW = width - 120;
  const marcoY = 180, marcoH = height - 330;
  page.drawRectangle({
    x: marcoX, y: marcoY,
    width: marcoW, height: marcoH,
    borderColor: rgb(0.102, 0.227, 0.361),
    borderWidth: 2,
    color: rgb(0.98, 0.98, 0.98)
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
  if(esAnterior){
    datos.push({ label: 'TIPO', valor: `ADICI\u00d3N - Vigencia original ${exp.datos.anio_original || '?'}, Pago vigencia ${exp.datos.anio_pago || '?'}` });
  }
  datos.push({ label: 'TOTAL FOLIOS', valor: String(totalFolios) });

  for(const d of datos){
    // Label
    page.drawText(d.label + ':', {
      x: marcoX + 25, y,
      size: 9, font: fontBold,
      color: rgb(0.4, 0.4, 0.4)
    });
    // Valor
    const valorText = d.valor.length > 70 ? d.valor.substring(0, 70) + '...' : d.valor;
    page.drawText(valorText, {
      x: marcoX + 25, y: y - 14,
      size: 11, font: fontBold,
      color: rgb(0.1, 0.1, 0.1)
    });
    // Linea separadora
    y -= 38;
    if(y > marcoY + 20){
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
  page.drawText(`Generado el ${fecha}`, {
    x: centerX - fontNormal.widthOfTextAtSize(`Generado el ${fecha}`, 9) / 2,
    y: 50,
    size: 9, font: fontNormal,
    color: rgb(0.5, 0.5, 0.5)
  });

  const sistema = 'Sistema de Expedientes Contractuales';
  page.drawText(sistema, {
    x: centerX - fontNormal.widthOfTextAtSize(sistema, 8) / 2,
    y: 35,
    size: 8, font: fontNormal,
    color: rgb(0.6, 0.6, 0.6)
  });
}

/* ══════════════════════════════════════════
   INDICE CON HIPERVINCULOS
══════════════════════════════════════════ */
async function generarIndice(pdfDoc, pdfDocs, fontBold, fontNormal){
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

  let page = pdfDoc.addPage(PageSizes.Letter);
  const { width } = page.getSize();
  let y = dibujarCabecera(page, false);

  // Items (paginar automáticamente si se llenan)
  pdfDocs.forEach((item, idx) => {
    if(y < 70){
      // Agregar nueva página y redibujar cabecera
      page = pdfDoc.addPage(PageSizes.Letter);
      y = dibujarCabecera(page, true);
    }

    const num = String(idx + 1).padStart(2, '0');
    const docTipo = DOC_TIPOS.find(d => d.id === item.doc.tipo) || DOC_TIPOS_ADICION.find(d => d.id === item.doc.tipo);
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
      page.drawText(codigo, { x: 80, y, size: 9, font: fontBold, color: rgb(0.4, 0.4, 0.4) });
    }

    const nombreCorto = nombre.length > 45 ? nombre.substring(0, 45) + '...' : nombre;
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
