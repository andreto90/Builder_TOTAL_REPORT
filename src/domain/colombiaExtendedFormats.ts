import { RegulatoryFormat, TechnicalFamily } from './types';

interface ColombiaFormatBlueprint {
  id: string;
  code: string;
  name: string;
  regulator: string;
  issuingOrganism?: string;
  periodicity: string;
  reportingModality?: 'Periódico' | 'Por evento';
  families: TechnicalFamily[];
  entityTypes: string[];
  obligation: string;
  description: string;
  requirements: string[];
  normativeVersion?: string;
  sourceUrl: string;
  additionalApplicabilityConditions?: string;
}

function buildColombiaFormat(bp: ColombiaFormatBlueprint): RegulatoryFormat {
  const version = bp.normativeVersion || 'v2026.1';
  const isEvent = bp.reportingModality === 'Por evento' || bp.periodicity === 'Por evento';
  const transIds: string[] = ['TX-ORDINARIO', 'TX-CORRECCION'];
  if (!isEvent) {
    transIds.push('TX-RETRANSMISION');
  }

  return {
    id: bp.id,
    code: bp.code,
    internalCode: `INT-${bp.id.replace(/^FMT-/, '')}`,
    name: bp.name,
    jurisdiction: 'Colombia',
    country: 'Colombia',
    regulator: bp.regulator,
    issuingOrganism: bp.issuingOrganism,
    obligation: bp.obligation,
    periodicity: bp.periodicity,
    reportingModality: bp.reportingModality || 'Periódico',
    normativeVersion: version,
    daqueProfileId: 'DAQUE-PROF-01',
    enabledTransmissionTypes: transIds,
    applicableEntityTypes: bp.entityTypes,
    additionalApplicabilityConditions: bp.additionalApplicabilityConditions,
    classificationStatus: 'Clasificado y validado',
    classificationNotes: bp.issuingOrganism
      ? `Documento técnico emitido por ${bp.issuingOrganism} y recibido operativamente por ${bp.regulator}.`
      : `Formato oficial contrastado para ${bp.regulator} (Colombia).`,
    classificationValidatedBy: 'Equipo de Regulación Colombia TÓTAL REPORT®',
    classificationValidatedAt: '2026-11-13',
    lifecycleStatus: 'Activo',
    normativeAvailability: 'Vigente',
    specificationValidity: {
      validFrom: '2026-01-01',
      validTo: 'Abierta',
      versionLabel: version,
    },
    technicalReadinessStatus: 'Especificación técnica completa',
    supportedFamilies: bp.families,
    documentedRequirements: bp.requirements,
    provenanceKind: 'Oficial',
    provenanceRef: `${bp.regulator} · ${bp.obligation}`,
    sourceUrl: bp.sourceUrl,
    consultationDate: '2026-11-13',
    verificationLevel: 'Oficial contrastado',
    description: bp.description,
  };
}

const SFC_INDEX_URL =
  'https://www.superfinanciera.gov.co/publicaciones/15002/industrias-supervisadasinteres-del-vigiladoreportesindice-de-reportes-de-informacion-a-la-superintendencia-financieraguias-para-el-reporte-de-informacion-15002/';
const SFC_DOCS_URL =
  'https://www.superfinanciera.gov.co/publicaciones/15001/industrias-supervisadasinteres-del-vigiladoreportesindice-de-reportes-de-informacion-a-la-superintendencia-financieraguias-para-el-reporte-de-informaciondocumentos-tecnicos-15001/';
const DIAN_EXOGENA_URL =
  'https://www.dian.gov.co/impuestos/sociedades/ExogenaTributaria/Presentacion/Paginas/default.aspx';
const DIAN_PORTAL_URL = 'https://www.dian.gov.co/';
const UIAF_SIREL_URL = 'https://www.uiaf.gov.co/sirel';
const FOGAFIN_URL = 'https://www.fogafin.gov.co/entidades-inscritas';
const FOGACOOP_URL = 'https://www.fogacoop.gov.co/';
const SUPERSOL_URL = 'https://www.supersolidaria.gov.co/';
const BANREP_URL = 'https://www.banrep.gov.co/';
const SUPERSOC_URL = 'https://www.supersociedades.gov.co/';
const SHD_URL = 'https://www.haciendabogota.gov.co/';
const SUPERSALUD_URL = 'https://www.supersalud.gov.co/';
const CGN_CHIP_URL = 'https://www.chip.gov.co/';
const UGPP_URL = 'https://www.ugpp.gov.co/';
const SUPERTRANSPORTE_URL = 'https://www.supertransporte.gov.co/';
const COLJUEGOS_URL = 'https://www.coljuegos.gov.co/';
const BVC_AMV_URL = 'https://www.bvc.com.co/';

const COLOMBIA_EXTENDED_BLUEPRINTS: ColombiaFormatBlueprint[] = [
  // ============================================================================
  // 1. SFC - SUPERINTENDENCIA FINANCIERA DE COLOMBIA (Complemento a 238, 239, 341, 458, 526)
  // ============================================================================
  {
    id: 'FMT-CO-SFC-CUIF',
    code: 'CUIF / F.1000',
    name: 'Catálogo Único de Información Financiera con Fines de Supervisión (CUIF)',
    regulator: 'SFC - Superintendencia Financiera de Colombia',
    periodicity: 'Mensual',
    families: ['TXT', 'XML', 'XBRL'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Cooperativas Financieras',
      'Entidades Aseguradoras y Reaseguradoras',
      'Sociedades Fiduciarias',
      'Sociedades Comisionistas de Bolsa y FIC',
      'Administradoras de Fondos de Pensiones y Cesantías (AFP)',
      'Sociedades Especializadas en Depósitos y Pagos Electrónicos (SEDPE)',
    ],
    obligation: 'Circular Básica Contable y Financiera SFC (CE 100/1995) · Plan de Cuentas NIIF/CUIF',
    description:
      'Transmisión mensual de saldos contables a nivel de subcuenta bajo el Catálogo Único de Información Financiera (CUIF) en convergencia NIIF.',
    requirements: [
      'Validación de cuadre contable activo = pasivo + patrimonio por fideicomiso y entidad',
      'Archivo plano posicional / XML según Documento Técnico CUIF de la SFC',
    ],
    sourceUrl: SFC_DOCS_URL,
  },
  {
    id: 'FMT-CO-SFC-102',
    code: '102',
    name: 'Formato 102 (Proforma F.1000-37) · Informe Diario de Compra y Venta de Divisas',
    regulator: 'SFC - Superintendencia Financiera de Colombia',
    periodicity: 'Diaria',
    families: ['TXT'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Sociedades Comisionistas de Bolsa y FIC',
    ],
    obligation: 'CBCF SFC · Proforma F.1000-37 · Intermediarios del Mercado Cambiario (IMC)',
    description:
      'Reporte diario de operaciones de compra y venta de divisas en el mercado cambiario para seguimiento prudencial y cálculo de tasa representativa (TRM).',
    requirements: [
      'Transmisión diaria antes del horario límite de cierre cambiario SFC/BanRep',
      'Desagregación por modalidad (contado, siguiente día, contraparte y monto USD)',
    ],
    sourceUrl: SFC_INDEX_URL,
  },
  {
    id: 'FMT-CO-SFC-281',
    code: '281',
    name: 'Formato 281 (Proforma F.1000-44) · Informe Semanal Principales Cuentas Activas y Pasivas',
    regulator: 'SFC - Superintendencia Financiera de Colombia',
    periodicity: 'Semanal',
    families: ['TXT'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Cooperativas Financieras',
    ],
    obligation: 'CBCF SFC · Proforma F.1000-44 · Seguimiento Monetario y Crediticio Semanal',
    description:
      'Informe semanal al cierre de cada viernes con los saldos agregados de cartera bruta, inversiones, depósitos (CDT, ahorro, corriente) y disponibilidades.',
    requirements: [
      'Corte semanal (viernes) con transmisión a través del sistema de recepción SFC',
      'Consistencia con saldos semanales de encaje y tasas de captación/colocación',
    ],
    sourceUrl: SFC_INDEX_URL,
  },
  {
    id: 'FMT-CO-SFC-351',
    code: '351',
    name: 'Formato 351 (Proforma F.0000-110) · Composición del Portafolio de Inversiones',
    regulator: 'SFC - Superintendencia Financiera de Colombia',
    periodicity: 'Mensual',
    families: ['TXT', 'XML'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Entidades Aseguradoras y Reaseguradoras',
      'Sociedades Fiduciarias',
      'Sociedades Comisionistas de Bolsa y FIC',
      'Administradoras de Fondos de Pensiones y Cesantías (AFP)',
    ],
    obligation: 'CBCF SFC · Proforma F.0000-110 · Capítulo I (Valoración de Inversiones)',
    description:
      'Detalle título a título del portafolio de inversiones negociables, disponibles para la venta y hasta el vencimiento con clasificación contable y valoración a precios de mercado.',
    requirements: [
      'Identificación ISIN / nemotécnico, emisor, calificación crediticia, TIR y valor razonable',
      'Desglose por tipo de fondo administrado o portafolio propio',
    ],
    sourceUrl: SFC_INDEX_URL,
  },
  {
    id: 'FMT-CO-SFC-394',
    code: '394',
    name: 'Formato 394 (Proforma F.3000-74) · Cálculo de Reserva Matemática de Seguros',
    regulator: 'SFC - Superintendencia Financiera de Colombia',
    periodicity: 'Mensual',
    families: ['TXT'],
    entityTypes: ['Entidades Aseguradoras y Reaseguradoras'],
    obligation: 'CBCF SFC · Proforma F.3000-74 · Régimen de Reservas Técnicas Aseguradoras',
    description:
      'Reporte mensual del cálculo actuarial de reservas matemáticas para ramos de seguros de vida, rentas vitalicias, previsionales y riesgos laborales.',
    requirements: [
      'Consistencia actuarial con tablas de mortalidad vigentes y tasas técnicas autorizadas',
      'Cruces con subcuentas CUIF de reservas técnicas del sector asegurador',
    ],
    sourceUrl: SFC_INDEX_URL,
  },
  {
    id: 'FMT-CO-SFC-412',
    code: '412',
    name: 'Formato 412 (Proforma F.0000-167) · Puntos de Atención de Canales por Municipio',
    regulator: 'SFC - Superintendencia Financiera de Colombia',
    periodicity: 'Mensual',
    families: ['TXT', 'XML'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Cooperativas Financieras',
      'Sociedades Especializadas en Depósitos y Pagos Electrónicos (SEDPE)',
    ],
    obligation: 'CE SFC 033/2021 · Proforma F.0000-167 · Cobertura e Inclusión Financiera',
    description:
      'Inventario mensual georreferenciado por código DANE municipal de oficinas, cajeros automáticos (ATM), datáfonos (POS) y corresponsales físicos o móviles.',
    requirements: [
      'Códigos DIVIPOLA DANE completos para departamento y municipio',
      'Clasificación de corresponsales propios, tercerizados y digitales activos',
    ],
    sourceUrl: SFC_INDEX_URL,
  },
  {
    id: 'FMT-CO-SFC-413',
    code: '413',
    name: 'Formato 413 (Proforma F.0000-168) · Operaciones a Través de Canales de Distribución',
    regulator: 'SFC - Superintendencia Financiera de Colombia',
    periodicity: 'Semestral',
    families: ['TXT', 'XML'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Cooperativas Financieras',
      'Sociedades Especializadas en Depósitos y Pagos Electrónicos (SEDPE)',
    ],
    obligation: 'CE SFC 033/2021 · Proforma F.0000-168 (Sustituyó Proforma 444)',
    description:
      'Estadísticas semestrales de número y monto de operaciones monetarias y no monetarias cursadas por oficina, internet, banca móvil, ATM, POS, ACH y corresponsales.',
    requirements: [
      'Separación estricta entre operaciones monetarias, no monetarias y canales digitales',
      'Validación contra topologías transaccionales de la Circular Externa 033 de 2021',
    ],
    sourceUrl: SFC_INDEX_URL,
  },
  {
    id: 'FMT-CO-SFC-415',
    code: '415',
    name: 'Formato 415 (Proforma F.0000-169) · Instrumentos Financieros Derivados',
    regulator: 'SFC - Superintendencia Financiera de Colombia',
    periodicity: 'Diaria',
    families: ['XML', 'TXT'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Entidades Aseguradoras y Reaseguradoras',
      'Sociedades Fiduciarias',
      'Sociedades Comisionistas de Bolsa y FIC',
      'Administradoras de Fondos de Pensiones y Cesantías (AFP)',
    ],
    obligation: 'CE SFC 004/2022 · Proforma F.0000-169 (Consolidó y derogó Formatos 468, 469, 471 y 472)',
    description:
      'Reporte unificado de valoración, nocionales y características de operaciones con derivados Forward, Swaps (IRS/CCS/CDS), Opciones y Futuros.',
    requirements: [
      'Esquema XML unificado conforme al Anexo Técnico CE 004/2022',
      'Identificación de contraparte, subyacente, pata activa/pasiva y valor razonable (MtM)',
    ],
    sourceUrl: SFC_DOCS_URL,
  },
  {
    id: 'FMT-CO-SFC-443',
    code: '443',
    name: 'Formato 443 (Proforma F.1000-119) · Declaración del Encaje en Moneda Legal',
    regulator: 'SFC - Superintendencia Financiera de Colombia',
    periodicity: 'Semanal',
    families: ['TXT'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Cooperativas Financieras',
    ],
    obligation: 'CBCF SFC · Proforma F.1000-119 · Regulación de Encaje Bancario BanRep',
    description:
      'Declaración bisemanal/semanal del requerido y disponible de encaje sobre exigibilidades en moneda legal según porcentajes definidos por el Banco de la República.',
    requirements: [
      'Desagregación diaria de exigibilidades sujetas a encaje y saldo en cuenta de depósito BanRep',
      'Cálculo automático de posición neta de encaje (defecto o exceso)',
    ],
    sourceUrl: SFC_INDEX_URL,
  },
  {
    id: 'FMT-CO-SFC-460',
    code: '460',
    name: 'Formato 460 (Proforma F.1000-127) · Inversiones Obligatorias en TDA (FINAGRO)',
    regulator: 'SFC - Superintendencia Financiera de Colombia',
    periodicity: 'Trimestral',
    families: ['TXT'],
    entityTypes: ['Establecimientos Bancarios', 'Compañías de Financiamiento'],
    obligation: 'CBCF SFC · Proforma F.1000-127 · Títulos de Desarrollo Agropecuario',
    description:
      'Declaración trimestral del requerido de inversión obligatoria en TDA Clase A y Clase B sobre las exigibilidades sujetas de los establecimientos de crédito.',
    requirements: [
      'Cruces con cartera agropecuaria sustitutiva y saldos promedio trimestrales',
    ],
    sourceUrl: SFC_INDEX_URL,
  },
  {
    id: 'FMT-CO-SFC-516',
    code: '516',
    name: 'Formato 516 · Reporte de Fondos de Cesantías y Protección al Cesante',
    regulator: 'SFC - Superintendencia Financiera de Colombia',
    periodicity: 'Mensual',
    families: ['TXT'],
    entityTypes: ['Administradoras de Fondos de Pensiones y Cesantías (AFP)'],
    obligation: 'CBCF SFC · Subcuentas Portafolio Corto y Largo Plazo de Cesantías',
    description:
      'Información mensual de afiliados, recaudos, retiros parciales/definitivos y saldos administrados en los portafolios de corto y largo plazo de cesantías.',
    requirements: [
      'Separación estricta entre portafolio de corto plazo y portafolio de largo plazo',
    ],
    sourceUrl: SFC_INDEX_URL,
  },
  {
    id: 'FMT-CO-SFC-518',
    code: '518',
    name: 'Formato 518 (Proforma F.1000-137) · Reliquidación de Inversiones Obligatorias en TDA',
    regulator: 'SFC - Superintendencia Financiera de Colombia',
    periodicity: 'Trimestral',
    families: ['TXT'],
    entityTypes: ['Establecimientos Bancarios', 'Compañías de Financiamiento'],
    obligation: 'CBCF SFC · Proforma F.1000-137 · Interoperabilidad FINAGRO',
    description:
      'Reliquidación periódica del cumplimiento de inversiones obligatorias en TDA en coordinación con el registro de FINAGRO.',
    requirements: ['Conciliación con base de exigibilidades del Formato 460'],
    sourceUrl: SFC_INDEX_URL,
  },
  {
    id: 'FMT-CO-SFC-525',
    code: '525',
    name: 'Formato 525 (Proforma F.0000-157) · Reporte Anual de Cuentas CUIF para Efectos de ICA',
    regulator: 'SFC - Superintendencia Financiera de Colombia',
    periodicity: 'Anual',
    families: ['TXT', 'CSV'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Entidades Aseguradoras y Reaseguradoras',
      'Sociedades Fiduciarias',
    ],
    obligation: 'CBCF SFC · Proforma F.0000-157 · Base Gravable Municipal de Industria y Comercio',
    description:
      'Reporte anual acumulado por municipio de cuentas operacionales CUIF que sirven como base gravable especial para el impuesto de Industria y Comercio (ICA) financiero.',
    requirements: [
      'Apertura por código DANE de municipio donde operan oficinas o se generan ingresos gravables',
      'Consistencia con cuentas de resultados del cierre anual CUIF',
    ],
    sourceUrl: SFC_INDEX_URL,
  },
  {
    id: 'FMT-CO-SFC-531',
    code: '531',
    name: 'Formato 531 (Proforma F.0000-160) · Exposición de Corto Plazo de IMC',
    regulator: 'SFC - Superintendencia Financiera de Colombia',
    periodicity: 'Diaria',
    families: ['TXT', 'XML'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Sociedades Comisionistas de Bolsa y FIC',
    ],
    obligation: 'CBCF SFC · Proforma F.0000-160 · Riesgo Cambiario e Indicadores de Corto Plazo IMC',
    description:
      'Seguimiento diario de indicadores de exposición individual y global de corto plazo en divisas (IEI / IEG) para Intermediarios del Mercado Cambiario.',
    requirements: [
      'Desagregación por moneda ISO-4217 y bandas de vencimiento de corto plazo',
    ],
    sourceUrl: SFC_INDEX_URL,
  },
  {
    id: 'FMT-CO-SFC-535',
    code: '535',
    name: 'Formato 535 (Proforma F.7000-20) · Incumplimientos Evidenciados por Custodios de Valores',
    regulator: 'SFC - Superintendencia Financiera de Colombia',
    periodicity: 'Por evento',
    reportingModality: 'Por evento',
    families: ['XML', 'TXT'],
    entityTypes: [
      'Sociedades Fiduciarias',
      'Sociedades Comisionistas de Bolsa y FIC',
      'Administradoras de Fondos de Pensiones y Cesantías (AFP)',
    ],
    obligation: 'CBCF SFC · Proforma F.7000-20 · Custodia de Valores en FIC y FVP',
    description:
      'Reporte por evento de incumplimientos o posibles incumplimientos de límites de inversión evidenciados por los custodios en FIC y portafolios FVP.',
    requirements: [
      'Transmisión por evento al detectarse exceso de límite o incumplimiento de política de inversión',
    ],
    sourceUrl: SFC_INDEX_URL,
  },
  {
    id: 'FMT-CO-SFC-F1000-141',
    code: 'F.1000-141',
    name: 'Proforma F.1000-141 · Declaración de Adecuación de Capital y Relación de Solvencia',
    regulator: 'SFC - Superintendencia Financiera de Colombia',
    periodicity: 'Mensual',
    families: ['TXT', 'XML'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Cooperativas Financieras',
    ],
    obligation: 'Decreto 2555 de 2010 (mod. Dec. 1477/2018 Basilea III) · Relación de Solvencia Total y Básica',
    description:
      'Cálculo mensual de Patrimonio Básico Ordinario (PBO / CET1), Patrimonio Técnico, Activos Ponderados por Nivel de Riesgo (APNR) de crédito, mercado y operacional.',
    requirements: [
      'Integración de riesgo de crédito, mercado (VeR) y riesgo operacional bajo estándares Basilea III',
      'Verificación de colchón de conservación y solvencia básica mínima normativa',
    ],
    sourceUrl: SFC_INDEX_URL,
  },

  // ============================================================================
  // 2. DIAN (Complemento a 410, 1001, 1003, 1005, 1006, 1007 y vacío)
  // ============================================================================
  {
    id: 'FMT-CO-DIAN-1008',
    code: '1008',
    name: 'Formato 1008 · Información Exógena · Saldos de Cuentas por Cobrar a 31 de Diciembre',
    regulator: 'DIAN',
    periodicity: 'Anual',
    families: ['XML'],
    entityTypes: [
      'Contribuyentes y Personas Jurídicas Generales (DIAN)',
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Entidades Aseguradoras y Reaseguradoras',
    ],
    obligation: 'Resolución DIAN 000162/2023 mod. Res. 000227 y 000233/2025 · Art. 631 E.T.',
    description:
      'Reporte anual de saldos de deudores por concepto (clientes, accionistas, vinculados y otros) al 31 de diciembre del año gravable.',
    requirements: [
      'XML validado con Prevalidador Tributario DIAN (Conceptos 1315 a 1318)',
      'Clasificación de cartera deteriorada y saldos por NIT o cuantías menores',
    ],
    normativeVersion: 'v7.0',
    sourceUrl: DIAN_EXOGENA_URL,
  },
  {
    id: 'FMT-CO-DIAN-1009',
    code: '1009',
    name: 'Formato 1009 · Información Exógena · Saldos de Cuentas por Pagar (Pasivos) a 31 de Diciembre',
    regulator: 'DIAN',
    periodicity: 'Anual',
    families: ['XML'],
    entityTypes: [
      'Contribuyentes y Personas Jurídicas Generales (DIAN)',
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Entidades Aseguradoras y Reaseguradoras',
    ],
    obligation: 'Resolución DIAN 000162/2023 mod. Res. 000227 y 000233/2025 · Art. 631 E.T.',
    description:
      'Reporte anual de pasivos pendientes de pago al cierre del ejercicio fiscal discriminados por acreedor y concepto contable/fiscal (Conceptos 2201 a 2217).',
    requirements: [
      'XML conforme al esquema XSD DIAN vigente para el año gravable',
      'Consistencia con el patrimonio bruto y deudas declaradas en el Formulario 110',
    ],
    normativeVersion: 'v7.0',
    sourceUrl: DIAN_EXOGENA_URL,
  },
  {
    id: 'FMT-CO-DIAN-1011',
    code: '1011',
    name: 'Formato 1011 · Información Exógena · Información de las Declaraciones Tributarias',
    regulator: 'DIAN',
    periodicity: 'Anual',
    families: ['XML'],
    entityTypes: [
      'Contribuyentes y Personas Jurídicas Generales (DIAN)',
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Entidades Aseguradoras y Reaseguradoras',
    ],
    obligation: 'Resolución Única de Exógena DIAN · Rentas Exentas, Descuentos, Deducciones y Costos Especiales',
    description:
      'Consolidado anual de rentas exentas, ingresos no constitutivos de renta ni ganancia ocasional (INCRNGO), deducciones especiales y descuentos tributarios declarados en renta e IVA.',
    requirements: [
      'Validación de conceptos oficiales DIAN serie 8000 y 9000 sin identificación de terceros por cuantía individual',
    ],
    normativeVersion: 'v6.0',
    sourceUrl: DIAN_EXOGENA_URL,
  },
  {
    id: 'FMT-CO-DIAN-1012',
    code: '1012',
    name: 'Formato 1012 · Información Exógena · Declaraciones Tributarias, Acciones, Aportes e Inversiones',
    regulator: 'DIAN',
    periodicity: 'Anual',
    families: ['XML'],
    entityTypes: [
      'Contribuyentes y Personas Jurídicas Generales (DIAN)',
      'Establecimientos Bancarios',
      'Sociedades Fiduciarias',
      'Entidades Aseguradoras y Reaseguradoras',
    ],
    obligation: 'Resolución Única de Exógena DIAN · Saldos en Cuentas Bancarias, CDT, Bonos y Acciones',
    description:
      'Reporte anual al 31 de diciembre del saldo en cuentas de ahorro/corriente en Colombia y el exterior, inversiones en bonos, CDT y valor patrimonial de acciones o aportes.',
    requirements: [
      'Desagregación por NIT del emisor/entidad financiera y país de ubicación del activo',
    ],
    normativeVersion: 'v9.0',
    sourceUrl: DIAN_EXOGENA_URL,
  },
  {
    id: 'FMT-CO-DIAN-2276',
    code: '2276',
    name: 'Formato 2276 · Información Exógena · Certificado de Ingresos y Retenciones Trabajo y Pensiones',
    regulator: 'DIAN',
    periodicity: 'Anual',
    families: ['XML'],
    entityTypes: [
      'Contribuyentes y Personas Jurídicas Generales (DIAN)',
      'Establecimientos Bancarios',
      'Administradoras de Fondos de Pensiones y Cesantías (AFP)',
    ],
    obligation: 'Art. 631-3 E.T. · Resolución Única de Exógena DIAN',
    description:
      'Información anual detallada por trabajador o pensionado de salarios, honorarios asimilados, prestaciones, cesantías consignadas, aportes obligatorios/voluntarios y retenciones.',
    requirements: [
      'Consistencia exacta entre pagos reportados en 2276, nómina electrónica (NE) y Formulario 220',
    ],
    normativeVersion: 'v4.0',
    sourceUrl: DIAN_EXOGENA_URL,
  },
  {
    id: 'FMT-CO-DIAN-1019',
    code: '1019',
    name: 'Formato 1019 · Información Exógena Sector Financiero · Cuentas Corrientes y de Ahorro',
    regulator: 'DIAN',
    periodicity: 'Anual',
    families: ['XML'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Cooperativas Financieras',
      'Sociedades Especializadas en Depósitos y Pagos Electrónicos (SEDPE)',
    ],
    obligation: 'Art. 623 E.T. · Resolución Única Exógena DIAN (Entidades Vigiladas por SFC/Supersolidaria)',
    description:
      'Reporte anual de titulares principales y secundarios, movimiento débito/crédito acumulado y saldo a diciembre 31 de cuentas corrientes, de ahorro y depósitos electrónicos.',
    requirements: [
      'Exclusivo para entidades financieras y cooperativas autorizadas a captar depósitos',
      'Inclusión de todos los titulares y autorizados cuando superen topes en UVT',
    ],
    normativeVersion: 'v9.0',
    sourceUrl: DIAN_EXOGENA_URL,
  },
  {
    id: 'FMT-CO-DIAN-1020',
    code: '1020',
    name: 'Formato 1020 · Información Exógena Sector Financiero · CDT y Títulos Valores Emitidos',
    regulator: 'DIAN',
    periodicity: 'Anual',
    families: ['XML'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Cooperativas Financieras',
    ],
    obligation: 'Art. 623 E.T. · Resolución Única Exógena DIAN · Inversiones en CDT',
    description:
      'Información anual de Certificados de Depósito a Término (CDT), CDAT y otros títulos de renta fija emitidos, renovados o cancelados durante el año gravable.',
    requirements: ['Identificación de titulares, valor inicial, rendimientos causados y saldo final'],
    normativeVersion: 'v8.0',
    sourceUrl: DIAN_EXOGENA_URL,
  },
  {
    id: 'FMT-CO-DIAN-1021',
    code: '1021',
    name: 'Formato 1021 · Información Exógena · Fondos de Inversión Colectiva (FIC) y Fiducias',
    regulator: 'DIAN',
    periodicity: 'Anual',
    families: ['XML'],
    entityTypes: [
      'Sociedades Fiduciarias',
      'Sociedades Comisionistas de Bolsa y FIC',
    ],
    obligation: 'Art. 623-2 y 631 E.T. · Resolución Única Exógena DIAN',
    description:
      'Reporte de partícipes, inversionistas, aportes, retiros y rendimientos financieros de Fondos de Inversión Colectiva y fondos mutuos administrados.',
    requirements: ['Validación por código de fondo, NIT de inversionista y rendimiento neto anual'],
    normativeVersion: 'v7.0',
    sourceUrl: DIAN_EXOGENA_URL,
  },
  {
    id: 'FMT-CO-DIAN-1023',
    code: '1023',
    name: 'Formato 1023 · Información Exógena Sector Financiero · Consumos con Tarjetas de Crédito',
    regulator: 'DIAN',
    periodicity: 'Anual',
    families: ['XML'],
    entityTypes: ['Establecimientos Bancarios', 'Compañías de Financiamiento'],
    obligation: 'Art. 623 Lit. c) E.T. · Resolución Única Exógena DIAN',
    description:
      'Reporte anual emitido por entidades emisoras de tarjetas de crédito con el valor acumulado de consumos, compras y avances por tarjetahabiente.',
    requirements: ['Validación por documento del titular principal y amparados cuando aplique'],
    normativeVersion: 'v6.0',
    sourceUrl: DIAN_EXOGENA_URL,
  },
  {
    id: 'FMT-CO-DIAN-1024',
    code: '1024',
    name: 'Formato 1024 · Información Exógena Sector Financiero · Ventas con Tarjetas Crédito/Débito',
    regulator: 'DIAN',
    periodicity: 'Anual',
    families: ['XML'],
    entityTypes: ['Establecimientos Bancarios', 'Compañías de Financiamiento'],
    obligation: 'Art. 623-3 E.T. · Resolución Única Exógena DIAN (Adquirentes y Redes)',
    description:
      'Reporte anual de ventas totales abonadas a establecimientos de comercio a través del sistema de tarjetas de crédito y débito, con discriminación de retenciones practicadas.',
    requirements: ['Identificación de comercio afiliado, valor bruto, IVA, INC y retefuente descontada'],
    normativeVersion: 'v6.0',
    sourceUrl: DIAN_EXOGENA_URL,
  },
  {
    id: 'FMT-CO-DIAN-1026',
    code: '1026',
    name: 'Formato 1026 · Información Exógena Sector Financiero · Préstamos Bancarios Otorgados',
    regulator: 'DIAN',
    periodicity: 'Anual',
    families: ['XML'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Cooperativas Financieras',
    ],
    obligation: 'Art. 623 Lit. d) E.T. · Resolución Única Exógena DIAN',
    description:
      'Información anual de créditos desembolsados por entidades financieras y cooperativas (comercial, consumo, vivienda, microcrédito) que superen los umbrales de la resolución.',
    requirements: ['Consistencia con cartera desembolsada y tipo de crédito reportado a la SFC'],
    normativeVersion: 'v6.0',
    sourceUrl: DIAN_EXOGENA_URL,
  },
  {
    id: 'FMT-CO-DIAN-2218-FATCA',
    code: '2218 (FATCA)',
    name: 'Formato 2218 · Intercambio Automático de Información FATCA (IGA Colombia - EE.UU.)',
    regulator: 'DIAN',
    periodicity: 'Anual',
    families: ['XML'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Entidades Aseguradoras y Reaseguradoras',
      'Sociedades Fiduciarias',
      'Sociedades Comisionistas de Bolsa y FIC',
      'Administradoras de Fondos de Pensiones y Cesantías (AFP)',
    ],
    obligation: 'Ley 1666 de 2013 y Resolución DIAN 000060/2015 (mod. Res. 000078/2020) · FATCA',
    description:
      'Reporte anual de cuentas financieras reportables mantenidas por ciudadanos estadounidenses o entidades pasivas con controladores U.S. Person ante el IRS vía DIAN.',
    requirements: [
      'Esquema XML FATCA DIAN validado con TIN estadounidense y saldos/rendimientos al cierre',
    ],
    sourceUrl: DIAN_PORTAL_URL,
  },
  {
    id: 'FMT-CO-DIAN-2430-CRS',
    code: '2430 (CRS)',
    name: 'Formato 2430 · Estándar Común de Reporte OCDE (CRS / SIII)',
    regulator: 'DIAN',
    periodicity: 'Anual',
    families: ['XML'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Entidades Aseguradoras y Reaseguradoras',
      'Sociedades Fiduciarias',
      'Sociedades Comisionistas de Bolsa y FIC',
      'Administradoras de Fondos de Pensiones y Cesantías (AFP)',
    ],
    obligation: 'Resolución DIAN 000119/2015 y 000078/2020 · Sistema SIII OCDE',
    description:
      'Reporte anual automático de cuentas financieras de residentes fiscales en jurisdicciones participantes del estándar global CRS de la OCDE.',
    requirements: [
      'Validación de códigos de jurisdicción ISO-3166, TIN extranjero y debida diligencia CRS',
    ],
    sourceUrl: DIAN_PORTAL_URL,
  },
  {
    id: 'FMT-CO-DIAN-2687-RUB',
    code: '2687 (RUB)',
    name: 'Formato 2687 · Registro Único de Beneficiarios Finales (RUB)',
    regulator: 'DIAN',
    periodicity: 'Por evento',
    reportingModality: 'Por evento',
    families: ['XML', 'CSV'],
    entityTypes: [
      'Contribuyentes y Personas Jurídicas Generales (DIAN)',
      'Sociedades Comerciales (Supersociedades)',
      'Establecimientos Bancarios',
      'Sociedades Fiduciarias',
    ],
    obligation: 'Ley 2155/2021 · Resolución DIAN 000164/2021 y 001240/2022',
    description:
      'Suministro y actualización por evento (constitución o cambio >=5% de participación/control) de beneficiarios finales personas naturales y estructuras sin personería jurídica.',
    requirements: [
      'Carga masiva XML / prevalidador RUB cuando cambie la composición accionaria o fiduciaria',
    ],
    sourceUrl: DIAN_PORTAL_URL,
  },
  {
    id: 'FMT-CO-DIAN-110',
    code: '110',
    name: 'Formulario 110 · Declaración de Renta y Complementario para Personas Jurídicas',
    regulator: 'DIAN',
    periodicity: 'Anual',
    families: ['XML', 'PDF'],
    entityTypes: [
      'Contribuyentes y Personas Jurídicas Generales (DIAN)',
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Entidades Aseguradoras y Reaseguradoras',
      'Sociedades Comerciales (Supersociedades)',
    ],
    obligation: 'Estatuto Tributario Nacional · Impuesto sobre la Renta y Sobretasa Financiera',
    description:
      'Declaración anual del impuesto sobre la renta, patrimonio líquido, renta líquida gravable, tasa mínima de tributación (TTD) y sobretasa sector financiero.',
    requirements: [
      'Conciliación fiscal Formato 2516 anexada previamente al diligenciamiento en Muisca DIAN',
    ],
    sourceUrl: DIAN_PORTAL_URL,
  },
  {
    id: 'FMT-CO-DIAN-300',
    code: '300',
    name: 'Formulario 300 · Declaración del Impuesto sobre las Ventas (IVA)',
    regulator: 'DIAN',
    periodicity: 'Bimestral',
    families: ['XML', 'PDF'],
    entityTypes: [
      'Contribuyentes y Personas Jurídicas Generales (DIAN)',
      'Establecimientos Bancarios',
      'Sociedades Comerciales (Supersociedades)',
    ],
    obligation: 'Estatuto Tributario Nacional (Art. 600 E.T.) · Declaración Periódica de IVA',
    description:
      'Declaración bimestral o cuatrimestral de ingresos gravados, excluidos, exentos, IVA generado, IVA descontable y saldo a pagar o a favor.',
    requirements: [
      'Cruce directo con facturación electrónica emitida/recibida y prorrateo de IVA descontable',
    ],
    sourceUrl: DIAN_PORTAL_URL,
  },
  {
    id: 'FMT-CO-DIAN-350',
    code: '350',
    name: 'Formulario 350 · Declaración Mensual de Retenciones en la Fuente',
    regulator: 'DIAN',
    periodicity: 'Mensual',
    families: ['XML', 'PDF'],
    entityTypes: [
      'Contribuyentes y Personas Jurídicas Generales (DIAN)',
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Entidades Aseguradoras y Reaseguradoras',
      'Sociedades Fiduciarias',
      'Sociedades Comerciales (Supersociedades)',
    ],
    obligation: 'Estatuto Tributario Nacional · Agentes de Retención Renta, IVA, Timbre y Autorretención',
    description:
      'Liquidación mensual obligatoria de retenciones practicadas por salarios, honorarios, servicios, compras, rendimientos financieros y autorretención especial.',
    requirements: [
      'Consistencia mensual contra contabilidad auxiliar de retenciones y pago oportuno en Recibo 490',
    ],
    sourceUrl: DIAN_PORTAL_URL,
  },
  {
    id: 'FMT-CO-DIAN-UBL21',
    code: 'UBL-FE-2.1',
    name: 'Factura Electrónica de Venta, Notas Crédito/Débito y Eventos RADIAN (UBL 2.1)',
    regulator: 'DIAN',
    periodicity: 'Por evento',
    reportingModality: 'Por evento',
    families: ['XML'],
    entityTypes: [
      'Contribuyentes y Personas Jurídicas Generales (DIAN)',
      'Establecimientos Bancarios',
      'Sociedades Comerciales (Supersociedades)',
    ],
    obligation: 'Resolución DIAN 000165/2023 · Anexo Técnico de Factura Electrónica v1.9',
    description:
      'Generación, firma digital XAdES y validación previa ante la DIAN en formato XML UBL 2.1 de facturas de venta, documento equivalente electrónico y eventos RADIAN.',
    requirements: [
      'CUFE/CUDE validado con algoritmo SHA-384 y certificado de firma digital vigente',
    ],
    sourceUrl: DIAN_PORTAL_URL,
  },
  {
    id: 'FMT-CO-DIAN-NOMINA',
    code: 'NE-XML-1.0',
    name: 'Documento Soporte de Pago de Nómina Electrónica y Notas de Ajuste',
    regulator: 'DIAN',
    periodicity: 'Mensual',
    families: ['XML'],
    entityTypes: [
      'Contribuyentes y Personas Jurídicas Generales (DIAN)',
      'Establecimientos Bancarios',
      'Sociedades Comerciales (Supersociedades)',
    ],
    obligation: 'Resolución DIAN 000013/2021 · Soporte Fiscal de Costos y Deducciones Laborales',
    description:
      'Transmisión mensual dentro de los primeros 10 días hábiles de los XML individuales por trabajador de devengos, deducciones y CUNE.',
    requirements: [
      'Generación de Código Único de Nómina Electrónica (CUNE) y firma digital por empleado',
    ],
    sourceUrl: DIAN_PORTAL_URL,
  },

  // ============================================================================
  // 3. UIAF - SIREL (Complemento a ANEXO-1-ROS y ANEXO-2-RTE)
  // ============================================================================
  {
    id: 'FMT-CO-UIAF-ANEXO3',
    code: 'ANEXO-3-EXON',
    name: 'Anexo 3 · Reporte de Clientes Exonerados del Reporte de Transacciones en Efectivo — SIREL',
    regulator: 'UIAF - Unidad de Información y Análisis Financiero',
    issuingOrganism: 'SFC - Superintendencia Financiera de Colombia',
    periodicity: 'Trimestral',
    families: ['TXT', 'CSV'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Cooperativas Financieras',
    ],
    obligation: 'Circular Básica Jurídica SFC (SARLAFT) · Documento Técnico Anexo 3 SIREL',
    description:
      'Reporte trimestral de clientes cuya actividad económica justifica la exoneración del reporte individual de transacciones en efectivo ante la UIAF.',
    requirements: [
      'Estructura plana conforme al instructivo técnico SFC Publicación 15001 para carga en SIREL',
    ],
    sourceUrl: UIAF_SIREL_URL,
  },
  {
    id: 'FMT-CO-UIAF-ANEXO4',
    code: 'ANEXO-4-CAMB',
    name: 'Anexo 4 · Reporte de Operaciones Cambiarias y Transferencias Internacionales — SIREL',
    regulator: 'UIAF - Unidad de Información y Análisis Financiero',
    issuingOrganism: 'SFC - Superintendencia Financiera de Colombia',
    periodicity: 'Mensual',
    families: ['TXT', 'CSV'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Sociedades Comisionistas de Bolsa y FIC',
    ],
    obligation: 'Circular Básica Jurídica SFC (SARLAFT) · Documento Técnico Anexo 4 SIREL',
    description:
      'Envío mensual a la UIAF de operaciones de compra, venta de divisas y transferencias internacionales iguales o superiores al umbral normativo.',
    requirements: ['Validación de divisas ISO-4217, países y datos de ordenante/beneficiario'],
    sourceUrl: UIAF_SIREL_URL,
  },
  {
    id: 'FMT-CO-UIAF-ANEXO5',
    code: 'ANEXO-5-TARJ',
    name: 'Anexo 5 · Reporte de Operaciones con Tarjetas Crédito y Débito Internacionales — SIREL',
    regulator: 'UIAF - Unidad de Información y Análisis Financiero',
    issuingOrganism: 'SFC - Superintendencia Financiera de Colombia',
    periodicity: 'Mensual',
    families: ['TXT', 'CSV'],
    entityTypes: ['Establecimientos Bancarios', 'Compañías de Financiamiento'],
    obligation: 'Circular Básica Jurídica SFC (SARLAFT) · Documento Técnico Anexo 5 SIREL',
    description:
      'Reporte mensual de consumos, retiros y avances efectuados en Colombia o en el exterior con tarjetas de crédito y débito emitidas internacionalmente.',
    requirements: ['Control de transacciones acumuladas y verificación de país de uso'],
    sourceUrl: UIAF_SIREL_URL,
  },
  {
    id: 'FMT-CO-UIAF-ANEXO6',
    code: 'ANEXO-6-PROD',
    name: 'Anexo 6 · Reporte de Productos Ofrecidos por Entidades Vigiladas — SIREL',
    regulator: 'UIAF - Unidad de Información y Análisis Financiero',
    issuingOrganism: 'SFC - Superintendencia Financiera de Colombia',
    periodicity: 'Mensual',
    families: ['TXT', 'CSV'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Cooperativas Financieras',
      'Sociedades Fiduciarias',
      'Entidades Aseguradoras y Reaseguradoras',
    ],
    obligation: 'Circular Básica Jurídica SFC (SARLAFT) · Documento Técnico Anexo 6 SIREL',
    description:
      'Actualización mensual de productos financieros activos, vinculados y canales disponibles reportados al sistema SIREL de la UIAF.',
    requirements: ['Codificación homologada de productos y titulares conforme al anexo técnico'],
    sourceUrl: UIAF_SIREL_URL,
  },
  {
    id: 'FMT-CO-UIAF-ANEXO7',
    code: 'ANEXO-7-APP',
    name: 'Anexo 7 · Reporte de Patrimonios Autónomos (Ley 1508 de 2012 APP) — SIREL',
    regulator: 'UIAF - Unidad de Información y Análisis Financiero',
    issuingOrganism: 'SFC - Superintendencia Financiera de Colombia',
    periodicity: 'Mensual',
    families: ['TXT', 'CSV'],
    entityTypes: ['Sociedades Fiduciarias'],
    obligation: 'Ley 1508 de 2012 · Circular Básica Jurídica SFC · Anexo 7 SIREL',
    description:
      'Información mensual de ingresos, egresos y beneficiarios de patrimonios autónomos constituidos para Asociaciones Público-Privadas (APP).',
    requirements: ['Identificación de fideicomitentes, contratistas y flujos de recursos APP'],
    sourceUrl: UIAF_SIREL_URL,
  },
  {
    id: 'FMT-CO-UIAF-AUSENCIA',
    code: 'SIREL-AUSENCIA',
    name: 'Reporte de Ausencia de Operaciones (Negativo) — SIREL UIAF',
    regulator: 'UIAF - Unidad de Información y Análisis Financiero',
    periodicity: 'Mensual',
    families: ['TXT', 'XML'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Cooperativas Financieras',
      'Sociedades Fiduciarias',
      'Entidades Aseguradoras y Reaseguradoras',
      'Cooperativas y Fondos de Empleados (Supersolidaria)',
    ],
    obligation: 'Resoluciones Sectoriales UIAF · Declaración Obligatoria de No Ocurrencia',
    description:
      'Certificación mensual/trimestral en SIREL cuando durante el periodo no se presentaron transacciones sujetas a reporte en los anexos objetivos (RTE, Cambiarias, Tarjetas).',
    requirements: ['Radicación obligatoria dentro de los 10 primeros días calendario del periodo siguiente'],
    sourceUrl: UIAF_SIREL_URL,
  },

  // ============================================================================
  // 4. FOGAFÍN (Complemento a FDI)
  // ============================================================================
  {
    id: 'FMT-CO-FOGAFIN-PRIMA',
    code: 'PRIMA-SD',
    name: 'Liquidación y Pago Trimestral de la Prima del Seguro de Depósitos',
    regulator: 'Fogafín - Fondo de Garantías de Instituciones Financieras',
    periodicity: 'Trimestral',
    families: ['TXT', 'CSV'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Cooperativas Financieras',
    ],
    obligation: 'Resolución Fogafín 001 / 004 · Régimen de Primas y Descuentos por Calificación',
    description:
      'Liquidación trimestral de la prima ordinaria y ajuste por nivel de riesgo sobre los pasivos cubiertos (CDT, ahorros, cuentas corrientes y otros depósitos).',
    requirements: [
      'Conciliación con saldos promedio mensuales CUIF de depósitos y exigibilidades cubiertas',
    ],
    sourceUrl: FOGAFIN_URL,
  },
  {
    id: 'FMT-CO-FOGAFIN-ACREENCIAS',
    code: 'ACREENCIAS-AMP',
    name: 'Certificación Trimestral de Acreencias Amparadas y Exenciones',
    regulator: 'Fogafín - Fondo de Garantías de Instituciones Financieras',
    periodicity: 'Trimestral',
    families: ['TXT', 'PDF'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Cooperativas Financieras',
    ],
    obligation: 'Circulares Externas Fogafín · Conciliación Contable de Pasivos Asegurados',
    description:
      'Certificación suscrita por representante legal y revisor fiscal que reconcilia los saldos del Formato de Depósitos Individuales (FDI) frente al balance CUIF.',
    requirements: [
      'Tolerancia cero de diferencia entre la sumatoria del FDI y las cuentas contables de pasivo amparado',
    ],
    sourceUrl: FOGAFIN_URL,
  },

  // ============================================================================
  // 5. FOGACOOP (Entidad nueva en Colombia)
  // ============================================================================
  {
    id: 'FMT-CO-FOGACOOP-SIDCORE',
    code: 'SIDCORE-FIN',
    name: 'Reporte Financiero y de Captaciones Cooperativas Inscritas (SidCore)',
    regulator: 'Fogacoop - Fondo de Garantías de Entidades Cooperativas',
    periodicity: 'Mensual',
    families: ['TXT', 'CSV'],
    entityTypes: [
      'Cooperativas Financieras',
      'Cooperativas y Fondos de Empleados (Supersolidaria)',
    ],
    obligation: 'Circulares Externas Fogacoop · Plataforma de Recepción SidCore',
    description:
      'Transmisión mensual de información financiera, indicadores de riesgo, liquidez y base de depositantes de cooperativas de ahorro y crédito inscritas en Fogacoop.',
    requirements: [
      'Validación en plataforma SidCore con consistencia frente al CUIF Solidario / SICSES',
    ],
    sourceUrl: FOGACOOP_URL,
  },
  {
    id: 'FMT-CO-FOGACOOP-PRIMA',
    code: 'PRIMA-COOP',
    name: 'Liquidación Trimestral de la Prima del Seguro para su Ahorro',
    regulator: 'Fogacoop - Fondo de Garantías de Entidades Cooperativas',
    periodicity: 'Trimestral',
    families: ['TXT', 'CSV'],
    entityTypes: [
      'Cooperativas Financieras',
      'Cooperativas y Fondos de Empleados (Supersolidaria)',
    ],
    obligation: 'Reglamento Seguro de Depósitos Fogacoop · Primas Trimestrales',
    description:
      'Cálculo y reporte trimestral de la prima de seguro sobre depósitos de ahorro, CDAT y depósitos contractuales administrados por cooperativas inscritas.',
    requirements: ['Validación del indicador CAMEL / riesgo asignado por Fogacoop'],
    sourceUrl: FOGACOOP_URL,
  },

  // ============================================================================
  // 6. SUPERSOLIDARIA (Complemento a Formatos 00 y 19)
  // ============================================================================
  {
    id: 'FMT-CO-SUPERSOL-FORC',
    code: 'FORC',
    name: 'Formulario Oficial de Rendición de Cuentas (FORC · SICSES)',
    regulator: 'Supersolidaria',
    periodicity: 'Mensual',
    families: ['TXT', 'CSV'],
    entityTypes: ['Cooperativas y Fondos de Empleados (Supersolidaria)'],
    obligation: 'Circular Básica Contable y Financiera Supersolidaria · Aplicativo SICSES',
    description:
      'Paquete integral de rendición de cuentas que agrupa estados financieros, anexos de inversiones, propiedad planta y equipo, aportes y pasivos en SICSES.',
    requirements: ['Generación validada mediante software oficial SICSES sin errores críticos'],
    sourceUrl: SUPERSOL_URL,
  },
  {
    id: 'FMT-CO-SUPERSOL-CUIF',
    code: 'F1-CUIF-SOL',
    name: 'Catálogo Único de Información Financiera Sector Solidario (CUIF NIIF)',
    regulator: 'Supersolidaria',
    periodicity: 'Mensual',
    families: ['TXT', 'CSV'],
    entityTypes: ['Cooperativas y Fondos de Empleados (Supersolidaria)'],
    obligation: 'Plan Único de Cuentas Solidario · SICSES',
    description:
      'Balance de comprobación y estados financieros mensuales bajo el catálogo CUIF adaptado a cooperativas de ahorro y crédito, multiactivas y fondos de empleados.',
    requirements: ['Cuadre integral de clases 1 a 7 y cuentas de orden en SICSES'],
    sourceUrl: SUPERSOL_URL,
  },
  {
    id: 'FMT-CO-SUPERSOL-9083',
    code: '9083',
    name: 'Formato 9083 · Informe Individual de Cálculo de Deterioro de Cartera de Crédito',
    regulator: 'Supersolidaria',
    periodicity: 'Mensual',
    families: ['TXT', 'CSV'],
    entityTypes: ['Cooperativas y Fondos de Empleados (Supersolidaria)'],
    obligation: 'CBCF Supersolidaria · Modelo de Pérdida Esperada (PI / PDI / EA)',
    description:
      'Reporte crédito a crédito del cálculo de pérdida esperada con exposición del activo, probabilidad de incumplimiento (PI), PDI, garantías y deterioro acumulado.',
    requirements: [
      'Obligatorio para cooperativas de ahorro y crédito y niveles de supervisión 1 y 2',
      'Conciliación con cuentas CUIF 14xx de cartera y deterioro acumulado',
    ],
    sourceUrl: SUPERSOL_URL,
  },
  {
    id: 'FMT-CO-SUPERSOL-ASOC',
    code: 'SICSES-ASOC',
    name: 'Anexo SICSES Serie 9000 · Base de Asociados, Aportes Sociales y Captaciones',
    regulator: 'Supersolidaria',
    periodicity: 'Mensual',
    families: ['CSV', 'TXT'],
    entityTypes: ['Cooperativas y Fondos de Empleados (Supersolidaria)'],
    obligation: 'FUI Supersolidaria · Anexos de Asociados y Depósitos',
    description:
      'Detalle individualizado de asociados hábiles e inhábiles, aportes sociales individuales, cuentas de ahorro y CDAT vigentes al corte mensual.',
    requirements: ['Consistencia con el capital social mínimo irreducible y topes de captación'],
    sourceUrl: SUPERSOL_URL,
  },
  {
    id: 'FMT-CO-SUPERSOL-SARLAFT',
    code: 'SICSES-LAFT',
    name: 'Informe de Gestión SARLAFT y SARC del Sector Solidario',
    regulator: 'Supersolidaria',
    periodicity: 'Anual',
    families: ['TXT', 'CSV'],
    entityTypes: ['Cooperativas y Fondos de Empleados (Supersolidaria)'],
    obligation: 'Circular Básica Jurídica Supersolidaria · Prevención LA/FT/FPADM',
    description:
      'Reporte periódico de evaluación de riesgos LA/FT, matriz de segmentación y cumplimiento del oficial de cumplimiento ante la Supersolidaria.',
    requirements: ['Validación anual conforme a nivel de supervisión solidaria'],
    sourceUrl: SUPERSOL_URL,
  },

  // ============================================================================
  // 7. BANCO DE LA REPÚBLICA (Complemento a Form. 5/10 y OD-BANREP)
  // ============================================================================
  {
    id: 'FMT-CO-BANREP-F1',
    code: 'Form. 1',
    name: 'Formulario No. 1 · Declaración de Cambio por Importaciones de Bienes',
    regulator: 'Banco de la República',
    periodicity: 'Por evento',
    reportingModality: 'Por evento',
    families: ['XML', 'TXT'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Contribuyentes y Personas Jurídicas Generales (DIAN)',
    ],
    obligation: 'Circular Reglamentaria Externa DCIP-83 · Sistema Estadístico Cambiario (SEC)',
    description:
      'Declaración de cambio ante IMC o mediante cuenta de compensación para canalizar pagos al exterior derivados de importaciones de bienes.',
    requirements: [
      'Numerales cambiarios autorizados y transmisión electrónica al Sistema Estadístico Cambiario SEC',
    ],
    sourceUrl: BANREP_URL,
  },
  {
    id: 'FMT-CO-BANREP-F2',
    code: 'Form. 2',
    name: 'Formulario No. 2 · Declaración de Cambio por Exportaciones de Bienes',
    regulator: 'Banco de la República',
    periodicity: 'Por evento',
    reportingModality: 'Por evento',
    families: ['XML', 'TXT'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Contribuyentes y Personas Jurídicas Generales (DIAN)',
    ],
    obligation: 'Circular Reglamentaria Externa DCIP-83 · Sistema Estadístico Cambiario (SEC)',
    description:
      'Declaración de cambio para el reintegro de divisas producto de exportaciones de bienes canalizadas a través del mercado cambiario.',
    requirements: ['Referencia a DEX / documentos de exportación y numerales cambiarios BanRep'],
    sourceUrl: BANREP_URL,
  },
  {
    id: 'FMT-CO-BANREP-F3',
    code: 'Form. 3',
    name: 'Formulario No. 3 · Declaración de Cambio por Endeudamiento Externo y Avales',
    regulator: 'Banco de la República',
    periodicity: 'Por evento',
    reportingModality: 'Por evento',
    families: ['XML', 'TXT'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Compañías de Financiamiento',
      'Sociedades Comerciales (Supersociedades)',
    ],
    obligation: 'Circular Reglamentaria Externa DCIP-83 · Canalización de Créditos Externos',
    description:
      'Registro de desembolsos, amortizaciones, intereses y comisiones de créditos externos activos o pasivos previamente informados al Banco de la República.',
    requirements: ['Número de crédito externo asignado previamente mediante Formulario 6/7'],
    sourceUrl: BANREP_URL,
  },
  {
    id: 'FMT-CO-BANREP-F4',
    code: 'Form. 4',
    name: 'Formulario No. 4 · Declaración de Cambio por Inversiones Internacionales',
    regulator: 'Banco de la República',
    periodicity: 'Por evento',
    reportingModality: 'Por evento',
    families: ['XML', 'TXT'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Sociedades Comisionistas de Bolsa y FIC',
      'Sociedades Comerciales (Supersociedades)',
    ],
    obligation: 'Circular Reglamentaria Externa DCIP-83 · Inversión Extranjera Directa y de Portafolio',
    description:
      'Canalización de divisas por inversión extranjera directa o de portafolio en Colombia y de inversión colombiana en el exterior.',
    requirements: ['Identificación de inversionista extranjero, receptor y destino de capital'],
    sourceUrl: BANREP_URL,
  },
  {
    id: 'FMT-CO-BANREP-F6-F15',
    code: 'Form. 6 / 15',
    name: 'Formularios 6 y 15 · Endeudamiento Externo y Conciliación Patrimonial Inversiones',
    regulator: 'Banco de la República',
    periodicity: 'Anual',
    families: ['XML', 'TXT'],
    entityTypes: [
      'Establecimientos Bancarios',
      'Sociedades Comerciales (Supersociedades)',
      'Contribuyentes y Personas Jurídicas Generales (DIAN)',
    ],
    obligation: 'Circular Reglamentaria Externa DCIP-83 · Nuevo Sistema de Información Cambiaria (SIC)',
    description:
      'Informe de endeudamiento externo otorgado a residentes/no residentes (Form. 6) y actualización patrimonial anual de empresas receptoras de inversión extranjera (Form. 15).',
    requirements: ['Transmisión en el Sistema de Información Cambiaria (SIC) de BanRep'],
    sourceUrl: BANREP_URL,
  },

  // ============================================================================
  // 8. SUPERSOCIEDADES (SIRFIN / XBRL)
  // ============================================================================
  {
    id: 'FMT-CO-SUPERSOC-INF01',
    code: 'INF-01',
    name: 'Informe 01 · Estados Financieros de Fin de Ejercicio (NIIF Plenas y Pymes — SIRFIN XBRL)',
    regulator: 'Supersociedades - Superintendencia de Sociedades',
    periodicity: 'Anual',
    families: ['XBRL', 'XML'],
    entityTypes: [
      'Sociedades Comerciales (Supersociedades)',
      'Contribuyentes y Personas Jurídicas Generales (DIAN)',
    ],
    obligation: 'Circular Básica Contable Supersociedades · Sistema Integrado de Reportes Financieros SIRFIN',
    description:
      'Presentación anual en taxonomía XBRL (Grupos 1 y 2 NIIF) de estado de situación financiera, estado de resultados, cambios en el patrimonio, flujos de efectivo y notas.',
    requirements: [
      'Instancia XBRL generada/validada para cargue en SIRFIN con documentos adicionales en PDF',
    ],
    sourceUrl: SUPERSOC_URL,
  },
  {
    id: 'FMT-CO-SUPERSOC-INF42',
    code: 'INF-42',
    name: 'Informe 42 · Reporte de Prácticas Empresariales y Gobierno Corporativo',
    regulator: 'Supersociedades - Superintendencia de Sociedades',
    periodicity: 'Anual',
    families: ['XBRL', 'XML'],
    entityTypes: ['Sociedades Comerciales (Supersociedades)'],
    obligation: 'Circular Externa Supersociedades · Encuesta y Seguimiento de Gobierno Corporativo',
    description:
      'Reporte anual sobre estructura societaria, juntas directivas, conflictos de interés, sostenibilidad y buenas prácticas empresariales en sociedades vigiladas.',
    requirements: ['Radicación en SIRFIN conforme al calendario anual según últimos dos dígitos del NIT'],
    sourceUrl: SUPERSOC_URL,
  },
  {
    id: 'FMT-CO-SUPERSOC-INF58',
    code: 'INF-58',
    name: 'Informe 58 · Reporte y Actualización de Oficiales de Cumplimiento SAGRILAFT / PTEE',
    regulator: 'Supersociedades - Superintendencia de Sociedades',
    periodicity: 'Por evento',
    reportingModality: 'Por evento',
    families: ['XBRL', 'XML'],
    entityTypes: ['Sociedades Comerciales (Supersociedades)'],
    obligation: 'Circular Básica Jurídica Supersociedades · Capítulos X (SAGRILAFT) y XIII (PTEE)',
    description:
      'Notificación por evento ante nombramiento, modificación o remoción del oficial de cumplimiento principal o suplente encargado de SAGRILAFT y PTEE.',
    requirements: ['Adjuntar acta de designación de junta directiva y hoja de vida soportada'],
    sourceUrl: SUPERSOC_URL,
  },
  {
    id: 'FMT-CO-SUPERSOC-INF75',
    code: 'INF-75',
    name: 'Informe 75 · Reporte Unificado SAGRILAFT y PTEE (Fusión Informes 50 y 52)',
    regulator: 'Supersociedades - Superintendencia de Sociedades',
    periodicity: 'Anual',
    families: ['XBRL', 'XML'],
    entityTypes: ['Sociedades Comerciales (Supersociedades)'],
    obligation: 'Circular Externa Supersociedades 100-000004/2023 · Prevención LA/FT/FPADM y Corrupción',
    description:
      'Informe anual consolidado de gestión de riesgos de lavado de activos (SAGRILAFT) y Programa de Transparencia y Ética Empresarial (PTEE) en plataforma SIRFIN.',
    requirements: [
      'Aplica a sociedades obligadas según topes de ingresos o activos e industrias vigiladas',
    ],
    sourceUrl: SUPERSOC_URL,
  },

  // ============================================================================
  // 9. ALCALDÍA MAYOR DE BOGOTÁ / SHD (Complemento a MENSUAL)
  // ============================================================================
  {
    id: 'FMT-CO-SHD-EXOGENA-ING',
    code: 'PIDO-ING',
    name: 'Exógena Distrital Bogotá (PIDO / STORM) · Ingresos Obtenidos Fuera de Bogotá y Exenciones',
    regulator: 'Alcaldía Mayor de Bogotá / SHD',
    periodicity: 'Anual',
    families: ['CSV', 'TXT'],
    entityTypes: [
      'Contribuyentes y Personas Jurídicas Generales (DIAN)',
      'Establecimientos Bancarios',
      'Sociedades Comerciales (Supersociedades)',
    ],
    obligation: 'Resolución DDI Secretaría Distrital de Hacienda · Medios Magnéticos Distritales PIDO',
    description:
      'Reporte anual en plataforma PIDO (archivo .STR generado en STORM-User) con los ingresos recibidos en otros municipios, devoluciones y actividades excluidas/exentas de ICA.',
    requirements: ['Archivo plano/STORM-User validado con códigos de actividad económica CIIU Bogotá'],
    sourceUrl: SHD_URL,
  },
  {
    id: 'FMT-CO-SHD-EXOGENA-COM',
    code: 'PIDO-COM-RET',
    name: 'Exógena Distrital Bogotá (PIDO / STORM) · Compras de Bienes/Servicios y Retenciones ICA',
    regulator: 'Alcaldía Mayor de Bogotá / SHD',
    periodicity: 'Anual',
    families: ['CSV', 'TXT'],
    entityTypes: [
      'Contribuyentes y Personas Jurídicas Generales (DIAN)',
      'Establecimientos Bancarios',
      'Sociedades Comerciales (Supersociedades)',
    ],
    obligation: 'Resolución DDI Secretaría Distrital de Hacienda · Artículos de Compras y ReteICA',
    description:
      'Información anual de terceros proveedores por compras en Bogotá, retenciones de ICA practicadas y retenciones de ICA que le fueron practicadas al contribuyente.',
    requirements: ['Validación NIT, municipio, base gravable y tarifa ICA por cada tercero'],
    sourceUrl: SHD_URL,
  },
  {
    id: 'FMT-CO-SHD-ICA-300',
    code: 'ICA-300-BOG',
    name: 'Formulario Declaración Bimestral/Anual del Impuesto de Industria y Comercio (ICA)',
    regulator: 'Alcaldía Mayor de Bogotá / SHD',
    periodicity: 'Bimestral',
    families: ['XML', 'CSV'],
    entityTypes: [
      'Contribuyentes y Personas Jurídicas Generales (DIAN)',
      'Establecimientos Bancarios',
      'Sociedades Comerciales (Supersociedades)',
    ],
    obligation: 'Estatuto Tributario de Bogotá · Oficina Virtual SHD',
    description:
      'Liquidación periódica del impuesto de Industria y Comercio, Avisos y Tableros sobre ingresos gravados en el Distrito Capital.',
    requirements: ['Cruce con ingresos netos declarados en DIAN y exógena distrital PIDO'],
    sourceUrl: SHD_URL,
  },

  // ============================================================================
  // 10. SUPERSALUD - SUPERINTENDENCIA NACIONAL DE SALUD (NRVCC)
  // ============================================================================
  {
    id: 'FMT-CO-SUPERSALUD-FT001',
    code: 'FT001',
    name: 'Formato FT001 · Catálogo de Información Financiera con Fines de Supervisión (NRVCC)',
    regulator: 'Supersalud - Superintendencia Nacional de Salud',
    periodicity: 'Mensual',
    families: ['XML', 'TXT'],
    entityTypes: ['Entidades de Salud EPS / IPS (Supersalud)'],
    obligation: 'Circular Única Supersalud (CE 016/2016 y mod.) · Plataforma NRVCC',
    description:
      'Reporte mensual de saldos contables NIIF de EAPB (EPS), IPS y entidades adaptadas de salud mediante esquema XML oficial de Supersalud.',
    requirements: ['Validación XSD NRVCC de cuentas contables y cuadre por régimen (Contributivo/Subsidiado)'],
    sourceUrl: SUPERSALUD_URL,
  },
  {
    id: 'FMT-CO-SUPERSALUD-FT002',
    code: 'FT002',
    name: 'Formato FT002 · Publicación de Estados Financieros Sector Salud',
    regulator: 'Supersalud - Superintendencia Nacional de Salud',
    periodicity: 'Anual',
    families: ['XML', 'PDF'],
    entityTypes: ['Entidades de Salud EPS / IPS (Supersalud)'],
    obligation: 'Circular Única Supersalud · Cierre Anual NRVCC',
    description:
      'Publicación anual con corte a 31 de diciembre de estados financieros dictaminados de entidades vigiladas por la Superintendencia Nacional de Salud.',
    requirements: ['Consistencia exacta contra los saldos acumulados del FT001 de diciembre'],
    sourceUrl: SUPERSALUD_URL,
  },
  {
    id: 'FMT-CO-SUPERSALUD-FT003',
    code: 'FT003',
    name: 'Formato FT003 · Cuentas por Cobrar / Deudores Sector Salud',
    regulator: 'Supersalud - Superintendencia Nacional de Salud',
    periodicity: 'Trimestral',
    families: ['XML', 'TXT'],
    entityTypes: ['Entidades de Salud EPS / IPS (Supersalud)'],
    obligation: 'Circular Única Supersalud · Cartera por Edades EPS / IPS',
    description:
      'Detalle por tercero de cuentas por cobrar, glosas, recobros ADRES y cartera por edades de entidades prestadoras y aseguradoras de salud.',
    requirements: ['Desagregación por NIT del deudor, rango de vencimiento y deterioro aplicado'],
    sourceUrl: SUPERSALUD_URL,
  },
  {
    id: 'FMT-CO-SUPERSALUD-FT004',
    code: 'FT004',
    name: 'Formato FT004 · Cuentas por Pagar / Detalle de Pasivos por Tercero',
    regulator: 'Supersalud - Superintendencia Nacional de Salud',
    periodicity: 'Trimestral',
    families: ['XML', 'TXT'],
    entityTypes: ['Entidades de Salud EPS / IPS (Supersalud)'],
    obligation: 'Circular Única Supersalud · Saneamiento de Cartera y Pasivos Sector Salud',
    description:
      'Reporte trimestral de obligaciones pendientes de pago con IPS, proveedores de tecnologías en salud y acreedores desagregado por edades y línea de negocio.',
    requirements: ['Cruces automáticos NRVCC contra reporte FT003 de las contrapartes IPS/EPS'],
    sourceUrl: SUPERSALUD_URL,
  },
  {
    id: 'FMT-CO-SUPERSALUD-FT005',
    code: 'FT005 / GT001',
    name: 'Formatos FT005 y GT001 · Costos, Gastos, Pagos Realizados y Buen Gobierno',
    regulator: 'Supersalud - Superintendencia Nacional de Salud',
    periodicity: 'Trimestral',
    families: ['XML', 'TXT'],
    entityTypes: ['Entidades de Salud EPS / IPS (Supersalud)'],
    obligation: 'Circular Única Supersalud · Seguimiento Financiero y Código de Conducta',
    description:
      'Desglose de pagos girados a red prestadora, gastos administrativos y seguimiento al código de conducta y buen gobierno corporativo (GT001 / ST001).',
    requirements: ['Transmisión conjunta en ventanilla electrónica NRVCC de Supersalud'],
    sourceUrl: SUPERSALUD_URL,
  },

  // ============================================================================
  // 11. CGN - CONTADURÍA GENERAL DE LA NACIÓN (SISTEMA CHIP)
  // ============================================================================
  {
    id: 'FMT-CO-CGN-SALDOS',
    code: 'CGN2015_001',
    name: 'Categoría CGN2015_001 · Saldos y Movimientos Contables (CHIP)',
    regulator: 'CGN - Contaduría General de la Nación (CHIP)',
    periodicity: 'Trimestral',
    families: ['TXT', 'CSV'],
    entityTypes: ['Entidades Públicas (CGN / CHIP)'],
    obligation: 'Resolución CGN 533/2015 y 414/2014 · Consolidador de Hacienda e Información Pública CHIP',
    description:
      'Envío trimestral de saldos iniciales, movimientos débito/crédito y saldos finales corriente/no corriente del Catálogo General de Cuentas del Sector Público.',
    requirements: [
      'Archivo plano separado por tabuladores validado en aplicativo CHIP Local antes de envío Web',
    ],
    sourceUrl: CGN_CHIP_URL,
  },
  {
    id: 'FMT-CO-CGN-RECIPROCAS',
    code: 'CGN2015_002',
    name: 'Categoría CGN2015_002 · Operaciones Recíprocas entre Entidades Públicas (CHIP)',
    regulator: 'CGN - Contaduría General de la Nación (CHIP)',
    periodicity: 'Trimestral',
    families: ['TXT', 'CSV'],
    entityTypes: ['Entidades Públicas (CGN / CHIP)'],
    obligation: 'Régimen de Contabilidad Pública CGN · Eliminación para Consolidación Nacional',
    description:
      'Detalle de saldos y transacciones entre entidades públicas (transferencias, aportes, cuentas por cobrar/pagar) con código institucional CHIP de contraparte.',
    requirements: ['Validación cruzada de códigos institucionales CGN entre entidades recíprocas'],
    sourceUrl: CGN_CHIP_URL,
  },
  {
    id: 'FMT-CO-CGN-VARIACIONES',
    code: 'CGN2016_001',
    name: 'Categoría CGN2016_001 · Variaciones Trimestrales Significativas y Control Interno Contable',
    regulator: 'CGN - Contaduría General de la Nación (CHIP)',
    periodicity: 'Anual',
    families: ['TXT', 'CSV'],
    entityTypes: ['Entidades Públicas (CGN / CHIP)'],
    obligation: 'Resolución CGN 193/2016 · Evaluación del Control Interno Contable',
    description:
      'Explicación de variaciones significativas de cuentas y formulario anual de evaluación de control interno contable en plataforma CHIP.',
    requirements: ['Consistencia con saldos de cierre CGN2015_001 del cuarto trimestre'],
    sourceUrl: CGN_CHIP_URL,
  },

  // ============================================================================
  // 12. UGPP - UNIDAD DE GESTIÓN PENSIONAL Y PARAFISCALES
  // ============================================================================
  {
    id: 'FMT-CO-UGPP-PILA',
    code: 'PILA-2388',
    name: 'Planilla Integrada de Liquidación de Aportes (PILA · Anexo Técnico Res. 2388)',
    regulator: 'UGPP - Unidad de Gestión Pensional y Parafiscales',
    periodicity: 'Mensual',
    families: ['TXT', 'CSV'],
    entityTypes: [
      'Contribuyentes y Personas Jurídicas Generales (DIAN)',
      'Establecimientos Bancarios',
      'Sociedades Comerciales (Supersociedades)',
      'Entidades Públicas (CGN / CHIP)',
    ],
    obligation: 'Resolución MinSalud 2388/2016 y mod. · Fiscalización UGPP Protección Social',
    description:
      'Archivo plano mensual posicional para liquidación de aportes a Salud, Pensión, ARL, Cajas de Compensación, SENA e ICBF verificado por la UGPP.',
    requirements: [
      'Registros tipo 1 (encabezado aportante) y tipo 2 (detalle cotizante, IBC y novedades)',
    ],
    sourceUrl: UGPP_URL,
  },
  {
    id: 'FMT-CO-UGPP-NOMINA',
    code: 'UGPP-NOM-EST',
    name: 'Estructura Estandarizada de Nómina y Contabilidad para Requerimientos UGPP',
    regulator: 'UGPP - Unidad de Gestión Pensional y Parafiscales',
    periodicity: 'Por evento',
    reportingModality: 'Por evento',
    families: ['CSV'],
    entityTypes: [
      'Contribuyentes y Personas Jurídicas Generales (DIAN)',
      'Sociedades Comerciales (Supersociedades)',
      'Establecimientos Bancarios',
    ],
    obligation: 'Resolución UGPP 922/2018 · Esquema Único de Entrega de Información de Nómina',
    description:
      'Plantilla normalizada de devengos salariales, pagos no salariales (Art. 30 Ley 1393/2010) y auxiliares contables ante requerimientos de fiscalización UGPP.',
    requirements: ['Validación automática de tope del 40% de pagos no constitutivos de salario'],
    sourceUrl: UGPP_URL,
  },

  // ============================================================================
  // 13. SUPERTRANSPORTE (SISTEMA VIGIA)
  // ============================================================================
  {
    id: 'FMT-CO-SUPERTRANSP-VIGIA-FIN',
    code: 'VIGIA-EEFF',
    name: 'Sistema VIGIA · Estados Financieros NIIF e Información Subjetiva Transporte',
    regulator: 'Supertransporte - Superintendencia de Transporte',
    periodicity: 'Anual',
    families: ['XBRL', 'CSV'],
    entityTypes: ['Operadores de Transporte y Juegos Autorizados'],
    obligation: 'Resoluciones Supertransporte · Cargue Anual Subjetivo en VIGIA / SINST',
    description:
      'Reporte anual de estados financieros bajo NIIF, revelaciones, composición accionaria y dictamen de revisoría fiscal en el sistema VIGIA.',
    requirements: ['Validación en módulos NIIF de VIGIA y anexos digitales firmados'],
    sourceUrl: SUPERTRANSPORTE_URL,
  },
  {
    id: 'FMT-CO-SUPERTRANSP-VIGIA-OPE',
    code: 'VIGIA-OPE',
    name: 'Sistema VIGIA · Información Objetiva Operacional, Flota y Tarifaria',
    regulator: 'Supertransporte - Superintendencia de Transporte',
    periodicity: 'Trimestral',
    families: ['CSV', 'XML'],
    entityTypes: ['Operadores de Transporte y Juegos Autorizados'],
    obligation: 'Resoluciones Supertransporte · Supervisión Operativa Terrestre, Portuaria y Aérea',
    description:
      'Información trimestral de pasajeros/carga movilizada, flota habilitada, rutas, pólizas y cumplimiento operativo de empresas vigiladas.',
    requirements: ['Consistencia con registros RUNT / RNDC y despachos reportados'],
    sourceUrl: SUPERTRANSPORTE_URL,
  },

  // ============================================================================
  // 14. COLJUEGOS
  // ============================================================================
  {
    id: 'FMT-CO-COLJUEGOS-MET',
    code: 'COLJ-DERECHOS',
    name: 'Portal del Operador · Liquidación de Derechos de Explotación e Inventario MET',
    regulator: 'Coljuegos - Empresa Industrial y Comercial del Estado',
    periodicity: 'Mensual',
    families: ['CSV', 'XML'],
    entityTypes: ['Operadores de Transporte y Juegos Autorizados'],
    obligation: 'Ley 643/2001 y Resoluciones Coljuegos · Reporte de Ventas y Derechos de Explotación',
    description:
      'Declaración mensual de ingresos brutos, premios pagados, inventario de Máquinas Electrónicas Tragamonedas (MET) y juegos operados por internet.',
    requirements: ['Transmisión mediante Portal del Operador y SCLM+ en línea'],
    sourceUrl: COLJUEGOS_URL,
  },
  {
    id: 'FMT-CO-COLJUEGOS-SIPLAFT',
    code: 'COLJ-SIPLAFT',
    name: 'Reporte SIPLAFT de Operadores de Juegos de Suerte y Azar',
    regulator: 'Coljuegos - Empresa Industrial y Comercial del Estado',
    periodicity: 'Trimestral',
    families: ['CSV', 'TXT'],
    entityTypes: ['Operadores de Transporte y Juegos Autorizados'],
    obligation: 'Resolución Coljuegos 20195100044514 · Prevención LA/FT Sector Juegos',
    description:
      'Informe periódico de cumplimiento del sistema SIPLAFT y reporte de operaciones en efectivo / ganadores de premios por parte de operadores autorizados.',
    requirements: ['Cruce obligatorio con reportes objetivos de transacciones en efectivo ante UIAF'],
    sourceUrl: COLJUEGOS_URL,
  },

  // ============================================================================
  // 15. BVC / AMV - MERCADO DE VALORES DE COLOMBIA
  // ============================================================================
  {
    id: 'FMT-CO-BVC-RNVE',
    code: 'RNVE-INF-REV',
    name: 'Registro Nacional de Valores y Emisores (RNVE) · Información Relevante y Periódica',
    regulator: 'BVC / AMV - Mercado de Valores de Colombia',
    periodicity: 'Por evento',
    reportingModality: 'Por evento',
    families: ['XML', 'PDF'],
    entityTypes: [
      'Sociedades Comisionistas de Bolsa y FIC',
      'Establecimientos Bancarios',
      'Sociedades Comerciales (Supersociedades)',
      'Entidades Aseguradoras y Reaseguradoras',
    ],
    obligation: 'Decreto 2555 de 2010 (Libro 2, Parte 5) · Divulgación de Información Relevante RNVE / BVC',
    description:
      'Transmisión inmediata de hechos relevantes de emisores listados y publicación trimestral/anual de informes financieros y código País de gobierno corporativo.',
    requirements: ['Divulgación simultánea en SIMEV-RNVE y sistema de información BVC'],
    sourceUrl: BVC_AMV_URL,
  },
  {
    id: 'FMT-CO-AMV-OPE',
    code: 'AMV-OPE',
    name: 'Reportes de Autorregulación, Certificación e Intermediación de Valores (AMV)',
    regulator: 'BVC / AMV - Mercado de Valores de Colombia',
    periodicity: 'Mensual',
    families: ['XML', 'CSV'],
    entityTypes: [
      'Sociedades Comisionistas de Bolsa y FIC',
      'Sociedades Fiduciarias',
      'Establecimientos Bancarios',
      'Administradoras de Fondos de Pensiones y Cesantías (AFP)',
    ],
    obligation: 'Reglamento del Autorregulador del Mercado de Valores (AMV) · Supervisión de Conducta',
    description:
      'Reportes periódicos de operadores certificados, mesas de negociación, control de operaciones OTC/bursátiles y gobierno de conducta ante AMV.',
    requirements: ['Validación de registros de profesionales certificados e historial de órdenes'],
    sourceUrl: BVC_AMV_URL,
  },
];

export const COLOMBIA_EXTENDED_FORMATS: RegulatoryFormat[] =
  COLOMBIA_EXTENDED_BLUEPRINTS.map(buildColombiaFormat);
