function doGet() {
  const email = Session.getActiveUser().getEmail().trim().toLowerCase();
  const permitidos = (PropertiesService.getScriptProperties().getProperty('ADMIN_ALLOWED_EMAILS') || '')
    .split(',').map(valor => valor.trim().toLowerCase()).filter(Boolean);
  if (!email || !permitidos.includes(email)) {
    return HtmlService.createHtmlOutput('Acesso administrativo negado.');
  }
  return HtmlService.createHtmlOutputFromFile('PainelRecargasCandidato')
    .setTitle('Obra Fácil — Recargas de teste');
}
