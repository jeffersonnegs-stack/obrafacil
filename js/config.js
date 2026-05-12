// ============================================================
// ObraFácil — config.js
// Configurações centralizadas do frontend
// ============================================================

const ObraFacil = {
  // URL do backend (Apps Script)
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwvUvluA2sDbwXd-Dbik3j2TFGU0kbxPMxXfLJ0XS6du1gO3wQCkg8xZODMf9aZ3FF5HA/exec',

  // Token de validação (deve bater com APP_TOKEN no Apps Script)
  APP_TOKEN: 'CONFIGURAR_NO_DEPLOY',

  // WhatsApp admin
  WA_ADMIN: 'CONFIGURAR_NO_DEPLOY',

  // Sessão expira em 30 dias (ms)
  SESSION_TTL: 30 * 24 * 60 * 60 * 1000,

  // Chave do localStorage
  SESSION_KEY: 'obrafacil_sessao_v2',

  // Versão do cache PWA — mude aqui a cada deploy
  CACHE_VERSION: 'CONFIGURAR_NO_DEPLOY',
};

// Congela o objeto para evitar modificação acidental
Object.freeze(ObraFacil);
