const { ethers } = require("hardhat");
const { expect } = require("chai");

async function main() {
  const [deployer, user1, user2, feeCollector] = await ethers.getSigners();

  console.log("\n=== Initial Setup ===");
  console.log("Deployer address:", deployer.address);
  console.log("User1 address:", user1.address);
  console.log("User2 address:", user2.address);
  console.log("Fee Collector address:", feeCollector.address);

  // 部署两个测试代币
  const NewToken = await ethers.getContractFactory("NewToken");
  const token0 = await NewToken.deploy("Alpha", "ALPHA");
  await token0.waitForDeployment();
  console.log("\nToken0 (Alpha) deployed to:", await token0.getAddress());

  const token1 = await NewToken.deploy("Beta", "BETA");
  await token1.waitForDeployment();
  console.log("Token1 (Beta) deployed to:", await token1.getAddress());

  // 部署 Pool 合约
  const Pool = await ethers.getContractFactory("Pool");
  const pool = await Pool.deploy(
    await token0.getAddress(),
    await token1.getAddress(),
    feeCollector.address
  );
  await pool.waitForDeployment();
  console.log("\nPool deployed to:", await pool.getAddress());

  // 给用户分配代币
  console.log("\n=== Distributing Tokens to Users ===");
  await token0.transfer(user1.address, ethers.parseEther("1000"));
  await token1.transfer(user1.address, ethers.parseEther("2000"));
  await token0.transfer(user2.address, ethers.parseEther("1000"));
  await token1.transfer(user2.address, ethers.parseEther("2000"));

  // 用户授权 Pool 合约可以花费其代币
  console.log("\n=== Approving Pool to Spend Tokens ===");
  await token0.connect(user1).approve(pool.getAddress(), ethers.MaxUint256);
  await token1.connect(user1).approve(pool.getAddress(), ethers.MaxUint256);
  await token0.connect(user2).approve(pool.getAddress(), ethers.MaxUint256);
  await token1.connect(user2).approve(pool.getAddress(), ethers.MaxUint256);

  // 测试1: 初始添加流动性
  console.log("\n=== Test 1: Initial Liquidity Addition ===");
  console.log("User1 adding liquidity...");
  await pool.connect(user1).addLiquidity(ethers.parseEther("100"));
  
  // 检查LP代币余额
  const user1InitialLP = await pool.balanceOf(user1.address);
  console.log("User1 LP tokens:", ethers.formatEther(user1InitialLP));
  expect(user1InitialLP).to.equal(ethers.parseEther("100"));

  // 检查池子储备
  const [reserve0, reserve1, totalLP] = await pool.getReserves();
  console.log("Pool reserves - Token0:", ethers.formatEther(reserve0));
  console.log("Pool reserves - Token1:", ethers.formatEther(reserve1));
  console.log("Total LP supply:", ethers.formatEther(totalLP));

  // 测试2: 第二次添加流动性
  console.log("\n=== Test 2: Second Liquidity Addition ===");
  console.log("User2 adding liquidity...");
  await pool.connect(user2).addLiquidity(ethers.parseEther("50"));
  
  const user2InitialLP = await pool.balanceOf(user2.address);
  console.log("User2 LP tokens:", ethers.formatEther(user2InitialLP));
  
  // 检查总LP供应量
  const totalLPAfterSecondAdd = await pool.totalSupply();
  console.log("Total LP supply after second add:", ethers.formatEther(totalLPAfterSecondAdd));

  // 测试3: 代币交换
  console.log("\n=== Test 3: Token Swap ===");
  const swapAmount = ethers.parseEther("10");
  console.log(`User1 swapping ${ethers.formatEther(swapAmount)} Token0 for Token1...`);

  // 获取预期输出量（考虑手续费）
  const expectedOut = await pool.getAmountOut(
    await token0.getAddress(),
    swapAmount,
    await token1.getAddress()
  );
  console.log("Expected output (with fee):", ethers.formatEther(expectedOut));

  // 执行交换
  const user1Token0Before = await token0.balanceOf(user1.address);
  const user1Token1Before = await token1.balanceOf(user1.address);
  await pool.connect(user1).swap(
    await token0.getAddress(),
    swapAmount,
    await token1.getAddress()
  );
  const user1Token0After = await token0.balanceOf(user1.address);
  const user1Token1After = await token1.balanceOf(user1.address);

  // 计算实际消耗和获得的代币数量
  const token0Spent = user1Token0Before - user1Token0After;
  const token1Received = user1Token1After - user1Token1Before;
  console.log("Actual Token0 spent:", ethers.formatEther(token0Spent));
  console.log("Actual Token1 received:", ethers.formatEther(token1Received));

  // 验证实际获得的Token1与预期输出一致
  const outputTolerance = ethers.parseEther("0.002"); // 允许小误差
  expect(token1Received).to.be.closeTo(expectedOut, outputTolerance);

  // 测试4: 提取流动性
  // 在withdraw测试前添加储备检查
  console.log("\n=== Test 4: Withdraw Liquidity ===");

  // 1. 首先获取当前池子储备
  const [reserve0Before, reserve1Before] = await pool.getReserves();
  console.log("池子当前储备:");
  console.log(`Token0: ${ethers.formatEther(reserve0Before)}`);
  console.log(`Token1: ${ethers.formatEther(reserve1Before)}`);

  // 2. 获取用户当前余额和总LP供应量(在提取前)
  const userToken0Before = await token0.balanceOf(user1.address);
  const userToken1Before = await token1.balanceOf(user1.address);
  const lpTotalSupplyBefore = await pool.totalSupply();

  // 3. 执行提取操作
  const withdrawAmount = ethers.parseEther("50"); // 明确指定提取量
  console.log(`User1 withdrawing ${ethers.formatEther(withdrawAmount)} LP...`);
  await pool.connect(user1).withdrawLiquidity(withdrawAmount);

  // 4. 计算理论应得数量 (使用提取前的总LP供应量)
  const expectedToken0 = (withdrawAmount * reserve0Before) / lpTotalSupplyBefore;
  const expectedToken1 = (withdrawAmount * reserve1Before) / lpTotalSupplyBefore;

  // 5. 获取实际结果
  const userToken0After = await token0.balanceOf(user1.address);
  const userToken1After = await token1.balanceOf(user1.address);

  // 6. 打印调试信息
  console.log("\n=== 调试信息 ===");
  console.log(`理论应得: 
    Token0: ${ethers.formatEther(expectedToken0)}
    Token1: ${ethers.formatEther(expectedToken1)}`);
  console.log(`实际获得: 
    Token0: ${ethers.formatEther(userToken0After - userToken0Before)}
    Token1: ${ethers.formatEther(userToken1After - userToken1Before)}`);

  // 7. 验证结果
  const tolerance = ethers.parseEther("0.0001"); // 允许0.0001的误差
  expect(userToken0After - userToken0Before).to.be.closeTo(expectedToken0, tolerance);
  expect(userToken1After - userToken1Before).to.be.closeTo(expectedToken1, tolerance);

  // 测试5: LP激励领取
  console.log("\n=== Test 5: Claim LP Incentives ===");
  console.log("LP激励池余额:", ethers.formatEther(await pool.liquidityProviderIncentives()));
  console.log("用户1 LP余额:", ethers.formatEther(await pool.balanceOf(user1.address)));
  console.log("总LP供应量:", ethers.formatEther(await pool.totalSupply()));
  console.log("User1 claiming LP incentives...");
  await pool.connect(user1).claimLpIncentives(true); // 选择领取Token0
  
  // 检查LP激励池余额
  const lpIncentivesAfterClaim = await pool.liquidityProviderIncentives();
  console.log("LP Incentives after claim:", ethers.formatEther(lpIncentivesAfterClaim));

  // 测试6: 更新费用分配比例
  console.log("\n=== Test 6: Update Fee Shares ===");
  console.log("Updating fee shares to 40% LP, 30% Swapper, 30% Protocol");
  await pool.connect(deployer).setFeeShares(4000, 3000, 3000);
  
  // 验证新比例
  const newLpShare = await pool.lpIncentiveShare();
  const newSwapperShare = await pool.swapperRebateShare();
  const newProtocolShare = await pool.protocolFeeShare();
  console.log("New shares - LP:", newLpShare, "Swapper:", newSwapperShare, "Protocol:", newProtocolShare);

  console.log("\n=== All Tests Completed ===");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});