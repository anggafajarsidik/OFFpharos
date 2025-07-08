import fetch from 'node-fetch';
import AbortController from 'abort-controller';
import { ethers } from 'ethers';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { buildFallbackProvider, ERC20_ABI as BaseERC20_ABI } from './providerservice.js';
import UserAgent from 'user-agents';
import dotenv from 'dotenv';
import readline from 'readline';
import fs from 'fs';
import process from 'process';
import { FaucetClient } from './faucetservice.js';
import { CheckinClient } from './checkinservice.js';

dotenv.config();

const GAS_FEE_MULTIPLIER = 2.5;
const DAILY_RUN_INTERVAL_HOURS = 24;
const MINIMUM_LP_TOP_UP_SWAP = "0.001";
const APPROX_PRICES_IN_PHRS = {
    'USDC': 0.1,
    'USDT': 0.1,
    'WBTC': 35000,
    'WETH': 2000,
};
const DEX_CONFIGS = {
    FAROSWAP: {
        NAME: "Faroswap (DODO)",
        TOKENS: {
            PHRS: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
            WBTC: '0x8275c526d1bCEc59a31d673929d3cE8d108fF5c7',
            WETH: '0x4E28826d32F1C398DED160DC16Ac6873357d048f',
            USDC: '0x72df0bcd7276f2dFbAc900D1CE63c272C4BCcCED',
            USDT: '0xD4071393f8716661958F766DF660033b3d35fD29',
            WPHRS: '0x3019B247381c850ab53Dc0EE53bCe7A07Ea9155f'
        },
    },
    ZENITHSWAP: {
        NAME: "Zenithswap",
        ROUTER_ADDRESS: "0x1a4de519154ae51200b0ad7c90f7fac75547888a",
        TOKENS: {
            WPHRS: "0x76aaada469d23216be5f7c596fa25f282ff9b364",
            PHRS: "0x76aaada469d23216be5f7c596fa25f282ff9b364",
            USDC: "0xad902cf99c2de2f1ba5ec4d642fd7e49cae9ee37",
            USDT: "0xed59de2d7ad9c043442e381231ee3646fc3c2939"
        },
        FEE: 500,
        ROUTER_ABI: [{"inputs":[{"components":[{"internalType":"address","name":"tokenIn","type":"address"},{"internalType":"address","name":"tokenOut","type":"address"},{"internalType":"uint24","name":"fee","type":"uint24"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amountIn","type":"uint256"},{"internalType":"uint256","name":"amountOutMinimum","type":"uint256"},{"internalType":"uint160","name":"sqrtPriceLimitX96","type":"uint160"}],"internalType":"struct IV3SwapRouter.ExactInputSingleParams","name":"params","type":"tuple"}],"name":"exactInputSingle","outputs":[{"internalType":"uint256","name":"amountOut","type":"uint256"}],"stateMutability":"payable","type":"function"}],
        ERC20_ABI: ["function approve(address spender, uint256 amount) external returns (bool)","function allowance(address owner, address spender) external view returns (uint256)","function balanceOf(address owner) view returns (uint256)","function deposit() payable", "function decimals() view returns (uint8)", "function symbol() view returns (string)"],
    }
};
const POSITION_MANAGER_ADDRESS = "0xF8a1D4FF0f9b9Af7CE58E1fc1833688F3BFd6115";
const POSITION_MANAGER_ABI = [
    "function mint(tuple(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
    "function increaseLiquidity(tuple(uint256 tokenId, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, uint256 deadline)) external payable returns (uint128 liquidity, uint256 amount0, uint256 amount1)",
    "function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX96, uint256 feeGrowthInside1LastX96, uint128 tokensOwed0, uint128 tokensOwed1)",
    "function balanceOf(address owner) external view returns (uint256)",
    "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
];
const ZENITH_LP_PAIRS = [
    { name: 'WPHRS/USDC', token0: 'WPHRS', token1: 'USDC' },
    { name: 'WPHRS/USDT', token0: 'WPHRS', token1: 'USDT' },
];
const DVM_ROUTER_ADDRESS = "0x4b177AdEd3b8bD1D5D747F91B9E853513838Cd49";
const DVM_POOL_HELPER_ADDRESS = "0x73cafc894dbfc181398264934f7be4e482fc9d40";
const FAROSWAP_DVM_PAIRS = [
    { name: "USDC/USDT", base: "USDC", quote: "USDT" },
    { name: "USDT/USDC", base: "USDT", quote: "USDC" }
];
const DVM_ROUTER_ABI = [{"type":"function","name":"addDVMLiquidity","stateMutability":"payable","inputs":[{"internalType":"address","name":"dvmAddress","type":"address"},{"internalType":"uint256","name":"baseInAmount","type":"uint256"},{"internalType":"uint256","name":"quoteInAmount","type":"uint256"},{"internalType":"uint256","name":"baseMinAmount","type":"uint256"},{"internalType":"uint256","name":"quoteMinAmount","type":"uint256"},{"internalType":"uint8","name":"flag","type":"uint8"},{"internalType":"uint256","name":"deadLine","type":"uint256"}],"outputs":[{"internalType":"uint256","name":"shares","type":"uint256"},{"internalType":"uint256","name":"baseAdjustedInAmount","type":"uint256"},{"internalType":"uint256","name":"quoteAdjustedInAmount","type":"uint256"}]}];

const PHAROS_CHAIN_ID = 688688;
const PHAROS_RPC_URLS = [ 'https://testnet.dplabs-internal.com' ];
const PHAROS_EXPLORER_URL = 'https://pharos-testnet.socialscan.io/tx/';
const API_BASE_URL = "https://api.pharosnetwork.xyz";
const WPHRS_ABI_FARO = [{"inputs":[],"name":"deposit","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"uint256","name":"wad","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"}];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const Colors = { Reset: "\x1b[0m", Bright: "\x1b[1m", FgRed: "\x1b[31m", FgGreen: "\x1b[32m", FgYellow: "\x1b[33m", FgBlue: "\x1b[34m", FgMagenta: "\x1b[35m", FgCyan: "\x1b[36m", FgDim: "\x1b[2m"};
function log(prefix, message, color = Colors.Reset, symbol = '➡️') { const timestamp = new Date().toLocaleTimeString(); console.log(`${color}${symbol} [${timestamp}] ${prefix}: ${message}${Colors.Reset}`); }
function getRandomNumber(min, max, decimals = 4) { return (Math.random() * (max - min) + min).toFixed(decimals); }
function getRandomElement(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
async function askQuestion(promptOptions) { const isWindows = process.platform === 'win32'; if (isWindows && process.stdin.isTTY) { process.stdin.setRawMode(true); } return new Promise(resolve => { const sigintHandler = () => { log('SYSTEM', 'Ctrl+C detected during input. Exiting script...', Colors.FgYellow, '⚠️'); rl.removeListener('SIGINT', sigintHandler); if (isWindows && process.stdin.isTTY) process.stdin.setRawMode(false); rl.close(); process.exit(1); }; rl.on('SIGINT', sigintHandler); rl.question(promptOptions.message, (answer) => { if (isWindows && process.stdin.isTTY) process.stdin.setRawMode(false); rl.removeListener('SIGINT', sigintHandler); resolve(answer); }); }); }
async function getPublicIpViaProxy(proxyAgent) { try { const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 3000); const res = await fetch('http://api.ipify.org', { agent: proxyAgent, signal: controller.signal }); clearTimeout(timeout); if (!res.ok) throw new Error(`Failed to fetch IP: ${res.statusText}`); return (await res.text()).trim(); } catch (error) { return `Error fetching IP: ${error.message}`; } }
async function showAllBalances(walletAddress, provider) { log('BALANCES', `For ${walletAddress}:`, Colors.FgCyan, '💰'); let balanceDetails = []; try { const native = await provider.getBalance(walletAddress); balanceDetails.push(`PHRS (native): ${ethers.formatEther(native)}`); } catch (err) { balanceDetails.push(`PHRS (native): Error fetching`); } for (const [dex, config] of Object.entries(DEX_CONFIGS)) { for (const [symbol, tokenAddr] of Object.entries(config.TOKENS)) { if (symbol === 'PHRS') continue; const contract = new ethers.Contract(tokenAddr, BaseERC20_ABI, provider); try { const balance = await contract.balanceOf(walletAddress); let decimals = 18; if ((symbol === 'USDC' || symbol === 'USDT') && dex === 'FAROSWAP') { decimals = 6; } balanceDetails.push(`${symbol} (${dex.replace('SWAP', '')}): ${ethers.formatUnits(balance, decimals)}`); } catch (e) {} } } log('BALANCES', balanceDetails.join(' | '), Colors.FgCyan, '✨'); }
async function fetchWithTimeout(url, timeout = 10000, agent = null) { const controller = new AbortController(); const id = setTimeout(() => controller.abort(), timeout); try { const res = await fetch(url, { signal: controller.signal, agent: agent }); clearTimeout(id); return res; } catch (err) { throw new Error('Timeout or network error'); } }
async function robustFetchDodoRoute(url, agent = null, accountFullAddress = '') { for (let i = 0; i < 5; i++) { try { const res = await fetchWithTimeout(url, 15000, agent); const data = await res.json(); if (data.status !== -1) return data; log('DODO API', `Retry ${i + 1} failed for ${accountFullAddress} (status -1).`, Colors.FgYellow, '⚠️'); } catch (e) { log('DODO API', `Retry ${i + 1} failed for ${accountFullAddress}: ${e.message}`, Colors.FgYellow, '⚠️'); } await new Promise(r => setTimeout(r, 2000)); } throw new Error('DODO API permanently failed after 5 retries.'); }
async function fetchDodoRoute(fromAddr, toAddr, userAddr, amountWei, agent = null) { const deadline = Math.floor(Date.now() / 1000) + 600; const url = `https://api.dodoex.io/route-service/v2/widget/getdodoroute?chainId=${PHAROS_CHAIN_ID}&deadLine=${deadline}&apikey=a37546505892e1a952&slippage=50&source=dodoV2AndMixWasm&toTokenAddress=${toAddr}&fromTokenAddress=${fromAddr}&userAddr=${userAddr}&estimateGas=true&fromAmount=${amountWei}`; log('DODO API', `Requesting route for ${userAddr}...`, Colors.FgBlue, '🌐'); try { const result = await robustFetchDodoRoute(url, agent, userAddr); log('DODO API', `Route info fetched successfully for ${userAddr}.`, Colors.FgGreen, '🧭'); return result.data; } catch (err) { log('DODO API', `Failed to fetch route for ${userAddr}: ${err.message}`, Colors.FgRed, '❌'); throw err; } }

async function runCountdown(hours) {
    const totalSeconds = hours * 3600;
    const nextRunTime = new Date(Date.now() + totalSeconds * 1000);
    const nextRunTimeWIB = nextRunTime.toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', hour12: false, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    log('SYSTEM', `All tasks complete. Next run scheduled at: ${nextRunTimeWIB} WIB`, Colors.FgGreen, '⏰');
    return new Promise(resolve => {
        const interval = setInterval(() => {
            const now = Date.now();
            const remaining = Math.round((nextRunTime.getTime() - now) / 1000);

            if (remaining <= 0) {
                clearInterval(interval);
                process.stdout.write('\r' + ' '.repeat(70) + '\r');
                log('SYSTEM', 'Countdown finished. Starting next run...', Colors.FgGreen, '🚀');
                resolve();
                return;
            }

            const h = Math.floor(remaining / 3600);
            const m = Math.floor((remaining % 3600) / 60);
            const s = remaining % 60;

            const countdownStr = `Next run in: ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
            process.stdout.write(`${Colors.FgCyan}   ${countdownStr}${' '.repeat(20)}${Colors.Reset}\r`);
        }, 1000);
    });
}

async function executeTransaction(wallet, txRequest, description) {
    let txResponse;
    const sendMaxRetries = 10;
    for (let i = 0; i < sendMaxRetries; i++) {
        try {
            if (i > 0) {
                const delay = Math.min(2000 * Math.pow(2, i), 30000);
                log('TX', `Retrying to SEND ${description}... (Attempt ${i + 1}/${sendMaxRetries}, delay ${delay/1000}s)`, Colors.FgYellow, '🔄');
                await new Promise(r => setTimeout(r, delay));
            }
            txResponse = await wallet.sendTransaction(txRequest);
            log('TX', `${description} TX sent: ${txResponse.hash}`, Colors.FgYellow, '🚀');
            break; 
        } catch (e) {
            if (e.message.includes('TX_REPLAY_ATTACK')) {
                log('TX', `TX_REPLAY_ATTACK detected for ${description}. The transaction was likely already sent. Failing this attempt and moving on.`, Colors.FgYellow, '⚠️');
                throw new Error(`Replay attack detected for ${description}.`);
            }

            log('TX', `Failed to SEND ${description} on attempt ${i + 1}: ${e.message}`, Colors.FgRed, '❌');
            if (i === sendMaxRetries - 1) {
                log('TX', `Max retries reached for SENDING ${description}. Giving up.`, Colors.FgRed, '🛑');
                throw e;
            }
        }
    }

    if (!txResponse) {
        throw new Error(`Transaction response was not received for ${description}.`);
    }

    const waitMaxRetries = 8;
    const waitTimeout = 90000;
    for (let i = 0; i < waitMaxRetries; i++) {
        try {
            if (i > 0) {
                 const delay = 15000;
                log('TX-WAIT', `Retrying to GET RECEIPT for ${txResponse.hash}... (Attempt ${i + 1}/${waitMaxRetries}, delay ${delay/1000}s)`, Colors.FgYellow, '⏳');
                await new Promise(r => setTimeout(r, delay));
            }
            const receipt = await txResponse.wait(1, waitTimeout);
            if (receipt && receipt.status === 1) {
                log('TX', `${description} TX confirmed: ${receipt.hash}`, Colors.FgGreen, '✅');
                if (receipt.hash) console.log(`${Colors.FgGreen}   🔗 Explorer: ${PHAROS_EXPLORER_URL}${receipt.hash}${Colors.Reset}`);
                return receipt;
            } else if (receipt) {
                 throw new Error(`Transaction reverted on-chain (status: 0). Hash: ${receipt.hash}`);
            } else {
                throw new Error('wait() returned null receipt.');
            }
        } catch(e) {
            log('TX-WAIT', `Failed to GET RECEIPT for ${txResponse.hash} on attempt ${i + 1}: ${e.message}`, Colors.FgYellow, '⚠️');
            if (i === waitMaxRetries - 1) {
                 log('TX-WAIT', `Max retries reached for GETTING RECEIPT for ${txResponse.hash}. The transaction may still succeed on-chain.`, Colors.FgRed, '🛑');
                throw new Error(`Failed to confirm transaction ${txResponse.hash} after all retries.`);
            }
        }
    }
}


class AccountProcessor {
    constructor(account, operationParams, provider) {
        this.pk = account.pk;
        this.proxyAgent = account.proxyAgent;
        this.accountIndex = account.accountIndex;
        this.provider = provider;
        this.wallet = new ethers.Wallet(this.pk, this.provider);
        this.address = this.wallet.address;
        this.operationParams = operationParams;
        this.authToken = null;
        this.nonce = 0;
    }

    async #executeTx(txData, description) {
        const txRequest = { ...txData, nonce: this.nonce };
        try {
            const feeData = await this.provider.getFeeData();
            if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
                txRequest.maxFeePerGas = BigInt(Math.round(Number(feeData.maxFeePerGas) * GAS_FEE_MULTIPLIER));
                const calculatedPrioFee = BigInt(Math.round(Number(feeData.maxPriorityFeePerGas) * GAS_FEE_MULTIPLIER));
                txRequest.maxPriorityFeePerGas = calculatedPrioFee > 0n ? calculatedPrioFee : ethers.parseUnits('1', 'gwei');
            } else if (feeData.gasPrice) {
                txRequest.gasPrice = BigInt(Math.round(Number(feeData.gasPrice) * GAS_FEE_MULTIPLIER));
            }
        } catch(e) {
            log('GAS', `Could not get custom fee data. Using default. (${e.message})`, Colors.FgYellow, '⚠️');
        }

        const receipt = await executeTransaction(this.wallet, txRequest, description);
        if (receipt) {
            this.nonce++;
        }
        return receipt;
    }

    async #api_request({ endpoint, method = 'post' }) { const userAgent = new UserAgent(); const options = { method: method, headers: { 'User-Agent': userAgent.toString(), 'Referer': 'https://testnet.pharosnetwork.xyz/', 'Origin': 'https://testnet.pharosnetwork.xyz' }, agent: this.proxyAgent, }; if (this.authToken) { options.headers['Authorization'] = `Bearer ${this.authToken}`; } try { const response = await fetch(`${API_BASE_URL}${endpoint}`, options); if (!response.ok) { return null; } return response.json(); } catch (e) { return null; } }
    async #login() { const signature = await this.wallet.signMessage("pharos"); const endpoint = `/user/login?address=${this.address}&signature=${signature}&invite_code=`; const data = await this.#api_request({ endpoint, method: 'post' }); if (data && data.data && data.data.jwt) { this.authToken = data.data.jwt; return true; } return false; }
    async handleVerifyTaskWithHash({ taskId, txHash }) { log('VERIFY', `Verifying task ${taskId} with hash ${txHash.slice(0,10)}...`, Colors.FgBlue, '🔍'); if (!this.authToken) { const loggedIn = await this.#login(); if (!loggedIn) { log('VERIFY', 'Verification failed: Could not log in.', Colors.FgRed, '❌'); return; } } const endpoint = `/task/verify?address=${this.address}&task_id=${taskId}&tx_hash=${txHash}`; const data = await this.#api_request({ endpoint }); if (data && data.code === 0) { log('VERIFY', `Task ${taskId} verification successful.`, Colors.FgGreen, '✅'); } else { log('VERIFY', `Task ${taskId} verification failed: ${data?.msg || 'Unknown error'}`, Colors.FgYellow, '⚠️'); } }

    async runAutoSend() {
        const { settings, recipientAddresses, minDelayMs, maxDelayMs } = this.operationParams;
        if (!settings || !recipientAddresses) {
            log('AUTO-SEND', 'Settings or recipient addresses not configured. Skipping.', Colors.FgYellow, '⚠️');
            return;
        }

        const targetCount = settings.RECIPIENT_COUNT;
        const availableRecipients = [...recipientAddresses].filter(r => ethers.isAddress(r) && r.toLowerCase() !== this.address.toLowerCase());
        if (availableRecipients.length === 0) {
            log('AUTO-SEND', 'No valid external recipients found to send to. Skipping.', Colors.FgYellow, '⚠️');
            return;
        }

        let targetRecipients = [];
        if (targetCount === 'all') {
            targetRecipients = availableRecipients;
        } else {
            for (let i = availableRecipients.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [availableRecipients[i], availableRecipients[j]] = [availableRecipients[j], availableRecipients[i]];
            }
            targetRecipients = availableRecipients.slice(0, Math.min(targetCount, availableRecipients.length));
        }

        if (targetRecipients.length === 0) {
            log('AUTO-SEND', 'Could not determine any recipients. Skipping.', Colors.FgYellow, '⚠️');
            return;
        }
        
        log('AUTO-SEND', `Starting task. Target recipients: ${targetRecipients.length}`, Colors.Bright, '💸');
        for (let i = 0; i < targetRecipients.length; i++) {
            const recipient = targetRecipients[i];
            try {
                let amount = getRandomNumber(settings.AMOUNT_SEND[0], settings.AMOUNT_SEND[1], 5);
                log('AUTO-SEND', `[${i + 1}/${targetRecipients.length}] Preparing to send ${amount} PHRS to ${recipient.slice(0, 8)}...`, Colors.FgMagenta, '📤');
                const txRequest = { to: recipient, value: ethers.parseEther(amount.toString()) };
                
                const receipt = await this.#executeTx(txRequest, `Send ${amount} PHRS`);
                if (receipt) {
                    await this.handleVerifyTaskWithHash({ taskId: 103, txHash: receipt.hash });
                }
            } catch (e) {
                log('AUTO-SEND', `Send transaction to ${recipient.slice(0,8)} failed: ${e.message}`, Colors.FgRed, '❌');
                if (e.message.includes('insufficient funds')) {
                    log('AUTO-SEND', 'Stopping due to insufficient funds.', Colors.FgRed, '🛑');
                    break;
                }
            }

            if (i < targetRecipients.length - 1) {
                const delay = getRandomNumber(minDelayMs, maxDelayMs, 0);
                log('SYSTEM', `Waiting ${delay/1000}s for next send...`, Colors.FgDim, '⏳');
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    async #doTopUpSwap(dexName, tokenToGet, amountPh_rsToSwapStr) {
        log('LIQUIDITY', `[${dexName}] Executing top-up swap: ${amountPh_rsToSwapStr} PHRS to ${tokenToGet}...`, Colors.FgBlue, '🔁');
        try {
            if (dexName.toLowerCase() === 'zenithswap') {
                const { ROUTER_ADDRESS, TOKENS: Z_TOKENS, FEE, ROUTER_ABI, ERC20_ABI } = DEX_CONFIGS.ZENITHSWAP;
                const amountIn = ethers.parseEther(amountPh_rsToSwapStr.toString());
                const tokenInAddress = Z_TOKENS.WPHRS;
                const tokenOutAddress = Z_TOKENS[tokenToGet];
                
                const tokenInContract = new ethers.Contract(tokenInAddress, ERC20_ABI, this.wallet);
                const wphrsBalance = await tokenInContract.balanceOf(this.address);
                if (wphrsBalance < amountIn) {
                    log('SWAP', `[Zenithswap] Not enough WPHRS for top-up. Wrapping...`, Colors.FgYellow, '📦');
                    const needed = amountIn - wphrsBalance;
                    const wrapTxData = await tokenInContract.deposit.populateTransaction({ value: needed });
                    await this.#executeTx(wrapTxData, `Wrap ${ethers.formatEther(needed)} PHRS (Top-Up)`);
                }
                
                const allowance = await tokenInContract.allowance(this.address, ROUTER_ADDRESS);
                if (allowance < amountIn) {
                    const approveTxData = await tokenInContract.approve.populateTransaction(ROUTER_ADDRESS, ethers.MaxUint256);
                    await this.#executeTx(approveTxData, `Approve WPHRS (Top-Up)`);
                }

                const params = { tokenIn: tokenInAddress, tokenOut: tokenOutAddress, fee: FEE, recipient: this.address, amountIn, amountOutMinimum: 0, sqrtPriceLimitX96: 0 };
                const swapRouterContract = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, this.wallet);
                const swapTxData = await swapRouterContract.exactInputSingle.populateTransaction(params);
                await this.#executeTx(swapTxData, `Swap ${amountPh_rsToSwapStr} WPHRS to ${tokenToGet} (Zenith Top-Up)`);

            } else { 
                const fromTokenAddress = DEX_CONFIGS.FAROSWAP.TOKENS.PHRS;
                const toTokenAddress = DEX_CONFIGS.FAROSWAP.TOKENS[tokenToGet];
                const amountWei = ethers.parseEther(amountPh_rsToSwapStr.toString());
                const data = await fetchDodoRoute(fromTokenAddress, toTokenAddress, this.address, amountWei, this.proxyAgent);
                const txRequest = { to: data.to, data: data.data, value: BigInt(data.value) };
                await this.#executeTx(txRequest, `Swap ${amountPh_rsToSwapStr} PHRS to ${tokenToGet} (Faro Top-Up)`);
            }
            log('LIQUIDITY', `[${dexName}] Top-up swap seemingly successful.`, Colors.FgGreen, '✅');
            return true;
        } catch (e) {
            throw new Error(`Top-up swap failed: ${e.message}`);
        }
    }
    
    async #ensureTokenBalance(tokenSymbol, requiredAmountWei, dexName) {
        if (tokenSymbol === 'WPHRS') return true;
        const dexConfig = DEX_CONFIGS[dexName.toUpperCase()];
        const tokenAddress = dexConfig.TOKENS[tokenSymbol];
        const tokenContract = new ethers.Contract(tokenAddress, BaseERC20_ABI, this.provider);
        let currentBalance = await tokenContract.balanceOf(this.address);
        if (currentBalance >= requiredAmountWei) {
            return true;
        }
        
        try {
            const deficit = requiredAmountWei - currentBalance;
            const deficitFloat = parseFloat(ethers.formatUnits(deficit, 18));
            log('LIQUIDITY', `[${dexName}] Insufficient ${tokenSymbol} balance. Have: ${ethers.formatUnits(currentBalance, 18)}, Need: ${ethers.formatUnits(requiredAmountWei, 18)}.`, Colors.FgYellow, '⚠️');
            const price = APPROX_PRICES_IN_PHRS[tokenSymbol];
            if (!price) throw new Error(`Price for ${tokenSymbol} not defined, cannot perform auto-swap.`);
            const estimatedPharsNeeded = deficitFloat / price;
            const phrsToSwapFloat = Math.max(estimatedPharsNeeded * 1.2, parseFloat(MINIMUM_LP_TOP_UP_SWAP));
            
            const phrsToSwapString = phrsToSwapFloat.toFixed(18);
            await this.#doTopUpSwap(dexName, tokenSymbol, phrsToSwapString);
            
            const maxPollRetries = 12; 
            for (let i = 0; i < maxPollRetries; i++) {
                await new Promise(r => setTimeout(r, 10000));
                const newBalance = await tokenContract.balanceOf(this.address);
                if (newBalance >= requiredAmountWei) {
                    log('LIQUIDITY', `[${dexName}] Top-up successful. New ${tokenSymbol} balance: ${ethers.formatUnits(newBalance, 18)}`, Colors.FgGreen, '✅');
                    return true;
                }
                log('LIQUIDITY', `[${dexName}] Waiting for balance to update... (Attempt ${i + 1}/${maxPollRetries})`, Colors.FgDim, '⏳');
            }
            
            throw new Error(`Balance still insufficient after top-up swap and polling.`);
        } catch (e) {
            log('LIQUIDITY', `[${dexName}] Auto-swap process for ${tokenSymbol} failed: ${e.message}`, Colors.FgRed, '❌');
            return false;
        }
    }

    async batchFaroswap() {
        const { swapParams, minDelayMs, maxDelayMs } = this.operationParams;
        if (!swapParams || !swapParams.FAROSWAP) return;
        const { fromToken, toToken, amount, count } = swapParams.FAROSWAP;
        const { TOKENS: F_TOKENS } = DEX_CONFIGS.FAROSWAP;
        const fromTokenAddress = F_TOKENS[fromToken];
        const toTokenAddress = F_TOKENS[toToken];
        const amountWei = ethers.parseEther(amount.toString());
        for (let i = 0; i < count; i++) {
            log('SWAP', `[Faroswap] Initiating swap #${i + 1}/${count} ${amount} ${fromToken} to ${toToken}...`, Colors.FgMagenta, '🔁');
            try {
                if (fromToken === 'PHRS' && toToken === 'WPHRS') {
                    const wphrsContract = new ethers.Contract(F_TOKENS.WPHRS, WPHRS_ABI_FARO, this.wallet);
                    const txData = await wphrsContract.deposit.populateTransaction({ value: amountWei });
                    await this.#executeTx(txData, `Wrap PHRS (Faro)`);
                } else if (fromToken === 'WPHRS' && toToken === 'PHRS') {
                    const wphrsContract = new ethers.Contract(F_TOKENS.WPHRS, WPHRS_ABI_FARO, this.wallet);
                    const txData = await wphrsContract.withdraw.populateTransaction(amountWei);
                    await this.#executeTx(txData, `Unwrap WPHRS (Faro)`);
                } else if (fromToken === 'PHRS') {
                    const data = await fetchDodoRoute(fromTokenAddress, toTokenAddress, this.address, amountWei, this.proxyAgent);
                    const txRequest = { to: data.to, data: data.data, value: BigInt(data.value) };
                    await this.#executeTx(txRequest, `Swap ${amount} ${fromToken} to ${toToken} (Faro)`);
                }
                log('SWAP', `[Faroswap] Swap #${i + 1} completed.`, Colors.FgGreen, '✅');
            } catch (e) { log('SWAP', `[Faroswap] Swap #${i + 1} failed: ${e.message}`, Colors.FgRed, '❌'); }
            if (i < count - 1) {
                const randomDelay = Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
                log('SYSTEM', `Waiting ${randomDelay / 1000}s...`, Colors.FgDim, '⏳'); await new Promise(r => setTimeout(r, randomDelay));
            }
        }
    }
    
    async batchZenithswap() {
        const { swapParams, minDelayMs, maxDelayMs } = this.operationParams;
        if (!swapParams || !swapParams.ZENITHSWAP) return;
        const { fromToken, toToken, amount, count } = swapParams.ZENITHSWAP;
        const { ROUTER_ADDRESS, TOKENS: Z_TOKENS, FEE, ROUTER_ABI, ERC20_ABI } = DEX_CONFIGS.ZENITHSWAP;
        for (let i = 0; i < count; i++) {
            log('SWAP', `[Zenithswap] Initiating swap #${i + 1}/${count} ${amount} ${fromToken} to ${toToken}...`, Colors.FgMagenta, '🔁');
            try {
                const amountIn = ethers.parseEther(amount.toString());
                const tokenInAddress = Z_TOKENS[fromToken];
                const tokenOutAddress = Z_TOKENS[toToken];
                const tokenInContract = new ethers.Contract(tokenInAddress, ERC20_ABI, this.wallet);
                if (fromToken === "PHRS") {
                    const wphrsBalance = await tokenInContract.balanceOf(this.address);
                    if (wphrsBalance < amountIn) {
                        log('SWAP', `[Zenithswap] Not enough WPHRS. Wrapping...`, Colors.FgYellow, '📦');
                        const needed = amountIn - wphrsBalance;
                        const nativeBalance = await this.provider.getBalance(this.address);
                        if (nativeBalance < needed) throw new Error(`Not enough native PHRS to wrap. Needed: ${ethers.formatEther(needed)}`);
                        const txData = await tokenInContract.deposit.populateTransaction({ value: needed });
                        await this.#executeTx(txData, `Wrap ${ethers.formatEther(needed)} PHRS (Zenith)`);
                    }
                }
                
                let allowance = 0n;
                try {
                    allowance = await tokenInContract.allowance(this.address, ROUTER_ADDRESS);
                } catch (e) {
                    log('SWAP', `[Zenithswap] Could not check allowance, assuming 0. Proceeding with approval. (${e.message})`, Colors.FgYellow, '⚠️');
                }

                if (allowance < amountIn) {
                    log('SWAP', `[Zenithswap] Approving WPHRS...`, Colors.FgYellow, '🔑');
                    const txData = await tokenInContract.approve.populateTransaction(ROUTER_ADDRESS, ethers.MaxUint256);
                    await this.#executeTx(txData, `Approve WPHRS (Zenith)`);
                }

                const txParams = { tokenIn: tokenInAddress, tokenOut: tokenOutAddress, fee: FEE, recipient: this.address, amountIn: amountIn, amountOutMinimum: 0, sqrtPriceLimitX96: 0 };
                const swapRouterContract = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, this.wallet);
                const txData = await swapRouterContract.exactInputSingle.populateTransaction(txParams);
                await this.#executeTx(txData, `Swap ${amount} ${fromToken === 'PHRS' ? 'WPHRS' : fromToken} to ${toToken} (Zenith)`);
                log('SWAP', `[Zenithswap] Swap #${i + 1} completed.`, Colors.FgGreen, '✅');
            } catch (e) { log('SWAP', `[Zenithswap] Swap #${i + 1} failed: ${e.message}`, Colors.FgRed, '❌'); }
            if (i < count - 1) { 
                const randomDelay = Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
                log('SYSTEM', `Waiting ${randomDelay / 1000}s...`, Colors.FgDim, '⏳'); await new Promise(r => setTimeout(r, randomDelay));
            }
        }
    }

    async #approveForLP(tokenAddress, spender, amount, tokenSymbolForLog, dexName) {
        // =========================================================================================
        // === PERBAIKAN DI SINI: Menggunakan `BaseERC20_ABI` agar kompatibel untuk semua DEX ===
        // =========================================================================================
        const tokenContract = new ethers.Contract(tokenAddress, BaseERC20_ABI, this.wallet);
        
        let allowance = 0n;
        try {
            allowance = await tokenContract.allowance(this.address, spender);
        } catch (e) {
            log('LIQUIDITY', `[${dexName}] Could not check allowance for ${tokenSymbolForLog}, assuming 0. (${e.message})`, Colors.FgYellow, '⚠️');
        }
        
        if (allowance < amount) {
            log('LIQUIDITY', `[${dexName}] Approving ${tokenSymbolForLog}...`, Colors.FgYellow, '🔑');
            const txData = await tokenContract.approve.populateTransaction(spender, ethers.MaxUint256);
            await this.#executeTx(txData, `Approve ${tokenSymbolForLog} for ${dexName} LP`);
        } else {
             log('LIQUIDITY', `[${dexName}] Token ${tokenSymbolForLog} already approved.`, Colors.FgGreen, '👍');
        }
    }

    async #findExistingPositionZenith({ token0, token1, fee, positionManager }) {
        try {
            const balance = await positionManager.balanceOf(this.address);
            if (balance == 0n) return null;
    
            token0 = token0.toLowerCase();
            token1 = token1.toLowerCase();
            for (let i = 0; i < ethers.toNumber(balance); i++) {
                try {
                    const tokenId = await positionManager.tokenOfOwnerByIndex(this.address, i);
                    const position = await positionManager.positions(tokenId);
                    const posToken0 = position.token0.toLowerCase();
                    const posToken1 = position.token1.toLowerCase();
                    if (((posToken0 === token0 && posToken1 === token1) || (posToken0 === token1 && posToken1 === token0)) && position.fee === fee) {
                        return { tokenId, token0: position.token0, token1: position.token1 };
                    }
                } catch (err) { 
                    log('LIQUIDITY', `Could not check details of LP token #${i}. Skipping.`, Colors.FgYellow, '⚠️');
                    continue; 
                }
            }
        } catch (e) {
            log('LIQUIDITY', `Could not check existing LP positions due to RPC error. Defaulting to create a new one. (${e.message})`, Colors.FgYellow, '⚠️');
        }
        return null;
    }
    
    async batchAddLiquidityZenith() {
        const { lpParams, minDelayMs, maxDelayMs } = this.operationParams;
        if (!lpParams || !lpParams.ZENITHSWAP) return;
        const { token0, token1, amount0, amount1, count } = lpParams.ZENITHSWAP;
        const { TOKENS: Z_TOKENS, FEE } = DEX_CONFIGS.ZENITHSWAP;

        const token0Address = Z_TOKENS[token0];
        const token1Address = Z_TOKENS[token1];
        for (let i = 0; i < count; i++) {
            log('LIQUIDITY', `[Zenithswap] Initiating Add Liquidity #${i + 1}/${count} for ${token0}/${token1}...`, Colors.FgMagenta, '💧');
            try {
                const amount0Desired = ethers.parseUnits(amount0.toString(), 18);
                const amount1Desired = ethers.parseUnits(amount1.toString(), 18);
                
                const hasToken0 = await this.#ensureTokenBalance(token0, amount0Desired, 'Zenithswap');
                if (!hasToken0) throw new Error(`Could not ensure ${token0} balance for LP.`);

                const hasToken1 = await this.#ensureTokenBalance(token1, amount1Desired, 'Zenithswap');
                if (!hasToken1) throw new Error(`Could not ensure ${token1} balance for LP.`);

                if (token0 === 'WPHRS' || token1 === 'WPHRS') {
                    const wphrsTokenAddress = Z_TOKENS['WPHRS'];
                    const wphrsContract = new ethers.Contract(wphrsTokenAddress, DEX_CONFIGS.ZENITHSWAP.ERC20_ABI, this.wallet);
                    const amountToWrap = (token0 === 'WPHRS') ? amount0Desired : amount1Desired;
                    const wphrsBalance = await wphrsContract.balanceOf(this.address);
                    if (wphrsBalance < amountToWrap) {
                        log('LIQUIDITY', `[Zenithswap] Not enough WPHRS. Wrapping native PHRS...`, Colors.FgYellow, '📦');
                        const needed = amountToWrap - wphrsBalance;
                        const nativeBalance = await this.provider.getBalance(this.address);
                        if (nativeBalance < needed) {
                            throw new Error(`Insufficient native PHRS to wrap for liquidity. Needed: ${ethers.formatEther(needed)}`);
                        }
                        const txData = await wphrsContract.deposit.populateTransaction({ value: needed });
                        await this.#executeTx(txData, `Wrap ${ethers.formatEther(needed)} PHRS for Zenith LP`);
                    }
                }

                await this.#approveForLP(token0Address, POSITION_MANAGER_ADDRESS, amount0Desired, token0, 'Zenith');
                await this.#approveForLP(token1Address, POSITION_MANAGER_ADDRESS, amount1Desired, token1, 'Zenith');

                const positionManager = new ethers.Contract(POSITION_MANAGER_ADDRESS, POSITION_MANAGER_ABI, this.wallet);
                const existingPosition = await this.#findExistingPositionZenith({ token0: token0Address, token1: token1Address, fee: FEE, positionManager });
                const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
                let txData;
                if (existingPosition) {
                    log('LIQUIDITY', `[Zenithswap] Increasing liquidity...`, Colors.FgBlue, '➕');
                    const params = { tokenId: existingPosition.tokenId, amount0Desired, amount1Desired, amount0Min: 0n, amount1Min: 0n, deadline };
                    txData = await positionManager.increaseLiquidity.populateTransaction(params);
                } else {
                    log('LIQUIDITY', `[Zenithswap] Creating new liquidity position...`, Colors.FgBlue, '✨');
                    const tickLower = -887270;
                    const tickUpper = 887270;
                    const mintParams = { token0: token0Address, token1: token1Address, fee: FEE, tickLower, tickUpper, amount0Desired, amount1Desired, amount0Min: 0n, amount1Min: 0n, recipient: this.address, deadline };
                    txData = await positionManager.mint.populateTransaction(mintParams);
                }
                
                await this.#executeTx(txData, `Add LP ${token0}/${token1} (Zenith)`);
                log('LIQUIDITY', `[Zenithswap] Add Liquidity #${i + 1} completed.`, Colors.FgGreen, '✅');
            } catch (e) {
                log('LIQUIDITY', `[Zenithswap] Add Liquidity #${i + 1} failed: ${e.message}`, Colors.FgRed, '❌');
            }

            if (i < count - 1) {
                const randomDelay = Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
                log('SYSTEM', `Waiting ${randomDelay / 1000}s...`, Colors.FgDim, '⏳');
                await new Promise(r => setTimeout(r, randomDelay));
            }
        }
    }
    
    async batchAddLiquidityFaro() {
    const { lpParams, minDelayMs, maxDelayMs, faroPools } = this.operationParams;
    if (!lpParams || !lpParams.FAROSWAP || !faroPools) return;
    const { baseToken, quoteToken, baseAmount, quoteAmount, count } = lpParams.FAROSWAP;
    const baseTokenAddress = DEX_CONFIGS.FAROSWAP.TOKENS[baseToken];
    const quoteTokenAddress = DEX_CONFIGS.FAROSWAP.TOKENS[quoteToken];

    // [LOGIKA BARU]: Membuat kunci spesifik berdasarkan pilihan pengguna.
    const pairKey = `${baseToken}_${quoteToken}`;
    const dvmPairAddress = faroPools[pairKey];

    // Pengecekan langsung ke alamat yang dipilih.
    if (!dvmPairAddress) {
        log('LIQUIDITY', `[Faroswap] Pool address for the specific pair "${pairKey}" not found in your pools.json. Skipping.`, Colors.FgRed, '❌');
        return;
    }

    for (let i = 0; i < count; i++) {
        log('LIQUIDITY', `[Faroswap] Initiating Add Liquidity #${i + 1}/${count} for ${pairKey} to pool ${dvmPairAddress.slice(0,10)}...`, Colors.FgMagenta, '💧');
        try {
            const baseDecimals = (baseToken === 'USDC' || baseToken === 'USDT') ? 6 : 18;
            const quoteDecimals = (quoteToken === 'USDC' || quoteToken === 'USDT') ? 6 : 18;
            const baseAmountInWei = ethers.parseUnits(baseAmount.toString(), baseDecimals);
            const quoteAmountInWei = ethers.parseUnits(quoteAmount.toString(), quoteDecimals);

            // Pengecekan saldo (logika ini sudah benar dari sebelumnya)
            const baseTokenContract = new ethers.Contract(baseTokenAddress, BaseERC20_ABI, this.provider);
            const currentBaseBalance = await baseTokenContract.balanceOf(this.address);
            if (currentBaseBalance < baseAmountInWei) {
                throw new Error(`Insufficient ${baseToken} balance. Have: ${ethers.formatUnits(currentBaseBalance, baseDecimals)}, Need: ${ethers.formatUnits(baseAmountInWei, baseDecimals)}`);
            }

            const quoteTokenContract = new ethers.Contract(quoteTokenAddress, BaseERC20_ABI, this.provider);
            const currentQuoteBalance = await quoteTokenContract.balanceOf(this.address);
            if (currentQuoteBalance < quoteAmountInWei) {
                throw new Error(`Insufficient ${quoteToken} balance. Have: ${ethers.formatUnits(currentQuoteBalance, quoteDecimals)}, Need: ${ethers.formatUnits(quoteAmountInWei, quoteDecimals)}`);
            }

            // Memberikan izin ke Router
            await this.#approveForLP(baseTokenAddress, DVM_ROUTER_ADDRESS, baseAmountInWei, baseToken, 'Faro');
            await this.#approveForLP(quoteTokenAddress, DVM_ROUTER_ADDRESS, quoteAmountInWei, quoteToken, 'Faro');

            const dvmRouterContract = new ethers.Contract(DVM_ROUTER_ADDRESS, DVM_ROUTER_ABI, this.wallet);
            const deadline = Math.floor(Date.now() / 1000) + 600;

            const txData = await dvmRouterContract.addDVMLiquidity.populateTransaction(
                dvmPairAddress,
                baseAmountInWei,
                quoteAmountInWei,
                0, 0, 0,
                deadline
            );
            txData.gasLimit = 2000000n;
            
            await this.#executeTx(txData, `Add LP ${pairKey} (Faro)`);
            log('LIQUIDITY', `[Faroswap] Add DVM Liquidity #${i + 1} completed.`, Colors.FgGreen, '✅');

        } catch (e) {
            log('LIQUIDITY', `[Faroswap] Add DVM Liquidity #${i + 1} failed: ${e.message}`, Colors.FgRed, '❌');
        }

        if (i < count - 1) {
            const randomDelay = Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
            log('SYSTEM', `Waiting ${randomDelay / 1000}s...`, Colors.FgDim, '⏳');
            await new Promise(r => setTimeout(r, randomDelay));
        }
    }
}


    async run() {
        try {
            this.nonce = await this.provider.getTransactionCount(this.address);
            log('SYSTEM', `Initial nonce for ${this.address.slice(0,8)} is ${this.nonce}`, Colors.FgDim, '🔢');
    
            await showAllBalances(this.address, this.provider);
            const checkinClient = new CheckinClient({ address: this.address, wallet: this.wallet, userAgent: new UserAgent().toString(), proxyAgent: this.proxyAgent }, log);
            await checkinClient.runCheckinForAccount();
            const faucetClient = new FaucetClient({ address: this.address, privateKey: this.pk }, this.accountIndex, this.proxyAgent ? this.proxyAgent.proxy : null, API_BASE_URL, this.wallet, this.provider, log);
            await faucetClient.runFaucetForAccount();
            
            const { runAutoSend, swapMode, swapParams, lpMode, lpParams } = this.operationParams;
            
            if (runAutoSend) await this.runAutoSend();
            if (swapMode === 'faroswap' || swapMode === 'both') {
                if (swapParams && swapParams.FAROSWAP) await this.batchFaroswap();
            }
            if (swapMode === 'zenithswap' || swapMode === 'both') {
                if (swapParams && swapParams.ZENITHSWAP) await this.batchZenithswap();
            }
    
            if (lpMode === 'faroswap' || lpMode === 'both') {
                if (lpParams && lpParams.FAROSWAP) await this.batchAddLiquidityFaro();
            }
            if (lpMode === 'zenithswap' || lpMode === 'both') {
                if (lpParams && lpParams.ZENITHSWAP) await this.batchAddLiquidityZenith();
            }
            
            log('ACCOUNT', `Finished all operations for ${this.address}.`, Colors.FgGreen, '✅');
            return { success: true, address: this.address };
        } catch (error) {
            log('ACCOUNT', `An error occurred during operations for ${this.address}: ${error.message}`, Colors.FgRed, '❌');
            return { success: false, address: this.address, error: error.message };
        }
    }
}

async function processAccountOperation(account, operationParams) {
    const initialDelay = Math.floor(Math.random() * 5000);
    await new Promise(r => setTimeout(r, initialDelay));
    const accountFullAddress = new ethers.Wallet(account.pk).address;
    console.log(`\n${Colors.Bright}--- Wallet: ${accountFullAddress} (starting after ${initialDelay/1000}s delay) ---${Colors.Reset}`);
    try {
        const provider = await buildFallbackProvider(PHAROS_RPC_URLS, PHAROS_CHAIN_ID, account.proxyAgent, accountFullAddress);
        const accountPools = operationParams.faroPools[account.accountIndex] || {};
        const paramsWithPools = {...operationParams, faroPools: accountPools };

        const processor = new AccountProcessor(account, paramsWithPools, provider);
        return await processor.run();
    } catch (err) {
        log('ACCOUNT', `A critical error occurred for ${accountFullAddress}: ${err.message}.`, Colors.FgRed, '❌');
        return { success: false, address: accountFullAddress, error: `Critical error: ${err.message}` };
    }
}

(async () => {
    process.on('uncaughtException', (err) => { log('CRITICAL', `UNCAUGHT EXCEPTION: ${err.message}.`, Colors.FgRed, '🚨'); console.error(err.stack); });
    process.on('unhandledRejection', (reason, promise) => { log('CRITICAL', `UNHANDLED REJECTION: ${reason?.stack || reason}.`, Colors.FgRed, '🚨'); });
    process.on('SIGINT', () => { log('SYSTEM', 'Ctrl+C detected. Exiting script...', Colors.FgYellow, '⚠️'); rl.close(); process.exit(); });

    let privateKeys = [], proxyUrls = [], recipientAddresses = [], faroPools = [];
    try { privateKeys = fs.readFileSync('YourPrivateKey.txt', 'utf8').split('\n').map(line => line.trim()).filter(Boolean); log('CONFIG', `Loaded ${privateKeys.length} private keys.`, Colors.FgCyan, '✅'); } catch (e) { log('ERROR', 'YourPrivateKey.txt not found.', Colors.FgRed, '❌'); process.exit(1); }
    try { proxyUrls = 
    fs.readFileSync('proxy.txt', 'utf8').split('\n').map(line => line.trim()); log('CONFIG', `Loaded ${proxyUrls.length} proxy entries.`, Colors.FgCyan, '✅');
    } catch (e) { log('WARNING', 'proxy.txt not found.', Colors.FgYellow, '⚠️'); }
    try { recipientAddresses = fs.readFileSync('wallets.txt', 'utf8').split('\n').map(line => line.trim()).filter(Boolean); log('CONFIG', `Loaded ${recipientAddresses.length} recipient addresses.`, Colors.FgCyan, '✅'); } catch (e) { log('WARNING', 'wallets.txt not found. Auto Send will be skipped.', Colors.FgYellow, '⚠️'); }
    try {
        const poolsData = fs.readFileSync('pools.json', 'utf8');
        faroPools = JSON.parse(poolsData);
        log('CONFIG', `Loaded ${faroPools.length} pool configurations from pools.json.`, Colors.FgCyan, '✅');
    } catch (e) {
        log('WARNING', 'pools.json not found or is invalid. FaroSwap Add Liquidity will be skipped.', Colors.FgYellow, '⚠️');
    }

    if (privateKeys.length === 0) { log('ERROR', 'No valid accounts to process.', Colors.FgRed, '❌'); process.exit(1); }
    
    const accountsToProcess = privateKeys.map((pk, i) => ({
        pk,
        proxyAgent: proxyUrls[i] ? new HttpsProxyAgent(proxyUrls[i]) : null,
        accountIndex: i,
    }));
    log('SYSTEM', 'Welcome! Please configure the tasks for the first run.', Colors.Bright, '👋');
    const operationParams = { swapParams: {}, lpParams: {}, faroPools };
    const settings = {};
    const minSecs = await askQuestion({ message: `${Colors.FgBlue}⏳ Enter MINIMUM delay between TXs (seconds): ${Colors.Reset}` });
    const maxSecs = await askQuestion({ message: `${Colors.FgBlue}⏳ Enter MAXIMUM delay between TXs (seconds): ${Colors.Reset}` });
    operationParams.minDelayMs = parseInt(minSecs) * 1000;
    operationParams.maxDelayMs = parseInt(maxSecs) * 1000;
    if (isNaN(operationParams.minDelayMs) || isNaN(operationParams.maxDelayMs) || operationParams.maxDelayMs < operationParams.minDelayMs) { log('ERROR', 'Invalid delay settings.', Colors.FgRed, '❌'); process.exit(1); }

    const autoSendPrompt = `${Colors.FgBlue}📤 Perform Auto Send task?\n   1. Yes\n   2. No\nEnter number: ${Colors.Reset}`;
    const autoSendAnswer = await askQuestion({ message: autoSendPrompt });
    operationParams.runAutoSend = autoSendAnswer.trim() === '1';
    if (operationParams.runAutoSend) {
        if (recipientAddresses.length === 0) { log('ERROR', 'Cannot run Auto Send, wallets.txt is empty.', Colors.FgRed, '❌'); operationParams.runAutoSend = false; } else {
            const sendCountInput = (await askQuestion({ message: `${Colors.FgBlue}🔁 How many wallets to send to? (Enter a number or 'all'): ${Colors.Reset}` })).toLowerCase();
            if (sendCountInput === 'all') {
                settings.RECIPIENT_COUNT = 'all';
            } else {
                const num = parseInt(sendCountInput);
                if (isNaN(num) || num <= 0 || num > recipientAddresses.length) {
                    log('ERROR', `Invalid number. Please enter 'all' or a number between 1 and ${recipientAddresses.length}.`, Colors.FgRed, '❌');
                    process.exit(1);
                }
                settings.RECIPIENT_COUNT = num;
            }
            const minAmount = parseFloat(await askQuestion({ message: `${Colors.FgBlue}💸 Enter MINIMUM PHRS amount to send: ${Colors.Reset}` }));
            const maxAmount = parseFloat(await askQuestion({ message: `${Colors.FgBlue}💸 Enter MAXIMUM PHRS amount to send: ${Colors.Reset}` }));
            if (isNaN(minAmount) || isNaN(maxAmount) || minAmount <= 0 || maxAmount < minAmount) { log('ERROR', 'Invalid send amount.', Colors.FgRed, '❌'); process.exit(1); }
            settings.AMOUNT_SEND = [minAmount, maxAmount];
        }
    }
    operationParams.settings = settings;
    operationParams.recipientAddresses = recipientAddresses;
    const swapOptions = ['faroswap', 'zenithswap', 'both', 'none'];
    const swapChoices = swapOptions.map((opt, i) => `   ${i + 1}. ${opt.charAt(0).toUpperCase() + opt.slice(1)}`).join('\n');
    const swapSelectionPrompt = `${Colors.FgBlue}💱 Select DEX for swapping:\n${swapChoices}\nEnter number: ${Colors.Reset}`;
    const swapModeIndex = parseInt(await askQuestion({ message: swapSelectionPrompt })) - 1;
    if (isNaN(swapModeIndex) || !swapOptions[swapModeIndex]) {
        log('ERROR', 'Invalid DEX selection.', Colors.FgRed, '❌');
        process.exit(1);
    }
    operationParams.swapMode = swapOptions[swapModeIndex];

    async function getSwapParams(dexName, dexConfig) {
        const fromToken = 'PHRS';
        const availableTokens = Object.keys(dexConfig.TOKENS).filter(s => s !== 'PHRS' && s !== 'WPHRS');
        const tokenChoices = availableTokens.map((t, i) => `   ${i + 1}. ${t}`).join('\n');
        const tokenSelectionPrompt = `${Colors.FgBlue}[${dexName}] Swap ${fromToken} to which token?\n${tokenChoices}\nEnter number: ${Colors.Reset}`;
        const tokenIndex = parseInt(await askQuestion({ message: tokenSelectionPrompt })) - 1;
        if (isNaN(tokenIndex) || !availableTokens[tokenIndex]) {
            log('ERROR', 'Invalid token selection.', Colors.FgRed, '❌');
            process.exit(1);
        }
        const toToken = availableTokens[tokenIndex];
        log('SYSTEM', `Selected token: ${toToken}`, Colors.FgCyan, '👍');
        const amount = await askQuestion({ message: `${Colors.FgBlue}[${dexName}] Enter amount of ${fromToken} to swap: ${Colors.Reset}` });
        if (isNaN(amount) || parseFloat(amount) <= 0) { log('ERROR', 'Invalid amount.', Colors.FgRed, '❌'); process.exit(1); }
        const count = parseInt(await askQuestion({ message: `${Colors.FgBlue}[${dexName}] How many swaps on ${dexName}?: ${Colors.Reset}` }));
        if (isNaN(count) || count < 1) { log('ERROR', 'Invalid swap count.', Colors.FgRed, '❌'); process.exit(1); }
        return { fromToken, toToken, amount, count };
    }

    if (operationParams.swapMode === 'faroswap') {
        operationParams.swapParams.FAROSWAP = await getSwapParams('Faroswap', DEX_CONFIGS.FAROSWAP);
    } else if (operationParams.swapMode === 'zenithswap') {
        operationParams.swapParams.ZENITHSWAP = await getSwapParams('Zenithswap', DEX_CONFIGS.ZENITHSWAP);
    } else if (operationParams.swapMode === 'both') {
        log('SYSTEM', 'Configuring Faroswap...', Colors.FgMagenta, '1️⃣');
        operationParams.swapParams.FAROSWAP = await getSwapParams('Faroswap', DEX_CONFIGS.FAROSWAP);
        log('SYSTEM', 'Configuring Zenithswap...', Colors.FgMagenta, '2️⃣');
        operationParams.swapParams.ZENITHSWAP = await getSwapParams('Zenithswap', DEX_CONFIGS.ZENITHSWAP);
    }

    const lpOptions = ['faroswap', 'zenithswap', 'both', 'none'];
    const lpChoices = lpOptions.map((opt, i) => `   ${i + 1}. ${opt.charAt(0).toUpperCase() + opt.slice(1)}`).join('\n');
    const lpSelectionPrompt = `${Colors.FgBlue}💧 Select DEX for Add Liquidity:\n${lpChoices}\nEnter number: ${Colors.Reset}`;
    const lpModeIndex = parseInt(await askQuestion({ message: lpSelectionPrompt })) - 1;
    if (isNaN(lpModeIndex) || !lpOptions[lpModeIndex]) {
        log('ERROR', 'Invalid DEX selection for LP.', Colors.FgRed, '❌');
        process.exit(1);
    }
    operationParams.lpMode = lpOptions[lpModeIndex];

    async function getLpParams(dexName) {
    let pairChoices, lpPairs;
    if (dexName === 'Faroswap') {
        lpPairs = FAROSWAP_DVM_PAIRS;
        pairChoices = lpPairs.map((p, i) => `   ${i + 1}. ${p.name}`).join('\n');
    } else {
        lpPairs = ZENITH_LP_PAIRS;
        pairChoices = lpPairs.map((p, i) => `   ${i + 1}. ${p.name}`).join('\n');
    }

    const pairSelectionPrompt = `${Colors.FgBlue}[${dexName}-LP] Please select a liquidity pair:\n${pairChoices}\nEnter number: ${Colors.Reset}`;
    const pairIndex = parseInt(await askQuestion({ message: pairSelectionPrompt })) - 1;
    if (isNaN(pairIndex) || !lpPairs[pairIndex]) {
        log('ERROR', 'Invalid pair selection.', Colors.FgRed, '❌');
        process.exit(1);
    }
    const selectedPair = lpPairs[pairIndex];
    log('SYSTEM', `Selected pair: ${selectedPair.name}`, Colors.FgCyan, '👍');
    const token0 = dexName === 'Faroswap' ? selectedPair.base : selectedPair.token0;
    const token1 = dexName === 'Faroswap' ? selectedPair.quote : selectedPair.token1;

    if (dexName === 'Faroswap') {
        console.log('');
        log('INFO', 'IMPORTANT NOTE FOR FAROSWAP (PMM)', Colors.FgYellow, '🔔');
        log('INFO', "1. Ensure the amount is above the pool's minimum requirement (e.g., 0.01).", Colors.FgYellow, '   ');
        log('INFO', '2. Amounts for USDC and USDT MUST BE THE SAME (1:1 ratio) to avoid failed transactions.', Colors.FgYellow, '   ');
        console.log('');
    }

    const amount0 = await askQuestion({ message: `${Colors.FgBlue}[${dexName}-LP] Enter amount for ${token0}: ${Colors.Reset}` });
    const amount1 = await askQuestion({ message: `${Colors.FgBlue}[${dexName}-LP] Enter amount for ${token1}: ${Colors.Reset}` });
    if (isNaN(amount0) || parseFloat(amount0) <= 0 || isNaN(amount1) || parseFloat(amount1) <= 0) {
        log('ERROR', 'Invalid amount for liquidity.', Colors.FgRed, '❌');
        process.exit(1);
    }

    const count = parseInt(await askQuestion({ message: `${Colors.FgBlue}[${dexName}-LP] How many times to add liquidity?: ${Colors.Reset}` }));
    if (isNaN(count) || count < 1) {
        log('ERROR', 'Invalid transaction count for liquidity.', Colors.FgRed, '❌');
        process.exit(1);
    }

    if (dexName === 'Faroswap') {
        return { baseToken: token0, quoteToken: token1, baseAmount: amount0, quoteAmount: amount1, count };
    } else {
        return { token0, token1, amount0, amount1, count };
    }
}

    if (operationParams.lpMode === 'faroswap') {
        operationParams.lpParams.FAROSWAP = await getLpParams('Faroswap');
    } else if (operationParams.lpMode === 'zenithswap') {
        operationParams.lpParams.ZENITHSWAP = await getLpParams('Zenithswap');
    } else if (operationParams.lpMode === 'both') {
        log('SYSTEM', 'Configuring FaroSwap Liquidity...', Colors.FgMagenta, '1️⃣');
        operationParams.lpParams.FAROSWAP = await getLpParams('Faroswap');
        log('SYSTEM', 'Configuring ZenithSwap Liquidity...', Colors.FgMagenta, '2️⃣');
        operationParams.lpParams.ZENITHSWAP = await getLpParams('Zenithswap');
    }
    
    log('SYSTEM', 'Configuration saved. These settings will be used for all subsequent daily runs.', Colors.FgGreen, '⚙️');
    let runCount = 0;
    while(true) {
        runCount++;
        log('SYSTEM', `--- Starting Daily Run #${runCount} ---`, Colors.Bright, '☀️');

        const results = await Promise.all(accountsToProcess.map(account => 
            processAccountOperation(account, operationParams).catch(err => {
                const address = new ethers.Wallet(account.pk).address;
                log('SYSTEM', `Caught an unhandled error for account ${address}: ${err.message}`, Colors.FgRed, '🚨');
                return { success: false, address: address, error: `Unhandled system error: ${err.message}` };
            })
        ));
        log('SUMMARY', '\n--- Account Processing Summary ---', Colors.Bright);
        results.forEach(res => { 
            if (res && res.address) {
                if (res.success) { 
                    log('SUMMARY', `Account ${res.address}: ✅ SUCCESS`, Colors.FgGreen); 
                } else { 
                    log('SUMMARY', `Account ${res.address}: ❌ FAILED - ${res.error}`, Colors.FgRed); 
                }
            } else {
                log('SUMMARY', `An unknown result was found.`, Colors.FgRed, '❓')
            }
        });
        log('SUMMARY', '----------------------------------', Colors.Bright);
        
        log('SYSTEM', 'Check all your task points here: https://pharoshub.xyz/', Colors.Bright, '🎉');
        
        await runCountdown(DAILY_RUN_INTERVAL_HOURS);
    }
})();