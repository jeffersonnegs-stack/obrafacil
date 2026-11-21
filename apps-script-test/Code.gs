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

    if (payload.acao === 'getSaldoCreditos' || payload.acao === 'getHistoricoDesb') {
      const professionalId = identificarProfissional_(
        data.sessao, settings.getProperty('PROFESSIONAL_SESSION_SECRET'), Date.now()
      );
      if (!professionalId || (data.idProfissional != null && data.idProfissional !== professionalId)) {
        return response_({ sucesso: false, mensagem: 'Sessão inválida.' });
      }
      return response_(consultarProfissionalTeste_(spreadsheetId, professionalId, payload.acao));
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

function consultarProfissionalTeste_(spreadsheetId, professionalId, action) {
  const book = SpreadsheetApp.openById(spreadsheetId);
  const accounts = book.getSheetByName('Profissionais_Teste');
  if (!accounts) return { sucesso: false };
  const account = accounts.getDataRange().getValues().slice(1)
    .find(row => row[0] === professionalId && row[1] === true);
  if (!account) return { sucesso: false, mensagem: 'Conta indisponível.' };

  if (action === 'getSaldoCreditos') {
    const credits = account[2];
    return Number.isSafeInteger(credits) && credits >= 0
      ? { sucesso: true, creditos: credits }
      : { sucesso: false };
  }

  const unlocked = book.getSheetByName('Contatos_Teste');
  if (!unlocked) return { sucesso: false };
  const historico = unlocked.getDataRange().getValues().slice(1)
    .filter(row => row[0] === professionalId)
    .map(row => ({ idLead: String(row[1]), nomeCliente: String(row[2]), telefone: String(row[3]) }));
  return { sucesso: true, historico };
}
