// ============================================================
// ObraFácil — app.js
// Lógica principal do aplicativo
// Correções aplicadas:
//   ✅ Timers limpos corretamente em todas as situações
//   ✅ Sem duplo clique em botões
//   ✅ Sanitização XSS em todos os renders
//   ✅ Tratamento de erro em todas as chamadas
//   ✅ Loading spinner na inicialização
//   ✅ Sessão com expiração via Auth module
// ============================================================

const App = (() => {

  // ── Estado interno ────────────────────────────────────────
  let _materialSelecionado = '';
  let _enviandoLead = false;
  let _timersDeadline = {};

  // ── Limpar todos os timers ────────────────────────────────
  function _limparTimers() {
    Object.values(_timersDeadline).forEach(t => clearInterval(t));
    _timersDeadline = {};
  }

  // ── Navegação ─────────────────────────────────────────────
  function irParaCliente() {
    UI.mostrarTela('tela-cliente');
    const params = new URLSearchParams(window.location.search);
    document.getElementById('campo-origem').value =
      params.get('utm_source') || params.get('origem') || 'App';
  }

  function irParaProfissional() {
    UI.mostrarTela('tela-prof');
  }

  function voltarSelecao() {
    _limparTimers();
    UI.mostrarTela('tela-selecao');
  }

  // ── Formulário cliente ────────────────────────────────────
 function selecionarMaterial(valor) {
    _materialSelecionado = valor;
    document.getElementById('campo-material').value = valor;
    document.getElementById('btn-sim').className =
      'opcao-btn' + (valor === 'Sim' ? ' selecionado-sim' : '');
    document.getElementById('btn-nao').className =
      'opcao-btn' + (valor === 'Nao' ? ' selecionado-nao' : '');
  }

  async function enviarLead(e) {
    e.preventDefault();
    if (_enviandoLead) return;
    const msgEl = document.getElementById('msg-cliente');
    msgEl.style.display = 'none';

    // Validações
    const nome = document.getElementById('cli-nome').value.trim();
    const tel = document.getElementById('cli-tel').value.trim();

    if (!nome || nome.length < 2) {
      msgEl.className = 'msg-form erro';
      msgEl.textContent = 'Por favor, preencha seu nome.';
      msgEl.style.display = 'block';
      return;
    }
    if (!tel || tel.replace(/\D/g, '').length < 10) {
      msgEl.className = 'msg-form erro';
      msgEl.textContent = 'Por favor, preencha um WhatsApp válido.';
      msgEl.style.display = 'block';
      return;
    }
    if (!_materialSelecionado) {
      msgEl.className = 'msg-form erro';
      msgEl.textContent = 'Por favor, responda se vai comprar o material conosco.';
      msgEl.style.display = 'block';
      return;
    }

    const btn = document.getElementById('btn-enviar-lead');
    _enviandoLead = true;
    let r;
    try {
      UI.btnLoading(btn, true);
      const dados = Object.fromEntries(new FormData(e.target));
      r = await Api.chamar('adicionarLeadPublico', dados);
    } catch {
      r = { sucesso: false, mensagem: 'Erro ao enviar. Tente novamente.' };
    } finally {
      _enviandoLead = false;
      UI.btnLoading(btn, false);
    }
    msgEl.style.display = 'block';

    if (r.sucesso) {
      msgEl.className = 'msg-form ok';
      msgEl.textContent = r.mensagem || 'Solicitação enviada! Em breve um profissional chamará no WhatsApp.';
      e.target.reset();
      _materialSelecionado = '';
      document.getElementById('btn-sim').className = 'opcao-btn';
      document.getElementById('btn-nao').className = 'opcao-btn';
      document.getElementById('campo-material').value = '';
    } else {
      msgEl.className = 'msg-form erro';
      msgEl.textContent = r.mensagem || 'Erro ao enviar. Tente novamente.';
    }
  }

  // ── Abas login/cadastro ───────────────────────────────────
  function mostrarAba(aba) {
    const eLogin = aba === 'login';
    document.getElementById('form-login').style.display    = eLogin ? 'block' : 'none';
    document.getElementById('form-cadastro').style.display = eLogin ? 'none'  : 'block';
    document.getElementById('tab-login-btn').classList.toggle('on', eLogin);
    document.getElementById('tab-cad-btn').classList.toggle('on', !eLogin);
    document.getElementById('card-auth').style.display     = 'block';
    document.getElementById('card-pendente').style.display = 'none';
    document.getElementById('login-erro').style.display    = 'none';
    document.getElementById('cad-erro').style.display      = 'none';
    document.getElementById('cad-ok').style.display        = 'none';
  }

  // ── Login ─────────────────────────────────────────────────
  async function entrar() {
    const tel   = document.getElementById('inp-tel').value.replace(/\D/g, '');
    const senha = document.getElementById('inp-senha').value;
    const erroDiv = document.getElementById('login-erro');
    erroDiv.style.display = 'none';

    if (tel.length < 10 || tel.length > 11) {
      erroDiv.textContent = 'Digite um número de WhatsApp válido.';
      erroDiv.style.display = 'block'; return;
    }
    if (!senha) {
      erroDiv.textContent = 'Digite sua senha.';
      erroDiv.style.display = 'block'; return;
    }

    const btn = document.getElementById('btn-entrar');
    UI.btnLoading(btn, true);

    const r = await Api.chamar('loginProfissional', { telefone: tel, senha });

    UI.btnLoading(btn, false);

    if (!r.sucesso) {
      if (r.naoEncontrado) {
        erroDiv.innerHTML = Api.san(r.mensagem)
          + '<br><br><button onclick="App.mostrarAba(\'cadastro\')" '
          + 'style="background:var(--laranja);color:#fff;border:none;border-radius:8px;'
          + 'padding:8px 16px;cursor:pointer;font-size:13px;font-weight:600;margin-top:4px">'
          + 'Fazer cadastro agora</button>';
      } else {
        erroDiv.textContent = r.mensagem || 'Erro ao entrar. Tente novamente.';
      }
      erroDiv.style.display = 'block'; return;
    }

    Auth.salvar(r.profissional);
    _iniciarPainel(r.profissional);
  }

  // ── Cadastro ──────────────────────────────────────────────
  async function cadastrar() {
    const nome   = document.getElementById('cad-nome').value.trim();
    const tel    = document.getElementById('cad-tel').value.trim();
    const prof   = document.getElementById('cad-prof').value;
    const cidade = document.getElementById('cad-cidade').value.trim();
    const senha  = document.getElementById('cad-senha').value;
    const senha2 = document.getElementById('cad-senha2').value;
    const obs    = document.getElementById('cad-obs').value.trim();
    const erroDiv = document.getElementById('cad-erro');
    erroDiv.style.display = 'none';

    if (!nome || nome.length < 3) {
      erroDiv.textContent = 'Digite seu nome completo (mínimo 3 caracteres).';
      erroDiv.style.display = 'block'; return;
    }
    if (tel.replace(/\D/g, '').length < 10) {
      erroDiv.textContent = 'Digite um WhatsApp válido com DDD.';
      erroDiv.style.display = 'block'; return;
    }
    if (!prof) {
      erroDiv.textContent = 'Selecione sua profissão.';
      erroDiv.style.display = 'block'; return;
    }
    if (!cidade) {
      erroDiv.textContent = 'Digite sua cidade.';
      erroDiv.style.display = 'block'; return;
    }
    if (senha.length < 6) {
      erroDiv.textContent = 'A senha deve ter pelo menos 6 caracteres.';
      erroDiv.style.display = 'block'; return;
    }
    if (senha !== senha2) {
      erroDiv.textContent = 'As senhas não coincidem.';
      erroDiv.style.display = 'block'; return;
    }

    const btn = document.getElementById('btn-cadastrar');
    UI.btnLoading(btn, true);

    const r = await Api.chamar('solicitarCadastro', {
      nome, telefone: tel, profissao: prof, cidade, senha, observacoes: obs
    });

    UI.btnLoading(btn, false);

    if (!r.sucesso) {
      erroDiv.textContent = r.mensagem || 'Erro ao cadastrar. Tente novamente.';
      erroDiv.style.display = 'block'; return;
    }

    document.getElementById('pendente-icon').textContent = '✅';
    document.getElementById('pendente-titulo').textContent = 'Cadastro recebido';
    document.getElementById('pendente-msg').textContent =
      'Sua solicitação foi enviada. Você poderá entrar após a liberação do cadastro.';
    const boxAcesso = document.getElementById('pendente-acesso');
    boxAcesso.replaceChildren();
    boxAcesso.style.display = 'none';

    const msgWpp = 'Olá! Já enviei meu cadastro pelo ObraFácil e gostaria de saber como acompanhar a aprovação.';
    document.getElementById('wpp-pendente').href =
      'https://wa.me/' + ObraFacil.WA_ADMIN + '?text=' + encodeURIComponent(msgWpp);

    document.getElementById('card-auth').style.display    = 'none';
    document.getElementById('card-pendente').style.display = 'block';
  }

  // ── Logout ────────────────────────────────────────────────
  async function sair() {
    const logout = Auth.getProfissional()?.sessao ? Api.chamar('logoutProfissional') : null;
    _limparTimers();
    Auth.limpar();
    for (const id of ['lista-leads', 'lista-historico', 'bv-nome', 'bv-prof', 'hd-creditos']) {
      document.getElementById(id).textContent = '';
    }
    document.getElementById('painel').classList.remove('show');
    document.getElementById('inp-tel').value   = '';
    document.getElementById('inp-senha').value = '';
    mostrarAba('login');
    UI.mostrarTela('tela-selecao');
    if (logout && !(await logout).sucesso && !Auth.getProfissional()) {
      UI.toast('Painel fechado. A confirmação da saída no servidor falhou.', 'erro');
    }
  }

  // ── Iniciar painel ────────────────────────────────────────
  function _iniciarPainel(prof) {
    document.getElementById('tela-selecao').style.display = 'none';
    document.getElementById('tela-prof').style.display    = 'none';
    document.getElementById('painel').classList.add('show');
    document.getElementById('bv-nome').textContent =
      'Olá, ' + Api.san(prof.nome.split(' ')[0]) + '!';
    _atualizarSaldoUI(prof.creditos, prof);
    irTab(prof.creditos <= 0 ? 2 : 0);
    carregarLeads();
  }

  function _atualizarSaldoUI(creditos, prof) {
    prof = prof || Auth.getProfissional();
    document.getElementById('hd-creditos').textContent = creditos;
    const pill = document.getElementById('saldo-pill');
    const aviso = document.getElementById('aviso-sem-credito');
    const lista = document.getElementById('lista-leads');

    if (creditos <= 0) {
      pill.classList.add('saldo-zero');
      if (aviso) aviso.style.display = 'block';
      if (lista) lista.style.display = 'none';
    } else {
      pill.classList.remove('saldo-zero');
      if (aviso) aviso.style.display = 'none';
      if (lista) lista.style.display = 'block';
    }

    if (prof) {
      document.getElementById('bv-prof').textContent =
        Api.san(prof.profissao) + ' — ' + creditos + ' créditos disponíveis';
    }
  }

  // ── Tabs do painel ────────────────────────────────────────
  function irTab(n) {
    ['tab-leads', 'tab-comprar', 'tab-historico'].forEach((id, i) => {
      document.getElementById(id).style.display = i === n ? 'block' : 'none';
    });
    document.querySelectorAll('.tab-btn').forEach((b, i) => {
      b.classList.toggle('on', i === n);
    });
    if (n === 2) carregarHistorico();
  }

  // ── Leads ─────────────────────────────────────────────────
  async function carregarLeads() {
    const prof = Auth.getProfissional();
    if (!prof || prof.creditos <= 0) return;
    const lista = document.getElementById('lista-leads');
    lista.innerHTML = '<div class="vazio"><div class="vazio-titulo">Buscando leads...</div></div>';
    const r = await Api.chamar('getLeadsDisponiveis', { idProfissional: prof.id });
    if (Auth.getProfissional() !== prof) return;
    if (!r.sucesso) {
      lista.innerHTML = '<div class="vazio">'
        + '<div class="vazio-titulo">Erro ao buscar leads</div>'
        + '<div class="vazio-desc">' + Api.san(r.mensagem) + '</div>'
        + '<br><button class="btn-primario" style="max-width:200px;margin:0 auto" '
        + 'onclick="App.carregarLeads()">Tentar novamente</button></div>';
      return;
    }
    if (!r.leads || !r.leads.length) {
      lista.innerHTML = '<div class="vazio">'
        + '<div class="vazio-icon">🔭</div>'
        + '<div class="vazio-titulo">Nenhum lead disponível agora</div>'
        + '<div class="vazio-desc">Novos leads aparecem aqui assim que entram no sistema.</div></div>';
      return;
    }
    const htmlGerado = r.leads.map(_renderLead).join('');
    lista.innerHTML = htmlGerado;
    lista.querySelectorAll('button[data-lead-id]').forEach(botao => {
      botao.addEventListener('click', () => desbloquear(botao.dataset.leadId, botao));
    });
    r.leads.forEach(lead => {
      if (lead.deadline && !lead.jaDesbloqueado) {
        _iniciarTimerDeadline(lead.id, lead.deadline);
      }
    });
  }

  function _renderLead(lead) {
    const qtd = lead.qtdJaViram || 0;

    if (lead.jaDesbloqueado && lead.contato) {
      const c = lead.contato;
      const telLimpo = Api.san(c.Telefone || '').replace(/\D/g, '');
      const wppMsg = 'Olá ' + (c.Nome||'') + '! Vi sua solicitação de '
        + (lead.tipoObra||'') + ' pelo ObraFácil. Posso te ajudar!';
      return `
        <div class="lead-card desbloqueado" id="card-${Api.san(lead.id)}">
          <div class="lead-topo">
            <div class="lead-tipo">${Api.san(lead.tipoObra)}</div>
            <div class="lead-badges"><span class="badge badge-desb">✅ Desbloqueado</span></div>
          </div>
          <div class="lead-info">
            <span>📍 ${Api.san(lead.cidade)}</span>
            <span>📅 ${Api.san(lead.data)}</span>
          </div>
          ${lead.observacaoResumida ? `<div class="lead-obs">${Api.san(lead.observacaoResumida)}</div>` : ''}
          <div class="lead-contato">
            <div class="contato-item">
              <span class="contato-label">Nome</span>
              <span class="contato-val">${Api.san(c.Nome || 'N/A')}</span>
            </div>
            <div class="contato-item">
              <span class="contato-label">Telefone</span>
              <span class="contato-val">
                <a href="tel:${Api.san(c.Telefone || '')}">${Api.san(c.Telefone || 'N/A')}</a>
              </span>
            </div>
          </div>
          <div class="lead-footer">
            <span class="lead-data">Contato já desbloqueado</span>
            <a class="btn-whatsapp"
               href="https://wa.me/55${telLimpo}?text=${encodeURIComponent(wppMsg)}"
               target="_blank" rel="noopener">Abrir WhatsApp</a>
          </div>
        </div>`;
    }

    if (lead.jaDesbloqueado) {
      return `
        <div class="lead-card desbloqueado" id="card-${Api.san(lead.id)}">
          <div class="lead-topo">
            <div class="lead-tipo">${Api.san(lead.tipoObra)}</div>
            <div class="lead-badges"><span class="badge badge-desb">✅ Desbloqueado</span></div>
          </div>
          <div class="lead-footer">
            <span class="lead-data">Ver contato no Histórico</span>
            <button class="btn-desbloquear" style="background:var(--verde)"
              onclick="App.irTab(2)">Ver no Histórico</button>
          </div>
        </div>`;
    }

    let badgeEscassez = '';
    if (qtd === 0)      badgeEscassez = '<span class="badge" style="background:#e0f2fe;color:#0369a1">3 vagas</span>';
    else if (qtd === 1) badgeEscassez = '<span class="badge badge-urgente">⚡ 2 vagas restantes</span>';
    else if (qtd === 2) badgeEscassez = '<span class="badge badge-quente">🔥 ÚLTIMA VAGA!</span>';

    const timerHtml = lead.deadline
      ? `<span class="deadline-timer" id="timer-${Api.san(lead.id)}">Calculando...</span>` : '';

    let concorrencia = '';
    if (qtd === 1) concorrencia = '<br><span class="concorrencia">1 profissional já desbloqueou</span>';
    else if (qtd === 2) concorrencia = '<br><span class="concorrencia" style="color:var(--vermelho);font-weight:700">2 já desbloquearam — última vaga!</span>';

    return `
      <div class="lead-card" id="card-${Api.san(lead.id)}">
        <div class="lead-topo">
          <div class="lead-tipo">${Api.san(lead.tipoObra)}</div>
          <div class="lead-badges">
            <span class="badge badge-novo">Novo</span>
            ${badgeEscassez}
          </div>
        </div>
        <div class="lead-info">
          <span>📍 ${Api.san(lead.cidade)}</span>
          <span>📅 ${Api.san(lead.data)}</span>
        </div>
        ${lead.observacaoResumida ? `<div class="lead-obs">${Api.san(lead.observacaoResumida)}</div>` : ''}
        <div class="lead-footer">
          <div>${timerHtml}${concorrencia}</div>
          <button class="btn-desbloquear"
            data-lead-id="${Api.san(lead.id)}">
            Desbloquear (1 crédito)
          </button>
        </div>
      </div>`;
  }

  // ── Timer de deadline ─────────────────────────────────────
  function _iniciarTimerDeadline(idLead, deadlineStr) {
    if (_timersDeadline[idLead]) clearInterval(_timersDeadline[idLead]);
    const deadline = new Date(deadlineStr).getTime();

    function atualizar() {
      const restante = deadline - Date.now();
      const el = document.getElementById('timer-' + idLead);
      if (!el) { clearInterval(_timersDeadline[idLead]); return; }
      if (restante <= 0) {
        clearInterval(_timersDeadline[idLead]);
        delete _timersDeadline[idLead];
        const card = document.getElementById('card-' + idLead);
        if (card) card.style.display = 'none';
        return;
      }
      const m = Math.floor(restante / 60000);
      const s = Math.floor((restante % 60000) / 1000);
      el.textContent = m + 'm ' + String(s).padStart(2, '0') + 's';
      if (restante < 120000) el.classList.add('urgente');
    }

    atualizar();
    _timersDeadline[idLead] = setInterval(atualizar, 1000);
  }

  // ── Desbloquear lead ──────────────────────────────────────
  async function desbloquear(idLead, btn) {
    const prof = Auth.getProfissional();
    if (!prof || prof.creditos <= 0) {
      UI.abrirModal('modal-sem-cred'); return;
    }

    UI.btnLoading(btn, true);

    const r = await Api.chamar('desbloquearLead', {
      idProfissional: prof.id,
      idLead
    });

    UI.btnLoading(btn, false);
    if (Auth.getProfissional() !== prof) return;

    if (!r.sucesso) {
      if (r.semCredito) { UI.abrirModal('modal-sem-cred'); return; }
      if (r.esgotado) {
        const card = document.getElementById('card-' + idLead);
        if (card) {
          card.innerHTML = '<div style="padding:12px;text-align:center;color:var(--vermelho);font-size:13px;font-weight:600">'
            + '🔴 Este lead foi esgotado. Verifique outros leads.</div>';
          setTimeout(() => { if (card) card.style.display = 'none'; }, 3000);
        }
        UI.toast('Lead esgotado! Outro profissional chegou primeiro.', 'info');
        return;
      }
      UI.toast(r.mensagem || 'Erro ao desbloquear.', 'erro');
      return;
    }

    UI.toast(r.mensagem || 'Lead desbloqueado!', 'sucesso');
    Auth.atualizarCreditos(r.creditos);
    _atualizarSaldoUI(r.creditos);
    _preencherContato(idLead, {
      Nome: r.contato.nome,
      Telefone: r.contato.telefone,
      Tipo_Obra: r.contato.tipoObra,
      Cidade: r.contato.cidade,
      Data_Entrada: r.contato.data,
    });

    if (_timersDeadline[idLead]) {
      clearInterval(_timersDeadline[idLead]);
      delete _timersDeadline[idLead];
    }
    if (r.creditos === 0) irTab(2);
  }

  function _preencherContato(idLead, lead) {
    const card = document.getElementById('card-' + idLead);
    if (!card || !lead) return;
    const telLimpo = Api.san(lead.Telefone || '').replace(/\D/g, '');
    const wppMsg = 'Olá ' + (lead.Nome||'') + '! Vi sua solicitação de '
      + (lead.Tipo_Obra||'') + ' pelo ObraFácil. Posso te ajudar!';
    card.classList.add('desbloqueado');
    card.innerHTML = `
      <div class="lead-topo">
        <div class="lead-tipo">${Api.san(lead.Tipo_Obra)}</div>
        <div class="lead-badges"><span class="badge badge-desb">Desbloqueado</span></div>
      </div>
      <div class="lead-info">
        <span>📍 ${Api.san(lead.Cidade || '')}</span>
        <span>📅 ${Api.san(lead.Data_Entrada || '')}</span>
      </div>
      ${lead.Observacoes ? `<div class="lead-obs">${Api.san(lead.Observacoes)}</div>` : ''}
      <div class="lead-contato">
        <div class="contato-item">
          <span class="contato-label">Nome</span>
          <span class="contato-val">${Api.san(lead.Nome || 'N/A')}</span>
        </div>
        <div class="contato-item">
          <span class="contato-label">Telefone</span>
          <span class="contato-val">
            <a href="tel:${Api.san(lead.Telefone || '')}">${Api.san(lead.Telefone || 'N/A')}</a>
          </span>
        </div>
      </div>
      <div class="lead-footer">
        <span class="lead-data">Contato desbloqueado</span>
        <a class="btn-whatsapp"
           href="https://wa.me/55${telLimpo}?text=${encodeURIComponent(wppMsg)}"
           target="_blank" rel="noopener">Abrir WhatsApp</a>
      </div>`;
  }

  // ── Pacotes ───────────────────────────────────────────────
  function selecionarPacote(creditos, valor, el) {
    document.querySelectorAll('.pacote').forEach(p => p.style.borderColor = '');
    el.style.borderColor = 'var(--laranja)';
    const preco = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
    document.getElementById('pix-detalhe').textContent = creditos + ' créditos · ' + preco + ' (simulação)';
    const box = document.getElementById('pix-box');
    box.style.display = 'block';
    box.scrollIntoView({ behavior: 'smooth' });
  }

  // ── Histórico ─────────────────────────────────────────────
  async function carregarHistorico() {
    const prof = Auth.getProfissional();
    if (!prof) return;
    const lista = document.getElementById('lista-historico');
    lista.innerHTML = '<div class="vazio"><div class="vazio-titulo">Buscando...</div></div>';

    const r = await Api.chamar('getHistoricoDesb', { idProfissional: prof.id });
    if (Auth.getProfissional() !== prof) return;

    if (!r.sucesso || !Array.isArray(r.historico)) {
      lista.innerHTML = '<div class="vazio">'
        + '<div class="vazio-titulo">Não foi possível carregar o Histórico</div>'
        + '<button type="button" class="btn-secundario">Tentar novamente</button></div>';
      lista.querySelector('button').addEventListener('click', carregarHistorico);
      return;
    }

    if (!r.historico.length) {
      lista.innerHTML = '<div class="vazio">'
        + '<div class="vazio-titulo">Nenhum lead desbloqueado ainda</div>'
        + '<div class="vazio-desc">Quando você desbloquear um lead, ele aparecerá aqui.</div></div>';
      return;
    }

   lista.innerHTML = r.historico.map(h => `
      <div class="hist-item">
        <div class="hist-info">
          <strong>${Api.san(h.tipoObra)} — ${Api.san(h.cidade)}</strong>
          <span>${Api.san(h.nome)} | ${Api.san(h.telefone)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="hist-data">${Api.san(h.data)}</div>
        </div>
      </div>`).join('');

    lista.querySelectorAll('.hist-item').forEach((item, index) => {
      const idLead = r.historico[index].idLead;
      if (!idLead) return;
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.textContent = 'Enviar foto';
      botao.addEventListener('click', () => abrirEnvioFoto(idLead));
      item.append(botao);
    });
  }

  // ── Inicialização ─────────────────────────────────────────
  async function init() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw-offline.js').catch(() => {
        // A aplicação continua disponível pela rede sem o service worker.
      });
    }

    UI.initOfflineBanner();

    document.getElementById('form-lead')
      .addEventListener('submit', enviarLead);

    const sessao = Auth.carregar();

    if (sessao && sessao.id) {
      const r = await Api.chamar('getSaldoCreditos', { idProfissional: sessao.id });
      if (r.sucesso) {
        sessao.creditos = r.creditos;
        Auth.salvar(sessao);
      }
      _esconderLoading();
      _iniciarPainel(sessao);
    } else {
      _esconderLoading();
      UI.mostrarTela('tela-selecao');
    }
  }

  function _esconderLoading() {
    const loading = document.getElementById('loading-inicial');
    if (!loading) return;
    loading.classList.add('saindo');
    setTimeout(() => loading.style.display = 'none', 400);
  }
  
  async function prepararFoto(file) {
    const limiteEnvio = 2 * 1024 * 1024;
    if (file.size <= limiteEnvio) return file;

    const url = URL.createObjectURL(file);
    const imagem = new Image();
    const canvas = document.createElement('canvas');
    try {
      imagem.src = url;
      await imagem.decode();
      const escala = Math.min(1, 1600 / Math.max(imagem.width, imagem.height));
      canvas.width = Math.max(1, Math.round(imagem.width * escala));
      canvas.height = Math.max(1, Math.round(imagem.height * escala));
      const contexto = canvas.getContext('2d');
      contexto.fillStyle = '#fff';
      contexto.fillRect(0, 0, canvas.width, canvas.height);
      contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);

      for (const qualidade of [0.82, 0.65, 0.45]) {
        const foto = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', qualidade));
        if (foto?.size && foto.size <= limiteEnvio) return foto;
      }
      throw new Error('Foto excede o limite de envio');
    } finally {
      canvas.width = 0;
      canvas.height = 0;
      URL.revokeObjectURL(url);
    }
  }

  function abrirEnvioFoto(idLead) {
    const profissional = Auth.getProfissional();
    if (!profissional?.sessao) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file || Auth.getProfissional() !== profissional) return;
      if (file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        UI.toast('Use uma foto JPEG, PNG ou WebP de até 5 MB.', 'erro');
        return;
      }

      let imagem;
      try {
        imagem = await prepararFoto(file);
      } catch {
        UI.toast('Não foi possível preparar a foto. Tente uma imagem menor.', 'erro');
        return;
      }
      if (Auth.getProfissional() !== profissional) return;

      const reader = new FileReader();
      reader.onerror = () => UI.toast('Não foi possível ler a foto.', 'erro');
      reader.onload = async () => {
        if (Auth.getProfissional() !== profissional) return;
        const foto = String(reader.result).split(',')[1];
        const result = await Api.chamar('uploadFotoObra', { idLead, foto, tipo: imagem.type });
        if (Auth.getProfissional() !== profissional) return;
        UI.toast(result.sucesso ? 'Foto enviada com sucesso!' : 'Não foi possível enviar a foto.', result.sucesso ? 'sucesso' : 'erro');
      };
      reader.readAsDataURL(imagem);
    };
    input.click();
  }

  return {
    irParaCliente, irParaProfissional, voltarSelecao,
    selecionarMaterial, mostrarAba,
    entrar, cadastrar, sair,
    irTab, carregarLeads, desbloquear,
    selecionarPacote, carregarHistorico,
    abrirEnvioFoto,
    init
  };

})();

document.addEventListener('DOMContentLoaded', App.init);
