function doPost(e) {
  try {
    const settings = PropertiesService.getScriptProperties();
    const secret = settings.getProperty('APPS_SCRIPT_TOKEN');
    const spreadsheetId = settings.getProperty('TEST_SPREADSHEET_ID');
    if (!secret || !spreadsheetId || settings.getProperty('APP_ENV') !== 'test') {
      return response_({ sucesso: false });
    }

    const raw = e?.postData?.contents;
    if (!raw || raw.length > 16384) return response_({ sucesso: false });
    const payload = JSON.parse(raw);
    const data = payload?.dados;
    if (data?._token !== secret) {
      return response_({ sucesso: false });
    }

    if (payload.acao === 'loginProfissional') {
      return response_(loginProfissionalTeste_(spreadsheetId, settings, data));
    }
    if (payload.acao === 'getSaldoCreditos' || payload.acao === 'getHistoricoDesb' || payload.acao === 'getLeadsDisponiveis' || payload.acao === 'desbloquearLead') {
      const professionalId = identificarProfissional_(
        data.sessao, settings.getProperty('PROFESSIONAL_SESSION_SECRET'), Date.now()
      );
      if (!professionalId || (data.idProfissional != null && data.idProfissional !== professionalId)) {
        return response_({ sucesso: false, mensagem: 'Sessão inválida.' });
      }
      return response_(consultarProfissionalTeste_(spreadsheetId, professionalId, payload.acao, data.idLead));
    }
    if (payload.acao !== 'adicionarLeadPublico') return response_({ sucesso: false });

    const name = textField_(data.nome, 120);
    const phone = textField_(data.telefone, 24).replace(/\D/g, '');
    const city = textField_(data.cidade, 120);
    const category = textField_(data.tipoObra, 120);
    const notes = textField_(data.observacoes, 2000);
    const materials = textField_(data.compromisoMaterial, 3);
    if (name.length < 2 || !/^\d{10,11}$/.test(phone) || !category ||
        !['Sim', 'Nao'].includes(materials)) {
      return response_({ sucesso: false });
    }

    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Pedidos_Teste');
    if (!sheet) return response_({ sucesso: false });
    sheet.appendRow([
      new Date(), Utilities.getUuid(), literal_(name), "'" + phone,
      literal_(city), literal_(category), literal_(notes), materials,
    ]);
    return response_({ sucesso: true });
  } catch {
    return response_({ sucesso: false });
  }
}

function textField_(value, limit) {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > limit) throw new Error('Campo inválido.');
  return value.trim();
}

function literal_(value) {
  return value ? "'" + value : '';
}

function response_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function consultarProfissionalTeste_(spreadsheetId, professionalId, action, leadId) {
  const book = SpreadsheetApp.openById(spreadsheetId);
  if (action === 'desbloquearLead') return desbloquearLeadTeste_(book, professionalId, leadId);

  const state = estadoProfissionalTeste_(book, professionalId);
  if (!state) return { sucesso: false, mensagem: 'Conta indisponível.' };
  if (action === 'getSaldoCreditos') return { sucesso: true, creditos: state.credits };
  if (action === 'getLeadsDisponiveis') {
    const orders = book.getSheetByName('Pedidos_Teste');
    if (!orders) return { sucesso: false };
    const unlockedIds = new Set(state.rows.map(row => row[1]));
    const leads = orders.getDataRange().getValues().slice(1).filter(row =>
      typeof row[1] === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(row[1]) && !unlockedIds.has(row[1])
    ).map(row => ({ id: row[1], cidade: String(row[4] || ''), tipoObra: String(row[5] || '') }));
    return { sucesso: true, leads };
  }
  return { sucesso: true, historico: state.rows.map(contatoTeste_) };
}

function estadoProfissionalTeste_(book, id) {
  const accounts = book.getSheetByName('Profissionais_Teste');
  const contacts = book.getSheetByName('Contatos_Teste');
  if (!accounts || !contacts) return null;
  const account = accounts.getDataRange().getValues().slice(1)
    .find(row => row[0] === id && row[1] === true);
  if (!account || !Number.isSafeInteger(account[2]) || account[2] < 0) return null;
  const rows = contacts.getDataRange().getValues().slice(1).filter(row => row[0] === id);
  const credited = creditosRecargaTeste_(book, id);
  if (credited === null) return null;
  const credits = account[2] + credited - rows.filter(row => row[7] === 1).length;
  if (!Number.isSafeInteger(credits) || credits < 0) return null;
  return { contacts, rows, credits };
}

function contatoTeste_(row) {
  return {
    idLead: String(row[1]), nome: String(row[2]), telefone: String(row[3]),
    tipoObra: String(row[4] || ''), cidade: String(row[5] || ''), data: String(row[6] || ''),
  };
}

function desbloquearLeadTeste_(book, professionalId, leadId) {
  if (typeof leadId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(leadId)) return { sucesso: false };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { sucesso: false, mensagem: 'Tente novamente.' };
  try {
    const state = estadoProfissionalTeste_(book, professionalId);
    if (!state) return { sucesso: false, mensagem: 'Conta indisponível.' };
    const prior = state.rows.find(row => row[1] === leadId);
    if (prior) return { sucesso: true, creditos: state.credits, contato: contatoTeste_(prior) };
    if (state.credits < 1) return { sucesso: false, semCredito: true, mensagem: 'Saldo insuficiente.' };

    const pedidos = book.getSheetByName('Pedidos_Teste');
    const pedido = pedidos?.getDataRange().getValues().slice(1).find(row => row[1] === leadId);
    if (!pedido) return { sucesso: false, mensagem: 'Pedido indisponível.' };
    const contactRow = [
      professionalId, leadId, pedido[2], String(pedido[3]), pedido[5], pedido[4], new Date(), 1,
    ];
    // A single row records both access and its debit. Retrying finds that row.
    state.contacts.appendRow(contactRow.map(value => typeof value === 'string' ? literal_(value) : value));
    SpreadsheetApp.flush();
    return { sucesso: true, creditos: state.credits - 1, contato: contatoTeste_(contactRow) };
  } finally {
    lock.releaseLock();
  }
}

function loginProfissionalTeste_(spreadsheetId, settings, data) {
  const rejected = { sucesso: false, mensagem: 'Credenciais de teste inválidas.' };
  const sessionSecret = settings.getProperty('PROFESSIONAL_SESSION_SECRET');
  if (!chaveSessaoValida_(sessionSecret) || typeof data.telefone !== 'string' ||
      !/^\d{10,11}$/.test(data.telefone) || typeof data.senha !== 'string' ||
      !/^[a-f0-9]{64}$/.test(data.senha)) return rejected;

  const accounts = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Profissionais_Teste');
  if (!accounts) return rejected;
  const row = accounts.getDataRange().getValues().slice(1)
    .find(entry => String(entry[3]) === data.telefone && entry[1] === true);
  if (!row || !idProfissionalValido_(row[0]) ||
      !Number.isSafeInteger(row[2]) || row[2] < 0) return rejected;

  // Column E stores an HMAC of a random 256-bit test code. No human passwords.
  const expected = assinarSessao_('test-login:' + row[0] + ':' + data.senha, sessionSecret);
  const stored = String(row[4] || '');
  if (stored.length !== expected.length) return rejected;
  let difference = 0;
  for (let i = 0; i < expected.length; i++) {
    difference |= stored.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (difference !== 0) return rejected;

  const state = estadoProfissionalTeste_(SpreadsheetApp.openById(spreadsheetId), row[0]);
  if (!state) return rejected;
  return {
    sucesso: true,
    profissional: {
      id: row[0],
      nome: String(row[5] || 'Profissional de teste'),
      profissao: String(row[6] || 'Teste'),
      creditos: state.credits,
      sessao: emitirSessaoProfissional_(row[0], sessionSecret, Date.now()),
    },
  };
}

function creditosRecargaTeste_(book, id) {
  const sheet = book.getSheetByName('Recargas_Teste');
  if (!sheet) return 0;
  const payments = new Map();
  for (const row of sheet.getDataRange().getValues().slice(1)) {
    const [paymentId, professionalId, credits, approved] = row;
    if (approved !== true) continue;
    if (typeof paymentId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(paymentId) ||
        !idProfissionalValido_(professionalId) || !Number.isSafeInteger(credits) || credits < 1) {
      return null;
    }
    const existing = payments.get(paymentId);
    if (existing && (existing.professionalId !== professionalId || existing.credits !== credits)) {
      return null;
    }
    payments.set(paymentId, { professionalId, credits });
  }
  let total = 0;
  for (const payment of payments.values()) {
    if (payment.professionalId === id) total += payment.credits;
  }
  return Number.isSafeInteger(total) ? total : null;
}
