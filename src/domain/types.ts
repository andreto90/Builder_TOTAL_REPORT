export type TechnicalFamily = 'CSV' | 'TXT' | 'XML' | 'XBRL' | 'AVRO' | 'PDF' | 'XLSX';

export type CapabilitySupportStatus =
  | 'Instalada y certificada'
  | 'Simulada conceptual'
  | 'Candidata por certificar';

export type LifecycleStatus =
  | 'Borrador'
  | 'En revisión'
  | 'Aprobada'
  | 'Publicada'
  | 'Descontinuada';

export type PropertyProtectionClass =
  | 'Normativa protegida'
  | 'Parametrizable'
  | 'Interna'
  | 'Inferida pendiente';

export type EvidenceSupportState =
  | 'Sustento explícito'
  | 'Inferencia de muestra'
  | 'Requiere confirmación'
  | 'Fuentes en conflicto';

export type TransformationKind =
  | 'Directo'
  | 'Constante'
  | 'Variable de contexto'
  | 'Concatenación tipada'
  | 'Máscara fecha/número'
  | 'Expresión declarativa';

export type ValidationLayer =
  | 'Diseño y estructura'
  | 'Mapeo y tipos'
  | 'Datos del formato (DAQUE)'
  | 'Representación y archivo'
  | 'Coherencia de conjunto'
  | 'Precondición de entrega';

export type EmptyDatasetPolicy = 'Omitir archivo' | 'Producir vacío válido' | 'Bloquear generación';

export type UserRole =
  | 'Implementador técnico / regulatorio'
  | 'Responsable del formato'
  | 'Aprobador / Gobierno'
  | 'Administrador de ambiente'
  | 'Operador de reporte';

export interface CsvParameters {
  delimiter: ';' | ',' | '|' | '\t';
  quoteChar: '"' | "'" | 'Ninguno';
  escapeChar: '\\' | '"';
  includeHeader: boolean;
  bom: boolean;
  lineEnding: 'CRLF' | 'LF';
  decimalSeparator: ',' | '.';
  nullRepresentation: string;
}

export interface TxtParameters {
  mode: 'Ancho fijo' | 'Delimitado' | 'Múltiples tipos de registro';
  lengthUnit: 'Caracteres' | 'Bytes';
  defaultPaddingChar: ' ' | '0';
  lineEnding: 'CRLF' | 'LF';
  hasHeaderRecord: boolean;
  hasFooterControlRecord: boolean;
  implicitDecimalScale: boolean;
}

export interface XmlParameters {
  rootElement: string;
  targetNamespace: string;
  xsdSchemaVersion: 'XSD 1.0' | 'XSD 1.1';
  xsdSchemaRef: string;
  emptyElementHandling: 'Omitir nodo' | 'Etiqueta vacía' | 'xsi:nil="true"';
  prettyPrint: boolean;
}

export interface AvroParameters {
  namespace: string;
  recordName: string;
  containerFormat: 'OCF (Object Container File)' | 'Binario sin contenedor' | 'JSON Avro';
  codec: 'null' | 'deflate' | 'snappy' | 'zstandard';
  schemaCompatibility: 'BACKWARD' | 'FORWARD' | 'FULL' | 'NONE';
  logicalDecimalSupport: boolean;
}

export interface XbrlParameters {
  taxonomyPackageRef: string;
  entryPointUri: string;
  defaultEntityScheme: string;
  periodType: 'instant' | 'duration' | 'ambos';
  dimensionsEnabled: boolean;
  allowTaxonomyExtensions: boolean;
  unitsConfigured: string[];
}

export interface PdfParameters {
  templateEngineRef: string;
  pdfStandard: 'PDF 1.7 Estándar' | 'PDF/A-1b Preservación' | 'PDF/A-2b';
  pageOrientation: 'Vertical (Portrait)' | 'Horizontal (Landscape)';
  pageSize: 'A4' | 'Carta';
  includePaginationFooter: boolean;
  preventTableRowSplit: boolean;
  documentRoleUse: 'Anexo regulatorio' | 'Proforma de consulta' | 'Evidencia interna';
}

export interface OutputType {
  id: string;
  code: string;
  name: string;
  description: string;
  category: 'Estructurado plano' | 'Jerárquico' | 'Binario serializado' | 'Taxonómico' | 'Documental';
  family: TechnicalFamily;
  extension: string;
  mimeType: string;
  serializationEngine: string;
  engineVersion: string;
  engineHash: string;
  characterEncoding: 'UTF-8' | 'UTF-8 con BOM' | 'ISO-8859-1' | 'ASCII' | 'Binario';
  supportStatus: CapabilitySupportStatus;
  canGenerateRealFileInBrowser: boolean;
  capabilities: {
    importSchema: boolean;
    visualStructureBuilder: boolean;
    physicalPreview: boolean;
    artifactGeneration: boolean;
    schemaValidation: boolean;
  };
  compatibilityRestrictions: string[];
  status: 'Activo' | 'En evaluación' | 'Descontinuado';
  version: string;
  updatedAt: string;
  updatedBy: string;
  csvParams?: CsvParameters;
  txtParams?: TxtParameters;
  xmlParams?: XmlParameters;
  avroParams?: AvroParameters;
  xbrlParams?: XbrlParameters;
  pdfParams?: PdfParameters;
}

export interface StructureField {
  id: string;
  technicalName: string;
  label: string;
  description: string;
  recordSection: 'Cabecera' | 'Detalle' | 'Cierre / Totales' | 'Nodo raíz / Hecho';
  parentId?: string;
  order: number;
  dataType: 'Texto' | 'Entero' | 'Decimal' | 'Fecha' | 'Booleano' | 'Catálogo' | 'Registro / Grupo';
  physicalType: string;
  length: number;
  lengthUnit: 'Caracteres' | 'Bytes';
  precision?: number;
  scale?: number;
  required: boolean;
  nullable: boolean;
  startPosition?: number;
  formatMask: string;
  defaultValue: string;
  paddingChar: ' ' | '0' | 'Ninguno';
  alignment: 'Izquierda' | 'Derecha';
  overflowRule: 'Bloquear con error' | 'No aplicable';
  protectionClass: PropertyProtectionClass;
  evidenceState: EvidenceSupportState;
  evidenceSourceRef: string;
  // Family specific metadata
  xmlNodeKind?: 'Elemento' | 'Atributo';
  avroLogicalType?: string;
  xbrlConcept?: string;
  xbrlContextRef?: string;
  xbrlUnitRef?: string;
  // Mapping configuration
  mapping: {
    transformationKind: TransformationKind;
    sourceContractId: string;
    sourceField: string;
    expression: string;
    isParameterizedPoint: boolean;
    parameterName?: string;
    emptyTreatment: 'Error bloqueante' | 'Valor predeterminado' | 'Nulo explícito';
  };
}

export interface OutputValidationRule {
  id: string;
  code: string;
  name: string;
  layer: ValidationLayer;
  targetFieldOrRole: string;
  conditionExpression: string;
  severity: 'Bloqueante' | 'Advertencia';
  isNormativeProtected: boolean;
  owner: 'Política de salida y entrega' | 'Contrato DAQUE (Referencia)';
  daqueContractRef?: string;
  diagnosticMessage: string;
  enabled: boolean;
}

export interface PackageMemberRole {
  id: string;
  role: 'Principal' | 'Detalle' | 'Anexo' | 'Control / Resumen' | 'Evidencia interna';
  cardinality: '1..1 (Obligatorio)' | '0..1 (Opcional)' | '1..N (Segmentable)';
  outputDefinitionId: string;
  outputVersion: string;
  fileNamePattern: string;
  includeInRegulatoryDelivery: boolean;
  allowRoleMappingOverride: boolean;
}

export interface NormativeSourceDoc {
  id: string;
  title: string;
  issuer: string;
  jurisdiction: 'Colombia' | 'Perú' | 'Internacional';
  versionDeclared: string;
  publicationDate: string;
  sha256: string;
  locator: string;
  kind: 'Esquema / Taxonomía' | 'Instructivo oficial' | 'Archivo de muestra' | 'Plantilla PDF';
  status: 'Vigente' | 'Nueva versión por evaluar' | 'Muestra pendiente de recepción';
}

export interface VersionHistoryEntry {
  version: string;
  status: LifecycleStatus;
  createdAt: string;
  createdBy: string;
  approvedBy?: string;
  justification: string;
  changesSummary: string[];
  fingerprint: string;
  baseVersionRef?: string;
  derivationKind: 'Creación inicial' | 'Nueva revisión' | 'Variante autorizada' | 'Clonación';
}

export interface ConfiguredOutput {
  id: string;
  code: string;
  name: string;
  purpose: string;
  jurisdiction: 'Colombia' | 'Perú' | 'Multirregulador';
  regulator: string;
  outputTypeId: string;
  description: string;
  responsibleUser: string;
  validFrom: string;
  validTo: string;
  version: string;
  status: LifecycleStatus;
  baseOutputId?: string;
  derivationType: 'Original' | 'Revisión' | 'Variante autorizada' | 'Copia independiente';
  updatedAt: string;
  fingerprint: string;
  // Etapa 2: Archivo y composición
  composition: {
    fileNamePattern: string;
    extension: string;
    encoding: 'UTF-8' | 'UTF-8 con BOM' | 'ISO-8859-1' | 'Binario';
    delimiter: ';' | ',' | '|' | '\t' | 'Ancho fijo' | 'N/A';
    decimalSeparator: ',' | '.';
    includeHeader: boolean;
    includeControlTotals: boolean;
    includeFooter: boolean;
    packaging: 'Sin empaquetar' | 'ZIP' | 'GZIP';
    maxPackageBytes: number;
    emptyDatasetPolicy: EmptyDatasetPolicy;
    packageMembers: PackageMemberRole[];
  };
  // Etapa 3 & 4: Estructura y Mapeo
  dataContractId: string;
  fields: StructureField[];
  // Etapa 5: Reglas y controles de salida
  validationRules: OutputValidationRule[];
  // Etapa 6: Generación y entrega predeterminada
  defaultDeliveryChannelId: string;
  signatureServiceRef: string;
  encryptionPolicy: 'Sin cifrado adicional (TLS canal)' | 'PGP / KMS institucional' | 'Firma XAdES / CMS';
  // Fuentes y versiones
  sourceDocIds: string[];
  versionHistory: VersionHistoryEntry[];
}

export interface DataContractField {
  name: string;
  label: string;
  dataType: 'Texto' | 'Entero' | 'Decimal' | 'Fecha' | 'Booleano' | 'Catálogo';
  length: number;
  precision?: number;
  scale?: number;
  nullable: boolean;
  lineage: string;
  sampleValues: (string | number | null)[];
}

export interface DataContract {
  id: string;
  code: string;
  name: string;
  version: string;
  sourceSystem: 'TÓTAL REPORT® — Núcleo de Preparación';
  granularity: string;
  primaryKey: string[];
  snapshotId: string;
  fields: DataContractField[];
  demoRows: Record<string, string | number | null>[];
}

export interface DaqueFormatProfile {
  id: string;
  code: string;
  name: string;
  version: string;
  formatId: string;
  rulesCount: number;
  keyBusinessRules: {
    code: string;
    description: string;
    condition: string;
    rejectsZeroBalance?: boolean;
  }[];
  evidenceStatus: 'Vigente y conforme' | 'Caducada / Requiere revalidación' | 'Con bloqueos de datos';
  lastEvaluatedSnapshot: string;
}

export interface RegulatoryFormat {
  id: string;
  code: string;
  name: string;
  jurisdiction: 'Colombia' | 'Perú';
  regulator: string;
  obligation: string;
  periodicity: 'Mensual' | 'Trimestral' | 'Anual' | 'Diaria';
  normativeVersion: string;
  daqueProfileId: string;
  enabledTransmissionTypes: string[];
  description: string;
}

export interface TransmissionType {
  id: string;
  code: string;
  name: string;
  modality: 'Envío ordinario / Inicial' | 'Corrección' | 'Retransmisión / Reemplazo';
  description: string;
  compatibleFamilies: TechnicalFamily[];
  requiresAntecedentRef: boolean;
}

export interface DeliveryChannel {
  id: string;
  code: string;
  name: string;
  protocol: 'SFTP' | 'API REST' | 'Descarga controlada (Manual)' | 'Depósito en repositorio';
  deliveryMode: 'Automática por conector' | 'Manual controlada';
  connectionVaultRef: string;
  logicalDestination: string;
  maxRetries: number;
  timeoutSeconds: number;
  ackMechanism: string;
  status: 'Habilitado' | 'En pruebas' | 'Pendiente de conector';
}

export interface FormatOutputAssociation {
  id: string;
  code: string;
  formatId: string;
  transmissionTypeId: string;
  modality: 'Inicial' | 'Corrección' | 'Reemplazo';
  configuredOutputId: string;
  configuredOutputVersion: string;
  deliveryChannelId: string;
  daqueProfileId: string;
  entityScope: string;
  environment: 'QA' | 'Producción';
  validFrom: string;
  validTo: string; // 'Abierta' or YYYY-MM-DD
  status: 'Activa' | 'Instalada sin activar' | 'Borrador' | 'Retirada';
  parameterOverrides: {
    fileNamePrefix?: string;
    customMappingRef?: string;
    includeSummaryFile?: boolean;
    zeroBalancePolicyOverride?: string;
  };
  updatedAt: string;
  updatedBy: string;
}

export interface EnvironmentDeploymentState {
  id: string;
  environmentName: 'QA Conectado' | 'Producción Conectado' | 'Producción Desconectado';
  connectivity: 'Conectado' | 'Desconectado (Paquete verificable)';
  configuredOutputId: string;
  associationId: string;
  formatCode: string;
  availableVersion: string;
  installedVersion: string;
  activeVersion: string;
  previousCompatibleVersion?: string;
  notificationDate: string;
  downloadedDate?: string;
  installedDate?: string;
  activatedDate?: string;
  compatibilityStatus: 'Conforme' | 'Por verificar' | 'Bloqueado por dependencia';
  blockingReason?: string;
  binaryRuntimeVersion: string;
  binaryFingerprint: string;
  auditTrail: {
    stage: 'Notificación' | 'Descarga' | 'Instalación' | 'Activación' | 'Reversión';
    timestamp: string;
    actor: string;
    version: string;
    detail: string;
  }[];
}

export interface TotaliaSuggestion {
  id: string;
  targetOutputId: string;
  category:
    | 'Análisis de especificación'
    | 'Estructura y tipo lógico'
    | 'Propuesta de mapeo'
    | 'Cambio normativo comparado'
    | 'Casos de prueba recomendados'
    | 'Reutilización detectada';
  title: string;
  elementAffected: string;
  currentValue: string;
  proposedValue: string;
  sourceDocRef: string;
  sourceLocator: string;
  evidenceState: EvidenceSupportState;
  consumerImpactSummary: string;
  affectedFormatsCount: number;
  status: 'Pendiente de revisión' | 'Aceptada en borrador' | 'Rechazada';
  explanation: string;
  decidedBy?: string;
  decidedAt?: string;
  // Action payload to apply on draft if accepted
  fieldPatch?: {
    fieldTechnicalName: string;
    updates: Partial<StructureField>;
  };
}

export interface ExecutionFinding {
  id: string;
  code: string;
  layer: ValidationLayer;
  severity: 'Bloqueante' | 'Advertencia';
  location: string;
  fieldTechnicalName?: string;
  description: string;
  suggestedAction: string;
}

export interface ExecutionRun {
  id: string;
  runCode: string;
  createdAt: string;
  entityScope: string;
  environment: 'QA' | 'Producción';
  cutoffPeriod: string;
  formatId: string;
  transmissionTypeId: string;
  modality: 'Inicial' | 'Corrección' | 'Reemplazo';
  associationId: string;
  configuredOutputId: string;
  configuredOutputVersion: string;
  deliveryChannelId: string;
  daqueProfileId: string;
  snapshotId: string;
  recordsReviewed: number;
  blockingCount: number;
  warningCount: number;
  generationState: 'Lista para entrega' | 'Bloqueada en precondición DAQUE' | 'Bloqueada en estructura/archivo';
  deliveryState:
    | 'Pendiente de envío / descarga'
    | 'Descargada manualmente (Sin acreditar envío)'
    | 'Presentación manual registrada'
    | 'Enviada por conector'
    | 'Recibida técnicamente (Acuse)'
    | 'Aceptada por el ente'
    | 'Rechazada por el ente';
  externalAckReceipt?: string;
  generatedFileName: string;
  generatedFileContent: string;
  generatedMimeType: string;
  sha256Hash: string;
  binaryRuntimeFingerprint: string;
  findings: ExecutionFinding[];
}
