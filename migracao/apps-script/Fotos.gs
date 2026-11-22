function salvarFotoPrivada_(profissionalId, dados) {
  const tipos = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const extensao = Object.hasOwn(tipos, dados.tipo) ? tipos[dados.tipo] : null;
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
