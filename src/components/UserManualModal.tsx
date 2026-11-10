import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileCode2,
  HelpCircle,
  Info,
  Layers,
  Printer,
  ShieldAlert,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react';

interface UserManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManualModal: React.FC<UserManualModalProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState<string>('intro');

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-title"
      className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#0B1E36] text-white flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 id="manual-title" className="text-base font-bold flex items-center gap-2">
                Manual de Operación y Guía Ilustrada del Configurador
                <span className="text-[10px] bg-blue-500/30 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded-full font-medium">
                  TÓTAL REPORT® & TOTALiA®
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Guía completa de funcionamiento, arquitectura de coherencia, asistente en 7 pasos y asistencia contextual
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 transition-colors"
              title="Imprimir o guardar como PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Cerrar manual de usuario"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Sidebar Index + Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Index Sidebar */}
          <nav
            aria-label="Índice del manual"
            className="w-72 bg-slate-50 border-r border-slate-200 p-3 overflow-y-auto shrink-0 hidden md:block"
          >
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              Contenido del Manual
            </p>
            <ul className="space-y-1 text-xs">
              {[
                { id: 'intro', label: '1. Propósito y Roles del Dominio', icon: Workflow },
                { id: 'modulo-a', label: '2. Catálogo de Salidas (Módulo A)', icon: Layers },
                { id: 'paso-1', label: '3. Paso 1: Datos y Formato', icon: FileCode2 },
                { id: 'paso-2', label: '4. Paso 2: Diseñador de Estructura', icon: Layers },
                { id: 'paso-3', label: '5. Paso 3: Origen, Lotes y Mapeo', icon: Workflow },
                { id: 'paso-4', label: '6. Paso 4: Validaciones y DAQUE', icon: ShieldAlert },
                { id: 'paso-5', label: '7. Paso 5: Nomenclatura y Canal', icon: ExternalLink },
                { id: 'paso-6', label: '8. Paso 6: Pruebas y Generación', icon: CheckCircle2 },
                { id: 'totalia', label: '9. Asistente Contextual TOTALiA®', icon: Sparkles },
                { id: 'modulo-d', label: '10. Reutilización y Asociaciones (D)', icon: ExternalLink },
                { id: 'diagnosticos', label: '11. Diagnósticos y Solución de Errores', icon: HelpCircle },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = activeSection === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => setActiveSection(item.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white font-medium shadow-sm'
                          : 'text-slate-600 hover:bg-slate-200/70'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-800">
              <p className="font-semibold mb-1 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-blue-600" />
                Principio Central
              </p>
              <p className="text-[11px] text-blue-700 leading-relaxed">
                El diseñador configura <strong>estructuras reutilizables</strong>. El origen aporta los datos, y la asociación define las condiciones de presentación.
              </p>
            </div>
          </nav>

          {/* Reading Pane */}
          <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-10 text-slate-800 bg-white">
            {/* Section 1: Intro */}
            {(activeSection === 'intro' || activeSection === 'all') && (
              <section id="intro" className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Capítulo 1</span>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">
                    Propósito del Configurador y Separación Funcional
                  </h3>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  El <strong>Configurador de Salidas y Entregas Regulatorias de TÓTAL REPORT®</strong> permite definir, mantener, versionar y generar los archivos normativos exigidos por organismos de supervisión (como SFC, Supersolidaria, DIAN en Colombia o SBS, BCRP en Perú) de manera declarativa, sin requerir desarrollos de código ante nuevos requerimientos de entrega.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
                  <div className="p-3.5 rounded-lg border border-indigo-200 bg-indigo-50/50">
                    <span className="text-[11px] font-bold text-indigo-700 uppercase">1. Destino Regulatorio</span>
                    <p className="text-xs font-semibold text-slate-800 mt-1">Módulo D</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      El formato oficial que recibe la entrega, el tipo de transmisión y el canal de envío.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg border border-blue-200 bg-blue-50/50">
                    <span className="text-[11px] font-bold text-blue-700 uppercase">2. Estructura de Salida</span>
                    <p className="text-xs font-semibold text-slate-800 mt-1">Configurador (Módulo C)</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Columnas, tipos, longitudes, formato físico, orden y reglas de validación técnica.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
                    <span className="text-[11px] font-bold text-emerald-700 uppercase">3. Origen de Información</span>
                    <p className="text-xs font-semibold text-slate-800 mt-1">Paso 3 del Asistente</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Informe generado por TÓTAL REPORT® o fuente externa del cliente que provee los datos.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/50">
                    <span className="text-[11px] font-bold text-amber-700 uppercase">4. Lote de Ejecución</span>
                    <p className="text-xs font-semibold text-slate-800 mt-1">Entidad / Periodo</p>
                    <p className="text-[11px] text-slate-600 mt-1">
                      Registros de datos concretos de una entidad para una fecha de corte específica.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                  <h4 className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Regla de oro de diseño: Desacoplamiento entre estructura y datos
                  </h4>
                  <p className="text-slate-600 leading-relaxed">
                    Usted puede <strong>diseñar, tipificar campos, estructurar secciones y guardar borradores de configuración en el almacenamiento local del navegador en cualquier momento</strong>, incluso cuando aún no existan lotes de datos para el periodo. La generación física operativa es la única acción que requiere la presencia de un lote con registros compatibles.
                  </p>
                </div>
              </section>
            )}

            {/* Section 2: Modulo A */}
            {(activeSection === 'modulo-a' || activeSection === 'all') && (
              <section id="modulo-a" className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Capítulo 2</span>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">
                    Catálogo de Salidas Configuradas (Módulo A)
                  </h3>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  Es la pantalla principal del configurador. Ofrece una vista consolidada de todas las salidas creadas, su familia técnica de archivo, la versión vigente, su estado de gobierno y los formatos regulatorios en los que se reutiliza.
                </p>

                <div className="rounded-lg overflow-hidden border border-slate-300 shadow-md">
                  <img
                    src="/manual/01_catalogo_salidas.png"
                    alt="Pantalla del Catálogo de Salidas Configuradas"
                    className="w-full h-auto object-cover"
                  />
                  <div className="p-3 bg-slate-100 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                    <span>
                      <strong>Figura 1:</strong> Catálogo principal con métricas de ciclo de vida y tabla de acciones
                    </span>
                    <span className="text-[11px] text-slate-500">Módulo A · TÓTAL REPORT®</span>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Acciones Disponibles:</h4>
                  <ul className="text-xs text-slate-600 space-y-2 list-disc pl-5">
                    <li>
                      <strong>Crear nueva salida:</strong> Inicia el asistente guiado en 7 pasos desde cero, seleccionando la familia técnica (CSV, TXT, XML, AVRO, XBRL, PDF o XLSX).
                    </li>
                    <li>
                      <strong>Consultar / Editar:</strong> Si la salida está en estado <em>Borrador</em> o <em>En revisión</em>, se abre en modo edición. Si está <em>Publicada</em> o <em>Aprobada</em>, se abre en modo consulta protegido para evitar alteraciones accidentales sobre reportes vigentes.
                    </li>
                    <li>
                      <strong>Crear revisión:</strong> Deriva una salida publicada hacia una nueva revisión en borrador (ej. pasar de v1.4 a v1.5), salvaguardando las entregas vigentes.
                    </li>
                    <li>
                      <strong>Asociar:</strong> Conecta directamente la versión de la salida a un formato regulatorio específico desde el catálogo.
                    </li>
                  </ul>
                </div>
              </section>
            )}

            {/* Section 3: Paso 1 */}
            {(activeSection === 'paso-1' || activeSection === 'all') && (
              <section id="paso-1" className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Capítulo 3</span>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">
                    Paso 1: Datos Generales y Propiedades de Archivo
                  </h3>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  En el primer paso del diseñador se establece la identidad de la salida y sus parámetros técnicos físicos. En la parte superior se despliega de forma permanente el <strong>Marco de Coherencia Operativa</strong> y la <strong>Guía de Paso</strong>.
                </p>

                <div className="rounded-lg overflow-hidden border border-slate-300 shadow-md">
                  <img
                    src="/manual/02_marco_coherencia_paso1.png"
                    alt="Paso 1 del Diseñador de Salidas"
                    className="w-full h-auto object-cover"
                  />
                  <div className="p-3 bg-slate-100 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                    <span>
                      <strong>Figura 2:</strong> Paso 1 con Marco de Coherencia y panel de estado de avance
                    </span>
                    <span className="text-[11px] text-slate-500">Módulo C · Paso 1</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-2">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                    <span className="font-semibold text-slate-800">1. Identificación</span>
                    <p className="text-slate-600 mt-1">Nombre funcional, código único identificador (ej. DEMO-CE-02) y entidad supervisora destinataria.</p>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                    <span className="font-semibold text-slate-800">2. Familia Técnica</span>
                    <p className="text-slate-600 mt-1">Determina los controles técnicos activos: delimitador, codificación de caracteres (UTF-8 / Latin-1) y separador decimal.</p>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                    <span className="font-semibold text-slate-800">3. Estado de Avance</span>
                    <p className="text-slate-600 mt-1">Informa los 5 estados de progreso y el estado independiente de Guardar borrador, Generación y Publicación.</p>
                  </div>
                </div>
              </section>
            )}

            {/* Section 4: Paso 2 */}
            {(activeSection === 'paso-2' || activeSection === 'all') && (
              <section id="paso-2" className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Capítulo 4</span>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">
                    Paso 2: Estructura del Archivo y Campos
                  </h3>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  Permite definir y ordenar las columnas o campos del archivo. Cuenta con una tabla de campos interactiva, un <strong>Inspector de Propiedades</strong> detallado a la derecha y una <strong>Vista previa sintética en vivo</strong> que reacciona a cada ajuste.
                </p>

                <div className="rounded-lg overflow-hidden border border-slate-300 shadow-md">
                  <img
                    src="/manual/03_paso2_disenador_campos.png"
                    alt="Paso 2 del Diseñador: Tabla de campos e Inspector de propiedades"
                    className="w-full h-auto object-cover"
                  />
                  <div className="p-3 bg-slate-100 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                    <span>
                      <strong>Figura 3:</strong> Estructura de campos, inspector lateral y vista previa reactiva
                    </span>
                    <span className="text-[11px] text-slate-500">Módulo C · Paso 2</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-600">
                  <h4 className="font-bold uppercase tracking-wider text-slate-700">Controles Clave:</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Nombre técnico:</strong> Identificador interno sin espacios ni caracteres especiales (ej. <code>id_obligacion</code>, <code>saldo_capital</code>).</li>
                    <li><strong>Tipo de dato lógico:</strong> Texto, Entero, Decimal, Fecha, Booleano o Catálogo.</li>
                    <li><strong>Longitud máxima:</strong> Longitud máxima en caracteres o bytes. El motor garantiza que nunca se produzca un truncamiento silencioso; ante un desbordamiento se emite una alerta bloqueante.</li>
                    <li><strong>Máscara de fecha/número:</strong> Formatos admitidos como <code>dd-MM-yyyy</code>, <code>yyyy-MM-dd</code> o separador decimal por coma/punto.</li>
                    <li><strong>Ceros a la izquierda:</strong> Los identificadores numéricos deben definirse como tipo <strong>Texto</strong> para preservar ceros significativos (ej. <code>'000123'</code>).</li>
                  </ul>
                </div>
              </section>
            )}

            {/* Section 5: Paso 3 */}
            {(activeSection === 'paso-3' || activeSection === 'all') && (
              <section id="paso-3" className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Capítulo 5</span>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">
                    Paso 3: Origen de Información, Lotes y Mapeo de Campos
                  </h3>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  El Paso 3 conecta la estructura definida con la fuente que aportará los datos. Se divide en dos rutas principales:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 border border-blue-200 bg-blue-50/40 rounded-lg space-y-2">
                    <span className="font-bold text-blue-800 text-sm">Ruta A: Formatos del Sistema</span>
                    <p className="text-slate-600">
                      Utiliza un informe o formato ya generado por <strong>TÓTAL REPORT®</strong>. Reutiliza cálculos preexistentes sin duplicar reglas contables o financieras.
                    </p>
                    <p className="text-[11px] text-blue-700 font-medium">
                      ✓ Contador dinámico: Muestra claramente cuántos informes tienen estructura disponible y cuántos cuentan con lote compatible para el corte activo.
                    </p>
                  </div>
                  <div className="p-4 border border-purple-200 bg-purple-50/40 rounded-lg space-y-2">
                    <span className="font-bold text-purple-800 text-sm">Ruta B: Fuentes del Cliente</span>
                    <p className="text-slate-600">
                      Permite incorporar estructuras externas mediante 4 vías: importar plantilla/esquema (JSON/Excel), inferir desde muestra, seleccionar una fuente ya registrada o registrarla manualmente.
                    </p>
                    <p className="text-[11px] text-purple-700 font-medium">
                      ✓ Separa la definición del esquema del archivo de carga del lote con los registros.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg overflow-hidden border border-slate-300 shadow-md">
                  <img
                    src="/manual/04_paso3_origen_informes.png"
                    alt="Paso 3: Selección de informe de origen y contador dinámico"
                    className="w-full h-auto object-cover"
                  />
                  <div className="p-3 bg-slate-100 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                    <span>
                      <strong>Figura 4a:</strong> Selección de origen con trazabilidad de 5 niveles y disponibilidad de lotes
                    </span>
                    <span className="text-[11px] text-slate-500">Módulo C · Paso 3 (Ruta A)</span>
                  </div>
                </div>

                <div className="rounded-lg overflow-hidden border border-slate-300 shadow-md pt-2">
                  <img
                    src="/manual/04b_paso3_mapeo_campos.png"
                    alt="Paso 3: Tabla de correspondencia de campos y transformaciones"
                    className="w-full h-auto object-cover"
                  />
                  <div className="p-3 bg-slate-100 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                    <span>
                      <strong>Figura 4b:</strong> Tabla de correspondencia (Mapeo) con valores de muestra de entrada y salida
                    </span>
                    <span className="text-[11px] text-slate-500">Módulo C · Paso 3 (Mapeo)</span>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1.5">
                  <h4 className="font-bold text-amber-900 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-700" />
                    Comportamiento ante periodos sin lote (Ejemplo: Periodo 2026-12)
                  </h4>
                  <p className="text-amber-800 leading-relaxed">
                    Al seleccionar un periodo que no tiene lote cargado en el sistema, la pantalla indicará:
                    <br />
                    <code>"Informes del sistema: 7 con estructura disponible · 0 con datos para este periodo"</code>
                    <br />
                    Usted puede mapear todos los campos y guardar la configuración sin inconvenientes. El diagnóstico advertirá el código <code>CES-DAT-000</code> y mantendrá bloqueada únicamente la descarga del archivo físico hasta que se cargue el lote correspondiente.
                  </p>
                </div>
              </section>
            )}

            {/* Section 6: Paso 4 */}
            {(activeSection === 'paso-4' || activeSection === 'all') && (
              <section id="paso-4" className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Capítulo 6</span>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">
                    Paso 4: Validaciones y Reglas Técnicas
                  </h3>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  Gestiona las reglas de consistencia de la salida. Distingue con claridad las reglas propias del archivo (longitud, expresiones regulares, formatos) de las reglas de datos del formato (DAQUE), evitando que condiciones específicas de un reporte contaminen una estructura que es reutilizada por varios formatos.
                </p>

                <div className="rounded-lg overflow-hidden border border-slate-300 shadow-md">
                  <img
                    src="/manual/05_paso4_reglas_validacion.png"
                    alt="Paso 4 del Diseñador: Reglas de validación y DAQUE"
                    className="w-full h-auto object-cover"
                  />
                  <div className="p-3 bg-slate-100 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                    <span>
                      <strong>Figura 5:</strong> Reglas activas con severidad bloqueante/advertencia y panel DAQUE
                    </span>
                    <span className="text-[11px] text-slate-500">Módulo C · Paso 4</span>
                  </div>
                </div>
              </section>
            )}

            {/* Section 7: Paso 5 */}
            {(activeSection === 'paso-5' || activeSection === 'all') && (
              <section id="paso-5" className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Capítulo 7</span>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">
                    Paso 5: Nomenclatura Dinámica, Empaquetado y Canales
                  </h3>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  Define cómo se nombrará el archivo generado utilizando variables dinámicas que se resuelven en tiempo de ejecución: <code>{'{entidad}'}</code>, <code>{'{formato}'}</code>, <code>{'{periodo}'}</code> y <code>{'{version}'}</code>.
                </p>

                <div className="rounded-lg overflow-hidden border border-slate-300 shadow-md">
                  <img
                    src="/manual/06_paso5_generacion_entrega.png"
                    alt="Paso 5 del Diseñador: Nomenclatura dinámica y canales"
                    className="w-full h-auto object-cover"
                  />
                  <div className="p-3 bg-slate-100 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                    <span>
                      <strong>Figura 6:</strong> Resolución en vivo del nombre de archivo y empaquetado
                    </span>
                    <span className="text-[11px] text-slate-500">Módulo C · Paso 5</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-600">
                  <p>
                    <strong>Política de Dataset Vacío (emptyDatasetPolicy):</strong> Determina qué hacer si en un periodo no existen registros:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><em>Producir vacío válido:</em> Genera el archivo con encabezado técnico sin filas (para entes que exigen reporte sin operaciones).</li>
                    <li><em>Bloquear generación:</em> Detiene la generación si existen 0 filas.</li>
                    <li><em>Omitir archivo:</em> No produce el archivo para ese corte.</li>
                  </ul>
                </div>
              </section>
            )}

            {/* Section 8: Paso 6 */}
            {(activeSection === 'paso-6' || activeSection === 'all') && (
              <section id="paso-6" className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Capítulo 8</span>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">
                    Paso 6: Pruebas, Matriz de Preparación y Descarga
                  </h3>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  El Paso 6 consolida la <strong>Matriz de Preparación Técnica (Readiness Matrix)</strong> en 6 niveles independientes, permitiendo inspeccionar el contenido físico real generado por el serializador o una vista previa estructural cuando falta el lote.
                </p>

                <div className="rounded-lg overflow-hidden border border-slate-300 shadow-md">
                  <img
                    src="/manual/07_paso6_pruebas_generacion.png"
                    alt="Paso 6 del Diseñador: Matriz de preparación y descarga de archivo físico"
                    className="w-full h-auto object-cover"
                  />
                  <div className="p-3 bg-slate-100 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                    <span>
                      <strong>Figura 7:</strong> Matriz de 6 niveles, diagnóstico detallado y visor de archivo serializado
                    </span>
                    <span className="text-[11px] text-slate-500">Módulo C · Paso 6</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 text-xs pt-1">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                    <span className="font-semibold text-slate-800">1. Vista previa</span>
                    <p className="text-[11px] text-slate-600 mt-0.5">Disponibilidad de visualización del archivo o plantilla.</p>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                    <span className="font-semibold text-slate-800">2. Val. Configuración</span>
                    <p className="text-[11px] text-slate-600 mt-0.5">Esquema, nombres, longitudes y orígenes sin errores.</p>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                    <span className="font-semibold text-slate-800">3. Val. Datos (DAQUE)</span>
                    <p className="text-[11px] text-slate-600 mt-0.5">Reglas de negocio del formato superadas sobre el lote.</p>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                    <span className="font-semibold text-slate-800">4. Archivo Físico</span>
                    <p className="text-[11px] text-slate-600 mt-0.5">Construcción real del artefacto en memoria del cliente.</p>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                    <span className="font-semibold text-slate-800">5. Descarga Directa</span>
                    <p className="text-[11px] text-slate-600 mt-0.5">Habilitada con lote conforme; bloqueada ante CES-DAT-000.</p>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                    <span className="font-semibold text-slate-800">6. Estado de Entrega</span>
                    <p className="text-[11px] text-slate-600 mt-0.5">Aptitud final para transmisión al regulador.</p>
                  </div>
                </div>
              </section>
            )}

            {/* Section 9: TOTALiA */}
            {(activeSection === 'totalia' || activeSection === 'all') && (
              <section id="totalia" className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Capítulo 9</span>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">
                    Asistente Contextual TOTALiA®
                  </h3>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  <strong>TOTALiA®</strong> es el asistente especializado de TÓTAL REPORT® que proporciona recomendaciones técnicas basadas en evidencia reglamentaria (instructivos oficiales, contratos de datos y esquemas XSD/Avro), sin aplicar cambios de manera autónoma ni sobreescribir configuraciones aprobadas.
                </p>

                <div className="rounded-lg overflow-hidden border border-slate-300 shadow-md">
                  <img
                    src="/manual/08_asistente_totalia.png"
                    alt="Asistente Contextual TOTALiA desplegado"
                    className="w-full h-auto object-cover"
                  />
                  <div className="p-3 bg-slate-100 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                    <span>
                      <strong>Figura 8:</strong> TOTALiA® con diagnóstico en 4 frentes y salvaguarda de versiones publicadas
                    </span>
                    <span className="text-[11px] text-slate-500">Asistencia Contextual TOTALiA®</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-700">
                  <h4 className="font-bold uppercase tracking-wider text-slate-800">8 Acciones Contextuales Soportadas:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                      <strong>1. Indicar el siguiente paso:</strong> Evalúa el avance en Estructura, Origen, Lote y Publicación.
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                      <strong>2. Revisar mi estructura:</strong> Audita campos obligatorios, longitudes y tipos lógicos.
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                      <strong>3. Sugerir correspondencias:</strong> Propone mapeos semánticos respetando ceros iniciales.
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                      <strong>4. Explicar este error:</strong> Desglosa causa, consecuencia y guía paso a paso de corrección.
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                      <strong>5. Ayúdame a crear esta salida:</strong> Proporciona plantillas preconfiguradas basadas en normas.
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                      <strong>6. Evaluar impacto:</strong> Detecta qué formatos y transmisiones dependen de esta salida.
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                      <strong>7. Comparar revisión:</strong> Contrasta la versión actual frente a la versión publicada vigente.
                    </div>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                      <strong>8. Analizar cambios de origen:</strong> Alerta si columnas de la fuente sufrieron cambios.
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Section 10: Modulo D */}
            {(activeSection === 'modulo-d' || activeSection === 'all') && (
              <section id="modulo-d" className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Capítulo 10</span>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">
                    Reutilización de Salidas y Asociaciones (Módulo D)
                  </h3>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">
                  El Módulo D permite vincular una misma salida configurada a múltiples formatos regulatorios sin tener que duplicar la definición de columnas. Incluye un <strong>Comprobador de compatibilidad y vigencia</strong> que garantiza la regla de coincidencia única (una sola salida activa para un formato, modalidad y periodo).
                </p>

                <div className="rounded-lg overflow-hidden border border-slate-300 shadow-md">
                  <img
                    src="/manual/09_modulo_d_formatos_asociaciones.png"
                    alt="Módulo D: Matriz de Asociaciones y Comprobador de Coincidencia Única"
                    className="w-full h-auto object-cover"
                  />
                  <div className="p-3 bg-slate-100 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between">
                    <span>
                      <strong>Figura 9:</strong> Comprobador de coincidencia única y tabla de reutilización por referencia
                    </span>
                    <span className="text-[11px] text-slate-500">Módulo D · Formatos y Asociaciones</span>
                  </div>
                </div>

                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1">
                  <span className="font-bold text-emerald-900">Ejemplo práctico de reutilización:</span>
                  <p className="text-emerald-800 leading-relaxed">
                    La salida <code>DEMO-CE-01 (v3.0)</code> está asociada simultáneamente a los formatos <strong>DEMO-01</strong>, <strong>DEMO-02</strong> y <strong>DEMO-03</strong>. Cada formato puede aplicar parámetros propios (como prefijos o perfiles DAQUE específicos) sin necesidad de mantener tres copias separadas del archivo.
                  </p>
                </div>
              </section>
            )}

            {/* Section 11: Diagnósticos */}
            {(activeSection === 'diagnosticos' || activeSection === 'all') && (
              <section id="diagnosticos" className="space-y-4">
                <div className="border-b border-slate-200 pb-3">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Capítulo 11</span>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">
                    Diagnósticos Operativos y Solución de Errores Comunes
                  </h3>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Código</th>
                        <th className="p-3">Causa Raíz</th>
                        <th className="p-3">Efecto Operativo</th>
                        <th className="p-3">Acción de Solución</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-600">
                      <tr>
                        <td className="p-3 font-mono font-bold text-blue-700">CES-DAT-000</td>
                        <td className="p-3">No existe lote de datos compatible para la entidad y el periodo seleccionados.</td>
                        <td className="p-3">Se permite guardar borrador; se bloquea la generación física y descarga.</td>
                        <td className="p-3">Ir al Paso 3 y seleccionar un informe con lote o cargar los registros en la pestaña inferior.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-bold text-blue-700">CES-MAP-001</td>
                        <td className="p-3">Campo obligatorio sin correspondencia asignada.</td>
                        <td className="p-3">Bloquea validación de configuración.</td>
                        <td className="p-3">En el Paso 3, asigne un campo de la fuente o configure un valor constante/fórmula.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-bold text-blue-700">CES-VAL-001</td>
                        <td className="p-3">Un valor del lote excede la longitud máxima configurada en caracteres o bytes.</td>
                        <td className="p-3">Se bloquea la serialización sin truncar datos en silencio.</td>
                        <td className="p-3">Ajuste la longitud en el Paso 2 o depure el registro anómalo en la fuente.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-bold text-blue-700">DAQUE-PRE-001</td>
                        <td className="p-3">La evidencia de validación de datos del formato caducó o no coincide.</td>
                        <td className="p-3">Bloquea la entrega por precondición de calidad de datos.</td>
                        <td className="p-3">Ejecute la validación DAQUE sobre el corte actual en el Módulo F.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </main>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">TÓTAL REPORT®</span>
            <span>·</span>
            <span>Plataforma Empresarial de Cumplimiento y Supervisión Regulatoria</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
          >
            Cerrar Manual
          </button>
        </div>
      </div>
    </div>
  );
};
