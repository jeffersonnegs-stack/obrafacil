// ============================================================
// ObraFácil — config.js
// Configurações centralizadas do frontend
// ============================================================

const ObraFacil = {
  // URL do backend (Apps Script)
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwxjO-YDc6DcLBOdb0bt19dhGph2Zhrjdg0FlAb_Vgrnr4Sbl3D4DzV5YcTcYqa7Oqx1Q/exec',

  // Token de validação (deve bater com APP_TOKEN no Apps Script)
  APP_TOKEN: 'of_prod_2026_k9x',

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
