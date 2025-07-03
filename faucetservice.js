import fs from "fs";
import path from "path";
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { ethers } from "ethers";
import { jwtDecode } from "jwt-decode";
import AsyncLock from "async-lock";
import UserAgent from 'user-agents';

const lock = new AsyncLock();

const faucetInternalSettings = {
  DELAY_BETWEEN_REQUESTS: [3, 20], 
};
async function sleep(seconds = null) {
  if (seconds && typeof seconds === "number") return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  let min = faucetInternalSettings.DELAY_BETWEEN_REQUESTS[0];
  let max = faucetInternalSettings.DELAY_BETWEEN_REQUESTS[1];
  if (seconds && Array.isArray(seconds)) {
    min = seconds[0];
    max = seconds[1]; 
  }
    min = min || faucetInternalSettings.DELAY_BETWEEN_REQUESTS[0];
    max = max || faucetInternalSettings.DELAY_BETWEEN_REQUESTS[1];
return await new Promise((resolve) => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    setTimeout(resolve, delay * 1000);
  });
}

function isTokenExpired(token) {
  if (!token) return { isExpired: true, expirationDate: new Date().toLocaleString() };
  try {
    const payload = jwtDecode(token);
if (!payload) return { isExpired: true, expirationDate: new Date().toLocaleString() };
    const now = Math.floor(Date.now() / 1000);
const expirationDate = payload.exp ? new Date(payload.exp * 1000).toLocaleString() : "Infinity";
    const isExpired = now > payload.exp;
return { isExpired, expirationDate };
  } catch (error) {
    return { isExpired: true, expirationDate: new Date().toLocaleString() };
}
}

function getRandomNumber(min, max, fix = 2) {
  return Number((Math.random() * (max - min) + min).toFixed(fix));
}

// MODIFIED: This function is now more robust against corrupted/empty JSON files.
async function saveJson(id, value, filename) {
  await lock.acquire("fileLock", async () => {
    const filePath = path.join(process.cwd(), filename);
    try {
      let jsonData = {};
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf8");
        // Only parse if the file is not empty
        if (data && data.trim() !== '') {
            try {
                jsonData = JSON.parse(data);
            } catch (parseError) {
                console.error(`Error parsing existing ${filename}, will overwrite it. Error: ${parseError.message}`);
                jsonData = {}; // Start fresh if parsing fails
            }
        }
      }
      jsonData[id] = value;
      fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 4));
    } catch (error) {
      console.error(`Error saving JSON to ${filename}: ${error.message}`);
    }
  });
}

const baseHeaders = {
  Accept: "*/*",
  "Accept-Encoding": "gzip, deflate, br",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  Origin: "https://testnet.pharosnetwork.xyz",
  Referer: "https://testnet.pharosnetwork.xyz/",
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "Cache-Control": "no-cache",
};

export class FaucetClient {
  constructor(accountData, accountIndex, proxy, baseURL, walletInstance, providerInstance, logFunction) {
    this.baseURL = baseURL;
    this.accountIndex = accountIndex;
    this.proxy = proxy;
    this.log = logFunction;
    this.session_name = accountData.address;
    this.token = null;
    this.localStorage = {};
    this.wallet = walletInstance;
    this.provider = providerInstance;

    const userAgent = new UserAgent();
    this.headers = {
        ...baseHeaders,
        'User-Agent': userAgent.toString()
    };
    
    this.axiosInstance = axios.create({
        timeout: 120000,
        headers: this.headers,
        ...(this.proxy ? { httpsAgent: new HttpsProxyAgent(this.proxy), httpAgent: new HttpsProxyAgent(this.proxy) } : {}),
    });
}

  // MODIFIED: This function is now more robust against corrupted/empty JSON files.
  async #load_localStorage() {
    const filePath = path.join(process.cwd(), "localStorage.json");
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify({}, null, 4));
            this.localStorage = {};
            return;
        }

        const data = fs.readFileSync(filePath, "utf8");
        if (data && data.trim() !== '') {
            this.localStorage = JSON.parse(data);
        } else {
            // If the file is empty, treat it as a new empty storage
            this.localStorage = {};
        }
    } catch (error) {
        this.log(`Error loading or creating localStorage.json: ${error.message}`, "error");
        this.localStorage = {}; // Default to an empty object on any error
    }
  }

  async makeRequest(
    url,
    method,
    data = {},
    options = {
      retries: 2,
      isAuth: false,
      extraHeaders: {},
      refreshToken: null,
    }
  ) {
    const { retries, isAuth, extraHeaders } = options;
    const currentHeaders = {
      ...this.headers,
      ...extraHeaders,
    };
    if (this.token && !isAuth) {
      currentHeaders["authorization"] = `Bearer ${this.token}`;
    }

    let currRetries = 0;
    do {
      try {
        const response = await this.axiosInstance({
          method,
          url: `${url}`,
          headers: currentHeaders,
          ...(method.toLowerCase() !== "get" ? { data: data } : {}),
        });
        if (response?.data?.code == 0 || response?.data?.msg == "ok") {
          return { success: true, data: response.data.data || response.data, status: response.status };
        } else {
          return { success: false, data: response.data, error: response.data?.msg || response.data?.error || response.data, status: response.status };
        }
      } catch (error) {
        const errorMessage = error?.response?.data?.error || error?.response?.data?.msg || error.message;
        const errorStatus = error?.response?.status || 0;
        this.log(`Request failed (${currRetries + 1}/${retries + 1}): ${url} | ${JSON.stringify(errorMessage)}`, "warning");
        if (errorStatus === 401 && !isAuth) { 
          this.log(`Token invalid or expired, trying to get a new token...`, "warning");
            const newToken = await this.getValidToken(true); 
          if (newToken) {
            this.token = newToken;
                return this.makeRequest(url, method, data, options); 
          } else {
            this.log(`Failed to get a new token after 401.`, "error");
                return { success: false, status: errorStatus, error: errorMessage, data: null };
            }
        } else if (errorStatus === 400) {
          this.log(`Invalid request for ${url}, there might be a new update from the server!`, "error");
            return { success: false, status: errorStatus, error: errorMessage, data: null };
        } else if (errorStatus === 429) {
          this.log(`Rate limit exceeded, waiting 30 seconds to retry`, "warning");
            await sleep(30);
        } else {
          await sleep(getRandomNumber(faucetInternalSettings.DELAY_BETWEEN_REQUESTS[0], faucetInternalSettings.DELAY_BETWEEN_REQUESTS[1]));
        }
        currRetries++;
        if (currRetries > retries) {
          return { success: false, status: errorStatus, error: errorMessage, data: null };
        }
      }
    } while (currRetries <= retries);
    return { success: false, status: 0, error: 'Request failed after all retries', data: null };
}

  async auth() {
    const signedMessage = await this.wallet.signMessage("pharos");
    return this.makeRequest(`${this.baseURL}/user/login?address=${this.wallet.address}&signature=${signedMessage}`, "post", null, { isAuth: true });
  }

  async getFaucetStatus() {
    return this.makeRequest(`${this.baseURL}/faucet/status?address=${this.wallet.address}`, "get");
  }

  async faucet() {
    return this.makeRequest(`${this.baseURL}/faucet/daily?address=${this.wallet.address}`, "post");
  }

  async getValidToken(isNew = false) {
    await this.#load_localStorage();
    const existingTokenData = this.localStorage[this.session_name];
    let existingToken = null;
    if (existingTokenData) {
        try {
            const parsedData = JSON.parse(existingTokenData);
            existingToken = parsedData.jwt;
        } catch (e) {
            this.log(`Failed to parse token from localStorage for ${this.session_name}: ${e.message}`, "warning");
        }
    }

    const { isExpired: isExp, expirationDate } = isTokenExpired(existingToken);
    this.log(`Access token status: ${isExp ? "Expired" : "Valid"} | Access token exp: ${expirationDate}`, isExp ? "warning" : "success");
    if (existingToken && !isNew && !isExp) {
      this.log("Using valid token", "success");
      this.token = existingToken;
        return existingToken;
    }

    this.log("No token found or expired, trying to get a new token...", "warning");
    const loginRes = await this.auth();
    if (!loginRes.success) {
      this.log(`Authentication failed: ${JSON.stringify(loginRes.error || loginRes.data)}`, "error");
      return null;
    }
    const newToken = loginRes.data;
    if (newToken?.jwt) {
      this.token = newToken.jwt;
      await saveJson(this.session_name, JSON.stringify(newToken), "localStorage.json");
      return newToken.jwt;
    }
    this.log("Could not get a new token...", "warning");
    return null;
  }

  async handleFaucet() {
    this.log(`Initiating claim process...`, "custom");
    const resGetPHRS = await this.getFaucetStatus();
    if (resGetPHRS.success && resGetPHRS.data?.is_able_to_faucet) {
      this.log("Attempting daily PHRS claim...", "info");
        const resPHRS = await this.faucet();
      if (resPHRS.success) {
        this.log(`PHRS claim successful!`, "success");
        } else {
        this.log(`PHRS claim failed: ${JSON.stringify(resPHRS.error || resPHRS.data)}`, "warning");
        }
    } else {
      if (resGetPHRS.success && resGetPHRS.data?.avaliable_timestamp) {
        this.log(`Next PHRS claim available on: ${new Date(resGetPHRS.data?.avaliable_timestamp * 1000).toLocaleString()}`, "warning");
        } else {
        this.log(`PHRS claim not available or failed to get status: ${JSON.stringify(resGetPHRS.error || resGetPHRS.data)}`, "warning");
        }
    }
  }

  async runFaucetForAccount() {
    await this.handleFaucet();
  }
}
