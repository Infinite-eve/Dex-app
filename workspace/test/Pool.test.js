const { expect } = require("chai");
const { ethers } = require("hardhat");


describe("Pool Contract", function () {

  let Token0, Token1, Token2, Pool;
  let token0, token1, token2, pool;
  let owner, user;

  before(async function () {

    // Deploy three tokens
    NewToken = await hre.ethers.getContractFactory("NewToken");
    
    // Deploy Alpha
    token0 = await NewToken.deploy("Alpha", "ALPHA");
    await token0.waitForDeployment();

    // Deploy Beta
    token1 = await NewToken.deploy("Beta", "BETA");
    await token1.waitForDeployment();
    
    // Deploy Gamma
    token2 = await NewToken.deploy("Gamma", "GAMMA");
    await token2.waitForDeployment();

    // Deploy the Pool
    Pool = await hre.ethers.getContractFactory("Pool");
    pool = await Pool.deploy(
      await token0.getAddress(),
      await token1.getAddress(),
      await token2.getAddress()
    );
    await pool.waitForDeployment();

    [deployer, user] = await ethers.getSigners();

    // Send tokens to user for testing
    await token0.transfer(user.address, ethers.parseEther("1000"));
    await token1.transfer(user.address, ethers.parseEther("1000"));
    await token2.transfer(user.address, ethers.parseEther("1000"));
  });

  beforeEach(async function () {
    // Reset approvals for each test
    await token0.connect(user).approve(pool.getAddress(), ethers.parseEther("1000000"));
    await token1.connect(user).approve(pool.getAddress(), ethers.parseEther("1000000"));
    await token2.connect(user).approve(pool.getAddress(), ethers.parseEther("1000000"));
  });

  let snapshotId;

  before(async function () {
    // Take a snapshot before running any tests
    snapshotId = await ethers.provider.send("evm_snapshot", []);
  });

  afterEach(async function () {
    // Revert to the snapshot after each describe block
    await ethers.provider.send("evm_revert", [snapshotId]);
    // Take a new snapshot for the next test
    snapshotId = await ethers.provider.send("evm_snapshot", []);
  });

  describe("addLiquidity", function () {

    it("should add initial liquidity and mint LP tokens", async function () {

      const amount0 = ethers.parseEther("100");
      const tx = await pool.connect(user).addLiquidity(amount0);
      
      // Check LP tokens minted
      const lpBalance = await pool.balanceOf(user.address);
      expect(lpBalance).to.equal(amount0);

      // Check reserves updated correctly
      const [res0, res1, res2] = await pool.getReserves();
      expect(res0).to.equal(amount0);
      expect(res1).to.equal(amount0 * 2n); // INITIAL_RATIO_1 = 2
      expect(res2).to.equal(amount0 * 3n); // INITIAL_RATIO_2 = 3

      // Check event emission
      await expect(tx)
        .to.emit(pool, "AddedLiquidity")
        .withArgs(
          amount0, 
          token0.getAddress(), 
          amount0, 
          token1.getAddress(), 
          amount0 * 2n,
          token2.getAddress(),
          amount0 * 3n
        );
    });

    it("should add liquidity proportionally when pool has reserves", async function () {
      // Initial liquidity
      const amount0 = ethers.parseEther("100");
      await pool.connect(user).addLiquidity(amount0);

      // Additional liquidity
      const addAmount0 = ethers.parseEther("50");
      const tx = await pool.connect(user).addLiquidity(addAmount0);

      // Expected LP tokens: (50 * 100) / 100 = 50
      const expectedLP = addAmount0;
      const lpBalance = await pool.balanceOf(user.address);
      expect(lpBalance).to.equal(amount0 + expectedLP);

      // Check reserves
      const [res0, res1, res2] = await pool.getReserves();
      expect(res0).to.equal(amount0 + addAmount0);
      expect(res1).to.equal(ethers.parseEther("300")); // 200 + 100
      expect(res2).to.equal(ethers.parseEther("450")); // 300 + 150

      // Check event
      await expect(tx)
        .to.emit(pool, "AddedLiquidity")
        .withArgs(
          expectedLP, 
          token0.getAddress(), 
          addAmount0, 
          token1.getAddress(), 
          addAmount0 * 2n,
          token2.getAddress(),
          addAmount0 * 3n
        );
    });

    it("should revert when adding zero liquidity", async function () {
      await expect(pool.connect(user).addLiquidity(0))
        .to.be.revertedWith("Amount must be greater than 0");
    });
  });

  describe("swap", function () {
    beforeEach(async function () {
      // Add initial liquidity: 100 Token0, 200 Token1, 300 Token2
      await pool.connect(user).addLiquidity(ethers.parseEther("100"));
    });

    it("should swap Alpha for Beta correctly", async function () {
      const swapAmount = ethers.parseEther("100");
      const expectedOutput = ethers.parseEther("100"); // (200 * 100) / (100 + 100) = 100

      // Perform swap
      const tx = await pool.connect(user).swap(token0.getAddress(), swapAmount, token1.getAddress());

      // Check user's balances
      const finalBal0 = await token0.balanceOf(user.address);
      const finalBal1 = await token1.balanceOf(user.address);
      expect(finalBal0).to.equal(ethers.parseEther("800")); // 1000 - 100 (initial) - 100 (swap)
      expect(finalBal1).to.equal(ethers.parseEther("900")); // 1000 - 200 (initial) + 100 (swap)

      // Check reserves
      const [res0, res1, res2] = await pool.getReserves();
      expect(res0).to.equal(ethers.parseEther("200")); // 100 + 100
      expect(res1).to.equal(ethers.parseEther("100")); // 200 - 100
      expect(res2).to.equal(ethers.parseEther("300")); // 不变

      // Check event
      await expect(tx)
        .to.emit(pool, "Swapped")
        .withArgs(token0.getAddress(), swapAmount, token1.getAddress(), expectedOutput);
    });

    it("should swap Alpha for Gamma correctly", async function () {
      const swapAmount = ethers.parseEther("100");
      const expectedOutput = ethers.parseEther("150"); // (300 * 100) / (100 + 100) = 150

      // Perform swap
      const tx = await pool.connect(user).swap(token0.getAddress(), swapAmount, token2.getAddress());

      // Check user's balances
      const finalBal0 = await token0.balanceOf(user.address);
      const finalBal2 = await token2.balanceOf(user.address);
      expect(finalBal0).to.equal(ethers.parseEther("800")); // 1000 - 100 (initial) - 100 (swap)
      expect(finalBal2).to.equal(ethers.parseEther("850")); // 1000 - 300 (initial) + 150 (swap)

      // Check reserves
      const [res0, res1, res2] = await pool.getReserves();
      expect(res0).to.equal(ethers.parseEther("200")); // 100 + 100
      expect(res1).to.equal(ethers.parseEther("200")); // 不变
      expect(res2).to.equal(ethers.parseEther("150")); // 300 - 150

      // Check event
      await expect(tx)
        .to.emit(pool, "Swapped")
        .withArgs(token0.getAddress(), swapAmount, token2.getAddress(), expectedOutput);
    });

    it("should swap Beta for Gamma correctly", async function () {
      const swapAmount = ethers.parseEther("100");
      const expectedOutput = ethers.parseEther("100"); // (300 * 100) / (200 + 100) = 100

      // Perform swap
      const tx = await pool.connect(user).swap(token1.getAddress(), swapAmount, token2.getAddress());

      // Check user's balances
      const finalBal1 = await token1.balanceOf(user.address);
      const finalBal2 = await token2.balanceOf(user.address);
      expect(finalBal1).to.equal(ethers.parseEther("800")); // 1000 - 200 (initial) - 100 (swap)
      expect(finalBal2).to.equal(ethers.parseEther("800")); // 1000 - 300 (initial) + 100 (swap)

      // Check reserves
      const [res0, res1, res2] = await pool.getReserves();
      expect(res0).to.equal(ethers.parseEther("100")); // 不变
      expect(res1).to.equal(ethers.parseEther("300")); // 200 + 100
      expect(res2).to.equal(ethers.parseEther("200")); // 300 - 100

      // Check event
      await expect(tx)
        .to.emit(pool, "Swapped")
        .withArgs(token1.getAddress(), swapAmount, token2.getAddress(), expectedOutput);
    });

    it("should revert for invalid token pairs", async function () {
      await expect(pool.connect(user).swap(token0.getAddress(), 100, token0.getAddress()))
        .to.be.revertedWith("Same tokens");
    });

    it("should revert for zero swap amount", async function () {
      await expect(pool.connect(user).swap(token0.getAddress(), 0, token1.getAddress()))
        .to.be.revertedWith("Zero amount");
    });
  });

  describe("getRequiredAmounts", function () {
    it("should return initial ratios when pool is empty", async function () {
      const amount0 = ethers.parseEther("100");
      const [amount1, amount2] = await pool.getRequiredAmounts(amount0);
      expect(amount1).to.equal(amount0 * 2n); // INITIAL_RATIO_1 = 2
      expect(amount2).to.equal(amount0 * 3n); // INITIAL_RATIO_2 = 3
    });

    it("should return proportional amounts when pool has reserves", async function () {
      await pool.connect(user).addLiquidity(ethers.parseEther("100"));
      const amount0 = ethers.parseEther("50");
      const [amount1, amount2] = await pool.getRequiredAmounts(amount0);
      expect(amount1).to.equal(ethers.parseEther("100")); // (50 * 200) / 100
      expect(amount2).to.equal(ethers.parseEther("150")); // (50 * 300) / 100
    });
  });

  describe("getAmountOut", function () {
    beforeEach(async function () {
      await pool.connect(user).addLiquidity(ethers.parseEther("100"));
    });

    it("should calculate correct output for Token0 to Token1", async function () {
      const amountIn = ethers.parseEther("100");
      const amountOut = await pool.getAmountOut(token0.getAddress(), amountIn, token1.getAddress());
      expect(amountOut).to.equal(ethers.parseEther("100")); // (200 * 100) / (100 + 100)
    });

    it("should calculate correct output for Token1 to Token0", async function () {
      // First swap to change reserves to 200 Token0, 100 Token1
      await pool.connect(user).swap(token0.getAddress(), ethers.parseEther("100"), token1.getAddress());

      const amountIn = ethers.parseEther("50");
      const amountOut = await pool.getAmountOut(token1.getAddress(), amountIn, token0.getAddress());
      const expected = amountIn * 200n / (100n + 50n); // (200 * 50) / 150 ≈ 66.666...
      expect(amountOut).to.equal(expected);
    });

    it("should calculate correct output for Token0 to Token2", async function () {
      const amountIn = ethers.parseEther("100");
      const amountOut = await pool.getAmountOut(token0.getAddress(), amountIn, token2.getAddress());
      expect(amountOut).to.equal(ethers.parseEther("150")); // (300 * 100) / (100 + 100)
    });

    it("should calculate correct output for Token2 to Token1", async function () {
      const amountIn = ethers.parseEther("100");
      const amountOut = await pool.getAmountOut(token2.getAddress(), amountIn, token1.getAddress());
      expect(amountOut).to.equal(ethers.parseEther("50")); // (200 * 100) / (300 + 100)
    });
  });

  describe("withdrawingliquidity", function () {
    beforeEach(async function () {
      // Add initial liquidity: 100 Token0, 200 Token1, 300 Token2
      await pool.connect(user).addLiquidity(ethers.parseEther("100"));
    });

    it("should withdraw liquidity correctly", async function () {
      const withdrawAmount0 = ethers.parseEther("50");
      
      // Get LP balance before withdrawal
      const lpBalanceBefore = await pool.balanceOf(user.address);
      
      // Get token balances before withdrawal
      const balanceBefore0 = await token0.balanceOf(user.address);
      const balanceBefore1 = await token1.balanceOf(user.address);
      const balanceBefore2 = await token2.balanceOf(user.address);
      
      // Withdraw liquidity
      const tx = await pool.connect(user).withdrawingliquidity(withdrawAmount0);
      
      // Expected LP burned: (50 * 100) / 100 = 50
      const expectedLPBurned = withdrawAmount0;
      
      // Get LP balance after withdrawal
      const lpBalanceAfter = await pool.balanceOf(user.address);
      expect(lpBalanceBefore - lpBalanceAfter).to.equal(expectedLPBurned);
      
      // Check token balances after withdrawal
      const balanceAfter0 = await token0.balanceOf(user.address);
      const balanceAfter1 = await token1.balanceOf(user.address);
      const balanceAfter2 = await token2.balanceOf(user.address);
      
      expect(balanceAfter0 - balanceBefore0).to.equal(withdrawAmount0);
      expect(balanceAfter1 - balanceBefore1).to.equal(withdrawAmount0 * 2n);
      expect(balanceAfter2 - balanceBefore2).to.equal(withdrawAmount0 * 3n);
      
      // Check reserves after withdrawal
      const [res0, res1, res2] = await pool.getReserves();
      expect(res0).to.equal(ethers.parseEther("50")); // 100 - 50
      expect(res1).to.equal(ethers.parseEther("100")); // 200 - 100
      expect(res2).to.equal(ethers.parseEther("150")); // 300 - 150
      
      // Check event
      await expect(tx)
        .to.emit(pool, "WithdrawLiquidity")
        .withArgs(
          expectedLPBurned, 
          token0.getAddress(), 
          withdrawAmount0, 
          token1.getAddress(), 
          withdrawAmount0 * 2n,
          token2.getAddress(),
          withdrawAmount0 * 3n
        );
    });
  });
});