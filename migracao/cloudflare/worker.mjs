const MAX_BYTES = 16 * 1024;
const MAX_PHOTO_REQUEST_BYTES = 3 * 1024 * 1024;
const APPS_SCRIPT_EXEC_URL = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;

function reply(status, message, headers = {}) {
  return Response.json({ sucesso: false, mensagem: message }, {
    status, headers: { ...headers, 'Cache-Control': 'no-store' },
  });
}

async function readJson(request) {
  if (!request.body) throw new SyntaxError();
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        const body = JSON.parse(text + decoder.decode());
        if (body?.acao !== 'uploadFotoObra' && size > MAX_BYTES) throw new RangeError();
        return body;
      }
      size += value.byteLength;
      if (size > MAX_PHOTO_REQUEST_BYTES) {
        await reader.cancel();
        throw new RangeError();
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) {
      return reply(403, 'Origem não permitida.');
    }
    const cors = { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: {
        ...cors,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      } });
    }
    if (request.method !== 'POST') {
      return reply(405, 'Método não permitido.', { ...cors, Allow: 'POST, OPTIONS' });
    }
    const mediaType = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
    if (mediaType !== 'application/json') return reply(415, 'Formato inválido.', cors);

    let body;
    try {
      body = await readJson(request);
    } catch (error) {
      return error instanceof RangeError
        ? reply(413, 'Pedido muito grande.', cors)
        : reply(400, 'Pedido inválido.', cors);
    }

    const action = body?.acao;
    const publicForm = ['adicionarLeadPublico', 'solicitarCadastro'].includes(action);
    const professionalRead = ['loginProfissional', 'getSaldoCreditos', 'getHistoricoDesb', 'getLeadsDisponiveis', 'desbloquearLead', 'logoutProfissional', 'uploadFotoObra'].includes(action);
    if (!publicForm && !professionalRead) {
      return reply(403, 'Operação indisponível.', cors);
    }
    if (!body.dados || typeof body.dados !== 'object' || Array.isArray(body.dados)) {
      return reply(400, 'Pedido inválido.', cors);
    }
    if (typeof env.APPS_SCRIPT_URL !== 'string' || !APPS_SCRIPT_EXEC_URL.test(env.APPS_SCRIPT_URL) ||
        typeof env.APPS_SCRIPT_TOKEN !== 'string' || !/^[a-fA-F0-9]{64}$/.test(env.APPS_SCRIPT_TOKEN)) {
      return reply(503, 'Serviço indisponível.', cors);
    }

    try {
      const upstream = await fetch(env.APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: action,
          dados: { ...body.dados, _token: env.APPS_SCRIPT_TOKEN },
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!upstream.ok) return reply(502, 'Falha ao registrar o pedido.', cors);

      const result = await upstream.json();
      if (action === 'desbloquearLead' && result?.semCredito === true) {
        return Response.json({ sucesso: false, semCredito: true, mensagem: 'Saldo insuficiente.' }, {
          status: 422, headers: { ...cors, 'Cache-Control': 'no-store' },
        });
      }
      if (result?.sucesso !== true) return reply(422, publicForm ? 'Não foi possível registrar o pedido.' : 'Acesso indisponível. Confira a sessão.', cors);
      return Response.json(publicForm ? { sucesso: true } : result, {
        headers: { ...cors, 'Cache-Control': 'no-store' },
      });
    } catch {
      return reply(502, 'Falha ao registrar o pedido.', cors);
    }
  },
};
