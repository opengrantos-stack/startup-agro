const { criarRegistro } = require('./registry');

class ProofAdapter {
    constructor(blockchainAdapter, blockchainName) {
        this.adapter = blockchainAdapter;
        this.blockchain = blockchainName;
    }

    criarProva(tipo, dados) {
        const registro = criarRegistro(tipo, dados);

        return {
            ...registro,
            blockchain: this.blockchain,
            status: 'ready'
        };
    }

    prepararTransacao(registro) {
        if (!registro || !registro.hash) {
            throw new Error('Registro Web3 inválido.');
        }

        if (!this.blockchain) {
            throw new Error('Blockchain não definida.');
        }

        return {
            blockchain: this.blockchain,
            payload: {
                hash: registro.hash
            },
            status: 'prepared'
        };
    }

    async publicar(registro) {
        throw new Error(
            'Publicação blockchain ainda não está ativada.'
        );
    }
}

module.exports = ProofAdapter;
