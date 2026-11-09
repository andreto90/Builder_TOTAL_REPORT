/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  GitBranch,
  Info,
  LayoutGrid,
  Link2,
  ShieldCheck,
  Sliders,
  Terminal,
  X,
} from 'lucide-react';
import {
  ActiveModuleView,
  ConfiguratorProvider,
  useConfigurator,
} from './context/ConfiguratorContext';
import { UserRole } from './domain/types';
import { DashboardCatalogView } from './components/DashboardCatalogView';
import { OutputTypesCatalogView } from './components/OutputTypesCatalogView';
import { VisualOutputBuilderView } from './components/VisualOutputBuilderView';
import { AssociationsMatrixView } from './components/AssociationsMatrixView';
import { VersionGovernanceView } from './components/VersionGovernanceView';
import { TotaliaAssistantView } from './components/TotaliaAssistantView';
import { ExecutionSimulatorView } from './components/ExecutionSimulatorView';
import { HelpTooltip } from './components/HelpTooltip';
import { getCutoffDateForPeriod } from './domain/engine';

const NAV_ITEMS: {
  id: ActiveModuleView;
  stepNumber: string;
  label: string;
  shortDesc: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'dashboard',
    stepNumber: 'A',
    label: 'Salidas configuradas',
    shortDesc: 'Catálogo principal y creación',
    icon: LayoutGrid,
  },
  {
    id: 'output-types',
    stepNumber: 'B',
    label: 'Tipos de salida',
    shortDesc: 'CSV, TXT, XML, AVRO, XBRL, PDF, XLSX',
    icon: Database,
  },
  {
    id: 'builder',
    stepNumber: 'C',
    label: 'Diseñador de salidas',
    shortDesc: 'Asistente visual en 7 pasos',
    icon: Sliders,
  },
  {
    id: 'associations',
    stepNumber: 'D',
    label: 'Formatos y asociaciones',
    shortDesc: 'Formatos, transmisiones y canales',
    icon: Link2,
  },
  {
    id: 'governance',
    stepNumber: 'E',
    label: 'Versiones y publicación',
    shortDesc: 'Revisiones, aprobación y TOTALiA®',
    icon: GitBranch,
  },
  {
    id: 'simulator',
    stepNumber: 'F',
    label: 'Pruebas y generación',
    shortDesc: 'Simulación, validación y descarga',
    icon: Terminal,
  },
];

const EnterpriseWorkspaceShell: React.FC = () => {
  const {
    activeModule,
    setActiveModule,
    globalPeriod,
    setGlobalPeriod,
    globalEnvironment,
    setGlobalEnvironment,
    globalEntity,
    setGlobalEntity,
    activeUserRole,
    setActiveUserRole,
    lastSavedAt,
    bannerMessage,
    clearBanner,
    totaliaSuggestions,
    configuredOutputs,
  } = useConfigurator();

  const pendingSuggestionsCount = totaliaSuggestions.filter(
    (s) => s.status === 'Pendiente de revisión'
  ).length;
  const reviewPendingOutputsCount = configuredOutputs.filter(
    (o) => o.status === 'En revisión' || o.status === 'Borrador'
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* Top Corporate Header */}
      <header className="bg-[#0F1F38] text-white border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#1E4E8C] border border-blue-400/40 flex items-center justify-center font-bold text-xs tracking-tight">
              TR
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight">TÓTAL REPORT®</span>
                <span className="text-slate-400 text-xs">·</span>
                <span className="text-xs font-medium text-blue-200">
                  Configurador de Salidas y Entregas Regulatorias
                </span>
              </div>
              <div className="text-[11px] text-slate-300 hidden sm:block">
                Diseño guiado de archivos regulatorios, asociación a formatos y validación operativa
              </div>
            </div>
          </div>
        </div>

        {/* Operational Context Bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1 bg-[#172B4D] border border-slate-700 rounded px-2.5 py-1">
            <span className="text-[11px] text-slate-300">Periodo:</span>
            <select
              aria-label="Seleccionar Periodo Global"
              value={globalPeriod}
              onChange={(e) => setGlobalPeriod(e.target.value)}
              className="bg-transparent font-mono font-semibold text-white text-xs focus:outline-none cursor-pointer"
            >
              <optgroup label="Mensual" className="text-slate-900 font-sans">
                <option value="2026-10" className="text-slate-900">
                  2026-10 (Mensual · Corte 2026-10-31)
                </option>
                <option value="2026-11" className="text-slate-900">
                  2026-11 (Mensual · Corte 2026-11-30)
                </option>
                <option value="2026-12" className="text-slate-900">
                  2026-12 (Mensual · Corte 2026-12-31)
                </option>
              </optgroup>
              <optgroup label="Semanal / Bimestral / Trimestral / Semestral / Anual" className="text-slate-900 font-sans">
                <option value="2026-W48" className="text-slate-900">
                  2026-W48 (Semanal · Corte 2026-11-29)
                </option>
                <option value="2026-B6" className="text-slate-900">
                  2026-B6 (Bimestral Nov-Dic · Corte 2026-12-31)
                </option>
                <option value="2026-Q3" className="text-slate-900">
                  2026-Q3 (Trimestral Jul-Sep · Corte 2026-09-30)
                </option>
                <option value="2026-Q4" className="text-slate-900">
                  2026-Q4 (Trimestral Oct-Dic · Corte 2026-12-31)
                </option>
                <option value="2026-S2" className="text-slate-900">
                  2026-S2 (Semestral Jul-Dic · Corte 2026-12-31)
                </option>
                <option value="2026" className="text-slate-900">
                  2026 (Anual · Corte 2026-12-31)
                </option>
              </optgroup>
            </select>
            <HelpTooltip
              align="right"
              title="Periodo solicitado de evaluación y generación"
              description={`Define el periodo solicitado (${globalPeriod}, corte ${getCutoffDateForPeriod(globalPeriod)}) para resolver marcadores dinámicos ({periodo}) y verificar que el lote de origen seleccionado pertenezca exactamente a este periodo y entidad.`}
              consequence="Cambiar este selector NUNCA altera ni reescribe las fechas de corte ni los saldos de un lote existente. Si no existe un lote compatible para la entidad y el periodo seleccionados, se bloquea la conformidad de datos y la generación operativa hasta seleccionar o cargar un lote compatible."
            />
          </div>

          <div className="flex items-center gap-1 bg-[#172B4D] border border-slate-700 rounded px-2.5 py-1">
            <span className="text-[11px] text-slate-300">Ambiente:</span>
            <select
              aria-label="Seleccionar Ambiente Global"
              value={globalEnvironment}
              onChange={(e) => setGlobalEnvironment(e.target.value as 'QA' | 'Producción')}
              className="bg-transparent font-semibold text-white text-xs focus:outline-none cursor-pointer"
            >
              <option value="QA" className="text-slate-900">
                QA (Pruebas)
              </option>
              <option value="Producción" className="text-slate-900">
                Producción
              </option>
            </select>
            <HelpTooltip
              align="right"
              title="Ambiente operativo"
              description="Filtra y resuelve las asociaciones activas según el ambiente (QA o Producción) en las pantallas D (Formatos y asociaciones) y F (Pruebas y generación)."
              consequence="Una asociación activa en QA no se ejecuta en Producción a menos que exista una asociación activa para Producción."
            />
          </div>

          <div className="flex items-center gap-1 bg-[#172B4D] border border-slate-700 rounded px-2.5 py-1">
            <span className="text-[11px] text-slate-300">Entidad:</span>
            <select
              aria-label="Seleccionar Entidad Global"
              value={globalEntity}
              onChange={(e) => setGlobalEntity(e.target.value)}
              className="bg-transparent font-semibold text-white text-xs focus:outline-none cursor-pointer"
            >
              <option value="Entidad DEMO" className="text-slate-900">
                Entidad DEMO
              </option>
              <option value="Banco Supervisado CO" className="text-slate-900">
                Banco Supervisado CO
              </option>
              <option value="Financiera Regulada PE" className="text-slate-900">
                Financiera Regulada PE
              </option>
            </select>
            <HelpTooltip
              align="right"
              title="Entidad reportante"
              description="Identifica la entidad vigilada que genera el reporte. Reemplaza el marcador {entidad} en los nombres de archivo, cabeceras TXT/XML y contextos XBRL."
              example={`Con "${globalEntity}", el marcador {entidad} se resuelve como "${globalEntity.replace(/\s+/g, '_')}".`}
            />
          </div>

          <div className="flex items-center gap-1 bg-[#1E4E8C] border border-blue-400/30 rounded px-2.5 py-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-200 shrink-0" />
            <span className="text-[11px] text-blue-100">Perfil:</span>
            <select
              aria-label="Seleccionar Rol Activo"
              value={activeUserRole}
              onChange={(e) => setActiveUserRole(e.target.value as UserRole)}
              className="bg-transparent font-semibold text-white text-xs focus:outline-none cursor-pointer"
            >
              <option value="Implementador técnico / regulatorio" className="text-slate-900">
                Implementador técnico / regulatorio
              </option>
              <option value="Responsable del formato" className="text-slate-900">
                Responsable del formato
              </option>
              <option value="Aprobador / Gobierno" className="text-slate-900">
                Aprobador / Gobierno
              </option>
              <option value="Administrador de ambiente" className="text-slate-900">
                Administrador de ambiente
              </option>
              <option value="Operador de reporte" className="text-slate-900">
                Operador de reporte
              </option>
            </select>
            <HelpTooltip
              align="right"
              title="Perfil y atribuciones del usuario"
              description="Registra el responsable en la bitácora de auditoría y controla qué acciones de gobierno están habilitadas (por ejemplo: Aprobar y Publicar requieren perfil de Aprobador/Gobierno o Implementador; Instalar/Activar en ambiente corresponden al Administrador de ambiente)."
            />
          </div>
        </div>
      </header>

      {/* Main Layout Container: Left Sidebar + Right Content Area */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Left Navigation Sidebar */}
        <aside className="w-full md:w-64 bg-[#12233D] text-slate-200 shrink-0 flex flex-col justify-between border-r border-slate-800">
          <div className="p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2.5 py-1.5">
              Módulos Principales
            </div>
            <nav className="space-y-1 mt-1" aria-label="Módulos del Configurador">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  activeModule === item.id ||
                  (item.id === 'governance' && activeModule === 'totalia');
                const badgeVal =
                  item.id === 'governance' &&
                  reviewPendingOutputsCount + pendingSuggestionsCount > 0
                    ? String(reviewPendingOutputsCount + pendingSuggestionsCount)
                    : undefined;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveModule(item.id)}
                    className={`w-full text-left px-2.5 py-2.5 rounded transition-colors flex items-start gap-2.5 cursor-pointer ${
                      isActive
                        ? 'bg-[#1E4E8C] text-white font-semibold shadow-xs'
                        : 'text-slate-300 hover:bg-[#193052] hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs leading-tight">
                          {item.stepNumber}. {item.label}
                        </span>
                        {badgeVal && (
                          <span
                            title="Elementos pendientes de revisión o sugerencias TOTALiA®"
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-400 text-slate-950 tabular-nums shrink-0"
                          >
                            {badgeVal}
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-[11px] leading-snug mt-0.5 ${
                          isActive ? 'text-blue-100' : 'text-slate-400'
                        }`}
                      >
                        {item.shortDesc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* Quick User Workflow Guide */}
            <div className="mt-5 p-3 rounded bg-[#0F1F38] border border-slate-700/80 text-[11px] space-y-1.5">
              <div className="font-bold text-blue-200 uppercase text-[10px] tracking-wider">
                Flujo de trabajo recomendado
              </div>
              <ol className="space-y-1.5 text-slate-300 text-[11px] list-decimal list-inside">
                <li>
                  En <strong className="text-white">A. Salidas configuradas</strong>, pulse{' '}
                  <span className="text-blue-200 font-semibold">Crear nueva salida</span> o seleccione una existente.
                </li>
                <li>
                  En <strong className="text-white">C. Diseñador de salidas</strong> (7 pasos), defina estructura, origen de datos, validaciones y entrega.
                </li>
                <li>
                  En <strong className="text-white">D. Formatos y asociaciones</strong>, vincule la versión publicada a uno o varios reportes sin duplicarla.
                </li>
                <li>
                  En <strong className="text-white">F. Pruebas y generación</strong>, ejecute la validación completa y descargue el archivo cuando aplique.
                </li>
              </ol>
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-slate-800 bg-[#0C182B] text-[11px]">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-2 font-semibold text-white">
                <FileSpreadsheet className="w-4 h-4 text-blue-400 shrink-0" />
                <span>TÓTAL REPORT®</span>
              </div>
              <HelpTooltip
                align="left"
                title="Persistencia local en navegador"
                description="Todos los cambios realizados en salidas, revisiones, asociaciones y corridas se guardan automáticamente en el almacenamiento local del navegador (localStorage). Desde la pantalla A puede exportar un respaldo JSON o restaurar los datos iniciales de demostración."
              />
            </div>
            <div className="text-[10px] text-emerald-300 font-mono mt-1">
              Guardado en navegador: {lastSavedAt}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-4 lg:p-6 space-y-4 overflow-y-auto">
          {/* Notification Banner */}
          {bannerMessage && (
            <div
              role="status"
              className={`p-3 rounded-md border flex items-center justify-between gap-3 text-xs font-medium ${
                bannerMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : bannerMessage.type === 'error'
                  ? 'bg-rose-50 border-rose-300 text-rose-950'
                  : bannerMessage.type === 'warning'
                  ? 'bg-amber-50 border-amber-300 text-amber-950'
                  : 'bg-blue-50 border-blue-300 text-blue-950'
              }`}
            >
              <div className="flex items-center gap-2">
                {bannerMessage.type === 'success' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                )}
                {bannerMessage.type === 'error' && (
                  <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                )}
                {bannerMessage.type === 'warning' && (
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                )}
                {bannerMessage.type === 'info' && (
                  <Info className="w-4 h-4 text-blue-700 shrink-0" />
                )}
                <span>{bannerMessage.text}</span>
              </div>
              <button
                type="button"
                onClick={clearBanner}
                className="p-1 rounded hover:bg-black/5 text-current cursor-pointer"
                aria-label="Cerrar notificación"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Render Active Module */}
          {activeModule === 'dashboard' && <DashboardCatalogView />}
          {activeModule === 'output-types' && <OutputTypesCatalogView />}
          {activeModule === 'builder' && <VisualOutputBuilderView />}
          {activeModule === 'associations' && <AssociationsMatrixView />}
          {activeModule === 'governance' && <VersionGovernanceView />}
          {activeModule === 'totalia' && <TotaliaAssistantView />}
          {activeModule === 'simulator' && <ExecutionSimulatorView />}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ConfiguratorProvider>
      <EnterpriseWorkspaceShell />
    </ConfiguratorProvider>
  );
}
