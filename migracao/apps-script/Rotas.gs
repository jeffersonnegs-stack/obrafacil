function doPost(event) {
  try {
    const raw = event?.postData?.contents;
    if (!raw) return _resposta({ sucesso: false, mensagem: 'Requisição inválida.' });
    const { acao, dados } = JSON.parse(raw);
    const workerSecret = _prop('APPS_SCRIPT_TOKEN');
    if (!chaveSessaoValida_(workerSecret) || dados?._token !== workerSecret) {
      return _resposta({ sucesso: false, mensagem: 'Não autorizado.' });
    }
    delete dados._token;

    const sessionSecret = _prop('PROFESSIONAL_SESSION_SECRET');
    if (acao === 'loginProfissional') {
      if (!chaveSessaoValida_(sessionSecret)) {
        return _resposta({ sucesso: false, mensagem: 'Login indisponível.' });
      }
      const result = loginProfissional(dados.telefone, dados.senha);
      if (result.sucesso && result.profissional) {
        result.profissional.sessao = emitirSessaoProfissional_(
          result.profissional.id, sessionSecret, Date.now()
        );
      }
      return _resposta(result);
    }

    if (acao === 'adicionarLeadPublico') return _resposta(adicionarLeadPublico(dados));
    if (acao === 'solicitarCadastro') return _resposta(solicitarCadastroProfissional(dados));

    const id = identificarProfissional_(dados.sessao, sessionSecret, Date.now());
    if (!id || (dados.idProfissional != null && String(dados.idProfissional) !== id)) {
      return _resposta({ sucesso: false, mensagem: 'Sessão inválida.' });
    }

    switch (acao) {
      case 'logoutProfissional':
        return _resposta({ sucesso: encerrarSessaoProfissional_(id, dados.sessao) });
      case 'getSaldoCreditos':
        return _resposta(getSaldoCreditos(id));
      case 'getHistoricoDesb':
        return _resposta(getHistoricoDesb(id));
      case 'getLeadsDisponiveis':
        return _resposta(getLeadsDisponiveis(id));
      case 'uploadFotoObra':
        return _resposta(salvarFotoPrivada_(id, dados));
      case 'desbloquearLead':
        return _resposta(desbloquearLead(id, dados.idLead));
      default:
        return _resposta({ sucesso: false, mensagem: 'Ação indisponível.' });
    }
  } catch {
    return _resposta({ sucesso: false, mensagem: 'Erro interno no servidor.' });
  }
}
