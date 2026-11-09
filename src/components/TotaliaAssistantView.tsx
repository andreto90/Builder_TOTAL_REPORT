import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  FileDiff,
  FileText,
  Sparkles,
  X,
} from 'lucide-react';
import { useConfigurator } from '../context/ConfiguratorContext';
import { HelpTooltip } from './HelpTooltip';

export const TotaliaAssistantView: React.FC = () => {
  const {
    totaliaSuggestions,
    normativeSources,
    configuredOutputs,
    decideTotaliaSuggestion,
    openOutputInBuilder,
  } = useConfigurator();

  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filteredSuggestions = useMemo(() => {
    return totaliaSuggestions.filter((s) => {
      if (categoryFilter !== 'ALL' && s.category !== categoryFilter) return false;
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      return true;
    });
  }, [totaliaSuggestions, categoryFilter, statusFilter]);

  const pendingCount = totaliaSuggestions.filter(
    (s) => s.status === 'Pendiente de revisión'
  ).length;
  const acceptedCount = totaliaSuggestions.filter(
    (s) => s.status === 'Aceptada en borrador'
  ).length;

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-md p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#1E4E8C]">
            <Sparkles className="w-4 h-4" />
            <span>
              E.2 · Acompañamiento Contextual y Comparación Normativa TOTALiA® (Repositorio Normativo Precargado)
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
            <span>Análisis Comparado de Cambio Normativo y Propuestas Explicables en Borrador</span>
            <HelpTooltip
              title="Alcance real de TOTALiA® en esta versión"
              description="En este entorno web, TOTALiA® evalúa las fuentes normativas precargadas (Circular Externa 028-2026 / Instructivo v2 vs v3 y esquema Avro v4) y aplica de forma real los ajustes aceptados sobre una revisión en Borrador."
              consequence="La ingesta OCR/NLP en tiempo real de archivos PDF o XSD arbitrarios requiere el servicio documental backend de TOTALiA®."
            />
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            TOTALiA® analiza fuentes normativas registradas (instructivos, esquemas XSD/Avro, muestras), señala el nivel de sustento y aplica los cambios aceptados sobre una revisión en <strong>Borrador</strong>. <strong>Ninguna sugerencia aprueba, publica ni activa salidas automáticamente.</strong>
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-3 py-1.5 rounded bg-amber-50 border border-amber-200 text-xs">
            <span className="text-amber-900 font-semibold">Pendientes de revisión: </span>
            <span className="font-mono font-bold text-amber-950 tabular-nums">{pendingCount}</span>
          </div>
          <div className="px-3 py-1.5 rounded bg-emerald-50 border border-emerald-200 text-xs">
            <span className="text-emerald-900 font-semibold">Aceptadas en borrador: </span>
            <span className="font-mono font-bold text-emerald-950 tabular-nums">{acceptedCount}</span>
          </div>
        </div>
      </div>

      {/* Normative Sources & Version Comparison Bar */}
      <div className="bg-white border border-slate-200 rounded-md p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 pb-2.5 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileDiff className="w-4 h-4 text-[#1E4E8C]" />
            <span>Comparación de Fuentes Normativas Registradas (Escenario Cambio Normativo DEMO v2 vs. DEMO v3)</span>
          </h2>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded bg-blue-50 text-[#1E4E8C] border border-blue-200">
            Fuentes normativas precargadas con trazabilidad de evidencia
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded border border-slate-200 bg-slate-50">
            <div className="text-[10px] font-bold uppercase text-slate-500">
              Fuente Anterior Vigente
            </div>
            <div className="font-bold text-slate-900 mt-0.5">
              Instructivo DEMO v2 + Esquema v3
            </div>
            <div className="text-[11px] text-slate-600 mt-1">
              Campo <span className="font-mono">nombre_cliente</span>: longitud 50 caracteres · Campo{' '}
              <span className="font-mono">codigo_moneda</span>: no incluido.
            </div>
          </div>

          <div className="p-3 rounded border border-blue-200 bg-blue-50/50">
            <div className="text-[10px] font-bold uppercase text-[#1E4E8C]">
              Fuente Nueva Detectada
            </div>
            <div className="font-bold text-slate-900 mt-0.5">
              Instructivo DEMO v3 + Esquema v4 (Circular 028-2026)
            </div>
            <div className="text-[11px] text-slate-700 mt-1">
              Amplía <span className="font-mono">nombre_cliente</span> a 80 caracteres y adiciona{' '}
              <span className="font-mono">codigo_moneda</span> (Catálogo ISO-4217).
            </div>
          </div>

          <div className="p-3 rounded border border-amber-200 bg-amber-50/60">
            <div className="text-[10px] font-bold uppercase text-amber-900">
              Impacto en Consumidores Compartidos
            </div>
            <div className="font-bold text-amber-950 mt-0.5">
              3 formatos asociados a DEMO-CE-01 / DEMO-CE-02
            </div>
            <div className="text-[11px] text-amber-900 mt-1">
              Al aceptar una sugerencia, TOTALiA® crea o actualiza una revisión en <strong>Borrador</strong> sin alterar las asociaciones activas de DEMO-01, DEMO-02 ni DEMO-03.
            </div>
          </div>
        </div>

        {/* Registered Normative Documents Table */}
        <div className="pt-2">
          <div className="text-[11px] font-bold uppercase text-slate-600 mb-2 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-[#1E4E8C]" />
            Repositorio de Evidencias y Fuentes Normativas Vinculadas (Precargado)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase">
                  <th className="py-2 px-2.5">ID / Documento</th>
                  <th className="py-2 px-2.5">Emisor / Jurisdicción</th>
                  <th className="py-2 px-2.5">Tipo de Fuente</th>
                  <th className="py-2 px-2.5">Localizador</th>
                  <th className="py-2 px-2.5">Huella SHA-256</th>
                  <th className="py-2 px-2.5">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {normativeSources.map((src) => (
                  <tr key={src.id} className="hover:bg-slate-50">
                    <td className="py-2 px-2.5">
                      <div className="font-semibold text-slate-900">{src.title}</div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {src.id} · Versión {src.versionDeclared}
                      </div>
                    </td>
                    <td className="py-2 px-2.5 text-slate-700">
                      {src.issuer} ({src.jurisdiction})
                    </td>
                    <td className="py-2 px-2.5">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] font-medium">
                        {src.kind}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 font-mono text-[11px] text-slate-700">
                      {src.locator}
                    </td>
                    <td className="py-2 px-2.5 font-mono text-[11px] text-slate-500">
                      {src.sha256}
                    </td>
                    <td className="py-2 px-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          src.status === 'Vigente'
                            ? 'bg-emerald-100 text-emerald-900'
                            : src.status === 'Nueva versión por evaluar'
                            ? 'bg-blue-100 text-blue-900'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {src.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Suggestions Filter & Cards List */}
      <div className="bg-white border border-slate-200 rounded-md p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Propuestas Explicables de TOTALiA® ({filteredSuggestions.length})</span>
              <HelpTooltip
                title="¿Qué ocurre al pulsar 'Aceptar en Borrador'?"
                description="Si la salida objetivo está Publicada o Aprobada, el configurador crea automáticamente una nueva revisión en estado Borrador (ej. v2.2) y aplica el cambio estructural sobre ese borrador."
                consequence="Puede abrir el Diseñador inmediatamente para verificar el campo actualizado o agregado antes de aprobarlo."
              />
            </h2>
            <p className="text-xs text-slate-600">
              Cada propuesta indica el elemento afectado, el valor actual frente al propuesto, la fuente normativa exacta y el impacto sobre formatos consumidores.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              aria-label="Filtrar sugerencias por categoría"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800"
            >
              <option value="ALL">Todas las categorías</option>
              <option value="Cambio normativo comparado">Cambio normativo comparado</option>
              <option value="Análisis de especificación">Análisis de especificación</option>
              <option value="Propuesta de mapeo">Propuesta de mapeo</option>
              <option value="Reutilización detectada">Reutilización detectada</option>
              <option value="Casos de prueba recomendados">Casos de prueba recomendados</option>
            </select>

            <select
              aria-label="Filtrar sugerencias por estado"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-800"
            >
              <option value="ALL">Todos los estados</option>
              <option value="Pendiente de revisión">Pendiente de revisión</option>
              <option value="Aceptada en borrador">Aceptada en borrador</option>
              <option value="Rechazada">Rechazada</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {filteredSuggestions.map((sug) => {
            const targetOut = configuredOutputs.find((o) => o.id === sug.targetOutputId);
            const isPending = sug.status === 'Pendiente de revisión';

            return (
              <div
                key={sug.id}
                className="border border-slate-200 rounded-md p-4 hover:border-slate-300 transition-colors bg-slate-50/40"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-[#1E4E8C] text-[11px] font-bold">
                        {sug.category}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          sug.evidenceState === 'Sustento explícito'
                            ? 'bg-emerald-100 text-emerald-900'
                            : sug.evidenceState === 'Fuentes en conflicto'
                            ? 'bg-rose-100 text-rose-900'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        Evidencia: {sug.evidenceState}
                      </span>
                      <span className="font-mono text-[11px] text-slate-600">
                        Salida objetivo: <strong>{targetOut?.code}</strong> (v{targetOut?.version})
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900">{sug.title}</h3>
                    <p className="text-xs text-slate-700">{sug.explanation}</p>

                    {/* Diff comparison box */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2 text-xs">
                      <div className="p-2.5 rounded bg-white border border-slate-200">
                        <div className="text-[10px] font-bold uppercase text-slate-500">
                          Elemento Afectado y Valor Vigente
                        </div>
                        <div className="font-mono font-semibold text-slate-800 mt-0.5">
                          {sug.elementAffected}
                        </div>
                        <div className="font-mono text-slate-600 mt-0.5">{sug.currentValue}</div>
                      </div>

                      <div className="p-2.5 rounded bg-blue-50/70 border border-blue-200">
                        <div className="text-[10px] font-bold uppercase text-[#1E4E8C] flex items-center gap-1">
                          <span>Valor Propuesto para Borrador</span>
                          <ArrowRight className="w-3 h-3" />
                        </div>
                        <div className="font-mono font-bold text-slate-900 mt-0.5">
                          {sug.proposedValue}
                        </div>
                      </div>

                      <div className="p-2.5 rounded bg-white border border-slate-200">
                        <div className="text-[10px] font-bold uppercase text-slate-500">
                          Sustento Documental y Consumidores
                        </div>
                        <div className="font-mono text-[11px] text-slate-800 mt-0.5 flex items-center gap-1">
                          <FileText className="w-3 h-3 text-[#1E4E8C]" />
                          {sug.sourceLocator}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          Impacto: {sug.affectedFormatsCount} formato(s) · {sug.consumerImpactSummary}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="flex flex-col items-end justify-between gap-2 shrink-0 min-w-[210px]">
                    <span
                      className={`px-2.5 py-1 rounded text-xs font-bold ${
                        sug.status === 'Aceptada en borrador'
                          ? 'bg-emerald-100 text-emerald-900'
                          : sug.status === 'Rechazada'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {sug.status}
                    </span>

                    {isPending ? (
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() =>
                            decideTotaliaSuggestion(sug.id, 'Aceptada en borrador')
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#1E4E8C] text-white text-xs font-semibold hover:bg-[#163A69] cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Aceptar en Borrador
                        </button>
                        <button
                          type="button"
                          onClick={() => decideTotaliaSuggestion(sug.id, 'Rechazada')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-100 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          Descartar
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 text-right">
                        Decidido por: {sug.decidedBy}
                        <br />
                        <span className="font-mono">{sug.decidedAt}</span>
                      </div>
                    )}

                    {targetOut && (
                      <button
                        type="button"
                        onClick={() => openOutputInBuilder(targetOut.id, 2)}
                        className="text-xs font-semibold text-[#1E4E8C] hover:underline mt-1 cursor-pointer"
                      >
                        Inspeccionar en Diseñador →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Governance Guardrail Footer */}
        <div className="p-3 rounded bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong>Límite operativo de TOTALiA®:</strong> Las propuestas aceptadas se aplican exclusivamente sobre una revisión en estado <strong>Borrador</strong>. La aprobación normativa, publicación de versión y activación por ambiente requieren confirmación explícita de los roles autorizados.
          </div>
        </div>
      </div>
    </div>
  );
};
