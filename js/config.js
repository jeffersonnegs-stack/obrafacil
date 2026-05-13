// ============================================================
// ObraFácil — config.js
// Configurações centralizadas do frontend
// ============================================================

const ObraFacil = {
  // URL do backend (Apps Script)
  SCRIPT_URL: 'https://obrafacil-proxy.lopcos.workers.dev/',

  // Token de validação (deve bater com APP_TOKEN no Apps Script)
  APP_TOKEN: 'of_prod_2026_k9x',

  // WhatsApp admin
  WA_ADMIN: 'CONFIGURAR_NO_DEPLOY',

  // Sessão expira em 30 dias (ms)
  SESSION_TTL: 30 * 24 * 60 * 60 * 1000,

  // Chave do localStorage
  SESSION_KEY: 'obrafacil_sessao_v2',

  // Versão do cache PWA — mude aqui a cada deploy
  CACHE_VERSION: '2026-05-12-v1',
};

// Congela o objeto para evitar modificação acidental
Object.freeze(ObraFacil);
