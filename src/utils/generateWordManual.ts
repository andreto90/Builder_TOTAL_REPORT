/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
} from 'docx';

export async function generateAndDownloadWordManual(): Promise<void> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Title Page / Header
          new Paragraph({
            text: 'TÓTAL REPORT® & TOTALiA®',
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: 'MANUAL DE OPERACIÓN Y REFERENCIA TÉCNICA',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: 'Configurador de Salidas y Entregas Regulatorias — Guía Integral Enterprise',
            alignment: AlignmentType.CENTER,
            run: { italics: true, color: '555555' },
          }),
          new Paragraph({ text: '' }),

          // 1. Introducción y Arquitectura
          new Paragraph({
            text: '1. Introducción y Arquitectura del Dominio',
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            children: [
              new TextRun(
                'El Configurador de Salidas y Entregas Regulatorias de TÓTAL REPORT® es una plataforma empresarial avanzada para preparar, validar, versionar y transmitir información requerida por entidades de supervisión y control financiera (SFC, Supersolidaria, DIAN, SBS, BCRP). La arquitectura separa rigurosamente cuatro elementos fundamentales:'
              ),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Destino Regulatorio (Módulo D): ', bold: true }),
              new TextRun(
                'Formato receptor, periodicidad y condiciones institucionales de entrega.'
              ),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Estructura de Salida (Configurador / Módulo C): ', bold: true }),
              new TextRun(
                'Secciones, campos, tipos, longitudes, formato y delimitadores del archivo final.'
              ),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Origen de Información (Paso 3): ', bold: true }),
              new TextRun(
                'Informes generados por TÓTAL REPORT® o fuentes externas aportadas por el cliente.'
              ),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Lote de Datos: ', bold: true }),
              new TextRun(
                'Registros específicos de una entidad para un periodo y fecha de corte determinados.'
              ),
            ],
          }),
          new Paragraph({ text: '' }),

          // 2. Módulos Principales A–F
          new Paragraph({
            text: '2. Módulos Principales del Sistema (A–F)',
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            children: [
              new TextRun(
                'La barra de navegación lateral organiza el trabajo diario en seis módulos especializados:'
              ),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'A. Salidas Configuidas: ', bold: true }),
              new TextRun(
                'Catálogo principal, filtros multicriterio, exportación JSON y creación de nuevas salidas.'
              ),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'B. Tipos de Salida: ', bold: true }),
              new TextRun(
                'Familias técnicas soportadas (CSV, TXT, XML, AVRO, XBRL, PDF, XLSX) y sus parámetros de serialización.'
              ),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'C. Diseñador de Salidas (7 Pasos): ', bold: true }),
              new TextRun(
                'Asistente guiado para configurar desde los datos generales hasta la validación y entrega.'
              ),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'D. Formatos y Asociaciones: ', bold: true }),
              new TextRun(
                'Vínculo de salidas publicadas a uno o varios reportes normativos sin duplicación.'
              ),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'E. Versiones y Publicación: ', bold: true }),
              new TextRun(
                'Control de revisiones, gobierno de aprobación y asistencia inteligente de TOTALiA®.'
              ),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'F. Pruebas y Generación: ', bold: true }),
              new TextRun(
                'Simulación, validación DAQUE, generación de artefactos físicos y descarga.'
              ),
            ],
          }),
          new Paragraph({ text: '' }),

          // 3. Diseñador en 7 Pasos
          new Paragraph({
            text: '3. Guía Paso a Paso del Diseñador (Módulo C)',
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            children: [
              new TextRun(
                'El asistente en 7 pasos acompaña al implementador técnico y regulatorio en todo el ciclo de vida:'
              ),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Paso 1 (Datos Generales): ', bold: true }),
              new TextRun(
                'Definición de nombre funcional, código único, entidad supervisora, país, versión, vigencia y parámetros específicos de familia.'
              ),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Paso 2 (Estructura del Archivo): ', bold: true }),
              new TextRun(
                'Gestión de campos, tipos de datos, longitudes, unidades, alineación, padding, y vista previa interactiva de plantilla.'
              ),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Paso 3 (Origen de Datos y Mapeo): ', bold: true }),
              new TextRun(
                'Selección de informe del sistema (Ruta A) con contadores dinámicos de lotes o fuentes cliente (Ruta B). Asignación de campos con preservación rigurosa de ceros a la izquierda (ej. "000123").'
              ),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Paso 4 (Validaciones): ', bold: true }),
              new TextRun(
                'Constructor guiado de reglas de validación en múltiples capas (Diseño, Mapeo, DAQUE, Archivo, Coherencia).'
              ),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Paso 5 (Generación y Entrega): ', bold: true }),
              new TextRun(
                'Patrones de nombres dinámicos con variables de contexto, empaquetado y canales de transmisión.'
              ),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Paso 6 (Pruebas y Vista Previa): ', bold: true }),
              new TextRun(
                'Clasificación de 4 estados (ausencia de lote CES-DAT-000, 0 registros, política vacía, archivo físico generado). Permite diseñar y guardar borrador sin lotes, pero bloquea descarga si falta lote compatible.'
              ),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Paso 7 (Guardar y Publicar): ', bold: true }),
              new TextRun(
                'Resumen ejecutivo, envío a revisión, aprobación y publicación inmutable para proteger las entregas oficiales.'
              ),
            ],
          }),
          new Paragraph({ text: '' }),

          // 4. Asistencia TOTALiA
          new Paragraph({
            text: '4. Asistencia Contextual TOTALiA®',
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            children: [
              new TextRun(
                'TOTALiA® provee 8 acciones inteligentes basadas en evidencia normativa y contractual:'
              ),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: '1. Indicar siguiente paso: ', bold: true }),
              new TextRun('Diagnóstico de avance en 4 frentes con navegación directa.'),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: '2. Revisar estructura: ', bold: true }),
              new TextRun('Auditoría de campos y tipos contra esquemas normativos.'),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: '3. Sugerir correspondencias: ', bold: true }),
              new TextRun('Mapeo semántico automatizado con protección de identificadores.'),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: '4. Explicar este error: ', bold: true }),
              new TextRun('Análisis de causa raíz y guía paso a paso para códigos CES/DAQUE.'),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: '5. Ayúdame a crear / proponer campos: ', bold: true }),
              new TextRun('Plantillas estándar validadas.'),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: '6. Evaluar impacto: ', bold: true }),
              new TextRun('Identificación de formatos y canales consumidores afectados.'),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: '7. Comparar revisión con publicada: ', bold: true }),
              new TextRun('Diferencias estructurales antes de aprobar.'),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: '8. Analizar cambios en origen: ', bold: true }),
              new TextRun('Detección de columnas o tipos modificados en la fuente.'),
            ],
          }),
          new Paragraph({ text: '' }),

          // 5. Preguntas Frecuentes
          new Paragraph({
            text: '5. Preguntas Frecuentes y Manejo de Incidencias',
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '¿Qué significa el código CES-DAT-000 en el Paso 6?\n', bold: true }),
              new TextRun(
                'Indica que la estructura es 100% válida y se puede guardar como borrador, pero no existe un lote de datos compatible para la entidad y periodo seleccionados. La generación de archivos físicos y la descarga se habilitan al cargar o seleccionar un lote válido en el Paso 3.'
              ),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '\n¿Cómo se modifican salidas en estado Publicada?\n', bold: true }),
              new TextRun(
                'Las versiones publicadas son inmutables por seguridad regulatoria. El sistema exige hacer clic en "Crear revisión", generando un borrador editable que no interrumpe las transmisiones vigentes.'
              ),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Manual_Configurador_Salidas_Total_Report.docx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
