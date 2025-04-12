import { ethers,MaxUint256 } from 'ethers';
import addresses from './deployed-addresses.json'; // Import addresses from deployed contract addresses
import abis from './contract-abis.json'; // Import ABIs from deployed contract ABIs
export const getContracts = async (signer) => {
  try {
      if (!signer) {
          throw new Error("No signer provided");
      }

      const signerAddress = await signer.getAddress();
      console.log("Signer address:", signerAddress);

      const token0 = new ethers.Contract(addresses.token0, abis.NewToken, signer);
      const token1 = new ethers.Contract(addresses.token1, abis.NewToken, signer);
      const token2 = new ethers.Contract(addresses.token2, abis.NewToken, signer);
      const addresses_token = [addresses.token0, addresses.token1, addresses.token2];
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
          token2: {
              contract: token2,
              address: addresses.token2
          },
          pool: {
              contract: pool,
              address: addresses.pool
          }
      };

      console.log("Contracts initialized with addresses:", {
          token0: contracts.token0.address,
          token1: contracts.token1.address,
          token2: contracts.token2.address,
          pool: contracts.pool.address
      });

      return contracts;
  } catch (error) {
      console.error("Error in getContracts:", error);
      throw error;
  }
};

export const getTokenBalances = async (contracts, address) => {
    try {
        console.log("Getting balances for address:", address);
        
        const token0Balance = await contracts.token0.contract.balanceOf(address);
        console.log("Token0 raw balance:", token0Balance.toString());
        
        const token1Balance = await contracts.token1.contract.balanceOf(address);
        console.log("Token1 raw balance:", token1Balance.toString());
        
        const token2Balance = await contracts.token2.contract.balanceOf(address);
        console.log("Token2 raw balance:", token2Balance.toString());
        
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
      
      const token0Balance = await contracts.token0.contract.balanceOf(contracts.pool.address);
      console.log("Pool Token0 raw balance:", token0Balance.toString());
      
      const token1Balance = await contracts.token1.contract.balanceOf(contracts.pool.address);
      console.log("Pool Token1 raw balance:", token1Balance.toString());
      
      const token2Balance = await contracts.token2.contract.balanceOf(contracts.pool.address);
      console.log("Pool Token2 raw balance:", token2Balance.toString());
      
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
            contracts[tokenIn].address,
            amountInWei,
            contracts[tokenOut].address
        );
        return ethers.formatEther(amountOutWei);
    } catch (error) {
        console.error("Error in getAmountOut:", error);
        throw error;
    }
  };

export const getRequiredAmounts = async (contracts, amount0) => {
  try {
      const amount0Wei = ethers.parseEther(amount0.toString());
      const res = await contracts.pool.contract.getRequiredAmounts(amount0Wei);
      
      // 正确处理返回值：将每个BigInt转换为字符串
      const formattedAmounts = [];
      for (let i = 0; i < res.length; i++) {
          formattedAmounts.push(ethers.formatEther(res[i]));
      }
      
      return formattedAmounts;
  } catch (error) {
      console.error("Error in getRequiredAmounts:", error);
      throw error;
  }
};

export const swapTokens = async (contracts, tokenIn, amountIn, tokenOut) => {
  try {
      const amountInWei = ethers.parseEther(amountIn.toString());
      
      // Map token names to contract objects
      const tokenInAddress = contracts[tokenIn].address;
      const tokenOutAddress = contracts[tokenOut].address;
      
      // Approve tokenIn
      const tokenInContract = contracts[tokenIn].contract;
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

export const addLiquidity = async (contracts, addresses_token, amounts_list) => {
  try {
    //   const amount0Wei = ethers.parseEther(amount0.toString());
      
      // Get required amounts of token1 and token2
      // get the key: address and value: amount
    //   const [amount1Wei, amount2Wei] = await contracts.pool.contract.getRequiredAmounts(amount0Wei);
      
      // Approve all tokens
    //   console.log(amounts_list);


      await contracts.token0.contract.approve(contracts.pool.address, amounts_list[0] );
      await contracts.token1.contract.approve(contracts.pool.address, amounts_list[1] );
      await contracts.token2.contract.approve(contracts.pool.address, amounts_list[2] );
      
    
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

// 获取池子中累积的手续费
export const getPoolFees = async (contracts) => {
  try {
    const token0Fee = await contracts.pool.contract.lpFee(contracts.token0.address);
    const token1Fee = await contracts.pool.contract.lpFee(contracts.token1.address);
    const token2Fee = await contracts.pool.contract.lpFee(contracts.token2.address);
    
    return {
      token0Fee: ethers.formatEther(token0Fee),
      token1Fee: ethers.formatEther(token1Fee),
      token2Fee: ethers.formatEther(token2Fee)
    };
  } catch (error) {
    console.error("Error getting pool fees:", error);
    return {
      token0Fee: '0',
      token1Fee: '0',
      token2Fee: '0'
    };
  }
};

// 计算用户可领取的奖励
export const getClaimableRewards = async (contracts, account) => {
  if (!contracts || !account) return { token0: '0', token1: '0', token2: '0' };
  
  try {
    // 获取用户LP代币余额
    const userLpBalance = await contracts.pool.contract.balanceOf(account);
    
    // 获取总LP代币供应量
    const totalSupply = await contracts.pool.contract.totalSupply();
    
    if (totalSupply.toString() === '0' || userLpBalance.toString() === '0') {
      return { token0: '0', token1: '0', token2: '0' };
    }
    
    // 获取每种代币的手续费
    const token0Fee = await contracts.pool.contract.lpFee(contracts.token0.address);
    const token1Fee = await contracts.pool.contract.lpFee(contracts.token1.address);
    const token2Fee = await contracts.pool.contract.lpFee(contracts.token2.address);
    
    // 计算用户应得份额
    const token0Share = (token0Fee * userLpBalance) / totalSupply;
    const token1Share = (token1Fee * userLpBalance) / totalSupply;
    const token2Share = (token2Fee * userLpBalance) / totalSupply;
    
    return {
      token0: ethers.formatEther(token0Share),
      token1: ethers.formatEther(token1Share),
      token2: ethers.formatEther(token2Share)
    };
  } catch (error) {
    console.error("Error calculating claimable rewards:", error);
    return {
      token0: '0',
      token1: '0',
      token2: '0'
    };
  }
};

// 领取LP奖励
export const claimLpIncentives = async (contracts, tokenAddress, amount = 0) => {
  try {
    let tx;
    
    // 根据是否提供了具体数量采用不同的调用方式
    if (amount && amount !== 0) {
      try {
        // 尝试调用带金额参数的版本
        tx = await contracts.pool.contract.claimLpIncentives(tokenAddress, amount);
      } catch (error) {
        console.warn("带参数版本调用失败，尝试无参数版本");
        // 如果带参数版本调用失败，回退到无参数版本
        tx = await contracts.pool.contract.claimLpIncentives(tokenAddress);
      }
    } else {
      // 直接调用无参数版本
      tx = await contracts.pool.contract.claimLpIncentives(tokenAddress);
    }
    
    await tx.wait();
    return tx;
  } catch (error) {
    console.error("Error claiming LP incentives:", error);
    throw error;
  }
};