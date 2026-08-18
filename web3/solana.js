class SolanaAdapter {
    constructor(networkConfig = {}) {
        this.config = networkConfig;
        this.wallet = null;
        this.address = null;
    }

    isAvailable() {
        return typeof window !== 'undefined' &&
               typeof window.navigator !== 'undefined';
    }

    isConfigured() {
        return Boolean(this.config.name);
    }

    isEnabled() {
        return this.config.enabled === true;
    }

    getWallets() {
        if (!this.isAvailable()) {
            return [];
        }

        if (!window.navigator.wallets) {
            return [];
        }

        return window.navigator.wallets;
    }

    async connect(wallet) {
        if (!this.isConfigured()) {
            throw new Error('Rede Solana não configurada.');
        }

        if (!this.isEnabled()) {
            throw new Error('A rede Solana está desativada.');
        }

        if (!wallet) {
            throw new Error('Nenhuma carteira Solana selecionada.');
        }

        if (!wallet.accounts || wallet.accounts.length === 0) {
            throw new Error('A carteira Solana não possui contas disponíveis.');
        }

        this.wallet = wallet;
        this.address = wallet.accounts[0].address;

        return {
            address: this.address,
            network: this.config.name,
            type: 'solana'
        };
    }

    getAddress() {
        return this.address;
    }

    disconnect() {
        this.wallet = null;
        this.address = null;
    }
}

module.exports = SolanaAdapter;
