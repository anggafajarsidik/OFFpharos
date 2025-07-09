import { ethers } from 'ethers';
import fetch from 'node-fetch';

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

const Colors = { Reset: "\x1b[0m", Bright: "\x1b[1m", FgRed: "\x1b[31m", FgGreen: "\x1b[32m", FgYellow: "\x1b[33m", FgBlue: "\x1b[34m" };

function log(prefix, message, color = Colors.Reset, symbol = '➡️') {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${color}${symbol} [${timestamp}] ${prefix}: ${message}${Colors.Reset}`);
}

export async function buildFallbackProvider(rpcUrls, chainId, proxyAgent = null, accountFullAddress = 'UNKNOWN') {

    const customFetch = async (url, options) => {
        const fetchOptions = options || {};
        
        if (!fetchOptions.headers) {
            fetchOptions.headers = {};
        }

        fetchOptions.headers['Origin'] = 'https://testnet.pharosnetwork.xyz';
        
        if (proxyAgent) {
            fetchOptions.agent = proxyAgent;
        }

        return fetch(url, fetchOptions);
    };

    for (const url of rpcUrls) {
        const staticNetwork = ethers.Network.from(chainId);
        const provider = new ethers.JsonRpcProvider(url, undefined, {
            staticNetwork,
            fetchFunc: customFetch,
        });

        const originalSend = provider.send;
        provider.send = async (method, params) => {
            const maxRetries = 5;
            const initialDelay = 2000;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    return await originalSend.call(provider, method, params);
                } catch (error) {
                    throw error;
                }
            }
        };

        const connectionMaxRetries = 3;
        const connectionDelay = 2500;
        for (let attempt = 1; attempt <= connectionMaxRetries; attempt++) {
            try {
                log('RPC', `[Attempt ${attempt}/${connectionMaxRetries}] Connecting ${accountFullAddress.slice(0, 8)} to ${url}...`, Colors.FgBlue);
                await provider.getBlockNumber();
                log('RPC', `Successfully connected ${accountFullAddress.slice(0, 8)} to ${url}`, Colors.FgGreen, '✅');
                return provider;
            } catch (error) {
                log('RPC', `Connection attempt ${attempt} failed for ${url}: ${error.message}`, Colors.FgYellow, '⚠️');
                if (attempt < connectionMaxRetries) {
                    await new Promise(r => setTimeout(r, connectionDelay));
                } else {
                    log('RPC', `Permanently failed to connect to ${url} after ${connectionMaxRetries} attempts.`, Colors.FgRed, '❌');
                    break;
                }
            }
        }
    }

    throw new Error(`Failed to connect to ANY provider for ${accountFullAddress} after all retries.`);
}
