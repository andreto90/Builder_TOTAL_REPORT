import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileCheck2,
  FileCode2,
  GitBranch,
  Link2,
  Lock,
  Plus,
  Save,
  Send,
  ShieldAlert,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useConfigurator } from '../context/ConfiguratorContext';
import { generateOutputArtifact } from '../domain/engine';
import {
  ConfiguredOutput,
  EmptyDatasetPolicy,
  OutputValidationRule,
  PackageMemberRole,
  StructureField,
  TransformationKind,
} from '../domain/types';

const WIZARD_STEPS = [
  { step: 1, title: 'Paso 1. Datos generales', subtitle: 'Identificación y tipo de archivo' },
  { step: 2, title: 'Paso 2. Estructura del archivo', subtitle: 'Campos, propiedades y vista previa' },
  { step: 3, title: 'Paso 3. Origen de información', subtitle: 'Mapeo de datos y transformaciones' },
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
    deliveryChannels,
    regulatoryFormats,
    associations,
    daqueProfiles,
    globalEntity,
    globalPeriod,
    saveConfiguredOutput,
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

  // Sync local draft when selectedOutputId changes or when status transitions externally
  useEffect(() => {
    setDraft(currentStoredOutput);
    if (
      currentStoredOutput.fields.length > 0 &&
      !currentStoredOutput.fields.some((f) => f.id === selectedFieldId)
    ) {
      setSelectedFieldId(currentStoredOutput.fields[0].id);
    }
  }, [currentStoredOutput.id, currentStoredOutput.version, currentStoredOutput.status]);

  const isImmutable = draft.status === 'Publicada' || draft.status === 'Aprobada';

  // Helper that updates local draft AND auto-persists to context if editable (Scenario 6)
  const updateDraft = (updater: (prev: ConfiguredOutput) => ConfiguredOutput) => {
    setDraft((prev) => {
      const next = updater(prev);
      if (prev.status === 'Borrador' || prev.status === 'En revisión') {
        saveConfiguredOutput(next, true);
      }
      return next;
    });
  };

  const selectedOutputType = useMemo(
    () => outputTypes.find((t) => t.id === draft.outputTypeId) || outputTypes[0],
    [outputTypes, draft.outputTypeId]
  );

  const selectedDataContract = useMemo(
    () =>
      dataContracts.find((s) => s.id === draft.dataContractId) || dataContracts[0],
    [dataContracts, draft.dataContractId]
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

  // Real-time compilation, physical preview, and multi-layer validation
  const compiledResult = useMemo(() => {
    return generateOutputArtifact({
      output: draft,
      outputType: selectedOutputType,
      contract: selectedDataContract,
      daqueProfile: activeDaqueProfile,
      context: {
        entidad: globalEntity.replace(/\s+/g, '_'),
        formato: activeFormat?.code || draft.code,
        periodo: globalPeriod,
        version: draft.version,
        consecutivo: '01',
      },
    });
  }, [
    draft,
    selectedOutputType,
    selectedDataContract,
    activeDaqueProfile,
    globalEntity,
    activeFormat,
    globalPeriod,
  ]);

  // Additional structural diagnostics (unmapped required fields, invalid lengths, TXT overlaps)
  const configDiagnostics = useMemo(() => {
    const issues: {
      id: string;
      severity: 'Bloqueante' | 'Advertencia';
      step: number;
      fieldId?: string;
      title: string;
      howToFix: string;
    }[] = [];

    if (!draft.name.trim() || !draft.code.trim()) {
      issues.push({
        id: 'DIAG-GEN-01',
        severity: 'Bloqueante',
        step: 1,
        title: 'Nombre o código de la salida vacío',
        howToFix: 'En el Paso 1 (Datos generales), complete el nombre y el código identificador.',
      });
    }

    if (draft.fields.length === 0) {
      issues.push({
        id: 'DIAG-STR-00',
        severity: 'Bloqueante',
        step: 2,
        title: 'La salida no tiene campos definidos',
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
          title: `Longitud inválida (${f.length}) en el campo "${f.technicalName}"`,
          howToFix: `En el Paso 2, seleccione el campo "${f.technicalName}" y asigne una longitud mayor a 0.`,
        });
      }

      if (
        f.required &&
        !f.mapping.sourceField.trim() &&
        f.mapping.transformationKind !== 'Constante' &&
        !f.defaultValue.trim()
      ) {
        issues.push({
          id: `DIAG-MAP-${f.id}`,
          severity: 'Bloqueante',
          step: 3,
          fieldId: f.id,
          title: `Campo obligatorio "${f.technicalName}" sin origen de datos asignado`,
          howToFix: `En el Paso 3 (Origen de información), asigne una columna de origen o un valor constante al campo "${f.technicalName}".`,
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
            title: `Solapamiento de posiciones entre "${cur.technicalName}" (termina en ${curEnd}) y "${next.technicalName}" (inicia en ${next.startPosition || 1})`,
            howToFix:
              'En el Paso 2, pulse "Recalcular posiciones TXT" para ordenar los segmentos secuencialmente sin cruces.',
          });
        }
      }
    }

    return issues;
  }, [draft, selectedOutputType.family]);

  const blockingIssuesCount =
    configDiagnostics.filter((d) => d.severity === 'Bloqueante').length +
    compiledResult.findings.filter(
      (f) => f.severity === 'Bloqueante' && f.layer !== 'Datos del formato (DAQUE)'
    ).length;

  const isPhysicalEngineSupported = selectedOutputType.canGenerateRealFileInBrowser;

  const selectedField = useMemo(
    () => draft.fields.find((f) => f.id === selectedFieldId) || draft.fields[0] || null,
    [draft.fields, selectedFieldId]
  );

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
        updatedAt: '2026-11-09',
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
        f.id === fieldId ? { ...f, mapping: { ...f.mapping, ...mappingPatch } } : f
      ),
      updatedAt: '2026-11-09',
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
    const defaultSourceCol =
      selectedDataContract.fields[nextOrder % selectedDataContract.fields.length]?.name ||
      'id_obligacion';

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
      lengthUnit: 'Caracteres',
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
        sourceField: defaultSourceCol,
        expression: defaultSourceCol,
        isParameterizedPoint: false,
        emptyTreatment: 'Error bloqueante',
      },
    };

    updateDraft((prev) => ({
      ...prev,
      fields: [...prev.fields, newField],
    }));
    setSelectedFieldId(newField.id);
    notify('info', `Campo "${newField.technicalName}" agregado a la estructura.`);
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

  const handleAutoMapFields = () => {
    if (isImmutable) return;
    updateDraft((prev) => {
      const sourceCols = selectedDataContract.fields;
      const mapped = prev.fields.map((f) => {
        if (f.mapping.sourceField && f.mapping.sourceField.trim() !== '') return f;
        const match =
          sourceCols.find((sc) => sc.name === f.technicalName) ||
          sourceCols.find((sc) =>
            f.technicalName.toLowerCase().includes(sc.name.split('_')[0])
          ) ||
          sourceCols[0];
        return {
          ...f,
          mapping: {
            ...f.mapping,
            sourceContractId: selectedDataContract.id,
            sourceField: match?.name || 'id_obligacion',
            expression: match?.name || 'id_obligacion',
          },
        };
      });
      return { ...prev, fields: mapped };
    });
    notify('success', 'Orígenes de datos asignados automáticamente según el contrato de datos.');
  };

  const handleDownloadPreviewArtifact = () => {
    if (!isPhysicalEngineSupported) return;
    if (blockingIssuesCount > 0) {
      notify(
        'error',
        'Corrija los errores bloqueantes de estructura o mapeo antes de descargar el archivo de prueba.'
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
      `Archivo de prueba "${compiledResult.fileName}" generado y descargado correctamente.`
    );
  };

  const handleManualSave = () => {
    saveConfiguredOutput(draft, false);
  };

  return (
    <div className="space-y-4">
      {/* Top Bar: Output Selector, Status, and Save Action */}
      <div className="bg-white border border-slate-200 rounded-md p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E4E8C] block">
              C. Diseñador de salidas · Asistente Guiado en 7 Pasos
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
                    : draft.status === 'En revisión'
                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                    : 'bg-blue-50 text-blue-900 border-blue-300'
                }`}
              >
                Estado: {draft.status} (v{draft.version})
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isImmutable ? (
            <button
              type="button"
              onClick={() => setShowRevisionModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors cursor-pointer"
            >
              <GitBranch className="w-4 h-4" />
              Crear nueva revisión para editar
            </button>
          ) : (
            <button
              type="button"
              onClick={handleManualSave}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-xs font-bold bg-[#1E4E8C] text-white hover:bg-[#163A69] transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar cambios
            </button>
          )}
        </div>
      </div>

      {/* Immutability Warning Banner when viewing a Published/Approved output (Scenario 4) */}
      {isImmutable && (
        <div className="bg-amber-50 border border-amber-300 rounded-md p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">
                Esta versión (v{draft.version}) está {draft.status} y protegida contra edición directa
              </div>
              <p className="mt-0.5 text-amber-900">
                {linkedAssociations.length > 0
                  ? `Actualmente está asociada a ${linkedAssociations.length} formato(s) regulatorio(s) (${linkedAssociations
                      .map((a) => regulatoryFormats.find((f) => f.id === a.formatId)?.code || a.code)
                      .join(', ')}). Para realizar cambios sin afectar las entregas vigentes, cree una nueva revisión en borrador.`
                  : 'Las versiones publicadas no se modifican directamente para preservar la trazabilidad histórica.'}
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
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-rose-600 text-white">
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

      {/* STEP 1: DATOS GENERALES */}
      {builderStep === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-md p-5 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Paso 1. Datos generales de la salida
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Defina la identificación de la salida, la entidad reguladora y el tipo de archivo técnico que utilizará.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-800 mb-1">
                  Nombre de la salida *
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
                </label>
                <select
                  aria-label="Tipo de archivo de la salida"
                  disabled={isImmutable}
                  value={draft.outputTypeId}
                  onChange={(e) => {
                    const nextType = outputTypes.find((t) => t.id === e.target.value);
                    if (!nextType) return;
                    updateDraft((p) => ({
                      ...p,
                      outputTypeId: nextType.id,
                      composition: {
                        ...p.composition,
                        extension: nextType.extension.replace('.', ''),
                        delimiter:
                          nextType.family === 'CSV'
                            ? ';'
                            : nextType.family === 'TXT'
                            ? 'Ancho fijo'
                            : 'N/A',
                      },
                    }));
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
                  Entidad reguladora *
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
                  Vigencia desde
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
                  Descripción funcional
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

          {/* Right Panel in Step 1: Specific Format Parameters for Selected File Type */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-md p-5 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E4E8C]">
                Parámetros del archivo ({selectedOutputType.family})
              </span>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                Características generales de representación
              </h3>
            </div>

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
                  <option value="UTF-8 con BOM">UTF-8 con BOM</option>
                  <option value="ISO-8859-1">ISO-8859-1 (Latin-1)</option>
                  <option value="Binario">Binario</option>
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
                  <option value=",">Coma (,)</option>
                  <option value=".">Punto (.)</option>
                </select>
              </div>

              {selectedOutputType.family === 'CSV' && (
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Separador de columnas (CSV)
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
                    <option value="&#9;">Tabulador (TAB)</option>
                  </select>
                </div>
              )}

              <div className="sm:col-span-2 flex flex-wrap gap-4 pt-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
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
                  <span>Incluir fila/registro de encabezado</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
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
                  <span>Incluir registro final de control / totales</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: ESTRUCTURA DEL ARCHIVO (Simultaneous Table + Property Editor + Live Preview) */}
      {builderStep === 2 && (
        <div className="space-y-4">
          {/* Family-Specific Visual Structure Representation Banner (TXT positional ruler / XML tree) */}
          {selectedOutputType.family === 'TXT' && (
            <div className="bg-white border border-slate-200 rounded-md p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E4E8C]">
                    Mapa visual de posiciones de ancho fijo (TXT)
                  </span>
                  <h3 className="text-xs font-bold text-slate-900">
                    Longitud total acumulada del registro:{' '}
                    <span className="font-mono">
                      {draft.fields.reduce((acc, f) => acc + Math.max(0, f.length), 0)}
                    </span>{' '}
                    caracteres
                  </h3>
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
                        [{curStart}..{curEnd}] ({f.length} car.)
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
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#1E4E8C]">
                Estructura jerárquica de nodos XML
              </div>
              <div className="p-3 rounded bg-slate-50 border border-slate-200 font-mono text-xs space-y-1 text-slate-800">
                <div className="font-bold text-[#0F1F38]">
                  &lt;{selectedOutputType.xmlParams?.rootElement || 'ReporteRegulatorio'}&gt;
                </div>
                <div className="pl-4 text-slate-600">
                  &lt;Encabezado&gt;CodigoEntidad, CodigoFormato, PeriodoCorte&lt;/Encabezado&gt;
                </div>
                <div className="pl-4 font-bold text-[#1E4E8C]">
                  &lt;DetalleRegistros&gt; &rarr; &lt;Registro&gt;
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
                        {isAttr ? `@${f.technicalName} (Atributo)` : `<${f.technicalName}>`} ·{' '}
                        {f.required ? 'Obligatorio' : 'Opcional'}
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
                    Agregue, reordene, duplique o edite directamente los campos de la estructura.
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
                      <th className="py-2 px-2.5">Nombre Técnico / Etiqueta</th>
                      <th className="py-2 px-2">Tipo de Dato</th>
                      <th className="py-2 px-2">Longitud</th>
                      <th className="py-2 px-2">Oblig.</th>
                      <th className="py-2 px-2">Origen</th>
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
                            {f.mapping.sourceField ? (
                              <span className="text-slate-700">{f.mapping.sourceField}</span>
                            ) : (
                              <span className="text-rose-700 font-bold">Sin origen</span>
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
                        Propiedades del campo #{selectedField.order}
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
                        Tipo de dato *
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

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Longitud *
                        </label>
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
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Decimales
                        </label>
                        <input
                          type="number"
                          disabled={isImmutable || selectedField.dataType !== 'Decimal'}
                          value={selectedField.scale ?? 0}
                          onChange={(e) =>
                            handleUpdateField(selectedField.id, {
                              scale: Number(e.target.value),
                            })
                          }
                          className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono disabled:bg-slate-100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Formato o máscara
                      </label>
                      <input
                        type="text"
                        disabled={isImmutable}
                        placeholder="Ej. dd-MM-yyyy o 0.00"
                        value={selectedField.formatMask || ''}
                        onChange={(e) =>
                          handleUpdateField(selectedField.id, {
                            formatMask: e.target.value,
                          })
                        }
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Valor por defecto (si vacío)
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
                        Alineación
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
                        <option value="Izquierda">Izquierda</option>
                        <option value="Derecha">Derecha</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Carácter de relleno (Padding)
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
                        <option value="0">Ceros (0)</option>
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
                      <div className="sm:col-span-2">
                        <label className="block font-semibold text-slate-700 mb-1">
                          Representación en nodo XML
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
                          <option value="Atributo">Atributo del registro (@campo)</option>
                        </select>
                      </div>
                    )}

                    <div className="sm:col-span-2 pt-1">
                      <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                        <input
                          type="checkbox"
                          disabled={isImmutable}
                          checked={selectedField.required}
                          onChange={(e) =>
                            handleUpdateField(selectedField.id, {
                              required: e.target.checked,
                            })
                          }
                        />
                        <span>Campo obligatorio en el archivo de salida</span>
                      </label>
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
                  Vista previa en vivo ({compiledResult.fileName})
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">
                Se actualiza automáticamente al agregar, reordenar o modificar campos
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

      {/* STEP 3: ORIGEN DE INFORMACIÓN (Data Mapping & Declarative Transformations) */}
      {builderStep === 3 && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-md p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Paso 3. Origen de información y correspondencia de campos
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Seleccione la fuente de datos funcional y asigne qué columna o transformación alimenta cada campo de la salida.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-700">Origen de datos:</span>
                <select
                  aria-label="Seleccionar fuente de datos"
                  disabled={isImmutable}
                  value={draft.dataContractId}
                  onChange={(e) =>
                    updateDraft((p) => ({ ...p, dataContractId: e.target.value }))
                  }
                  className="border border-slate-300 rounded px-2.5 py-1.5 bg-white font-semibold text-slate-900"
                >
                  {dataContracts.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.code} — {sc.name}
                    </option>
                  ))}
                </select>
              </div>

              {!isImmutable && (
                <button
                  type="button"
                  onClick={handleAutoMapFields}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-50 border border-blue-300 text-[#1E4E8C] hover:bg-blue-100 text-xs font-semibold cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  Asignar orígenes automáticamente
                </button>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                    <th className="py-2.5 px-3">Campo de la Salida</th>
                    <th className="py-2.5 px-3">Obligatorio</th>
                    <th className="py-2.5 px-3">Campo en el Origen ({selectedDataContract.code})</th>
                    <th className="py-2.5 px-3">Tipo de Transformación</th>
                    <th className="py-2.5 px-3">Regla / Expresión de Transformación</th>
                    <th className="py-2.5 px-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {draft.fields.map((f) => {
                    const isUnmappedRequired =
                      f.required &&
                      !f.mapping.sourceField.trim() &&
                      f.mapping.transformationKind !== 'Constante' &&
                      !f.defaultValue.trim();

                    return (
                      <tr
                        key={f.id}
                        className={isUnmappedRequired ? 'bg-rose-50/70' : 'hover:bg-slate-50'}
                      >
                        <td className="py-2.5 px-3">
                          <div className="font-mono font-bold text-slate-900">
                            {f.technicalName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {f.label} ({f.dataType}, long. {f.length})
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          {f.required ? (
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-[#1E4E8C] font-semibold text-[11px]">
                              Obligatorio
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Opcional</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3">
                          <select
                            aria-label={`Columna origen para ${f.technicalName}`}
                            disabled={isImmutable}
                            value={f.mapping.sourceField}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleUpdateFieldMapping(f.id, {
                                sourceField: val,
                                expression: val,
                              });
                            }}
                            className={`w-full border rounded px-2 py-1.5 font-mono text-xs ${
                              isUnmappedRequired
                                ? 'border-rose-400 bg-white text-rose-900 font-bold'
                                : 'border-slate-300 bg-white text-slate-900'
                            }`}
                          >
                            <option value="">-- Sin asignar (Vacío) --</option>
                            {selectedDataContract.fields.map((scField) => (
                              <option key={scField.name} value={scField.name}>
                                {scField.name} ({scField.dataType}) — Ej:{' '}
                                {String(scField.sampleValues[0] ?? '')}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-2.5 px-3">
                          <select
                            aria-label={`Transformación para ${f.technicalName}`}
                            disabled={isImmutable}
                            value={f.mapping.transformationKind}
                            onChange={(e) =>
                              handleUpdateFieldMapping(f.id, {
                                transformationKind: e.target.value as TransformationKind,
                              })
                            }
                            className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800"
                          >
                            <option value="Directo">Directo</option>
                            <option value="Máscara fecha/número">Máscara fecha/número</option>
                            <option value="Concatenación tipada">Concatenación tipada</option>
                            <option value="Constante">Valor constante</option>
                            <option value="Variable de contexto">Variable de contexto</option>
                            <option value="Expresión declarativa">Expresión declarativa</option>
                          </select>
                        </td>

                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            aria-label={`Expresión de transformación para ${f.technicalName}`}
                            disabled={isImmutable}
                            value={f.mapping.expression}
                            onChange={(e) =>
                              handleUpdateFieldMapping(f.id, {
                                expression: e.target.value,
                              })
                            }
                            placeholder="Ej. TRIM(nombre_cliente)"
                            className="w-full border border-slate-300 rounded px-2 py-1.5 font-mono text-xs bg-white"
                          />
                        </td>

                        <td className="py-2.5 px-3">
                          {isUnmappedRequired ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-900 font-semibold text-[11px]">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                              Falta origen
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                              Asignado
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: VALIDACIONES */}
      {builderStep === 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Output Validation Rules (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-md p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Paso 4. Reglas de validación de la salida ({draft.validationRules.length})
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Configure las validaciones propias de la estructura y generación del archivo.
                </p>
              </div>
              {!isImmutable && (
                <button
                  type="button"
                  onClick={() => {
                    const nextNum = draft.validationRules.length + 1;
                    const newRule: OutputValidationRule = {
                      id: `VR-${Date.now()}`,
                      code: `VAL-SAL-0${nextNum}`,
                      name: `Control de consistencia de salida #${nextNum}`,
                      layer: 'Representación y archivo',
                      targetFieldOrRole: 'Archivo principal',
                      conditionExpression: 'RECORD_COUNT > 0 AND VALIDATE_FIELD_TYPES()',
                      severity: 'Bloqueante',
                      isNormativeProtected: false,
                      owner: 'Política de salida y entrega',
                      diagnosticMessage:
                        'El archivo no supera la validación estructural configurada.',
                      enabled: true,
                    };
                    updateDraft((p) => ({
                      ...p,
                      validationRules: [...p.validationRules, newRule],
                    }));
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1E4E8C] text-white text-xs font-semibold hover:bg-[#163A69] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar validación
                </button>
              )}
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
                        Condición / Expresión declarativa
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

          {/* Right: Automatic Built-in Structural Checks + Format DAQUE Separation (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-slate-200 rounded-md p-4 space-y-2.5 text-xs">
              <h3 className="text-sm font-bold text-slate-900">
                Controles automáticos de estructura aplicados por el motor
              </h3>
              <ul className="space-y-2 text-slate-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>Obligatoriedad y nulos:</strong> Verifica que todo campo marcado como obligatorio tenga origen asignado y valor presente.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>Longitudes sin truncamiento silencioso:</strong> Si un dato supera la longitud del campo, la validación bloquea la generación e informa la columna exacta.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    <strong>Consistencia posicional (TXT):</strong> Verifica que no existan posiciones superpuestas ni huecos involuntarios.
                  </span>
                </li>
              </ul>
            </div>

            <div className="bg-indigo-50/70 border border-indigo-200 rounded-md p-4 space-y-2 text-xs text-indigo-950">
              <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-900">
                Separación de reglas de datos del formato (DAQUE)
              </div>
              <p>
                Las reglas de negocio propias de cada formato regulatorio (por ejemplo, si se permiten saldos en cero en un reporte mensual vs. trimestral) se administran en el perfil DAQUE de cada formato y <strong>no contaminan la estructura de esta salida</strong>, permitiendo reutilizarla en varios formatos.
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
                Configure cómo se nombra el archivo generado, si conforma un paquete y por qué canal se distribuye.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Patrón de nombre dinámico del archivo *
              </label>
              <input
                type="text"
                disabled={isImmutable}
                value={draft.composition.fileNamePattern}
                onChange={(e) =>
                  updateDraft((p) => ({
                    ...p,
                    composition: { ...p.composition, fileNamePattern: e.target.value },
                  }))
                }
                className="w-full border border-slate-300 rounded px-3 py-2 font-mono text-slate-900"
              />

              {!isImmutable && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-slate-500">Insertar variable:</span>
                  {['{entidad}', '{formato}', '{periodo}', '{version}', '{consecutivo}'].map(
                    (token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() =>
                          updateDraft((p) => ({
                            ...p,
                            composition: {
                              ...p.composition,
                              fileNamePattern: `${p.composition.fileNamePattern}_${token}`,
                            },
                          }))
                        }
                        className="px-2 py-0.5 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 font-mono text-[11px] text-[#1E4E8C] cursor-pointer"
                      >
                        + {token}
                      </button>
                    )
                  )}
                </div>
              )}

              <div className="mt-2 p-2.5 rounded bg-blue-50 border border-blue-200 text-[#1E4E8C] font-mono text-xs">
                Ejemplo de nombre resultante: <strong>{compiledResult.fileName}</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Empaquetado del archivo
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
                  Canal de entrega predeterminado
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

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-800 mb-1">
                  Comportamiento cuando no existan operaciones en el periodo
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

          {/* Right: Package Files Composition */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-md p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Archivos que integran la entrega ({draft.composition.packageMembers.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Roles de archivo definidos para esta salida configurada.
                </p>
              </div>
              {!isImmutable && (
                <button
                  type="button"
                  onClick={() => {
                    const newMember: PackageMemberRole = {
                      id: `PKG-${Date.now()}`,
                      role: 'Control / Resumen',
                      cardinality: '0..1 (Opcional)',
                      outputDefinitionId: draft.code,
                      outputVersion: draft.version,
                      fileNamePattern: `{entidad}_${draft.code}_{periodo}_RESUMEN.txt`,
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
                  className="px-2.5 py-1 rounded border border-blue-300 bg-blue-50 text-[#1E4E8C] font-semibold hover:bg-blue-100 cursor-pointer"
                >
                  + Agregar archivo al paquete
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {draft.composition.packageMembers.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded border border-slate-200 bg-slate-50 space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{m.role}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono text-[10px] font-bold">
                      {m.cardinality}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-[#1E4E8C]">
                    {m.fileNamePattern}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* STEP 6: PRUEBAS (Validation Diagnostics, Preview & Real File Download) */}
      {builderStep === 6 && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-md p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Paso 6. Pruebas de configuración, validación y generación de archivo
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Verifique que la estructura, las longitudes y los orígenes de datos estén completos antes de generar el archivo de prueba o publicar la versión.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {isPhysicalEngineSupported ? (
                <button
                  type="button"
                  disabled={blockingIssuesCount > 0}
                  onClick={handleDownloadPreviewArtifact}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded text-xs font-bold transition-colors ${
                    blockingIssuesCount > 0
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      : 'bg-[#1E4E8C] text-white hover:bg-[#163A69] cursor-pointer shadow-xs'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  Generar y descargar archivo de prueba ({compiledResult.fileName})
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded text-xs font-semibold bg-slate-200 text-slate-600 cursor-not-allowed border border-slate-300"
                  title="En esta versión solo están habilitados los generadores físicos para CSV, TXT y XML"
                >
                  <Lock className="w-4 h-4 text-slate-500" />
                  Generación de archivo no disponible en esta versión ({selectedOutputType.family})
                </button>
              )}
            </div>
          </div>

          {/* Diagnostic Result Panel (Scenario 5: Detects errors and explains how to fix them) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-[#1E4E8C]" />
                  Diagnóstico de la configuración
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${
                    blockingIssuesCount === 0
                      ? 'bg-emerald-100 text-emerald-900'
                      : 'bg-rose-100 text-rose-900'
                  }`}
                >
                  {blockingIssuesCount === 0
                    ? 'Configuración válida'
                    : `${blockingIssuesCount} error(es) por corregir`}
                </span>
              </div>

              {configDiagnostics.length === 0 &&
              compiledResult.findings.filter(
                (f) => f.layer !== 'Datos del formato (DAQUE)'
              ).length === 0 ? (
                <div className="p-3.5 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    Todos los controles estructurales y de origen de datos fueron superados
                  </div>
                  <p>
                    Los {draft.fields.length} campos cuentan con longitud válida, tipos consistentes y origen de datos asignado. El archivo{' '}
                    <span className="font-mono font-semibold">
                      {compiledResult.fileName}
                    </span>{' '}
                    está listo para generarse y publicarse.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
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
                        Ir al Paso {diag.step} para corregir
                      </button>
                    </div>
                  ))}

                  {compiledResult.findings
                    .filter((f) => f.layer !== 'Datos del formato (DAQUE)')
                    .map((f) => (
                      <div
                        key={f.id}
                        className="p-3 rounded border border-amber-200 bg-amber-50 text-xs text-amber-950 space-y-1"
                      >
                        <div className="font-bold">
                          [{f.code}] {f.location}
                        </div>
                        <p>{f.description}</p>
                        <p className="text-[11px]">
                          <strong>Cómo corregirlo:</strong> {f.suggestedAction}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Right: Physical File Output Preview */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-md p-4 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <FileCode2 className="w-4 h-4 text-[#1E4E8C]" />
                    Resultado de generación con datos de prueba ({compiledResult.rowsProcessed} registros)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Archivo: <span className="font-mono">{compiledResult.fileName}</span>
                  </p>
                </div>
                <span className="font-mono text-[11px] text-slate-500">
                  {selectedOutputType.family} · {draft.composition.encoding}
                </span>
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
                Paso 7. Resumen de configuración y publicación de versión
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Revise el resumen completo de la salida configurada, guarde su avance en borrador o publique la versión para habilitarla en los formatos regulatorios.
              </p>
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
                  Codificación: {draft.composition.encoding}
                </div>
              </div>

              <div className="p-3 rounded border border-slate-200 bg-slate-50">
                <div className="text-[11px] text-slate-500 font-semibold">
                  Estructura y origen de datos
                </div>
                <div className="font-bold text-slate-900 mt-0.5">
                  {draft.fields.length} campos configurados · {draft.validationRules.length} reglas
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Fuente: {selectedDataContract.code} ({selectedDataContract.name})
                </div>
              </div>

              <div className="p-3 rounded border border-slate-200 bg-slate-50">
                <div className="text-[11px] text-slate-500 font-semibold">
                  Archivo resultante
                </div>
                <div className="font-mono font-bold text-[#1E4E8C] mt-0.5 truncate">
                  {compiledResult.fileName}
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Empaquetado: {draft.composition.packaging}
                </div>
              </div>
            </div>

            {/* Warnings / Validation Gate before publishing */}
            {blockingIssuesCount > 0 ? (
              <div className="p-3.5 rounded bg-rose-50 border border-rose-200 text-xs text-rose-950 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">
                    No es posible publicar la versión mientras existan {blockingIssuesCount} error(es) bloqueante(s)
                  </div>
                  <p className="mt-0.5">
                    Puede guardar su avance como Borrador y regresar al Paso 2 o Paso 3 para completar los campos pendientes.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">
                    Configuración completa y verificada sin errores
                  </div>
                  <p className="mt-0.5">
                    La salida cumple todas las validaciones estructurales y está lista para su aprobación o publicación.
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
                <button
                  type="button"
                  onClick={() => setShowRevisionModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#1E4E8C] text-white text-xs font-bold hover:bg-[#163A69] cursor-pointer"
                >
                  <GitBranch className="w-3.5 h-3.5" />
                  Crear nueva revisión en borrador
                </button>
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
                  Esta salida aún no está asociada a ningún formato regulatorio. Use el botón &quot;Asociar a un formato regulatorio&quot; para vincularla.
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
                            Modalidad: {a.modality} · Ambiente: {a.environment}
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
            ? 'Modo consulta (versión protegida)'
            : 'Los cambios se conservan automáticamente'}
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
    </div>
  );
};
