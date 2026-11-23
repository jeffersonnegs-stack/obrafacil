function conferirEstruturaProducao_(planilha) {
  const requisitos = {
    Leads: ['ID_Lead', 'Nome', 'Telefone', 'Cidade', 'Tipo_Obra'],
    Lead_Desbloqueado: ['ID_Lead', 'ID_Profissional', 'Creditos_Usados'],
    Profissional: ['ID_Profissional', 'Telefone', 'Ativo', 'Creditos', 'Status_Cadastro'],
    Transacao_Credito: ['ID_Transacao', 'ID_Profissional', 'Tipo', 'Quantidade', 'Valor_Pago'],
  };
  const faltas = [];
  for (const [nome, colunas] of Object.entries(requisitos)) {
    const aba = planilha.getSheetByName(nome);
    const largura = aba?.getLastColumn() || 0;
    const cabecalhos = largura ? aba.getRange(1, 1, 1, largura).getDisplayValues()[0].map(valor => valor.trim()) : [];
    for (const coluna of colunas) {
      if (cabecalhos.filter(valor => valor === coluna).length !== 1) faltas.push(nome + '.' + coluna);
    }
    if (nome === 'Profissional' && !cabecalhos.some(valor => valor === 'Senha_Hash' || valor === 'Senha')) {
      faltas.push('Profissional.Senha_Hash ou Senha');
    }
  }
  return { sucesso: faltas.length === 0, faltas };
}
