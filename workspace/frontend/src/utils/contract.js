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
        const token0Balance = await contracts.token0.contract.balanceOf(address);
        const token1Balance = await contracts.token1.contract.balanceOf(address);
        const token2Balance = await contracts.token2.contract.balanceOf(address);
        return {
            token0: ethers.formatEther(token0Balance),
            token1: ethers.formatEther(token1Balance),
            token2: ethers.formatEther(token2Balance)
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
      const token2Balance = await contracts.token2.contract.balanceOf(contracts.pool.address);
      
      return {
          token0Balance: ethers.formatEther(token0Balance),
          token1Balance: ethers.formatEther(token1Balance),
          token2Balance: ethers.formatEther(token2Balance)
      };
  } catch (error) {
      console.error("Error in getPoolInfo:", error);
      throw error;
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
export const withdrawingliquidity = async (contracts, addresses_token, amounts_list) => {
  try {
    
    await contracts.token0.contract.approve(contracts.pool.address, amounts_list[0] );
    await contracts.token1.contract.approve(contracts.pool.address, amounts_list[1] );
    await contracts.token2.contract.approve(contracts.pool.address, amounts_list[2] );
    
    // Withdraw liquidity
    const tx = await contracts.pool.contract.withdrawingliquidity(addresses_token, amounts_list);
    await tx.wait();
    return tx;
  } catch (error) {
    console.error("Error in withdrawingliquidity:", error);
    throw error;
  }
};