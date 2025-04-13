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
      
      // 初始化Router合约
      const router = new ethers.Contract(addresses.router, abis.Router, signer);
      
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
          router: {
              contract: router,
              address: addresses.router
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
          router: contracts.router.address,
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

export const getRequiredAmounts = async (contracts, amount0) => {
    try {
        const amount0Wei = ethers.parseEther(amount0.toString());
        const res = await contracts.pool.contract.getRequiredAmounts(amount0Wei);
        console.log(contracts)
        console.log("res:",res);
        // 将每个 BigInt 转换为正常数
        const formattedAmounts = [];
        for (let i = 0; i < res.length; i++) {
            formattedAmounts.push(ethers.formatEther(res[i]));
        }
        console.log("formattedAmounts:",formattedAmounts);
        return formattedAmounts;
    } catch (error) {
        console.error("Error in getRequiredAmounts:", error);
        throw error;
    }
};

export const swapTokens = async (contracts, tokenIn, amountIn, tokenOut, slippage) => {
  try {
      const amountInWei = ethers.parseEther(amountIn.toString());
      console.log(amountInWei)
      // Get token addresses from mapping
      const tokenInAddress = contracts.tokenMapping[tokenIn].address;
      const tokenOutAddress = contracts.tokenMapping[tokenOut].address;
      
      // 计算预期输出数量
      const expectedAmountOut = await getAmountOut(contracts, tokenIn, amountIn, tokenOut);
      const expectedAmountOutNum = parseFloat(expectedAmountOut);
      
      // 根据滑点计算最小输出数量
      const minAmountOut = expectedAmountOutNum * (1 - slippage / 10000);
      const minAmountOutWei = ethers.parseEther(minAmountOut.toString());
      
      // Approve tokenIn
      const tokenInContract = contracts.tokenMapping[tokenIn].contract;
      await tokenInContract.approve(contracts.pool.address, amountInWei);
      
      // Execute swap
      const tx = await contracts.pool.contract.swap(
          tokenInAddress,
          amountInWei,
          tokenOutAddress,
          minAmountOutWei
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
        const lpTokenAmountWei = ethers.parseEther(lpTokenAmount.toString());
        const tx = await contracts.pool.contract.withdrawLiquidity(lpTokenAmountWei);
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
    console.log("fee:", token0Fee,token1Fee,token2Fee)
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

// 使用Router合约找到最佳交换路径
export const findBestSwapPath = async (contracts, tokenIn, amountIn, tokenOut) => {
  try {
    const tokenInAddr = contracts.tokenMapping[tokenIn].address;
    const tokenOutAddr = contracts.tokenMapping[tokenOut].address;
    const amountInWei = ethers.parseEther(amountIn.toString());
    
    console.log(`Finding best path for ${tokenIn} to ${tokenOut} with amount ${amountIn}`);
    
    // 调用Router合约的findBestPath方法获取最佳路径
    const [path, pools] = await contracts.router.contract.findBestPath(
      tokenInAddr,
      tokenOutAddr,
      amountInWei
    );
    
    console.log("Best path found:", path);
    console.log("Using pools:", pools);
    
    return { path, pools };
  } catch (error) {
    console.error("Error finding best swap path:", error);
    return { path: [], pools: [] };
  }
};

// 使用Router获取预期输出金额（考虑最佳路径）
export const getSmartAmountOut = async (contracts, tokenIn, amountIn, tokenOut) => {
  try {
    if (!amountIn || amountIn <= 0) return '0';
    
    const tokenInAddr = contracts.tokenMapping[tokenIn].address;
    const tokenOutAddr = contracts.tokenMapping[tokenOut].address;
    const amountInWei = ethers.parseEther(amountIn.toString());
    
    // 调用Router的getAmountsOut方法获取预期输出金额
    const [amountOut, path] = await contracts.router.contract.getAmountsOut(
      tokenInAddr,
      amountInWei,
      tokenOutAddr
    );
    
    return {
      amountOut: ethers.formatEther(amountOut),
      path: path
    };
  } catch (error) {
    console.error("Error getting expected amount out:", error);
    return {
      amountOut: '0',
      path: []
    };
  }
};

// 使用Router执行智能交换
export const smartSwapTokens = async (contracts, tokenIn, amountIn, tokenOut, slippage, account) => {
  try {
    const amountInWei = ethers.parseEther(amountIn.toString());
    const tokenInAddr = contracts.tokenMapping[tokenIn].address;
    const tokenOutAddr = contracts.tokenMapping[tokenOut].address;
    
    // 计算预期输出数量
    const { amountOut } = await getSmartAmountOut(contracts, tokenIn, amountIn, tokenOut);
    const amountOutNum = parseFloat(amountOut);
    
    // 根据滑点计算最小输出数量
    const minAmountOut = (amountOutNum * (1 - slippage / 10000)).toString();
    const minAmountOutWei = ethers.parseEther(minAmountOut);
    
    // 获取当前时间戳 + 1小时作为交易截止时间
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    
    // 授权Router合约使用代币
    const tokenInContract = contracts[tokenIn].contract;
    await tokenInContract.approve(contracts.router.address, amountInWei);
    
    console.log(`Swapping ${amountIn} ${tokenIn} to ${tokenOut} with slippage ${slippage/100}%`);
    console.log(`Minimum output amount: ${minAmountOut}`);
    
    // 执行交换
    const tx = await contracts.router.contract.swapExactTokensForTokens(
      tokenInAddr,
      amountInWei,
      tokenOutAddr,
      minAmountOutWei,
      account,
      deadline
    );
    
    await tx.wait();
    return tx;
  } catch (error) {
    console.error("Error in smartSwapTokens:", error);
    throw error;
  }
};

// 获取路径显示信息
export const getPathInfo = async (contracts, path) => {
  try {
    if (!path || path.length === 0) return [];
    
    const pathInfo = [];
    for (let i = 0; i < path.length; i++) {
      const tokenAddress = path[i];
      let tokenSymbol = "未知";
      
      // 查找对应的代币符号
      if (tokenAddress === contracts.token0.address) {
        tokenSymbol = contracts.token0.symbol;
      } else if (tokenAddress === contracts.token1.address) {
        tokenSymbol = contracts.token1.symbol;
      } else if (tokenAddress === contracts.token2.address) {
        tokenSymbol = contracts.token2.symbol;
      }
      
      pathInfo.push({ address: tokenAddress, symbol: tokenSymbol });
    }
    
    return pathInfo;
  } catch (error) {
    console.error("Error getting path info:", error);
    return [];
  }
};