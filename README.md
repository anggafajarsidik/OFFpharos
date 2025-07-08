# Pharos Testnet Bot

A Node.js bot for automating tasks on the Pharos Testnet, including faucet claims, swaps, and adding liquidity. Built to be resilient with advanced error handling and automatic gas fee adjustments.

## Features

* **Daily Faucet Claim**
* **Daily Check-in**
* **Auto-Send** to multiple wallets
* **Swapping** on FaroSwap & ZenithSwap
* **Add Liquidity** on ZenithSwap
* **Advanced Error Handling** (Retries for RPCs & Transactions)
* **Proxy Support** (Per-account basis)
* **Automatic Gas Fee Bumping** for higher transaction priority

## Prerequisites

* [Node.js](https://nodejs.org/) (v18.x or higher recommended)
* npm (included with Node.js)

## Setup & Installation

1.  **Clone the Repository**
    ```bash
    git clone [YOUR_GITHUB_REPOSITORY_URL]
    cd [PROJECT_FOLDER_NAME]
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Create Configuration Files**
    Create the following `.txt` files in the main project folder:

    * `YourPrivateKey.txt`
        > One private key per line.
        ```
        0xabcde...
        0x12345...
        ```

    * `proxy.txt`
        > One proxy per line in `http://user:pass@host:port` format. The order must match `YourPrivateKey.txt`. Leave a line empty if an account does not use a proxy.
        ```
        [http://user1:pass1@proxy1.com:8080](http://user1:pass1@proxy1.com:8080)
        
        [http://user3:pass3@proxy3.com:8080](http://user3:pass3@proxy3.com:8080)
        ```

    * `wallets.txt`
        > One recipient wallet address per line. Used for the Auto-Send feature.
        ```
        0x...
        0x...
        ```
# How to Configure `pools.json` for Faroswap Liquidity

The `pools.json` file is crucial for the "Add Liquidity" feature on Faroswap. It tells the script the exact smart contract address of the specific liquidity pool you want to add funds to. Each pool you create on the Faroswap platform has its own unique address.

This guide will show you how to find your pool addresses and format the `pools.json` file correctly.

### **Step 1: Create Your Pool on the Faroswap Website**

The script adds liquidity to **pools that you have already created**. It does not create new pools for you.

1.  Go to the official Faroswap website and connect your wallet.
2.  Navigate to the **Liquidity** or **Pools** section.
3.  Click on **"Create Pool"**.
4.  Select the pair of tokens you want to provide liquidity for (e.g., `USDC` and `USDT`).
5.  Follow the prompts to create your new liquidity pool.

**Important**: A `USDC/USDT` pool is a separate contract from a `USDT/USDC` pool. If you want the script to be able to add to both, you must create both on the website.

### **Step 2: Find Your Pool's Contract Address**

Once your pool(s) are created, you need to get their contract addresses.

1.  On the Faroswap website, go to the **"My Pools (PMM)"** tab.
2.  You will see a list of all the liquidity pools associated with your wallet.
3.  Each pool will have its unique address displayed, which is a long string starting with `0x...`.
4.  **Copy** this address. This is the value you will use in `pools.json`.

### **Step 3: Edit the `pools.json` File**

Now, open the `pools.json` file in your text editor and format it according to the examples below.

**Key Rules:**
* The file must be a valid JSON **array** `[ ... ]` containing one or more **objects** `{ ... }`.
* Each object `{}` represents **one wallet**.
* The order of the objects **must exactly match the order** of your private keys in `YourPrivateKey.txt`. The first object is for the first key, the second object for the second key, and so on.
* Inside an object, the "key" must exactly match the pair name you select in the script (e.g., `"USDC_USDT"` or `"USDT_USDC"`).
* The "value" is the pool contract address you copied from the Faroswap website in Step 2.

---

### **Formatting Examples**

#### **Example 1: Single Wallet**

If you have only one wallet in your `YourPrivateKey.txt`, your `pools.json` file should look like this. This example assumes you have created two separate pools for both `USDC/USDT` and `USDT/USDC`.

```json
[
  {
    "USDC_USDT": "0x5fc08688a4b55d93c47e0799b7374237eb6e126d",
    "USDT_USDC": "0x14cfe4aa683184598dad22ef1723133209f5795c"
  }
]
```

#### **Example 2: Multiple Wallets**
```json
[
  {
    "USDC_USDT": "0xPairUSDC/USDTwallet1",
    "USDT_USDC": "0xPairUSDT/USDCwallet1"
  },
  {
    "USDC_USDT": "0xPairUSDC/USDTwallet2",
    "USDT_USDC": "0xPairUSDT/USDCwallet2"
  }
]
```

## Usage

1.  **Run the script from your terminal:**
    ```bash
    node main.js
    ```
2.  **Follow the interactive prompts** to configure the tasks for your session.

## Configuration

You can edit the following constant at the top of `main.js`:
* `GAS_FEE_MULTIPLIER`: Controls how aggressively the gas fee is increased. The default is `2.5` (150% higher than the network's recommendation) for faster transactions.

## ⚠️ Disclaimer

* This script is provided "as-is" for educational purposes only. The author and contributors are not responsible for any damages, losses, or legal issues arising from the use of this script. Users must ensure compliance with local laws and regulations regarding cryptocurrency transactions and blockchain technology.
* **Use at your own risk.** You are fully responsible for your actions and any potential loss of funds.
* **NEVER SHARE YOUR PRIVATE KEYS.** Keep your `YourPrivateKey.txt` file secure and do not commit it to any public repository.

Use at your own risk..
