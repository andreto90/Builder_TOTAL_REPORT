import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Copy,
  Download,
  GitBranch,
  GitCommit,
  History,
  Lock,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { useConfigurator } from '../context/ConfiguratorContext';
import { analyzeVersionImpact } from '../domain/engine';
import { LifecycleStatus } from '../domain/types';
import { TotaliaAssistantView } from './TotaliaAssistantView';

export const VersionGovernanceView: React.FC = () => {
  const {
    configuredOutputs,
    selectedOutputId,
    setSelectedOutputId,
    associations,
    regulatoryFormats,
    environmentDeployments,
    totaliaSuggestions,
    createNewRevisionFromOutput,
    deriveVariantFromOutput,
    duplicateOutputIndependently,
    transitionOutputStatus,
    adoptOutputVersionInAssociation,
    runEnvironmentAction,
    exportDomainJson,
    importDomainJson,
    resetDemoData,
    openOutputInBuilder,
  } = useConfigurator();

  const [activeSubTab, setActiveSubTab] = useState<'versions' | 'totalia'>('versions');
  const [justificationText, setJustificationText] = useState<string>(
    'Actualización normativa conforme al Instructivo v3 (ajuste de estructura).'
  );
  const [deriveCode, setDeriveCode] = useState<string>('DEMO-CE-01-VAR-TRIM');
  const [deriveName, setDeriveName] = useState<string>(
    'Variante Trimestral Paquete Supervisión'
  );
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>('');

  const pendingTotaliaCount = totaliaSuggestions.filter(
    (s) => s.status === 'Pendiente de revisión'
  ).length;

  const currentOutput = useMemo(
    () => configuredOutputs.find((o) => o.id === selectedOutputId) || configuredOutputs[0],
    [configuredOutputs, selectedOutputId]
  );

  const baseOutput = useMemo(() => {
    if (!currentOutput?.baseOutputId) return undefined;
    return configuredOutputs.find((o) => o.id === currentOutput.baseOutputId);
  }, [configuredOutputs, currentOutput]);

  const impactAnalysis = useMemo(() => {
    if (!currentOutput) return null;
    return analyzeVersionImpact({
      output: currentOutput,
      previousFields: baseOutput?.fields,
      associations,
      formats: regulatoryFormats,
    });
  }, [currentOutput, baseOutput, associations, regulatoryFormats]);

  const handleDownloadJsonPackage = () => {
    const raw = exportDomainJson();
    const blob = new Blob([raw], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paquete_configuracion_${currentOutput.code}_v${currentOutput.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isImmutable =
    currentOutput.status === 'Publicada' || currentOutput.status === 'Aprobada';

  return (
    <div className="space-y-5">
      {/* Top Header with Contextual TOTALiA Tab Switcher */}
      <div className="bg-white border border-slate-200 rounded-md p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#1E4E8C]">
            <GitBranch className="w-4 h-4" />
            <span>E. Versiones y publicación · Historial, Aprobaciones y Cambio Normativo</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">
            Control de Versiones, Aprobación y Publicación
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl">
            Administre las revisiones de cada salida, identifique qué formatos utilizan versiones anteriores, evalúe impactos normativos con TOTALiA® y active versiones por ambiente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadJsonPackage}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar Configuración (JSON)
          </button>
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            Importar Configuración
          </button>
          <button
            type="button"
            onClick={resetDemoData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-medium cursor-pointer"
          >
            Restaurar Datos Demo
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs: Version Control vs. TOTALiA Normative Assistant */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('versions')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-colors cursor-pointer ${
            activeSubTab === 'versions'
              ? 'bg-[#0F1F38] text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <GitBranch className="w-3.5 h-3.5" />
          Versiones, impacto y activación por ambiente
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('totalia')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-colors cursor-pointer ${
            activeSubTab === 'totalia'
              ? 'bg-[#0F1F38] text-white'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Asistente de cambio normativo TOTALiA®
          {pendingTotaliaCount > 0 && (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-400 text-slate-950 font-bold">
              {pendingTotaliaCount}
            </span>
          )}
        </button>
      </div>

      {activeSubTab === 'totalia' ? (
        <TotaliaAssistantView />
      ) : (
        <>
          {/* Selector & Lifecycle Controls Bar */}
          <div className="bg-white border border-slate-200 rounded-md p-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              <div className="lg:col-span-5">
                <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1">
                  Seleccionar salida configurada / versión
                </label>
                <select
                  aria-label="Seleccionar salida configurada para gobierno"
                  value={currentOutput.id}
                  onChange={(e) => setSelectedOutputId(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-xs font-mono bg-white text-slate-900"
                >
                  {configuredOutputs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.code} (v{o.version}) — {o.name} [{o.status}]
                    </option>
                  ))}
                </select>

                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`px-2 py-0.5 rounded font-semibold ${
                      currentOutput.status === 'Publicada'
                        ? 'bg-emerald-100 text-emerald-900'
                        : currentOutput.status === 'Aprobada'
                        ? 'bg-blue-100 text-blue-900'
                        : currentOutput.status === 'En revisión'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    Estado: {currentOutput.status}
                  </span>
                  <span className="font-mono text-[11px] text-slate-600 tabular-nums">
                    Versión: v{currentOutput.version} ({currentOutput.derivationType})
                  </span>
                  {isImmutable && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      <Lock className="w-3 h-3 text-slate-600" />
                      Protegida contra edición directa
                    </span>
                  )}
                </div>
              </div>

              <div className="lg:col-span-7 space-y-2.5">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-600 mb-1">
                    Justificación del cambio de estado o nueva revisión
                  </label>
                  <input
                    type="text"
                    value={justificationText}
                    onChange={(e) => setJustificationText(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs bg-white text-slate-900"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const created = createNewRevisionFromOutput(
                        currentOutput.id,
                        justificationText
                      );
                      if (created) {
                        openOutputInBuilder(created.id, 2);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1E4E8C] text-white text-xs font-semibold hover:bg-[#163A69] cursor-pointer"
                  >
                    <GitCommit className="w-3.5 h-3.5" />
                    Crear nueva revisión y editar
                  </button>

                  {(
                    ['En revisión', 'Aprobada', 'Publicada', 'Descontinuada'] as LifecycleStatus[]
                  ).map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={currentOutput.status === st}
                      onClick={() =>
                        transitionOutputStatus(currentOutput.id, st, justificationText)
                      }
                      className={`px-2.5 py-1.5 rounded border text-xs font-semibold transition-colors cursor-pointer ${
                        currentOutput.status === st
                          ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      Pasar a {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Middle Split: Impact on Shared Consumers + Controlled Derivation vs Independent Copy */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Consumer Impact & Selective Version Adoption (7 cols) */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Formatos regulatorios que utilizan esta salida o su versión anterior
                  </h2>
                  <p className="text-xs text-slate-600">
                    Crear una nueva versión no altera automáticamente los formatos vigentes. Aquí puede actualizar cada formato a la versión{' '}
                    <span className="font-mono font-semibold">v{currentOutput.version}</span> cuando corresponda.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-xs font-bold text-[#1E4E8C] tabular-nums">
                  {impactAnalysis?.affectedAssociations.length || 0} formato(s)
                </span>
              </div>

              {impactAnalysis && impactAnalysis.structuralChanges.length > 0 && (
                <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-xs text-amber-950">
                  <div className="font-bold mb-1">
                    Cambios detectados frente a la versión anterior ({baseOutput?.version}):
                  </div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {impactAnalysis.structuralChanges.map((chg, idx) => (
                      <li key={idx} className="font-mono text-[11px]">
                        {chg}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                      <th className="py-2 px-2.5">Asociación</th>
                      <th className="py-2 px-2.5">Formato Regulatorio</th>
                      <th className="py-2 px-2.5">Versión en Uso</th>
                      <th className="py-2 px-2.5">Ambiente</th>
                      <th className="py-2 px-2.5 text-right">Actualización de Versión</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {impactAnalysis?.affectedAssociations.map((assoc) => {
                      const fmt = regulatoryFormats.find((f) => f.id === assoc.formatId);
                      const isAlreadyOnCurrent =
                        assoc.configuredOutputVersion === currentOutput.version;

                      return (
                        <tr key={assoc.id} className="hover:bg-slate-50">
                          <td className="py-2 px-2.5 font-mono font-semibold text-slate-900">
                            {assoc.code}
                          </td>
                          <td className="py-2 px-2.5">
                            <div className="font-semibold text-slate-800">{fmt?.code}</div>
                            <div className="text-[11px] text-slate-500">{fmt?.name}</div>
                          </td>
                          <td className="py-2 px-2.5 font-mono font-bold tabular-nums">
                            <span
                              className={`px-2 py-0.5 rounded ${
                                isAlreadyOnCurrent
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              v{assoc.configuredOutputVersion}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-slate-700">{assoc.environment}</td>
                          <td className="py-2 px-2.5 text-right">
                            {isAlreadyOnCurrent ? (
                              <span className="text-[11px] text-emerald-700 font-semibold">
                                Actualizado en v{currentOutput.version}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  adoptOutputVersionInAssociation(
                                    assoc.id,
                                    currentOutput.version
                                  )
                                }
                                className="px-2.5 py-1 rounded bg-[#1E4E8C] text-white text-[11px] font-semibold hover:bg-[#163A69] cursor-pointer"
                              >
                                Pasar a v{currentOutput.version}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Controlled Variant Derivation vs Independent Cloning (5 cols) */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-md p-4 space-y-3">
              <div className="border-b border-slate-200 pb-2.5">
                <h2 className="text-sm font-bold text-slate-900">
                  Crear variante o duplicar salida
                </h2>
                <p className="text-xs text-slate-600">
                  Elija si desea crear una variante trazable o una copia independiente.
                </p>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nuevo código de salida
                  </label>
                  <input
                    type="text"
                    value={deriveCode}
                    onChange={(e) => setDeriveCode(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nombre descriptivo
                  </label>
                  <input
                    type="text"
                    value={deriveName}
                    onChange={(e) => setDeriveName(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      deriveVariantFromOutput(currentOutput.id, deriveCode, deriveName)
                    }
                    className="p-2.5 rounded border border-blue-300 bg-blue-50 text-blue-950 hover:bg-blue-100 text-left cursor-pointer"
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-[#1E4E8C]" />
                      Crear variante
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Conserva referencia a la salida base ({currentOutput.code}).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      duplicateOutputIndependently(
                        currentOutput.id,
                        `${deriveCode}-COPIA`,
                        `${deriveName} (Copia Independiente)`
                      )
                    }
                    className="p-2.5 rounded border border-slate-300 bg-slate-50 text-slate-900 hover:bg-slate-100 text-left cursor-pointer"
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <Copy className="w-3.5 h-3.5 text-slate-700" />
                      Duplicar independiente
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Crea una copia separada en v1.0 Borrador.
                    </p>
                  </button>
                </div>
              </div>

              {/* Version History Timeline */}
              <div className="pt-3 border-t border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2">
                  <History className="w-3.5 h-3.5 text-[#1E4E8C]" />
                  Historial de versiones de {currentOutput.code}
                </h3>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {currentOutput.versionHistory.map((vh, i) => (
                    <div
                      key={`${vh.version}-${i}`}
                      className="p-2 rounded border border-slate-200 bg-slate-50 text-[11px]"
                    >
                      <div className="flex items-center justify-between font-semibold text-slate-900">
                        <span className="font-mono">
                          v{vh.version} · {vh.status} ({vh.derivationKind})
                        </span>
                        <span className="font-mono text-slate-500">{vh.createdAt}</span>
                      </div>
                      <div className="text-slate-700 mt-0.5">{vh.justification}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section: Activation per Environment */}
          <div className="bg-white border border-slate-200 rounded-md p-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Server className="w-4 h-4 text-[#1E4E8C]" />
                  Activación de versiones por ambiente (QA y Producción)
                </h2>
                <p className="text-xs text-slate-600">
                  Permite instalar, activar o revertir la versión de una configuración en cada ambiente.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {environmentDeployments.map((dep) => {
                const isBlocked = dep.compatibilityStatus === 'Bloqueado por dependencia';
                return (
                  <div
                    key={dep.id}
                    className="border border-slate-200 rounded-md p-3.5 flex flex-col justify-between bg-slate-50/50"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {dep.environmentName}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-900">
                          {dep.connectivity}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-600 mt-1 font-mono">
                        Formato: <strong>{dep.formatCode}</strong>
                      </div>

                      <div className="grid grid-cols-3 gap-2 my-3 text-center">
                        <div className="p-2 rounded bg-white border border-slate-200">
                          <div className="text-[10px] uppercase text-slate-500 font-semibold">
                            Disponible
                          </div>
                          <div className="text-xs font-mono font-bold text-slate-800 mt-0.5 tabular-nums">
                            v{dep.availableVersion}
                          </div>
                        </div>
                        <div className="p-2 rounded bg-white border border-blue-200">
                          <div className="text-[10px] uppercase text-blue-800 font-semibold">
                            Instalada
                          </div>
                          <div className="text-xs font-mono font-bold text-blue-900 mt-0.5 tabular-nums">
                            v{dep.installedVersion}
                          </div>
                        </div>
                        <div className="p-2 rounded bg-emerald-50 border border-emerald-300">
                          <div className="text-[10px] uppercase text-emerald-900 font-semibold">
                            Activa
                          </div>
                          <div className="text-xs font-mono font-bold text-emerald-950 mt-0.5 tabular-nums">
                            v{dep.activeVersion}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`p-2 rounded border text-[11px] mb-3 flex items-start gap-1.5 ${
                          dep.compatibilityStatus === 'Conforme'
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                            : isBlocked
                            ? 'bg-rose-50 border-rose-200 text-rose-950'
                            : 'bg-amber-50 border-amber-200 text-amber-950'
                        }`}
                      >
                        {dep.compatibilityStatus === 'Conforme' ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-semibold">
                            Estado: {dep.compatibilityStatus}
                          </div>
                          {dep.blockingReason && (
                            <div className="mt-0.5">{dep.blockingReason}</div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <button
                          type="button"
                          onClick={() => runEnvironmentAction(dep.id, 'Descargar')}
                          className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-[11px] font-medium text-slate-800 cursor-pointer"
                        >
                          1. Verificar paquete
                        </button>
                        <button
                          type="button"
                          onClick={() => runEnvironmentAction(dep.id, 'Instalar')}
                          className="px-2 py-1 rounded border border-blue-300 bg-blue-50 hover:bg-blue-100 text-[11px] font-semibold text-blue-900 cursor-pointer"
                        >
                          2. Instalar v{dep.availableVersion}
                        </button>
                        <button
                          type="button"
                          onClick={() => runEnvironmentAction(dep.id, 'Activar')}
                          className="px-2.5 py-1 rounded bg-[#1E4E8C] hover:bg-[#163A69] text-[11px] font-semibold text-white inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3 h-3" />
                          3. Activar v{dep.installedVersion}
                        </button>
                        {dep.previousCompatibleVersion && (
                          <button
                            type="button"
                            onClick={() => runEnvironmentAction(dep.id, 'Revertir')}
                            className="px-2 py-1 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-[11px] font-semibold text-amber-950 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Revertir a v{dep.previousCompatibleVersion}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-2">
                      <div className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">
                        Historial del ambiente
                      </div>
                      <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                        {dep.auditTrail.map((ev, idx) => (
                          <div
                            key={idx}
                            className="p-1.5 rounded bg-white border border-slate-200 text-[11px]"
                          >
                            <div className="flex items-center justify-between font-semibold">
                              <span className="text-[#1E4E8C]">
                                [{ev.stage}] v{ev.version}
                              </span>
                              <span className="font-mono text-[10px] text-slate-500">
                                {ev.timestamp}
                              </span>
                            </div>
                            <div className="text-slate-600 text-[10px] mt-0.5">{ev.detail}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Modal: Import Configuration JSON */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-md shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-4 py-3 bg-[#0F1F38] text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">Importar paquete de configuración</h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                Cerrar
              </button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-600">
                Pegue el contenido JSON de un paquete exportado o cargue el paquete actual de demostración.
              </p>
              <textarea
                rows={7}
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder='{"schemaVersion": "TOTAL-REPORT-CES-1.2", ...}'
                className="w-full border border-slate-300 rounded p-2 font-mono text-[11px]"
              />
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setImportJsonText(exportDomainJson())}
                  className="text-[#1E4E8C] font-semibold hover:underline cursor-pointer"
                >
                  Cargar JSON actual de muestra
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (importDomainJson(importJsonText)) {
                        setShowImportModal(false);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded bg-[#1E4E8C] text-white font-semibold hover:bg-[#163A69] cursor-pointer"
                  >
                    Verificar e importar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
