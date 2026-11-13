import React, { useState, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Database,
  ExternalLink,
  FileCode2,
  GitBranch,
  Layers,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import {
  ConfiguredOutput,
  DataContract,
  FormatOutputAssociation,
  NormativeSourceDoc,
  OutputType,
  RegulatoryFormat,
  StructureField,
  TotaliaSuggestion,
} from '../domain/types';
import {
  analyzeSourceStructureUpdateImpact,
  analyzeVersionImpact,
  proposeFieldMappings,
} from '../domain/engine';
import { HelpTooltip } from './HelpTooltip';
import { TotalReportLogo } from './TotalReportLogo';

export type TotaliaActionType =
  | 'ayudame_a_crear'
  | 'revisar_estructura'
  | 'sugerir_mapeos'
  | 'explicar_error'
  | 'siguiente_paso'
  | 'comparar_revision'
  | 'analizar_origen'
  | 'evaluar_impacto';

interface TotaliaBuilderAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAction?: TotaliaActionType;
  draft: ConfiguredOutput;
  selectedOutputType: OutputType;
  selectedDataContract: DataContract;
  allDataContracts: DataContract[];
  associations: FormatOutputAssociation[];
  regulatoryFormats: RegulatoryFormat[];
  normativeSources: NormativeSourceDoc[];
  configuredOutputs: ConfiguredOutput[];
  isImmutable: boolean;
  globalPeriod: string;
  globalEntity: string;
  configDiagnostics: Array<{
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
  }>;
  onApplyFieldPatch: (fieldId: string, patch: Partial<StructureField>) => void;
  onApplyFullFieldsUpdate: (fields: StructureField[]) => void;
  onRequestCreateRevision: () => void;
  onGoToStep: (step: number) => void;
  notify: (type: 'success' | 'warning' | 'error' | 'info', text: string) => void;
}

export const TotaliaBuilderAssistantModal: React.FC<TotaliaBuilderAssistantModalProps> = ({
  isOpen,
  onClose,
  initialAction = 'revisar_estructura',
  draft,
  selectedOutputType,
  selectedDataContract,
  allDataContracts,
  associations,
  regulatoryFormats,
  normativeSources,
  configuredOutputs,
  isImmutable,
  globalPeriod,
  globalEntity,
  configDiagnostics,
  onApplyFieldPatch,
  onApplyFullFieldsUpdate,
  onRequestCreateRevision,
  onGoToStep,
  notify,
}) => {
  const [activeTab, setActiveTab] = useState<TotaliaActionType>(initialAction);
  const [selectedErrorId, setSelectedErrorId] = useState<string | null>(null);

  // Sync activeTab when modal is reopened with an initialAction
  React.useEffect(() => {
    if (isOpen && initialAction) {
      setActiveTab(initialAction);
    }
  }, [isOpen, initialAction]);

  // Consumer formats associated to this output
  const linkedAssociations = useMemo(() => {
    return associations.filter((a) => a.configuredOutputId === draft.id && a.status === 'Activa');
  }, [associations, draft.id]);

  // Base output if this is a revision
  const baseOutput = useMemo(() => {
    if (draft.baseOutputId) {
      return configuredOutputs.find((o) => o.id === draft.baseOutputId) || null;
    }
    return null;
  }, [configuredOutputs, draft.baseOutputId]);

  // Version impact comparison
  const versionImpact = useMemo(() => {
    return analyzeVersionImpact({
      output: draft,
      previousFields: baseOutput ? baseOutput.fields : draft.fields,
      associations,
      formats: regulatoryFormats,
    });
  }, [draft, baseOutput, associations, regulatoryFormats]);

  // Source structure update impact
  const sourceStructureImpact = useMemo(() => {
    return analyzeSourceStructureUpdateImpact({
      fields: draft.fields,
      updatedContract: selectedDataContract,
    });
  }, [draft.fields, selectedDataContract]);

  // Field mapping proposals
  const mappingProposals = useMemo(() => {
    return proposeFieldMappings(
      draft.fields,
      selectedDataContract.fields,
      selectedDataContract.id
    );
  }, [draft.fields, selectedDataContract.fields, selectedDataContract.id]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="totalia-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-900 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-[#0F1F38] text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center p-1 shrink-0">
              <TotalReportLogo className="w-full h-full object-contain" alt="Logo TOTALiA® · TÓTAL REPORT®" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="totalia-modal-title" className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                  Asistencia Contextual TOTALiA®
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1E4E8C] text-blue-100">
                  Recomendaciones basadas en evidencia
                </span>
                {isImmutable && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Versión protegida
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300">
                Salida: <span className="font-mono font-semibold text-white">{draft.code}</span> (v{draft.version}) · Tipo: {selectedOutputType.family} · Periodo: {globalPeriod}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar asistente TOTALiA®"
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Tabs Bar */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center gap-1.5 overflow-x-auto text-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('siguiente_paso')}
            className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'siguiente_paso'
                ? 'bg-white text-[#1E4E8C] shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowRight className="w-3.5 h-3.5 text-indigo-600" />
            <span>Indicar siguiente paso</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('revisar_estructura')}
            className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'revisar_estructura'
                ? 'bg-white text-[#1E4E8C] shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-blue-600" />
            <span>Revisar mi estructura</span>
            {configDiagnostics.length > 0 && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-600 text-white font-mono">
                {configDiagnostics.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sugerir_mapeos')}
            className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'sugerir_mapeos'
                ? 'bg-white text-[#1E4E8C] shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sugerir correspondencias</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('explicar_error')}
            className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'explicar_error'
                ? 'bg-white text-[#1E4E8C] shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Explicar errores</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ayudame_a_crear')}
            className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'ayudame_a_crear'
                ? 'bg-white text-[#1E4E8C] shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Proponer campos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('evaluar_impacto')}
            className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'evaluar_impacto'
                ? 'bg-white text-[#1E4E8C] shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
            <span>Evaluar impacto</span>
          </button>

          {baseOutput && (
            <button
              type="button"
              onClick={() => setActiveTab('comparar_revision')}
              className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                activeTab === 'comparar_revision'
                  ? 'bg-white text-[#1E4E8C] shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
              <span>Comparar con base (v{baseOutput.version})</span>
            </button>
          )}

          {sourceStructureImpact.impactedCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('analizar_origen')}
              className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                activeTab === 'analizar_origen'
                  ? 'bg-white text-[#1E4E8C] shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5 text-rose-600" />
              <span>Cambios en origen ({sourceStructureImpact.impactedCount})</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Banner if output is Immutable */}
          {isImmutable && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">
                    La versión {draft.version} está {draft.status} y protegida contra edición directa
                  </div>
                  <p className="text-[11px] text-amber-900 mt-0.5">
                    Para aplicar recomendaciones de TOTALiA®, se debe crear una nueva revisión editable en estado <strong>Borrador</strong>. Esto salvaguarda las entregas regulatorias vigentes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequestCreateRevision();
                }}
                className="px-3 py-1.5 rounded bg-amber-900 text-white text-xs font-bold hover:bg-amber-950 shrink-0 cursor-pointer"
              >
                Crear nueva revisión
              </button>
            </div>
          )}

          {/* TAB 1: INDICAR EL SIGUIENTE PASO */}
          {activeTab === 'siguiente_paso' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-2">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                  <ArrowRight className="w-4 h-4 text-indigo-700" />
                  <span>Diagnóstico de Avance y Próxima Acción Recomendada</span>
                </div>
                <p className="text-slate-700 leading-relaxed">
                  TOTALiA® evalúa el estado del borrador frente a los requisitos técnicos de la familia{' '}
                  <strong>{selectedOutputType.family}</strong> y las asociaciones normativas registradas.
                </p>
              </div>

              {/* Step Recommendations Roadmap */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">1. Estructura y Campos</span>
                    {draft.fields.length > 0 && configDiagnostics.filter((d) => d.step === 2).length === 0 ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        ✓ {draft.fields.length} campos válidos
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                        {configDiagnostics.filter((d) => d.step === 2).length} detalle(s) pendientes
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    {draft.fields.length === 0
                      ? 'No hay campos definidos. Vaya al Paso 2 para crearlos o use "Proponer campos" en TOTALiA®.'
                      : `Definidos ${draft.fields.length} campos para ${selectedOutputType.family}.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onGoToStep(2);
                    }}
                    className="text-[#1E4E8C] hover:underline font-bold text-xs inline-flex items-center gap-1 cursor-pointer pt-1"
                  >
                    Ir al Paso 2 (Estructura) →
                  </button>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">2. Asignación de Origen</span>
                    {draft.fields.filter((f) => f.required && !f.mapping.sourceField && !f.defaultValue).length === 0 ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        ✓ Mapeos completos
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                        {draft.fields.filter((f) => f.required && !f.mapping.sourceField && !f.defaultValue).length} sin origen
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Fuente activa: <span className="font-semibold">{selectedDataContract.name}</span>.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onGoToStep(3);
                    }}
                    className="text-[#1E4E8C] hover:underline font-bold text-xs inline-flex items-center gap-1 cursor-pointer pt-1"
                  >
                    Ir al Paso 3 (Origen y Mapeo) →
                  </button>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">3. Lote y Generación Operativa</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      Corte: {globalPeriod}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    Diseñar y guardar borrador es posible en cualquier momento. Para la generación física se requiere un lote compatible en el Paso 3.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onGoToStep(6);
                    }}
                    className="text-[#1E4E8C] hover:underline font-bold text-xs inline-flex items-center gap-1 cursor-pointer pt-1"
                  >
                    Ir al Paso 6 (Vista previa y prueba) →
                  </button>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">4. Gobierno y Publicación</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                      Estado: {draft.status}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    {draft.status === 'Borrador'
                      ? 'Puede pasar a "En revisión" cuando complete la estructura y mapeos obligatorios.'
                      : `Versión en ciclo: ${draft.status}.`}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onGoToStep(7);
                    }}
                    className="text-[#1E4E8C] hover:underline font-bold text-xs inline-flex items-center gap-1 cursor-pointer pt-1"
                  >
                    Ir al Paso 7 (Publicación) →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REVISAR MI ESTRUCTURA */}
          {activeTab === 'revisar_estructura' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Auditoría Estructural de Salida ({selectedOutputType.family})
                  </h3>
                  <p className="text-slate-600 text-[11px]">
                    TOTALiA® valida longitudes, unidades, alineaciones, reglas de desbordamiento y consistencia con el tipo de archivo.
                  </p>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700">
                  {draft.fields.length} campos evaluados
                </span>
              </div>

              {configDiagnostics.length === 0 ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-bold text-xs">Estructura sin errores bloqueantes</div>
                    <p className="text-[11px] text-emerald-900 mt-0.5">
                      Todos los campos cuentan con longitudes válidas, posiciones consecutivas (en caso de TXT) y nombres únicos. La configuración puede guardarse como borrador.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {configDiagnostics.map((diag) => (
                    <div
                      key={diag.id}
                      className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/70 text-xs text-rose-950 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                          <span>{diag.title}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-950 font-mono">
                          Paso {diag.step}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-white/80 p-2.5 rounded-lg border border-rose-200/60 text-[11px]">
                        <div>
                          <strong className="text-rose-900">Ubicación:</strong>
                          <div className="text-slate-800">{diag.location}</div>
                        </div>
                        <div>
                          <strong className="text-rose-900">Causa:</strong>
                          <div className="text-slate-800">{diag.cause}</div>
                        </div>
                        <div>
                          <strong className="text-rose-900">Consecuencia:</strong>
                          <div className="text-slate-800">{diag.consequence}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] font-semibold text-rose-900">
                          Acción: {diag.action}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onGoToStep(diag.step);
                          }}
                          className="px-3 py-1 rounded bg-rose-800 hover:bg-rose-900 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                        >
                          Corregir en Paso {diag.step}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SUGERIR CORRESPONDENCIAS DE CAMPOS */}
          {activeTab === 'sugerir_mapeos' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
                <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-emerald-700" />
                  <span>Correspondencias Semánticas Inteligentes (Fuente: {selectedDataContract.name})</span>
                </div>
                <p className="text-emerald-900 text-[11px]">
                  TOTALiA® compara nombres, significados y tipos de datos. Preserva identificadores numéricos con ceros iniciales como <strong>Texto</strong> (ej. <code>'000123'</code>) y distingue entre correspondencias sugeridas, asignaciones confirmadas y validaciones superadas.
                </p>
              </div>

              <div className="space-y-2.5">
                {draft.fields.map((f) => {
                  const match = mappingProposals.proposals.find((p) => p.fieldId === f.id);
                  const isMapped = Boolean(f.mapping.sourceField || f.defaultValue || f.mapping.transformationKind !== 'Directo');
                  const isProposed = f.mapping.mappingStatus === 'Propuesta automática (Requiere confirmación)';

                  return (
                    <div
                      key={f.id}
                      className="p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{f.technicalName}</span>
                          <span className="text-slate-500">({f.dataType})</span>
                          {f.required && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900">
                              Obligatorio
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isProposed
                                ? 'bg-amber-100 text-amber-900'
                                : isMapped
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {isProposed
                              ? 'Correspondencia sugerida (Pendiente)'
                              : isMapped
                              ? 'Asignación confirmada'
                              : 'Sin asignar'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600">
                          {isMapped ? (
                            <>
                              Columna origen:{' '}
                              <strong className="font-mono text-slate-800">
                                {f.mapping.sourceField || f.defaultValue || 'Transformación'}
                              </strong>{' '}
                              · {f.mapping.transformationKind}
                            </>
                          ) : match?.proposedSource ? (
                            <>
                              Sugerencia TOTALiA®:{' '}
                              <strong className="font-mono text-emerald-700">
                                {match.proposedSource}
                              </strong>{' '}
                              ({match.reason})
                            </>
                          ) : (
                            'No se encontró columna con alta similitud en la fuente; requiere selección manual.'
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {match?.proposedSource && !isMapped && (
                          <button
                            type="button"
                            disabled={isImmutable}
                            onClick={() => {
                              onApplyFieldPatch(f.id, {
                                mapping: {
                                  ...f.mapping,
                                  sourceContractId: selectedDataContract.id,
                                  sourceField: match.proposedSource!,
                                  mappingStatus: 'Confirmado por usuario',
                                },
                              });
                              notify(
                                'success',
                                `Correspondencia de "${f.technicalName}" a "${match.proposedSource}" aceptada.`
                              );
                            }}
                            className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Aceptar correspondencia
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onGoToStep(3);
                          }}
                          className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs cursor-pointer"
                        >
                          Configurar en Paso 3
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: EXPLICAR ERRORES */}
          {activeTab === 'explicar_error' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-300 space-y-1">
                <div className="font-bold text-amber-950 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-800" />
                  <span>Resolución Asistida de Errores y Diagnósticos</span>
                </div>
                <p className="text-amber-900 text-[11px]">
                  Cada error se descompone en <strong>Ubicación</strong>, <strong>Causa</strong>, <strong>Consecuencia</strong> y la <strong>Acción directa</strong> para solventarlo.
                </p>
              </div>

              {configDiagnostics.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-center space-y-1">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                  <div className="font-bold text-xs">No hay errores estructurales activos</div>
                  <p className="text-[11px] text-slate-500">
                    La salida no presenta bloqueos de formato ni solapamientos.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {configDiagnostics.map((diag) => (
                    <div
                      key={diag.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2.5 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{diag.title}</div>
                          <div className="text-[11px] text-slate-500">Ubicación: {diag.location}</div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-900">
                          {diag.severity}
                        </span>
                      </div>

                      <div className="text-[11px] space-y-1 text-slate-700">
                        <div>
                          <strong className="text-slate-900">Causa:</strong> {diag.cause}
                        </div>
                        <div>
                          <strong className="text-slate-900">Consecuencia:</strong> {diag.consequence}
                        </div>
                        <div className="text-emerald-800 font-semibold">
                          <strong>Acción recomendada:</strong> {diag.action}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onGoToStep(diag.step);
                          }}
                          className="px-3 py-1.5 rounded bg-[#1E4E8C] hover:bg-[#163A69] text-white font-bold text-xs cursor-pointer inline-flex items-center gap-1.5"
                        >
                          Ir al Paso {diag.step} para corregir
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: PROPONER CAMPOS DESDE FUENTES O ESPECIFICACIÓN */}
          {activeTab === 'ayudame_a_crear' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 space-y-1">
                <div className="font-bold text-purple-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-700" />
                  <span>Proposición de Estructura desde Fuentes o Especificación</span>
                </div>
                <p className="text-purple-900 text-[11px]">
                  TOTALiA® puede sugerir campos basados en la fuente activa <strong>{selectedDataContract.name}</strong> ({selectedDataContract.fields.length} columnas disponibles). Ningún requisito oficial se inventa; las sugerencias se marcan como <em>Pendientes de confirmación</em>.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <div className="font-bold text-slate-800 text-xs">
                  Columnas sugeridas desde el contrato de origen ({selectedDataContract.fields.length} campos)
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {selectedDataContract.fields.map((srcField) => {
                    const alreadyExists = draft.fields.some(
                      (f) => f.technicalName.toLowerCase() === srcField.name.toLowerCase()
                    );
                    return (
                      <div key={srcField.name} className="py-2 flex items-center justify-between gap-2">
                        <div>
                          <span className="font-mono font-bold text-slate-900">{srcField.name}</span>
                          <span className="text-slate-500 text-[11px] ml-2">
                            {srcField.dataType} · Longitud: {srcField.length}
                          </span>
                          <div className="text-[10px] text-slate-500">{srcField.label}</div>
                        </div>
                        {alreadyExists ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                            Ya en estructura
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={isImmutable}
                            onClick={() => {
                              const newField: StructureField = {
                                id: `FLD-${Date.now().toString(36).toUpperCase()}`,
                                technicalName: srcField.name,
                                label: srcField.label || srcField.name,
                                description: `Importado sugerido desde ${selectedDataContract.name}`,
                                recordSection: 'Detalle',
                                order: draft.fields.length + 1,
                                dataType: srcField.dataType,
                                physicalType: `${srcField.dataType}(${srcField.length})`,
                                length: srcField.length,
                                lengthUnit: 'Caracteres',
                                required: !srcField.nullable,
                                nullable: srcField.nullable,
                                startPosition: 1,
                                formatMask: srcField.formatMask || '',
                                defaultValue: '',
                                paddingChar: selectedOutputType.family === 'TXT' ? ' ' : 'Ninguno',
                                alignment: 'Izquierda',
                                overflowRule: 'Bloquear con error',
                                protectionClass: 'Parametrizable',
                                evidenceState: 'Sustento explícito',
                                evidenceSourceRef: `Contrato ${selectedDataContract.code}`,
                                xmlNodeKind: 'Elemento',
                                avroLogicalType: 'string',
                                mapping: {
                                  sourceContractId: selectedDataContract.id,
                                  sourceField: srcField.name,
                                  transformationKind: 'Directo',
                                  expression: '',
                                  isParameterizedPoint: false,
                                  emptyTreatment: 'Error bloqueante',
                                  mappingStatus: 'Confirmado por usuario',
                                },
                              };
                              onApplyFullFieldsUpdate([...draft.fields, newField]);
                              notify('success', `Campo "${srcField.name}" añadido a la estructura.`);
                            }}
                            className="px-2.5 py-1 rounded bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
                          >
                            + Añadir a salida
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: EVALUAR IMPACTO EN FORMATOS ASOCIADOS */}
          {activeTab === 'evaluar_impacto' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 space-y-1">
                <div className="font-bold text-sky-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#1E4E8C]" />
                  <span>Evaluación de Impacto en Formatos y Entregas Regulatorias</span>
                </div>
                <p className="text-sky-900 text-[11px]">
                  TOTALiA® analiza qué formatos del Módulo D dependen de esta salida configurada para garantizar que ninguna modificación altere transmisiones vigentes.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">
                    Formatos que consumen esta salida ({linkedAssociations.length})
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                    Estado salida: {draft.status}
                  </span>
                </div>

                {linkedAssociations.length === 0 ? (
                  <p className="text-slate-500 text-[11px]">
                    Esta salida no está asociada a ningún formato regulatorio activo aún. Se puede editar libremente en Borrador.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {linkedAssociations.map((assoc) => {
                      const fmt = regulatoryFormats.find((f) => f.id === assoc.formatId);
                      return (
                        <div
                          key={assoc.id}
                          className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-900">
                              {fmt?.name || assoc.code} ({fmt?.code})
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Canal: {assoc.transmissionTypeId} · Ambiente: {assoc.environment} · Versión consumida: v{assoc.configuredOutputVersion}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900">
                            {assoc.environment}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: COMPARAR CON BASE */}
          {activeTab === 'comparar_revision' && baseOutput && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-1">
                <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                  <GitBranch className="w-4 h-4 text-indigo-700" />
                  <span>Comparación con la Versión Base ({baseOutput.code} v{baseOutput.version})</span>
                </div>
                <p className="text-indigo-900 text-[11px]">
                  Diferencias entre la versión vigente publicada y esta nueva revisión en borrador.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
                <div className="font-bold text-slate-800">
                  Resumen de cambios estructurales ({versionImpact.structuralChanges.length})
                </div>
                {versionImpact.structuralChanges.length === 0 ? (
                  <p className="text-slate-500 text-[11px]">
                    No se registran cambios estructurales respecto a la versión base.
                  </p>
                ) : (
                  <ul className="space-y-1 text-slate-700 list-disc list-inside text-[11px]">
                    {versionImpact.structuralChanges.map((change, i) => (
                      <li key={i}>{change}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between shrink-0 text-xs">
          <div className="text-slate-500 text-[11px]">
            TOTALiA® actúa como asesor contextual · Todas las decisiones requieren confirmación explícita
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold cursor-pointer"
          >
            Cerrar asistente
          </button>
        </div>
      </div>
    </div>
  );
};
