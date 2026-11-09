import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeVersionImpact,
  evaluateAndFormatField,
  generateOutputArtifact,
  measureFieldLength,
  resolveDynamicFileName,
  resolveFormatAssociation,
  validateFixedWidthStructure,
} from './engine';
import {
  INITIAL_ASSOCIATIONS,
  INITIAL_CONFIGURED_OUTPUTS,
  INITIAL_DAQUE_PROFILES,
  INITIAL_DATA_CONTRACTS,
  INITIAL_OUTPUT_TYPES,
  INITIAL_REGULATORY_FORMATS,
} from './seedData';

test('CSV generation reproduces exact PDF reference row: 31-10-2026;000123;Ana Pérez;1234,50', () => {
  const csvOutput = INITIAL_CONFIGURED_OUTPUTS.find((o) => o.id === 'OUT-CSV-DEMO-A')!;
  const csvType = INITIAL_OUTPUT_TYPES.find((t) => t.id === 'TYPE-CSV-01')!;
  const contract = INITIAL_DATA_CONTRACTS[0];

  const result = generateOutputArtifact({
    output: csvOutput,
    outputType: csvType,
    contract,
    context: {
      entidad: 'DEMO',
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
    { entidad: 'DEMO', formato: 'DEMO-A', periodo: '2026-10', version: '1.4' },
    ',',
    false
  );

  // Must NOT truncate silently and must emit CES-STR-005 blocking finding
  assert.equal(res.formatted.length > 50, true);
  assert.equal(res.findings.some((f) => f.code === 'CES-STR-005' && f.severity === 'Bloqueante'), true);
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
  const csvOutput = INITIAL_CONFIGURED_OUTPUTS.find((o) => o.id === 'OUT-CSV-DEMO-A')!;
  const csvType = INITIAL_OUTPUT_TYPES.find((t) => t.id === 'TYPE-CSV-01')!;
  const baseContract = INITIAL_DATA_CONTRACTS[0];
  const contractWithZeroSaldo = {
    ...baseContract,
    demoRows: [{ ...baseContract.demoRows[0], saldo: 0 }],
  };

  const daqueDemo01 = INITIAL_DAQUE_PROFILES.find((d) => d.id === 'DAQUE-PROF-01')!;
  const daqueDemo02 = INITIAL_DAQUE_PROFILES.find((d) => d.id === 'DAQUE-PROF-02')!;

  const runDemo01 = generateOutputArtifact({
    output: csvOutput,
    outputType: csvType,
    contract: contractWithZeroSaldo,
    daqueProfile: daqueDemo01,
    context: { entidad: 'DEMO', formato: 'DEMO-01', periodo: '2026-11', version: '1.4' },
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
    context: { entidad: 'DEMO', formato: 'DEMO-02', periodo: '2026-11', version: '1.4' },
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
