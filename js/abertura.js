(() => {
  const abertura = document.getElementById('abertura');
  if (typeof abertura?.showModal !== 'function') return;

  const chave = 'obrafacil-abertura-v1';
  try {
    if (sessionStorage.getItem(chave)) return;
    abertura.showModal();
    sessionStorage.setItem(chave, '1');
  } catch {
    if (!abertura.open) return;
  }

  const duracaoFrase = 3000;
  const frases = [...abertura.querySelectorAll('.abertura-frase')];
  const intervalos = frases.slice(1).map((frase, indice) => setTimeout(() => {
    frases[indice].hidden = true;
    frase.hidden = false;
  }, (indice + 1) * duracaoFrase));
  intervalos.push(setTimeout(() => abertura.close(), frases.length * duracaoFrase));
  abertura.querySelector('.abertura-pular').addEventListener('click', () => abertura.close());
  abertura.addEventListener('close', () => intervalos.forEach(clearTimeout), { once: true });
})();
