const crypto = require('crypto');

/**
 * Cria uma impressão digital dos dados de um registo.
 * Os dados originais NÃO são enviados para a blockchain.
 */
function criarHash(dados) {
    const conteudo = JSON.stringify(dados);

    return crypto
        .createHash('sha256')
        .update(conteudo)
        .digest('hex');
}

/**
 * Cria um registo Web3 universal.
 * Não depende de Ethereum, Arbitrum ou Solana.
 */
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
