const { criarHash } = require('./registry');

/**
 * Verifica se os dados correspondem ao hash registrado.
 */
function verificarHash(dados, hashEsperado) {
    if (!hashEsperado) {
        throw new Error('O hash esperado é obrigatório.');
    }

    const hashAtual = criarHash(dados);

    return {
        valido: hashAtual === hashEsperado,
        hashAtual,
        hashEsperado
    };
}

/**
 * Verifica um registro Web3 completo.
 */
function verificarRegistro(dados, registro) {
    if (!registro || !registro.hash) {
        throw new Error('Registro Web3 inválido.');
    }

    const resultado = verificarHash(dados, registro.hash);

    return {
        ...resultado,
        type: registro.type,
        version: registro.version,
        blockchain: registro.blockchain,
        transaction: registro.transaction
    };
}

module.exports = {
    verificarHash,
    verificarRegistro
};
