// Internal Apps Script helpers. Issue a session only after verifying the
// professional's credentials and current account status on the server.
function emitirSessaoProfissional_(id, secret, now) {
  if (!idProfissionalValido_(id) || !chaveSessaoValida_(secret) || !Number.isSafeInteger(now) || now < 0) {
    throw new Error('Configuração de sessão inválida.');
  }
  const payload = Utilities.base64EncodeWebSafe(JSON.stringify({
    aud: 'obrafacil-profissional',
    sub: id,
    exp: now + 30 * 60 * 1000,
  })).replace(/=+$/, '');
  return payload + '.' + assinarSessao_(payload, secret);
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
    return claims.sub;
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
