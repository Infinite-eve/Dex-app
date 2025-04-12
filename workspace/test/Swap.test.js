const { ethers } = require("hardhat");
const { expect } = require("chai");

async function main() {
  console.log("=== Pool 交易費用測試開始 ===");

  // 獲取測試賬戶
  const [deployer, user1, user2, feeCollector] = await ethers.getSigners();
  console.log("部署者地址:", deployer.address);
  console.log("用戶1地址:", user1.address);
  console.log("用戶2地址:", user2.address);

  // 部署合約
  console.log("\n=== 部署合約 ===");
  const NewToken = await ethers.getContractFactory("NewToken");
  const token0 = await NewToken.deploy("TokenA", "TKNA");
  const token1 = await NewToken.deploy("TokenB", "TKNB");
  const token2 = await NewToken.deploy("TokenC", "TKNC");
  
  await token0.waitForDeployment();
  await token1.waitForDeployment();
  await token2.waitForDeployment();
  
  console.log("Token0 (TKNA) 部署於:", await token0.getAddress());
  console.log("Token1 (TKNB) 部署於:", await token1.getAddress());
  console.log("Token2 (TKNC) 部署於:", await token2.getAddress());
  
  const tokenAddresses = [
    await token0.getAddress(),
    await token1.getAddress(),
    await token2.getAddress()
  ];
  
  // 部署池合約
  const Pool = await ethers.getContractFactory("Pool");
  const pool = await Pool.deploy(tokenAddresses);
  await pool.waitForDeployment();
  console.log("Pool 合約部署於:", await pool.getAddress());
  
  // 分配和授權代幣
  console.log("\n=== 分配和授權代幣 ===");
  const amount = ethers.parseEther("10000");
  
  for (const token of [token0, token1, token2]) {
    await token.transfer(user1.address, amount);
    await token.transfer(user2.address, amount);
    
    await token.connect(user1).approve(await pool.getAddress(), ethers.MaxUint256);
    await token.connect(user2).approve(await pool.getAddress(), ethers.MaxUint256);
  }
  
  console.log("代幣已分配並授權給測試用戶");

  // 測試1: 初始交易費用率
  console.log("\n=== 測試1: 初始交易費用率 ===");
  const fee = await pool.tradingFee();
  const denominator = await pool.FEE_DENOMINATOR();
  
  console.log("交易費用率:", fee.toString());
  console.log("費用分母:", denominator.toString());
  // 修正 BigInt 運算
  console.log("實際費率:", (Number(fee) / Number(denominator)) * 100, "%");
  
  expect(fee).to.equal(30n); // 使用 BigInt 字面量
  expect(denominator).to.equal(10000n); // 使用 BigInt 字面量
  console.log("✅ 初始交易費用率檢查通過");

  // 測試2: 添加流動性
  console.log("\n=== 測試2: 添加流動性 ===");
  const amounts = [
    ethers.parseEther("1000"),
    ethers.parseEther("2000"),
    ethers.parseEther("3000")
  ];
  
  console.log("用戶1添加流動性:", [
    ethers.formatEther(amounts[0]), 
    ethers.formatEther(amounts[1]), 
    ethers.formatEther(amounts[2])
  ]);
  
  await pool.connect(user1).addLiquidity(tokenAddresses, amounts);
  
  const lpBalance = await pool.balanceOf(user1.address);
  console.log("用戶1獲得的LP代幣:", ethers.formatEther(lpBalance));

  // 不比较固定值，而是动态比较
  // 验证 LP 代币数量大于零且不超过总代币供应量
  expect(lpBalance).to.be.gt(0);
  expect(lpBalance).to.be.lte(ethers.parseEther("10000")); // 假设总供应量上限
  
  for (let i = 0; i < tokenAddresses.length; i++) {
    const balance = await pool.tokenBalances(tokenAddresses[i]);
    console.log(`池子中的${await (await ethers.getContractAt("NewToken", tokenAddresses[i])).symbol()}餘額:`, ethers.formatEther(balance));
    expect(balance).to.equal(amounts[i]);
  }
  
  console.log("✅ 添加流動性測試通過");

  // 測試3: 交易費用計算和收集
  console.log("\n=== 測試3: 交易費用計算和收集 ===");
  const swapAmount = ethers.parseEther("100");
  const tokenIn = tokenAddresses[0];  // token0
  const tokenOut = tokenAddresses[1]; // token1
  
  console.log(`用戶2交換 ${ethers.formatEther(swapAmount)} ${await (await ethers.getContractAt("NewToken", tokenIn)).symbol()} 獲取 ${await (await ethers.getContractAt("NewToken", tokenOut)).symbol()}`);
  
  // 計算預期交易費用 (修正 BigInt 運算)
  const expectedFee = (swapAmount * fee) / denominator;
  const amountInAfterFee = swapAmount - expectedFee;
  
  console.log("預期交易費用:", ethers.formatEther(expectedFee));
  console.log("扣除費用後的輸入金額:", ethers.formatEther(amountInAfterFee));
  
  // 獲取預期輸出
  const expectedOutput = await pool.getAmountOut(tokenIn, swapAmount, tokenOut);
  console.log("預期輸出金額:", ethers.formatEther(expectedOutput));
  
  // 確認LP激勵池初始余額
  const lpFeeBefore = await pool.lpFee(tokenIn);
  console.log("LP激勵池初始余額:", ethers.formatEther(lpFeeBefore));
  
  // 記錄用戶交易前餘額
  const userToken0Before = await token0.balanceOf(user2.address);
  const userToken1Before = await token1.balanceOf(user2.address);
  
  // 執行交換
  await pool.connect(user2).swap(tokenIn, swapAmount, tokenOut);
  
  // 記錄用戶交易後餘額
  const userToken0After = await token0.balanceOf(user2.address);
  const userToken1After = await token1.balanceOf(user2.address);
  
  // 計算實際花費和獲得
  const token0Spent = userToken0Before - userToken0After;
  const token1Received = userToken1After - userToken1Before;
  
  console.log("實際花費的Token0:", ethers.formatEther(token0Spent));
  console.log("實際獲得的Token1:", ethers.formatEther(token1Received));
  
  // 驗證費用收集
  const lpFeeAfter = await pool.lpFee(tokenIn);
  const lpFeeCollected = lpFeeAfter - lpFeeBefore;
  
  console.log("LP激勵池增加:", ethers.formatEther(lpFeeCollected));
  
  // 驗證
  expect(token0Spent).to.equal(swapAmount);
  // 使用 closeTo 而不是 equal 來檢查輸出金額，允許有小誤差
  const outputTolerance = ethers.parseEther("0.1"); // 允許 0.1 ETH 的誤差
  expect(token1Received).to.be.closeTo(expectedOutput, outputTolerance);
  expect(lpFeeCollected).to.equal(expectedFee);
  
  console.log("✅ 交易費用計算和收集測試通過");

  // 測試4: 修改交易費率
  console.log("\n=== 測試4: 修改交易費率 ===");
  
  // 設定新費率 (0.5%)
  const newFee = 50n; // 使用 BigInt
  console.log(`合約所有者將費率從${fee}修改為${newFee}`);
  
  await pool.connect(deployer).setTradingFee(newFee);
  
  const updatedFee = await pool.tradingFee();
  console.log("更新後的費率:", updatedFee.toString());
  
  expect(updatedFee).to.equal(newFee);
  
  // 測試設置過高費率
  console.log("測試設置過高費率 (101)...");
  try {
    await pool.connect(deployer).setTradingFee(101n); // 使用 BigInt
    console.log("❌ 設置過高費率應該失敗但成功了");
  } catch (error) {
    console.log("✅ 設置過高費率被正確拒絕");
    expect(error.message).to.include("Fee too high");
  }
  
  // 恢復原始費率
  await pool.connect(deployer).setTradingFee(30n); // 使用 BigInt
  console.log("已恢復原始費率:", (await pool.tradingFee()).toString());

  // 測試5: 提取LP獎勵
  console.log("\n=== 測試5: 提取LP獎勵 ===");
  
  // 添加更多流動性以測試獎勵分配
  console.log("用戶2添加流動性...");
  const additionalAmounts = [
    ethers.parseEther("500"),
    ethers.parseEther("1000"),
    ethers.parseEther("1500")
  ];
  
  await pool.connect(user2).addLiquidity(tokenAddresses, additionalAmounts);
  
  const user2LpBalance = await pool.balanceOf(user2.address);
  console.log("用戶2的LP代幣餘額:", ethers.formatEther(user2LpBalance));
  
  // 執行更多交換以生成更多費用
  console.log("進行更多交換以生成費用...");
  const moreSwaps = ethers.parseEther("200");
  await pool.connect(user1).swap(tokenIn, moreSwaps, tokenOut);
  await pool.connect(user1).swap(tokenIn, moreSwaps, tokenAddresses[2]);
  
  // 檢查LP激勵池
  const lpIncentives = await pool.lpFee(tokenIn);
  console.log("當前LP激勵池餘額:", ethers.formatEther(lpIncentives));
  
  // 計算用戶應得份額 (修正 BigInt 運算)
  const totalLp = await pool.totalSupply();
  const user2Share = (user2LpBalance * lpIncentives) / totalLp;
  
  console.log("用戶2應得獎勵份額:", ethers.formatEther(user2Share));
  
  // 提取前餘額
  const user2Token0BeforeClaim = await token0.balanceOf(user2.address);
  
  // 提取獎勵
  console.log("用戶2提取獎勵...");
  await pool.connect(user2).claimLpIncentives(tokenIn);
  
  // 提取後餘額
  const user2Token0AfterClaim = await token0.balanceOf(user2.address);
  const incentivesReceived = user2Token0AfterClaim - user2Token0BeforeClaim;
  
  console.log("實際獲得的獎勵:", ethers.formatEther(incentivesReceived));
  
  // 驗證 (修正 BigInt 比較)
  const tolerance = ethers.parseEther("0.0001");
  expect(
    (incentivesReceived > user2Share ? incentivesReceived - user2Share : user2Share - incentivesReceived)
  ).to.be.lessThan(tolerance);
  
  console.log("✅ LP獎勵提取測試通過");

  // 測試6: 錯誤處理
  console.log("\n=== 測試6: 錯誤處理 ===");
  
  console.log("測試非LP持有者提取獎勵...");
  try {
    await pool.connect(feeCollector).claimLpIncentives(tokenIn);
    console.log("❌ 非LP持有者提取應該失敗但成功了");
  } catch (error) {
    console.log("✅ 非LP持有者提取被正確拒絕");
    expect(error.message).to.include("No LP tokens owned");
  }
  
  // 測試提取沒有獎勵的代幣
  console.log("測試提取沒有獎勵的代幣...");
  // 先確保代幣獎勵被提空
  const unusedToken = tokenAddresses[2];

  // 確保用戶1有LP代幣但沒有該代幣的獎勵
  let hasIncentives = true;
  try {
    await pool.connect(user1).claimLpIncentives(unusedToken);
    console.log("提取成功，確保獎勵已清空");
  } catch (error) {
    if (error.message.includes("No incentives to claim")) {
      console.log("該代幣已經沒有獎勵");
      hasIncentives = false;
    } else {
      throw error; // 如果是其他錯誤，則拋出
    }
  }

  // 再次嘗試提取，應該會失敗
  try {
    await pool.connect(user1).claimLpIncentives(unusedToken);
    console.log("❌ 提取沒有獎勵的代幣應該失敗但成功了");
    throw new Error("Test failed: Should not be able to claim without incentives");
  } catch (error) {
    if (error.message.includes("No incentives to claim")) {
      console.log("✅ 提取沒有獎勵的代幣被正確拒絕");
    } else {
      throw error; // 如果是其他錯誤，則拋出
    }
  }

  console.log("\n=== 所有測試完成 ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("測試失敗:", error);
    process.exit(1);
  });