// A sessão de teste vive somente na memória desta página.
const Auth = (() => {
  let profissional = null;

  function salvar(dados) { profissional = dados; }
  function carregar() { return profissional; }
  function limpar() { profissional = null; }
  function atualizarCreditos(creditos) {
    if (profissional) profissional.creditos = creditos;
  }
  function getProfissional() { return profissional; }

  return { salvar, carregar, limpar, atualizarCreditos, getProfissional };
})();
