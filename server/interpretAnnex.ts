import { GoogleGenAI, Type } from '@google/genai';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import type {
  AnnexUploadKind,
  NormativeAnnexInterpretation,
  UninterpretedAnnexItem,
} from '../src/domain/annexInterpreterTypes.ts';

export interface InterpretAnnexRequestPayload {
  fileName: string;
  mimeType: string;
  base64Data: string;
  userNotes?: string;
}

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_TEXT_CHARS = 90000;

function classifyUploadFile(
  fileName: string,
  mimeType: string,
  byteLength: number
):
  | { ok: true; kind: AnnexUploadKind; normalizedMimeType: string }
  | { ok: false; error: string } {
  const dotIdx = fileName.lastIndexOf('.');
  const ext = dotIdx >= 0 ? fileName.slice(dotIdx).toLowerCase() : '';

  if (byteLength <= 0) {
    return { ok: false, error: 'El archivo cargado está vacío.' };
  }
  if (byteLength > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: 'El archivo excede el tamaño máximo permitido de 15 MB.',
    };
  }
  if (ext === '.pdf' || mimeType === 'application/pdf') {
    return { ok: true, kind: 'pdf', normalizedMimeType: 'application/pdf' };
  }
  if (
    ext === '.docx' ||
    mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return {
      ok: true,
      kind: 'word_docx',
      normalizedMimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }
  if (ext === '.doc' || mimeType === 'application/msword') {
    return {
      ok: true,
      kind: 'word_doc',
      normalizedMimeType: 'application/msword',
    };
  }
  if (
    ext === '.xlsx' ||
    ext === '.xls' ||
    mimeType ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel'
  ) {
    return {
      ok: true,
      kind: 'excel',
      normalizedMimeType:
        ext === '.xls'
          ? 'application/vnd.ms-excel'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
  if (
    ext === '.png' ||
    ext === '.jpg' ||
    ext === '.jpeg' ||
    ext === '.webp' ||
    mimeType.startsWith('image/')
  ) {
    const imgMime =
      ext === '.png' || mimeType === 'image/png'
        ? 'image/png'
        : ext === '.webp' || mimeType === 'image/webp'
        ? 'image/webp'
        : 'image/jpeg';
    return { ok: true, kind: 'image', normalizedMimeType: imgMime };
  }

  return {
    ok: false,
    error:
      'Formato no soportado. Cargue un archivo PDF (.pdf), Word (.docx / .doc), Excel (.xlsx / .xls) o imagen (.png, .jpg, .webp).',
  };
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function htmlToStructuredText(html: string): string {
  // Convert HTML tables into readable pipe-delimited rows so field specifications remain aligned
  let normalized = html
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/(t[dh])>/gi, ' | ')
    .replace(/<\/(p|h1|h2|h3|h4|h5|h6|li|div|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  normalized = decodeHtmlEntities(normalized)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return normalized;
}

function extractExcelStructuredText(buffer: Buffer): {
  text: string;
  preWarnings: UninterpretedAnnexItem[];
} {
  const preWarnings: UninterpretedAnnexItem[] = [];
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const parts: string[] = [];
  let totalChars = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Array<string | number | boolean | Date | null>>(
      sheet,
      { header: 1, defval: '' }
    );
    const nonEmptyRows = rows.filter((r) =>
      r.some((cell) => String(cell ?? '').trim().length > 0)
    );

    const header = `=== HOJA EXCEL: "${sheetName}" (${nonEmptyRows.length} filas con contenido) ===\n`;
    parts.push(header);
    totalChars += header.length;

    let truncatedInSheet = false;
    for (let rIdx = 0; rIdx < nonEmptyRows.length; rIdx++) {
      const rowCells = nonEmptyRows[rIdx].map((c) => {
        if (c instanceof Date) return c.toISOString().slice(0, 10);
        return String(c ?? '').replace(/\s+/g, ' ').trim();
      });
      // Trim trailing empty cells
      while (rowCells.length > 0 && rowCells[rowCells.length - 1] === '') {
        rowCells.pop();
      }
      const line = `Fila ${rIdx + 1}: | ${rowCells.join(' | ')} |\n`;
      if (totalChars + line.length > MAX_TEXT_CHARS) {
        truncatedInSheet = true;
        break;
      }
      parts.push(line);
      totalChars += line.length;
    }

    if (truncatedInSheet) {
      parts.push(`[... contenido restante de hoja "${sheetName}" omitido por tamaño ...]\n`);
      preWarnings.push({
        category: 'Legibilidad o formato del documento',
        aspect: `Hojas o filas extensas en Excel ("${sheetName}")`,
        reason:
          'El libro Excel excede el límite de caracteres procesables en una sola pasada y se recortaron filas finales.',
        recommendedAction:
          'Revise manualmente las filas finales de la hoja o divida el anexo por secciones si faltan campos.',
      });
    }
  }

  if (parts.length === 0) {
    preWarnings.push({
      category: 'Legibilidad o formato del documento',
      aspect: 'Libro Excel sin celdas legibles',
      reason: 'No se encontraron hojas con celdas de texto visibles en el archivo Excel.',
      recommendedAction:
        'Verifique que el archivo no contenga únicamente imágenes incrustadas o esté protegido con contraseña.',
    });
  }

  return { text: parts.join('\n'), preWarnings };
}

async function extractDocxStructuredText(buffer: Buffer): Promise<{
  text: string;
  preWarnings: UninterpretedAnnexItem[];
}> {
  const preWarnings: UninterpretedAnnexItem[] = [];
  const htmlResult = await mammoth.convertToHtml({ buffer });
  let text = htmlToStructuredText(htmlResult.value || '');

  if (text.length < 40) {
    const rawResult = await mammoth.extractRawText({ buffer });
    text = (rawResult.value || '').trim();
  }

  if (htmlResult.messages && htmlResult.messages.length > 0) {
    const notable = htmlResult.messages
      .map((m) => m.message)
      .filter((msg) => !/unrecognised paragraph style/i.test(msg))
      .slice(0, 5);
    if (notable.length > 0) {
      preWarnings.push({
        category: 'Legibilidad o formato del documento',
        aspect: 'Elementos incrustados o estilos especiales en Word (.docx)',
        reason: `Durante la lectura del documento Word se reportaron advertencias de conversión: ${notable.join(
          '; '
        )}.`,
        recommendedAction:
          'Verifique si el documento contenía capturas de pantalla o diagramas incrustados dentro del .docx; de ser así, adjúntelos como imagen o PDF.',
      });
    }
  }

  if (text.length > MAX_TEXT_CHARS) {
    text = text.slice(0, MAX_TEXT_CHARS) + '\n[... documento Word truncado por longitud ...]';
    preWarnings.push({
      category: 'Legibilidad o formato del documento',
      aspect: 'Extensión total del documento Word (.docx)',
      reason: 'El texto extraído superó el límite por solicitud y fue recortado al final.',
      recommendedAction:
        'Confirme si existen anexos técnicos al final del documento que requieran carga individual.',
    });
  }

  return { text, preWarnings };
}

function extractLegacyDocBestEffort(buffer: Buffer): {
  text: string;
  preWarnings: UninterpretedAnnexItem[];
} {
  const preWarnings: UninterpretedAnnexItem[] = [
    {
      category: 'Legibilidad o formato del documento',
      aspect: 'Formato Word binario heredado (.doc)',
      reason:
        'El formato binario .doc anterior a 2007 no preserva de forma determinística bordes de tablas complejas ni objetos incrustados OLE.',
      recommendedAction:
        'Verifique la estructura sugerida y, para fidelidad completa en tablas regulatorias, guarde o exporte el anexo como .docx o .pdf.',
    },
  ];

  // Extract UTF-16LE readable segments + ASCII printable sequences
  const utf16Text = buffer
    .toString('utf16le')
    .replace(/[^\p{L}\p{N}\p{P}\p{Zs}\n\r\t|;.,:/()-]/gu, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  const asciiText = buffer
    .toString('latin1')
    .replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  const segments: string[] = [];
  if (utf16Text.length > 80) {
    segments.push('--- TEXTO UTF-16 EXTRAÍDO ---\n' + utf16Text.slice(0, 45000));
  }
  if (asciiText.length > 80) {
    segments.push('--- TEXTO LATIN1 EXTRAÍDO ---\n' + asciiText.slice(0, 45000));
  }

  return {
    text: segments.join('\n\n').slice(0, MAX_TEXT_CHARS),
    preWarnings,
  };
}

const ANNEX_INTERPRETATION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    confidenceLevel: { type: Type.STRING, enum: ['Alta', 'Media', 'Baja'] },
    detectedDocumentMeta: {
      type: Type.OBJECT,
      properties: {
        documentTitle: { type: Type.STRING },
        normativeReference: { type: Type.STRING },
        country: { type: Type.STRING },
        regulatorShortOrName: { type: Type.STRING },
        formatCode: { type: Type.STRING },
        formatName: { type: Type.STRING },
        periodicity: { type: Type.STRING },
        reportingModality: {
          type: Type.STRING,
          enum: ['Periódico', 'Por evento', 'No especificado'],
        },
        applicableEntityTypes: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: [
        'documentTitle',
        'normativeReference',
        'country',
        'regulatorShortOrName',
        'formatCode',
        'formatName',
        'periodicity',
        'reportingModality',
        'applicableEntityTypes',
      ],
    },
    suggestedOutputConfig: {
      type: Type.OBJECT,
      properties: {
        outputName: { type: Type.STRING },
        outputCode: { type: Type.STRING },
        description: { type: Type.STRING },
        recommendedFamily: {
          type: Type.STRING,
          enum: ['CSV', 'TXT', 'XML', 'AVRO', 'XBRL', 'PDF', 'XLSX'],
        },
        encoding: {
          type: Type.STRING,
          enum: ['UTF-8', 'UTF-8 con BOM', 'ISO-8859-1', 'ASCII', 'Binario'],
        },
        fileNamePattern: { type: Type.STRING },
        delimiter: {
          type: Type.STRING,
          enum: [';', ',', '|', '\t', 'Ancho fijo', 'N/A'],
        },
        decimalSeparator: { type: Type.STRING, enum: [',', '.'] },
        includeHeader: { type: Type.BOOLEAN },
        includeFooter: { type: Type.BOOLEAN },
        includeControlTotals: { type: Type.BOOLEAN },
        emptyDatasetPolicy: {
          type: Type.STRING,
          enum: ['Omitir archivo', 'Producir vacío válido', 'Bloquear generación'],
        },
        xmlRootElement: { type: Type.STRING },
        xmlNamespace: { type: Type.STRING },
        hasHeaderRecord: { type: Type.BOOLEAN },
        hasFooterControlRecord: { type: Type.BOOLEAN },
      },
      required: [
        'outputName',
        'outputCode',
        'description',
        'recommendedFamily',
        'encoding',
        'fileNamePattern',
        'delimiter',
        'decimalSeparator',
        'includeHeader',
        'includeFooter',
        'includeControlTotals',
        'emptyDatasetPolicy',
        'xmlRootElement',
        'xmlNamespace',
        'hasHeaderRecord',
        'hasFooterControlRecord',
      ],
    },
    suggestedFields: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          technicalName: { type: Type.STRING },
          label: { type: Type.STRING },
          description: { type: Type.STRING },
          recordSection: {
            type: Type.STRING,
            enum: ['Cabecera', 'Detalle', 'Cierre / Totales', 'Nodo raíz / Hecho'],
          },
          dataType: {
            type: Type.STRING,
            enum: [
              'Texto',
              'Entero',
              'Decimal',
              'Fecha',
              'Booleano',
              'Catálogo',
              'Registro / Grupo',
            ],
          },
          length: { type: Type.NUMBER },
          precision: { type: Type.NUMBER },
          scale: { type: Type.NUMBER },
          startPosition: { type: Type.NUMBER },
          formatMask: { type: Type.STRING },
          paddingChar: { type: Type.STRING, enum: [' ', '0', 'Ninguno'] },
          alignment: { type: Type.STRING, enum: ['Izquierda', 'Derecha'] },
          required: { type: Type.BOOLEAN },
          defaultValue: { type: Type.STRING },
          evidenceNote: { type: Type.STRING },
        },
        required: [
          'technicalName',
          'label',
          'description',
          'recordSection',
          'dataType',
          'length',
          'precision',
          'scale',
          'startPosition',
          'formatMask',
          'paddingChar',
          'alignment',
          'required',
          'defaultValue',
          'evidenceNote',
        ],
      },
    },
    suggestedValidations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          layer: {
            type: Type.STRING,
            enum: [
              'Diseño y estructura',
              'Mapeo y tipos',
              'Datos del formato (DAQUE)',
              'Representación y archivo',
              'Coherencia de conjunto',
              'Precondición de entrega',
            ],
          },
          targetFieldTechnicalName: { type: Type.STRING },
          conditionExpression: { type: Type.STRING },
          severity: { type: Type.STRING, enum: ['Bloqueante', 'Advertencia'] },
          diagnosticMessage: { type: Type.STRING },
          evidenceNote: { type: Type.STRING },
        },
        required: [
          'name',
          'layer',
          'targetFieldTechnicalName',
          'conditionExpression',
          'severity',
          'diagnosticMessage',
          'evidenceNote',
        ],
      },
    },
    uninterpretedItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            enum: [
              'Identificación y país',
              'Tipo de archivo y codificación',
              'Campos y longitudes',
              'Tipos de dato y máscaras',
              'Validaciones y reglas DAQUE',
              'Transmisión y nomenclatura',
              'Legibilidad o formato del documento',
            ],
          },
          aspect: { type: Type.STRING },
          reason: { type: Type.STRING },
          recommendedAction: { type: Type.STRING },
        },
        required: ['category', 'aspect', 'reason', 'recommendedAction'],
      },
    },
  },
  required: [
    'summary',
    'confidenceLevel',
    'detectedDocumentMeta',
    'suggestedOutputConfig',
    'suggestedFields',
    'suggestedValidations',
    'uninterpretedItems',
  ],
};

function buildSystemPrompt(fileName: string, userNotes?: string): string {
  return `Eres TOTALiA®, el motor inteligente de arquitectura regulatoria de TÓTAL REPORT®.
Tu misión es analizar un anexo normativo regulatorio real o técnico cargado por el usuario (archivo "${fileName}") y proponer la estructura completa de la salida de datos junto con sus parámetros técnicos, validaciones y mapeo conceptual, en español técnico preciso.

REGLAS ESTRICTAS DE VERACIDAD Y TRANSPARENCIA (CERO INVENCIÓN):
1. Extrae únicamente lo que esté explícitamente documentado o claramente deducible en el documento adjunto.
2. Si un aspecto NO aparece en el documento, está borroso/cortado, resulta ambiguo o depende de una tabla anexa no incluida (por ejemplo: codificación exacta, delimitador, longitud de un campo, formato de fecha, separador decimal, reglas de cuadre/totales, nomenclatura oficial de archivo, o tipos de entidad obligados), **DEBES reportarlo explícitamente en el arreglo "uninterpretedItems"** indicando:
   - category (categoría exacta del aspecto)
   - aspect (nombre corto de lo que faltó o no se pudo interpretar)
   - reason (explicación clara de por qué no pudo interpretarse desde el documento)
   - recommendedAction (qué debe verificar o diligenciar manualmente el usuario).
3. En "evidenceNote" de cada campo y validación, cita la ubicación en el documento (ej. "Tabla 1, fila 3", "Sección 4.2", "Hoja Estructura, fila 8") o indica "Valor por defecto sugerido - pendiente confirmar en documento" si lo inferiste por necesidad técnica.
4. Para "recommendedFamily":
   - Usa "TXT" si es archivo plano posicional de ancho fijo o multirregistro.
   - Usa "CSV" si es archivo plano delimitado por ';', ',', '|' o tabulador.
   - Usa "XML" si especifica XML/XSD/SOAP.
   - Usa "XBRL" si especifica taxonomía XBRL / iXBRL.
   - Usa "AVRO" si especifica Apache Avro / OCF.
   - Usa "XLSX" si exige libro Excel / proforma tabular.
   - Usa "PDF" si exige documento paginado PDF / PDF-A.
5. Para "fileNamePattern", usa variables válidas de TÓTAL REPORT® cuando corresponda (ej. "{entidad}_{formato}_{periodo}_v{version}.{ext}" o el patrón oficial mencionado en el anexo).
6. Para campos decimales en TXT/CSV, asigna precision y scale adecuados (ej. 18 y 2); para campos no decimales pon precision: 0 y scale: 0. Para campos TXT posicionales calcula startPosition consecutivo empezando en 1 cuando esté disponible (o 0 si no es ancho fijo).
7. Para "technicalName", usa snake_case sin tildes ni caracteres especiales.
${userNotes && userNotes.trim() ? `\nNOTAS ADICIONALES DEL USUARIO:\n${userNotes.trim()}\n` : ''}
Devuelve ÚNICAMENTE el objeto JSON conforme al schema.`;
}

export async function interpretNormativeAnnex(
  payload: InterpretAnnexRequestPayload
): Promise<NormativeAnnexInterpretation> {
  const cleanName = (payload.fileName || '').trim();
  const cleanBase64 = (payload.base64Data || '').replace(/^data:[^;]+;base64,/, '').trim();
  if (!cleanName || !cleanBase64) {
    throw new Error('Debe adjuntar un archivo válido con su contenido.');
  }

  const buffer = Buffer.from(cleanBase64, 'base64');
  const validation = classifyUploadFile(cleanName, payload.mimeType || '', buffer.length);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const err = new Error(
      'Servicio TOTALiA® no disponible: falta configurar GEMINI_API_KEY en el entorno del servidor.'
    );
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const preWarnings: UninterpretedAnnexItem[] = [];
  const promptText = buildSystemPrompt(cleanName, payload.userNotes);

  // Build multimodal or extracted-text contents depending on upload type
  const parts: Array<
    { text: string } | { inlineData: { data: string; mimeType: string } }
  > = [{ text: promptText }];

  if (validation.kind === 'pdf' || validation.kind === 'image') {
    parts.push({
      inlineData: {
        data: cleanBase64,
        mimeType: validation.normalizedMimeType,
      },
    });
  } else if (validation.kind === 'excel') {
    const extracted = extractExcelStructuredText(buffer);
    preWarnings.push(...extracted.preWarnings);
    parts.push({
      text: `CONTENIDO EXTRAÍDO DEL ARCHIVO EXCEL ("${cleanName}"):\n\n${extracted.text}`,
    });
  } else if (validation.kind === 'word_docx') {
    const extracted = await extractDocxStructuredText(buffer);
    preWarnings.push(...extracted.preWarnings);
    parts.push({
      text: `CONTENIDO EXTRAÍDO DEL DOCUMENTO WORD (.docx "${cleanName}"):\n\n${extracted.text}`,
    });
  } else if (validation.kind === 'word_doc') {
    const extracted = extractLegacyDocBestEffort(buffer);
    preWarnings.push(...extracted.preWarnings);
    parts.push({
      text: `CONTENIDO EXTRAÍDO EN MODO COMPATIBILIDAD DE ARCHIVO WORD HEREDADO (.doc "${cleanName}"):\n\n${
        extracted.text ||
        '[No fue posible extraer texto legible suficiente del binario .doc.]'
      }`,
    });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: [{ role: 'user', parts }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: ANNEX_INTERPRETATION_SCHEMA,
    },
  });

  const rawJson = response.text;
  if (!rawJson) {
    throw new Error('TOTALiA® no devolvió una respuesta estructurada del anexo.');
  }

  const parsed = JSON.parse(rawJson) as Omit<
    NormativeAnnexInterpretation,
    'sourceFileName' | 'sourceKind'
  >;

  // Merge deterministic extraction warnings + model uninterpreted items without duplicating identical aspects
  const combinedUninterpreted: UninterpretedAnnexItem[] = [...preWarnings];
  for (const item of parsed.uninterpretedItems || []) {
    const alreadyExists = combinedUninterpreted.some(
      (u) => u.aspect.toLowerCase() === (item.aspect || '').toLowerCase()
    );
    if (!alreadyExists) {
      combinedUninterpreted.push(item);
    }
  }

  return {
    sourceFileName: cleanName,
    sourceKind: validation.kind,
    summary: parsed.summary || 'Análisis documental completado.',
    confidenceLevel: parsed.confidenceLevel || 'Media',
    detectedDocumentMeta: {
      documentTitle: parsed.detectedDocumentMeta?.documentTitle || cleanName,
      normativeReference: parsed.detectedDocumentMeta?.normativeReference || '',
      country: parsed.detectedDocumentMeta?.country || '',
      regulatorShortOrName: parsed.detectedDocumentMeta?.regulatorShortOrName || '',
      formatCode: parsed.detectedDocumentMeta?.formatCode || '',
      formatName: parsed.detectedDocumentMeta?.formatName || '',
      periodicity: parsed.detectedDocumentMeta?.periodicity || 'No especificado',
      reportingModality:
        parsed.detectedDocumentMeta?.reportingModality || 'No especificado',
      applicableEntityTypes:
        parsed.detectedDocumentMeta?.applicableEntityTypes || [],
    },
    suggestedOutputConfig: parsed.suggestedOutputConfig,
    suggestedFields: parsed.suggestedFields || [],
    suggestedValidations: parsed.suggestedValidations || [],
    uninterpretedItems: combinedUninterpreted,
  };
}
