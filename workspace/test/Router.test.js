const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Router 跨池交换测试", function () {
  let owner, user1, user2;
  let tokenA, tokenB, tokenC;
  let factory, router;
  let poolAB, poolBC;
  let poolABAddress, poolBCAddress;

  const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1,000,000 代币
  const LIQUIDITY_AMOUNT_A = ethers.parseEther("10000"); // 10,000 代币
  const LIQUIDITY_AMOUNT_B_POOL_AB = ethers.parseEther("20000"); // 20,000 代币
  const LIQUIDITY_AMOUNT_B_POOL_BC = ethers.parseEther("5000"); // 5,000 代币 
  const LIQUIDITY_AMOUNT_C = ethers.parseEther("10000"); // 10,000 代币
  const SWAP_AMOUNT = ethers.parseEther("100"); // 100 代币

  beforeEach(async function () {
    // 获取签名账户
    [owner, user1, user2] = await ethers.getSigners();

    // 部署测试代币
    const TokenContract = await ethers.getContractFactory("NewToken");
    tokenA = await TokenContract.deploy("TokenA", "TKNA");
    tokenB = await TokenContract.deploy("TokenB", "TKNB");
    tokenC = await TokenContract.deploy("TokenC", "TKNC");

    // 部署 Factory 合约
    const FactoryContract = await ethers.getContractFactory("Factory");
    factory = await FactoryContract.deploy();

    // 创建两个池子: A-B 和 B-C
    await factory.createPool([await tokenA.getAddress(), await tokenB.getAddress()]);
    await factory.createPool([await tokenB.getAddress(), await tokenC.getAddress()]);

    // 获取池子地址
    poolABAddress = await factory.getPool([await tokenA.getAddress(), await tokenB.getAddress()]);
    poolBCAddress = await factory.getPool([await tokenB.getAddress(), await tokenC.getAddress()]);

    // 获取池子实例
    const PoolContract = await ethers.getContractFactory("Pool");
    poolAB = PoolContract.attach(poolABAddress);
    poolBC = PoolContract.attach(poolBCAddress);

    // 部署 Router 合约
    const RouterContract = await ethers.getContractFactory("Router");
    router = await RouterContract.deploy(await factory.getAddress());

    // 授权池子使用代币
    await tokenA.approve(poolABAddress, LIQUIDITY_AMOUNT_A);
    await tokenB.approve(poolABAddress, LIQUIDITY_AMOUNT_B_POOL_AB);
    await tokenB.approve(poolBCAddress, LIQUIDITY_AMOUNT_B_POOL_BC);
    await tokenC.approve(poolBCAddress, LIQUIDITY_AMOUNT_C);

    // 向池子中添加流动性
    await poolAB.addLiquidity(
      [await tokenA.getAddress(), await tokenB.getAddress()],
      [LIQUIDITY_AMOUNT_A, LIQUIDITY_AMOUNT_B_POOL_AB]
    );

    await poolBC.addLiquidity(
      [await tokenB.getAddress(), await tokenC.getAddress()],
      [LIQUIDITY_AMOUNT_B_POOL_BC, LIQUIDITY_AMOUNT_C]
    );

    // 为用户提供代币
    await tokenA.transfer(await user1.getAddress(), ethers.parseEther("1000"));
    await tokenA.connect(user1).approve(await router.getAddress(), ethers.parseEther("1000"));
  });

  describe("基本功能测试", function () {
    it("应该能够获取支持的代币", async function () {
      const supportedTokens = await router.getSupportedTokens();
      expect(supportedTokens.length).to.be.equal(3); // A, B, C 三种代币
      
      // 验证支持的代币地址
      const tokenAddresses = new Set(supportedTokens.map(addr => addr.toLowerCase()));
      expect(tokenAddresses.has((await tokenA.getAddress()).toLowerCase())).to.be.true;
      expect(tokenAddresses.has((await tokenB.getAddress()).toLowerCase())).to.be.true;
      expect(tokenAddresses.has((await tokenC.getAddress()).toLowerCase())).to.be.true;
    });

    it("应该能找到最佳路径", async function () {
      const [path, pools] = await router.findBestPath(
        await tokenA.getAddress(), 
        await tokenC.getAddress()
      );

      // 验证路径长度和池子数量
      expect(path.length).to.equal(3); // A -> B -> C
      expect(pools.length).to.equal(2); // 两个池子

      // 验证路径内容
      expect(path[0]).to.equal(await tokenA.getAddress());
      expect(path[1]).to.equal(await tokenB.getAddress());
      expect(path[2]).to.equal(await tokenC.getAddress());

      // 验证池子地址
      expect(pools[0]).to.equal(poolABAddress);
      expect(pools[1]).to.equal(poolBCAddress);
    });

    it("应该能计算跨池交换的输出金额", async function () {
      const [amountOut, path] = await router.getAmountsOut(
        await tokenA.getAddress(),
        SWAP_AMOUNT,
        await tokenC.getAddress()
      );

      // 验证路径
      expect(path.length).to.equal(3); // A -> B -> C
      expect(path[0]).to.equal(await tokenA.getAddress());
      expect(path[1]).to.equal(await tokenB.getAddress());
      expect(path[2]).to.equal(await tokenC.getAddress());

      // 验证输出金额大于0
      expect(amountOut).to.be.gt(0);
      console.log(`跨池交换计算输出金额: ${ethers.formatEther(amountOut)} TokenC`);
    });
  });

  describe("交换功能测试", function () {
    it("应该能执行跨池代币交换", async function () {
      // 记录交换前的余额
      const user1Address = await user1.getAddress();
      const balanceABefore = await tokenA.balanceOf(user1Address);
      const balanceCBefore = await tokenC.balanceOf(user1Address);

      // 计算预期输出金额
      const [expectedAmountOut, _] = await router.getAmountsOut(
        await tokenA.getAddress(),
        SWAP_AMOUNT,
        await tokenC.getAddress()
      );

      // 设置滑点容差 (1%)
      const minAmountOut = expectedAmountOut * 99n / 100n; // 使用BigInt原生操作

      // 执行跨池交换
      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1小时后过期
      await router.connect(user1).swapExactTokensForTokens(
        await tokenA.getAddress(),
        SWAP_AMOUNT,
        await tokenC.getAddress(),
        minAmountOut,
        user1Address,
        deadline
      );

      // 验证交换后的余额变化
      const balanceAAfter = await tokenA.balanceOf(user1Address);
      const balanceCAfter = await tokenC.balanceOf(user1Address);

      // TokenA 减少了交换金额
      expect(balanceABefore - balanceAAfter).to.equal(SWAP_AMOUNT);
      
      // TokenC 增加了输出金额（至少等于最小输出金额）
      expect(balanceCAfter - balanceCBefore).to.be.gte(minAmountOut);
      
      console.log(`交换前 A 余额: ${ethers.formatEther(balanceABefore)}`);
      console.log(`交换后 A 余额: ${ethers.formatEther(balanceAAfter)}`);
      console.log(`A 减少: ${ethers.formatEther(balanceABefore - balanceAAfter)}`);
      
      console.log(`交换前 C 余额: ${ethers.formatEther(balanceCBefore)}`);
      console.log(`交换后 C 余额: ${ethers.formatEther(balanceCAfter)}`);
      console.log(`C 增加: ${ethers.formatEther(balanceCAfter - balanceCBefore)}`);
    });

    it("当直接路径存在时应使用直接路径", async function () {
      // 创建直接的 A-C 池子
      await factory.createPool([await tokenA.getAddress(), await tokenC.getAddress()]);
      const poolACAddress = await factory.getPool([await tokenA.getAddress(), await tokenC.getAddress()]);
      const poolAC = (await ethers.getContractFactory("Pool")).attach(poolACAddress);
      
      // 添加流动性到 A-C 池
      await tokenA.approve(poolACAddress, LIQUIDITY_AMOUNT_A);
      await tokenC.approve(poolACAddress, LIQUIDITY_AMOUNT_C);
      await poolAC.addLiquidity(
        [await tokenA.getAddress(), await tokenC.getAddress()],
        [LIQUIDITY_AMOUNT_A, LIQUIDITY_AMOUNT_C]
      );

      // 查找 A 到 C 的路径，应该是直接路径
      const [path, pools] = await router.findBestPath(
        await tokenA.getAddress(), 
        await tokenC.getAddress()
      );

      // 验证是直接路径
      expect(path.length).to.equal(2); // A -> C
      expect(pools.length).to.equal(1); // 一个池子
      expect(pools[0]).to.equal(poolACAddress);

      // 执行交换验证
      const user1Address = await user1.getAddress();
      const [expectedAmountOut, _] = await router.getAmountsOut(
        await tokenA.getAddress(),
        SWAP_AMOUNT,
        await tokenC.getAddress()
      );
      
      const minAmountOut = expectedAmountOut * 99n / 100n;
      
      // 执行直接路径交换
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      await router.connect(user1).swapExactTokensForTokens(
        await tokenA.getAddress(),
        SWAP_AMOUNT,
        await tokenC.getAddress(),
        minAmountOut,
        user1Address,
        deadline
      );
      
      // 验证交换成功
      const balanceCAfter = await tokenC.balanceOf(user1Address);
      expect(balanceCAfter).to.be.gt(0);
    });
  });
});