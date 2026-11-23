function doPost(event) {
  try {
    const raw = event?.postData?.contents;
    if (!raw || raw.length > 3145728) return _resposta({ sucesso: false, mensagem: 'Requisição inválida.' });
    const { acao, dados } = JSON.parse(raw);
    if (acao !== 'uploadFotoObra' && raw.length > 16384) {
      return _resposta({ sucesso: false, mensagem: 'Requisição muito grande.' });
    }
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


// Internal Apps Script helpers. Issue a session only after verifying the
// professional's credentials and current account status on the server.
function emitirSessaoProfissional_(id, secret, now) {
  if (!idProfissionalValido_(id) || !chaveSessaoValida_(secret) || !Number.isSafeInteger(now) || now < 0) {
    throw new Error('Configuração de sessão inválida.');
  }
  const payload = Utilities.base64EncodeWebSafe(JSON.stringify({
    aud: 'obrafacil-profissional',
    sub: id,
    nonce: Utilities.getUuid(),
    exp: now + 30 * 60 * 1000,
  })).replace(/=+$/, '');
  const token = payload + '.' + assinarSessao_(payload, secret);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Sessão temporariamente indisponível.');
  try {
    PropertiesService.getScriptProperties().setProperty('active_session_' + id, fingerprintSessao_(token));
  } finally {
    lock.releaseLock();
  }
  return token;
}

function identificarProfissional_(token, secret, now) {
  if (!chaveSessaoValida_(secret) || !Number.isSafeInteger(now) || now < 0 ||
      typeof token !== 'string' || token.length > 512 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) {
    return null;
  }
  const [payload, received] = token.split('.');
  const expected = assinarSessao_(payload, secret);
  let difference = 0;
  for (let i = 0; i < expected.length; i++) {
    difference |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (difference !== 0) return null;

  try {
    const decoded = Utilities.base64DecodeWebSafe(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='));
    const claims = JSON.parse(Utilities.newBlob(decoded).getDataAsString('UTF-8'));
    if (claims.aud !== 'obrafacil-profissional' || !idProfissionalValido_(claims.sub) ||
        !Number.isSafeInteger(claims.exp) || claims.exp <= now) {
      return null;
    }
    const active = PropertiesService.getScriptProperties().getProperty('active_session_' + claims.sub);
    return active === fingerprintSessao_(token) ? claims.sub : null;
  } catch {
    return null;
  }
}

function idProfissionalValido_(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
}

function chaveSessaoValida_(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
}

function assinarSessao_(payload, secret) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, secret))
    .replace(/=+$/, '');
}

function fingerprintSessao_(token) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
}

function encerrarSessaoProfissional_(id, token) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return false;
  try {
    const key = 'active_session_' + id;
    const settings = PropertiesService.getScriptProperties();
    if (settings.getProperty(key) === fingerprintSessao_(token)) settings.deleteProperty(key);
    return true;
  } finally {
    lock.releaseLock();
  }
}


function salvarFotoPrivada_(profissionalId, dados) {
  const tipos = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const extensao = Object.prototype.hasOwnProperty.call(tipos, dados.tipo) ? tipos[dados.tipo] : null;
  const foto = dados.foto;
  const idLead = dados.idLead;
  if (!extensao || typeof foto !== 'string' || foto.length > 2796204 ||
      typeof idLead !== 'string' || !/^[\w-]{1,100}$/.test(idLead)) {
    return { sucesso: false, mensagem: 'Foto ou obra inválida.' };
  }

  const historico = getHistoricoDesb(profissionalId);
  if (!historico.sucesso || !historico.historico.some(lead => lead.idLead === idLead)) {
    return { sucesso: false, mensagem: 'Obra não disponível para esta conta.' };
  }

  const bytes = Utilities.base64Decode(foto);
  if (!bytes.length || bytes.length > 2 * 1024 * 1024 || !assinaturaFotoValida_(bytes, extensao)) {
    return { sucesso: false, mensagem: 'Conteúdo da foto inválido.' };
  }

  const pastaId = _prop('PRIVATE_PHOTOS_FOLDER_ID');
  if (!pastaId) return { sucesso: false, mensagem: 'Envio de fotos indisponível.' };
  const nome = profissionalId + '_' + idLead + '_' + Utilities.getUuid() + '.' + extensao;
  DriveApp.getFolderById(pastaId).createFile(Utilities.newBlob(bytes, dados.tipo, nome));
  return { sucesso: true };
}

function assinaturaFotoValida_(bytes, extensao) {
  const compara = (offset, prefixo) => bytes.length >= offset + prefixo.length &&
    prefixo.every((byte, i) => (bytes[offset + i] & 255) === byte);
  if (extensao === 'jpg') return compara(0, [255, 216, 255]);
  if (extensao === 'png') return compara(0, [137, 80, 78, 71, 13, 10, 26, 10]);
  return compara(0, [82, 73, 70, 70]) && compara(8, [87, 69, 66, 80]);
}
