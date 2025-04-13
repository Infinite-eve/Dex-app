# Project Introduction
This project implements a Liquidity Pool (Pool) supporting three ERC20 tokens, based on the Automated Market Maker (AMM) model, and supports the following core functionalities:
## ​Main Functions​​
### Multi-Token & Multi-LiquidityPool
Three Liquidity Pools

Each pool contains 2-3 tokens
### ​Liquidity Management
AMM in Multi-Token Pools Applications

Slippage Protection Mechanism
### ​Transaction Fee Design
Transaction Fee Mechanism

LP Incentive Mechanism
### Smart Routing Across Pools
Path Traversal in Trades

Optimal Path Selection

# Operational Guidelines
## 1.Environmental Preparation
### (1) Execution method Terminal into the bash, add execution privileges to scripts
```
chmod +x setup.sh
```
### (2) Running scripts
```
./setup.sh
```
## 2.Front-end Operation
### Switch to frontend
```
cd workspace/frontend
npm run start
``` 

## 3.Back-end Operation
### (1)Switch to workspace, open node
```
cd workspace
npx hardhat node
```
### (2)Configuring metamask
Connect to http://localhost:8545 (Hardhat local node).

Load tokens into the wallet at the token address in workspace/frontend/deployed-address.
### (3)One-click deployment + transfers
Change the addresses in transferDF.js, transferALPHA.js, transferBETA.js, and transferGAMMA.js in the scripts folder to your own metamask address, open the Git bash terminal, and run the following commands in the terminal:
```
sh scripts/script.sh
```

## 4.Test Program Operation
### Test each function for completeness
```
npx hardhat run test/Test File Name.js --network localhost
e.g. npx hardhat run test/Swap.test.js --network localhost //Testing the functionality related to transaction fees and liquidity withdrawals
```

# Troubleshooting Solution
On-demand search with some troubleshooting commands, and test commands

## 1.Clear the front-end cache to avoid front-end contracts not being updated:
```
rm -rf node_modules/.cache
```
## 2.Clear node:
**HighLight**: It is recommended to clear the node after each code tweak, otherwise there will be unknown errors

After emptying the node, the cache files located in artifacts will also be gone.
```
npx hardhat clean
```

## 3.Transfer the test tokens to your address (you need to change the receiving address in the file first)
```
npx hardhat run scripts/transferDF.js --network localhost
```
```
npx hardhat run scripts/transferALPHA.js --network localhost
```
```
npx hardhat run scripts/transferBETA.js --network localhost
```
```
npx hardhat run scripts/transferGAMMA.js --network localhost
```
## 4.Initial recharge of the liquidity pool
Can run command backend for mobility recharge, default is 10 ALPHA, 20 BETA, 30 GAMMA
```
npx hardhat run scripts/anotherusr_add.js --network localhost
```
