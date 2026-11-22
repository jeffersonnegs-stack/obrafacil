function registrarRecargaManualCandidata(referencia, creditos) {
  const email = Session.getActiveUser().getEmail().trim().toLowerCase();
  const autorizados = (PropertiesService.getScriptProperties().getProperty('ADMIN_ALLOWED_EMAILS') || '')
    .split(',').map(valor => valor.trim().toLowerCase()).filter(Boolean);
  if (!email || !autorizados.includes(email)) throw new Error('Acesso administrativo negado.');
  if (typeof referencia !== 'string' || !/^TESTE-[A-Za-z0-9_-]{1,60}$/.test(referencia) ||
      !Number.isSafeInteger(creditos) || creditos < 1 || creditos > 20) {
    throw new Error('Informe uma referência fictícia e de 1 a 20 créditos.');
  }

  const id = 'CANDIDATA_HOMOLOGACAO_1';
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Tente novamente.');
  try {
    const planilha = SpreadsheetApp.openById('1WBgKH2wqRq6yO0jSvhS5ebuRtsMr9TPo2Br-st4AJmA');
    const contas = planilha.getSheetByName('Profissionais_Teste');
    const recargas = planilha.getSheetByName('Recargas_Teste');
    if (!contas || !recargas || !contas.getDataRange().getValues().slice(1)
        .some(linha => linha[0] === id && linha[1] === true)) {
      throw new Error('Conta ou aba de teste indisponível.');
    }
    const existentes = recargas.getDataRange().getValues().slice(1)
      .filter(linha => linha[0] === referencia);
    if (existentes.length) {
      if (existentes.some(linha => linha[1] !== id || linha[2] !== creditos || linha[3] !== true)) {
        throw new Error('A referência já está em uso com outros dados.');
      }
      return { sucesso: true, jaRegistrada: true };
    }
    recargas.appendRow([referencia, id, creditos, true]);
    SpreadsheetApp.flush();
    return { sucesso: true, jaRegistrada: false };
  } finally {
    lock.releaseLock();
  }
}
