const MAX_BYTES = 16 * 1024;

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
      if (done) return JSON.parse(text + decoder.decode());
      size += value.byteLength;
      if (size > MAX_BYTES) {
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
    const publicForm = action === 'adicionarLeadPublico';
    const professionalRead = ['loginProfissional', 'getSaldoCreditos', 'getHistoricoDesb'].includes(action);
    if (!publicForm && !(env.ENABLE_TEST_PROFESSIONAL === 'true' && professionalRead)) {
      return reply(403, 'Operação indisponível.', cors);
    }
    if (!body.dados || typeof body.dados !== 'object' || Array.isArray(body.dados)) {
      return reply(400, 'Pedido inválido.', cors);
    }
    if (!env.APPS_SCRIPT_URL || !env.APPS_SCRIPT_TOKEN) {
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
      if (result?.sucesso !== true) return reply(422, publicForm ? 'Não foi possível registrar o pedido.' : 'Acesso indisponível. Confira a sessão ou o código de teste.', cors);
      return Response.json(publicForm ? { sucesso: true } : result, {
        headers: { ...cors, 'Cache-Control': 'no-store' },
      });
    } catch {
      return reply(502, 'Falha ao registrar o pedido.', cors);
    }
  },
};
