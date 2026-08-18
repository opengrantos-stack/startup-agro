class WalletManager {
    constructor(config) {
        this.config = config;
        this.provider = null;
        this.address = null;
        this.network = null;
    }

    isAvailable() {
        return typeof window !== 'undefined' &&
               typeof window.ethereum !== 'undefined';
    }

    async connectEVM() {
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

        return {
            address: this.address,
            type: 'evm'
        };
    }

    disconnect() {
        this.address = null;
        this.network = null;
        this.provider = null;
    }

    getAddress() {
        return this.address;
    }
}

module.exports = WalletManager;
