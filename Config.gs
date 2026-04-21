/**
 * Configuración global, constantes y definición de columnas.
 * Todas las hojas y el frontend consumen estas constantes.
 */

var CONFIG = {
  APP_NAME: 'Acta de Guardias - Farmacia Hospitalaria',
  VERSION: '1.0.0',

  SHEETS: {
    CONFIG:      'Config',
    USUARIOS:    'Usuarios',
    PARTES:      'PartesGuardia',
    INCIDENCIAS: 'Incidencias',
    ADJUNTOS:    'Adjuntos',
    CATALOGOS:   'Catalogos'
  },

  ROLES: {
    ADMIN:  'admin',
    EDITOR: 'editor',
    LECTOR: 'lector'
  },

  ESTADOS_PARTE: {
    BORRADOR: 'borrador',
    CERRADO:  'cerrado'
  },

  ESTADOS_INCIDENCIA: {
    ABIERTA:     'abierta',
    RESUELTA:    'resuelta',
    INFORMATIVA: 'informativa',
    CERRADA:     'cerrada'
  },

  PRIORIDADES: ['baja', 'media', 'alta', 'crítica'],

  TIPOS_PERIODO: ['Fin de semana', 'Puente', 'Festivo', 'Otro'],

  TIPOS_ENTRADA: [
    'Incidencia clínica',
    'Incidencia logística',
    'Desabastecimiento',
    'Cambio organizativo',
    'Recordatorio',
    'Propuesta de mejora',
    'Incidencia de dispensación',
    'Incidencia de mezclas / nutrición',
    'Incidencia de gestión',
    'Incidencia oncohematológica',
    'Otro'
  ],

  AREAS: [
    'Unidosis',
    'Mezclas IV / Nutrición',
    'Gestión',
    'Oncohematología',
    'Consultas externas',
    'Hospitalización',
    'UCI',
    'Urgencias',
    'Otro'
  ],

  // Patrones para detectar posibles identificadores directos de pacientes
  PATRONES_SENSIBLES: [
    /\b\d{8}[A-Za-z]\b/,          // DNI formato español
    /\bNH[CK]?\s*[:\-]?\s*\d+/i,  // NHC / NH
    /\bSIP\s*[:\-]?\s*\d+/i,       // SIP
    /\bCIP\s*[:\-]?\s*\d+/i,       // CIP
    /\btarjeta\s+sanitaria\s*[:\-]?\s*\d+/i
  ]
};

// Índices de columnas (base 0) para cada hoja.
// Deben coincidir exactamente con el orden de HEADERS en Setup.gs.
var COLS = {
  CONFIG: {
    CLAVE: 0, VALOR: 1, DESCRIPCION: 2
  },
  USUARIOS: {
    EMAIL: 0, NOMBRE: 1, ROL: 2, ACTIVO: 3, PASSWORD: 4, FECHA_ALTA: 5
  },
  PARTES: {
    ID: 0, FECHA_INICIO: 1, FECHA_FIN: 2, TIPO_PERIODO: 3,
    PROFESIONALES: 4, AREAS_IMPLICADAS: 5, CREADO_POR: 6, FECHA_CREACION: 7,
    ULTIMA_MODIFICACION: 8, MODIFICADO_POR: 9, ESTADO: 10, OBSERVACIONES: 11
  },
  INCIDENCIAS: {
    ID: 0, ID_PARTE: 1, FECHA_EVENTO: 2, AREA: 3, TIPO_ENTRADA: 4,
    DESCRIPCION: 5, ACTUACION: 6, MEDICAMENTOS: 7, SERVICIO: 8,
    PRIORIDAD: 9, ETIQUETAS: 10, REGISTRADO_POR: 11, FECHA_REGISTRO: 12,
    FECHA_MODIFICACION: 13, MODIFICADO_POR: 14, ESTADO: 15,
    SEGUIMIENTO: 16, TIENE_ADJUNTOS: 17
  },
  ADJUNTOS: {
    ID: 0, ID_INCIDENCIA: 1, ID_PARTE: 2, NOMBRE_ARCHIVO: 3,
    URL_DRIVE: 4, ID_DRIVE: 5, FECHA_SUBIDA: 6, SUBIDO_POR: 7,
    TIPO_ARCHIVO: 8, TAMANYO: 9
  },
  CATALOGOS: {
    TIPO: 0, VALOR: 1, DESCRIPCION: 2, ACTIVO: 3, ORDEN: 4
  }
};
