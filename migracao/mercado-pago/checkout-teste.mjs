import assert from 'node:assert/strict';

const API = 'https://api.mercadopago.com/v1/orders';

export function criarRecargaTeste({ token, requisitar }) {
  if (!token?.startsWith('TEST-')) throw new Error('Use uma credencial de teste.');
  const pedidos = new Map();
  const creditados = new Set();
  const saldos = new Map();

  async function consultar(url, options = {}) {
    const resposta = await requisitar(url, {
      ...options,
      headers: { Authorization: 'Bearer ' + token, ...options.headers },
    });
    if (!resposta.ok) throw new Error('Orders API respondeu HTTP ' + resposta.status);
    return resposta.json();
  }

  return {
    async criar({ referencia, profissional, centavos, creditos }) {
      if (!/^[a-z0-9-]{8,64}$/i.test(referencia) || !profissional ||
          !Number.isSafeInteger(centavos) || centavos <= 0 ||
          !Number.isSafeInteger(creditos) || creditos <= 0) {
        throw new Error('Recarga de teste inválida.');
      }
      if (pedidos.has(referencia)) throw new Error('Referência já usada.');
      const valor = (centavos / 100).toFixed(2);
      // Reserva a referência antes da chamada para impedir criação concorrente.
      pedidos.set(referencia, null);
      const pedido = await consultar(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': referencia },
        body: JSON.stringify({
          type: 'online', processing_mode: 'manual', total_amount: valor,
          external_reference: referencia,
          items: [{ title: 'Recarga de teste Obra Facil', quantity: 1, unit_price: valor }],
        }),
      });
      if (typeof pedido.id !== 'string' || !/^ORDTST[A-Z0-9]+$/.test(pedido.id) ||
          pedido.external_reference !== referencia || pedido.total_amount !== valor) {
        throw new Error('Pedido de teste não reconhecido.');
      }
      pedidos.set(referencia, { id: pedido.id, profissional, valor, creditos });
      const checkout = new URL(pedido.checkout_url);
      if (checkout.origin !== 'https://www.mercadopago.com.br' ||
          checkout.pathname !== '/checkout/v1/redirect' ||
          checkout.searchParams.get('order_id') !== pedido.id) {
        throw new Error('Endereço do checkout de teste inválido.');
      }
      return checkout.href;
    },

    async conciliar(referencia) {
      const esperado = pedidos.get(referencia);
      if (!esperado) throw new Error('Pedido de teste não encontrado.');
      const pedido = await consultar(API + '/' + esperado.id);
      if (pedido.id !== esperado.id || pedido.external_reference !== referencia ||
          pedido.total_amount !== esperado.valor || pedido.currency !== 'BRL') {
        throw new Error('Dados da cobrança não conferem.');
      }
      if (pedido.status !== 'processed' || pedido.status_detail !== 'accredited' ||
          creditados.has(esperado.id)) return false;
      if (pedido.total_paid_amount !== esperado.valor) {
        throw new Error('Valor pago não confere.');
      }
      creditados.add(esperado.id);
      saldos.set(esperado.profissional, (saldos.get(esperado.profissional) || 0) + esperado.creditos);
      return true;
    },

    saldo(profissional) {
      return saldos.get(profissional) || 0;
    },
  };
}

export async function testarRecargaSimulada() {
  let pedido;
  const recarga = criarRecargaTeste({
    token: 'TEST-MOCK',
    async requisitar(url, opcoes) {
      if (opcoes.method === 'POST') {
        assert.equal(opcoes.headers['X-Idempotency-Key'], 'recarga-001');
        const dados = JSON.parse(opcoes.body);
        pedido = { ...dados, id: 'ORDTST0001', currency: 'BRL', status: 'created',
          checkout_url: 'https://www.mercadopago.com.br/checkout/v1/redirect?order_id=ORDTST0001' };
      } else {
        assert.equal(url, API + '/ORDTST0001');
      }
      return { ok: true, json: async () => ({ ...pedido }) };
    },
  });
  const link = await recarga.criar({ referencia: 'recarga-001', profissional: 'teste', centavos: 3000, creditos: 2 });
  assert.equal(new URL(link).searchParams.get('order_id'), 'ORDTST0001');
  assert.equal(await recarga.conciliar('recarga-001'), false);
  assert.equal(recarga.saldo('teste'), 0);
  pedido.status = 'processed';
  pedido.status_detail = 'accredited';
  pedido.total_amount = '31.00';
  await assert.rejects(recarga.conciliar('recarga-001'), /não conferem/);
  pedido.total_amount = '30.00';
  pedido.total_paid_amount = '29.00';
  await assert.rejects(recarga.conciliar('recarga-001'), /Valor pago não confere/);
  pedido.total_paid_amount = '30.00';
  const conciliacoes = await Promise.all([recarga.conciliar('recarga-001'), recarga.conciliar('recarga-001')]);
  assert.deepEqual(conciliacoes, [true, false]);
  assert.equal(recarga.saldo('teste'), 2);
}
