const { criarHash } = require('./registry');

function criarProvaUniversal(tipo, dados, opcoes = {}) {
    if (!tipo) {
        throw new Error('O tipo da prova é obrigatório.');
    }

    if (!dados || typeof dados !== 'object') {
        throw new Error('Os dados da prova são inválidos.');
    }

    const hash = criarHash(dados);

    return {
        version: 1,
        protocol: 'startup-agro-proof',
        type: tipo,
        hash,
        createdAt: new Date().toISOString(),

        subject: {
            id: opcoes.subjectId || null,
            type: opcoes.subjectType || tipo
        },

        blockchain: {
            network: opcoes.network || null,
            transaction: null,
            status: 'pending'
        }
    };
}

function validarProvaUniversal(prova) {
    if (!prova || typeof prova !== 'object') {
        return false;
    }

    return Boolean(
        prova.version &&
        prova.protocol === 'startup-agro-proof' &&
        prova.type &&
        prova.hash &&
        prova.createdAt &&
        prova.blockchain
    );
}

module.exports = {
    criarProvaUniversal,
    validarProvaUniversal
};
