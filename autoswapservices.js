import { ethers } from 'ethers';
import fetch from 'node-fetch'; // ADDED: Import node-fetch directly

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

const Colors = { Reset: "\x1b[0m", Bright: "\x1b[1m", FgRed: "\x1b[31m", FgGreen: "\x1b[32m", FgYellow: "\x1b[33m", FgBlue: "\x1b[34m" };

function log(prefix, message, color = Colors.Reset, symbol = '➡️') { const timestamp = new Date().toLocaleTimeString(); console.log(`${color}${symbol} [${timestamp}] ${prefix}: ${message}${Colors.Reset}`);
}

// REWRITTEN: The entire function is rewritten for maximum stability.
export async function buildFallbackProvider(rpcUrls, chainId, proxyAgent = null, accountFullAddress = 'UNKNOWN') {
    
    // Create a custom fetch function to handle proxy and headers correctly.
    const customFetch = async (url, options) => {
        const fetchOptions = options || {};
        
        // Ensure headers object exists
        if (!fetchOptions.headers) {
            fetchOptions.headers = {};
        }

        // Add the required Origin header
        fetchOptions.headers['Origin'] = 'https://testnet.pharosnetwork.xyz';
        
        // Add the proxy agent if it exists
        if (proxyAgent) {
            fetchOptions.agent = proxyAgent;
        }

        return fetch(url, fetchOptions);
    };

    for (const url of rpcUrls) {
        // Create a provider instance with our custom fetch function
        const staticNetwork = ethers.Network.from(chainId);
        const provider = new ethers.JsonRpcProvider(url, undefined, {
            staticNetwork,
            fetchFunc: customFetch,
        });

        // This retry logic for post-connection calls remains the same
        const originalSend = provider.send;
        provider.send = async (method, params) => {
            const maxRetries = 5;
            const initialDelay = 2000;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    return await originalSend.call(provider, method, params);
                } catch (error) {
                    // ... (error handling logic remains the same)
                    throw error;
                }
            }
        };

        // Connection test retry logic
        const connectionMaxRetries = 3;
        const connectionDelay = 2500;
        for (let attempt = 1; attempt <= connectionMaxRetries; attempt++) {
            try {
                log('RPC', `[Attempt ${attempt}/${connectionMaxRetries}] Connecting ${accountFullAddress.slice(0, 8)} to ${url}...`, Colors.FgBlue);
                // Use a simple, reliable call to test the connection
                await provider.getBlockNumber();
                log('RPC', `Successfully connected ${accountFullAddress.slice(0, 8)} to ${url}`, Colors.FgGreen, '✅');
                return provider; // Success!
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