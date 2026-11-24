function conferirConfiguracaoProducao() {
  exigirAdministrador_();
  const propriedades = PropertiesService.getScriptProperties();
  const worker = propriedades.getProperty('APPS_SCRIPT_TOKEN');
  const sessao = propriedades.getProperty('PROFESSIONAL_SESSION_SECRET');
  const formato = /^[a-fA-F0-9]{64}$/;
  const pasta = propriedades.getProperty('PRIVATE_PHOTOS_FOLDER_ID') || '';
  const resultado = {
    tokenWorkerConfigurado: formato.test(worker || ''),
    chaveSessaoConfigurada: formato.test(sessao || ''),
    chavesIndependentes: Boolean(worker && sessao && worker !== sessao),
    pastaFotosConfigurada: /^[A-Za-z0-9_-]{15,}$/.test(pasta),
  };
  return { sucesso: Object.values(resultado).every(Boolean), ...resultado };
}
