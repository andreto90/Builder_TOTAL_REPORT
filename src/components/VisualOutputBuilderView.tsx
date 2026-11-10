import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Download,
  Eye,
  FileCheck2,
  FileCode2,
  GitBranch,
  HelpCircle,
  Info,
  Layers,
  Link2,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  Sliders,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useConfigurator } from '../context/ConfiguratorContext';
import {
  evaluateAndFormatField,
  generateOutputArtifact,
  getCutoffDateForPeriod,
  getPeriodSyncedDemoRows,
  measureFieldLength,
  proposeFieldMappings,
  resolveDynamicFileName,
} from '../domain/engine';
import {
  ConfiguredOutput,
  EmptyDatasetPolicy,
  OutputValidationRule,
  PackageMemberRole,
  StructureField,
  TransformationKind,
  ValidationLayer,
} from '../domain/types';
import { HelpTooltip } from './HelpTooltip';
import { Step3DataOriginView } from './Step3DataOriginView';
import {
  TotaliaBuilderAssistantModal,
  TotaliaActionType,
} from './TotaliaBuilderAssistantModal';

const WIZARD_STEPS = [
  { step: 1, title: 'Paso 1. Datos generales', subtitle: 'Identificación y tipo de archivo' },
  { step: 2, title: 'Paso 2. Estructura del archivo', subtitle: 'Campos, propiedades y vista previa' },
  { step: 3, title: 'Paso 3. Origen de datos y correspondencia de campos', subtitle: 'Formatos del sistema, fuentes cliente y mapeo' },
  { step: 4, title: 'Paso 4. Validaciones', subtitle: 'Controles de estructura y archivo' },
  { step: 5, title: 'Paso 5. Generación y entrega', subtitle: 'Nombre dinámico, paquete y canal' },
  { step: 6, title: 'Paso 6. Pruebas', subtitle: 'Validación, vista previa y descarga' },
  { step: 7, title: 'Paso 7. Guardar y publicar', subtitle: 'Resumen, versión y publicación' },
];

export const VisualOutputBuilderView: React.FC = () => {
  const {
    outputTypes,
    configuredOutputs,
    selectedOutputId,
    setSelectedOutputId,
    activeBuilderStep: builderStep,
    setActiveBuilderStep: setBuilderStep,
    dataContracts,
    catalogSourceFormats,
    deliveryChannels,
    regulatoryFormats,
    associations,
    daqueProfiles,
    executionRuns,
    normativeSources,
    globalEntity,
    globalPeriod,
    lastSavedAt,
    saveConfiguredOutput,
    saveOutputType,
    saveDataContract,
    saveCatalogSourceFormat,
    importCatalogEntriesBatch,
    registerStructureForCatalogEntry,
    addExecutionBatchToContract,
    createNewRevisionFromOutput,
    transitionOutputStatus,
    openAssociationForOutput,
    notify,
  } = useConfigurator();

  const currentStoredOutput = useMemo(
    () => configuredOutputs.find((o) => o.id === selectedOutputId) || configuredOutputs[0],
    [configuredOutputs, selectedOutputId]
  );

  const [draft, setDraft] = useState<ConfiguredOutput>(currentStoredOutput);
  const [selectedFieldId, setSelectedFieldId] = useState<string>(
    currentStoredOutput.fields[0]?.id || ''
  );
  const [revisionReason, setRevisionReason] = useState<string>(
    'Nueva revisión para actualizar estructura o mapeo sin afectar formatos vigentes.'
  );
  const [showRevisionModal, setShowRevisionModal] = useState<boolean>(false);
  const [showPublishConfirmModal, setShowPublishConfirmModal] = useState<boolean>(false);
  const [publishJustification, setPublishJustification] = useState<string>(
    'Configuración verificada en los 7 pasos del diseñador y aprobada para publicación.'
  );

  // Modal: Confirm File Type Change in Step 1
  const [pendingOutputTypeId, setPendingOutputTypeId] = useState<string | null>(null);

  // TOTALiA Contextual Assistant Modal State
  const [showTotaliaModal, setShowTotaliaModal] = useState<boolean>(false);
  const [totaliaModalAction, setTotaliaModalAction] =
    useState<TotaliaActionType>('siguiente_paso');

  const openTotaliaWithAction = (action: TotaliaActionType) => {
    setTotaliaModalAction(action);
    setShowTotaliaModal(true);
  };

  // Step 3: Auto-map overwrite option
  const [overwriteConfirmedMappings, setOverwriteConfirmedMappings] = useState<boolean>(false);

  // Step 4: Guided Rule Builder State
  const [guidedRuleField, setGuidedRuleField] = useState<string>('');
  const [guidedRuleOperator, setGuidedRuleOperator] = useState<
    'NOT_NULL' | 'MAX_LEN' | 'MIN_NUM' | 'NOT_ZERO' | 'REGEX' | 'IN_LIST' | 'RECORD_COUNT'
  >('NOT_NULL');
  const [guidedRuleParam, setGuidedRuleParam] = useState<string>('10');
  const [guidedRuleSeverity, setGuidedRuleSeverity] = useState<'Bloqueante' | 'Advertencia'>(
    'Bloqueante'
  );
  const [guidedRuleMessage, setGuidedRuleMessage] = useState<string>('');

  const isDraftDirtyRef = useRef<boolean>(false);

  // Sync local draft when selectedOutputId changes or when status transitions externally
  useEffect(() => {
    isDraftDirtyRef.current = false;
    setDraft(currentStoredOutput);
    if (
      currentStoredOutput.fields.length > 0 &&
      !currentStoredOutput.fields.some((f) => f.id === selectedFieldId)
    ) {
      setSelectedFieldId(currentStoredOutput.fields[0].id);
    }
  }, [currentStoredOutput.id, currentStoredOutput.version, currentStoredOutput.status]);

  const isImmutable = draft.status === 'Publicada' || draft.status === 'Aprobada';

  // Helper that updates local draft (pure state updater without side effects)
  const updateDraft = (updater: (prev: ConfiguredOutput) => ConfiguredOutput) => {
    isDraftDirtyRef.current = true;
    setDraft((prev) => {
      const next = updater(prev);
      return {
        ...next,
        fingerprint: `sha256:${next.code.toLowerCase()}_v${next.version.replace('.', '_')}_${next.fields.length}f_${next.validationRules.length}r`,
      };
    });
  };

  // Auto-persist local draft to context if editable (in an effect, never inside setState updater!)
  useEffect(() => {
    if (isDraftDirtyRef.current) {
      if (draft.status === 'Borrador' || draft.status === 'En revisión') {
        saveConfiguredOutput(draft, true);
      }
      isDraftDirtyRef.current = false;
    }
  }, [draft, saveConfiguredOutput]);

  const selectedOutputType = useMemo(
    () => outputTypes.find((t) => t.id === draft.outputTypeId) || outputTypes[0],
    [outputTypes, draft.outputTypeId]
  );

  const selectedDataContract = useMemo(
    () =>
      dataContracts.find((s) => s.id === draft.dataContractId) || dataContracts[0],
    [dataContracts, draft.dataContractId]
  );

  const syncedDemoRows = useMemo(
    () => getPeriodSyncedDemoRows(selectedDataContract, globalPeriod),
    [selectedDataContract, globalPeriod]
  );

  const linkedAssociations = useMemo(
    () =>
      associations.filter(
        (a) =>
          a.configuredOutputId === draft.id ||
          (draft.baseOutputId && a.configuredOutputId === draft.baseOutputId)
      ),
    [associations, draft.id, draft.baseOutputId]
  );

  const activeCatalogEntry = useMemo(() => {
    if (draft.sourceCatalogEntryId) {
      const match = catalogSourceFormats.find((e) => e.id === draft.sourceCatalogEntryId);
      if (match) return match;
    }
    const attachedId = draft.attachedSources?.[0]?.catalogEntryId;
    if (attachedId) {
      const match = catalogSourceFormats.find((e) => e.id === attachedId);
      if (match) return match;
    }
    return (
      catalogSourceFormats.find((e) => e.linkedDataContractId === selectedDataContract.id) || null
    );
  }, [
    draft.sourceCatalogEntryId,
    draft.attachedSources,
    catalogSourceFormats,
    selectedDataContract.id,
  ]);

  const activeFormat = useMemo(() => {
    const firstAssoc = linkedAssociations[0];
    return (
      regulatoryFormats.find((f) => f.id === firstAssoc?.formatId) || regulatoryFormats[0]
    );
  }, [linkedAssociations, regulatoryFormats]);

  const activeDaqueProfile = useMemo(() => {
    const firstAssoc = linkedAssociations[0];
    return (
      daqueProfiles.find((d) => d.id === firstAssoc?.daqueProfileId) || daqueProfiles[0]
    );
  }, [linkedAssociations, daqueProfiles]);

  const fileNameContext = useMemo(
    () => ({
      entidad: globalEntity.replace(/\s+/g, '_'),
      formato: activeFormat?.code || draft.code,
      periodo: globalPeriod,
      version: draft.version,
      consecutivo: '01',
    }),
    [globalEntity, activeFormat, draft.code, globalPeriod, draft.version]
  );

  // Real-time compilation, physical preview, and multi-layer validation
  const compiledResult = useMemo(() => {
    return generateOutputArtifact({
      output: draft,
      outputType: selectedOutputType,
      contract: selectedDataContract,
      allContracts: dataContracts,
      daqueProfile: activeDaqueProfile,
      context: fileNameContext,
      entidad: globalEntity,
    });
  }, [
    draft,
    selectedOutputType,
    selectedDataContract,
    dataContracts,
    activeDaqueProfile,
    fileNameContext,
    globalEntity,
  ]);

  // Structural diagnostics (unmapped required fields, invalid lengths, TXT overlaps)
  const configDiagnostics = useMemo(() => {
    const issues: {
      id: string;
      severity: 'Bloqueante' | 'Advertencia';
      step: number;
      fieldId?: string;
      fieldTechnicalName?: string;
      title: string;
      location: string;
      cause: string;
      consequence: string;
      action: string;
      howToFix: string;
    }[] = [];

    if (!draft.name.trim() || !draft.code.trim()) {
      issues.push({
        id: 'DIAG-GEN-01',
        severity: 'Bloqueante',
        step: 1,
        title: 'Nombre funcional o código identificador vacío',
        location: 'Paso 1 · Datos generales',
        cause: 'El formulario de identificación no tiene diligenciado el nombre descriptivo o el código regulatorio.',
        consequence: 'Impide identificar unívocamente la salida y bloqueará el paso a revisión o publicación.',
        action: 'Diligencie el nombre y el código identificador en el Paso 1.',
        howToFix: 'En el Paso 1 (Datos generales), complete el nombre y el código identificador.',
      });
    }

    if (draft.fields.length === 0) {
      issues.push({
        id: 'DIAG-STR-00',
        severity: 'Bloqueante',
        step: 2,
        title: 'La salida no tiene campos definidos',
        location: 'Paso 2 · Estructura de campos',
        cause: 'No se ha configurado ninguna columna en la sección de detalle.',
        consequence: 'No es posible serializar ningún registro de archivo.',
        action: 'Agregue campos manualmente o use "Proponer campos" con TOTALiA® en el Paso 2.',
        howToFix: 'En el Paso 2 (Estructura del archivo), agregue al menos un campo.',
      });
    }

    draft.fields.forEach((f) => {
      if (!f.length || f.length <= 0) {
        issues.push({
          id: `DIAG-LEN-${f.id}`,
          severity: 'Bloqueante',
          step: 2,
          fieldId: f.id,
          fieldTechnicalName: f.technicalName,
          title: `Longitud inválida (${f.length}) en el campo "${f.technicalName}"`,
          location: `Paso 2 · Campo "${f.technicalName}"`,
          cause: 'La longitud declarada es 0 o negativa.',
          consequence: 'Impide el formateo correcto y la reserva de espacio en archivos TXT o bases de datos.',
          action: `Asigne una longitud mayor a 0 según el instructivo oficial en el Paso 2.`,
          howToFix: `En el Paso 2, seleccione el campo "${f.technicalName}" y asigne una longitud mayor a 0 según el instructivo oficial.`,
        });
      }

      if (
        f.required &&
        !f.mapping.sourceField.trim() &&
        f.mapping.transformationKind !== 'Constante' &&
        f.mapping.transformationKind !== 'Variable de contexto' &&
        f.mapping.transformationKind !== 'Concatenación tipada' &&
        !f.defaultValue.trim()
      ) {
        issues.push({
          id: `DIAG-MAP-${f.id}`,
          severity: 'Bloqueante',
          step: 3,
          fieldId: f.id,
          fieldTechnicalName: f.technicalName,
          title: `Campo obligatorio "${f.technicalName}" sin origen de datos asignado`,
          location: `Paso 3 · Mapeo de "${f.technicalName}"`,
          cause: 'El campo está marcado como obligatorio pero no tiene columna origen, constante ni transformación asociada.',
          consequence: 'Generará valores vacíos o nulos que serán rechazados por el motor de serialización y la entidad receptora.',
          action: `Asigne una columna de la fuente o configure una transformación en el Paso 3.`,
          howToFix: `En el Paso 3 (Origen de datos y correspondencia de campos), seleccione una columna de la fuente o defina una constante/variable de contexto para "${f.technicalName}".`,
        });
      }

      if (f.mapping.mappingStatus === 'Requiere revisión por cambio en fuente') {
        issues.push({
          id: `DIAG-SRCCHG-${f.id}`,
          severity: 'Bloqueante',
          step: 3,
          fieldId: f.id,
          fieldTechnicalName: f.technicalName,
          title: `Campo "${f.technicalName}" requiere revisión por cambio en la estructura de origen`,
          location: `Paso 3 · Correspondencia de "${f.technicalName}"`,
          cause: `La columna de origen "${f.mapping.sourceField}" fue renombrada, eliminada o alterada en el contrato de datos.`,
          consequence: 'La generación fallará en tiempo de ejecución al intentar leer un campo inexistente o con tipo incompatible.',
          action: 'Revise la columna en el Paso 3 y confirme nuevamente la correspondencia.',
          howToFix: `En el Paso 3, revise la columna origen "${f.mapping.sourceField}" (${f.mapping.changeImpactNote || 'estructura actualizada'}) y confirme nuevamente la correspondencia.`,
        });
      }
    });

    if (selectedOutputType.family === 'TXT') {
      const sorted = [...draft.fields].sort(
        (a, b) => (a.startPosition || 0) - (b.startPosition || 0)
      );
      for (let i = 0; i < sorted.length - 1; i++) {
        const cur = sorted[i];
        const next = sorted[i + 1];
        const curEnd = (cur.startPosition || 1) + Math.max(1, cur.length) - 1;
        if (curEnd >= (next.startPosition || 1)) {
          issues.push({
            id: `DIAG-OVERLAP-${cur.id}-${next.id}`,
            severity: 'Bloqueante',
            step: 2,
            fieldId: next.id,
            fieldTechnicalName: next.technicalName,
            title: `Solapamiento de posiciones entre "${cur.technicalName}" y "${next.technicalName}"`,
            location: `Paso 2 · Posición fija (${curEnd} >= ${next.startPosition || 1})`,
            cause: `El campo "${cur.technicalName}" termina en posición ${curEnd} y el siguiente inicia antes (${next.startPosition || 1}).`,
            consequence: 'Generará registros deformados en archivos de ancho fijo que corromperán la lectura de los datos.',
            action: 'Pulse "Recalcular posiciones TXT automáticamente" en el Paso 2.',
            howToFix:
              'En el Paso 2, pulse "Recalcular posiciones TXT automáticamente" para alinear las posiciones consecutivamente sin cruces.',
          });
        }
      }
    }

    return issues;
  }, [draft, selectedOutputType.family]);

  // Structural blockers (lengths, technical names, overlaps, mapping invalidations)
  const structuralBlockingCount =
    configDiagnostics.filter((d) => d.severity === 'Bloqueante').length +
    compiledResult.findings.filter(
      (f) =>
        f.severity === 'Bloqueante' &&
        f.layer !== 'Datos del formato (DAQUE)' &&
        f.code !== 'CES-DAT-000'
    ).length;

  // Total blockers across all layers including DAQUE data availability (CES-DAT-000)
  const totalBlockingCount =
    configDiagnostics.filter((d) => d.severity === 'Bloqueante').length +
    compiledResult.findings.filter((f) => f.severity === 'Bloqueante').length;

  // Backward compatibility alias for structural integrity
  const blockingIssuesCount = structuralBlockingCount;

  const isPhysicalEngineSupported = selectedOutputType.canGenerateRealFileInBrowser;

  const canDownloadPhysicalArtifact =
    isPhysicalEngineSupported &&
    totalBlockingCount === 0 &&
    compiledResult.readinessMatrix.downloadAvailabilityStatus.canDownload &&
    compiledResult.isRealExecutableGeneration;

  // 5 Advancement States (Mutually Exclusive / Distinct per user prompt)
  const advancementState = useMemo(() => {
    if (draft.fields.length === 0 || !draft.name.trim() || !draft.code.trim()) {
      return {
        key: 'incompleta' as const,
        label: 'Estructura incompleta',
        desc: 'Faltan campos o datos de identificación obligatorios en la salida.',
        badgeClass: 'bg-rose-100 text-rose-950 border-rose-300',
      };
    }
    if (structuralBlockingCount > 0) {
      return {
        key: 'errores' as const,
        label: 'Errores por corregir',
        desc: `${structuralBlockingCount} error(es) bloqueante(s) de estructura, longitud o correspondencia.`,
        badgeClass: 'bg-rose-100 text-rose-950 border-rose-300',
      };
    }
    const hasBatch = Boolean(
      compiledResult.resolvedPrimaryBatch && compiledResult.isRealExecutableGeneration
    );
    if (!hasBatch) {
      return {
        key: 'pendiente_datos' as const,
        label: 'Estructura válida, pendiente de datos',
        desc: `Estructura técnicamente correcta. Falta lote de datos compatible en ${globalPeriod} para generación operativa.`,
        badgeClass: 'bg-amber-100 text-amber-950 border-amber-300',
      };
    }
    const hasUnconfirmed = draft.fields.some(
      (f) => f.mapping.mappingStatus === 'Propuesta automática (Requiere confirmación)'
    );
    const hasWarnings = compiledResult.findings.some((f) => f.severity === 'Advertencia');
    if (hasUnconfirmed || hasWarnings) {
      return {
        key: 'pendientes_validar' as const,
        label: 'Datos disponibles, pendientes de validar',
        desc: 'Lote compatible asignado con correspondencias o advertencias que requieren revisión.',
        badgeClass: 'bg-blue-100 text-blue-950 border-blue-300',
      };
    }
    return {
      key: 'lista' as const,
      label: 'Configuración lista para la acción correspondiente',
      desc: 'Estructura y datos verificados. Lista para generar archivo o tramitar publicación.',
      badgeClass: 'bg-emerald-100 text-emerald-950 border-emerald-300',
    };
  }, [
    draft.fields,
    draft.name,
    draft.code,
    structuralBlockingCount,
    compiledResult.resolvedPrimaryBatch,
    compiledResult.isRealExecutableGeneration,
    compiledResult.findings,
    globalPeriod,
  ]);

  // Step Guidance definitions (Paso 1 a 7)
  const currentStepGuidance = useMemo(() => {
    switch (builderStep) {
      case 1:
        return {
          title: 'Paso 1. Datos generales de la salida',
          whatConfiguring: `Identificación funcional, código único, organismo supervisor y tipo de archivo (${selectedOutputType.family}).`,
          whatNeeded: 'Nombre funcional del reporte, código regulatorio y familia técnica.',
          whatMissing:
            !draft.name.trim() || !draft.code.trim()
              ? 'Complete el nombre funcional y el código identificador.'
              : 'Identificación completa y válida.',
          nextAction: 'Continuar a 2. Estructura del archivo',
          nextStep: 2,
          blockers:
            !draft.name.trim() || !draft.code.trim()
              ? 'Nombre o código vacíos impiden la publicación.'
              : null,
        };
      case 2:
        return {
          title: 'Paso 2. Estructura del archivo y campos',
          whatConfiguring: `Secciones, columnas, tipos de datos (${selectedOutputType.family}), longitudes y posiciones.`,
          whatNeeded: 'Especificación oficial de columnas o instructivo del regulador.',
          whatMissing:
            draft.fields.length === 0
              ? 'No hay campos creados. Agregue campos o use "Proponer campos" con TOTALiA®.'
              : draft.fields.some((f) => !f.length)
              ? 'Hay campos con longitud 0 o inválida.'
              : 'Estructura de campos completa.',
          nextAction: 'Continuar a 3. Origen de datos y correspondencia',
          nextStep: 3,
          blockers:
            draft.fields.length === 0 || draft.fields.some((f) => !f.length)
              ? 'Campos incompletos impiden la generación de archivo.'
              : null,
        };
      case 3:
        return {
          title: 'Paso 3. Origen de datos y correspondencia de campos',
          whatConfiguring:
            'Fuente que aporta la información (informe generado o fuente cliente), lote de registros y asignación de cada campo.',
          whatNeeded: 'Informe del sistema o archivo de registros del cliente para el periodo.',
          whatMissing:
            draft.fields.some((f) => f.required && !f.mapping.sourceField && !f.defaultValue)
              ? 'Existen campos obligatorios sin columna de origen asignada ni transformación.'
              : !compiledResult.resolvedPrimaryBatch
              ? `Sin lote de datos para el periodo ${globalPeriod}. La estructura se puede guardar como borrador; se requerirá lote para generar archivo físico.`
              : 'Origen y correspondencias asignadas.',
          nextAction: 'Continuar a 4. Validaciones y reglas',
          nextStep: 4,
          blockers: draft.fields.some(
            (f) => f.required && !f.mapping.sourceField && !f.defaultValue
          )
            ? 'Campos obligatorios sin origen asignado impiden la generación operativa.'
            : null,
        };
      case 4:
        return {
          title: 'Paso 4. Validaciones y reglas de control',
          whatConfiguring:
            'Reglas de no nulidad, límites de valor, expresiones regulares y perfiles DAQUE.',
          whatNeeded: 'Reglas de consistencia exigidas por la entidad supervisora.',
          whatMissing:
            draft.validationRules.length === 0
              ? 'Sin reglas personalizadas añadidas (aplica validaciones técnicas básicas).'
              : `${draft.validationRules.length} regla(s) activas.`,
          nextAction: 'Continuar a 5. Nomenclatura y entrega',
          nextStep: 5,
          blockers: null,
        };
      case 5:
        return {
          title: 'Paso 5. Nomenclatura, empaquetado y entrega',
          whatConfiguring:
            'Patrón de nombre dinámico ({entidad}, {periodo}), formato de compresión y canal de transmisión.',
          whatNeeded: 'Nomenclatura oficial exigida por la entidad.',
          whatMissing: 'Parámetros de entrega configurados.',
          nextAction: 'Continuar a 6. Vista previa y pruebas',
          nextStep: 6,
          blockers: null,
        };
      case 6:
        return {
          title: 'Paso 6. Vista previa, pruebas y preparación técnica',
          whatConfiguring:
            'Inspección del archivo físico, matriz de preparación técnica y descarga del artefacto.',
          whatNeeded: 'Lote compatible para verificar el resultado final con datos reales.',
          whatMissing:
            !compiledResult.resolvedPrimaryBatch
              ? `Falta lote compatible para ${globalEntity} en ${globalPeriod} (CES-DAT-000). Descarga bloqueada hasta cargar datos en Paso 3.`
              : 'Verificación lista.',
          nextAction: 'Continuar a 7. Guardar y publicar',
          nextStep: 7,
          blockers: !canDownloadPhysicalArtifact
            ? 'Descarga deshabilitada por falta de lote compatible o bloqueos de formato.'
            : null,
        };
      case 7:
        return {
          title: 'Paso 7. Guardar, resumen y ciclo de vida de la versión',
          whatConfiguring:
            'Transición de estado de versión (Borrador -> En revisión -> Aprobada -> Publicada) y bitácora de auditoría.',
          whatNeeded: 'Aprobación funcional según atribuciones del perfil.',
          whatMissing:
            structuralBlockingCount > 0
              ? 'Corrija los errores de estructura antes de solicitar aprobación.'
              : `Versión lista en estado: ${draft.status}.`,
          nextAction: 'Finalizar configuración y revisar asociaciones en Módulo D',
          nextStep: 7,
          blockers: structuralBlockingCount > 0 ? 'Errores bloqueantes pendientes.' : null,
        };
      default:
        return {
          title: 'Diseñador de salidas',
          whatConfiguring: '',
          whatNeeded: '',
          whatMissing: '',
          nextAction: '',
          nextStep: 1,
          blockers: null,
        };
    }
  }, [
    builderStep,
    draft,
    selectedOutputType.family,
    compiledResult.resolvedPrimaryBatch,
    globalPeriod,
    globalEntity,
    structuralBlockingCount,
    canDownloadPhysicalArtifact,
  ]);

  // Header and diagnostics for Step 6 preview (Differentiating the 4 required cases)
  const previewArtifactHeader = useMemo(() => {
    // Case 1: Configuration blocking errors
    if (structuralBlockingCount > 0) {
      return {
        title: `Generación bloqueada por errores de configuración (${structuralBlockingCount} error(es))`,
        subtitle:
          'Corrija las definiciones de campos y correspondencias en los pasos 1–4 para compilar el archivo físico.',
        isPhysicalReady: false,
        badgeLabel: 'Generación bloqueada',
        badgeClass: 'bg-rose-100 text-rose-900 border border-rose-300',
      };
    }

    // Case 2: Absence of compatible data batch (CES-DAT-000)
    const hasBatch = Boolean(
      compiledResult.resolvedPrimaryBatch && compiledResult.isRealExecutableGeneration
    );
    const hasCesDat000 = compiledResult.findings.some((f) => f.code === 'CES-DAT-000');

    if (!hasBatch || hasCesDat000) {
      return {
        title: 'Vista previa estructural — sin archivo generado',
        subtitle: `Sin lote compatible para "${globalEntity}" en el periodo "${globalPeriod}" (CES-DAT-000). Se muestra la estructura como plantilla de diseño; no se genera archivo físico.`,
        isPhysicalReady: false,
        badgeLabel: 'Vista previa estructural',
        badgeClass: 'bg-amber-100 text-amber-950 border border-amber-300',
      };
    }

    // Case 3: Batch exists but has 0 records (distinguishing empty policy)
    if (compiledResult.rowsProcessed === 0) {
      const allowsEmpty =
        draft.composition.emptyDatasetPolicy !== 'Bloquear generación';
      if (allowsEmpty) {
        return {
          title: 'Archivo generado sin registros de detalle (Permitido por política de archivo vacío)',
          subtitle: `La configuración autoriza la generación de un archivo sin registros de movimiento (${draft.composition.emptyDatasetPolicy}).`,
          isPhysicalReady: true,
          badgeLabel: 'Archivo vacío permitido',
          badgeClass: 'bg-blue-100 text-blue-900 border border-blue-300',
        };
      } else {
        return {
          title: `Lote existente con 0 registros — Archivo vacío generado (${compiledResult.resolvedPrimaryBatch?.executionCode})`,
          subtitle: 'El lote no contiene registros de detalle para este corte.',
          isPhysicalReady: true,
          badgeLabel: 'Lote con 0 registros',
          badgeClass: 'bg-amber-100 text-amber-950 border border-amber-300',
        };
      }
    }

    // Case 4: Binary or non-physical in-browser serialisation (e.g. AVRO)
    if (!isPhysicalEngineSupported) {
      return {
        title: `Vista previa de esquema y estructura (${compiledResult.rowsProcessed} registros · Sin binario)`,
        subtitle: `Archivo: ${compiledResult.fileName} · ${compiledResult.engineNotice}`,
        isPhysicalReady: true,
        badgeLabel: 'Esquema validado',
        badgeClass: 'bg-sky-100 text-sky-900 border border-sky-300',
      };
    }

    // Case 5: Valid physical artifact generated
    return {
      title: `Contenido físico generado (${compiledResult.rowsProcessed} registros · Corte ${globalPeriod})`,
      subtitle: `Archivo: ${compiledResult.fileName} · ${compiledResult.engineNotice}`,
      isPhysicalReady: true,
      badgeLabel: 'Archivo generado',
      badgeClass: 'bg-emerald-100 text-emerald-900 border border-emerald-300',
    };
  }, [
    structuralBlockingCount,
    compiledResult.resolvedPrimaryBatch,
    compiledResult.isRealExecutableGeneration,
    compiledResult.findings,
    compiledResult.rowsProcessed,
    compiledResult.fileName,
    compiledResult.engineNotice,
    draft.composition.emptyDatasetPolicy,
    isPhysicalEngineSupported,
    globalEntity,
    globalPeriod,
  ]);

  const selectedField = useMemo(
    () => draft.fields.find((f) => f.id === selectedFieldId) || draft.fields[0] || null,
    [draft.fields, selectedFieldId]
  );

  //Navigate directly to affected field in Step 2 or Step 3
  const jumpToFieldByTechnicalName = (techName?: string, targetStep = 2) => {
    if (techName) {
      const found = draft.fields.find(
        (f) => f.technicalName.toLowerCase() === techName.toLowerCase()
      );
      if (found) {
        setSelectedFieldId(found.id);
      }
    }
    setBuilderStep(targetStep);
  };

  // Field Manipulation Helpers
  const recalculateTxtPositions = (fields: StructureField[]): StructureField[] => {
    let cursor = 1;
    return fields.map((f, idx) => {
      const len = Math.max(1, f.length || 1);
      const start = cursor;
      cursor = start + len;
      return {
        ...f,
        order: idx + 1,
        startPosition: start,
      };
    });
  };

  const handleUpdateField = (fieldId: string, patch: Partial<StructureField>) => {
    if (isImmutable) return;
    updateDraft((prev) => {
      const updatedFields = prev.fields.map((f) => {
        if (f.id !== fieldId) return f;
        return { ...f, ...patch };
      });
      return {
        ...prev,
        fields: updatedFields,
      };
    });
  };

  const handleUpdateFieldMapping = (
    fieldId: string,
    mappingPatch: Partial<StructureField['mapping']>
  ) => {
    if (isImmutable) return;
    updateDraft((prev) => ({
      ...prev,
      fields: prev.fields.map((f) =>
        f.id === fieldId
          ? {
              ...f,
              mapping: {
                ...f.mapping,
                ...mappingPatch,
                mappingStatus:
                  mappingPatch.mappingStatus ?? 'Confirmado por usuario',
              },
            }
          : f
      ),
    }));
  };

  const handleAddField = () => {
    if (isImmutable) return;
    const nextOrder = draft.fields.length + 1;
    const lastField = draft.fields[draft.fields.length - 1];
    const startPos = lastField
      ? (lastField.startPosition || 1) + Math.max(1, lastField.length)
      : 1;
    const defaultLength = 15;
    const defaultUnit =
      selectedOutputType.family === 'TXT'
        ? selectedOutputType.txtParams?.lengthUnit || 'Caracteres'
        : 'Caracteres';

    // New fields start unassigned ('Sin asignar') instead of guessing a column by modulo index!
    const newField: StructureField = {
      id: `FLD-${Date.now().toString(36).toUpperCase()}`,
      technicalName: `campo_${nextOrder}`,
      label: `Nuevo Campo ${nextOrder}`,
      description: 'Campo configurado por el usuario',
      recordSection: 'Detalle',
      order: nextOrder,
      dataType: 'Texto',
      physicalType: `VARCHAR(${defaultLength})`,
      length: defaultLength,
      lengthUnit: defaultUnit,
      required: true,
      nullable: false,
      startPosition: startPos,
      formatMask: '',
      defaultValue: '',
      paddingChar: selectedOutputType.family === 'TXT' ? ' ' : 'Ninguno',
      alignment: 'Izquierda',
      overflowRule: 'Bloquear con error',
      protectionClass: 'Parametrizable',
      evidenceState: 'Sustento explícito',
      evidenceSourceRef: 'Configurado en diseñador',
      xmlNodeKind: 'Elemento',
      avroLogicalType: 'string',
      mapping: {
        transformationKind: 'Directo',
        sourceContractId: selectedDataContract.id,
        sourceField: '',
        expression: '',
        isParameterizedPoint: false,
        emptyTreatment: 'Error bloqueante',
        mappingStatus: 'Sin asignar',
      },
    };

    updateDraft((prev) => ({
      ...prev,
      fields: [...prev.fields, newField],
    }));
    setSelectedFieldId(newField.id);
    notify(
      'info',
      `Campo "${newField.technicalName}" agregado en Paso 2. Asigne su columna de origen en el Paso 3.`
    );
  };

  const handleDuplicateField = (field: StructureField) => {
    if (isImmutable) return;
    const nextOrder = draft.fields.length + 1;
    const lastField = draft.fields[draft.fields.length - 1];
    const startPos = lastField
      ? (lastField.startPosition || 1) + Math.max(1, lastField.length)
      : 1;
    const duplicated: StructureField = {
      ...field,
      id: `FLD-${Date.now().toString(36).toUpperCase()}`,
      order: nextOrder,
      technicalName: `${field.technicalName}_copia`,
      label: `${field.label} (Copia)`,
      startPosition: startPos,
      mapping: { ...field.mapping },
    };
    updateDraft((prev) => ({
      ...prev,
      fields: [...prev.fields, duplicated],
    }));
    setSelectedFieldId(duplicated.id);
    notify('info', `Campo "${field.technicalName}" duplicado.`);
  };

  const handleDeleteField = (fieldId: string) => {
    if (isImmutable || draft.fields.length <= 1) return;
    updateDraft((prev) => {
      const remaining = prev.fields
        .filter((f) => f.id !== fieldId)
        .map((f, idx) => ({ ...f, order: idx + 1 }));
      return {
        ...prev,
        fields: remaining,
      };
    });
    if (selectedFieldId === fieldId) {
      const nextFirst = draft.fields.find((f) => f.id !== fieldId);
      if (nextFirst) setSelectedFieldId(nextFirst.id);
    }
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    if (isImmutable) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= draft.fields.length) return;
    updateDraft((prev) => {
      const clone = [...prev.fields];
      const temp = clone[index];
      clone[index] = clone[targetIndex];
      clone[targetIndex] = temp;
      const reordered =
        selectedOutputType.family === 'TXT'
          ? recalculateTxtPositions(clone)
          : clone.map((f, i) => ({ ...f, order: i + 1 }));
      return {
        ...prev,
        fields: reordered,
      };
    });
  };

  const handleRecalculateAllTxtPositions = () => {
    if (isImmutable) return;
    updateDraft((prev) => ({
      ...prev,
      fields: recalculateTxtPositions(prev.fields),
    }));
    notify('success', 'Posiciones iniciales y finales recalculadas secuencialmente sin solapamientos.');
  };

  const handleApplyLengthUnitToAllFields = (unit: 'Caracteres' | 'Bytes') => {
    if (isImmutable) return;
    updateDraft((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => ({ ...f, lengthUnit: unit })),
    }));
    if (selectedOutputType.txtParams) {
      saveOutputType({
        ...selectedOutputType,
        txtParams: { ...selectedOutputType.txtParams, lengthUnit: unit },
      });
    }
    notify('info', `Unidad de medición actualizada a "${unit}" en todos los campos de la estructura.`);
  };

  const handleAutoMapFields = () => {
    if (isImmutable) return;
    const result = proposeFieldMappings(
      draft.fields,
      selectedDataContract.fields,
      selectedDataContract.id,
      overwriteConfirmedMappings
    );
    updateDraft((prev) => ({
      ...prev,
      fields: result.updatedFields,
    }));

    if (result.unmatchedCount > 0) {
      notify(
        'warning',
        `Asignación automática: ${result.matchedCount} propuesta(s) por similitud semántica (requieren confirmación) y ${result.unmatchedCount} campo(s) sin coincidencia confiable en el contrato que requieren selección manual.`
      );
    } else {
      notify(
        'info',
        `Asignación automática: ${result.matchedCount} propuesta(s) generadas para revisión (${result.preservedCount} asignaciones manuales conservadas). Confirme cada correspondencia.`
      );
    }
  };

  const handleConfirmAllProposedMappings = () => {
    if (isImmutable) return;
    updateDraft((prev) => ({
      ...prev,
      fields: prev.fields.map((f) =>
        f.mapping.mappingStatus === 'Propuesta automática (Requiere confirmación)'
          ? {
              ...f,
              mapping: {
                ...f.mapping,
                mappingStatus: 'Confirmado por usuario',
              },
            }
          : f
      ),
    }));
    notify('success', 'Todas las propuestas automáticas de mapeo han sido confirmadas.');
  };

  const handleAddGuidedRule = () => {
    if (isImmutable) return;
    const targetField =
      guidedRuleOperator === 'RECORD_COUNT'
        ? 'Conjunto de registros'
        : guidedRuleField || draft.fields[0]?.technicalName || 'id_obligacion';

    let conditionExpression = '';
    let defaultName = '';
    let defaultMsg = '';
    let layer: ValidationLayer = 'Representación y archivo';

    switch (guidedRuleOperator) {
      case 'NOT_NULL':
        conditionExpression = `NOT_NULL(${targetField})`;
        defaultName = `Presencia obligatoria en ${targetField}`;
        defaultMsg = `El campo ${targetField} no puede estar vacío.`;
        break;
      case 'MAX_LEN':
        conditionExpression = `LEN_CHARS(${targetField}) <= ${Number(guidedRuleParam) || 10}`;
        defaultName = `Longitud máxima de ${targetField} (<= ${Number(guidedRuleParam) || 10})`;
        defaultMsg = `El campo ${targetField} excede el límite de ${Number(guidedRuleParam) || 10} caracteres.`;
        break;
      case 'MIN_NUM':
        conditionExpression = `${targetField} >= ${Number(guidedRuleParam) || 0}`;
        defaultName = `Rango mínimo en ${targetField} (>= ${Number(guidedRuleParam) || 0})`;
        defaultMsg = `El valor numérico de ${targetField} es inferior al mínimo permitido (${Number(guidedRuleParam) || 0}).`;
        break;
      case 'NOT_ZERO':
        conditionExpression = `${targetField} != 0`;
        defaultName = `Rechazo de valor cero en ${targetField}`;
        defaultMsg = `El campo ${targetField} no admite valor igual a cero (0).`;
        break;
      case 'REGEX':
        conditionExpression = `MATCH_REGEX(${targetField}, '${guidedRuleParam || '^[0-9]+$'}')`;
        defaultName = `Formato regular en ${targetField}`;
        defaultMsg = `El valor de ${targetField} no cumple el patrón requerido (${guidedRuleParam || '^[0-9]+$'}).`;
        break;
      case 'IN_LIST':
        conditionExpression = `IN_LIST(${targetField}, '${guidedRuleParam || 'VIGENTE,VENCIDO'}')`;
        defaultName = `Catálogo permitido en ${targetField}`;
        defaultMsg = `El valor de ${targetField} no pertenece a la lista autorizada (${guidedRuleParam || 'VIGENTE,VENCIDO'}).`;
        break;
      case 'RECORD_COUNT':
        conditionExpression = `RECORD_COUNT >= ${Number(guidedRuleParam) || 1}`;
        defaultName = `Mínimo de registros en el archivo (>= ${Number(guidedRuleParam) || 1})`;
        defaultMsg = `El archivo debe contener al menos ${Number(guidedRuleParam) || 1} registro(s).`;
        layer = 'Coherencia de conjunto';
        break;
    }

    const nextNum = draft.validationRules.length + 1;
    const newRule: OutputValidationRule = {
      id: `VR-${Date.now()}`,
      code: `VAL-USR-0${nextNum}`,
      name: defaultName,
      layer,
      targetFieldOrRole: targetField,
      conditionExpression,
      severity: guidedRuleSeverity,
      isNormativeProtected: false,
      owner: 'Política de salida y entrega',
      diagnosticMessage: guidedRuleMessage.trim() || defaultMsg,
      enabled: true,
    };

    updateDraft((p) => ({
      ...p,
      validationRules: [...p.validationRules, newRule],
    }));
    setGuidedRuleMessage('');
    notify(
      'success',
      `Regla "${newRule.code}" (${newRule.conditionExpression}) agregada y evaluada sobre los datos de prueba.`
    );
  };

  const handleDownloadPreviewArtifact = () => {
    if (!isPhysicalEngineSupported) return;
    if (!canDownloadPhysicalArtifact) {
      notify(
        'error',
        'No es posible descargar el archivo físico: la generación está bloqueada por errores de configuración o por falta de un lote de datos compatible en el Paso 3.'
      );
      return;
    }
    const blob = new Blob([compiledResult.content], { type: compiledResult.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = compiledResult.fileName;
    a.click();
    URL.revokeObjectURL(url);
    notify(
      'success',
      `Archivo físico "${compiledResult.fileName}" generado y descargado correctamente.`
    );
  };

  const handleManualSave = () => {
    saveConfiguredOutput(draft, false);
  };

  const handleConfirmOutputTypeChange = () => {
    if (!pendingOutputTypeId) return;
    const nextType = outputTypes.find((t) => t.id === pendingOutputTypeId);
    if (!nextType) {
      setPendingOutputTypeId(null);
      return;
    }
    const cleanExt = nextType.extension.replace(/^\./, '');
    updateDraft((p) => {
      const basePattern = p.composition.fileNamePattern.replace(/\.[a-z0-9]+$/i, '');
      return {
        ...p,
        outputTypeId: nextType.id,
        composition: {
          ...p.composition,
          extension: cleanExt,
          encoding:
            nextType.family === 'AVRO'
              ? 'Binario'
              : p.composition.encoding === 'Binario'
              ? 'UTF-8'
              : p.composition.encoding,
          delimiter:
            nextType.family === 'CSV'
              ? ';'
              : nextType.family === 'TXT'
              ? 'Ancho fijo'
              : 'N/A',
          packageMembers: p.composition.packageMembers.map((m) =>
            m.role === 'Principal'
              ? { ...m, fileNamePattern: `${basePattern}.${cleanExt}` }
              : m
          ),
        },
        fields:
          nextType.family === 'TXT'
            ? recalculateTxtPositions(p.fields)
            : p.fields,
      };
    });
    setPendingOutputTypeId(null);
    notify(
      'info',
      `Tipo de archivo cambiado a ${nextType.family} (${nextType.name}). Se conservaron los ${draft.fields.length} campos y sus orígenes de datos.`
    );
  };

  const relatedRuns = useMemo(
    () =>
      executionRuns.filter(
        (r) =>
          r.configuredOutputId === draft.id ||
          (draft.baseOutputId && r.configuredOutputId === draft.baseOutputId)
      ),
    [executionRuns, draft.id, draft.baseOutputId]
  );

  const selectedDeliveryChannel = useMemo(
    () =>
      deliveryChannels.find((c) => c.id === draft.defaultDeliveryChannelId) ||
      deliveryChannels[0],
    [deliveryChannels, draft.defaultDeliveryChannelId]
  );

  return (
    <div className="space-y-4">
      {/* Top Bar: Output Selector, Status, and Save Action */}
      <div className="bg-white border border-slate-200 rounded-md p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E4E8C] flex items-center gap-1">
              <span>C. Diseñador de salidas · Asistente Guiado en 7 Pasos</span>
              <HelpTooltip
                title="Diseñador de salidas en 7 pasos"
                description="Permite configurar una salida regulatoria desde sus datos generales hasta su publicación. Todos los cambios en estado Borrador o En revisión se guardan automáticamente en el navegador y actualizan en tiempo real la vista previa."
              />
            </span>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <select
                aria-label="Seleccionar salida en el diseñador"
                value={draft.id}
                onChange={(e) => {
                  setSelectedOutputId(e.target.value);
                }}
                className="border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold bg-white text-slate-900"
              >
                {configuredOutputs.map((o) => {
                  const ot = outputTypes.find((t) => t.id === o.outputTypeId);
                  return (
                    <option key={o.id} value={o.id}>
                      [{ot?.family}] {o.code} (v{o.version}) — {o.name} ({o.status})
                    </option>
                  );
                })}
              </select>

              <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-[#0F1F38] text-white">
                {selectedOutputType.family}
              </span>

              <span
                className={`px-2.5 py-1 rounded text-xs font-semibold border ${
                  draft.status === 'Publicada'
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : draft.status === 'Aprobada'
                    ? 'bg-blue-50 text-blue-900 border-blue-300'
                    : draft.status === 'En revisión'
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-slate-100 text-slate-900 border-slate-300'
                }`}
              >
                Estado: {draft.status} (v{draft.version})
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isImmutable ? (
            <>
              <HelpTooltip
                variant="disabled-reason"
                align="right"
                label="¿Por qué está en modo consulta?"
                title="Versión protegida contra edición directa"
                description={`La versión v${draft.version} se encuentra en estado "${draft.status}". En plataformas regulatorias, las versiones aprobadas o publicadas son inmutables para garantizar trazabilidad histórica.`}
                disabledReason={`Estado actual: ${draft.status} (Inmutable).`}
                enableRequirement="Pulse 'Crear nueva revisión para editar' para generar un Borrador editable sin alterar la versión publicada."
              />
              <button
                type="button"
                onClick={() => setShowRevisionModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
              >
                <GitBranch className="w-4 h-4" />
                Crear nueva revisión para editar
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded font-mono">
                Autoguardado: {lastSavedAt}
              </span>
              <button
                type="button"
                onClick={handleManualSave}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-xs font-bold bg-[#1E4E8C] text-white hover:bg-[#163A69] transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                Guardar cambios
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Immutability Warning Banner when viewing a Published/Approved output */}
      {isImmutable && (
        <div className="bg-amber-50 border border-amber-300 rounded-md p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">
                Modo consulta: Esta versión (v{draft.version}) está {draft.status} y protegida contra edición directa
              </div>
              <p className="mt-0.5 text-amber-900">
                {linkedAssociations.length > 0
                  ? `Actualmente está asociada a ${linkedAssociations.length} formato(s) regulatorio(s) (${linkedAssociations
                      .map((a) => regulatoryFormats.find((f) => f.id === a.formatId)?.code || a.code)
                      .join(', ')}). Para modificar campos, mapeos o reglas sin afectar las entregas vigentes, cree una nueva revisión en borrador.`
                  : 'Las versiones aprobadas o publicadas no se modifican directamente para preservar la auditoría regulatoria.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowRevisionModal(true)}
            className="px-3 py-1.5 rounded bg-amber-900 text-white font-semibold hover:bg-amber-950 shrink-0 cursor-pointer"
          >
            Crear nueva revisión editable
          </button>
        </div>
      )}

      {/* 7-Step Horizontal Stepper */}
      <div className="bg-white border border-slate-200 rounded-md p-2.5 overflow-x-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 min-w-[680px]">
          {WIZARD_STEPS.map((s) => {
            const isActive = builderStep === s.step;
            const stepIssues = configDiagnostics.filter((d) => d.step === s.step);
            return (
              <button
                key={s.step}
                type="button"
                onClick={() => setBuilderStep(s.step)}
                className={`p-2 rounded text-left border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0F1F38] text-white border-[#0F1F38] shadow-xs'
                    : stepIssues.length > 0
                    ? 'bg-rose-50/70 text-rose-950 border-rose-300 hover:bg-rose-100/70'
                    : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-bold leading-tight">{s.title}</span>
                  {stepIssues.length > 0 && (
                    <span
                      title={`${stepIssues.length} hallazgo(s) pendiente(s) en este paso`}
                      className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-rose-600 text-white"
                    >
                      {stepIssues.length}
                    </span>
                  )}
                </div>
                <div
                  className={`text-[10px] truncate mt-0.5 ${
                    isActive ? 'text-blue-200' : 'text-slate-500'
                  }`}
                >
                  {s.subtitle}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Marco de Coherencia Operativa: Destino Regulatorio, Estructura de Salida y Origen de Datos */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs mb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#1E4E8C] text-white flex items-center justify-center text-xs font-bold shrink-0">
              TR
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Marco de Coherencia Operativa
              </h3>
              <p className="text-[11px] text-slate-500">
                Diferenciación de roles técnicos: <strong>Destino Regulatorio</strong>, <strong>Estructura de Salida</strong> y <strong>Origen de Información</strong>.
              </p>
            </div>
          </div>
          <span className="text-[11px] text-slate-500 italic bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
            El informe que aporta los datos (Origen) no tiene que coincidir con el formato que los presenta (Destino).
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2.5 text-xs">
          {/* 1. DESTINO REGULATORIO */}
          <div className="p-2.5 rounded bg-blue-50/70 border border-blue-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-blue-900 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Send className="w-3 h-3 text-[#1E4E8C]" />
                1. Destino Regulatorio (Módulo D)
              </span>
              <span className="px-1.5 py-0.2 rounded bg-blue-200 text-blue-900 text-[9px] font-bold">
                {linkedAssociations.length > 0 ? `${linkedAssociations.length} asociación(es)` : 'Sin asociar'}
              </span>
            </div>
            <div
              className="mt-1 font-bold text-slate-900 truncate"
              title={
                linkedAssociations.length > 0
                  ? `${activeFormat.code} — ${activeFormat.name}`
                  : 'Pendiente de vincular en Módulo D'
              }
            >
              {linkedAssociations.length > 0
                ? `${activeFormat.code} — ${activeFormat.name}`
                : 'Formato regulatorio pendiente de vincular en Módulo D'}
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              Canal / Transmisión:{' '}
              <strong className="text-slate-800">
                {linkedAssociations[0]?.transmissionTypeId
                  ? `${linkedAssociations[0].transmissionTypeId} (${linkedAssociations[0].environment})`
                  : 'A definir en asociaciones'}
              </strong>
            </div>
          </div>

          {/* 2. ESTRUCTURA DE SALIDA EN CONFIGURACIÓN */}
          <div className="p-2.5 rounded bg-amber-50/70 border border-amber-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <FileCode2 className="w-3 h-3 text-amber-700" />
                2. Estructura de Salida (Configurador)
              </span>
              <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 text-[9px] font-bold font-mono">
                {draft.code} (v{draft.version})
              </span>
            </div>
            <div className="mt-1 font-bold text-slate-900 truncate" title={draft.name}>
              {draft.name}
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              Tipo archivo:{' '}
              <strong className="text-slate-800">
                {selectedOutputType.family} (.{selectedOutputType.extension})
              </strong>{' '}
              · {draft.fields.length} campos definidos
            </div>
          </div>

          {/* 3. ORIGEN DE INFORMACIÓN */}
          <div className="p-2.5 rounded bg-emerald-50/70 border border-emerald-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Database className="w-3 h-3 text-emerald-700" />
                3. Origen de Información (Paso 3)
              </span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-900 text-[9px] font-bold">
                {selectedDataContract.originRoute === 'Fuente proporcionada por el cliente'
                  ? 'Fuente Cliente'
                  : 'Formato Sistema'}
              </span>
            </div>
            <div
              className="mt-1 font-bold text-slate-900 truncate"
              title={activeCatalogEntry?.reportName || selectedDataContract.name}
            >
              {activeCatalogEntry?.reportName || selectedDataContract.name}
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              Lote para {globalPeriod}:{' '}
              <strong
                className={
                  compiledResult.resolvedPrimaryBatch
                    ? 'text-emerald-700'
                    : 'text-rose-700'
                }
              >
                {compiledResult.resolvedPrimaryBatch
                  ? `${compiledResult.rowsProcessed} registros (${compiledResult.resolvedPrimaryBatch.executionCode})`
                  : 'Sin lote compatible'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* GUÍA DE PASO Y ASISTENTE CONTEXTUAL TOTALiA® */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3.5">
        {/* Fila 1: Estados de avance y capacidades operativas independientes */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Estado de avance:
            </span>
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-bold border flex items-center gap-1.5 ${advancementState.badgeClass}`}
            >
              <span className="w-2 h-2 rounded-full bg-current"></span>
              {advancementState.label}
            </span>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              · {advancementState.desc}
            </span>
          </div>

          {/* Tres indicadores independientes (no deducidos uno de otro) */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span
              title="Guardado de borrador siempre disponible. Se almacena localmente en su navegador."
              className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium inline-flex items-center gap-1"
            >
              <Save className="w-3 h-3 text-slate-500" />
              Borrador: <strong className="text-slate-900">Permitido (Navegador)</strong>
            </span>

            <span
              title={
                canDownloadPhysicalArtifact
                  ? 'Archivo físico listo con lote compatible'
                  : `Generación física en espera de lote compatible para ${globalPeriod} (CES-DAT-000)`
              }
              className={`px-2 py-0.5 rounded border font-medium inline-flex items-center gap-1 ${
                canDownloadPhysicalArtifact
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : 'bg-amber-50 text-amber-950 border-amber-300'
              }`}
            >
              <FileCode2 className="w-3 h-3" />
              Generación:{' '}
              <strong>
                {canDownloadPhysicalArtifact ? 'Habilitada' : 'Espera lote (CES-DAT-000)'}
              </strong>
            </span>

            <span
              title={
                isImmutable
                  ? 'Versión protegida (Inmutable). Cree una nueva revisión para publicar cambios.'
                  : structuralBlockingCount === 0
                  ? 'Estructura válida para publicar'
                  : `Bloqueado por ${structuralBlockingCount} error(es) de estructura`
              }
              className={`px-2 py-0.5 rounded border font-medium inline-flex items-center gap-1 ${
                isImmutable
                  ? 'bg-slate-100 text-slate-700 border-slate-300'
                  : structuralBlockingCount === 0
                  ? 'bg-blue-50 text-blue-900 border-blue-300'
                  : 'bg-rose-50 text-rose-950 border-rose-300'
              }`}
            >
              <Send className="w-3 h-3" />
              Publicación:{' '}
              <strong>
                {isImmutable
                  ? 'Inmutable'
                  : structuralBlockingCount === 0
                  ? 'Habilitada'
                  : 'Bloqueada'}
              </strong>
            </span>
          </div>
        </div>

        {/* Fila 2: Orientación breve vinculada al paso activo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50/80 p-3 rounded-lg border border-slate-200/80 text-xs">
          <div>
            <div className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">
              Qué está configurando
            </div>
            <div className="text-slate-900 mt-0.5 leading-snug">
              {currentStepGuidance.whatConfiguring}
            </div>
          </div>
          <div>
            <div className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">
              Qué información necesita
            </div>
            <div className="text-slate-900 mt-0.5 leading-snug">
              {currentStepGuidance.whatNeeded}
            </div>
          </div>
          <div>
            <div className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">
              Qué falta por completar
            </div>
            <div
              className={`mt-0.5 leading-snug font-medium ${
                currentStepGuidance.whatMissing.includes('Falta') ||
                currentStepGuidance.whatMissing.includes('Existen') ||
                currentStepGuidance.whatMissing.includes('Complete')
                  ? 'text-amber-900'
                  : 'text-slate-700'
              }`}
            >
              {currentStepGuidance.whatMissing}
            </div>
          </div>
          <div className="flex flex-col justify-between">
            <div>
              <div className="font-bold text-slate-700 uppercase text-[10px] tracking-wider">
                Siguiente acción
              </div>
              <div className="text-[#1E4E8C] font-bold mt-0.5 leading-snug">
                {currentStepGuidance.nextAction}
              </div>
            </div>
            {currentStepGuidance.nextStep !== builderStep && (
              <button
                type="button"
                onClick={() => setBuilderStep(currentStepGuidance.nextStep)}
                className="mt-2 px-2.5 py-1 rounded bg-[#1E4E8C] hover:bg-[#163A69] text-white text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                <span>Avanzar al Paso {currentStepGuidance.nextStep}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Fila 3: Barra de Acciones Asistidas de TOTALiA® */}
        <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-700 to-purple-800 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-sky-200" />
            </div>
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <span>TOTALiA® Contextual</span>
              <HelpTooltip
                title="Asistencia Contextual TOTALiA®"
                description="Analiza especificaciones registradas, contratos de datos y reglas técnicas de la familia de archivo para recomendar ajustes justificados y trazables. Todas las sugerencias se aplican de forma controlada sobre un borrador."
              />
            </span>
          </div>

          {/* Botones de Acciones Sugeridas */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => openTotaliaWithAction('siguiente_paso')}
              className="px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-900 hover:bg-indigo-100 font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors"
            >
              <ArrowRight className="w-3.5 h-3.5 text-indigo-700" />
              <span>Indicar siguiente paso</span>
            </button>

            <button
              type="button"
              onClick={() => openTotaliaWithAction('revisar_estructura')}
              className="px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-900 hover:bg-blue-100 font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-blue-700" />
              <span>Revisar mi estructura</span>
            </button>

            <button
              type="button"
              onClick={() => openTotaliaWithAction('sugerir_mapeos')}
              className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 hover:bg-emerald-100 font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors"
            >
              <Database className="w-3.5 h-3.5 text-emerald-700" />
              <span>Sugerir correspondencias</span>
            </button>

            {configDiagnostics.length > 0 && (
              <button
                type="button"
                onClick={() => openTotaliaWithAction('explicar_error')}
                className="px-2.5 py-1 rounded-md bg-rose-100 border border-rose-300 text-rose-950 hover:bg-rose-200 font-bold cursor-pointer inline-flex items-center gap-1 animate-pulse"
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
                <span>Explicar este error ({configDiagnostics.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => openTotaliaWithAction('ayudame_a_crear')}
              className="px-2.5 py-1 rounded-md bg-purple-50 border border-purple-200 text-purple-900 hover:bg-purple-100 font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-700" />
              <span>Ayúdame a crear esta salida</span>
            </button>

            <button
              type="button"
              onClick={() => openTotaliaWithAction('evaluar_impacto')}
              className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 font-semibold cursor-pointer inline-flex items-center gap-1 transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-slate-600" />
              <span>Evaluar impacto</span>
            </button>
          </div>
        </div>
      </div>

      {/* STEP 1: DATOS GENERALES */}
      {builderStep === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-md p-5 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Paso 1. Datos generales de la salida
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Defina la identificación funcional de la salida, su código técnico, la entidad supervisora y el tipo de archivo que utilizará.
              </p>
            </div>

            {/* Confirmation prompt if user selected a new OutputType */}
            {pendingOutputTypeId && (
              <div className="p-3.5 rounded-md bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-800 shrink-0" />
                  Confirmar cambio de tipo de archivo a{' '}
                  {outputTypes.find((t) => t.id === pendingOutputTypeId)?.family}
                </div>
                <p>
                  Al cambiar el tipo de archivo se ajustarán la extensión, el delimitador o modo posicional y los parámetros específicos del formato.{' '}
                  <strong>
                    Se conservarán intactos sus {draft.fields.length} campos, longitudes y mapeos del Paso 2 y Paso 3.
                  </strong>
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleConfirmOutputTypeChange}
                    className="px-3 py-1 rounded bg-amber-900 text-white font-semibold hover:bg-amber-950 cursor-pointer"
                  >
                    Confirmar cambio de tipo
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingOutputTypeId(null)}
                    className="px-3 py-1 rounded border border-amber-400 bg-white text-amber-900 font-semibold hover:bg-amber-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-800 mb-1">
                  Nombre funcional de la salida *
                  <HelpTooltip
                    title="Nombre funcional de la salida"
                    description="Nombre descriptivo para identificar el propósito del archivo en el catálogo y en los reportes de auditoría."
                    example="Saldos y Cartera · Plano Delimitado CSV"
                  />
                </label>
                <input
                  type="text"
                  disabled={isImmutable}
                  value={draft.name}
                  onChange={(e) => updateDraft((p) => ({ ...p, name: e.target.value }))}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-900 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Código identificador *
                  <HelpTooltip
                    title="Código identificador único"
                    description="Identificador corto e invariable de la salida configurada. Las nuevas revisiones conservan este mismo código cambiando únicamente el número de versión."
                    example="DEMO-CE-02"
                  />
                </label>
                <input
                  type="text"
                  disabled={isImmutable}
                  value={draft.code}
                  onChange={(e) =>
                    updateDraft((p) => ({ ...p, code: e.target.value.toUpperCase() }))
                  }
                  className="w-full border border-slate-300 rounded px-3 py-2 font-mono font-bold text-slate-900 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Tipo de archivo (Tipo de salida) *
                  <HelpTooltip
                    title="Tipo de archivo reutilizable"
                    description="Define la familia técnica del archivo (CSV, TXT, XML, AVRO, XBRL, PDF o XLSX) y habilita los controles específicos de esa representación."
                    consequence="Cambiar el tipo de archivo adapta los parámetros de representación del panel derecho conservando la lista de campos."
                  />
                </label>
                <select
                  aria-label="Tipo de archivo de la salida"
                  disabled={isImmutable}
                  value={draft.outputTypeId}
                  onChange={(e) => {
                    if (e.target.value !== draft.outputTypeId) {
                      setPendingOutputTypeId(e.target.value);
                    }
                  }}
                  className="w-full border border-slate-300 rounded px-3 py-2 bg-white font-semibold text-slate-900 disabled:bg-slate-100"
                >
                  {outputTypes.map((ot) => (
                    <option key={ot.id} value={ot.id}>
                      {ot.family} — {ot.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Entidad supervisora / Reguladora *
                </label>
                <input
                  type="text"
                  disabled={isImmutable}
                  value={draft.regulator}
                  onChange={(e) =>
                    updateDraft((p) => ({ ...p, regulator: e.target.value }))
                  }
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-900 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Jurisdicción / País
                </label>
                <select
                  disabled={isImmutable}
                  value={draft.jurisdiction}
                  onChange={(e) =>
                    updateDraft((p) => ({
                      ...p,
                      jurisdiction: e.target.value as ConfiguredOutput['jurisdiction'],
                    }))
                  }
                  className="w-full border border-slate-300 rounded px-3 py-2 bg-white text-slate-900 disabled:bg-slate-100"
                >
                  <option value="Colombia">Colombia</option>
                  <option value="Perú">Perú</option>
                  <option value="Multirregulador">Multirregulador</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Versión de la configuración
                  <HelpTooltip
                    title="Número de versión"
                    description="Identifica la revisión específica de esta salida (ej. 1.4, 2.0, 3.1). Permite que distintos formatos regulatorios apunten a versiones específicas sin afectarse entre sí."
                  />
                </label>
                <input
                  type="text"
                  disabled={isImmutable}
                  value={draft.version}
                  onChange={(e) =>
                    updateDraft((p) => ({ ...p, version: e.target.value }))
                  }
                  className="w-full border border-slate-300 rounded px-3 py-2 font-mono text-slate-900 disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Vigencia desde (AAAA-MM-DD)
                  <HelpTooltip
                    title="Fecha de inicio de vigencia"
                    description="Fecha a partir de la cual esta versión de la salida es elegible para ser utilizada en entregas regulatorias."
                  />
                </label>
                <input
                  type="text"
                  disabled={isImmutable}
                  value={draft.validFrom}
                  onChange={(e) =>
                    updateDraft((p) => ({ ...p, validFrom: e.target.value }))
                  }
                  className="w-full border border-slate-300 rounded px-3 py-2 font-mono text-slate-900 disabled:bg-slate-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-800 mb-1">
                  Descripción funcional y alcance normativo
                </label>
                <textarea
                  rows={3}
                  disabled={isImmutable}
                  value={draft.description}
                  onChange={(e) =>
                    updateDraft((p) => ({ ...p, description: e.target.value }))
                  }
                  className="w-full border border-slate-300 rounded p-2.5 text-slate-900 disabled:bg-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Right Panel in Step 1: Format-Specific Parameters Tailored to Selected Family */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-md p-5 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E4E8C]">
                Parámetros específicos del formato ({selectedOutputType.family})
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                <span>Propiedades técnicas del archivo {selectedOutputType.family}</span>
                <HelpTooltip
                  align="right"
                  title={`Parámetros de familia ${selectedOutputType.family}`}
                  description="Aquí solo se muestran las propiedades técnicas que realmente aplican al formato de archivo seleccionado y que intervienen en su generación o validación de esquema."
                />
              </h3>
            </div>

            {/* CSV Specific Parameters */}
            {selectedOutputType.family === 'CSV' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Codificación de caracteres
                    <HelpTooltip
                      title="Codificación CSV"
                      description="Define el juego de caracteres del archivo de texto. UTF-8 es el estándar recomendado."
                    />
                  </label>
                  <select
                    disabled={isImmutable}
                    value={draft.composition.encoding}
                    onChange={(e) =>
                      updateDraft((p) => ({
                        ...p,
                        composition: {
                          ...p.composition,
                          encoding: e.target.value as ConfiguredOutput['composition']['encoding'],
                        },
                      }))
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    <option value="UTF-8">UTF-8</option>
                    <option value="UTF-8 con BOM">UTF-8 con BOM</option>
                    <option value="ISO-8859-1">ISO-8859-1 (Latin-1)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Separador decimal
                    <HelpTooltip
                      title="Separador decimal en importes"
                      description="Define si los campos de tipo Decimal se formatean con coma (1234,50) o con punto (1234.50) en el archivo CSV."
                    />
                  </label>
                  <select
                    disabled={isImmutable}
                    value={draft.composition.decimalSeparator}
                    onChange={(e) =>
                      updateDraft((p) => ({
                        ...p,
                        composition: {
                          ...p.composition,
                          decimalSeparator: e.target.value as ',' | '.',
                        },
                      }))
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono"
                  >
                    <option value=",">Coma (,) — Ej: 1234,50</option>
                    <option value=".">Punto (.) — Ej: 1234.50</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Separador de columnas (Delimitador CSV)
                    <HelpTooltip
                      title="Delimitador de columnas"
                      description="Carácter que separa cada campo dentro de una línea CSV. Si un valor de texto contiene este carácter, el motor lo protege entre comillas según RFC 4180."
                    />
                  </label>
                  <select
                    disabled={isImmutable}
                    value={draft.composition.delimiter}
                    onChange={(e) =>
                      updateDraft((p) => ({
                        ...p,
                        composition: {
                          ...p.composition,
                          delimiter: e.target.value as ';' | ',' | '|' | '\t',
                        },
                      }))
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono"
                  >
                    <option value=";">Punto y coma (;)</option>
                    <option value=",">Coma (,)</option>
                    <option value="|">Barra vertical (|)</option>
                    <option value={'\t'}>Tabulador (TAB)</option>
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-2 pt-2 border-t border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={isImmutable}
                      checked={draft.composition.includeHeader}
                      onChange={(e) =>
                        updateDraft((p) => ({
                          ...p,
                          composition: {
                            ...p.composition,
                            includeHeader: e.target.checked,
                          },
                        }))
                      }
                    />
                    <span>Incluir primera línea con nombres técnicos de columnas (Encabezado)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={isImmutable}
                      checked={draft.composition.includeFooter}
                      onChange={(e) =>
                        updateDraft((p) => ({
                          ...p,
                          composition: {
                            ...p.composition,
                            includeFooter: e.target.checked,
                          },
                        }))
                      }
                    />
                    <span>Incluir línea final CONTROL_TOTAL con conteo de filas y suma de importes</span>
                  </label>
                </div>
              </div>
            )}

            {/* TXT Specific Parameters */}
            {selectedOutputType.family === 'TXT' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Codificación de caracteres
                  </label>
                  <select
                    disabled={isImmutable}
                    value={draft.composition.encoding}
                    onChange={(e) =>
                      updateDraft((p) => ({
                        ...p,
                        composition: {
                          ...p.composition,
                          encoding: e.target.value as ConfiguredOutput['composition']['encoding'],
                        },
                      }))
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    <option value="UTF-8">UTF-8</option>
                    <option value="ISO-8859-1">ISO-8859-1 (Latin-1)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Modalidad TXT
                  </label>
                  <select
                    disabled={isImmutable}
                    value={draft.composition.delimiter === 'Ancho fijo' ? 'Ancho fijo' : '|'}
                    onChange={(e) =>
                      updateDraft((p) => ({
                        ...p,
                        composition: {
                          ...p.composition,
                          delimiter: e.target.value === 'Ancho fijo' ? 'Ancho fijo' : '|',
                        },
                      }))
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-semibold"
                  >
                    <option value="Ancho fijo">Posicional de ancho fijo</option>
                    <option value="|">Delimitado por barra vertical (|)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Unidad de posición y longitud
                    <HelpTooltip
                      title="Medición en Caracteres vs Bytes UTF-8"
                      description="En archivos planos TXT, algunos supervisores miden las columnas por caracteres visibles y otros por bytes físicos UTF-8 (donde letras como Ñ o tildes ocupan 2 bytes)."
                      example="La cadena 'Ana Pérez' mide 9 caracteres pero 10 bytes en UTF-8."
                    />
                  </label>
                  <select
                    disabled={isImmutable}
                    value={draft.fields[0]?.lengthUnit || 'Caracteres'}
                    onChange={(e) =>
                      handleApplyLengthUnitToAllFields(e.target.value as 'Caracteres' | 'Bytes')
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-semibold"
                  >
                    <option value="Caracteres">Caracteres</option>
                    <option value="Bytes">Bytes (UTF-8)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Separador decimal
                  </label>
                  <select
                    disabled={isImmutable}
                    value={draft.composition.decimalSeparator}
                    onChange={(e) =>
                      updateDraft((p) => ({
                        ...p,
                        composition: {
                          ...p.composition,
                          decimalSeparator: e.target.value as ',' | '.',
                        },
                      }))
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono"
                  >
                    <option value=".">Punto (.)</option>
                    <option value=",">Coma (,)</option>
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-2 pt-2 border-t border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={isImmutable}
                      checked={draft.composition.includeHeader}
                      onChange={(e) =>
                        updateDraft((p) => ({
                          ...p,
                          composition: {
                            ...p.composition,
                            includeHeader: e.target.checked,
                          },
                        }))
                      }
                    />
                    <span>Incluir registro de cabecera institucional (Tipo 01: Entidad, Formato, Corte)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={isImmutable}
                      checked={draft.composition.includeFooter}
                      onChange={(e) =>
                        updateDraft((p) => ({
                          ...p,
                          composition: {
                            ...p.composition,
                            includeFooter: e.target.checked,
                          },
                        }))
                      }
                    />
                    <span>Incluir registro de cierre y control (Tipo 99: Conteo y sumatoria)</span>
                  </label>
                </div>
              </div>
            )}

            {/* XML Specific Parameters */}
            {selectedOutputType.family === 'XML' && (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Declaración de codificación XML
                    </label>
                    <select
                      disabled={isImmutable}
                      value={draft.composition.encoding}
                      onChange={(e) =>
                        updateDraft((p) => ({
                          ...p,
                          composition: {
                            ...p.composition,
                            encoding: e.target.value as ConfiguredOutput['composition']['encoding'],
                          },
                        }))
                      }
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono"
                    >
                      <option value="UTF-8">UTF-8</option>
                      <option value="ISO-8859-1">ISO-8859-1</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Separador decimal en importes XML
                    </label>
                    <select
                      disabled={isImmutable}
                      value={draft.composition.decimalSeparator}
                      onChange={(e) =>
                        updateDraft((p) => ({
                          ...p,
                          composition: {
                            ...p.composition,
                            decimalSeparator: e.target.value as ',' | '.',
                          },
                        }))
                      }
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono"
                    >
                      <option value=".">Punto (.) — Estándar xs:decimal</option>
                      <option value=",">Coma (,)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nodo raíz del documento XML (&lt;Root&gt;)
                  </label>
                  <input
                    type="text"
                    disabled={isImmutable}
                    value={selectedOutputType.xmlParams?.rootElement || 'ReporteRegulatorio'}
                    onChange={(e) =>
                      saveOutputType({
                        ...selectedOutputType,
                        xmlParams: {
                          ...(selectedOutputType.xmlParams || {
                            rootElement: 'ReporteRegulatorio',
                            targetNamespace: 'urn:totalreport:regulatorio:v1',
                            xsdSchemaVersion: 'XSD 1.0',
                            xsdSchemaRef: 'esquema_oficial_v1.xsd',
                            emptyElementHandling: 'xsi:nil="true"',
                            prettyPrint: true,
                          }),
                          rootElement: e.target.value,
                        },
                      })
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Espacio de nombres (xmlns) y esquema XSD
                  </label>
                  <input
                    type="text"
                    disabled={isImmutable}
                    value={selectedOutputType.xmlParams?.targetNamespace || 'urn:totalreport:regulatorio:v1'}
                    onChange={(e) =>
                      saveOutputType({
                        ...selectedOutputType,
                        xmlParams: {
                          ...(selectedOutputType.xmlParams || {
                            rootElement: 'ReporteRegulatorio',
                            targetNamespace: 'urn:totalreport:regulatorio:v1',
                            xsdSchemaVersion: 'XSD 1.0',
                            xsdSchemaRef: 'esquema_oficial_v1.xsd',
                            emptyElementHandling: 'xsi:nil="true"',
                            prettyPrint: true,
                          }),
                          targetNamespace: e.target.value,
                        },
                      })
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Representación de campos opcionales vacíos
                  </label>
                  <select
                    disabled={isImmutable}
                    value={selectedOutputType.xmlParams?.emptyElementHandling || 'xsi:nil="true"'}
                    onChange={(e) =>
                      saveOutputType({
                        ...selectedOutputType,
                        xmlParams: {
                          ...(selectedOutputType.xmlParams || {
                            rootElement: 'ReporteRegulatorio',
                            targetNamespace: 'urn:totalreport:regulatorio:v1',
                            xsdSchemaVersion: 'XSD 1.0',
                            xsdSchemaRef: 'esquema_oficial_v1.xsd',
                            emptyElementHandling: 'xsi:nil="true"',
                            prettyPrint: true,
                          }),
                          emptyElementHandling: e.target.value as
                            | 'Omitir nodo'
                            | 'Etiqueta vacía'
                            | 'xsi:nil="true"',
                        },
                      })
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                  >
                    <option value='xsi:nil="true"'>Etiqueta con atributo xsi:nil=&quot;true&quot;</option>
                    <option value="Omitir nodo">Omitir el elemento del XML</option>
                    <option value="Etiqueta vacía">Etiqueta vacía (&lt;Campo&gt;&lt;/Campo&gt;)</option>
                  </select>
                </div>
              </div>
            )}

            {/* AVRO Specific Parameters (No text headers/footers/decimal commas!) */}
            {selectedOutputType.family === 'AVRO' && (
              <div className="space-y-3 text-xs">
                <div className="p-2.5 rounded bg-blue-50 border border-blue-200 text-[11px] text-slate-800">
                  <strong>Formato binario Apache Avro OCF:</strong> En Avro los datos se codifican en binario según el esquema JSON (<span className="font-mono">bytes / logicalType: decimal</span> y <span className="font-mono">int / date</span>). No aplican separadores de texto ni filas de encabezado/pie.
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Namespace del esquema Avro
                  </label>
                  <input
                    type="text"
                    disabled={isImmutable}
                    value={selectedOutputType.avroParams?.namespace || 'co.totalreport.regulatorio'}
                    onChange={(e) =>
                      saveOutputType({
                        ...selectedOutputType,
                        avroParams: {
                          ...(selectedOutputType.avroParams || {
                            namespace: 'co.totalreport.regulatorio',
                            recordName: 'CarteraRegulatoriaRecord',
                            containerFormat: 'OCF (Object Container File)',
                            codec: 'deflate',
                            schemaCompatibility: 'BACKWARD',
                            logicalDecimalSupport: true,
                          }),
                          namespace: e.target.value,
                        },
                      })
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nombre del Record Avro
                    </label>
                    <input
                      type="text"
                      disabled={isImmutable}
                      value={selectedOutputType.avroParams?.recordName || 'CarteraRecord'}
                      onChange={(e) =>
                        saveOutputType({
                          ...selectedOutputType,
                          avroParams: {
                            ...(selectedOutputType.avroParams || {
                              namespace: 'co.totalreport.regulatorio',
                              recordName: 'CarteraRecord',
                              containerFormat: 'OCF (Object Container File)',
                              codec: 'deflate',
                              schemaCompatibility: 'BACKWARD',
                              logicalDecimalSupport: true,
                            }),
                            recordName: e.target.value,
                          },
                        })
                      }
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Compresión OCF (Codec)
                    </label>
                    <select
                      disabled={isImmutable}
                      value={selectedOutputType.avroParams?.codec || 'deflate'}
                      onChange={(e) =>
                        saveOutputType({
                          ...selectedOutputType,
                          avroParams: {
                            ...(selectedOutputType.avroParams || {
                              namespace: 'co.totalreport.regulatorio',
                              recordName: 'CarteraRecord',
                              containerFormat: 'OCF (Object Container File)',
                              codec: 'deflate',
                              schemaCompatibility: 'BACKWARD',
                              logicalDecimalSupport: true,
                            }),
                            codec: e.target.value as 'null' | 'deflate' | 'snappy' | 'zstandard',
                          },
                        })
                      }
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono"
                    >
                      <option value="deflate">deflate</option>
                      <option value="snappy">snappy</option>
                      <option value="zstandard">zstandard</option>
                      <option value="null">null (sin compresión)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Regla de evolución de esquema (Schema Compatibility)
                  </label>
                  <select
                    disabled={isImmutable}
                    value={selectedOutputType.avroParams?.schemaCompatibility || 'BACKWARD'}
                    onChange={(e) =>
                      saveOutputType({
                        ...selectedOutputType,
                        avroParams: {
                          ...(selectedOutputType.avroParams || {
                            namespace: 'co.totalreport.regulatorio',
                            recordName: 'CarteraRecord',
                            containerFormat: 'OCF (Object Container File)',
                            codec: 'deflate',
                            schemaCompatibility: 'BACKWARD',
                            logicalDecimalSupport: true,
                          }),
                          schemaCompatibility: e.target.value as
                            | 'BACKWARD'
                            | 'FORWARD'
                            | 'FULL'
                            | 'NONE',
                        },
                      })
                    }
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white font-mono"
                  >
                    <option value="BACKWARD">BACKWARD (Consumidores nuevos leen datos previos)</option>
                    <option value="FORWARD">FORWARD</option>
                    <option value="FULL">FULL (Bidireccional)</option>
                    <option value="NONE">NONE</option>
                  </select>
                </div>
              </div>
            )}

            {/* XBRL, PDF, XLSX Specific Parameters */}
            {(selectedOutputType.family === 'XBRL' ||
              selectedOutputType.family === 'PDF' ||
              selectedOutputType.family === 'XLSX') && (
              <div className="space-y-3 text-xs">
                <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-[11px] text-amber-950">
                  <strong>Alcance en navegador para {selectedOutputType.family}:</strong> Se valida la estructura lógica de campos, contextos y reglas. La generación del archivo binario final se ejecuta en el motor de servidor ({selectedOutputType.serializationEngine}).
                </div>

                {selectedOutputType.family === 'XBRL' && (
                  <>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Punto de entrada de taxonomía (EntryPoint URI)
                      </label>
                      <input
                        type="text"
                        disabled={isImmutable}
                        value={
                          selectedOutputType.xbrlParams?.entryPointUri ||
                          'http://supervision.demo.gov/taxonomia/2026/sfc_entry.xsd'
                        }
                        onChange={(e) =>
                          saveOutputType({
                            ...selectedOutputType,
                            xbrlParams: {
                              ...(selectedOutputType.xbrlParams || {
                                taxonomyPackageRef: 'TAX-SFC-2026',
                                entryPointUri: '',
                                defaultEntityScheme: 'http://supervision.demo.gov/entidades',
                                periodType: 'instant',
                                dimensionsEnabled: true,
                                allowTaxonomyExtensions: false,
                                unitsConfigured: ['COP'],
                              }),
                              entryPointUri: e.target.value,
                            },
                          })
                        }
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Esquema de identificación de entidad (Entity Scheme)
                      </label>
                      <input
                        type="text"
                        disabled={isImmutable}
                        value={
                          selectedOutputType.xbrlParams?.defaultEntityScheme ||
                          'http://supervision.demo.gov/entidades'
                        }
                        onChange={(e) =>
                          saveOutputType({
                            ...selectedOutputType,
                            xbrlParams: {
                              ...(selectedOutputType.xbrlParams || {
                                taxonomyPackageRef: 'TAX-SFC-2026',
                                entryPointUri: 'http://supervision.demo.gov/taxonomia/2026/sfc_entry.xsd',
                                defaultEntityScheme: '',
                                periodType: 'instant',
                                dimensionsEnabled: true,
                                allowTaxonomyExtensions: false,
                                unitsConfigured: ['COP'],
                              }),
                              defaultEntityScheme: e.target.value,
                            },
                          })
                        }
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono bg-white"
                      />
                    </div>
                  </>
                )}

                {(selectedOutputType.family === 'PDF' || selectedOutputType.family === 'XLSX') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Estándar documental
                      </label>
                      <input
                        type="text"
                        disabled
                        value={
                          selectedOutputType.family === 'XLSX'
                            ? 'OpenXML SpreadsheetML (.xlsx)'
                            : selectedOutputType.pdfParams?.pdfStandard || 'PDF/A-1b Preservación'
                        }
                        className="w-full border border-slate-200 bg-slate-100 rounded px-2.5 py-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Estado de certificación
                      </label>
                      <input
                        type="text"
                        disabled
                        value={selectedOutputType.supportStatus}
                        className="w-full border border-slate-200 bg-slate-100 rounded px-2.5 py-1.5 font-semibold"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: ESTRUCTURA DEL ARCHIVO */}
      {builderStep === 2 && (
        <div className="space-y-4">
          {/* Family-Specific Visual Structure Representation Banner (TXT positional ruler / XML tree) */}
          {selectedOutputType.family === 'TXT' && (
            <div className="bg-white border border-slate-200 rounded-md p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E4E8C] flex items-center gap-1">
                    <span>Mapa visual de posiciones de ancho fijo (TXT)</span>
                    <HelpTooltip
                      title="Cálculo de posiciones en ancho fijo"
                      description="Cada campo ocupa un segmento exacto [Inicio..Fin]. La longitud se mide en Caracteres o Bytes UTF-8 según lo configurado en la unidad de medida. Nunca se truncan datos silenciosamente."
                    />
                  </span>
                  <h3 className="text-xs font-bold text-slate-900">
                    Longitud total acumulada del registro de detalle:{' '}
                    <span className="font-mono text-[#1E4E8C]">
                      {draft.fields.reduce((acc, f) => acc + Math.max(0, f.length), 0)}
                    </span>{' '}
                    {(draft.fields[0]?.lengthUnit || 'Caracteres').toLowerCase()}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-600 font-semibold">Medir posiciones en:</span>
                    <select
                      aria-label="Unidad de posición TXT"
                      disabled={isImmutable}
                      value={draft.fields[0]?.lengthUnit || 'Caracteres'}
                      onChange={(e) =>
                        handleApplyLengthUnitToAllFields(e.target.value as 'Caracteres' | 'Bytes')
                      }
                      className="border border-slate-300 rounded px-2 py-1 bg-white font-semibold text-slate-900"
                    >
                      <option value="Caracteres">Caracteres</option>
                      <option value="Bytes">Bytes (UTF-8)</option>
                    </select>
                  </div>
                  {!isImmutable && (
                    <button
                      type="button"
                      onClick={handleRecalculateAllTxtPositions}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-50 border border-blue-300 text-[#1E4E8C] hover:bg-blue-100 text-xs font-semibold cursor-pointer"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      Recalcular posiciones TXT automáticamente
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1 pt-1">
                {draft.fields.map((f, idx) => {
                  const prevField = idx > 0 ? draft.fields[idx - 1] : null;
                  const prevEnd = prevField
                    ? (prevField.startPosition || 1) + Math.max(1, prevField.length) - 1
                    : 0;
                  const curStart = f.startPosition || 1;
                  const curEnd = curStart + Math.max(1, f.length) - 1;
                  const hasOverlap = prevField && prevEnd >= curStart;
                  const isInvalidLen = !f.length || f.length <= 0;

                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSelectedFieldId(f.id)}
                      className={`px-2.5 py-1.5 rounded border text-left transition-all cursor-pointer ${
                        selectedField?.id === f.id
                          ? 'ring-2 ring-[#1E4E8C] bg-blue-50 border-[#1E4E8C]'
                          : hasOverlap || isInvalidLen
                          ? 'bg-rose-50 border-rose-400 text-rose-950'
                          : 'bg-slate-50 border-slate-300 text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <div className="font-mono text-[10px] font-bold text-[#1E4E8C]">
                        [{curStart}..{curEnd}] ({f.length}{' '}
                        {f.lengthUnit === 'Bytes' ? 'bytes' : 'car.'})
                      </div>
                      <div className="text-[11px] font-semibold truncate max-w-[140px]">
                        {f.technicalName}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedOutputType.family === 'XML' && (
            <div className="bg-white border border-slate-200 rounded-md p-4 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#1E4E8C] flex items-center gap-1">
                <span>Estructura jerárquica de nodos y atributos XML</span>
                <HelpTooltip
                  title="Jerarquía XML: Elementos vs Atributos"
                  description="Los campos marcados como 'Atributo (@campo)' se incluyen dentro de la etiqueta de apertura <Registro secuencia='1' @campo='valor'>. Los campos marcados como 'Elemento (<campo>)' se serializan como etiquetas hijas anidadas."
                />
              </div>
              <div className="p-3 rounded bg-slate-50 border border-slate-200 font-mono text-xs space-y-1 text-slate-800">
                <div className="font-bold text-[#0F1F38]">
                  &lt;{selectedOutputType.xmlParams?.rootElement || 'ReporteRegulatorio'} xmlns=&quot;{selectedOutputType.xmlParams?.targetNamespace || 'urn:totalreport:regulatorio:v1'}&quot;&gt;
                </div>
                <div className="pl-4 text-slate-600">
                  &lt;Encabezado&gt;CodigoEntidad, CodigoFormato, PeriodoCorte, TotalRegistros&lt;/Encabezado&gt;
                </div>
                <div className="pl-4 font-bold text-[#1E4E8C]">
                  &lt;DetalleRegistros&gt; &rarr; &lt;Registro secuencia=&quot;1..N&quot;{' '}
                  {draft.fields
                    .filter((f) => f.xmlNodeKind === 'Atributo')
                    .map((a) => `${a.technicalName}="..."`)
                    .join(' ')}
                  &gt;
                </div>
                <div className="pl-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 pt-1">
                  {draft.fields.map((f) => {
                    const isAttr = f.xmlNodeKind === 'Atributo';
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSelectedFieldId(f.id)}
                        className={`text-left px-2 py-1 rounded border text-[11px] cursor-pointer ${
                          selectedField?.id === f.id
                            ? 'bg-blue-50 border-[#1E4E8C] font-bold text-[#1E4E8C]'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        {isAttr
                          ? `@${f.technicalName} (Atributo en <Registro>)`
                          : `<${f.technicalName}> (Elemento hijo)`}{' '}
                        · {f.required ? '1..1' : '0..1'}
                      </button>
                    );
                  })}
                </div>
                <div className="pl-4 font-bold text-[#1E4E8C]">
                  &lt;/Registro&gt; &larr; &lt;/DetalleRegistros&gt;
                </div>
                <div className="font-bold text-[#0F1F38]">
                  &lt;/{selectedOutputType.xmlParams?.rootElement || 'ReporteRegulatorio'}&gt;
                </div>
              </div>
            </div>
          )}

          {/* Main 12-Col Workspace: Editable Fields Table (7 cols) + Field Property Inspector (5 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Editable Table of Fields (7 cols) */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-md flex flex-col">
              <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Tabla editable de campos ({draft.fields.length})
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Haga clic en una fila para inspeccionar todas sus propiedades en el panel derecho.
                  </p>
                </div>

                {!isImmutable && (
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1E4E8C] text-white text-xs font-semibold hover:bg-[#163A69] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar campo
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                      <th className="py-2 px-2.5">#</th>
                      {selectedOutputType.family === 'TXT' && (
                        <th className="py-2 px-2">Pos [Ini..Fin]</th>
                      )}
                      {selectedOutputType.family === 'XML' && (
                        <th className="py-2 px-2">Nodo XML</th>
                      )}
                      <th className="py-2 px-2.5">Nombre Técnico / Etiqueta</th>
                      <th className="py-2 px-2">Tipo de Dato</th>
                      <th className="py-2 px-2">Longitud</th>
                      <th className="py-2 px-2">Oblig.</th>
                      <th className="py-2 px-2">Origen (Paso 3)</th>
                      <th className="py-2 px-2.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {draft.fields.map((f, index) => {
                      const isSelected = selectedField?.id === f.id;
                      const hasFieldError = configDiagnostics.some(
                        (d) => d.fieldId === f.id
                      );
                      const startPos = f.startPosition || 1;
                      const endPos = startPos + Math.max(1, f.length) - 1;

                      return (
                        <tr
                          key={f.id}
                          onClick={() => setSelectedFieldId(f.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-50/80'
                              : hasFieldError
                              ? 'bg-rose-50/60 hover:bg-rose-50'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-2 px-2.5 font-mono font-bold text-slate-700 tabular-nums">
                            {f.order}
                          </td>

                          {selectedOutputType.family === 'TXT' && (
                            <td className="py-2 px-2 font-mono text-[11px] text-[#1E4E8C] font-semibold tabular-nums">
                              {startPos}..{endPos}
                            </td>
                          )}

                          {selectedOutputType.family === 'XML' && (
                            <td className="py-2 px-2 font-mono text-[10px]">
                              <span
                                className={`px-1.5 py-0.5 rounded font-semibold ${
                                  f.xmlNodeKind === 'Atributo'
                                    ? 'bg-purple-50 text-purple-900 border border-purple-200'
                                    : 'bg-slate-100 text-slate-800 border border-slate-300'
                                }`}
                              >
                                {f.xmlNodeKind === 'Atributo' ? '@Atributo' : '<Elemento>'}
                              </span>
                            </td>
                          )}

                          <td className="py-2 px-2.5">
                            <input
                              type="text"
                              aria-label={`Nombre técnico campo ${f.order}`}
                              disabled={isImmutable}
                              value={f.technicalName}
                              onChange={(e) =>
                                handleUpdateField(f.id, { technicalName: e.target.value })
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="w-full font-mono font-bold text-slate-900 bg-transparent border-b border-transparent focus:border-[#1E4E8C] focus:bg-white px-1 py-0.5 rounded"
                            />
                            <div className="text-[11px] text-slate-500 px-1 truncate max-w-[180px]">
                              {f.label}
                            </div>
                          </td>

                          <td className="py-2 px-2">
                            <select
                              aria-label={`Tipo de dato campo ${f.order}`}
                              disabled={isImmutable}
                              value={f.dataType}
                              onChange={(e) =>
                                handleUpdateField(f.id, {
                                  dataType: e.target.value as StructureField['dataType'],
                                })
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="border border-slate-200 rounded px-1.5 py-1 bg-white text-[11px] text-slate-800"
                            >
                              <option value="Texto">Texto</option>
                              <option value="Entero">Entero</option>
                              <option value="Decimal">Decimal</option>
                              <option value="Fecha">Fecha</option>
                              <option value="Booleano">Booleano</option>
                              <option value="Catálogo">Catálogo</option>
                            </select>
                          </td>

                          <td className="py-2 px-2">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                aria-label={`Longitud campo ${f.order}`}
                                disabled={isImmutable}
                                value={f.length}
                                onChange={(e) =>
                                  handleUpdateField(f.id, {
                                    length: Number(e.target.value),
                                  })
                                }
                                onClick={(e) => e.stopPropagation()}
                                className={`w-16 border rounded px-1.5 py-1 font-mono text-xs tabular-nums ${
                                  f.length <= 0
                                    ? 'border-rose-500 bg-rose-50 text-rose-900 font-bold'
                                    : 'border-slate-200 bg-white text-slate-900'
                                }`}
                              />
                              <span className="text-[10px] text-slate-400">
                                {f.lengthUnit === 'Bytes' ? 'B' : 'c.'}
                              </span>
                            </div>
                          </td>

                          <td className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              aria-label={`Obligatorio campo ${f.order}`}
                              disabled={isImmutable}
                              checked={f.required}
                              onChange={(e) =>
                                handleUpdateField(f.id, { required: e.target.checked })
                              }
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>

                          <td className="py-2 px-2 font-mono text-[11px]">
                            {f.mapping.sourceField ||
                            f.mapping.transformationKind === 'Constante' ||
                            f.mapping.transformationKind === 'Variable de contexto' ||
                            f.mapping.transformationKind === 'Concatenación tipada' ? (
                              <span className="text-slate-700">
                                {f.mapping.sourceField || f.mapping.expression}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedFieldId(f.id);
                                  setBuilderStep(3);
                                }}
                                className="text-rose-700 font-bold underline hover:text-rose-900 cursor-pointer"
                              >
                                Asignar en Paso 3
                              </button>
                            )}
                          </td>

                          <td className="py-2 px-2.5 text-right">
                            <div
                              className="inline-flex items-center gap-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                disabled={isImmutable || index === 0}
                                onClick={() => handleMoveField(index, 'up')}
                                className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                                title="Subir campo"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={isImmutable || index === draft.fields.length - 1}
                                onClick={() => handleMoveField(index, 'down')}
                                className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                                title="Bajar campo"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={isImmutable}
                                onClick={() => handleDuplicateField(f)}
                                className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer"
                                title="Duplicar campo"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={isImmutable || draft.fields.length <= 1}
                                onClick={() => handleDeleteField(f.id)}
                                className="p-1 rounded hover:bg-rose-100 text-rose-700 disabled:opacity-30 cursor-pointer"
                                title="Eliminar campo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Detailed Field Property Inspector (5 cols) */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-md p-4 space-y-3.5">
              {selectedField ? (
                <>
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E4E8C]">
                        Inspector de propiedades · Campo #{selectedField.order}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 font-mono">
                        {selectedField.technicalName}
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-semibold">
                      {selectedField.dataType}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Nombre técnico del campo *
                        <HelpTooltip
                          title="Nombre técnico"
                          description="Identificador del campo en encabezados CSV, etiquetas XML o nombres de propiedad Avro. Evite espacios y caracteres especiales."
                        />
                      </label>
                      <input
                        type="text"
                        disabled={isImmutable}
                        value={selectedField.technicalName}
                        onChange={(e) =>
                          handleUpdateField(selectedField.id, {
                            technicalName: e.target.value,
                          })
                        }
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Etiqueta / Nombre funcional *
                      </label>
                      <input
                        type="text"
                        disabled={isImmutable}
                        value={selectedField.label}
                        onChange={(e) =>
                          handleUpdateField(selectedField.id, {
                            label: e.target.value,
                          })
                        }
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Tipo de dato lógico *
                        <HelpTooltip
                          title="Tipo de dato lógico"
                          description="Determina las reglas de validación y formato: Fecha aplica máscara de fecha; Decimal valida precisión y escala; Entero rechaza decimales."
                        />
                      </label>
                      <select
                        disabled={isImmutable}
                        value={selectedField.dataType}
                        onChange={(e) =>
                          handleUpdateField(selectedField.id, {
                            dataType: e.target.value as StructureField['dataType'],
                          })
                        }
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                      >
                        <option value="Texto">Texto</option>
                        <option value="Entero">Entero</option>
                        <option value="Decimal">Decimal</option>
                        <option value="Fecha">Fecha</option>
                        <option value="Booleano">Booleano</option>
                        <option value="Catálogo">Catálogo</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Longitud máxima ({selectedField.lengthUnit}) *
                        <HelpTooltip
                          title="Longitud máxima permitida"
                          description="Cantidad máxima de caracteres o bytes UTF-8 admitidos. Si un valor supera esta longitud, el motor bloquea la generación e informa el campo exacto (nunca trunca silenciosamente)."
                        />
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="number"
                          disabled={isImmutable}
                          value={selectedField.length}
                          onChange={(e) =>
                            handleUpdateField(selectedField.id, {
                              length: Number(e.target.value),
                            })
                          }
                          className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
                        />
                        <select
                          aria-label="Unidad de longitud del campo"
                          disabled={isImmutable}
                          value={selectedField.lengthUnit}
                          onChange={(e) =>
                            handleUpdateField(selectedField.id, {
                              lengthUnit: e.target.value as 'Caracteres' | 'Bytes',
                            })
                          }
                          className="border border-slate-300 rounded px-1.5 py-1.5 bg-white text-[11px]"
                        >
                          <option value="Caracteres">Car.</option>
                          <option value="Bytes">Bytes</option>
                        </select>
                      </div>
                    </div>

                    {selectedField.dataType === 'Decimal' && (
                      <>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Precisión total (Dígitos)
                            <HelpTooltip
                              title="Precisión numérica"
                              description="Cantidad total máxima de dígitos significativos (parte entera + parte decimal). Ejemplo: en decimal(18,2), la precisión es 18."
                            />
                          </label>
                          <input
                            type="number"
                            disabled={isImmutable}
                            value={selectedField.precision ?? selectedField.length}
                            onChange={(e) =>
                              handleUpdateField(selectedField.id, {
                                precision: Number(e.target.value),
                              })
                            }
                            className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Escala (Decimales)
                            <HelpTooltip
                              title="Escala decimal"
                              description="Cantidad de posiciones decimales después de la coma o punto. Ejemplo: 2 produce '1234,50'."
                            />
                          </label>
                          <input
                            type="number"
                            disabled={isImmutable}
                            value={selectedField.scale ?? 2}
                            onChange={(e) =>
                              handleUpdateField(selectedField.id, {
                                scale: Number(e.target.value),
                              })
                            }
                            className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Formato o máscara
                        <HelpTooltip
                          title="Máscara de formato"
                          description="Para campos Fecha, define el patrón de salida (dd-MM-yyyy, yyyy-MM-dd, yyyyMMdd, dd/MM/yyyy). Para números o textos documenta la regla de representación."
                          example="dd-MM-yyyy convierte '2026-11-30' en '30-11-2026'."
                        />
                      </label>
                      {selectedField.dataType === 'Fecha' ? (
                        <select
                          disabled={isImmutable}
                          value={selectedField.formatMask || 'yyyy-MM-dd'}
                          onChange={(e) =>
                            handleUpdateField(selectedField.id, {
                              formatMask: e.target.value,
                            })
                          }
                          className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono bg-white"
                        >
                          <option value="dd-MM-yyyy">dd-MM-yyyy (Ej: 30-11-2026)</option>
                          <option value="yyyy-MM-dd">yyyy-MM-dd (Ej: 2026-11-30)</option>
                          <option value="yyyyMMdd">yyyyMMdd (Ej: 20261130)</option>
                          <option value="dd/MM/yyyy">dd/MM/yyyy (Ej: 30/11/2026)</option>
                          <option value="yyyy-MM">yyyy-MM (Ej: 2026-11)</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          disabled={isImmutable}
                          placeholder="Ej. 0.00 o Texto estándar"
                          value={selectedField.formatMask || ''}
                          onChange={(e) =>
                            handleUpdateField(selectedField.id, {
                              formatMask: e.target.value,
                            })
                          }
                          className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Valor por defecto (si vacío)
                        <HelpTooltip
                          title="Valor predeterminado"
                          description="Se utiliza únicamente cuando el dato de origen viene vacío y el campo admite nulos o tiene política de valor predeterminado. Los campos obligatorios no nulos nunca se rellenan silenciosamente."
                        />
                      </label>
                      <input
                        type="text"
                        disabled={isImmutable}
                        placeholder="Opcional"
                        value={selectedField.defaultValue || ''}
                        onChange={(e) =>
                          handleUpdateField(selectedField.id, {
                            defaultValue: e.target.value,
                          })
                        }
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Alineación (Relleno)
                      </label>
                      <select
                        disabled={isImmutable}
                        value={selectedField.alignment}
                        onChange={(e) =>
                          handleUpdateField(selectedField.id, {
                            alignment: e.target.value as 'Izquierda' | 'Derecha',
                          })
                        }
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                      >
                        <option value="Izquierda">Izquierda (rellena a la derecha)</option>
                        <option value="Derecha">Derecha (rellena a la izquierda)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Carácter de relleno (Padding)
                        <HelpTooltip
                          title="Carácter de relleno"
                          description="Completa la longitud del campo con ceros ('0') o espacios (' ') cuando el valor es más corto que la longitud declarada (ej. '123' con relleno '0' a la derecha y longitud 6 produce '000123')."
                        />
                      </label>
                      <select
                        disabled={isImmutable}
                        value={selectedField.paddingChar}
                        onChange={(e) =>
                          handleUpdateField(selectedField.id, {
                            paddingChar: e.target.value as ' ' | '0' | 'Ninguno',
                          })
                        }
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                      >
                        <option value="Ninguno">Sin relleno</option>
                        <option value=" ">Espacios (&apos; &apos;)</option>
                        <option value="0">Ceros (&apos;0&apos;)</option>
                      </select>
                    </div>

                    {selectedOutputType.family === 'TXT' && (
                      <>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Posición inicial (TXT)
                          </label>
                          <input
                            type="number"
                            disabled={isImmutable}
                            value={selectedField.startPosition || 1}
                            onChange={(e) =>
                              handleUpdateField(selectedField.id, {
                                startPosition: Number(e.target.value) || 1,
                              })
                            }
                            className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Posición final calculada (TXT)
                          </label>
                          <input
                            type="number"
                            disabled
                            value={
                              (selectedField.startPosition || 1) +
                              Math.max(1, selectedField.length) -
                              1
                            }
                            className="w-full border border-slate-200 bg-slate-100 rounded px-2.5 py-1.5 font-mono text-slate-600"
                          />
                        </div>
                      </>
                    )}

                    {selectedOutputType.family === 'XML' && (
                      <div className="sm:col-span-2 grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Tipo de nodo XML
                          </label>
                          <select
                            disabled={isImmutable}
                            value={selectedField.xmlNodeKind || 'Elemento'}
                            onChange={(e) =>
                              handleUpdateField(selectedField.id, {
                                xmlNodeKind: e.target.value as 'Elemento' | 'Atributo',
                              })
                            }
                            className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                          >
                            <option value="Elemento">Elemento hijo (&lt;campo&gt;)</option>
                            <option value="Atributo">Atributo en &lt;Registro&gt; (@campo)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Sección / Nivel jerárquico
                          </label>
                          <select
                            disabled={isImmutable}
                            value={selectedField.recordSection}
                            onChange={(e) =>
                              handleUpdateField(selectedField.id, {
                                recordSection: e.target.value as StructureField['recordSection'],
                              })
                            }
                            className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                          >
                            <option value="Detalle">Detalle (&lt;DetalleRegistros&gt;)</option>
                            <option value="Cabecera">Cabecera (&lt;Encabezado&gt;)</option>
                            <option value="Nodo raíz / Hecho">Nodo raíz / Hecho</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="sm:col-span-2 pt-1 flex flex-wrap items-center justify-between gap-2">
                      <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                        <input
                          type="checkbox"
                          disabled={isImmutable}
                          checked={selectedField.required}
                          onChange={(e) =>
                            handleUpdateField(selectedField.id, {
                              required: e.target.checked,
                              nullable: !e.target.checked,
                            })
                          }
                        />
                        <span>Campo obligatorio en el archivo de salida</span>
                      </label>
                      <span className="text-[11px] text-slate-500">
                        Sustento: <strong>{selectedField.evidenceState}</strong>
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-500 py-8 text-center">
                  Seleccione un campo en la tabla izquierda para editar sus propiedades.
                </div>
              )}
            </div>
          </div>

          {/* Bottom of Step 2: Live Auto-Updating Physical Preview */}
          <div className="bg-white border border-slate-200 rounded-md p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#1E4E8C]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Vista previa en vivo ({compiledResult.fileName}) · Corte {globalPeriod} ({getCutoffDateForPeriod(globalPeriod)})
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">
                Sincronizada en tiempo real con la tabla y el inspector de propiedades
              </span>
            </div>

            {selectedOutputType.family === 'TXT' && (
              <div className="font-mono text-[11px] text-amber-300 bg-slate-950 px-3 py-1.5 rounded-t border-b border-slate-800 overflow-x-auto whitespace-pre">
                {Array.from({ length: 10 }, (_, i) =>
                  `123456789${(i + 1) % 10}`
                ).join('')}
              </div>
            )}

            <pre className="p-3.5 rounded bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed max-h-60">
              {compiledResult.content}
            </pre>
          </div>
        </div>
      )}

      {/* STEP 3: ORIGEN DE DATOS Y CORRESPONDENCIA DE CAMPOS */}
      {builderStep === 3 && (
        <Step3DataOriginView
          activeOutput={draft}
          activeOutputType={selectedOutputType}
          isImmutable={isImmutable}
          dataContracts={dataContracts}
          catalogSourceFormats={catalogSourceFormats}
          globalEntity={globalEntity}
          globalPeriod={globalPeriod}
          previewContext={fileNameContext}
          onUpdateOutput={updateDraft}
          onUpdateFieldMapping={(fieldId, mappingKey, value) =>
            handleUpdateFieldMapping(fieldId, { [mappingKey]: value })
          }
          onSaveDataContract={saveDataContract}
          onSaveCatalogSourceFormat={saveCatalogSourceFormat}
          onImportCatalogEntriesBatch={importCatalogEntriesBatch}
          onRegisterStructureForCatalogEntry={registerStructureForCatalogEntry}
          onAddExecutionBatchToContract={addExecutionBatchToContract}
          onRequestCreateRevision={() => setShowRevisionModal(true)}
          onGoToStep={setBuilderStep}
          notify={notify}
        />
      )}

      {/* STEP 4: VALIDACIONES */}
      {builderStep === 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Guided Rule Builder + Configured Output Validation Rules (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Guided Rule Creator for Non-Technical / Functional Users */}
            {!isImmutable && (
              <div className="bg-white border border-blue-200 rounded-md p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E4E8C]">
                      Constructor guiado de validaciones (Sin escribir código)
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      Agregar regla de validación funcional a esta salida
                    </h3>
                  </div>
                  <HelpTooltip
                    align="right"
                    title="Constructor guiado de reglas"
                    description="Permite agregar controles sobre los campos de la salida o sobre el conteo de registros sin escribir fórmulas técnicas. Cada regla activa se evalúa de verdad sobre todos los registros al generar el archivo."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      1. Tipo de condición
                    </label>
                    <select
                      aria-label="Tipo de condición de la regla guiada"
                      value={guidedRuleOperator}
                      onChange={(e) =>
                        setGuidedRuleOperator(
                          e.target.value as typeof guidedRuleOperator
                        )
                      }
                      className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white"
                    >
                      <option value="NOT_NULL">Campo no vacío (NOT_NULL)</option>
                      <option value="MAX_LEN">Longitud máxima (LEN_CHARS &lt;= N)</option>
                      <option value="MIN_NUM">Valor numérico mínimo (&gt;= N)</option>
                      <option value="NOT_ZERO">Valor distinto de cero (!= 0)</option>
                      <option value="IN_LIST">Valor en lista autorizada (IN_LIST)</option>
                      <option value="REGEX">Cumple patrón regular (MATCH_REGEX)</option>
                      <option value="RECORD_COUNT">Cantidad mínima de registros</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      2. Campo objetivo
                    </label>
                    <select
                      aria-label="Campo objetivo de la regla guiada"
                      disabled={guidedRuleOperator === 'RECORD_COUNT'}
                      value={guidedRuleField || draft.fields[0]?.technicalName || ''}
                      onChange={(e) => setGuidedRuleField(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white font-mono disabled:bg-slate-100"
                    >
                      {draft.fields.map((f) => (
                        <option key={f.id} value={f.technicalName}>
                          {f.technicalName} ({f.label})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      3. Parámetro / Valor límite
                    </label>
                    <input
                      type="text"
                      disabled={
                        guidedRuleOperator === 'NOT_NULL' ||
                        guidedRuleOperator === 'NOT_ZERO'
                      }
                      value={guidedRuleParam}
                      onChange={(e) => setGuidedRuleParam(e.target.value)}
                      placeholder={
                        guidedRuleOperator === 'IN_LIST'
                          ? 'Ej. VIGENTE,VENCIDO'
                          : guidedRuleOperator === 'REGEX'
                          ? 'Ej. ^[0-9]+$'
                          : 'Ej. 10'
                      }
                      className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono bg-white disabled:bg-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-3">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Severidad
                    </label>
                    <select
                      value={guidedRuleSeverity}
                      onChange={(e) =>
                        setGuidedRuleSeverity(
                          e.target.value as 'Bloqueante' | 'Advertencia'
                        )
                      }
                      className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white font-semibold"
                    >
                      <option value="Bloqueante">Bloqueante</option>
                      <option value="Advertencia">Advertencia</option>
                    </select>
                  </div>
                  <div className="sm:col-span-6">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Mensaje diagnóstico (opcional)
                    </label>
                    <input
                      type="text"
                      value={guidedRuleMessage}
                      onChange={(e) => setGuidedRuleMessage(e.target.value)}
                      placeholder="Se genera automáticamente si se deja en blanco"
                      className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <button
                      type="button"
                      onClick={handleAddGuidedRule}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-[#1E4E8C] text-white font-semibold hover:bg-[#163A69] cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Agregar regla
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-md p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Paso 4. Reglas configuradas en la salida ({draft.validationRules.length})
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Active, desactive o edite las reglas de validación propias de esta salida.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {draft.validationRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-3.5 rounded border border-slate-200 bg-slate-50/70 space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          aria-label={`Activar regla ${rule.code}`}
                          disabled={isImmutable}
                          checked={rule.enabled}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              validationRules: p.validationRules.map((r) =>
                                r.id === rule.id ? { ...r, enabled: e.target.checked } : r
                              ),
                            }))
                          }
                        />
                        <span className="font-mono font-bold text-[#1E4E8C]">{rule.code}</span>
                        <input
                          type="text"
                          disabled={isImmutable}
                          value={rule.name}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              validationRules: p.validationRules.map((r) =>
                                r.id === rule.id ? { ...r, name: e.target.value } : r
                              ),
                            }))
                          }
                          className="font-semibold text-slate-900 border-b border-transparent focus:border-slate-400 bg-transparent px-1"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          disabled={isImmutable}
                          value={rule.severity}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              validationRules: p.validationRules.map((r) =>
                                r.id === rule.id
                                  ? {
                                      ...r,
                                      severity: e.target.value as 'Bloqueante' | 'Advertencia',
                                    }
                                  : r
                              ),
                            }))
                          }
                          className="border border-slate-300 rounded px-2 py-0.5 text-[11px] font-semibold bg-white"
                        >
                          <option value="Bloqueante">Bloqueante</option>
                          <option value="Advertencia">Advertencia</option>
                        </select>

                        {!isImmutable && draft.validationRules.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft((p) => ({
                                ...p,
                                validationRules: p.validationRules.filter(
                                  (r) => r.id !== rule.id
                                ),
                              }))
                            }
                            className="p-1 text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                            title="Eliminar regla"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <div>
                        <label className="block text-[11px] text-slate-500 font-semibold">
                          Condición / Expresión declarativa (Avanzado)
                        </label>
                        <input
                          type="text"
                          disabled={isImmutable}
                          value={rule.conditionExpression}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              validationRules: p.validationRules.map((r) =>
                                r.id === rule.id
                                  ? { ...r, conditionExpression: e.target.value }
                                  : r
                              ),
                            }))
                          }
                          className="w-full border border-slate-300 rounded px-2 py-1 font-mono text-[11px] bg-white mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 font-semibold">
                          Mensaje diagnóstico al usuario
                        </label>
                        <input
                          type="text"
                          disabled={isImmutable}
                          value={rule.diagnosticMessage}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              validationRules: p.validationRules.map((r) =>
                                r.id === rule.id
                                  ? { ...r, diagnosticMessage: e.target.value }
                                  : r
                              ),
                            }))
                          }
                          className="w-full border border-slate-300 rounded px-2 py-1 text-[11px] bg-white mt-0.5"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Live Evaluation Findings + DAQUE Separation (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-slate-200 rounded-md p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Resultado actual de validaciones sobre los datos
                </h3>
                <span
                  className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                    blockingIssuesCount === 0
                      ? 'bg-emerald-100 text-emerald-900'
                      : 'bg-rose-100 text-rose-900'
                  }`}
                >
                  {blockingIssuesCount === 0
                    ? '0 bloqueos'
                    : `${blockingIssuesCount} bloqueo(s)`}
                </span>
              </div>

              {configDiagnostics.length === 0 && compiledResult.findings.length === 0 ? (
                <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Todas las reglas activas se cumplen</div>
                    <p className="mt-0.5 text-[11px]">
                      Los {compiledResult.rowsProcessed} registros del corte {globalPeriod} superan los controles de estructura, mapeo y reglas de salida.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {configDiagnostics.map((diag) => (
                    <div
                      key={diag.id}
                      className="p-2.5 rounded border border-rose-200 bg-rose-50 text-rose-950 space-y-1"
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>{diag.title}</span>
                        <span className="px-1.5 py-0.2 rounded bg-rose-200 text-[10px]">
                          {diag.severity}
                        </span>
                      </div>
                      <p className="text-[11px]">{diag.howToFix}</p>
                      <button
                        type="button"
                        onClick={() => {
                          if (diag.fieldId) setSelectedFieldId(diag.fieldId);
                          setBuilderStep(diag.step);
                        }}
                        className="px-2 py-1 rounded bg-rose-800 text-white text-[10px] font-semibold hover:bg-rose-900 cursor-pointer"
                      >
                        Ir al campo afectado (Paso {diag.step})
                      </button>
                    </div>
                  ))}

                  {compiledResult.findings.map((f) => (
                    <div
                      key={f.id}
                      className={`p-2.5 rounded border space-y-1 ${
                        f.severity === 'Bloqueante'
                          ? 'border-rose-200 bg-rose-50 text-rose-950'
                          : 'border-amber-200 bg-amber-50 text-amber-950'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>
                          [{f.code}] {f.location}
                        </span>
                        <span className="text-[10px] font-bold">{f.severity}</span>
                      </div>
                      <p className="text-[11px]">{f.description}</p>
                      <p className="text-[10px] opacity-90">
                        <strong>Acción recomendada:</strong> {f.suggestedAction}
                      </p>
                      {f.fieldTechnicalName && (
                        <div className="flex gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => jumpToFieldByTechnicalName(f.fieldTechnicalName, 2)}
                            className="px-2 py-0.5 rounded bg-slate-800 text-white text-[10px] font-semibold hover:bg-slate-900 cursor-pointer"
                          >
                            Ir al campo en Paso 2
                          </button>
                          <button
                            type="button"
                            onClick={() => jumpToFieldByTechnicalName(f.fieldTechnicalName, 3)}
                            className="px-2 py-0.5 rounded border border-slate-400 bg-white text-slate-800 text-[10px] font-semibold hover:bg-slate-100 cursor-pointer"
                          >
                            Revisar mapeo en Paso 3
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-indigo-50/70 border border-indigo-200 rounded-md p-4 space-y-2 text-xs text-indigo-950">
              <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-900">
                Separación de reglas de datos del formato (DAQUE)
              </div>
              <p>
                Las reglas de negocio propias de cada formato regulatorio (por ejemplo, si un formato específico rechaza saldos en cero en el perfil <strong>{activeDaqueProfile?.code}</strong>) se administran en el perfil DAQUE de cada asociación y <strong>no contaminan la estructura de esta salida</strong>, permitiendo reutilizarla en múltiples formatos.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: GENERACIÓN Y ENTREGA */}
      {builderStep === 5 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-md p-5 space-y-4 text-xs">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Paso 5. Reglas de generación, nombre dinámico y canal de entrega
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Configure el patrón de nombre del archivo resultante, la política de datos vacíos y el canal de entrega predeterminado.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Patrón de nombre dinámico del archivo principal *
                <HelpTooltip
                  title="Patrón de nombre dinámico"
                  description="Construye automáticamente el nombre del archivo reemplazando las variables entre llaves: {entidad}, {formato}, {periodo}, {fecha_corte}, {version} y {consecutivo}. La extensión del tipo de archivo se añade automáticamente."
                  example="saldos_{entidad}_{formato}_{periodo}_v{version}"
                />
              </label>
              <input
                type="text"
                disabled={isImmutable}
                value={draft.composition.fileNamePattern}
                onChange={(e) => {
                  const newPat = e.target.value;
                  const cleanBase = newPat.replace(
                    new RegExp(`\\.${draft.composition.extension}$`, 'i'),
                    ''
                  );
                  updateDraft((p) => ({
                    ...p,
                    composition: {
                      ...p.composition,
                      fileNamePattern: newPat,
                      packageMembers: p.composition.packageMembers.map((m) =>
                        m.role === 'Principal'
                          ? {
                              ...m,
                              fileNamePattern: `${cleanBase}.${p.composition.extension}`,
                            }
                          : m
                      ),
                    },
                  }));
                }}
                className="w-full border border-slate-300 rounded px-3 py-2 font-mono text-slate-900"
              />

              {!isImmutable && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-slate-500">Insertar marcador:</span>
                  {['{entidad}', '{formato}', '{periodo}', '{fecha_corte}', '{version}', '{consecutivo}'].map(
                    (token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() =>
                          updateDraft((p) => {
                            const nextPat = `${p.composition.fileNamePattern}_${token}`;
                            return {
                              ...p,
                              composition: {
                                ...p.composition,
                                fileNamePattern: nextPat,
                                packageMembers: p.composition.packageMembers.map((m) =>
                                  m.role === 'Principal'
                                    ? {
                                        ...m,
                                        fileNamePattern: `${nextPat}.${p.composition.extension}`,
                                      }
                                    : m
                                ),
                              },
                            };
                          })
                        }
                        className="px-2 py-0.5 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 font-mono text-[11px] text-[#1E4E8C] cursor-pointer"
                      >
                        + {token}
                      </button>
                    )
                  )}
                </div>
              )}

              <div className="mt-2 p-2.5 rounded bg-blue-50 border border-blue-200 text-[#1E4E8C] font-mono text-xs flex items-center justify-between">
                <span>
                  Nombre resuelto para el corte activo: <strong>{compiledResult.fileName}</strong>
                </span>
                <span className="text-[10px] font-sans text-slate-600">
                  Sincronizado con vista previa y descarga
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Empaquetado del archivo
                  <HelpTooltip
                    title="Empaquetado de entrega"
                    description="Indica si el archivo se entrega de forma directa o dentro de un contenedor comprimido (.ZIP o .GZIP) cuando el paquete incluye anexos o archivos de control."
                  />
                </label>
                <select
                  disabled={isImmutable}
                  value={draft.composition.packaging}
                  onChange={(e) =>
                    updateDraft((p) => ({
                      ...p,
                      composition: {
                        ...p.composition,
                        packaging: e.target.value as 'Sin empaquetar' | 'ZIP' | 'GZIP',
                      },
                    }))
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                >
                  <option value="Sin empaquetar">Archivo directo (Sin empaquetar)</option>
                  <option value="ZIP">Contenedor comprimido (.ZIP)</option>
                  <option value="GZIP">Compresión GZIP (.gz)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Canal de entrega predeterminado (Referencia)
                  <HelpTooltip
                    title="Canal configurado vs Conexión activa"
                    description="Establece el mecanismo de entrega predeterminado (SFTP, API REST, Descarga controlada o Repositorio). Cada asociación en la pantalla D puede sobrescribir este canal."
                    consequence="En este entorno de navegador, los canales SFTP y API están configurados como referencia de arquitectura y no abren conexiones de red externas."
                  />
                </label>
                <select
                  disabled={isImmutable}
                  value={draft.defaultDeliveryChannelId}
                  onChange={(e) =>
                    updateDraft((p) => ({
                      ...p,
                      defaultDeliveryChannelId: e.target.value,
                    }))
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                >
                  {deliveryChannels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name} ({ch.protocol})
                    </option>
                  ))}
                </select>
              </div>

              {/* Explicit distinction between Configured Channel Reference and Connection State */}
              <div className="sm:col-span-2 p-2.5 rounded border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div>
                  <span className="font-semibold text-slate-800">
                    Canal seleccionado: {selectedDeliveryChannel?.name} ({selectedDeliveryChannel?.protocol})
                  </span>
                  <div className="text-slate-500">
                    Destino lógico: <span className="font-mono">{selectedDeliveryChannel?.logicalDestination}</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-900 font-semibold">
                  {selectedDeliveryChannel?.protocol === 'Descarga controlada (Manual)'
                    ? 'Operativo en navegador (Descarga directa)'
                    : 'Configurado por referencia (Sin conexión externa activa en navegador)'}
                </span>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-800 mb-1">
                  Comportamiento cuando existan 0 registros en el periodo
                  <HelpTooltip
                    title="Política de conjunto de datos vacío"
                    description="Define qué hace el generador cuando el periodo de corte tiene 0 operaciones: producir un archivo vacío válido con cabecera, bloquear la generación con error o no generar el archivo."
                  />
                </label>
                <select
                  disabled={isImmutable}
                  value={draft.composition.emptyDatasetPolicy}
                  onChange={(e) =>
                    updateDraft((p) => ({
                      ...p,
                      composition: {
                        ...p.composition,
                        emptyDatasetPolicy: e.target.value as EmptyDatasetPolicy,
                      },
                    }))
                  }
                  className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white"
                >
                  <option value="Producir vacío válido">
                    Generar archivo vacío con encabezado válido (Envío sin operaciones)
                  </option>
                  <option value="Bloquear generación">
                    Bloquear generación si existen 0 registros
                  </option>
                  <option value="Omitir archivo">Omitir generación del archivo</option>
                </select>
              </div>
            </div>
          </div>

          {/* Right: Package Files Composition (Editable & Duplicate-Safe) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-md p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1">
                  <span>Archivos que integran el paquete ({draft.composition.packageMembers.length})</span>
                  <HelpTooltip
                    align="right"
                    title="Roles de archivo en el paquete"
                    description="El archivo Principal siempre sincroniza su nombre con el patrón principal. Puede agregar archivos complementarios (Control/Resumen, Anexo, Detalle) con nombres únicos."
                  />
                </h3>
                <p className="text-[11px] text-slate-500">
                  No se permiten dos archivos con el mismo nombre dentro del mismo paquete.
                </p>
              </div>
              {!isImmutable && (
                <button
                  type="button"
                  onClick={() => {
                    const seq = draft.composition.packageMembers.length + 1;
                    const seqStr = String(seq).padStart(2, '0');
                    const newMember: PackageMemberRole = {
                      id: `PKG-${Date.now()}`,
                      role: seq === 2 ? 'Control / Resumen' : 'Anexo',
                      cardinality: '0..1 (Opcional)',
                      outputDefinitionId: draft.code,
                      outputVersion: draft.version,
                      fileNamePattern: `{entidad}_${draft.code}_{periodo}_ANEXO_${seqStr}.txt`,
                      includeInRegulatoryDelivery: true,
                      allowRoleMappingOverride: true,
                    };
                    updateDraft((p) => ({
                      ...p,
                      composition: {
                        ...p.composition,
                        packageMembers: [...p.composition.packageMembers, newMember],
                      },
                    }));
                  }}
                  className="px-2.5 py-1 rounded border border-blue-300 bg-blue-50 text-[#1E4E8C] font-semibold hover:bg-blue-100 cursor-pointer shrink-0"
                >
                  + Agregar archivo al paquete
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {draft.composition.packageMembers.map((m, idx) => {
                const isPrincipal = m.role === 'Principal';
                const resolvedMemberName = isPrincipal
                  ? compiledResult.fileName
                  : resolveDynamicFileName(m.fileNamePattern, {
                      ...fileNameContext,
                      consecutivo: String(idx + 1).padStart(2, '0'),
                    });

                return (
                  <div
                    key={m.id}
                    className={`p-3 rounded border space-y-2 ${
                      isPrincipal
                        ? 'border-blue-200 bg-blue-50/40'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {isPrincipal ? (
                        <span className="font-bold text-[#1E4E8C]">
                          1. Rol: Principal (Archivo de la salida)
                        </span>
                      ) : (
                        <select
                          aria-label={`Rol del archivo ${idx + 1}`}
                          disabled={isImmutable}
                          value={m.role}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              composition: {
                                ...p.composition,
                                packageMembers: p.composition.packageMembers.map((item) =>
                                  item.id === m.id
                                    ? {
                                        ...item,
                                        role: e.target.value as PackageMemberRole['role'],
                                      }
                                    : item
                                ),
                              },
                            }))
                          }
                          className="border border-slate-300 rounded px-2 py-0.5 bg-white font-bold text-slate-900"
                        >
                          <option value="Control / Resumen">Control / Resumen</option>
                          <option value="Anexo">Anexo</option>
                          <option value="Detalle">Detalle secundario</option>
                          <option value="Evidencia interna">Evidencia interna</option>
                        </select>
                      )}

                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono text-[10px] font-bold">
                          {m.cardinality}
                        </span>
                        {!isImmutable && !isPrincipal && (
                          <button
                            type="button"
                            onClick={() =>
                              updateDraft((p) => ({
                                ...p,
                                composition: {
                                  ...p.composition,
                                  packageMembers: p.composition.packageMembers.filter(
                                    (item) => item.id !== m.id
                                  ),
                                },
                              }))
                            }
                            className="p-1 rounded text-rose-700 hover:bg-rose-100 cursor-pointer"
                            title="Eliminar este archivo del paquete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {isPrincipal ? (
                      <div className="font-mono text-[11px] text-[#1E4E8C] font-semibold">
                        Nombre resuelto: {resolvedMemberName}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <input
                          type="text"
                          aria-label={`Patrón de nombre del miembro ${idx + 1}`}
                          disabled={isImmutable}
                          value={m.fileNamePattern}
                          onChange={(e) =>
                            updateDraft((p) => ({
                              ...p,
                              composition: {
                                ...p.composition,
                                packageMembers: p.composition.packageMembers.map((item) =>
                                  item.id === m.id
                                    ? { ...item, fileNamePattern: e.target.value }
                                    : item
                                ),
                              },
                            }))
                          }
                          className="w-full border border-slate-300 rounded px-2 py-1 font-mono text-[11px] bg-white"
                        />
                        <div className="font-mono text-[10px] text-slate-600">
                          Resuelto: {resolvedMemberName}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* STEP 6: PRUEBAS (6-Dimension Readiness Matrix, Diagnostics, Preview & Download) */}
      {builderStep === 6 && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-md p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Paso 6. Pruebas de configuración, validación y generación de archivo
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Separa explícitamente el estado de la vista previa, la validación de configuración, la validación de datos DAQUE, la generación física y la descarga.
              </p>
              {compiledResult.sourceExecutionSummary && (
                <div className="mt-2 inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-[11px] text-slate-800">
                  <span className="font-bold text-[#1E4E8C]">Lote / Ejecución de origen fijada:</span>
                  <span className="font-mono">{compiledResult.sourceExecutionSummary}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {!isImmutable && (
                <button
                  type="button"
                  onClick={handleManualSave}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Guardar borrador
                </button>
              )}
              {isPhysicalEngineSupported ? (
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!canDownloadPhysicalArtifact}
                    onClick={handleDownloadPreviewArtifact}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded text-xs font-bold transition-colors ${
                      !canDownloadPhysicalArtifact
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-[#1E4E8C] text-white hover:bg-[#163A69] cursor-pointer shadow-xs'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                    Generar y descargar archivo físico ({compiledResult.fileName})
                  </button>
                  {!canDownloadPhysicalArtifact && (
                    <HelpTooltip
                      variant="disabled-reason"
                      align="right"
                      title={
                        structuralBlockingCount > 0
                          ? 'Descarga bloqueada por errores en estructura'
                          : 'Descarga bloqueada: Falta lote compatible'
                      }
                      description={
                        structuralBlockingCount > 0
                          ? 'Existen errores de estructura (longitudes, solapamientos o nombres técnicos) por corregir en el Paso 2.'
                          : 'La estructura técnica es válida, pero no existe un lote de datos compatible para la entidad y el periodo seleccionados (Código CES-DAT-000). Vaya al Paso 3 para seleccionar un informe con lote o cargar datos.'
                      }
                      disabledReason={
                        structuralBlockingCount > 0
                          ? `Existen ${structuralBlockingCount} bloqueo(s) de estructura activo(s).`
                          : !compiledResult.isRealExecutableGeneration
                          ? 'No hay lote de datos compatible (CES-DAT-000).'
                          : 'Descarga no disponible.'
                      }
                      enableRequirement="Seleccione o cargue un lote compatible en el Paso 3 y resuelva los bloqueos señalados."
                    />
                  )}
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded text-xs font-semibold bg-slate-200 text-slate-600 cursor-not-allowed border border-slate-300"
                  >
                    <Lock className="w-4 h-4 text-slate-500" />
                    Descarga binaria no disponible en navegador ({selectedOutputType.family})
                  </button>
                  <HelpTooltip
                    variant="disabled-reason"
                    align="right"
                    label="¿Por qué no se descarga?"
                    title={`Generación binaria ${selectedOutputType.family} en servidor`}
                    description={`En esta versión web están habilitados los generadores físicos para CSV, TXT y XML. Para ${selectedOutputType.family} se valida el esquema y los registros lógicos, pero el binario requiere el motor "${selectedOutputType.serializationEngine}" en servidor.`}
                    disabledReason={`El tipo de archivo ${selectedOutputType.family} no genera binario descargable en navegador.`}
                    enableRequirement="Utilice CSV, TXT o XML para descargar archivos físicos en el navegador, o consulte el esquema validado en la vista previa."
                  />
                </div>
              )}
            </div>
          </div>

          {/* 4 Distinct Temporal & Provenance Concepts Card */}
          <div className="bg-white border border-slate-200 rounded-md p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded border border-slate-200 bg-slate-50">
              <div className="text-[10px] font-bold uppercase text-slate-500">
                1. Periodo y entidad solicitados
              </div>
              <div className="font-mono font-bold text-[#1E4E8C] mt-0.5">
                {globalPeriod} (Corte {getCutoffDateForPeriod(globalPeriod)})
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">
                Entidad: <strong>{globalEntity}</strong>
              </div>
            </div>

            <div
              className={`p-2.5 rounded border ${
                compiledResult.batchCompatibilityStatus === 'Compatible'
                  ? 'border-emerald-200 bg-emerald-50/40'
                  : 'border-rose-300 bg-rose-50/70'
              }`}
            >
              <div className="text-[10px] font-bold uppercase text-slate-500">
                2. Periodo y fecha de corte del lote
              </div>
              <div className="font-mono font-bold text-slate-900 mt-0.5">
                {compiledResult.batchCutoffPeriod
                  ? `${compiledResult.batchCutoffPeriod} (Corte ${compiledResult.batchCutoffDate || 'N/A'})`
                  : 'Sin lote compatible en este corte'}
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">
                Estado: <strong>{compiledResult.batchCompatibilityStatus || 'Sin lote'}</strong>
              </div>
            </div>

            <div className="p-2.5 rounded border border-slate-200 bg-slate-50">
              <div className="text-[10px] font-bold uppercase text-slate-500">
                3. Fecha de ejecución o carga del lote
              </div>
              <div className="font-mono font-bold text-slate-900 mt-0.5">
                {compiledResult.batchCreatedAt || 'N/A (Sin lote compatible)'}
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">
                Las fechas del lote nunca se reescriben al cambiar de periodo
              </div>
            </div>

            <div className="p-2.5 rounded border border-slate-200 bg-slate-50">
              <div className="text-[10px] font-bold uppercase text-slate-500">
                4. Fecha de generación / evaluación
              </div>
              <div className="font-mono font-bold text-slate-900 mt-0.5">
                {compiledResult.artifactGeneratedAt || 'N/A'}
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">
                Archivo objetivo: <span className="font-mono">{compiledResult.fileName}</span>
              </div>
            </div>
          </div>

          {compiledResult.batchCompatibilityStatus !== 'Compatible' && (
            <div className="p-4 rounded-md border border-rose-300 bg-rose-50 text-rose-950 text-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-sm text-rose-950">
                    No hay un lote compatible para la entidad y el periodo seleccionados
                  </div>
                  <p className="text-rose-900">
                    {compiledResult.batchCompatibilityDetail ||
                      `No existe un lote ejecutado o cargado para la entidad "${globalEntity}" y el periodo "${globalPeriod}".`}{' '}
                    Se conserva la referencia histórica en la configuración sin alterar sus fechas ni saldos, y se permite continuar el diseño y guardar borrador, pero se bloquea la declaración de conformidad de datos y la generación operativa hasta elegir o cargar un lote compatible.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setBuilderStep(3)}
                  className="px-3.5 py-2 rounded bg-rose-800 text-white font-bold hover:bg-rose-900 cursor-pointer"
                >
                  Elegir o cargar lote en Paso 3
                </button>
              </div>
            </div>
          )}

          {/* 6-Dimension Readiness Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs">
            <div className="p-3 rounded-md border border-slate-200 bg-white">
              <div className="text-[10px] font-bold uppercase text-slate-500">
                1. Vista previa
              </div>
              <div className="font-bold text-slate-900 mt-1">
                {compiledResult.readinessMatrix.previewStatus.state}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {compiledResult.readinessMatrix.previewStatus.detail}
              </div>
            </div>

            <div
              className={`p-3 rounded-md border ${
                compiledResult.readinessMatrix.configValidationStatus.state === 'Con bloqueos'
                  ? 'border-rose-300 bg-rose-50/70 text-rose-950'
                  : 'border-emerald-200 bg-emerald-50/50 text-emerald-950'
              }`}
            >
              <div className="text-[10px] font-bold uppercase opacity-75">
                2. Validación configuración
              </div>
              <div className="font-bold mt-1">
                {blockingIssuesCount > 0 ? `${blockingIssuesCount} Bloqueo(s)` : 'Válida (0 bloqueos)'}
              </div>
              <div className="text-[11px] opacity-85 mt-0.5">
                {compiledResult.readinessMatrix.configValidationStatus.detail}
              </div>
            </div>

            <div
              className={`p-3 rounded-md border ${
                compiledResult.readinessMatrix.dataValidationStatus.state ===
                'Bloqueada por DAQUE'
                  ? 'border-rose-300 bg-rose-50/70 text-rose-950'
                  : 'border-slate-200 bg-white text-slate-900'
              }`}
            >
              <div className="text-[10px] font-bold uppercase text-slate-500">
                3. Validación datos (DAQUE)
              </div>
              <div className="font-bold mt-1">
                {compiledResult.readinessMatrix.dataValidationStatus.state}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {compiledResult.readinessMatrix.dataValidationStatus.detail}
              </div>
            </div>

            <div
              className={`p-3 rounded-md border ${
                compiledResult.readinessMatrix.artifactGenerationStatus.state ===
                'Archivo físico generado'
                  ? 'border-emerald-200 bg-emerald-50/50 text-emerald-950'
                  : compiledResult.readinessMatrix.artifactGenerationStatus.state ===
                    'Bloqueado por errores'
                  ? 'border-rose-300 bg-rose-50/70 text-rose-950'
                  : 'border-amber-200 bg-amber-50/60 text-amber-950'
              }`}
            >
              <div className="text-[10px] font-bold uppercase opacity-75">
                4. Archivo físico
              </div>
              <div className="font-bold mt-1">
                {compiledResult.readinessMatrix.artifactGenerationStatus.state}
              </div>
              <div className="text-[11px] opacity-85 mt-0.5">
                {compiledResult.readinessMatrix.artifactGenerationStatus.detail}
              </div>
            </div>

            <div className="p-3 rounded-md border border-slate-200 bg-white">
              <div className="text-[10px] font-bold uppercase text-slate-500">
                5. Descarga en navegador
              </div>
              <div className="font-bold text-slate-900 mt-1">
                {compiledResult.readinessMatrix.downloadAvailabilityStatus.state}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {compiledResult.readinessMatrix.downloadAvailabilityStatus.detail}
              </div>
            </div>

            <div
              className={`p-3 rounded-md border ${
                compiledResult.readinessMatrix.deliveryReadinessStatus.state ===
                'Lista para entrega'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                  : compiledResult.readinessMatrix.deliveryReadinessStatus.state.startsWith(
                      'Validación superada'
                    )
                  ? 'border-blue-200 bg-blue-50 text-blue-950'
                  : 'border-rose-300 bg-rose-50 text-rose-950'
              }`}
            >
              <div className="text-[10px] font-bold uppercase opacity-75">
                6. Estado para entrega
              </div>
              <div className="font-bold mt-1">
                {compiledResult.readinessMatrix.deliveryReadinessStatus.state}
              </div>
              <div className="text-[11px] opacity-85 mt-0.5">
                {compiledResult.readinessMatrix.deliveryReadinessStatus.detail}
              </div>
            </div>
          </div>

          {/* Diagnostic Result Panel + Physical File Output Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-[#1E4E8C]" />
                  Diagnóstico detallado de la configuración
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                    canDownloadPhysicalArtifact
                      ? 'bg-emerald-100 text-emerald-900'
                      : structuralBlockingCount === 0
                      ? 'bg-amber-100 text-amber-950'
                      : 'bg-rose-100 text-rose-900'
                  }`}
                >
                  {canDownloadPhysicalArtifact
                    ? 'Configuración y generación válidas'
                    : structuralBlockingCount === 0
                    ? 'Estructura válida (Lote pendiente)'
                    : `${totalBlockingCount} error(es) por corregir`}
                </span>
              </div>

              {canDownloadPhysicalArtifact ? (
                isPhysicalEngineSupported ? (
                  <div className="p-3.5 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      Controles superados — Archivo físico generado y disponible para descarga
                    </div>
                    <p>
                      Los {draft.fields.length} campos cuentan con longitud válida, tipos consistentes y lote compatible (
                      <span className="font-semibold">
                        {compiledResult.resolvedPrimaryBatch?.executionCode ||
                          compiledResult.sourceExecutionSummary ||
                          'Ejecución activa'}
                      </span>
                      ). El archivo físico{' '}
                      <span className="font-mono font-semibold">
                        {compiledResult.fileName}
                      </span>{' '}
                      está listo para descargarse y publicarse.
                    </p>
                  </div>
                ) : (
                  <div className="p-3.5 rounded bg-blue-50 border border-blue-200 text-xs text-blue-950 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-[#1E4E8C] shrink-0" />
                      Configuración y esquema {selectedOutputType.family} válidos (Sin binario en navegador)
                    </div>
                    <p>
                      Los {draft.fields.length} campos y el esquema {selectedOutputType.family} superaron todas las validaciones. En esta versión web no se genera el archivo binario descargable{' '}
                      <span className="font-mono font-semibold">
                        {compiledResult.fileName}
                      </span>
                      ; su serialización binaria se realiza en el servidor de reportes.
                    </p>
                  </div>
                )
              ) : structuralBlockingCount === 0 && !compiledResult.isRealExecutableGeneration ? (
                <div className="p-3.5 rounded bg-amber-50 border border-amber-300 text-xs text-amber-950 space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-800 shrink-0" />
                    Configuración estructural válida — Generación física en espera de lote compatible
                  </div>
                  <p>
                    La estructura de los {draft.fields.length} campos, longitudes y reglas de formato es técnicamente válida y se puede guardar como borrador. Sin embargo, no se genera ni descarga el archivo físico operativo{' '}
                    <span className="font-mono font-semibold">{compiledResult.fileName}</span> porque no hay un lote de datos compatible para la entidad{' '}
                    <strong>{globalEntity}</strong> y el periodo <strong>{globalPeriod}</strong> (Código CES-DAT-000).
                  </p>
                  <div>
                    <button
                      type="button"
                      onClick={() => setBuilderStep(3)}
                      className="px-2.5 py-1 rounded bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      Ir al Paso 3 para seleccionar informe con lote o cargar datos →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto">
                  {configDiagnostics.map((diag) => (
                    <div
                      key={diag.id}
                      className="p-3 rounded border border-rose-200 bg-rose-50/80 text-xs text-rose-950 space-y-1.5"
                    >
                      <div className="font-bold flex items-start justify-between gap-2">
                        <span>{diag.title}</span>
                        <span className="px-1.5 py-0.5 rounded bg-rose-200 text-rose-950 text-[10px] font-bold shrink-0">
                          {diag.severity}
                        </span>
                      </div>
                      <p className="text-rose-900">
                        <strong>Cómo corregirlo:</strong> {diag.howToFix}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (diag.fieldId) setSelectedFieldId(diag.fieldId);
                          setBuilderStep(diag.step);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-800 text-white text-[11px] font-semibold hover:bg-rose-900 cursor-pointer"
                      >
                        Ir al campo afectado (Paso {diag.step})
                      </button>
                    </div>
                  ))}

                  {compiledResult.findings
                    .filter((f) => f.layer !== 'Datos del formato (DAQUE)')
                    .map((f) => (
                      <div
                        key={f.id}
                        className={`p-3 rounded border text-xs space-y-1.5 ${
                          f.severity === 'Bloqueante'
                            ? 'border-rose-200 bg-rose-50 text-rose-950'
                            : 'border-amber-200 bg-amber-50 text-amber-950'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>
                            [{f.code}] {f.location}
                          </span>
                          <span className="text-[10px] font-bold">{f.severity}</span>
                        </div>
                        <p>{f.description}</p>
                        <p className="text-[11px]">
                          <strong>Cómo corregirlo:</strong> {f.suggestedAction}
                        </p>
                        {f.fieldTechnicalName && (
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => jumpToFieldByTechnicalName(f.fieldTechnicalName, 2)}
                              className="px-2.5 py-1 rounded bg-slate-800 text-white text-[11px] font-semibold hover:bg-slate-900 cursor-pointer"
                            >
                              Ir al campo en Paso 2
                            </button>
                            <button
                              type="button"
                              onClick={() => jumpToFieldByTechnicalName(f.fieldTechnicalName, 3)}
                              className="px-2.5 py-1 rounded border border-slate-400 bg-white text-slate-800 text-[11px] font-semibold hover:bg-slate-100 cursor-pointer"
                            >
                              Ir al mapeo en Paso 3
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}

              {/* Historical Runs Notice if modified */}
              {relatedRuns.length > 0 && (
                <div className="pt-2 border-t border-slate-200 space-y-1.5 text-[11px]">
                  <div className="font-bold text-slate-700">
                    Corridas registradas para esta salida ({relatedRuns.length})
                  </div>
                  {relatedRuns.slice(0, 2).map((r) => {
                    const isOutdated =
                      r.isPreloadedDemo ||
                      (r.configFingerprint && r.configFingerprint !== draft.fingerprint);
                    return (
                      <div
                        key={r.id}
                        className="p-2 rounded border border-slate-200 bg-slate-50 flex items-center justify-between gap-2"
                      >
                        <div>
                          <span className="font-mono font-bold text-slate-800">
                            {r.runCode}
                          </span>{' '}
                          · {r.createdAt}
                        </div>
                        {isOutdated ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold text-[10px]">
                            {r.isPreloadedDemo
                              ? 'Precargado de demostración'
                              : 'Ejecutado con configuración anterior'}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 font-semibold text-[10px]">
                            Configuración actual
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Physical File Output Preview */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-md p-4 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-2.5 gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <FileCode2
                      className={`w-4 h-4 ${
                        previewArtifactHeader.isPhysicalReady
                          ? 'text-[#1E4E8C]'
                          : 'text-amber-600'
                      }`}
                    />
                    {previewArtifactHeader.title}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {previewArtifactHeader.subtitle}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${previewArtifactHeader.badgeClass}`}
                  >
                    {previewArtifactHeader.badgeLabel}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {selectedOutputType.family} · {draft.composition.encoding}
                  </span>
                </div>
              </div>

              <pre className="p-3.5 rounded bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed max-h-80">
                {compiledResult.content}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* STEP 7: GUARDAR Y PUBLICAR */}
      {builderStep === 7 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Complete Configuration Summary & Publication Actions (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-md p-5 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Paso 7. Resumen de configuración y ciclo de vida de la versión
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Verifique el estado actual de la versión ({draft.status}) y ejecute la transición que corresponda según el flujo de gobierno.
              </p>
            </div>

            {/* 5-Stage Lifecycle Pipeline Explanation */}
            <div className="p-3 rounded border border-slate-200 bg-slate-50 text-xs space-y-2">
              <div className="font-bold text-slate-800 flex items-center justify-between">
                <span>Etapas del ciclo de vida de una salida configurada</span>
                <HelpTooltip
                  align="right"
                  title="Separación de etapas de gobierno"
                  description="1. Borrador: edición libre. 2. En revisión: validación funcional. 3. Aprobada: aval de gobierno e inmutabilidad. 4. Publicada: disponible en catálogo para asociar a formatos. 5. Asociada/Activada: vinculada a un formato y ambiente específico sin afectar a otros consumidores."
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[11px]">
                {(['Borrador', 'En revisión', 'Aprobada', 'Publicada'] as const).map(
                  (stage, i) => {
                    const isCurrent = draft.status === stage;
                    return (
                      <div
                        key={stage}
                        className={`p-2 rounded border text-center ${
                          isCurrent
                            ? 'bg-[#0F1F38] text-white border-[#0F1F38] font-bold'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        <div>
                          {i + 1}. {stage}
                        </div>
                        {isCurrent && (
                          <div className="text-[9px] text-amber-300 uppercase mt-0.5">
                            Estado actual
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
                <div
                  className={`p-2 rounded border text-center ${
                    linkedAssociations.some((a) => a.status === 'Activa')
                      ? 'bg-emerald-50 text-emerald-950 border-emerald-300 font-bold'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  <div>5. Asociada</div>
                  <div className="text-[9px] text-slate-500 mt-0.5">
                    {linkedAssociations.length} formato(s)
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded border border-slate-200 bg-slate-50">
                <div className="text-[11px] text-slate-500 font-semibold">
                  Salida y versión
                </div>
                <div className="font-bold text-slate-900 mt-0.5">
                  {draft.code} — {draft.name} (v{draft.version})
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Estado actual: <strong>{draft.status}</strong> · Vigencia: {draft.validFrom}
                </div>
              </div>

              <div className="p-3 rounded border border-slate-200 bg-slate-50">
                <div className="text-[11px] text-slate-500 font-semibold">
                  Tipo de archivo y codificación
                </div>
                <div className="font-bold text-slate-900 mt-0.5">
                  {selectedOutputType.family} — {selectedOutputType.name}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Codificación: {draft.composition.encoding} · Certificación: {selectedOutputType.supportStatus}
                </div>
              </div>

              <div className="p-3 rounded border border-slate-200 bg-slate-50">
                <div className="text-[11px] text-slate-500 font-semibold">
                  Estructura y origen de datos
                </div>
                <div className="font-bold text-slate-900 mt-0.5">
                  {draft.fields.length} campos configurados · {draft.validationRules.filter((r) => r.enabled).length} reglas activas
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Contrato: {selectedDataContract.code} ({selectedDataContract.name})
                </div>
              </div>

              <div className="p-3 rounded border border-slate-200 bg-slate-50">
                <div className="text-[11px] text-slate-500 font-semibold">
                  Nombre de archivo principal resuelto
                </div>
                <div className="font-mono font-bold text-[#1E4E8C] mt-0.5 truncate">
                  {compiledResult.fileName}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Empaquetado: {draft.composition.packaging} ({draft.composition.packageMembers.length} archivo(s))
                </div>
              </div>
            </div>

            {/* State-aware Status Banner */}
            {draft.status === 'Publicada' ? (
              <div className="p-3.5 rounded bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">
                    Esta versión (v{draft.version}) ya se encuentra PUBLICADA y vigente
                  </div>
                  <p className="mt-0.5">
                    La versión v{draft.version} está protegida contra cambios directos y lista para vincularse a formatos regulatorios. Si requiere realizar modificaciones, pulse <strong>&quot;Crear nueva revisión en borrador&quot;</strong>.
                  </p>
                </div>
              </div>
            ) : blockingIssuesCount > 0 ? (
              <div className="p-3.5 rounded bg-rose-50 border border-rose-200 text-xs text-rose-950 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">
                    No es posible aprobar ni publicar la versión mientras existan {blockingIssuesCount} error(es) bloqueante(s)
                  </div>
                  <p className="mt-0.5">
                    Puede guardar su avance como Borrador y regresar al Paso 2, Paso 3 o Paso 4 para corregir los puntos pendientes.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded bg-blue-50 border border-blue-200 text-xs text-blue-950 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#1E4E8C] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">
                    Configuración verificada sin bloqueos (Estado actual: {draft.status})
                  </div>
                  <p className="mt-0.5">
                    La salida cumple todas las validaciones estructurales y está lista para avanzar en su flujo de publicación.
                  </p>
                </div>
              </div>
            )}

            {/* Lifecycle Action Buttons */}
            <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2.5">
              {!isImmutable ? (
                <>
                  <button
                    type="button"
                    onClick={handleManualSave}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 text-xs font-bold cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Guardar borrador
                  </button>

                  {draft.status === 'Borrador' && (
                    <button
                      type="button"
                      onClick={() => {
                        saveConfiguredOutput(draft, true);
                        transitionOutputStatus(
                          draft.id,
                          'En revisión',
                          'Enviada a revisión funcional desde el Paso 7 del diseñador.'
                        );
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded border border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 text-xs font-bold cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Enviar a revisión
                    </button>
                  )}

                  {draft.status === 'En revisión' && (
                    <button
                      type="button"
                      disabled={blockingIssuesCount > 0}
                      onClick={() => {
                        saveConfiguredOutput(draft, true);
                        transitionOutputStatus(
                          draft.id,
                          'Aprobada',
                          'Versión aprobada técnicamente desde el Paso 7 del diseñador.'
                        );
                      }}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold ${
                        blockingIssuesCount > 0
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-blue-700 text-white hover:bg-blue-800 cursor-pointer'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Aprobar versión v{draft.version}
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={blockingIssuesCount > 0}
                    onClick={() => setShowPublishConfirmModal(true)}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded text-xs font-bold ${
                      blockingIssuesCount > 0
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-emerald-700 text-white hover:bg-emerald-800 cursor-pointer'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Publicar versión v{draft.version}
                  </button>
                </>
              ) : (
                <>
                  {draft.status === 'Aprobada' && (
                    <button
                      type="button"
                      disabled={blockingIssuesCount > 0}
                      onClick={() => setShowPublishConfirmModal(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-emerald-700 text-white hover:bg-emerald-800 text-xs font-bold cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Publicar versión aprobada v{draft.version}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowRevisionModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#1E4E8C] text-white text-xs font-bold hover:bg-[#163A69] cursor-pointer"
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    Crear nueva revisión en borrador
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => openAssociationForOutput(draft.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-blue-300 bg-blue-50 text-[#1E4E8C] hover:bg-blue-100 text-xs font-semibold cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
                Asociar a un formato regulatorio
              </button>
            </div>
          </div>

          {/* Right: Associated Formats & Version History (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-slate-200 rounded-md p-4 space-y-3 text-xs">
              <h3 className="text-sm font-bold text-slate-900">
                Formatos regulatorios que utilizan esta salida ({linkedAssociations.length})
              </h3>
              {linkedAssociations.length === 0 ? (
                <p className="text-slate-500">
                  Esta salida aún no está asociada a ningún formato regulatorio. Use el botón &quot;Asociar a un formato regulatorio&quot; para vincularla en la pantalla D.
                </p>
              ) : (
                <div className="space-y-2">
                  {linkedAssociations.map((a) => {
                    const fmt = regulatoryFormats.find((f) => f.id === a.formatId);
                    return (
                      <div
                        key={a.id}
                        className="p-2.5 rounded border border-slate-200 bg-slate-50 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-slate-900">
                            {fmt?.code} — {fmt?.name}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Modalidad: {a.modality} · Ambiente: {a.environment} · Estado:{' '}
                            <strong>{a.status}</strong>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-[#1E4E8C] font-mono font-bold">
                          v{a.configuredOutputVersion}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-md p-4 space-y-2.5 text-xs">
              <h3 className="text-sm font-bold text-slate-900">
                Historial de versiones de {draft.code}
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {draft.versionHistory.map((vh, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded border border-slate-200 bg-slate-50 text-[11px]"
                  >
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span className="font-mono">
                        v{vh.version} · {vh.status}
                      </span>
                      <span className="font-mono text-slate-500">{vh.createdAt}</span>
                    </div>
                    <div className="text-slate-600 mt-0.5">{vh.justification}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Step Navigation Footer */}
      <div className="bg-white border border-slate-200 rounded-md p-3.5 flex items-center justify-between">
        <button
          type="button"
          disabled={builderStep <= 1}
          onClick={() => setBuilderStep(Math.max(1, builderStep - 1))}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 text-xs font-semibold disabled:opacity-40 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Paso anterior
        </button>

        <div className="text-xs text-slate-500 font-medium">
          Paso <strong>{builderStep}</strong> de <strong>7</strong> ·{' '}
          {isImmutable
            ? `Modo consulta (versión ${draft.status} protegida)`
            : `Autoguardado activo en navegador (${lastSavedAt})`}
        </div>

        <button
          type="button"
          disabled={builderStep >= 7}
          onClick={() => setBuilderStep(Math.min(7, builderStep + 1))}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#1E4E8C] text-white hover:bg-[#163A69] text-xs font-bold disabled:opacity-40 cursor-pointer"
        >
          Siguiente paso
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Modal: Create Editable Revision from Published Output */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-md shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-4 py-3 bg-[#0F1F38] text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">
                Crear nueva revisión editable de {draft.code}
              </h3>
              <button
                type="button"
                onClick={() => setShowRevisionModal(false)}
                className="text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                Cerrar
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-600">
                La versión actual <strong>v{draft.version}</strong> seguirá activa para los formatos asociados. Se creará una nueva versión en estado <strong>Borrador</strong> lista para editar.
              </p>
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Justificación del cambio *
                </label>
                <textarea
                  rows={3}
                  value={revisionReason}
                  onChange={(e) => setRevisionReason(e.target.value)}
                  className="w-full border border-slate-300 rounded p-2 text-slate-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowRevisionModal(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    createNewRevisionFromOutput(draft.id, revisionReason);
                    setShowRevisionModal(false);
                  }}
                  className="px-3.5 py-1.5 rounded bg-[#1E4E8C] text-white font-semibold hover:bg-[#163A69] cursor-pointer"
                >
                  Crear revisión y editar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Publication */}
      {showPublishConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-md shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-4 py-3 bg-emerald-900 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">
                Confirmar publicación de {draft.code} (v{draft.version})
              </h3>
              <button
                type="button"
                onClick={() => setShowPublishConfirmModal(false)}
                className="text-xs text-emerald-200 hover:text-white cursor-pointer"
              >
                Cerrar
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-700">
                Al publicar la versión <strong>v{draft.version}</strong>, su estructura quedará protegida contra cambios directos y podrá asociarse y activarse en los formatos regulatorios.
              </p>
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Comentario de publicación *
                </label>
                <textarea
                  rows={2}
                  value={publishJustification}
                  onChange={(e) => setPublishJustification(e.target.value)}
                  className="w-full border border-slate-300 rounded p-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowPublishConfirmModal(false)}
                  className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    saveConfiguredOutput(draft, true);
                    transitionOutputStatus(draft.id, 'Publicada', publishJustification);
                    setShowPublishConfirmModal(false);
                  }}
                  className="px-3.5 py-1.5 rounded bg-emerald-700 text-white font-semibold hover:bg-emerald-800 cursor-pointer"
                >
                  Confirmar y publicar versión
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ASISTENCIA CONTEXTUAL TOTALiA® */}
      <TotaliaBuilderAssistantModal
        isOpen={showTotaliaModal}
        onClose={() => setShowTotaliaModal(false)}
        initialAction={totaliaModalAction}
        draft={draft}
        selectedOutputType={selectedOutputType}
        selectedDataContract={selectedDataContract}
        allDataContracts={dataContracts}
        associations={associations}
        regulatoryFormats={regulatoryFormats}
        normativeSources={normativeSources}
        configuredOutputs={configuredOutputs}
        isImmutable={isImmutable}
        globalPeriod={globalPeriod}
        globalEntity={globalEntity}
        configDiagnostics={configDiagnostics}
        onApplyFieldPatch={handleUpdateField}
        onApplyFullFieldsUpdate={(newFields) =>
          updateDraft((p) => ({ ...p, fields: newFields }))
        }
        onRequestCreateRevision={() => setShowRevisionModal(true)}
        onGoToStep={(s) => setBuilderStep(s)}
        notify={notify}
      />
    </div>
  );
};
