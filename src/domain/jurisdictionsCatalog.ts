import { ReceivingOrganismDefinition } from './types';

export type JurisdictionRegion = 'América' | 'Europa' | 'Global';

export interface JurisdictionRegulatorOption {
  id: string;
  shortName: string;
  name: string;
  scope: string;
}

export interface JurisdictionCatalogEntry {
  country: string;
  region: JurisdictionRegion;
  subregion: string;
  regulators: JurisdictionRegulatorOption[];
}

export function normalizeSearchText(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export const AMERICAS_AND_EUROPE_COUNTRIES: JurisdictionCatalogEntry[] = [
  // ==========================================================================
  // AMÉRICA
  // ==========================================================================
  {
    country: 'Argentina',
    region: 'América',
    subregion: 'Sudamérica',
    regulators: [
      { id: 'AR-BCRA', shortName: 'BCRA', name: 'Banco Central de la República Argentina', scope: 'Banca y entidades financieras' },
      { id: 'AR-CNV', shortName: 'CNV', name: 'Comisión Nacional de Valores', scope: 'Mercado de capitales' },
      { id: 'AR-SSN', shortName: 'SSN', name: 'Superintendencia de Seguros de la Nación', scope: 'Seguros y reaseguros' },
      { id: 'AR-UIF', shortName: 'UIF', name: 'Unidad de Información Financiera', scope: 'Prevención LA/FT' },
      { id: 'AR-ARCA', shortName: 'ARCA', name: 'Agencia de Recaudación y Control Aduanero (ex AFIP)', scope: 'Tributario y aduanero' },
    ],
  },
  {
    country: 'Belice',
    region: 'América',
    subregion: 'Centroamérica y Caribe',
    regulators: [
      { id: 'BZ-CBB', shortName: 'CBB', name: 'Central Bank of Belize', scope: 'Banca y sistema financiero' },
      { id: 'BZ-FSC', shortName: 'FSC', name: 'Financial Services Commission', scope: 'Servicios financieros no bancarios' },
      { id: 'BZ-FIU', shortName: 'FIU', name: 'Financial Intelligence Unit Belize', scope: 'Prevención LA/FT' },
    ],
  },
  {
    country: 'Bolivia',
    region: 'América',
    subregion: 'Sudamérica',
    regulators: [
      { id: 'BO-ASFI', shortName: 'ASFI', name: 'Autoridad de Supervisión del Sistema Financiero', scope: 'Banca y valores' },
      { id: 'BO-APS', shortName: 'APS', name: 'Autoridad de Fiscalización y Control de Pensiones y Seguros', scope: 'Pensiones y seguros' },
      { id: 'BO-UIF', shortName: 'UIF', name: 'Unidad de Investigaciones Financieras', scope: 'Prevención LA/FT' },
      { id: 'BO-SIN', shortName: 'SIN', name: 'Servicio de Impuestos Nacionales', scope: 'Tributario' },
    ],
  },
  {
    country: 'Brasil',
    region: 'América',
    subregion: 'Sudamérica',
    regulators: [
      { id: 'BR-BCB', shortName: 'BCB', name: 'Banco Central do Brasil', scope: 'Banca y sistema financiero' },
      { id: 'BR-CVM', shortName: 'CVM', name: 'Comissão de Valores Mobiliários', scope: 'Mercado de valores' },
      { id: 'BR-SUSEP', shortName: 'SUSEP', name: 'Superintendência de Seguros Privados', scope: 'Seguros y previsión' },
      { id: 'BR-COAF', shortName: 'COAF', name: 'Conselho de Controle de Atividades Financeiras', scope: 'Prevención LD/FT' },
      { id: 'BR-RFB', shortName: 'RFB', name: 'Receita Federal do Brasil', scope: 'Tributario y aduanero' },
    ],
  },
  {
    country: 'Canadá',
    region: 'América',
    subregion: 'Norteamérica',
    regulators: [
      { id: 'CA-OSFI', shortName: 'OSFI', name: 'Office of the Superintendent of Financial Institutions', scope: 'Banca, seguros y pensiones' },
      { id: 'CA-CSA', shortName: 'CSA', name: 'Canadian Securities Administrators', scope: 'Mercado de valores' },
      { id: 'CA-FINTRAC', shortName: 'FINTRAC', name: 'Financial Transactions and Reports Analysis Centre', scope: 'Prevención AML/ATF' },
      { id: 'CA-CRA', shortName: 'CRA', name: 'Canada Revenue Agency', scope: 'Tributario' },
    ],
  },
  {
    country: 'Chile',
    region: 'América',
    subregion: 'Sudamérica',
    regulators: [
      { id: 'CL-CMF', shortName: 'CMF', name: 'Comisión para el Mercado Financiero', scope: 'Banca, valores y seguros' },
      { id: 'CL-BCCH', shortName: 'BCCh', name: 'Banco Central de Chile', scope: 'Estabilidad financiera y cambiaria' },
      { id: 'CL-UAF', shortName: 'UAF', name: 'Unidad de Análisis Financiero', scope: 'Prevención LA/FT' },
      { id: 'CL-SII', shortName: 'SII', name: 'Servicio de Impuestos Internos', scope: 'Tributario' },
    ],
  },
  {
    country: 'Colombia',
    region: 'América',
    subregion: 'Sudamérica',
    regulators: [
      { id: 'ORG-CO-SFC', shortName: 'SFC', name: 'SFC - Superintendencia Financiera de Colombia', scope: 'Banca, aseguradoras y valores' },
      { id: 'ORG-CO-DIAN', shortName: 'DIAN', name: 'DIAN - Dirección de Impuestos y Aduanas Nacionales', scope: 'Exógena, impuestos y electrónica' },
      { id: 'ORG-CO-FOGAFIN', shortName: 'Fogafín', name: 'Fogafín - Fondo de Garantías de Instituciones Financieras', scope: 'Seguro de depósitos bancarios' },
      { id: 'ORG-CO-UIAF', shortName: 'UIAF', name: 'UIAF - Unidad de Información y Análisis Financiero', scope: 'Reportes SARLAFT / SIREL' },
      { id: 'ORG-CO-SUPERSOLIDARIA', shortName: 'Supersolidaria', name: 'Superintendencia de la Economía Solidaria', scope: 'Cooperativas y fondos (SICSES/FORC)' },
      { id: 'ORG-CO-SHD', shortName: 'Alcaldía / SHD', name: 'Alcaldía Mayor de Bogotá / SHD', scope: 'Medios magnéticos PIDO e ICA' },
      { id: 'ORG-CO-SFC-SUPERSOC', shortName: 'SFC / Supersociedades', name: 'Superintendencia de Sociedades / SFC', scope: 'Taxonomías conjuntas XBRL NIIF' },
      { id: 'CO-BANREP', shortName: 'BanRep', name: 'Banco de la República', scope: 'Cambiario DCIP-83 y estadísticas' },
      { id: 'CO-SUPERSOC', shortName: 'Supersociedades', name: 'Supersociedades - Superintendencia de Sociedades', scope: 'SIRFIN XBRL, SAGRILAFT y PTEE' },
      { id: 'CO-FOGACOOP', shortName: 'Fogacoop', name: 'Fogacoop - Fondo de Garantías de Entidades Cooperativas', scope: 'Seguro para ahorro cooperativo y SidCore' },
      { id: 'CO-SUPERSALUD', shortName: 'Supersalud', name: 'Supersalud - Superintendencia Nacional de Salud', scope: 'Circular Única NRVCC / EPS e IPS' },
      { id: 'CO-CGN', shortName: 'CGN / CHIP', name: 'CGN - Contaduría General de la Nación (CHIP)', scope: 'Contabilidad pública NICSP/NIIF' },
      { id: 'CO-UGPP', shortName: 'UGPP / PILA', name: 'UGPP - Unidad de Gestión Pensional y Parafiscales', scope: 'PILA, nómina y parafiscales' },
      { id: 'CO-SUPERTRANSPORTE', shortName: 'Supertransporte', name: 'Supertransporte - Superintendencia de Transporte', scope: 'Sistema VIGIA financiero y operativo' },
      { id: 'CO-COLJUEGOS', shortName: 'Coljuegos', name: 'Coljuegos - Empresa Industrial y Comercial del Estado', scope: 'Operadores de juegos, MET y SIPLAFT' },
      { id: 'CO-BVC-AMV', shortName: 'BVC / AMV', name: 'BVC / AMV - Mercado de Valores de Colombia', scope: 'Emisores RNVE y autorregulación' },
    ],
  },
  {
    country: 'Costa Rica',
    region: 'América',
    subregion: 'Centroamérica y Caribe',
    regulators: [
      { id: 'CR-SUGEF', shortName: 'SUGEF', name: 'Superintendencia General de Entidades Financieras', scope: 'Banca y financieras' },
      { id: 'CR-SUGEVAL', shortName: 'SUGEVAL', name: 'Superintendencia General de Valores', scope: 'Mercado de valores' },
      { id: 'CR-SUGESE', shortName: 'SUGESE', name: 'Superintendencia General de Seguros', scope: 'Seguros' },
      { id: 'CR-SUPEN', shortName: 'SUPEN', name: 'Superintendencia de Pensiones', scope: 'Pensiones' },
      { id: 'CR-ICD', shortName: 'UIF / ICD', name: 'Unidad de Inteligencia Financiera (ICD)', scope: 'Prevención LC/FT' },
      { id: 'CR-MH', shortName: 'MH', name: 'Ministerio de Hacienda (Tributación)', scope: 'Tributario' },
    ],
  },
  {
    country: 'Cuba',
    region: 'América',
    subregion: 'Centroamérica y Caribe',
    regulators: [
      { id: 'CU-BCC', shortName: 'BCC', name: 'Banco Central de Cuba', scope: 'Banca y finanzas' },
      { id: 'CU-DGIOF', shortName: 'DGIOF', name: 'Dirección General de Investigación de Operaciones Financieras', scope: 'Prevención LA/FT' },
    ],
  },
  {
    country: 'Ecuador',
    region: 'América',
    subregion: 'Sudamérica',
    regulators: [
      { id: 'EC-SB', shortName: 'SB', name: 'Superintendencia de Bancos del Ecuador', scope: 'Banca privada y pública' },
      { id: 'EC-SEPS', shortName: 'SEPS', name: 'Superintendencia de Economía Popular y Solidaria', scope: 'Cooperativas y mutualistas' },
      { id: 'EC-SCVS', shortName: 'SCVS', name: 'Superintendencia de Compañías, Valores y Seguros', scope: 'Sociedades, valores y seguros' },
      { id: 'EC-UAFE', shortName: 'UAFE', name: 'Unidad de Análisis Financiero y Económico', scope: 'Prevención LA/FT' },
      { id: 'EC-SRI', shortName: 'SRI', name: 'Servicio de Rentas Internas', scope: 'Tributario' },
    ],
  },
  {
    country: 'El Salvador',
    region: 'América',
    subregion: 'Centroamérica y Caribe',
    regulators: [
      { id: 'SV-SSF', shortName: 'SSF', name: 'Superintendencia del Sistema Financiero', scope: 'Banca, valores y seguros' },
      { id: 'SV-BCR', shortName: 'BCR', name: 'Banco Central de Reserva de El Salvador', scope: 'Regulación monetaria y estadística' },
      { id: 'SV-UIF', shortName: 'UIF', name: 'Unidad de Investigación Financiera (FGR)', scope: 'Prevención LDA/FT' },
      { id: 'SV-DGII', shortName: 'DGII', name: 'Dirección General de Impuestos Internos', scope: 'Tributario' },
    ],
  },
  {
    country: 'Estados Unidos',
    region: 'América',
    subregion: 'Norteamérica',
    regulators: [
      { id: 'US-FED', shortName: 'FED', name: 'Board of Governors of the Federal Reserve System', scope: 'Banca central y holdings' },
      { id: 'US-OCC', shortName: 'OCC', name: 'Office of the Comptroller of the Currency', scope: 'Bancos nacionales' },
      { id: 'US-FDIC', shortName: 'FDIC', name: 'Federal Deposit Insurance Corporation', scope: 'Seguro de depósitos y Call Reports' },
      { id: 'US-SEC', shortName: 'SEC', name: 'U.S. Securities and Exchange Commission', scope: 'Mercado de valores (EDGAR / XBRL)' },
      { id: 'US-FINRA', shortName: 'FINRA', name: 'Financial Industry Regulatory Authority', scope: 'Broker-dealers' },
      { id: 'US-FINCEN', shortName: 'FinCEN', name: 'Financial Crimes Enforcement Network', scope: 'BSA / SAR / CTR (AML)' },
      { id: 'US-CFTC', shortName: 'CFTC', name: 'Commodity Futures Trading Commission', scope: 'Derivados y futuros' },
      { id: 'US-IRS', shortName: 'IRS', name: 'Internal Revenue Service', scope: 'Tributario / FATCA' },
    ],
  },
  {
    country: 'Guatemala',
    region: 'América',
    subregion: 'Centroamérica y Caribe',
    regulators: [
      { id: 'GT-SIB', shortName: 'SIB', name: 'Superintendencia de Bancos de Guatemala', scope: 'Banca, financieras y seguros' },
      { id: 'GT-BANGUAT', shortName: 'BANGUAT', name: 'Banco de Guatemala', scope: 'Banca central' },
      { id: 'GT-IVE', shortName: 'IVE', name: 'Intendencia de Verificación Especial', scope: 'Prevención LD/FT' },
      { id: 'GT-SAT', shortName: 'SAT', name: 'Superintendencia de Administración Tributaria', scope: 'Tributario' },
    ],
  },
  {
    country: 'Guyana',
    region: 'América',
    subregion: 'Sudamérica',
    regulators: [
      { id: 'GY-BOG', shortName: 'BoG', name: 'Bank of Guyana', scope: 'Banca y sistema financiero' },
      { id: 'GY-FIU', shortName: 'FIU', name: 'Financial Intelligence Unit Guyana', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Haití',
    region: 'América',
    subregion: 'Centroamérica y Caribe',
    regulators: [
      { id: 'HT-BRH', shortName: 'BRH', name: "Banque de la République d'Haïti", scope: 'Banca y sistema financiero' },
      { id: 'HT-UCREF', shortName: 'UCREF', name: 'Unité Centrale de Renseignements Financiers', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Honduras',
    region: 'América',
    subregion: 'Centroamérica y Caribe',
    regulators: [
      { id: 'HN-CNBS', shortName: 'CNBS', name: 'Comisión Nacional de Bancos y Seguros', scope: 'Banca, seguros y pensiones' },
      { id: 'HN-BCH', shortName: 'BCH', name: 'Banco Central de Honduras', scope: 'Banca central' },
      { id: 'HN-UIF', shortName: 'UIF', name: 'Unidad de Información Financiera', scope: 'Prevención LA/FT' },
      { id: 'HN-SAR', shortName: 'SAR', name: 'Servicio de Administración de Rentas', scope: 'Tributario' },
    ],
  },
  {
    country: 'Jamaica',
    region: 'América',
    subregion: 'Centroamérica y Caribe',
    regulators: [
      { id: 'JM-BOJ', shortName: 'BOJ', name: 'Bank of Jamaica', scope: 'Banca y depósito' },
      { id: 'JM-FSC', shortName: 'FSC', name: 'Financial Services Commission Jamaica', scope: 'Valores, seguros y pensiones' },
      { id: 'JM-FID', shortName: 'FID', name: 'Financial Investigations Division', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'México',
    region: 'América',
    subregion: 'Norteamérica',
    regulators: [
      { id: 'MX-CNBV', shortName: 'CNBV', name: 'Comisión Nacional Bancaria y de Valores', scope: 'Banca, valores y SOFOMES' },
      { id: 'MX-BANXICO', shortName: 'Banxico', name: 'Banco de México', scope: 'Reportes regulatorios y operaciones' },
      { id: 'MX-CNSF', shortName: 'CNSF', name: 'Comisión Nacional de Seguros y Fianzas', scope: 'Aseguradoras y afianzadoras' },
      { id: 'MX-CONSAR', shortName: 'CONSAR', name: 'Comisión Nacional del Sistema de Ahorro para el Retiro', scope: 'AFORES y pensiones' },
      { id: 'MX-UIF', shortName: 'UIF', name: 'Unidad de Inteligencia Financiera (SHCP)', scope: 'Prevención PLD/FT' },
      { id: 'MX-SAT', shortName: 'SAT', name: 'Servicio de Administración Tributaria', scope: 'Tributario y CFDI' },
    ],
  },
  {
    country: 'Nicaragua',
    region: 'América',
    subregion: 'Centroamérica y Caribe',
    regulators: [
      { id: 'NI-SIBOIF', shortName: 'SIBOIF', name: 'Superintendencia de Bancos y de Otras Instituciones Financieras', scope: 'Banca, valores y seguros' },
      { id: 'NI-UAF', shortName: 'UAF', name: 'Unidad de Análisis Financiero de Nicaragua', scope: 'Prevención LA/FT' },
    ],
  },
  {
    country: 'Panamá',
    region: 'América',
    subregion: 'Centroamérica y Caribe',
    regulators: [
      { id: 'PA-SBP', shortName: 'SBP', name: 'Superintendencia de Bancos de Panamá', scope: 'Banca y fiduciarias' },
      { id: 'PA-SMV', shortName: 'SMV', name: 'Superintendencia del Mercado de Valores', scope: 'Mercado de valores' },
      { id: 'PA-SSRP', shortName: 'SSRP', name: 'Superintendencia de Seguros y Reaseguros de Panamá', scope: 'Seguros y reaseguros' },
      { id: 'PA-UAF', shortName: 'UAF', name: 'Unidad de Análisis Financiero de Panamá', scope: 'Prevención BC/FT' },
      { id: 'PA-DGI', shortName: 'DGI', name: 'Dirección General de Ingresos', scope: 'Tributario' },
    ],
  },
  {
    country: 'Paraguay',
    region: 'América',
    subregion: 'Sudamérica',
    regulators: [
      { id: 'PY-BCP', shortName: 'BCP / SB', name: 'Banco Central del Paraguay (Superintendencia de Bancos)', scope: 'Banca y seguros' },
      { id: 'PY-SIV', shortName: 'SIV', name: 'Superintendencia de Valores', scope: 'Mercado de valores' },
      { id: 'PY-SEPRELAD', shortName: 'SEPRELAD', name: 'Secretaría de Prevención de Lavado de Dinero o Bienes', scope: 'Prevención ALA/CFT' },
      { id: 'PY-DNIT', shortName: 'DNIT', name: 'Dirección Nacional de Ingresos Tributarios', scope: 'Tributario' },
    ],
  },
  {
    country: 'Perú',
    region: 'América',
    subregion: 'Sudamérica',
    regulators: [
      { id: 'ORG-PE-SBS', shortName: 'SBS Perú', name: 'SBS Perú - Superintendencia de Banca, Seguros y AFP', scope: 'Banca, seguros y AFP (SUCAVE)' },
      { id: 'ORG-PE-BCRP-SBS', shortName: 'BCRP / SBS', name: 'BCRP / SBS Perú', scope: 'Operaciones cambiarias y monetarias' },
      { id: 'PE-SMV', shortName: 'SMV', name: 'Superintendencia del Mercado de Valores', scope: 'Mercado de valores' },
      { id: 'PE-UIF', shortName: 'UIF-Perú', name: 'Unidad de Inteligencia Financiera del Perú', scope: 'Reportes ROS y PLAFT' },
      { id: 'PE-SUNAT', shortName: 'SUNAT', name: 'Superintendencia Nacional de Aduanas y Administración Tributaria', scope: 'Tributario y PLE' },
    ],
  },
  {
    country: 'Puerto Rico',
    region: 'América',
    subregion: 'Centroamérica y Caribe',
    regulators: [
      { id: 'PR-OCIF', shortName: 'OCIF', name: 'Oficina del Comisionado de Instituciones Financieras', scope: 'Banca y entidades financieras' },
      { id: 'PR-OCS', shortName: 'OCS', name: 'Oficina del Comisionado de Seguros', scope: 'Seguros' },
    ],
  },
  {
    country: 'República Dominicana',
    region: 'América',
    subregion: 'Centroamérica y Caribe',
    regulators: [
      { id: 'DO-SB', shortName: 'SB', name: 'Superintendencia de Bancos de la República Dominicana', scope: 'Intermediación financiera' },
      { id: 'DO-SIMV', shortName: 'SIMV', name: 'Superintendencia del Mercado de Valores', scope: 'Mercado de valores' },
      { id: 'DO-SIPEN', shortName: 'SIPEN', name: 'Superintendencia de Pensiones', scope: 'Pensiones' },
      { id: 'DO-UAF', shortName: 'UAF', name: 'Unidad de Análisis Financiero', scope: 'Prevención LA/FT' },
      { id: 'DO-DGII', shortName: 'DGII', name: 'Dirección General de Impuestos Internos', scope: 'Tributario' },
    ],
  },
  {
    country: 'Surinam',
    region: 'América',
    subregion: 'Sudamérica',
    regulators: [
      { id: 'SR-CBVS', shortName: 'CBvS', name: 'Centrale Bank van Suriname', scope: 'Banca y finanzas' },
      { id: 'SR-FIU', shortName: 'FIU Suriname', name: 'Financial Intelligence Unit Suriname', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Trinidad y Tobago',
    region: 'América',
    subregion: 'Centroamérica y Caribe',
    regulators: [
      { id: 'TT-CBTT', shortName: 'CBTT', name: 'Central Bank of Trinidad and Tobago', scope: 'Banca y seguros' },
      { id: 'TT-SEC', shortName: 'TTSEC', name: 'Trinidad and Tobago Securities and Exchange Commission', scope: 'Mercado de valores' },
      { id: 'TT-FIU', shortName: 'FIUTT', name: 'Financial Intelligence Unit of Trinidad and Tobago', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Uruguay',
    region: 'América',
    subregion: 'Sudamérica',
    regulators: [
      { id: 'UY-BCU', shortName: 'BCU / SSF', name: 'Banco Central del Uruguay (Superintendencia de Servicios Financieros)', scope: 'Banca, valores y seguros' },
      { id: 'UY-SENACLAFT', shortName: 'SENACLAFT', name: 'Secretaría Nacional para la Lucha contra el Lavado de Activos', scope: 'Prevención LA/FT' },
      { id: 'UY-DGI', shortName: 'DGI', name: 'Dirección General Impositiva', scope: 'Tributario' },
    ],
  },
  {
    country: 'Venezuela',
    region: 'América',
    subregion: 'Sudamérica',
    regulators: [
      { id: 'VE-SUDEBAN', shortName: 'SUDEBAN', name: 'Superintendencia de las Instituciones del Sector Bancario', scope: 'Banca y financieras' },
      { id: 'VE-SUNAVAL', shortName: 'SUNAVAL', name: 'Superintendencia Nacional de Valores', scope: 'Mercado de valores' },
      { id: 'VE-SUDEASEG', shortName: 'SUDEASEG', name: 'Superintendencia de la Actividad Aseguradora', scope: 'Seguros' },
      { id: 'VE-UNIF', shortName: 'UNIF', name: 'Unidad Nacional de Inteligencia Financiera', scope: 'Prevención LC/FT' },
      { id: 'VE-SENIAT', shortName: 'SENIAT', name: 'Servicio Nacional Integrado de Administración Aduanera y Tributaria', scope: 'Tributario' },
    ],
  },

  // ==========================================================================
  // EUROPA
  // ==========================================================================
  {
    country: 'Unión Europea (Supranacional)',
    region: 'Europa',
    subregion: 'Instituciones UE',
    regulators: [
      { id: 'EU-EBA', shortName: 'EBA', name: 'European Banking Authority (COREP / FINREP / DORA)', scope: 'Supervisión bancaria UE' },
      { id: 'EU-ESMA', shortName: 'ESMA', name: 'European Securities and Markets Authority (EMIR / MiFIR / ESEF)', scope: 'Mercados de valores UE' },
      { id: 'EU-EIOPA', shortName: 'EIOPA', name: 'European Insurance and Occupational Pensions Authority (Solvency II)', scope: 'Seguros y pensiones UE' },
      { id: 'EU-ECB', shortName: 'ECB / SSM', name: 'European Central Bank (Single Supervisory Mechanism)', scope: 'Mecanismo Único de Supervisión' },
      { id: 'EU-AMLA', shortName: 'AMLA', name: 'Authority for Anti-Money Laundering and CFT', scope: 'Prevención AML/CFT UE' },
    ],
  },
  {
    country: 'Alemania',
    region: 'Europa',
    subregion: 'Europa Occidental',
    regulators: [
      { id: 'DE-BAFIN', shortName: 'BaFin', name: 'Bundesanstalt für Finanzdienstleistungsaufsicht', scope: 'Banca, valores y seguros' },
      { id: 'DE-BUBA', shortName: 'Bundesbank', name: 'Deutsche Bundesbank', scope: 'Reportes prudenciales y estadísticos' },
      { id: 'DE-FIU', shortName: 'FIU Deutschland', name: 'Zentralstelle für Finanztransaktionsuntersuchungen', scope: 'Prevención GwG / AML' },
      { id: 'DE-BZST', shortName: 'BZSt', name: 'Bundeszentralamt für Steuern', scope: 'Tributario / CRS / DAC' },
    ],
  },
  {
    country: 'Austria',
    region: 'Europa',
    subregion: 'Europa Occidental',
    regulators: [
      { id: 'AT-FMA', shortName: 'FMA', name: 'Finanzmarktaufsichtsbehörde', scope: 'Banca, valores y seguros' },
      { id: 'AT-OENB', shortName: 'OeNB', name: 'Oesterreichische Nationalbank', scope: 'Reportes prudenciales' },
      { id: 'AT-FIU', shortName: 'A-FIU', name: 'Geldwäschemeldestelle (BKA)', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Bélgica',
    region: 'Europa',
    subregion: 'Europa Occidental',
    regulators: [
      { id: 'BE-NBB', shortName: 'NBB / BNB', name: 'Nationale Bank van België / Banque Nationale de Belgique', scope: 'Supervisión prudencial' },
      { id: 'BE-FSMA', shortName: 'FSMA', name: 'Financial Services and Markets Authority', scope: 'Mercados y conducta' },
      { id: 'BE-CTIF', shortName: 'CTIF-CFI', name: 'Cellule de Traitement des Informations Financières', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Bulgaria',
    region: 'Europa',
    subregion: 'Europa Central y del Este',
    regulators: [
      { id: 'BG-BNB', shortName: 'BNB', name: 'Bulgarian National Bank', scope: 'Supervisión bancaria' },
      { id: 'BG-FSC', shortName: 'FSC', name: 'Financial Supervision Commission', scope: 'Valores, seguros y pensiones' },
      { id: 'BG-FIU', shortName: 'FID-SANS', name: 'Financial Intelligence Directorate', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Chequia',
    region: 'Europa',
    subregion: 'Europa Central y del Este',
    regulators: [
      { id: 'CZ-CNB', shortName: 'ČNB', name: 'Česká národní banka (Czech National Bank)', scope: 'Banca, seguros y mercados' },
      { id: 'CZ-FAU', shortName: 'FAÚ', name: 'Finanční analytický úřad', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Chipre',
    region: 'Europa',
    subregion: 'Europa del Sur',
    regulators: [
      { id: 'CY-CBC', shortName: 'CBC', name: 'Central Bank of Cyprus', scope: 'Banca y pagos' },
      { id: 'CY-CYSEC', shortName: 'CySEC', name: 'Cyprus Securities and Exchange Commission', scope: 'Valores e inversión' },
      { id: 'CY-MOKAS', shortName: 'MOKAS', name: 'Unit for Combating Money Laundering', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Croacia',
    region: 'Europa',
    subregion: 'Europa del Sur',
    regulators: [
      { id: 'HR-HNB', shortName: 'HNB', name: 'Hrvatska narodna banka', scope: 'Supervisión bancaria' },
      { id: 'HR-HANFA', shortName: 'HANFA', name: 'Hrvatska agencija za nadzor financijskih usluga', scope: 'Valores, seguros y pensiones' },
    ],
  },
  {
    country: 'Dinamarca',
    region: 'Europa',
    subregion: 'Europa del Norte',
    regulators: [
      { id: 'DK-DFSA', shortName: 'Finanstilsynet', name: 'Finanstilsynet (Danish FSA)', scope: 'Banca, valores y seguros' },
      { id: 'DK-NB', shortName: 'Nationalbanken', name: 'Danmarks Nationalbank', scope: 'Estadística bancaria y estabilidad' },
      { id: 'DK-FIU', shortName: 'Hvidvasksekretariatet', name: 'Danish Financial Intelligence Unit', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Eslovaquia',
    region: 'Europa',
    subregion: 'Europa Central y del Este',
    regulators: [
      { id: 'SK-NBS', shortName: 'NBS', name: 'Národná banka Slovenska', scope: 'Banca, mercados y seguros' },
      { id: 'SK-FSU', shortName: 'FSU', name: 'Finančná spravodajská jednotka', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Eslovenia',
    region: 'Europa',
    subregion: 'Europa del Sur',
    regulators: [
      { id: 'SI-BS', shortName: 'Banka Slovenije', name: 'Banka Slovenije', scope: 'Supervisión bancaria' },
      { id: 'SI-ATVP', shortName: 'ATVP', name: 'Agencija za trg vrednostnih papirjev', scope: 'Mercado de valores' },
      { id: 'SI-OMLP', shortName: 'OMLP', name: 'Office for Money Laundering Prevention', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'España',
    region: 'Europa',
    subregion: 'Europa del Sur',
    regulators: [
      { id: 'ES-BDE', shortName: 'BdE', name: 'Banco de España', scope: 'Banca, CIRBE y estados financieros' },
      { id: 'ES-CNMV', shortName: 'CNMV', name: 'Comisión Nacional del Mercado de Valores', scope: 'Mercados de valores e inversión' },
      { id: 'ES-DGSFP', shortName: 'DGSFP', name: 'Dirección General de Seguros y Fondos de Pensiones', scope: 'Seguros y pensiones' },
      { id: 'ES-SEPBLAC', shortName: 'SEPBLAC', name: 'Servicio Ejecutivo de la Comisión de Prevención del Blanqueo', scope: 'Prevención PBC/FT' },
      { id: 'ES-AEAT', shortName: 'AEAT', name: 'Agencia Estatal de Administración Tributaria', scope: 'Tributario / SII / CRS' },
    ],
  },
  {
    country: 'Estonia',
    region: 'Europa',
    subregion: 'Europa del Norte',
    regulators: [
      { id: 'EE-FSA', shortName: 'Finantsinspektsioon', name: 'Estonian Financial Supervision Authority', scope: 'Banca, valores y seguros' },
      { id: 'EE-RAB', shortName: 'RAB / FIU', name: 'Rahapesu Andmebüroo (Estonian FIU)', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Finlandia',
    region: 'Europa',
    subregion: 'Europa del Norte',
    regulators: [
      { id: 'FI-FINFSA', shortName: 'FIN-FSA', name: 'Finanssivalvonta (Finnish FSA)', scope: 'Banca, valores y seguros' },
      { id: 'FI-SP', shortName: 'Suomen Pankki', name: 'Bank of Finland', scope: 'Estadística monetaria' },
      { id: 'FI-FIU', shortName: 'KRP / FIU', name: 'Rahanpesun selvittelykeskus', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Francia',
    region: 'Europa',
    subregion: 'Europa Occidental',
    regulators: [
      { id: 'FR-ACPR', shortName: 'ACPR', name: 'Autorité de Contrôle Prudentiel et de Résolution (Banque de France)', scope: 'Banca y seguros' },
      { id: 'FR-AMF', shortName: 'AMF', name: 'Autorité des Marchés Financiers', scope: 'Mercados financieros' },
      { id: 'FR-TRACFIN', shortName: 'TRACFIN', name: 'Traitement du Renseignement et Action contre les Circuits Financiers', scope: 'Prevención LCB-FT' },
      { id: 'FR-DGFIP', shortName: 'DGFiP', name: 'Direction Générale des Finances Publiques', scope: 'Tributario y DAC' },
    ],
  },
  {
    country: 'Grecia',
    region: 'Europa',
    subregion: 'Europa del Sur',
    regulators: [
      { id: 'GR-BOG', shortName: 'BoG', name: 'Bank of Greece', scope: 'Banca y seguros' },
      { id: 'GR-HCMC', shortName: 'HCMC', name: 'Hellenic Capital Market Commission', scope: 'Mercado de capitales' },
      { id: 'GR-HAMLA', shortName: 'HAMLA', name: 'Hellenic Anti-Money Laundering Authority', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Hungría',
    region: 'Europa',
    subregion: 'Europa Central y del Este',
    regulators: [
      { id: 'HU-MNB', shortName: 'MNB', name: 'Magyar Nemzeti Bank', scope: 'Banca, seguros y mercados' },
      { id: 'HU-FIU', shortName: 'HFIU', name: 'Hungarian Financial Intelligence Unit', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Irlanda',
    region: 'Europa',
    subregion: 'Europa Occidental',
    regulators: [
      { id: 'IE-CBI', shortName: 'CBI', name: 'Central Bank of Ireland', scope: 'Banca, fondos, mercados y seguros' },
      { id: 'IE-FIU', shortName: 'FIU Ireland', name: 'Financial Intelligence Unit (An Garda Síochána)', scope: 'Prevención AML/CFT' },
      { id: 'IE-REV', shortName: 'Revenue', name: 'Office of the Revenue Commissioners', scope: 'Tributario' },
    ],
  },
  {
    country: 'Islandia',
    region: 'Europa',
    subregion: 'Europa del Norte',
    regulators: [
      { id: 'IS-CBI', shortName: 'Seðlabanki / FSA', name: 'Central Bank of Iceland (Financial Supervisory Authority)', scope: 'Banca, valores y seguros' },
      { id: 'IS-FIU', shortName: 'FIU Iceland', name: 'Financial Intelligence Unit Iceland', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Italia',
    region: 'Europa',
    subregion: 'Europa del Sur',
    regulators: [
      { id: 'IT-BDI', shortName: "Banca d'Italia", name: "Banca d'Italia (Vigilanza Bancaria e Finanziaria)", scope: 'Banca e intermediarios' },
      { id: 'IT-CONSOB', shortName: 'CONSOB', name: 'Commissione Nazionale per le Società e la Borsa', scope: 'Mercado de valores' },
      { id: 'IT-IVASS', shortName: 'IVASS', name: 'Istituto per la Vigilanza sulle Assicurazioni', scope: 'Seguros' },
      { id: 'IT-UIF', shortName: 'UIF Italia', name: "Unità di Informazione Finanziaria per l'Italia", scope: 'Prevención AML/CFT' },
      { id: 'IT-ADE', shortName: 'Agenzia Entrate', name: 'Agenzia delle Entrate', scope: 'Tributario y CRS' },
    ],
  },
  {
    country: 'Letonia',
    region: 'Europa',
    subregion: 'Europa del Norte',
    regulators: [
      { id: 'LV-LB', shortName: 'Latvijas Banka', name: 'Bank of Latvia', scope: 'Banca, mercados y seguros' },
      { id: 'LV-FID', shortName: 'FID Latvia', name: 'Financial Intelligence Unit of Latvia', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Liechtenstein',
    region: 'Europa',
    subregion: 'Europa Occidental',
    regulators: [
      { id: 'LI-FMA', shortName: 'FMA LI', name: 'Finanzmarktaufsicht Liechtenstein', scope: 'Banca, valores y seguros' },
      { id: 'LI-FIU', shortName: 'EFFI / FIU', name: 'Stabsstelle Financial Intelligence Unit', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Lituania',
    region: 'Europa',
    subregion: 'Europa del Norte',
    regulators: [
      { id: 'LT-LB', shortName: 'Lietuvos bankas', name: 'Bank of Lithuania', scope: 'Banca, fintech, pagos y mercados' },
      { id: 'LT-FCIS', shortName: 'FCIS / FNTT', name: 'Financial Crime Investigation Service', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Luxemburgo',
    region: 'Europa',
    subregion: 'Europa Occidental',
    regulators: [
      { id: 'LU-CSSF', shortName: 'CSSF', name: 'Commission de Surveillance du Secteur Financier', scope: 'Banca, fondos y valores' },
      { id: 'LU-BCL', shortName: 'BCL', name: 'Banque Centrale du Luxembourg', scope: 'Reportes monetarios y liquidez' },
      { id: 'LU-CAA', shortName: 'CAA', name: 'Commissariat aux Assurances', scope: 'Seguros y reaseguros' },
      { id: 'LU-CRF', shortName: 'CRF', name: 'Cellule de Renseignement Financier', scope: 'Prevención LBC/FT' },
    ],
  },
  {
    country: 'Malta',
    region: 'Europa',
    subregion: 'Europa del Sur',
    regulators: [
      { id: 'MT-MFSA', shortName: 'MFSA', name: 'Malta Financial Services Authority', scope: 'Banca, fondos, valores y seguros' },
      { id: 'MT-FIAU', shortName: 'FIAU', name: 'Financial Intelligence Analysis Unit', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Noruega',
    region: 'Europa',
    subregion: 'Europa del Norte',
    regulators: [
      { id: 'NO-FSA', shortName: 'Finanstilsynet NO', name: 'Finanstilsynet (Financial Supervisory Authority of Norway)', scope: 'Banca, valores y seguros' },
      { id: 'NO-NB', shortName: 'Norges Bank', name: 'Central Bank of Norway', scope: 'Banca central' },
      { id: 'NO-FIU', shortName: 'ØKOKRIM / FIU', name: 'Enheten for finansiell etterretning', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Países Bajos',
    region: 'Europa',
    subregion: 'Europa Occidental',
    regulators: [
      { id: 'NL-DNB', shortName: 'DNB', name: 'De Nederlandsche Bank', scope: 'Supervisión prudencial y pagos' },
      { id: 'NL-AFM', shortName: 'AFM', name: 'Autoriteit Financiële Markten', scope: 'Mercados financieros y conducta' },
      { id: 'NL-FIU', shortName: 'FIU-NL', name: 'FIU-Nederland', scope: 'Prevención Wwft / AML' },
      { id: 'NL-BD', shortName: 'Belastingdienst', name: 'Belastingdienst (Tax & Customs)', scope: 'Tributario' },
    ],
  },
  {
    country: 'Polonia',
    region: 'Europa',
    subregion: 'Europa Central y del Este',
    regulators: [
      { id: 'PL-KNF', shortName: 'KNF', name: 'Komisja Nadzoru Finansowego', scope: 'Banca, valores, seguros y pensiones' },
      { id: 'PL-NBP', shortName: 'NBP', name: 'Narodowy Bank Polski', scope: 'Reportes monetarios' },
      { id: 'PL-GIIF', shortName: 'GIIF', name: 'Generalny Inspektor Informacji Finansowej', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Portugal',
    region: 'Europa',
    subregion: 'Europa del Sur',
    regulators: [
      { id: 'PT-BDP', shortName: 'BdP', name: 'Banco de Portugal', scope: 'Banca y central de responsabilidades' },
      { id: 'PT-CMVM', shortName: 'CMVM', name: 'Comissão do Mercado de Valores Mobiliários', scope: 'Mercados de valores' },
      { id: 'PT-ASF', shortName: 'ASF', name: 'Autoridade de Supervisão de Seguros e Fundos de Pensões', scope: 'Seguros y pensiones' },
      { id: 'PT-UIF', shortName: 'UIF Portugal', name: 'Unidade de Informação Financeira', scope: 'Prevención BC/FT' },
      { id: 'PT-AT', shortName: 'AT', name: 'Autoridade Tributária e Aduaneira', scope: 'Tributario' },
    ],
  },
  {
    country: 'Reino Unido',
    region: 'Europa',
    subregion: 'Europa Occidental',
    regulators: [
      { id: 'UK-FCA', shortName: 'FCA', name: 'Financial Conduct Authority (RegData)', scope: 'Conducta, mercados y fintech' },
      { id: 'UK-PRA', shortName: 'PRA', name: 'Prudential Regulation Authority (Bank of England)', scope: 'Supervisión prudencial bancaria y seguros' },
      { id: 'UK-FIU', shortName: 'UKFIU', name: 'UK Financial Intelligence Unit (NCA)', scope: 'Prevención AML / SARs' },
      { id: 'UK-HMRC', shortName: 'HMRC', name: 'HM Revenue & Customs', scope: 'Tributario' },
    ],
  },
  {
    country: 'Rumania',
    region: 'Europa',
    subregion: 'Europa Central y del Este',
    regulators: [
      { id: 'RO-BNR', shortName: 'BNR', name: 'Banca Națională a României', scope: 'Supervisión bancaria' },
      { id: 'RO-ASF', shortName: 'ASF RO', name: 'Autoritatea de Supraveghere Financiară', scope: 'Seguros, capitales y pensiones' },
      { id: 'RO-ONPCSB', shortName: 'ONPCSB', name: 'National Office for Prevention of Money Laundering', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Suecia',
    region: 'Europa',
    subregion: 'Europa del Norte',
    regulators: [
      { id: 'SE-FI', shortName: 'FI', name: 'Finansinspektionen', scope: 'Banca, valores y seguros' },
      { id: 'SE-RB', shortName: 'Riksbanken', name: 'Sveriges Riksbank', scope: 'Estabilidad financiera' },
      { id: 'SE-FIPO', shortName: 'Finanspolisen', name: 'Swedish Financial Intelligence Unit', scope: 'Prevención AML/CFT' },
    ],
  },
  {
    country: 'Suiza',
    region: 'Europa',
    subregion: 'Europa Occidental',
    regulators: [
      { id: 'CH-FINMA', shortName: 'FINMA', name: 'Swiss Financial Market Supervisory Authority', scope: 'Banca, seguros y mercados' },
      { id: 'CH-SNB', shortName: 'SNB', name: 'Schweizerische Nationalbank (Swiss National Bank)', scope: 'Reportes estadísticos y liquidez' },
      { id: 'CH-MROS', shortName: 'MROS', name: 'Money Laundering Reporting Office Switzerland', scope: 'Prevención AML/CFT' },
      { id: 'CH-ESTV', shortName: 'ESTV / AFC', name: 'Swiss Federal Tax Administration', scope: 'Tributario' },
    ],
  },
];

/**
 * Merges base catalog regulators for a country with any dynamically configured ReceivingOrganismDefinitions
 * from ConfiguratorContext (e.g. Colombia/Perú custom entries added in Module D) without duplicating entries.
 */
export function resolveRegulatorsForCountry(
  country: string,
  receivingOrganisms: ReceivingOrganismDefinition[]
): JurisdictionRegulatorOption[] {
  const result: JurisdictionRegulatorOption[] = [];
  const seenNames = new Set<string>();
  const seenShort = new Set<string>();

  const pushUnique = (opt: JurisdictionRegulatorOption) => {
    const normName = normalizeSearchText(opt.name);
    const normShort = normalizeSearchText(opt.shortName);
    if (seenNames.has(normName)) return;
    // Also prevent duplicating when shortName matches (e.g. DIAN vs DIAN - Dirección...)
    if (normShort && seenShort.has(normShort)) return;
    seenNames.add(normName);
    if (normShort) seenShort.add(normShort);
    result.push(opt);
  };

  if (country === 'Multirregulador') {
    receivingOrganisms.forEach((org) =>
      pushUnique({
        id: org.id,
        shortName: org.shortName,
        name: org.name,
        scope: org.country,
      })
    );
    AMERICAS_AND_EUROPE_COUNTRIES.forEach((entry) => {
      entry.regulators.forEach((r) =>
        pushUnique({
          ...r,
          scope: `${entry.country} · ${r.scope}`,
        })
      );
    });
    return result;
  }

  // First include dynamic receiving organisms registered in ConfiguratorContext for this country
  receivingOrganisms
    .filter((org) => normalizeSearchText(org.country) === normalizeSearchText(country))
    .forEach((org) =>
      pushUnique({
        id: org.id,
        shortName: org.shortName,
        name: org.name,
        scope: org.country,
      })
    );

  // Then include full Americas & Europe reference regulators for the selected country
  const catalogEntry = AMERICAS_AND_EUROPE_COUNTRIES.find(
    (c) => normalizeSearchText(c.country) === normalizeSearchText(country)
  );
  if (catalogEntry) {
    catalogEntry.regulators.forEach((r) => pushUnique(r));
  }

  return result;
}

export function searchCountryEntries(
  query: string,
  regionFilter: 'ALL' | 'América' | 'Europa' = 'ALL'
): JurisdictionCatalogEntry[] {
  const q = normalizeSearchText(query);
  return AMERICAS_AND_EUROPE_COUNTRIES.filter((entry) => {
    if (regionFilter !== 'ALL' && entry.region !== regionFilter) return false;
    if (!q) return true;
    if (
      normalizeSearchText(entry.country).includes(q) ||
      normalizeSearchText(entry.region).includes(q) ||
      normalizeSearchText(entry.subregion).includes(q)
    ) {
      return true;
    }
    return entry.regulators.some(
      (r) =>
        normalizeSearchText(r.shortName).includes(q) ||
        normalizeSearchText(r.name).includes(q)
    );
  });
}

export function searchRegulatorOptions(
  regulators: JurisdictionRegulatorOption[],
  query: string
): JurisdictionRegulatorOption[] {
  const q = normalizeSearchText(query);
  if (!q) return regulators;
  return regulators.filter(
    (r) =>
      normalizeSearchText(r.shortName).includes(q) ||
      normalizeSearchText(r.name).includes(q) ||
      normalizeSearchText(r.scope).includes(q)
  );
}
