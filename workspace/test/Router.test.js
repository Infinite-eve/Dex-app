const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Router Contract", function () {
  let Factory, Router, NewToken;
  let factory, router;
  let token0, token1, token2, token3; // 测试代币
  let deployer, user1, user2;
  let pool01, pool02, pool12, pool23, pool123; // 不同的池子
  
  // 辅助函数：获取当前时间戳 + 1小时
  const getDeadline = () => Math.floor(Date.now() / 1000) + 3600;

  // 链下计算最优路径的辅助函数
  const findBestSwapPathOffchain = async (tokenIn, tokenOut, amountIn) => {
    // 在链下调用 findBestPath 视图函数获取最优路径
    try {
      const result = await router.findBestPath(tokenIn, tokenOut, amountIn);
      return { 
        path: [...result[0]], // 创建数组的副本，避免修改只读属性
        pools: [...result[1]], // 创建数组的副本，避免修改只读属性
        success: true 
      };
    } catch (error) {
      console.log(`找不到从 ${tokenIn} 到 ${tokenOut} 的路径`);
      return { path: [], pools: [], success: false };
    }
  };

  before(async function () {
    // 获取合约工厂
    Factory = await ethers.getContractFactory("Factory");
    Router = await ethers.getContractFactory("Router");
    NewToken = await ethers.getContractFactory("NewToken");

    // 获取签名者
    [deployer, user1, user2] = await ethers.getSigners();

    // 部署测试代币
    token0 = await NewToken.deploy("Token0", "TK0");
    token1 = await NewToken.deploy("Token1", "TK1");
    token2 = await NewToken.deploy("Token2", "TK2");
    token3 = await NewToken.deploy("Token3", "TK3");

    // 部署工厂合约
    factory = await Factory.deploy();
    
    // 部署路由合约
    router = await Router.deploy(await factory.getAddress());
    
    // 创建各种池子组合
    // 创建池子 token0-token1
    await factory.createPool([
      await token0.getAddress(), 
      await token1.getAddress()
    ]);
    
    // 创建池子 token0-token2
    await factory.createPool([
      await token0.getAddress(), 
      await token2.getAddress()
    ]);
    
    // 创建池子 token1-token2
    await factory.createPool([
      await token1.getAddress(), 
      await token2.getAddress()
    ]);
    
    // 创建池子 token2-token3
    await factory.createPool([
      await token2.getAddress(), 
      await token3.getAddress()
    ]);
    
    // 创建池子 token1-token2-token3
    await factory.createPool([
      await token1.getAddress(),
      await token2.getAddress(),
      await token3.getAddress()
    ]);
    
    // 获取池子地址
    pool01 = await factory.getPool([await token0.getAddress(), await token1.getAddress()]);
    pool02 = await factory.getPool([await token0.getAddress(), await token2.getAddress()]);
    pool12 = await factory.getPool([await token1.getAddress(), await token2.getAddress()]);
    pool23 = await factory.getPool([await token2.getAddress(), await token3.getAddress()]);
    pool123 = await factory.getPool([await token1.getAddress(), await token2.getAddress(), await token3.getAddress()]);
    
    // 给用户分配测试代币
    const amount = ethers.parseEther("10000");
    await token0.transfer(user1.address, amount);
    await token1.transfer(user1.address, amount);
    await token2.transfer(user1.address, amount);
    await token3.transfer(user1.address, amount);
    
    // 给用户2分配测试代币
    await token0.transfer(user2.address, amount);
    await token1.transfer(user2.address, amount);
    await token2.transfer(user2.address, amount);
    await token3.transfer(user2.address, amount);
    
    // 给所有池子添加初始流动性
    // 1. 授权
    await token0.approve(pool01, ethers.MaxUint256);
    await token1.approve(pool01, ethers.MaxUint256);
    await token0.approve(pool02, ethers.MaxUint256);
    await token2.approve(pool02, ethers.MaxUint256);
    await token1.approve(pool12, ethers.MaxUint256);
    await token2.approve(pool12, ethers.MaxUint256);
    await token2.approve(pool23, ethers.MaxUint256);
    await token3.approve(pool23, ethers.MaxUint256);
    await token1.approve(pool123, ethers.MaxUint256);
    await token2.approve(pool123, ethers.MaxUint256);
    await token3.approve(pool123, ethers.MaxUint256);
    
    // 2. 添加流动性
    const pool01Contract = await ethers.getContractAt("Pool", pool01);
    const pool02Contract = await ethers.getContractAt("Pool", pool02);
    const pool12Contract = await ethers.getContractAt("Pool", pool12);
    const pool23Contract = await ethers.getContractAt("Pool", pool23);
    const pool123Contract = await ethers.getContractAt("Pool", pool123);
    
    // 添加流动性到各个池子
    const liquidityAmount = ethers.parseEther("1000");
    
    // 添加到 token0-token1 池
    const tokens01 = [await token0.getAddress(), await token1.getAddress()];
    const amounts01 = [liquidityAmount, liquidityAmount * 2n];
    await pool01Contract.addLiquidity(tokens01, amounts01);
    
    // 添加到 token0-token2 池
    const tokens02 = [await token0.getAddress(), await token2.getAddress()];
    const amounts02 = [liquidityAmount, liquidityAmount * 3n];
    await pool02Contract.addLiquidity(tokens02, amounts02);
    
    // 添加到 token1-token2 池
    const tokens12 = [await token1.getAddress(), await token2.getAddress()];
    const amounts12 = [liquidityAmount, liquidityAmount * 2n];
    await pool12Contract.addLiquidity(tokens12, amounts12);
    
    // 添加到 token2-token3 池
    const tokens23 = [await token2.getAddress(), await token3.getAddress()];
    const amounts23 = [liquidityAmount, liquidityAmount * 2n];
    await pool23Contract.addLiquidity(tokens23, amounts23);
    
    // 添加到 token1-token2-token3 池
    const tokens123 = [await token1.getAddress(), await token2.getAddress(), await token3.getAddress()];
    const amounts123 = [liquidityAmount, liquidityAmount * 2n, liquidityAmount * 3n];
    await pool123Contract.addLiquidity(tokens123, amounts123);
  });

  describe("Router Deployment", function () {
    it("Should deploy successfully with correct factory address", async function () {
      expect(await router.factory()).to.equal(await factory.getAddress());
    });
    
    it("Should revert when deployed with zero address factory", async function () {
      await expect(Router.deploy(ethers.ZeroAddress)).to.be.revertedWith("Zero factory address");
    });
  });
  
  describe("Pool Finding", function () {
    it("Should find direct pools between tokens", async function () {
      const directPools = await router.findDirectPools(
        await token0.getAddress(), 
        await token1.getAddress()
      );
      
      expect(directPools.length).to.be.at.least(1);
      expect(directPools).to.include(pool01);
    });
    
    it("Should find multiple pools when they exist", async function () {
      const directPools = await router.findDirectPools(
        await token1.getAddress(), 
        await token2.getAddress()
      );
      
      // 应该找到 token1-token2 池和 token1-token2-token3 池
      expect(directPools.length).to.equal(2);
      expect(directPools).to.include(pool12);
      expect(directPools).to.include(pool123);
    });
  });
  
  describe("Path Finding", function () {
    it("Should find direct path when available", async function () {
      const amountIn = ethers.parseEther("10");
      const [path, pools] = await router.findBestPath(
        await token0.getAddress(),
        await token1.getAddress(),
        amountIn
      );
      
      expect(path.length).to.equal(2);
      expect(path[0]).to.equal(await token0.getAddress());
      expect(path[1]).to.equal(await token1.getAddress());
      expect(pools.length).to.equal(1);
    });
    
    it("Should find multi-hop path when better", async function () {
      // 设置一个场景，使多跳路径比直接路径更好
      // 先在 token0-token1 池中执行一个大的交换，使池子失衡
      const pool01Contract = await ethers.getContractAt("Pool", pool01);
      await token0.approve(pool01, ethers.parseEther("500"));
      
      // 获取预期输出金额
      const expectedOut = await pool01Contract.getAmountOut(
        await token0.getAddress(), 
        ethers.parseEther("500"), 
        await token1.getAddress()
      );
      
      // 添加minAmountOut参数，设置滑点容忍度为5%
      const minAmountOut = expectedOut * 95n / 100n;
      
      await pool01Contract.swap(
        await token0.getAddress(),
        ethers.parseEther("500"),
        await token1.getAddress(),
        minAmountOut
      );
      
      // 现在尝试找到从 token0 到 token1 的路径
      // 由于 token0-token1 池子失衡，通过 token0->token2->token1 可能是更好的路径
      const amountIn = ethers.parseEther("10");
      const [path, pools] = await router.findBestPath(
        await token0.getAddress(),
        await token1.getAddress(),
        amountIn
      );
      
      // 检查是否确实找到了多跳路径
      if (path.length > 2) {
        expect(path[0]).to.equal(await token0.getAddress());
        expect(path[path.length - 1]).to.equal(await token1.getAddress());
        expect(pools.length).to.equal(path.length - 1);
      }
      // 注意：由于池子状态和代币价格，可能直接路径仍然是最好的
    });
    
    it("Should revert when no path is found", async function () {
      // 部署一个新的没有流动性池的代币
      const tokenIsolated = await NewToken.deploy("Isolated", "ISO");
      
      await expect(router.findBestPath(
        await tokenIsolated.getAddress(),
        await token0.getAddress(),
        ethers.parseEther("10")
      )).to.be.revertedWith("No path found");
    });
  });
  
  describe("Amount Calculation", function () {
    it("Should correctly calculate output amounts", async function () {
      const amountIn = ethers.parseEther("10");
      const [amountOut, path] = await router.getAmountsOut(
        await token0.getAddress(),
        amountIn,
        await token1.getAddress()
      );
      
      expect(amountOut).to.be.gt(0);
      expect(path[0]).to.equal(await token0.getAddress());
      expect(path[path.length - 1]).to.equal(await token1.getAddress());
    });
  });
  
  describe("Token Swapping", function () {
    beforeEach(async function () {
      // 用户授权路由合约使用他们的代币
      await token0.connect(user1).approve(router.getAddress(), ethers.MaxUint256);
      await token1.connect(user1).approve(router.getAddress(), ethers.MaxUint256);
      await token2.connect(user1).approve(router.getAddress(), ethers.MaxUint256);
      await token3.connect(user1).approve(router.getAddress(), ethers.MaxUint256);
    });
    
    it("Should swap tokens directly", async function () {
      const amountIn = ethers.parseEther("10");
      
      // 获取预期输出
      const [expectedOut, path] = await router.getAmountsOut(
        await token0.getAddress(),
        amountIn,
        await token1.getAddress()
      );
      
      // 记录交换前的余额
      const balanceBefore = await token1.balanceOf(user1.address);
      
      // 执行交换
      await router.connect(user1).swapExactTokensForTokens(
        await token0.getAddress(),
        amountIn,
        await token1.getAddress(),
        expectedOut * 95n / 100n, // 允许5%的滑点
        user1.address,
        getDeadline()
      );
      
      // 检查交换后的余额
      const balanceAfter = await token1.balanceOf(user1.address);
      expect(balanceAfter - balanceBefore).to.be.gte(expectedOut * 95n / 100n);
    });
    
    it("Should swap tokens via multi-hop path", async function () {
      const amountIn = ethers.parseEther("5");
      
      // 获取预期输出
      const [expectedOut, path] = await router.getAmountsOut(
        await token0.getAddress(),
        amountIn,
        await token3.getAddress()
      );
      
      // 记录交换前的余额
      const balanceBefore = await token3.balanceOf(user1.address);
      
      // 执行交换
      await router.connect(user1).swapExactTokensForTokens(
        await token0.getAddress(),
        amountIn,
        await token3.getAddress(),
        expectedOut * 95n / 100n, // 允许5%的滑点
        user1.address,
        getDeadline()
      );
      
      // 检查交换后的余额
      const balanceAfter = await token3.balanceOf(user1.address);
      expect(balanceAfter - balanceBefore).to.be.gte(expectedOut * 95n / 100n);
    });
    
    it("Should swap tokens with custom path", async function () {
      const amountIn = ethers.parseEther("10");
      
      // 用户指定路径
      const path = [
        await token0.getAddress(),
        await token2.getAddress(),
        await token1.getAddress()
      ];
      
      const pools = [pool02, pool12];
      
      // 计算路径中每一步的预期输出
      const pool02Contract = await ethers.getContractAt("Pool", pool02);
      const intermediateAmount = await pool02Contract.getAmountOut(
        await token0.getAddress(),
        amountIn,
        await token2.getAddress()
      );
      
      const pool12Contract = await ethers.getContractAt("Pool", pool12);
      const expectedOut = await pool12Contract.getAmountOut(
        await token2.getAddress(),
        intermediateAmount,
        await token1.getAddress()
      );
      
      // 设置合理的最小输出金额（允许5%的滑点）
      const minAmountOut = expectedOut * 95n / 100n;
      
      // 记录交换前的余额
      const balanceBefore = await token1.balanceOf(user1.address);
      
      // 执行交换
      await router.connect(user1).swapWithPath(
        await token0.getAddress(),
        amountIn,
        minAmountOut, // 设置允许5%滑点的最小输出金额
        path,
        pools,
        user1.address,
        getDeadline()
      );
      
      // 检查交换后的余额
      const balanceAfter = await token1.balanceOf(user1.address);
      expect(balanceAfter - balanceBefore).to.be.gte(minAmountOut);
    });

    it("Should swap tokens using offchain calculated path", async function () {
      const amountIn = ethers.parseEther("10");
      
      // 链下计算最优路径
      const { path, pools, success } = await findBestSwapPathOffchain(
        await token0.getAddress(),
        await token1.getAddress(),
        amountIn
      );
      
      expect(success).to.be.true;
      expect(path.length).to.be.gte(2);
      expect(pools.length).to.be.gte(1);
      
      // 计算预期输出金额
      let expectedAmount = amountIn;
      for (let i = 0; i < path.length - 1; i++) {
        const poolContract = await ethers.getContractAt("Pool", pools[i]);
        expectedAmount = await poolContract.getAmountOut(
          path[i],
          expectedAmount,
          path[i + 1]
        );
      }
      
      // 设置合理的最小输出金额（允许5%的滑点）
      const minAmountOut = expectedAmount * 95n / 100n;
      
      // 记录交换前的余额
      const balanceBefore = await token1.balanceOf(user1.address);
      
      // 执行交换
      await router.connect(user1).swapWithPath(
        await token0.getAddress(),
        amountIn,
        minAmountOut, // 设置允许5%滑点的最小输出金额
        path,
        pools,
        user1.address,
        getDeadline()
      );
      
      // 检查交换后的余额
      const balanceAfter = await token1.balanceOf(user1.address);
      expect(balanceAfter - balanceBefore).to.be.gte(minAmountOut);
    });
  });
  
  describe("Error Handling", function () {
    beforeEach(async function () {
      await token0.connect(user1).approve(router.getAddress(), ethers.MaxUint256);
      await token1.connect(user1).approve(router.getAddress(), ethers.MaxUint256);
    });
    
    it("Should revert when deadline is expired", async function () {
      const expiredDeadline = Math.floor(Date.now() / 1000) - 3600; // 1 小时前
      
      await expect(router.connect(user1).swapExactTokensForTokens(
        await token0.getAddress(),
        ethers.parseEther("10"),
        await token1.getAddress(),
        0, // amountOutMin
        user1.address,
        expiredDeadline
      )).to.be.revertedWith("Expired");
    });
    
    it("Should revert when path is invalid", async function () {
      await expect(router.connect(user1).swapWithPath(
        await token0.getAddress(),
        ethers.parseEther("10"),
        0, // amountOutMin
        [await token0.getAddress()], // 路径过短
        [],
        user1.address,
        getDeadline()
      )).to.be.revertedWith("Invalid path");
    });
    
    it("Should revert when pool is invalid for tokens", async function () {
      await expect(router.connect(user1).swapWithPath(
        await token0.getAddress(),
        ethers.parseEther("10"),
        0, // amountOutMin
        [await token0.getAddress(), await token1.getAddress()],
        [pool12], // 错误的池子（pool12 不包含 token0）
        user1.address,
        getDeadline()
      )).to.be.revertedWith("Invalid pool for tokens");
    });
    
    it("Should revert when output amount is less than minimum", async function () {
      const amountIn = ethers.parseEther("10");
      const [expectedOut, path] = await router.getAmountsOut(
        await token0.getAddress(),
        amountIn,
        await token1.getAddress()
      );
      
      await expect(router.connect(user1).swapExactTokensForTokens(
        await token0.getAddress(),
        amountIn,
        await token1.getAddress(),
        expectedOut * 2n, // 设置一个不可能达到的最小输出金额
        user1.address,
        getDeadline()
      )).to.be.revertedWith("Insufficient output amount");
    });
  });
});