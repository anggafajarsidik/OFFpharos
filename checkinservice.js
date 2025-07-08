import fetch from 'node-fetch';

export class CheckinClient {
    constructor(accountDetails, logFunction) {
        this.address = accountDetails.address;
        this.wallet = accountDetails.wallet;
        this.userAgent = accountDetails.userAgent;
        this.proxyAgent = accountDetails.proxyAgent;
        this.log = logFunction;
        this.baseURL = "https://api.pharosnetwork.xyz";
        this.authToken = null;
    }

    logWrapper(message, color, symbol) { this.log('CHECK-IN', `[${this.address.slice(0, 6)}...] ${message}`, color, symbol); }

    async login() {
        try {
            this.logWrapper("Signing authentication message...", "\x1b[34m", '✍️');
            const signature = await this.wallet.signMessage("pharos");
            const loginUrl = `/user/login?address=${this.address}&signature=${signature}&invite_code=`;
            const data = await this.makeSignedRequest(loginUrl, 'post', false);
            if (data && data.code === 0 && data.data && data.data.jwt) {
                this.authToken = data.data.jwt;
                this.logWrapper("Authentication successful, token received.", "\x1b[32m", '✅');
                return true;
            } else {
                this.logWrapper(`Authentication failed: ${data.msg || 'No JWT in response'}`, "\x1b[31m", '❌');
                return false;
            }
        } catch (error) {
            this.logWrapper(`Login process failed: ${error.message}`, "\x1b[31m", '🚨');
            return false;
        }
    }

    async makeSignedRequest(endpoint, method = 'get', requireAuth = true) {
        const url = `${this.baseURL}${endpoint}`;
        const options = {
            method: method,
            headers: {
                'User-Agent': this.userAgent,
                'Referer': 'https://testnet.pharosnetwork.xyz/',
                'Origin': 'https://testnet.pharosnetwork.xyz',
            },
            agent: this.proxyAgent,
        };
        if (requireAuth && this.authToken) {
            options.headers['Authorization'] = `Bearer ${this.authToken}`;
        }
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`HTTP error! Status: ${response.status}, Body: ${errorBody}`);
            }
            return await response.json();
        } catch (error) {
            this.logWrapper(`Request to ${endpoint} failed: ${error.message}`, "\x1b[31m", '❌');
            throw error;
        }
    }

    async getCheckinStatus() {
        this.logWrapper("Fetching check-in status...", "\x1b[34m", '🔍');
        const data = await this.makeSignedRequest(`/sign/status?address=${this.address}`);
        if (data && data.code === 0 && data.data && typeof data.data.status === 'string') {
            const statusArray = data.data.status;
            const dayIndex = (new Date().getDay() + 6) % 7;
            if (statusArray[dayIndex] === '2') {
                this.logWrapper("Check-in is available for today.", "\x1b[32m", '✅');
                return true;
            } else {
                this.logWrapper("Already checked in today.", "\x1b[33m", '👍');
                return false;
            }
        }
        this.logWrapper(`Could not determine check-in status. Response: ${JSON.stringify(data)}`, "\x1b[31m", '❌');
        return false;
    }

    async performCheckin() {
        this.logWrapper("Attempting to perform daily check-in...", "\x1b[34m", '➡️');
        const data = await this.makeSignedRequest(`/sign/in?address=${this.address}`, 'post');
        if (data && data.code === 0) {
            this.logWrapper("Daily check-in successful!", "\x1b[32m", '🎉');
            return true;
        } else {
            const errorMessage = data.msg || 'Unknown error';
            this.logWrapper(`Check-in failed: ${errorMessage}`, "\x1b[31m", '❌');
            return false;
        }
    }

    async runCheckinForAccount() {
        const isLoggedIn = await this.login();
        if (!isLoggedIn) {
            this.logWrapper("Cannot proceed with check-in without a successful login.", "\x1b[31m", '🛑');
            return;
        }
        try {
            const isCheckinAvailable = await this.getCheckinStatus();
            if (isCheckinAvailable) {
                await new Promise(r => setTimeout(r, 1000));
                await this.performCheckin();
            }
        } catch (error) {
            this.logWrapper(`Check-in process stopped due to an error.`, "\x1b[31m", '🚨');
        }
    }
}
