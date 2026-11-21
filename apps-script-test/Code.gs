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
    if (payload?.acao !== 'adicionarLeadPublico' || data?._token !== secret) {
      return response_({ sucesso: false });
    }

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
