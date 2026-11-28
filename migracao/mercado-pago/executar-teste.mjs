import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { criarRecargaTeste, testarRecargaSimulada } from './checkout-teste.mjs';

if (process.argv.includes('--simular')) {
  await testarRecargaSimulada();
  console.log('Simulação de recarga aprovada.');
} else {
  const recarga = criarRecargaTeste({ token: process.env.MP_TEST_ACCESS_TOKEN, requisitar: fetch });
  const entrada = createInterface({ input: stdin, output: stdout });
  try {
    const referencia = randomUUID();
    const profissional = 'profissional-ficticio';
    const link = await recarga.criar({ referencia, profissional, centavos: 3000, creditos: 2 });
    console.log('Checkout de teste:', link);
    while ((await entrada.question('Enter para consultar ou q para sair: ')).trim().toLowerCase() !== 'q') {
      const liberado = await recarga.conciliar(referencia);
      console.log(liberado ? 'Recarga de teste creditada.' : 'Nenhum crédito adicional.',
        'Saldo simulado:', recarga.saldo(profissional));
    }
  } finally {
    entrada.close();
  }
}
