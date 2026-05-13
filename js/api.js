// ============================================================
// ObraFácil — js/api.js
// Camada de comunicação com o Google Apps Script
// ============================================================
const Api = (() => {
  function san(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  async function chamar(acao, dados = {}) {
    const url = ObraFacil.SCRIPT_URL;

    if (!url || url.includes('COLE_AQUI')) {
      return {
        sucesso: false,
        mensagem: 'Backend não configurado.'
      };
    }

    const payload = {
      acao,
      dados: { ...dados, _token: ObraFacil.APP_TOKEN }
    };

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await resp.json();
    } catch (e) {
      console.error('[Api] Fetch error:', e.message);
      if (!navigator.onLine) {
        return { sucesso: false, mensagem: 'Sem conexão com a internet.' };
      }
      return { sucesso: false, mensagem: 'Erro de comunicação. Tente novamente.' };
    }
  }

  return { chamar, san };
})();
