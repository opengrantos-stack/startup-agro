const crypto = require('crypto');

function ordenarDados(valor) {
    if (Array.isArray(valor)) {
        return valor.map(ordenarDados);
    }

    if (valor && typeof valor === 'object') {
        return Object.keys(valor)
            .sort()
            .reduce((resultado, chave) => {
                resultado[chave] = ordenarDados(valor[chave]);
                return resultado;
            }, {});
    }

    return valor;
}

function criarHash(dados) {
    const dadosOrdenados = ordenarDados(dados);
    const conteudo = JSON.stringify(dadosOrdenados);

    return crypto
        .createHash('sha256')
        .update(conteudo)
        .digest('hex');
}

function criarRegistro(tipo, dados) {
    if (!tipo) {
        throw new Error('O tipo do registo é obrigatório.');
    }

    if (!dados || typeof dados !== 'object') {
        throw new Error('Os dados do registo são inválidos.');
    }

    return {
        version: 1,
        type: tipo,
        hash: criarHash(dados),
        createdAt: new Date().toISOString(),
        status: 'pending',
        blockchain: null,
        transaction: null
    };
}

module.exports = {
    criarHash,
    criarRegistro
};
