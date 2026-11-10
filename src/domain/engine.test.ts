import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeSourceStructureUpdateImpact,
  analyzeVersionImpact,
  auditCatalogImportEntries,
  computeOutputReadinessMatrix,
  evaluateAndFormatField,
  evaluateMultiSourceCombination,
  generateOutputArtifact,
  getCutoffDateForPeriod,
  inferSourceStructureFromSampleText,
  measureFieldLength,
  proposeFieldMappings,
  resolveDynamicFileName,
  resolveFormatAssociation,
  resolveSourceExecutionRows,
  validateFileNameAndPackage,
  validateFixedWidthStructure,
  filterRegulatoryFormats,
  validateAssociationContext,
  generateTotaliaFormatRecommendations,
  checkFormatDuplicateCandidates,
  evaluateFormatDependencies,
  evaluateFormatEditImpact,
  computeOrganismSummaries,
} from './engine';
import {
  evaluateCatalogImportImpact,
  generateSample152RowsCatalogExcelBuffer,
  parseAndValidateDataBatchMatrix,
  parseCatalogMatrix,
  parseDelimitedMatrix,
  parseExcelArrayBuffer,
  parseStructureDefinitionMatrix,
} from './fileParser';
import {
  ENTITY_TYPES_CATALOG,
  INITIAL_ASSOCIATIONS,
  INITIAL_CATALOG_SOURCE_FORMATS,
  INITIAL_CONFIGURED_OUTPUTS,
  INITIAL_DAQUE_PROFILES,
  INITIAL_DATA_CONTRACTS,
  INITIAL_EXECUTION_RUNS,
  INITIAL_OUTPUT_TYPES,
  INITIAL_RECEIVING_ORGANISMS,
  INITIAL_REGULATORY_FORMATS,
  INITIAL_TRANSMISSION_TYPES,
} from './seedData';
import { ConfiguredOutput, DataContract, DataContractField, StructureField, TransmissionType } from './types';

test('CSV generation reproduces exact PDF reference row: 31-10-2026;000123;Ana Pérez;1234,50 when 2026-10 batch is selected', () => {
  const csvOutput = {
    ...INITIAL_CONFIGURED_OUTPUTS.find((o) => o.id === 'OUT-CSV-DEMO-A')!,
    selectedSourceExecutionId: 'EXEC-CARTERA-202610-01',
  };
  const csvType = INITIAL_OUTPUT_TYPES.find((t) => t.id === 'TYPE-CSV-01')!;
  const contract = INITIAL_DATA_CONTRACTS[0];

  const result = generateOutputArtifact({
    output: csvOutput,
    outputType: csvType,
    contract,
    context: {
      entidad: 'Entidad DEMO',
      formato: 'DEMO-A',
      periodo: '2026-10',
      version: '1.4',
    },
  });

  assert.equal(result.isRealExecutableGeneration, true);
  assert.equal(result.findings.length, 0);
  const lines = result.content.split('\n');
  assert.equal(lines[0], '31-10-2026;000123;Ana Pérez;1234,50');
});

test('Selecting 2026-12 never mutates 2026-11 batch dates and blocks conformity with CES-DAT-000', () => {
  assert.equal(getCutoffDateForPeriod('2026-10'), '2026-10-31');
  assert.equal(getCutoffDateForPeriod('2026-11'), '2026-11-30');
  assert.equal(getCutoffDateForPeriod('2026-12'), '2026-12-31');

  const csvOutput = INITIAL_CONFIGURED_OUTPUTS.find((o) => o.id === 'OUT-CSV-DEMO-A')!;
  const csvType = INITIAL_OUTPUT_TYPES.find((t) => t.id === 'TYPE-CSV-01')!;
  const contract = INITIAL_DATA_CONTRACTS[0];

  // 1. In 2026-11, LOTE-TR-202611-OFICIAL-V2 (EXEC-CARTERA-202611-02) is compatible and active
  const novResult = generateOutputArtifact({
    output: csvOutput,
    outputType: csvType,
    contract,
    context: {
      entidad: 'Entidad DEMO',
      formato: 'DEMO-A',
      periodo: '2026-11',
      version: '1.4',
    },
  });
  assert.equal(novResult.findings.length, 0);
  const novLines = novResult.content.split('\n');
  assert.equal(novLines[0].startsWith('30-11-2026;000123;Ana Pérez;1234,50'), true);

  // 2. When changing global period to 2026-12, LOTE-TR-202611-OFICIAL-V2 is NOT compatible:
  const decResolution = resolveSourceExecutionRows({
    contract,
    periodo: '2026-12',
    entidad: 'Entidad DEMO',
    selectedSourceExecutionId: csvOutput.selectedSourceExecutionId,
    sourceCatalogEntryId: csvOutput.sourceCatalogEntryId,
  });

  assert.equal(decResolution.hasDataBatch, false);
  assert.equal(decResolution.rows.length, 0);
  assert.equal(Boolean(decResolution.incompatiblePinnedBatch), true);
  assert.equal(
    decResolution.incompatiblePinnedBatch!.executionCode,
    'LOTE-TR-202611-OFICIAL-V2'
  );
  // Original batch cutoffPeriod and cutoffDate MUST remain 2026-11 and 2026-11-30 (never rewritten to 2026-12-31)
  assert.equal(decResolution.incompatiblePinnedBatch!.cutoffPeriod, '2026-11');
  assert.equal(decResolution.incompatiblePinnedBatch!.cutoffDate, '2026-11-30');
  assert.equal(decResolution.incompatiblePinnedBatch!.rows[0].fecha_corte, '2026-11-30');

  // 3. Attempting to generate output in 2026-12 emits blocking finding CES-DAT-000
  const decResult = generateOutputArtifact({
    output: csvOutput,
    outputType: csvType,
    contract,
    context: {
      entidad: 'Entidad DEMO',
      formato: 'DEMO-A',
      periodo: '2026-12',
      version: '1.4',
    },
  });
  assert.equal(
    decResult.findings.some((f) => f.code === 'CES-DAT-000' && f.severity === 'Bloqueante'),
    true
  );
  assert.equal(decResult.readinessMatrix.overallBlockingCount > 0, true);
  assert.equal(decResult.readinessMatrix.downloadAvailabilityStatus.canDownload, false);
});

test('Multiple batches in 2026-11 and different entities are resolved without overwriting explicit selection', () => {
  const contract = INITIAL_DATA_CONTRACTS[0];

  // Entidad DEMO in 2026-11 has 2 compatible batches (PRELIMINAR-V1 and OFICIAL-V2)
  const prelimRes = resolveSourceExecutionRows({
    contract,
    periodo: '2026-11',
    entidad: 'Entidad DEMO',
    selectedSourceExecutionId: 'EXEC-CARTERA-202611-01',
    sourceCatalogEntryId: 'CAT-CO-SUPERSOL-CARTERA',
  });
  assert.equal(prelimRes.hasDataBatch, true);
  assert.equal(prelimRes.compatibleBatches.length, 2);
  assert.equal(prelimRes.resolvedBatch?.executionCode, 'LOTE-TR-202611-PRELIMINAR-V1');
  assert.equal(prelimRes.rows.length, 3);

  // Banco Supervisado CO in 2026-11 has its own batch (EXEC-CARTERA-BANCOCO-202611-01)
  const bancoCoRes = resolveSourceExecutionRows({
    contract,
    periodo: '2026-11',
    entidad: 'Banco Supervisado CO',
    selectedSourceExecutionId: undefined,
    sourceCatalogEntryId: 'CAT-CO-SUPERSOL-CARTERA',
  });
  assert.equal(bancoCoRes.hasDataBatch, true);
  assert.equal(bancoCoRes.compatibleBatches.length, 1);
  assert.equal(bancoCoRes.resolvedBatch?.executionCode, 'LOTE-TR-202611-BANCOCO-V1');
});

test('Mandatory catalog corrections for Peru (440, 620, 640) and Colombia DIAN (410, empty code Exógena) are exact', () => {
  const pe440 = INITIAL_CATALOG_SOURCE_FORMATS.find((e) => e.id === 'CAT-PE-440')!;
  assert.equal(pe440.country, 'Perú');
  assert.equal(pe440.internalNumberPeru, '440');
  assert.equal(pe440.formatCode, '440');
  assert.equal(pe440.reportName, 'Reporte Crediticio de Deudores');
  assert.equal(pe440.annexOrFormLabelPeru, 'Anexo 6');
  assert.equal(pe440.periodicity.toUpperCase(), 'MENSUAL');

  const pe640 = INITIAL_CATALOG_SOURCE_FORMATS.find((e) => e.id === 'CAT-PE-640')!;
  assert.equal(pe640.country, 'Perú');
  assert.equal(pe640.internalNumberPeru, '640');
  assert.equal(pe640.formatCode, '640');
  assert.equal(pe640.reportName, 'Balance de Comprobación de Saldos');
  assert.equal(pe640.annexOrFormLabelPeru, 'Forma F');
  assert.equal(pe640.periodicity.toUpperCase(), 'MENSUAL');

  const pe620 = INITIAL_CATALOG_SOURCE_FORMATS.find((e) => e.id === 'CAT-PE-620')!;
  assert.equal(pe620.country, 'Perú');
  assert.equal(pe620.internalNumberPeru, '620');
  assert.equal(pe620.formatCode, '620');
  assert.equal(pe620.reportName, 'Estado de Situación Financiera');
  assert.equal(pe620.annexOrFormLabelPeru, 'Forma A');
  assert.equal(pe620.periodicity.toUpperCase(), 'MENSUAL');

  const coDian410 = INITIAL_CATALOG_SOURCE_FORMATS.find((e) => e.id === 'CAT-CO-DIAN-410')!;
  assert.equal(coDian410.country, 'Colombia');
  assert.equal(coDian410.regulatorOrOrganism, 'DIAN');
  assert.equal(coDian410.formatCode, '410');
  assert.equal(coDian410.reportName, 'DECLARACION IMPUESTO GMF - SEMANAL');
  assert.equal(coDian410.periodicity, 'SEMANAL');

  const coVacio = INITIAL_CATALOG_SOURCE_FORMATS.find((e) => e.id === 'CAT-CO-VACIO-01')!;
  assert.equal(coVacio.country, 'Colombia');
  assert.equal(coVacio.regulatorOrOrganism, 'DIAN');
  assert.equal(coVacio.formatCode, '');
  assert.equal(coVacio.reportName, 'INFORMACION EXOGENA');
  assert.equal(coVacio.periodicity, 'ANUAL');
});

test('152-row Excel catalog import handles Row 1 title + Row 2 headers and reconciles without losing duplicate or empty codes', () => {
  const buf = generateSample152RowsCatalogExcelBuffer(INITIAL_CATALOG_SOURCE_FORMATS);
  const parsedExcel = parseExcelArrayBuffer(buf);

  assert.equal(parsedExcel.sheets.length, 1);
  // Row 1 is title, Row 2 (index 1) is detected as header
  assert.equal(parsedExcel.detectedHeaderRowIndex, 1);

  const catalogResult = parseCatalogMatrix(
    parsedExcel.sheets[0].rows,
    parsedExcel.detectedHeaderRowIndex,
    'Colombia',
    'Listado_de_Formatos_152.xlsx'
  );

  assert.equal(catalogResult.totalRowsRead, 152);
  assert.equal(catalogResult.entries.length, 152);
  assert.equal(catalogResult.rejectedRows.length, 0);

  // Verify empty code DIAN INFORMACION EXOGENA is preserved
  assert.equal(
    catalogResult.entries.some(
      (e) => e.regulatorOrOrganism === 'DIAN' && e.formatCode === '' && e.reportName === 'INFORMACION EXOGENA'
    ),
    true
  );

  // Verify reconciliation against existing catalog preserves linkedDataContractId
  const impact = evaluateCatalogImportImpact(
    INITIAL_CATALOG_SOURCE_FORMATS,
    catalogResult.entries
  );
  assert.equal(impact.mergedCatalog.length >= 152, true);
  const merged19 = impact.mergedCatalog.find(
    (e) => e.regulatorOrOrganism === 'Supersolidaria' && e.formatCode === '19'
  );
  assert.equal(merged19?.linkedDataContractId, 'DC-CARTERA-01');
});

test('Structure import creates field definitions with 0 data rows, and batch load validates & preserves leading zeros', () => {
  const structCsv = [
    'nombre_campo;etiqueta_funcional;tipo_dato;longitud;precision;escala;obligatorio;seccion;formato',
    'codigo_oficina;Código Oficina;Texto;6;;;SI;Detalle;',
    'saldo_capital;Saldo Capital;Decimal;18;18;2;SI;Detalle;',
  ].join('\n');

  const structMatrix = parseDelimitedMatrix(structCsv, ';');
  const parsedStruct = parseStructureDefinitionMatrix(structMatrix, 0);
  assert.equal(parsedStruct.fields.length, 2);
  assert.equal(parsedStruct.rejectedRows.length, 0);
  assert.equal(parsedStruct.fields[0].name, 'codigo_oficina');
  assert.equal(parsedStruct.fields[0].dataType, 'Texto');
  assert.equal(parsedStruct.fields[0].nullable, false);

  // Validate a data batch against these fields
  const batchCsv = [
    'codigo_oficina;saldo_capital',
    '000123;1450,75',
    '000987;NO_ES_NUMERO',
  ].join('\n');
  const batchMatrix = parseDelimitedMatrix(batchCsv, ';');
  const validatedBatch = parseAndValidateDataBatchMatrix(
    batchMatrix,
    0,
    parsedStruct.fields,
    '2026-11-30'
  );

  assert.equal(validatedBatch.totalRowsRead, 2);
  assert.equal(validatedBatch.acceptedRows.length, 1);
  assert.equal(validatedBatch.rejectedRows.length, 1);
  // Leading zeros MUST be preserved as string "000123"
  assert.equal(validatedBatch.acceptedRows[0].codigo_oficina, '000123');
  assert.equal(validatedBatch.acceptedRows[0].saldo_capital, 1450.75);
});

test('UTF-8 multibyte measurement and overflow block without silent truncation', () => {
  assert.equal(measureFieldLength('Ana Pérez Ñ', 'Caracteres'), 11);
  assert.equal(measureFieldLength('Ana Pérez Ñ', 'Bytes'), 13);

  const csvOutput = INITIAL_CONFIGURED_OUTPUTS.find((o) => o.id === 'OUT-CSV-DEMO-A')!;
  const nameField = csvOutput.fields.find((f) => f.technicalName === 'nombre')!;

  const longRow = {
    nombre: 'Corporación Financiera Internacional de Inversiones',
    apellido_1: 'Latinoamericanas S.A.S.',
  };

  const res = evaluateAndFormatField(
    nameField,
    longRow,
    0,
    { entidad: 'Entidad DEMO', formato: 'DEMO-A', periodo: '2026-10', version: '1.4' },
    ',',
    false
  );

  // Must NOT truncate silently and must emit CES-STR-005 blocking finding
  assert.equal(res.formatted.length > 50, true);
  assert.equal(res.findings.some((f) => f.code === 'CES-STR-005' && f.severity === 'Bloqueante'), true);
});

test('proposeFieldMappings only assigns high-confidence matches and never guesses unrelated columns', () => {
  const contract = INITIAL_DATA_CONTRACTS[0];
  const sampleFields: StructureField[] = [
    {
      ...INITIAL_CONFIGURED_OUTPUTS[1].fields[0],
      id: 'F-1',
      technicalName: 'nro_obligacion',
      label: 'Número de Obligación',
      dataType: 'Texto',
      mapping: {
        transformationKind: 'Directo',
        sourceContractId: contract.id,
        sourceField: '',
        expression: '',
        isParameterizedPoint: false,
        emptyTreatment: 'Error bloqueante',
        mappingStatus: 'Sin asignar',
      },
    },
    {
      ...INITIAL_CONFIGURED_OUTPUTS[1].fields[0],
      id: 'F-2',
      technicalName: 'nit',
      label: 'NIT del Deudor (no existe en DC-CARTERA-01)',
      dataType: 'Texto',
      mapping: {
        transformationKind: 'Directo',
        sourceContractId: contract.id,
        sourceField: '',
        expression: '',
        isParameterizedPoint: false,
        emptyTreatment: 'Error bloqueante',
        mappingStatus: 'Sin asignar',
      },
    },
  ];

  const res = proposeFieldMappings(sampleFields, contract.fields, contract.id, false);
  assert.equal(res.matchedCount, 1);
  assert.equal(res.unmatchedCount, 1);
  assert.equal(res.updatedFields[0].mapping.sourceField, 'id_obligacion');
  assert.equal(
    res.updatedFields[0].mapping.mappingStatus,
    'Propuesta automática (Requiere confirmación)'
  );
  // Unmatched field MUST remain unassigned (''), never falling back to id_obligacion!
  assert.equal(res.updatedFields[1].mapping.sourceField, '');
  assert.equal(res.updatedFields[1].mapping.mappingStatus, 'Sin asignar');
});

test('Custom validationRules in Step 4 are evaluated and emit findings when violated', () => {
  const csvOutput = INITIAL_CONFIGURED_OUTPUTS.find((o) => o.id === 'OUT-CSV-DEMO-A')!;
  const csvType = INITIAL_OUTPUT_TYPES.find((t) => t.id === 'TYPE-CSV-01')!;
  const contract = INITIAL_DATA_CONTRACTS[0];

  const outputWithStrictRule = {
    ...csvOutput,
    validationRules: [
      ...csvOutput.validationRules,
      {
        id: 'VR-CUSTOM-TEST',
        code: 'USR-VAL-99',
        name: 'Saldo mínimo superior a 5000',
        layer: 'Representación y archivo' as const,
        targetFieldOrRole: 'saldo',
        conditionExpression: 'saldo >= 5000',
        severity: 'Bloqueante' as const,
        isNormativeProtected: false,
        owner: 'Política de salida y entrega' as const,
        diagnosticMessage: 'El saldo debe ser mayor o igual a 5000.',
        enabled: true,
      },
    ],
  };

  const result = generateOutputArtifact({
    output: outputWithStrictRule,
    outputType: csvType,
    contract,
    context: { entidad: 'Entidad DEMO', formato: 'DEMO-A', periodo: '2026-11', version: '1.4' },
  });

  // Row 1 has saldo = 1234.50, which violates saldo >= 5000
  assert.equal(result.findings.some((f) => f.code === 'USR-VAL-99' && f.severity === 'Bloqueante'), true);
});

test('Package validator detects duplicate filenames in packageMembers', () => {
  const csvOutput = INITIAL_CONFIGURED_OUTPUTS.find((o) => o.id === 'OUT-CSV-DEMO-A')!;
  const dupOutput = {
    ...csvOutput,
    composition: {
      ...csvOutput.composition,
      packageMembers: [
        ...csvOutput.composition.packageMembers,
        {
          id: 'PM-DUP-1',
          role: 'Control / Resumen' as const,
          cardinality: '0..1 (Opcional)' as const,
          outputDefinitionId: csvOutput.id,
          outputVersion: csvOutput.version,
          fileNamePattern: '{entidad}_RESUMEN.txt',
          includeInRegulatoryDelivery: true,
          allowRoleMappingOverride: true,
        },
        {
          id: 'PM-DUP-2',
          role: 'Anexo' as const,
          cardinality: '0..1 (Opcional)' as const,
          outputDefinitionId: csvOutput.id,
          outputVersion: csvOutput.version,
          fileNamePattern: '{entidad}_RESUMEN.txt',
          includeInRegulatoryDelivery: true,
          allowRoleMappingOverride: true,
        },
      ],
    },
  };

  const pkgFindings = validateFileNameAndPackage(dupOutput, {
    entidad: 'Entidad DEMO',
    formato: 'DEMO-A',
    periodo: '2026-11',
    version: '1.4',
  });
  assert.equal(pkgFindings.some((f) => f.code === 'CES-PKG-005'), true);
});

test('Readiness matrix distinguishes AVRO non-binary validation from physical CSV generation', () => {
  const avroType = INITIAL_OUTPUT_TYPES.find((t) => t.id === 'TYPE-AVRO-01')!;
  const matrix = computeOutputReadinessMatrix({
    outputType: avroType,
    findings: [],
  });

  assert.equal(
    matrix.artifactGenerationStatus.state,
    'No generado (solo validación de estructura/esquema)'
  );
  assert.equal(matrix.downloadAvailabilityStatus.canDownload, false);
  assert.equal(
    matrix.deliveryReadinessStatus.state,
    'Validación superada (Sin generador binario en esta versión)'
  );
});

test('Fixed-width TXT position validator detects overlapping positions', () => {
  const txtOutput = INITIAL_CONFIGURED_OUTPUTS.find((o) => o.id === 'OUT-TXT-POSICIONAL')!;
  const cleanFindings = validateFixedWidthStructure(txtOutput.fields);
  assert.equal(cleanFindings.length, 0);

  // Introduce an overlap between field 1 (1..8) and field 2 (start at 6 instead of 9)
  const overlappingFields = txtOutput.fields.map((f, idx) =>
    idx === 1 ? { ...f, startPosition: 6 } : f
  );
  const overlapFindings = validateFixedWidthStructure(overlappingFields);
  assert.equal(overlapFindings.some((f) => f.code === 'CES-TXT-001'), true);
});

test('Association resolver enforces single-match and blocks on overlapping validity ranges', () => {
  const resUnique = resolveFormatAssociation({
    associations: INITIAL_ASSOCIATIONS,
    formatId: 'FMT-DEMO-01',
    transmissionTypeId: 'TX-ORDINARIO',
    modality: 'Inicial',
    environment: 'QA',
    cutoffPeriod: '2026-11',
  });
  assert.equal(resUnique.status, 'Coincidencia única');
  assert.equal(resUnique.resolvedAssociation?.code, 'DEMO-ASO-01');

  // Add an overlapping active association for the exact same context
  const duplicateAssoc = {
    ...INITIAL_ASSOCIATIONS[0],
    id: 'ASO-CONFLICT',
    code: 'DEMO-ASO-CONFLICT',
    configuredOutputVersion: '3.1',
  };
  const resAmbiguous = resolveFormatAssociation({
    associations: [...INITIAL_ASSOCIATIONS, duplicateAssoc],
    formatId: 'FMT-DEMO-01',
    transmissionTypeId: 'TX-ORDINARIO',
    modality: 'Inicial',
    environment: 'QA',
    cutoffPeriod: '2026-11',
  });
  assert.equal(resAmbiguous.status, 'Bloqueo: Ambigüedad por solapamiento');
});

test('Shared output with different Format DAQUE profiles enforces format-specific data rules', () => {
  const csvOutput = {
    ...INITIAL_CONFIGURED_OUTPUTS.find((o) => o.id === 'OUT-CSV-DEMO-A')!,
    selectedSourceExecutionId: 'EXEC-ZERO-SALDO',
  };
  const csvType = INITIAL_OUTPUT_TYPES.find((t) => t.id === 'TYPE-CSV-01')!;
  const baseContract = INITIAL_DATA_CONTRACTS[0];
  const contractWithZeroSaldo = {
    ...baseContract,
    executionBatches: [
      {
        id: 'EXEC-ZERO-SALDO',
        executionCode: 'LOTE-ZERO-SALDO',
        cutoffPeriod: '2026-11',
        cutoffDate: '2026-11-30',
        entityScope: 'Entidad DEMO',
        sourceCatalogEntryId: csvOutput.sourceCatalogEntryId,
        originKind: 'Carga de lote de fuente cliente' as const,
        createdAt: '2026-11-30 10:00',
        recordCount: 1,
        validationStatus: 'Validado y conforme' as const,
        rows: [{ ...baseContract.demoRows[0], fecha_corte: '2026-11-30', saldo: 0 }],
      },
    ],
  };

  const daqueDemo01 = INITIAL_DAQUE_PROFILES.find((d) => d.id === 'DAQUE-PROF-01')!;
  const daqueDemo02 = INITIAL_DAQUE_PROFILES.find((d) => d.id === 'DAQUE-PROF-02')!;

  const runDemo01 = generateOutputArtifact({
    output: csvOutput,
    outputType: csvType,
    contract: contractWithZeroSaldo,
    daqueProfile: daqueDemo01,
    context: { entidad: 'Entidad DEMO', formato: 'DEMO-01', periodo: '2026-11', version: '1.4' },
  });
  assert.equal(
    runDemo01.findings.some((f) => f.layer === 'Datos del formato (DAQUE)'),
    false
  );

  const runDemo02 = generateOutputArtifact({
    output: csvOutput,
    outputType: csvType,
    contract: contractWithZeroSaldo,
    daqueProfile: daqueDemo02,
    context: { entidad: 'Entidad DEMO', formato: 'DEMO-02', periodo: '2026-11', version: '1.4' },
  });
  assert.equal(
    runDemo02.findings.some((f) => f.code === 'DAQ-R08' && f.severity === 'Bloqueante'),
    true
  );
});

test('Dynamic file name resolution replaces context variables and appends extension', () => {
  const name = resolveDynamicFileName(
    'saldos_{entidad}_{formato}_{periodo}_v{version}',
    { entidad: 'BANCODEMO', formato: 'DEMO-01', periodo: '2026-11', version: '1.4' },
    'csv'
  );
  assert.equal(name, 'saldos_BANCODEMO_DEMO-01_2026-11_v1_4.csv');
});

test('Version impact analyzer identifies consumer formats and structural changes', () => {
  const avroOutput = INITIAL_CONFIGURED_OUTPUTS.find((o) => o.id === 'OUT-AVRO-CARTERA')!;
  const modifiedOutput = {
    ...avroOutput,
    fields: avroOutput.fields.map((f) =>
      f.technicalName === 'saldo' ? { ...f, precision: 20, length: 20 } : f
    ),
  };

  const impact = analyzeVersionImpact({
    output: modifiedOutput,
    previousFields: avroOutput.fields,
    associations: INITIAL_ASSOCIATIONS,
    formats: INITIAL_REGULATORY_FORMATS,
  });

  assert.equal(impact.affectedAssociations.length, 3);
  assert.equal(impact.affectedFormats.length, 3);
  assert.equal(impact.structuralChanges.length > 0, true);
});

test('Sample structure inference preserves leading zeros as Texto, warns on ambiguous dates/numbers, and never deduces mandatory', () => {
  const sampleCsv = [
    'codigo_oficina;id_obligacion;fecha_operacion;valor_avaluo',
    '000123;99812;04/05/2026;1.234,50',
    '000456;99813;06/07/2026;2.500,00',
  ].join('\n');

  const inferred = inferSourceStructureFromSampleText({
    rawText: sampleCsv,
    delimiter: 'Auto',
    headerRowIndex: 1,
  });

  assert.equal(inferred.detectedDelimiter, ';');
  assert.equal(inferred.inferredFields.length, 4);

  const codOficina = inferred.inferredFields.find((f) => f.name === 'codigo_oficina')!;
  // Must stay Texto to preserve "000123"!
  assert.equal(codOficina.dataType, 'Texto');
  assert.equal(Boolean(codOficina.formatWarning), true);

  const fechaOp = inferred.inferredFields.find((f) => f.name === 'fecha_operacion')!;
  assert.equal(fechaOp.dataType, 'Fecha');
  assert.equal(Boolean(fechaOp.formatWarning), true);

  const valorAval = inferred.inferredFields.find((f) => f.name === 'valor_avaluo')!;
  assert.equal(valorAval.dataType, 'Decimal');
  assert.equal(Boolean(valorAval.formatWarning), true);

  // Even though 100% of sample rows have values, nullable must remain true and propertyOrigin must be Inferida de muestra
  for (const field of inferred.inferredFields) {
    assert.equal(field.nullable, true);
    assert.equal(field.propertyOrigin, 'Inferida de muestra (Requiere confirmación)');
  }
});

test('Multi-source evaluation distinguishes separate sections from explicit joins and blocks implicit joins', () => {
  const primary = INITIAL_DATA_CONTRACTS.find((c) => c.id === 'DC-CARTERA-01')!;
  const evalRes = evaluateMultiSourceCombination({
    primaryContract: primary,
    allContracts: INITIAL_DATA_CONTRACTS,
    periodo: '2026-11',
    entidad: 'Entidad DEMO',
    attachedSources: [
      {
        alias: 'FUENTE_PRINCIPAL',
        label: 'Cartera Primaria',
        originRoute: 'Formato generado por TÓTAL REPORT®',
        dataContractId: 'DC-CARTERA-01',
        sourceCatalogEntryId: 'CAT-CO-301',
        targetSection: 'Detalle',
      },
      {
        alias: 'FUENTE_ENCABEZADO',
        label: 'Parámetros Cabecera',
        originRoute: 'Fuente proporcionada por el cliente',
        dataContractId: 'DC-CLI-ENCABEZADO-01',
        targetSection: 'Cabecera',
        combinationRule: {
          joinWithAlias: 'FUENTE_PRINCIPAL',
          relationType: 'Sin unión (Secciones separadas)',
          leftKeyField: '',
          rightKeyField: '',
        },
      },
      {
        alias: 'FUENTE_GARANTIAS_SIN_LLAVE',
        label: 'Garantías sin llave',
        originRoute: 'Fuente proporcionada por el cliente',
        dataContractId: 'DC-CLI-GARANTIAS-01',
        targetSection: 'Detalle',
        combinationRule: {
          joinWithAlias: 'FUENTE_PRINCIPAL',
          relationType: '1:1 Exacta por clave única',
          leftKeyField: '',
          rightKeyField: '',
        },
      },
      {
        alias: 'FUENTE_GARANTIAS_EXPLICITA',
        label: 'Garantías con llave explícita',
        originRoute: 'Fuente proporcionada por el cliente',
        dataContractId: 'DC-CLI-GARANTIAS-01',
        targetSection: 'Detalle',
        combinationRule: {
          joinWithAlias: 'FUENTE_PRINCIPAL',
          relationType: '1:1 Exacta por clave única',
          leftKeyField: 'id_obligacion',
          rightKeyField: 'id_obligacion',
        },
      },
    ],
  });

  const headerEval = evalRes.sourceEvaluations.find((e) => e.alias === 'FUENTE_ENCABEZADO')!;
  assert.equal(headerEval.status, 'Secciones independientes (Sin cruce de filas)');
  assert.equal(headerEval.resultingRowCount, 4);

  const missingKeyEval = evalRes.sourceEvaluations.find((e) => e.alias === 'FUENTE_GARANTIAS_SIN_LLAVE')!;
  assert.equal(missingKeyEval.status, 'Bloqueo de cruce');

  const explicitJoinEval = evalRes.sourceEvaluations.find((e) => e.alias === 'FUENTE_GARANTIAS_EXPLICITA')!;
  // Primary has 4 rows (000123, 000124, 000125, 000126). Secondary has 3 rows (000123, 000124, 000125) -> 3 matched, 1 orphan
  assert.equal(explicitJoinEval.matchedPrimaryCount, 3);
  assert.equal(explicitJoinEval.orphanPrimaryCount, 1);
  assert.equal(explicitJoinEval.resultingRowCount, 4);
});

test('analyzeSourceStructureUpdateImpact flags fields whose source column disappeared or changed type', () => {
  const csvOutput = INITIAL_CONFIGURED_OUTPUTS.find((o) => o.id === 'OUT-CSV-DEMO-A')!;
  const baseContract = INITIAL_DATA_CONTRACTS.find((c) => c.id === 'DC-CARTERA-01')!;

  // Remove 'saldo' column from updated contract
  const updatedContract = {
    ...baseContract,
    version: 'v4.0',
    fields: baseContract.fields.filter((f) => f.name !== 'saldo'),
  };

  const impact = analyzeSourceStructureUpdateImpact({
    fields: csvOutput.fields,
    updatedContract,
  });

  assert.equal(impact.impactedCount, 1);
  assert.equal(impact.impactedDetails[0].technicalName, 'importe');
  const importeField = impact.updatedFields.find((f) => f.technicalName === 'importe')!;
  assert.equal(importeField.mapping.mappingStatus, 'Requiere revisión por cambio en fuente');
});

test('Catalog audit handles duplicate code 410 across Colombia DIAN and Peru SBS and detects Excel anomalies', () => {
  const audit = auditCatalogImportEntries(INITIAL_CATALOG_SOURCE_FORMATS);

  // Code 410 exists in both Colombia DIAN and Peru SBS without collision
  const group410 = audit.sharedCodeGroups.find((g) => g.formatCode === '410');
  assert.equal(Boolean(group410), true);
  assert.equal(group410!.entries.length, 2);

  // Anomalies detected for MENSUAL in code, EXÓGENA in periodicity, and empty code
  assert.equal(audit.anomalies.length >= 3, true);
  assert.equal(audit.withStructureCount >= 4, true);
  assert.equal(audit.pendingStructureCount >= 5, true);
});

test('Structure-only source without data batch for the period is distinguished from source with execution batch', () => {
  const structOnlyContract = INITIAL_DATA_CONTRACTS.find((c) => c.id === 'DC-CO-DIAN-1001')!;
  const resolved = resolveSourceExecutionRows({
    contract: structOnlyContract,
    periodo: '2026-11',
  });
  assert.equal(resolved.hasDataBatch, false);
  assert.equal(resolved.rows.length, 0);
});

test('Customer source end-to-end: parsing raw data, structure recognition, leading zeros preservation, field mapping and physical CSV artifact generation', () => {
  const rawCustomerCSV = [
    'fecha_corte;id_credito;nit_cliente;saldo_capital;tipo_moneda',
    '2026-11-30;000123;900123456;12500000.50;COP',
    '2026-11-30;000124;800987654;450000.00;COP',
  ].join('\n');

  // 1. Structure inference and file parsing
  const inferred = inferSourceStructureFromSampleText({ rawText: rawCustomerCSV });
  assert.equal(inferred.inferredFields.length, 5);
  assert.equal(inferred.inferredFields.some((f) => f.name === 'id_credito'), true);

  // 2. Parse batch and ensure leading zeros are preserved as exact strings
  const matrix = parseDelimitedMatrix(rawCustomerCSV, ';');
  const batchResult = parseAndValidateDataBatchMatrix(
    matrix,
    0,
    inferred.inferredFields,
    '2026-11-30'
  );

  assert.equal(batchResult.acceptedRows.length, 2);
  assert.equal(batchResult.rejectedRows.length, 0);
  assert.equal(batchResult.acceptedRows[0]['id_credito'], '000123'); // zero preserved!
  assert.equal(batchResult.acceptedRows[1]['id_credito'], '000124');

  // 3. Assemble customer DataContract with execution batch
  const customerContract = {
    id: 'DC-CLIENTE-TEST-01',
    code: 'FUENTE-CLIENTE-CARTERA',
    name: 'Extracción Core Cartera Cliente',
    sourceSystem: 'Fuente Externa Registrada por el Cliente' as const,
    originRoute: 'Fuente proporcionada por el cliente' as const,
    version: 'v1.0',
    status: 'Activo' as const,
    granularity: 'Por obligación',
    primaryKey: ['id_credito'],
    snapshotId: 'SNAP-CLI-TEST',
    demoRows: batchResult.acceptedRows,
    fields: inferred.inferredFields,
    executionBatches: [
      {
        id: 'BATCH-CLI-2026-11',
        contractId: 'DC-CLIENTE-TEST-01',
        executionCode: 'EXEC-CLI-202611-01',
        cutoffPeriod: '2026-11',
        cutoffDate: '2026-11-30',
        entityScope: 'Cooperativa Financiera de Antioquia',
        rows: batchResult.acceptedRows,
        recordCount: batchResult.acceptedRows.length,
        originKind: 'Carga de lote de fuente cliente' as const,
        createdAt: '2026-11-30T10:00:00Z',
        validationStatus: 'Validado y conforme' as const,
        provenanceNote: 'Carga real desde archivo CSV de cliente',
      },
    ],
  };

  // 4. Map output fields to customer source columns
  const outputType = INITIAL_OUTPUT_TYPES.find((t) => t.id === 'TYPE-CSV-01')!;
  const testOutput: ConfiguredOutput = {
    ...INITIAL_CONFIGURED_OUTPUTS[0],
    id: 'OUT-TEST-CLIENTE',
    dataContractId: customerContract.id,
    sourceCatalogEntryId: undefined,
    selectedSourceExecutionId: undefined,
    attachedSources: [],
    validationRules: [],
    composition: {
      ...INITIAL_CONFIGURED_OUTPUTS[0].composition,
      includeHeader: true,
      delimiter: ';' as const,
    },
    fields: [
      {
        ...INITIAL_CONFIGURED_OUTPUTS[0].fields[0],
        id: 'FLD-1',
        technicalName: 'corte',
        label: 'Fecha Corte',
        recordSection: 'Detalle',
        dataType: 'Fecha' as const,
        formatMask: 'yyyy-MM-dd',
        length: 10,
        required: true,
        order: 1,
        mapping: {
          ...INITIAL_CONFIGURED_OUTPUTS[0].fields[0].mapping,
          sourceField: 'fecha_corte',
          sourceContractId: customerContract.id,
          transformationKind: 'Directo' as const,
          mappingStatus: 'Confirmado por usuario' as const,
        },
      },
      {
        ...INITIAL_CONFIGURED_OUTPUTS[0].fields[1],
        id: 'FLD-2',
        technicalName: 'obligacion',
        label: 'Obligación',
        recordSection: 'Detalle',
        dataType: 'Texto' as const,
        length: 12,
        required: true,
        order: 2,
        mapping: {
          ...INITIAL_CONFIGURED_OUTPUTS[0].fields[1].mapping,
          sourceField: 'id_credito',
          sourceContractId: customerContract.id,
          transformationKind: 'Directo' as const,
          mappingStatus: 'Confirmado por usuario' as const,
        },
      },
      {
        ...INITIAL_CONFIGURED_OUTPUTS[0].fields[3],
        id: 'FLD-3',
        technicalName: 'saldo',
        label: 'Saldo Capital',
        recordSection: 'Detalle',
        dataType: 'Decimal' as const,
        length: 18,
        required: true,
        order: 3,
        mapping: {
          ...INITIAL_CONFIGURED_OUTPUTS[0].fields[3].mapping,
          sourceField: 'saldo_capital',
          sourceContractId: customerContract.id,
          transformationKind: 'Directo' as const,
          mappingStatus: 'Confirmado por usuario' as const,
        },
      },
    ],
  };

  // 5. Generate physical CSV artifact from customer source batch
  const genResult = generateOutputArtifact({
    output: testOutput,
    outputType,
    contract: customerContract,
    allContracts: [customerContract],
    context: {
      entidad: 'Cooperativa Financiera de Antioquia',
      formato: 'CLI_OUT',
      periodo: '2026-11',
      version: '1',
      consecutivo: '01',
    },
    entidad: 'Cooperativa Financiera de Antioquia',
  });

  assert.equal(genResult.isRealExecutableGeneration, true);
  assert.equal(genResult.rowsProcessed, 2);
  assert.equal(genResult.readinessMatrix.downloadAvailabilityStatus.canDownload, true);
  const lines = genResult.content.trim().split(/\r?\n/);
  assert.equal(lines.length, 3); // header + 2 rows
  assert.equal(lines[0], 'corte;obligacion;saldo');
  assert.equal(lines[1].includes('000123'), true); // Leading zero fully preserved in generated artifact!
  assert.equal(lines[2].includes('000124'), true);
});

test('Step 6 physical download is blocked when no compatible data batch exists (CES-DAT-000) and enabled when compatible batch is present', () => {
  const output = INITIAL_CONFIGURED_OUTPUTS.find((o) => o.id === 'OUT-CSV-DEMO-A')!;
  const outputType = INITIAL_OUTPUT_TYPES.find((t) => t.id === output.outputTypeId)!;
  const contract = INITIAL_DATA_CONTRACTS.find((c) => c.id === output.dataContractId)!;
  const daqueProfile = INITIAL_DAQUE_PROFILES[0];

  // Period 2026-12 has NO compatible batch
  const resultWithoutBatch = generateOutputArtifact({
    output,
    outputType,
    contract,
    allContracts: INITIAL_DATA_CONTRACTS,
    daqueProfile,
    context: {
      entidad: 'Entidad DEMO',
      formato: output.code,
      periodo: '2026-12',
      version: output.version,
      consecutivo: '01',
    },
    entidad: 'Entidad DEMO',
  });

  assert.equal(resultWithoutBatch.isRealExecutableGeneration, false);
  assert.equal(resultWithoutBatch.readinessMatrix.downloadAvailabilityStatus.canDownload, false);
  assert.equal(resultWithoutBatch.findings.some((f) => f.code === 'CES-DAT-000'), true);

  // Period 2026-11 HAS a compatible batch
  const resultWithBatch = generateOutputArtifact({
    output,
    outputType,
    contract,
    allContracts: INITIAL_DATA_CONTRACTS,
    daqueProfile,
    context: {
      entidad: 'Entidad DEMO',
      formato: output.code,
      periodo: '2026-11',
      version: output.version,
      consecutivo: '01',
    },
    entidad: 'Entidad DEMO',
  });

  assert.equal(resultWithBatch.isRealExecutableGeneration, true);
  assert.equal(resultWithBatch.readinessMatrix.downloadAvailabilityStatus.canDownload, true);
  assert.equal(resultWithBatch.findings.some((f) => f.code === 'CES-DAT-000'), false);
});

test('Period 2026-12 has 7 structure-available reports but 0 compatible batches, and returning to 2026-11 restores batch without mutating dates', () => {
  // Check available system reports for 2026-12
  const reportsWithStructure = INITIAL_CATALOG_SOURCE_FORMATS.filter((entry) => {
    if (!entry.linkedDataContractId) return false;
    const contract = INITIAL_DATA_CONTRACTS.find((c) => c.id === entry.linkedDataContractId);
    return Boolean(contract && contract.fields.length > 0);
  });
  assert.equal(reportsWithStructure.length, 7);

  // When evaluated for 2026-12: all 7 indicate hasDataBatch = false
  const batches202612 = reportsWithStructure.map((entry) => {
    const contract = INITIAL_DATA_CONTRACTS.find((c) => c.id === entry.linkedDataContractId)!;
    return resolveSourceExecutionRows({
      contract,
      periodo: '2026-12',
      entidad: 'Entidad DEMO',
      sourceCatalogEntryId: entry.id,
    });
  });
  const readyCount202612 = batches202612.filter((b) => b.hasDataBatch && b.rows.length > 0).length;
  assert.equal(readyCount202612, 0); // 0 with data! Not declared ready for generation!

  // When evaluated for 2026-11: primary reports have compatible batches
  const batches202611 = reportsWithStructure.map((entry) => {
    const contract = INITIAL_DATA_CONTRACTS.find((c) => c.id === entry.linkedDataContractId)!;
    return resolveSourceExecutionRows({
      contract,
      periodo: '2026-11',
      entidad: 'Entidad DEMO',
      sourceCatalogEntryId: entry.id,
    });
  });
  const readyCount202611 = batches202611.filter((b) => b.hasDataBatch && b.rows.length > 0).length;
  assert.equal(readyCount202611 > 0, true);

  // Dates in the original contract batches are NEVER mutated by checking different periods
  const primaryContract = INITIAL_DATA_CONTRACTS.find((c) => c.id === 'DC-CARTERA-01')!;
  const batch11 = (primaryContract.executionBatches || []).find((b) => b.cutoffPeriod === '2026-11')!;
  assert.equal(batch11.cutoffDate, '2026-11-30');
  assert.equal(batch11.cutoffPeriod, '2026-11');
});

test('Step 6 preview classification accurately differentiates missing batch from empty dataset policy from real physical content', () => {
  const output = INITIAL_CONFIGURED_OUTPUTS.find((o) => o.id === 'OUT-CSV-DEMO-A')!;
  const outputType = INITIAL_OUTPUT_TYPES.find((t) => t.id === output.outputTypeId)!;
  const contract = INITIAL_DATA_CONTRACTS.find((c) => c.id === output.dataContractId)!;

  // Case A: Missing batch for 2026-12 -> CES-DAT-000 emitted, isRealExecutableGeneration = false
  const missingBatchResult = generateOutputArtifact({
    output,
    outputType,
    contract,
    allContracts: INITIAL_DATA_CONTRACTS,
    context: { entidad: 'Entidad DEMO', formato: output.code, periodo: '2026-12', version: output.version },
    entidad: 'Entidad DEMO',
  });
  assert.equal(missingBatchResult.isRealExecutableGeneration, false);
  assert.equal(missingBatchResult.findings.some((f) => f.code === 'CES-DAT-000'), true);

  // Case B: Compatible batch for 2026-11 -> real executable generation with rows processed
  const compatibleBatchResult = generateOutputArtifact({
    output,
    outputType,
    contract,
    allContracts: INITIAL_DATA_CONTRACTS,
    context: { entidad: 'Entidad DEMO', formato: output.code, periodo: '2026-11', version: output.version },
    entidad: 'Entidad DEMO',
  });
  assert.equal(compatibleBatchResult.isRealExecutableGeneration, true);
  assert.equal(compatibleBatchResult.rowsProcessed > 0, true);
});

test('TOTALiA mapping proposal preserves leading zero "000123" as text and never maps identifier to person name', () => {
  const outputFields: StructureField[] = [
    {
      ...INITIAL_CONFIGURED_OUTPUTS[0].fields[1],
      id: 'FLD-ID',
      technicalName: 'numero_obligacion',
      label: 'Número de Obligación',
      dataType: 'Texto',
      length: 12,
      mapping: {
        ...INITIAL_CONFIGURED_OUTPUTS[0].fields[1].mapping,
        sourceField: '',
        mappingStatus: 'Sin asignar',
      },
    },
    {
      ...INITIAL_CONFIGURED_OUTPUTS[0].fields[2],
      id: 'FLD-NOM',
      technicalName: 'nombre_titular',
      label: 'Nombre o Razón Social',
      dataType: 'Texto',
      length: 50,
      mapping: {
        ...INITIAL_CONFIGURED_OUTPUTS[0].fields[2].mapping,
        sourceField: '',
        mappingStatus: 'Sin asignar',
      },
    },
  ];

  const contractFields: DataContractField[] = [
    {
      name: 'id_obligacion',
      label: 'Número de Obligación o Crédito',
      dataType: 'Texto',
      length: 12,
      nullable: false,
      lineage: 'Core.Obligaciones.Id',
      sampleValues: ['000123', '000124', '000125'],
    },
    {
      name: 'nombre_deudor',
      label: 'Nombre Completo del Cliente',
      dataType: 'Texto',
      length: 50,
      nullable: false,
      lineage: 'Core.Clientes.Nombre',
      sampleValues: ['Ana María Pérez', 'Carlos Gómez'],
    },
  ];

  const proposals = proposeFieldMappings(outputFields, contractFields, 'CTR-TEST', true);

  const idProposal = proposals.proposals.find((p) => p.technicalName === 'numero_obligacion')!;
  const nomProposal = proposals.proposals.find((p) => p.technicalName === 'nombre_titular')!;

  // id_obligacion maps to numero_obligacion, NEVER to nombre_deudor
  assert.equal(idProposal.proposedSource, 'id_obligacion');
  // nombre_deudor maps to nombre_titular, NEVER to id_obligacion
  assert.equal(nomProposal.proposedSource, 'nombre_deudor');
});

test('Structure design can be drafted and saved even with zero data batches for the period', () => {
  const output = INITIAL_CONFIGURED_OUTPUTS.find((o) => o.id === 'OUT-CSV-DEMO-A')!;
  const outputType = INITIAL_OUTPUT_TYPES.find((t) => t.id === output.outputTypeId)!;
  const contract = INITIAL_DATA_CONTRACTS.find((c) => c.id === output.dataContractId)!;

  // Evaluate output for 2026-12 (which has 0 data batches)
  const result = generateOutputArtifact({
    output,
    outputType,
    contract,
    allContracts: INITIAL_DATA_CONTRACTS,
    context: { entidad: 'Entidad DEMO', formato: output.code, periodo: '2026-12', version: output.version },
    entidad: 'Entidad DEMO',
  });

  // Structural checks: fields, names, lengths are valid
  const structuralBlockers = result.findings.filter(
    (f) =>
      f.severity === 'Bloqueante' &&
      f.layer !== 'Datos del formato (DAQUE)' &&
      f.code !== 'CES-DAT-000'
  );
  assert.equal(structuralBlockers.length, 0);

  // In absence of data batch, 0 rows processed and CES-DAT-000 is emitted
  assert.equal(result.rowsProcessed, 0);
  assert.equal(result.findings.some((f) => f.code === 'CES-DAT-000'), true);

  // Physical download is blocked until batch is loaded
  assert.equal(result.readinessMatrix.downloadAvailabilityStatus.canDownload, false);
});

test('filterRegulatoryFormats filters correctly by country, entity type, and classification', () => {
  // Test country filtering
  const colombiaOnly = filterRegulatoryFormats(INITIAL_REGULATORY_FORMATS, { country: 'Colombia' });
  assert.equal(colombiaOnly.filtered.every((f) => f.country === 'Colombia'), true);
  assert.equal(colombiaOnly.filtered.length > 5, true);

  const peruOnly = filterRegulatoryFormats(INITIAL_REGULATORY_FORMATS, { country: 'Perú' });
  assert.equal(peruOnly.filtered.every((f) => f.country === 'Perú'), true);
  assert.equal(peruOnly.filtered.length >= 6, true);

  // Test entity type filtering: Establecimientos Bancarios in Colombia
  const bankFormats = filterRegulatoryFormats(INITIAL_REGULATORY_FORMATS, {
    country: 'Colombia',
    entityType: 'Establecimientos Bancarios',
    classificationStatus: 'Clasificado y validado',
  });
  // SFC format 239 applies to banks
  assert.equal(bankFormats.filtered.some((f) => f.code === '239'), true);
  // Unclassified format without entity type is excluded from strict bank list
  assert.equal(bankFormats.filtered.some((f) => f.id === 'FMT-CO-VACIO-01'), false);

  // Test classification filter
  const pendingOnly = filterRegulatoryFormats(INITIAL_REGULATORY_FORMATS, {
    classificationStatus: 'Pendiente de clasificación',
  });
  assert.equal(pendingOnly.filtered.every((f) => f.classificationStatus === 'Pendiente de clasificación'), true);
  assert.equal(pendingOnly.filtered.some((f) => f.id === 'FMT-CO-VACIO-01'), true);
  assert.equal(pendingOnly.filtered.some((f) => f.id === 'FMT-PE-715-PENDIENTE'), true);

  // Test text search matching Peru Nro Interno 410 or DIAN 410
  const search410 = filterRegulatoryFormats(INITIAL_REGULATORY_FORMATS, { searchQuery: '410' });
  assert.equal(search410.filtered.some((f) => f.id === 'FMT-PE-410'), true);
  assert.equal(search410.filtered.some((f) => f.id === 'FMT-CO-DIAN-410'), true);
});

test('validateAssociationContext blocks activation on unclassified formats and checks compatibility', () => {
  const unclassifiedFormat = INITIAL_REGULATORY_FORMATS.find((f) => f.id === 'FMT-CO-VACIO-01')!;
  const csvOutput = INITIAL_CONFIGURED_OUTPUTS[0];
  const trn = INITIAL_TRANSMISSION_TYPES[0]; // TX-ORDINARIO (CSV, TXT)
  const outType = INITIAL_OUTPUT_TYPES[0]; // TYPE-CSV-01 (CSV)

  // 1. Trying to save as 'Activa' with unclassified format MUST be blocked
  const resBlockUnclassified = validateAssociationContext({
    format: unclassifiedFormat,
    configuredOutput: csvOutput,
    outputType: outType,
    transmissionType: trn,
    existingAssociations: INITIAL_ASSOCIATIONS,
    proposedStatus: 'Activa',
    proposedEnvironment: 'QA',
    proposedModality: 'Inicial',
  });
  assert.equal(resBlockUnclassified.canActivate, false);
  assert.equal(resBlockUnclassified.blockers.some((b) => b.includes('pendiente de clasificación')), true);

  // 2. Saving as 'Borrador' on unclassified format is allowed with warning
  const resDraftUnclassified = validateAssociationContext({
    format: unclassifiedFormat,
    configuredOutput: csvOutput,
    outputType: outType,
    transmissionType: trn,
    existingAssociations: INITIAL_ASSOCIATIONS,
    proposedStatus: 'Borrador',
    proposedEnvironment: 'QA',
    proposedModality: 'Inicial',
  });
  assert.equal(resDraftUnclassified.isValid, true);
  assert.equal(resDraftUnclassified.warnings.some((w) => w.includes('pendiente de clasificación')), true);

  // 3. Technical family incompatibility: TXT-only transmission with XBRL output
  const classifiedFormat = INITIAL_REGULATORY_FORMATS.find((f) => f.id === 'FMT-CO-SFC-239')!;
  const xbrlType = INITIAL_OUTPUT_TYPES.find((t) => t.family === 'XBRL')!;
  const txtOnlyTransmission: TransmissionType = {
    id: 'TX-TXT-ONLY',
    code: 'TX-TXT-01',
    name: 'Transmisión Plano TXT',
    modality: 'Envío ordinario / Inicial',
    description: 'Canal exclusivo para archivos de texto plano',
    compatibleFamilies: ['TXT'],
    requiresAntecedentRef: false,
  };
  const resFamilyMismatch = validateAssociationContext({
    format: classifiedFormat,
    configuredOutput: csvOutput,
    outputType: xbrlType,
    transmissionType: txtOnlyTransmission,
    existingAssociations: INITIAL_ASSOCIATIONS,
    proposedStatus: 'Borrador',
    proposedEnvironment: 'QA',
    proposedModality: 'Inicial',
  });
  assert.equal(resFamilyMismatch.isValid, false);
  assert.equal(resFamilyMismatch.blockers.some((b) => b.includes('Incompatibilidad técnica')), true);
});

test('generateTotaliaFormatRecommendations provides context-aware guidance for destination formats', () => {
  const formatSfc = INITIAL_REGULATORY_FORMATS.find((f) => f.id === 'FMT-CO-SFC-239')!;
  const recommendation = generateTotaliaFormatRecommendations({
    format: formatSfc,
    configuredOutputs: INITIAL_CONFIGURED_OUTPUTS,
    outputTypes: INITIAL_OUTPUT_TYPES,
    transmissionTypes: INITIAL_TRANSMISSION_TYPES,
    entityType: 'Establecimientos Bancarios',
  });

  assert.equal(typeof recommendation.suggestedAction, 'string');
  assert.equal(recommendation.explanation.length > 10, true);
  assert.equal(recommendation.requirementsSummary.length > 0, true);
});

test('computeOrganismSummaries aggregates formats per receiving organism (SFC, DIAN, Fogafín, UIAF, SBS Perú) without inflating by versions', () => {
  const coSummaries = computeOrganismSummaries({
    organisms: INITIAL_RECEIVING_ORGANISMS,
    formats: INITIAL_REGULATORY_FORMATS,
    associations: INITIAL_ASSOCIATIONS,
    countryFilter: 'Colombia',
  });

  const sfc = coSummaries.find((s) => s.organism.code === 'SFC')!;
  const dian = coSummaries.find((s) => s.organism.code === 'DIAN')!;
  const fogafin = coSummaries.find((s) => s.organism.code === 'FOGAFIN')!;
  const uiaf = coSummaries.find((s) => s.organism.code === 'UIAF')!;

  assert.equal(Boolean(sfc && sfc.totalFormats >= 3), true);
  assert.equal(Boolean(dian && dian.totalFormats >= 4), true);
  assert.equal(Boolean(fogafin && fogafin.totalFormats >= 1), true);
  assert.equal(Boolean(uiaf && uiaf.totalFormats >= 2), true);

  // Verify UIAF ROS format distinguishes issuingOrganism (SFC) from receiving regulator (UIAF)
  const rosFormat = uiaf.formats.find((f) => f.id === 'FMT-CO-UIAF-ROS')!;
  assert.equal(rosFormat.regulator, 'UIAF - Unidad de Información y Análisis Financiero');
  assert.equal(rosFormat.issuingOrganism, 'SFC - Superintendencia Financiera de Colombia');
  assert.equal(rosFormat.reportingModality, 'Por evento');

  const peSummaries = computeOrganismSummaries({
    organisms: INITIAL_RECEIVING_ORGANISMS,
    formats: INITIAL_REGULATORY_FORMATS,
    associations: INITIAL_ASSOCIATIONS,
    countryFilter: 'Perú',
  });
  const sbs = peSummaries.find((s) => s.organism.code === 'SBS-PE')!;
  assert.equal(Boolean(sbs && sbs.totalFormats >= 6), true);
});

test('checkFormatDuplicateCandidates blocks exact duplicates within same organism and warns on shared codes across organisms', () => {
  // 1. Exact duplicate in Colombia DIAN 1001 -> Bloqueante
  const exactDup = checkFormatDuplicateCandidates(INITIAL_REGULATORY_FORMATS, {
    jurisdiction: 'Colombia',
    regulator: 'DIAN',
    code: '1001',
    name: 'Pagos o abonos en cuenta',
  });
  assert.equal(exactDup.hasExactDuplicate, true);

  // 2. Shared code 410 for a different regulator -> Advertencia, not Bloqueante
  const sharedCode = checkFormatDuplicateCandidates(INITIAL_REGULATORY_FORMATS, {
    jurisdiction: 'Colombia',
    regulator: 'Fogafín - Fondo de Garantías de Instituciones Financieras',
    code: '410',
    internalCode: 'FMT-CO-FOGAFIN-410-NEW',
    name: 'Reporte Especial Fogafín',
  });
  assert.equal(sharedCode.hasExactDuplicate, false);
  assert.equal(sharedCode.hasWarningCandidates, true);

  // 3. Format without official numeric code (identified by name/annex) is allowed with unique internalCode
  const noCodeFmt = checkFormatDuplicateCandidates(INITIAL_REGULATORY_FORMATS, {
    jurisdiction: 'Colombia',
    regulator: 'Fogafín - Fondo de Garantías de Instituciones Financieras',
    code: '',
    internalCode: 'FMT-CO-FOGAFIN-RESERVAS',
    name: 'Anexo de Reservas de Liquidez Garantizada',
  });
  assert.equal(noCodeFmt.hasExactDuplicate, false);
});

test('evaluateFormatDependencies blocks physical deletion when associations/runs exist and allows deletion on clean format', () => {
  // 1. Format with associations and runs (FMT-DEMO-01) CANNOT be deleted
  const fmtWithDeps = INITIAL_REGULATORY_FORMATS.find((f) => f.id === 'FMT-DEMO-01')!;
  const depCheck1 = evaluateFormatDependencies({
    format: fmtWithDeps,
    associations: INITIAL_ASSOCIATIONS,
    executionRuns: INITIAL_EXECUTION_RUNS,
  });
  assert.equal(depCheck1.canDelete, false);
  assert.equal(depCheck1.recommendedAction, 'Desactivar formato');
  assert.equal(depCheck1.linkedAssociations.length > 0, true);

  // 2. Clean format without associations, runs, or multiple versions CAN be deleted
  const fmtClean = INITIAL_REGULATORY_FORMATS.find((f) => f.id === 'FMT-CO-FOGAFIN-FDI')!;
  const depCheck2 = evaluateFormatDependencies({
    format: fmtClean,
    associations: INITIAL_ASSOCIATIONS,
    executionRuns: INITIAL_EXECUTION_RUNS,
  });
  assert.equal(depCheck2.canDelete, true);
  assert.equal(depCheck2.recommendedAction, 'Eliminar formato');
});

test('evaluateFormatEditImpact distinguishes descriptive correction from specification/applicability change', () => {
  const orig = INITIAL_REGULATORY_FORMATS.find((f) => f.id === 'FMT-DEMO-01')!;

  // 1. Descriptive edit only (description/obligation text)
  const descEdited = {
    ...orig,
    description: 'Descripción actualizada para mayor claridad documental.',
  };
  const descImpact = evaluateFormatEditImpact({
    original: orig,
    updated: descEdited,
    associations: INITIAL_ASSOCIATIONS,
    configuredOutputs: INITIAL_CONFIGURED_OUTPUTS,
  });
  assert.equal(descImpact.changeClassification, 'Corrección descriptiva');
  assert.equal(descImpact.requiresNewVersion, false);

  // 2. Specification / validity / applicability change
  const structEdited = {
    ...orig,
    normativeVersion: 'v2027.1',
    periodicity: 'Trimestral',
  };
  const structImpact = evaluateFormatEditImpact({
    original: orig,
    updated: structEdited,
    associations: INITIAL_ASSOCIATIONS,
    configuredOutputs: INITIAL_CONFIGURED_OUTPUTS,
  });
  assert.equal(
    structImpact.changeClassification,
    'Cambio de especificación, vigencia o aplicabilidad'
  );
  assert.equal(structImpact.requiresNewVersion, true);
  assert.equal(structImpact.impactedAssociations.length > 0, true);
  assert.equal(structImpact.impactedOutputs.length > 0, true);
});

test('validateAssociationContext blocks activating operational associations on inactive or future-validity formats', () => {
  const futureFormat = INITIAL_REGULATORY_FORMATS.find((f) => f.id === 'FMT-PE-510-FUTURO')!;
  const csvOutput = INITIAL_CONFIGURED_OUTPUTS[0];
  const trn = INITIAL_TRANSMISSION_TYPES[0];
  const outType = INITIAL_OUTPUT_TYPES[0];

  // Future validity format cannot be activated as 'Activa'
  const resFutureActive = validateAssociationContext({
    format: futureFormat,
    configuredOutput: csvOutput,
    outputType: outType,
    transmissionType: trn,
    existingAssociations: INITIAL_ASSOCIATIONS,
    proposedStatus: 'Activa',
    proposedEnvironment: 'QA',
    proposedModality: 'Inicial',
  });
  assert.equal(resFutureActive.canActivate, false);
  assert.equal(resFutureActive.blockers.some((b) => b.includes('Vigencia futura')), true);

  // Inactive format cannot be activated as 'Activa'
  const inactiveFormat = { ...INITIAL_REGULATORY_FORMATS[0], lifecycleStatus: 'Inactivo' as const };
  const resInactive = validateAssociationContext({
    format: inactiveFormat,
    configuredOutput: csvOutput,
    outputType: outType,
    transmissionType: trn,
    existingAssociations: INITIAL_ASSOCIATIONS,
    proposedStatus: 'Activa',
    proposedEnvironment: 'QA',
    proposedModality: 'Inicial',
  });
  assert.equal(resInactive.canActivate, false);
  assert.equal(resInactive.blockers.some((b) => b.includes('Formato desactivado')), true);
});




