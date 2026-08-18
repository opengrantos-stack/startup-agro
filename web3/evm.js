class EVMAdapter {
    constructor(config = {}) {
        this.config = config;
        this.provider = null;
        this.chainId = null;
        this.address = null;
    }

    isAvailable() {
        return typeof window !== 'undefined' &&
               typeof window.ethereum !== 'undefined';
    }

    async connect() {
        if (!this.isAvailable()) {
            throw new Error('Carteira EVM não encontrada.');
        }

        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });

        if (!accounts || accounts.length === 0) {
            throw new Error('Nenhuma carteira selecionada.');
        }

        this.address = accounts[0];

        const chainId = await window.ethereum.request({
            method: 'eth_chainId'
        });

        this.chainId = chainId;

        return {
            address: this.address,
            chainId: this.chainId,
            type: 'evm'
        };
    }

    async getChainId() {
        if (!this.isAvailable()) {
            throw new Error('Carteira EVM não encontrada.');
        }

        return await window.ethereum.request({
            method: 'eth_chainId'
        });
    }

    getAddress() {
        return this.address;
    }

    disconnect() {
        this.provider = null;
        this.chainId = null;
        this.address = null;
    }
}

module.exports = EVMAdapter;
