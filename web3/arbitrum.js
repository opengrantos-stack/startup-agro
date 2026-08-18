class ArbitrumAdapter {
    constructor(config = {}) {
        this.config = config;
        this.name = config.name || 'Arbitrum One';
        this.chainId = config.chainId || '0xa4b1';
    }

    isConfigured() {
        return Boolean(
            this.name &&
            this.chainId
        );
    }

    prepararProva(prova) {
        if (!prova || !prova.hash) {
            throw new Error('Prova Web3 inválida.');
        }

        if (!this.isConfigured()) {
            throw new Error('Arbitrum não configurada.');
        }

        return {
            network: this.name,
            chainId: this.chainId,
            hash: prova.hash,
            status: 'ready'
        };
    }

    async publicar() {
        throw new Error(
            'Publicação em Arbitrum ainda não está ativada.'
        );
    }
}

module.exports = ArbitrumAdapter;
