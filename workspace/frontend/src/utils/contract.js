import { ethers, MaxUint256 } from 'ethers';
import addresses from './deployed-addresses.json';
import abis from './contract-abis.json';

export const getContracts = async (signer) => {
  try {
    if (!signer) {
      throw new Error("No signer provided");
    }

    const signerAddress = await signer.getAddress();
    console.log("Signer address:", signerAddress);

    // Initialize token contracts
    const tokenContracts = {};
    for (const [name, address] of Object.entries(addresses.tokens)) {
      tokenContracts[name] = {
        contract: new ethers.Contract(address, abis.NewToken, signer),
        address: address
      };
    }

    // Initialize pool contracts
    const poolContracts = {};
    for (const [name, address] of Object.entries(addresses.pools)) {
      poolContracts[name] = {
        contract: new ethers.Contract(address, abis.Pool, signer),
        address: address
      };
    }

    const contracts = {
      tokens: tokenContracts,
      pools: poolContracts,
      factory: {
        contract: new ethers.Contract(addresses.factory, abis.Factory, signer),
        address: addresses.factory
      }
    };

    console.log("Contracts initialized with addresses:", {
      tokens: Object.fromEntries(
        Object.entries(tokenContracts).map(([name, token]) => [name, token.address])
      ),
      pools: Object.fromEntries(
        Object.entries(poolContracts).map(([name, pool]) => [name, pool.address])
      ),
      factory: contracts.factory.address
    });

    return contracts;
  } catch (error) {
    console.error("Error in getContracts:", error);
    throw error;
  }
};

export const getTokenBalances = async (contracts, address) => {
  try {
    const balances = {};
    for (const [name, token] of Object.entries(contracts.tokens)) {
      const balance = await token.contract.balanceOf(address);
      balances[name] = ethers.formatEther(balance);
    }
    return balances;
  } catch (error) {
    console.error("Error in getTokenBalances:", error);
    throw error;
  }
};

export const getPoolInfo = async (contracts, poolName) => {
  try {
    const pool = contracts.pools[poolName];
    if (!pool) {
      throw new Error(`Pool ${poolName} not found`);
    }

    const balances = {};
    for (const [tokenName, token] of Object.entries(contracts.tokens)) {
      const balance = await token.contract.balanceOf(pool.address);
      balances[tokenName] = ethers.formatEther(balance);
    }

    return balances;
  } catch (error) {
    console.error("Error in getPoolInfo:", error);
    throw error;
  }
};

export const getAmountOut = async (contracts, poolName, tokenIn, amountIn, tokenOut) => {
  try {
    const pool = contracts.pools[poolName];
    if (!pool) {
      throw new Error(`Pool ${poolName} not found`);
    }

    const amountInWei = ethers.parseEther(amountIn.toString());
    const amountOutWei = await pool.contract.getAmountOut(
      contracts.tokens[tokenIn].address,
      amountInWei,
      contracts.tokens[tokenOut].address
    );
    return ethers.formatEther(amountOutWei);
  } catch (error) {
    console.error("Error in getAmountOut:", error);
    throw error;
  }
};

export const swapTokens = async (contracts, poolName, tokenIn, amountIn, tokenOut) => {
  try {
    const pool = contracts.pools[poolName];
    if (!pool) {
      throw new Error(`Pool ${poolName} not found`);
    }

    const amountInWei = ethers.parseEther(amountIn.toString());
    
    // Approve tokenIn
    const tokenInContract = contracts.tokens[tokenIn].contract;
    await tokenInContract.approve(pool.address, amountInWei);
    
    // Execute swap
    const tx = await pool.contract.swap(
      contracts.tokens[tokenIn].address,
      amountInWei,
      contracts.tokens[tokenOut].address
    );
    await tx.wait();
    return tx;
  } catch (error) {
    console.error("Error in swapTokens:", error);
    throw error;
  }
};

export const addLiquidity = async (contracts, poolName, tokenAddresses, amounts) => {
  try {
    const pool = contracts.pools[poolName];
    if (!pool) {
      throw new Error(`Pool ${poolName} not found`);
    }

    // Approve all tokens
    for (let i = 0; i < tokenAddresses.length; i++) {
      const tokenName = Object.entries(contracts.tokens).find(
        ([_, token]) => token.address === tokenAddresses[i]
      )[0];
      await contracts.tokens[tokenName].contract.approve(pool.address, amounts[i]);
    }

    const tx = await pool.contract.addLiquidity(tokenAddresses, amounts);
    await tx.wait();
    return tx;
  } catch (error) {
    console.error("Error in addLiquidity:", error);
    throw error;
  }
};

export const withdrawingliquidity = async (contracts, poolName, tokenAddresses, amounts) => {
  try {
    const pool = contracts.pools[poolName];
    if (!pool) {
      throw new Error(`Pool ${poolName} not found`);
    }

    // Approve all tokens
    for (let i = 0; i < tokenAddresses.length; i++) {
      const tokenName = Object.entries(contracts.tokens).find(
        ([_, token]) => token.address === tokenAddresses[i]
      )[0];
      await contracts.tokens[tokenName].contract.approve(pool.address, amounts[i]);
    }

    const tx = await pool.contract.withdrawingliquidity(tokenAddresses, amounts);
    await tx.wait();
    return tx;
  } catch (error) {
    console.error("Error in withdrawingliquidity:", error);
    throw error;
  }
};