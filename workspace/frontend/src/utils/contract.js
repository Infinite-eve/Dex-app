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

<<<<<<< Updated upstream
      const token0 = new ethers.Contract(addresses.token0, abis.NewToken, signer);
      const token1 = new ethers.Contract(addresses.token1, abis.NewToken, signer);
      const pool = new ethers.Contract(addresses.pool, abis.Pool, signer);

      const contracts = {
          token0: {
              contract: token0,
              address: addresses.token0
          },
          token1: {
              contract: token1,
              address: addresses.token1
          },
          pool: {
              contract: pool,
              address: addresses.pool
          }
=======
    // Initialize token contracts
    const tokenContracts = {};
    for (const [name, address] of Object.entries(addresses.tokens)) {
      tokenContracts[name] = {
        contract: new ethers.Contract(address, abis.NewToken, signer),
        address: address
>>>>>>> Stashed changes
      };
    }

<<<<<<< Updated upstream
      console.log("Contracts initialized with addresses:", {
          token0: contracts.token0.address,
          token1: contracts.token1.address,
          pool: contracts.pool.address
      });
=======
    // Initialize pool contracts
    const poolContracts = {};
    for (const [name, address] of Object.entries(addresses.pools)) {
      poolContracts[name] = {
        contract: new ethers.Contract(address, abis.Pool, signer),
        address: address
      };
    }
>>>>>>> Stashed changes

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
<<<<<<< Updated upstream
    try {
        const token0Balance = await contracts.token0.contract.balanceOf(address);
        const token1Balance = await contracts.token1.contract.balanceOf(address);
        return {
            token0: ethers.formatEther(token0Balance),
            token1: ethers.formatEther(token1Balance)
        };
    } catch (error) {
        console.error("Error in getTokenBalances:", error);
        throw error;
    }
  };


export const getPoolInfo = async (contracts) => {
  try {
      const token0Balance = await contracts.token0.contract.balanceOf(contracts.pool.address);
      const token1Balance = await contracts.token1.contract.balanceOf(contracts.pool.address);
      
      return {
          token0Balance: ethers.formatEther(token0Balance),
          token1Balance: ethers.formatEther(token1Balance)
      };
=======
  try {
    const balances = {};
    for (const [name, token] of Object.entries(contracts.tokens)) {
      const balance = await token.contract.balanceOf(address);
      balances[name] = ethers.formatEther(balance);
    }
    return balances;
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
export const getRequiredAmount1 = async (contracts, amount0) => {
  try {
      const amount0Wei = ethers.parseEther(amount0.toString());
      const amount1Wei = await contracts.pool.contract.getRequiredAmount1(amount0Wei);
      return ethers.formatEther(amount1Wei);
  } catch (error) {
      console.error("Error in getRequiredAmount1:", error);
      throw error;
=======
    const balances = {};
    for (const [tokenName, token] of Object.entries(contracts.tokens)) {
      const balance = await token.contract.balanceOf(pool.address);
      balances[tokenName] = ethers.formatEther(balance);
    }

    return balances;
  } catch (error) {
    console.error("Error in getPoolInfo:", error);
    throw error;
>>>>>>> Stashed changes
  }
};

export const getAmountOut = async (contracts, poolName, tokenIn, amountIn, tokenOut) => {
  try {
<<<<<<< Updated upstream
      const amountInWei = ethers.parseEther(amountIn.toString());
      
      // Approve tokenIn
      const tokenInContract = contracts[tokenIn].contract;
      await tokenInContract.approve(contracts.pool.address, amountInWei);
      
      // Execute swap
      const tx = await contracts.pool.contract.swap(
          contracts[tokenIn].address,
          amountInWei,
          contracts[tokenOut].address
      );
      await tx.wait();
      return tx;
=======
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
>>>>>>> Stashed changes
  } catch (error) {
    console.error("Error in getAmountOut:", error);
    throw error;
  }
};

<<<<<<< Updated upstream
export const addLiquidity = async (contracts, amount0) => {
  try {
      const amount0Wei = ethers.parseEther(amount0.toString());
      
      // Get required amount of token1
      const amount1Wei = await contracts.pool.contract.getRequiredAmount1(amount0Wei);
      
      // Approve both tokens
      await contracts.token0.contract.approve(contracts.pool.address, amount0Wei);
      await contracts.token1.contract.approve(contracts.pool.address, amount1Wei);
      
      // Add liquidity 
      const tx = await contracts.pool.contract.addLiquidity(amount0Wei);
      await tx.wait();
      return tx;
=======
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
>>>>>>> Stashed changes
  } catch (error) {
    console.error("Error in swapTokens:", error);
    throw error;
  }
};

export const addLiquidity = async (contracts, poolName, tokenAddresses, amounts) => {
  try {
<<<<<<< Updated upstream
    const amount0Wei = ethers.parseEther(amount0.toString());
    const amount1Wei = await contracts.pool.contract.getRequiredAmount1(amount0Wei);

    // Approve both tokens
    await contracts.token0.contract.approve(contracts.pool.address, amount0Wei);
    await contracts.token1.contract.approve(contracts.pool.address, amount1Wei);
    
    // Withdraw liquidity：应该调的是pool.sol中写好的
    const tx = await contracts.pool.contract.withdrawingliquidity(amount0Wei);
=======
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
>>>>>>> Stashed changes
    await tx.wait();
    return tx;
  } catch (error) {
    console.error("Error in withdrawingliquidity:", error);
    throw error;
  }
};