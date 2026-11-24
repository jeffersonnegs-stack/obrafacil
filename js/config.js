// ============================================================
// ObraFácil — config.js
// Configurações centralizadas do frontend
// ============================================================

const ObraFacil = {
  // Worker oficial do Obra Fácil.
  SCRIPT_URL: 'https://obrafacil-proxy.lopcos.workers.dev/',

  // WhatsApp admin
  WA_ADMIN: 'CONFIGURAR_NO_DEPLOY',

  // Sessão expira em 30 dias (ms)
  SESSION_TTL: 30 * 24 * 60 * 60 * 1000,

  // Chave do localStorage
  SESSION_KEY: 'obrafacil_sessao_teste',

  // Versão do cache PWA — mude aqui a cada deploy
  CACHE_VERSION: '2026-05-14-v1',
};

// Congela o objeto para evitar modificação acidental
Object.freeze(ObraFacil);
