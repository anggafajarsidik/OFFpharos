<div align="center">

# 🤖 Pharos Testnet Bot 🤖

**A comprehensive Node.js bot for automating tasks on the Pharos Testnet.**

</div>

This bot is designed for resilience and efficiency, featuring advanced error handling, automatic gas fee adjustments, and multi-protocol interactions to maximize your testnet participation.

---

## ✨ Features

This bot is packed with features to automate a wide range of activities across the Pharos ecosystem.

#### Core Features
* **Proxy Support**: Assign a unique proxy to each account for enhanced operational security.
* **Advanced Error Handling**: Implements robust retry mechanisms for both RPC requests and failed transactions.
* **Automatic Gas Bumping**: Intelligently increases gas fees (`GAS_FEE_MULTIPLIER`) to ensure your transactions are prioritized and confirmed quickly.
* **Scheduled Daily Runs**: Automatically repeats all configured tasks every 24 hours.

#### General Pharos Tasks
* **Daily Faucet Claim**: Never miss a daily token claim from the Pharos faucet.
* **Daily Check-in**: Performs the daily check-in to accumulate points automatically.
* **Auto-Send**: Distributes PHRS tokens from your accounts to a list of recipient wallets.

#### DEX Interactions
* **Swapping**: Execute token swaps on both **FaroSwap** and **ZenithSwap**.
* **Liquidity Provision**: Add liquidity to pre-existing pools on **FaroSwap (DVM)** and **ZenithSwap (V3)**.

#### Protocol-Specific Interactions
* **OpenFi Protocol**:
    * Mint all available test assets from the OpenFi faucet.
    * Deposit native PHRS.
    * Supply various tokens as collateral.
    * Borrow assets against your supplied collateral.
    * Withdraw your assets from the protocol.
* **Brokex Protocol**:
    * Claim from the daily USDT faucet.
    * Automatically execute random Long/Short trades with a configurable amount and frequency.
* **ZentraFi Protocol**:
    * Unwrap WPHRS back to native PHRS.
* **Gotchipus NFT**:
    * Mint the Gotchipus NFT. The bot keeps a record (`minted_gotchipus.txt`) to avoid minting on the same wallet twice.

---

## 📋 Prerequisites

* [Node.js](https://nodejs.org/) (v18.x or higher is recommended)
* npm (included with Node.js)

## 🚀 Setup & Installation

1.  **Clone the Repository**
    Open your terminal and run the following commands:
    ```bash
    git clone [https://github.com/anggafajarsidik/OFFpharos](https://github.com/anggafajarsidik/OFFpharos)
    cd OFFpharos
    ```

2.  **Install Dependencies**
    Execute the command below to install all required packages:
    ```bash
    npm install
    ```

3.  **Create Configuration Files**
    Create the following `.txt` and `.json` files in the project's root directory.

    * `YourPrivateKey.txt`
        > One private key per line.
        > ```
        > 0xabcde...
        > 0x12345...
        > ```

    * `proxy.txt`
        > One proxy URL per line in `http://user:pass@host:port` format. **The order must correspond to the private keys**. Leave a line blank if an account does not use a proxy.
        > ```
        > [http://user1:pass1@proxy1.com:8080](http://user1:pass1@proxy1.com:8080)
        >
        > [http://user3:pass3@proxy3.com:8080](http://user3:pass3@proxy3.com:8080)
        > ```

    * `wallets.txt`
        > One recipient wallet address per line. This file is used for the **Auto-Send** feature.
        > ```
        > 0x...
        > 0x...
        > ```
    * `pools.json`
        > A JSON file containing your Faroswap DVM pool addresses. See the detailed guide below.

---

### 📄 How to Configure `pools.json`

The `pools.json` file is essential for the "Add Liquidity" feature on Faroswap. It requires you to provide the smart contract address for each of your DVM liquidity pools.

#### **Step 1: Create a Pool on the Faroswap Website**
The script **adds** liquidity to **pre-existing pools**; it does not create them.
1.  Navigate to the official Faroswap website and connect your wallet.
2.  Go to the **Liquidity** or **Pools** section.
3.  Click **"Create Pool"** and follow the on-screen instructions.

#### **Step 2: Find Your Pool's Contract Address**
1.  On the Faroswap website, go to the **"My Pools (PMM)"** tab.
2.  **Copy** the unique address for each pool you have created.

#### **Step 3: Format the `pools.json` File**
* The file must be a JSON **array** `[ ... ]` containing **objects** `{ ... }`.
* Each object `{}` represents the configuration for a **single wallet**.
* The order of objects **must exactly match** the order of your private keys.

**Example `pools.json`:**
```json
[
  {
    "USDC_USDT": "0xWallet1_USDC_USDT_PoolAddress",
    "USDT_USDC": "0xWallet1_USDT_USDC_PoolAddress"
  },
  {
    "USDC_USDT": "0xWallet2_USDC_USDT_PoolAddress"
  }
]
```

---

## ▶️ Usage

1.  **Run the Script**
    From your terminal, execute:
    ```bash
    node main.js
    ```
2.  **Follow the Interactive Prompts**
    On the first run, the script will guide you through a one-time setup to configure which tasks to perform, amounts, frequencies, etc. These settings are saved for all subsequent daily runs.

---

## ⚙️ Advanced Configuration

You can fine-tune the script's behavior by editing the constants at the top of `main.js`.

| Constant                   | Description                                                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `GAS_FEE_MULTIPLIER`       | A multiplier for gas fees. Default: `2.5`. This sets the final fee to **250%** of the network's suggested fee for higher transaction priority. |
| `DAILY_RUN_INTERVAL_HOURS` | The time interval (in hours) before the script runs again automatically. Default: `24`.                                                 |
| `MINIMUM_LP_TOP_UP_SWAP`   | The minimum native token amount required to trigger an auto-swap when providing liquidity. Default: `"0.001"`.                                 |

## ⚠️ Disclaimer

* This script is provided "as-is" for educational purposes only. The author and contributors are not responsible for any damages, losses, or legal issues arising from its use.
* **Use at your own risk.** You are solely responsible for your actions and any potential loss of funds.
* **NEVER SHARE YOUR PRIVATE KEYS.** Keep your `YourPrivateKey.txt` file secure and do not commit it to any public repository.

```
