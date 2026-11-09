import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Download,
  FileCheck2,
  FileCode2,
  Lock,
  Play,
  Send,
  Terminal,
} from 'lucide-react';
import { useConfigurator } from '../context/ConfiguratorContext';
import { ExecutionRun } from '../domain/types';

export const ExecutionSimulatorView: React.FC = () => {
  const {
    executionRuns,
    regulatoryFormats,
    transmissionTypes,
    configuredOutputs,
    outputTypes,
    deliveryChannels,
    daqueProfiles,
    globalPeriod,
    globalEnvironment,
    executeSimulatedRun,
    updateRunDeliveryState,
  } = useConfigurator();

  const [selectedRunId, setSelectedRunId] = useState<string>(executionRuns[0]?.id || '');

  // Simulation launch controls
  const [simFormatId, setSimFormatId] = useState<string>('FMT-DEMO-01');
  const [simTransId, setSimTransId] = useState<string>('TX-ORDINARIO');
  const [simModality, setSimModality] = useState<'Inicial' | 'Corrección' | 'Reemplazo'>('Inicial');
  const [simPeriod, setSimPeriod] = useState<string>(globalPeriod);
  const [simEnv, setSimEnv] = useState<'QA' | 'Producción'>(globalEnvironment);
  const [injectZeroBalance, setInjectZeroBalance] = useState<boolean>(false);
  const [injectOverflow, setInjectOverflow] = useState<boolean>(false);
  const [ackInput, setAckInput] = useState<string>('RAD-EXT-20261109-99412');

  const selectedRun = useMemo(
    () => executionRuns.find((r) => r.id === selectedRunId) || executionRuns[0] || null,
    [executionRuns, selectedRunId]
  );

  const handleRunSimulation = (e: React.FormEvent) => {
    e.preventDefault();
    const created = executeSimulatedRun({
      formatId: simFormatId,
      transmissionTypeId: simTransId,
      modality: simModality,
      cutoffPeriod: simPeriod,
      environment: simEnv,
      injectZeroBalanceError: injectZeroBalance,
      injectOverflowError: injectOverflow,
    });
    if (created) {
      setSelectedRunId(created.id);
    }
  };

  const handleDownloadGeneratedFile = (run: ExecutionRun) => {
    const blob = new Blob([run.generatedFileContent], { type: run.generatedMimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = run.generatedFileName;
    a.click();
    URL.revokeObjectURL(url);

    if (run.deliveryState === 'Pendiente de envío / descarga') {
      updateRunDeliveryState(run.id, 'Descargada manualmente (Sin acreditar envío)');
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-md p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#1E4E8C]">
            <Terminal className="w-4 h-4" />
            <span>F. Pruebas y generación · Simulación, Resultados y Descarga</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-0.5">
            Pruebas de Generación, Validación y Descarga de Archivos
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl">
            Ejecute pruebas sobre los formatos configurados, revise los resultados de validación, descargue los archivos generados (disponible para motores CSV, TXT y XML) y registre el estado de entrega.
          </p>
        </div>
      </div>

      {/* Simulation Launcher Panel */}
      <form
        onSubmit={handleRunSimulation}
        className="bg-white border border-slate-200 rounded-md p-4 space-y-3"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 pb-2.5 border-b border-slate-200">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Ejecutar prueba de generación por formato
            </h2>
            <p className="text-xs text-slate-600">
              Seleccione el formato regulatorio, tipo de transmisión y ambiente para validar los datos y generar la salida asociada.
            </p>
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#1E4E8C] text-white text-xs font-bold hover:bg-[#163A69] transition-colors cursor-pointer shrink-0"
          >
            <Play className="w-3.5 h-3.5" />
            Ejecutar prueba y generar salida
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Formato Regulatorio
            </label>
            <select
              aria-label="Formato Regulatorio Ejecución"
              value={simFormatId}
              onChange={(e) => setSimFormatId(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900"
            >
              {regulatoryFormats.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code} — {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Tipo de Transmisión
            </label>
            <select
              aria-label="Tipo de Transmisión Ejecución"
              value={simTransId}
              onChange={(e) => setSimTransId(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900"
            >
              {transmissionTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} · {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Modalidad</label>
            <select
              aria-label="Modalidad Ejecución"
              value={simModality}
              onChange={(e) =>
                setSimModality(e.target.value as 'Inicial' | 'Corrección' | 'Reemplazo')
              }
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900"
            >
              <option value="Inicial">Inicial</option>
              <option value="Corrección">Corrección</option>
              <option value="Reemplazo">Reemplazo</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Ambiente</label>
            <select
              aria-label="Ambiente Ejecución"
              value={simEnv}
              onChange={(e) => setSimEnv(e.target.value as 'QA' | 'Producción')}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-900"
            >
              <option value="QA">QA</option>
              <option value="Producción">Producción</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Periodo de Corte</label>
            <input
              type="text"
              aria-label="Periodo de Corte Ejecución"
              value={simPeriod}
              onChange={(e) => setSimPeriod(e.target.value)}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono tabular-nums bg-white text-slate-900"
            />
          </div>
        </div>

        {/* Negative Test Scenario Toggles */}
        <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-700">
          <span className="font-bold text-slate-800">
            Simular errores de datos o longitud:
          </span>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={injectZeroBalance}
              onChange={(e) => setInjectZeroBalance(e.target.checked)}
            />
            <span>
              Incluir registro con <code className="font-mono font-bold">saldo = 0.00</code> (Permitido en DEMO-01 / Rechazado en DEMO-02)
            </span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={injectOverflow}
              onChange={(e) => setInjectOverflow(e.target.checked)}
            />
            <span>
              Incluir <code className="font-mono font-bold">nombre &gt; 50 caracteres</code> (Excede longitud máxima configurada)
            </span>
          </label>
        </div>
      </form>

      {/* Main Split: Left Runs List (5 cols) + Right Selected Run Inspector (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Execution Runs History */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-md flex flex-col">
          <div className="p-3.5 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-900">
              Historial de pruebas y generaciones ({executionRuns.length})
            </h2>
            <p className="text-[11px] text-slate-500">
              Seleccione una ejecución para revisar las validaciones y descargar el archivo.
            </p>
          </div>

          <div className="divide-y divide-slate-200 max-h-[620px] overflow-y-auto">
            {executionRuns.map((run) => {
              const fmt = regulatoryFormats.find((f) => f.id === run.formatId);
              const out = configuredOutputs.find((o) => o.id === run.configuredOutputId);
              const isSelected = selectedRun?.id === run.id;

              return (
                <div
                  key={run.id}
                  onClick={() => setSelectedRunId(run.id)}
                  className={`p-3.5 cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                      {run.runCode} · {fmt?.code}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        run.blockingCount === 0
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-rose-100 text-rose-900'
                      }`}
                    >
                      {run.generationState}
                    </span>
                  </div>

                  <div className="text-xs text-slate-700 mt-1">
                    Salida: <strong className="font-mono">{out?.code}</strong> (v
                    {run.configuredOutputVersion}) · Periodo:{' '}
                    <span className="font-mono">{run.cutoffPeriod}</span> ({run.environment})
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-[11px]">
                    <span className="font-mono text-slate-600 tabular-nums">
                      Registros: {run.recordsReviewed} · Errores:{' '}
                      <strong className={run.blockingCount > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                        {run.blockingCount}
                      </strong>{' '}
                      · Advertencias: {run.warningCount}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-medium">
                      {run.deliveryState}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Detailed Run Summary, Validation Findings, and File Download */}
        <div className="lg:col-span-7 space-y-4">
          {selectedRun ? (
            (() => {
              const fmt = regulatoryFormats.find((f) => f.id === selectedRun.formatId);
              const out = configuredOutputs.find((o) => o.id === selectedRun.configuredOutputId);
              const outType = outputTypes.find((t) => t.id === out?.outputTypeId);
              const chn = deliveryChannels.find((c) => c.id === selectedRun.deliveryChannelId);
              const daque = daqueProfiles.find((d) => d.id === selectedRun.daqueProfileId);
              const isPhysicalEngineSupported =
                !outType ||
                outType.family === 'CSV' ||
                outType.family === 'TXT' ||
                outType.family === 'XML';

              return (
                <>
                  {/* Run Summary Card */}
                  <div className="bg-white border border-slate-200 rounded-md p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#1E4E8C]">
                          Resultado de la ejecución
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                          {selectedRun.runCode} · {selectedRun.createdAt}
                        </h3>
                      </div>

                      {isPhysicalEngineSupported ? (
                        <button
                          type="button"
                          onClick={() => handleDownloadGeneratedFile(selectedRun)}
                          disabled={selectedRun.blockingCount > 0}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-xs font-bold cursor-pointer ${
                            selectedRun.blockingCount > 0
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              : 'bg-[#1E4E8C] text-white hover:bg-[#163A69]'
                          }`}
                        >
                          <Download className="w-3.5 h-3.5" />
                          Descargar archivo ({selectedRun.generatedFileName})
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-xs font-semibold bg-slate-200 text-slate-600 cursor-not-allowed border border-slate-300"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          Generación no disponible en esta versión ({outType?.family})
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div className="p-2.5 rounded border border-slate-200 bg-slate-50">
                        <div className="text-[10px] uppercase text-slate-500 font-semibold">
                          Formato Regulatorio
                        </div>
                        <div className="font-bold text-slate-900 mt-0.5">
                          {fmt?.code}
                        </div>
                      </div>
                      <div className="p-2.5 rounded border border-slate-200 bg-slate-50">
                        <div className="text-[10px] uppercase text-slate-500 font-semibold">
                          Salida Utilizada
                        </div>
                        <div className="font-mono font-bold text-[#1E4E8C] mt-0.5 tabular-nums">
                          {out?.code} (v{selectedRun.configuredOutputVersion})
                        </div>
                      </div>
                      <div className="p-2.5 rounded border border-slate-200 bg-slate-50">
                        <div className="text-[10px] uppercase text-slate-500 font-semibold">
                          Reglas del Formato
                        </div>
                        <div className="font-mono font-bold text-indigo-900 mt-0.5 tabular-nums">
                          {daque?.code}
                        </div>
                      </div>
                      <div className="p-2.5 rounded border border-slate-200 bg-slate-50">
                        <div className="text-[10px] uppercase text-slate-500 font-semibold">
                          Canal de Entrega
                        </div>
                        <div className="font-semibold text-slate-900 mt-0.5 truncate">
                          {chn?.name}
                        </div>
                      </div>
                    </div>

                    {/* Delivery State Progression */}
                    <div className="p-3 rounded border border-slate-200 bg-slate-50/70 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Send className="w-3.5 h-3.5 text-[#1E4E8C]" />
                          Seguimiento de entrega y acuse:
                        </div>
                        <span className="px-2.5 py-0.5 rounded bg-blue-100 text-[#1E4E8C] text-xs font-bold">
                          {selectedRun.deliveryState}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <input
                          type="text"
                          aria-label="Número de acuse o radicado exterior"
                          value={ackInput}
                          onChange={(e) => setAckInput(e.target.value)}
                          placeholder="N° Radicado / Acuse"
                          className="border border-slate-300 rounded px-2 py-1 text-xs font-mono bg-white"
                        />
                        <button
                          type="button"
                          disabled={selectedRun.blockingCount > 0}
                          onClick={() =>
                            updateRunDeliveryState(
                              selectedRun.id,
                              'Descargada manualmente (Sin acreditar envío)'
                            )
                          }
                          className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-[11px] font-medium cursor-pointer disabled:opacity-50"
                        >
                          1. Marcar descarga manual
                        </button>
                        <button
                          type="button"
                          disabled={selectedRun.blockingCount > 0}
                          onClick={() =>
                            updateRunDeliveryState(
                              selectedRun.id,
                              'Presentación manual registrada',
                              ackInput
                            )
                          }
                          className="px-2.5 py-1 rounded border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-900 text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                        >
                          2. Registrar radicado manual
                        </button>
                        <button
                          type="button"
                          disabled={selectedRun.blockingCount > 0}
                          onClick={() =>
                            updateRunDeliveryState(
                              selectedRun.id,
                              'Aceptada por el ente',
                              ackInput
                            )
                          }
                          className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                        >
                          3. Marcar aceptada por el ente
                        </button>
                      </div>

                      {selectedRun.externalAckReceipt && (
                        <div className="text-[11px] font-mono text-emerald-900 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
                          Constancia / Radicado: <strong>{selectedRun.externalAckReceipt}</strong>
                        </div>
                      )}
                    </div>

                    {/* Collapsible Advanced Audit Details */}
                    <details className="text-xs text-slate-600 pt-1">
                      <summary className="cursor-pointer font-semibold text-slate-700 inline-flex items-center gap-1">
                        <span>Ver detalles técnicos de auditoría (Snapshot y Hash)</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </summary>
                      <div className="mt-2 p-2.5 rounded bg-slate-100 font-mono text-[11px] space-y-1">
                        <div>Snapshot de datos: {selectedRun.snapshotId}</div>
                        <div>Suma de verificación (SHA-256): {selectedRun.sha256Hash}</div>
                        <div>Versión de motor: {selectedRun.binaryRuntimeFingerprint}</div>
                      </div>
                    </details>
                  </div>

                  {/* Findings Table by Validation Layer */}
                  <div className="bg-white border border-slate-200 rounded-md p-4 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <FileCheck2 className="w-4 h-4 text-[#1E4E8C]" />
                      Resultados de validación ({selectedRun.findings.length})
                    </h3>

                    {selectedRun.findings.length === 0 ? (
                      <div className="p-3 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>
                          Validación exitosa sin errores ni advertencias. El archivo cumple tanto las reglas del formato ({daque?.code}) como la estructura de la salida ({out?.code}).
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedRun.findings.map((f) => (
                          <div
                            key={f.id}
                            className={`p-3 rounded border text-xs ${
                              f.severity === 'Bloqueante'
                                ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                                : 'bg-amber-50/70 border-amber-200 text-amber-950'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                              <span className="font-mono">
                                [{f.code}] {f.layer} · {f.location}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] uppercase ${
                                  f.severity === 'Bloqueante'
                                    ? 'bg-rose-200 text-rose-950'
                                    : 'bg-amber-200 text-amber-950'
                                }`}
                              >
                                {f.severity}
                              </span>
                            </div>
                            <p className="mt-1">{f.description}</p>
                            <p className="mt-1 text-[11px] font-medium opacity-90">
                              <strong>Cómo corregirlo:</strong> {f.suggestedAction}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Generated Physical Output Inspector */}
                  <div className="bg-white border border-slate-200 rounded-md p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <FileCode2 className="w-4 h-4 text-[#1E4E8C]" />
                        Vista previa del contenido generado ({selectedRun.generatedFileName})
                      </h3>
                      <span className="font-mono text-[11px] text-slate-500">
                        {selectedRun.generatedMimeType}
                      </span>
                    </div>
                    <pre className="p-3 rounded bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed">
                      {selectedRun.generatedFileContent}
                    </pre>
                  </div>
                </>
              );
            })()
          ) : (
            <div className="bg-white border border-slate-200 rounded-md p-6 text-center text-xs text-slate-500">
              Seleccione una ejecución para inspeccionar su resultado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
