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