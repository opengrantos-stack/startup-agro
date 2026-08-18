class EVMAdapter {
    constructor(networkConfig = {}) {
        this.config = networkConfig;
        this.address = null;
        this.chainId = null;
    }

    isAvailable() {
        return typeof window !== 'undefined' &&
               typeof window.ethereum !== 'undefined';
    }

    isConfigured() {
        return Boolean(
            this.config.name &&
            this.config.chainId
        );
    }

    isEnabled() {
        return this.config.enabled === true;
    }

    async getChainId() {
        if (!this.isAvailable()) {
            throw new Error('Carteira EVM não encontrada.');
        }

        return await window.ethereum.request({
            method: 'eth_chainId'
        });
    }

    async connect() {
        if (!this.isConfigured()) {
            throw new Error('Rede EVM não configurada.');
        }

        if (!this.isEnabled()) {
            throw new Error(`A rede ${this.config.name} está desativada.`);
        }

        if (!this.isAvailable()) {
            throw new Error('Carteira EVM não encontrada.');
        }

        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });

        if (!accounts || accounts.length === 0) {
            throw new Error('Nenhuma carteira selecionada.');
        }

        const chainId = await this.getChainId();

        if (chainId.toLowerCase() !== this.config.chainId.toLowerCase()) {
            throw new Error(
                `Rede incorreta. Esperado ${this.config.name} (${this.config.chainId}), ` +
                `mas a carteira está em ${chainId}.`
            );
        }

        this.address = accounts[0];
        this.chainId = chainId;

        return {
            address: this.address,
            chainId: this.chainId,
            network: this.config.name,
            type: 'evm'
        };
    }

    getAddress() {
        return this.address;
    }

    disconnect() {
        this.address = null;
        this.chainId = null;
    }
}

module.exports = EVMAdapter;
