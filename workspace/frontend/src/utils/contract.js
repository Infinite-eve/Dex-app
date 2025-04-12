import { ethers,MaxUint256 } from 'ethers';
import addresses from './deployed-addresses.json'; // Import addresses from deployed contract addresses
import abis from './contract-abis.json'; // Import ABIs from deployed contract ABIs

export const getContracts = async (signer, selectedPoolId = 'pool1') => {
  try {
      if (!signer) {
          throw new Error("No signer provided");
      }

      const signerAddress = await signer.getAddress();
      console.log("Signer address:", signerAddress);

      const token0 = new ethers.Contract(addresses.token0, abis.NewToken, signer);
      const token1 = new ethers.Contract(addresses.token1, abis.NewToken, signer);
      const token2 = new ethers.Contract(addresses.token2, abis.NewToken, signer);
      
      // Get the selected pool
      const poolData = addresses.pools[selectedPoolId];
      const pool = new ethers.Contract(poolData.address, abis.Pool, signer);
      
      // Get token mapping based on pool tokens
      const tokenMapping = {};
      const tokensInPool = [];
      
      // Map tokens based on the selected pool
      if (poolData.tokens.includes("Alpha")) {
        tokenMapping.token0 = {
          contract: token0,
          address: addresses.token0,
          symbol: "ALPHA"
        };
        tokensInPool.push("token0");
      }
      
      if (poolData.tokens.includes("Beta")) {
        tokenMapping.token1 = {
          contract: token1,
          address: addresses.token1,
          symbol: "BETA"
        };
        tokensInPool.push("token1");
      }
      
      if (poolData.tokens.includes("Gamma")) {
        tokenMapping.token2 = {
          contract: token2,
          address: addresses.token2,
          symbol: "GAMMA"
        };
        tokensInPool.push("token2");
      }

      const contracts = {
          token0: {
              contract: token0,
              address: addresses.token0,
              symbol: "ALPHA"
          },
          token1: {
              contract: token1,
              address: addresses.token1,
              symbol: "BETA"
          },
          token2: {
              contract: token2,
              address: addresses.token2,
              symbol: "GAMMA"
          },
          pool: {
              contract: pool,
              address: poolData.address
          },
          tokensInPool: tokensInPool,
          tokenMapping: tokenMapping,
          poolData: poolData
      };

      console.log("Contracts initialized with addresses:", {
          token0: contracts.token0.address,
          token1: contracts.token1.address,
          token2: contracts.token2.address,
          pool: contracts.pool.address,
          selectedPool: selectedPoolId,
          tokensInPool: tokensInPool
      });

      return contracts;
  } catch (error) {
      console.error("Error in getContracts:", error);
      throw error;
  }
};

// Get all available pools
export const getAvailablePools = () => {
  const pools = addresses.pools;
  const poolList = Object.keys(pools).map(poolId => ({
    id: poolId,
    pair: pools[poolId].pair,
    tokens: pools[poolId].tokens
  }));
  return poolList;
};

export const getTokenBalances = async (contracts, address) => {
    try {
        console.log("Getting balances for address:", address);
        
        // Get balances for all three tokens regardless of which pool is selected
        const token0Balance = await contracts.token0.contract.balanceOf(address);
        const token1Balance = await contracts.token1.contract.balanceOf(address);
        const token2Balance = await contracts.token2.contract.balanceOf(address);
        
        console.log("Token balances:", {
            ALPHA: token0Balance.toString(),
            BETA: token1Balance.toString(),
            GAMMA: token2Balance.toString()
        });
        
        const formattedBalances = {
            token0: ethers.formatEther(token0Balance),
            token1: ethers.formatEther(token1Balance),
            token2: ethers.formatEther(token2Balance)
        };
        
        console.log("Formatted balances:", formattedBalances);
        return formattedBalances;
    } catch (error) {
        console.error("Error in getTokenBalances:", error);
        return {
            token0: '0',
            token1: '0',
            token2: '0'
        };
    }
};

export const getPoolInfo = async (contracts) => {
  try {
      console.log("Getting pool info for address:", contracts.pool.address);
      
      // Get balances of all tokens in the pool
      const token0Balance = await contracts.token0.contract.balanceOf(contracts.pool.address);
      const token1Balance = await contracts.token1.contract.balanceOf(contracts.pool.address);
      const token2Balance = await contracts.token2.contract.balanceOf(contracts.pool.address);
      
      const formattedBalances = {
          token0Balance: ethers.formatEther(token0Balance),
          token1Balance: ethers.formatEther(token1Balance),
          token2Balance: ethers.formatEther(token2Balance)
      };
      
      console.log("Formatted pool balances:", formattedBalances);
      return formattedBalances;
  } catch (error) {
      console.error("Error in getPoolInfo:", error);
      return {
          token0Balance: '0',
          token1Balance: '0',
          token2Balance: '0'
      };
  }
};

export const getAmountOut = async (contracts, tokenIn, amountIn, tokenOut) => {
    try {
        const amountInWei = ethers.parseEther(amountIn.toString());
        const amountOutWei = await contracts.pool.contract.getAmountOut(
            contracts.tokenMapping[tokenIn].address,
            amountInWei,
            contracts.tokenMapping[tokenOut].address
        );
        return ethers.formatEther(amountOutWei);
    } catch (error) {
        console.error("Error in getAmountOut:", error);
        throw error;
    }
};

// todo: infinite-zhou 待废弃
export const getRequiredAmounts = async (contracts, amount0) => {
  try {
      const amount0Wei = ethers.parseEther(amount0.toString());
      console.log(contracts.pool.contract.tokenBalances)
      const res = await contracts.pool.contract.getRequiredAmounts(amount0Wei);
      
      return res;
  } catch (error) {
      console.error("Error in getRequiredAmounts:", error);
      throw error;
  }
};

export const swapTokens = async (contracts, tokenIn, amountIn, tokenOut) => {
  try {
      const amountInWei = ethers.parseEther(amountIn.toString());
      
      // Get token addresses from mapping
      const tokenInAddress = contracts.tokenMapping[tokenIn].address;
      const tokenOutAddress = contracts.tokenMapping[tokenOut].address;
      
      // Approve tokenIn
      const tokenInContract = contracts.tokenMapping[tokenIn].contract;
      await tokenInContract.approve(contracts.pool.address, amountInWei);
      
      // Execute swap
      const tx = await contracts.pool.contract.swap(
          tokenInAddress,
          amountInWei,
          tokenOutAddress
      );
      await tx.wait();
      return tx;
  } catch (error) {
      console.error("Error in swapTokens:", error);
      throw error;
  }
};

export const addLiquidity = async (contracts, amounts_map) => {
  try {
      // Create arrays for tokens and amounts based on the current pool
      const addresses_token = [];
      const amounts_list = [];
      
      for (const tokenKey of contracts.tokensInPool) {
          const token = contracts.tokenMapping[tokenKey];
          addresses_token.push(token.address);
          
          // Parse the amount for this token
          const amount = ethers.parseEther(amounts_map[tokenKey].toString());
          amounts_list.push(amount);
          
          // Approve spending
          await contracts[tokenKey].contract.approve(contracts.pool.address, amount);
      }
    
      // Call the contract
      const tx = await contracts.pool.contract.addLiquidity(addresses_token, amounts_list);
      await tx.wait();
      return tx;
  } catch (error) {
      console.error("Error in addLiquidity:", error);
      throw error;
  }
};

// 取流动性
export const withdrawLiquidity = async (contracts, lpTokenAmount) => {
  try {
    // Withdraw liquidity
    const tx = await contracts.pool.contract.withdrawLiquidity(lpTokenAmount);
    await tx.wait();
    return tx;
  } catch (error) {
    console.error("Error in withdrawLiquidity:", error);
    throw error;
  }
};

// 获取LP token信息
export const getLPTokenInfo = async (contracts, address) => {
  try {
    // 获取LP token总供应量
    const totalSupply = await contracts.pool.contract.totalSupply();
    
    // 获取用户持有的LP token数量
    const userBalance = await contracts.pool.contract.balanceOf(address);
    
    // 计算用户份额百分比
    const percentage = totalSupply.toString() === '0' 
      ? '0' 
      : (Number(userBalance.toString()) / Number(totalSupply.toString()) * 100).toFixed(2);
    
    // 确保BigInt值被正确转换为字符串
    return {
      totalSupply: totalSupply ? ethers.formatEther(totalSupply.toString()) : '0',
      userBalance: userBalance ? ethers.formatEther(userBalance.toString()) : '0',
      percentage: percentage
    };
  } catch (error) {
    console.error("Error getting LP token info:", error);
    return {
      totalSupply: '0',
      userBalance: '0',
      percentage: '0'
    };
  }
}