function exigirAdministrador_() {
  const email = Session.getActiveUser().getEmail().trim().toLowerCase();
  const permitidos = String(_prop('ADMIN_ALLOWED_EMAILS') || '')
    .split(',').map(valor => valor.trim().toLowerCase()).filter(Boolean);
  if (!email || !permitidos.includes(email)) {
    throw new Error('Acesso administrativo negado.');
  }
}

function doGet() {
  try {
    exigirAdministrador_();
  } catch {
    return HtmlService.createHtmlOutput('Acesso administrativo negado.');
  }

  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('Obra Fácil — Administração')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}
