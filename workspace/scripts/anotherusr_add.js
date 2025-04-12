const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  try {
    console.log("开始向流动性池添加资金...");

    // 获取账户 - 使用第一个账户
    const [user] = await ethers.getSigners();
    console.log(`使用账户: ${user.address}`);

    // 直接使用池子地址
    const poolAddress = "0xd8058efe0198ae9dD7D563e1b4938Dcbc86A1F81"; 
    console.log(`使用指定的池子地址: ${poolAddress}`);
    
    // 获取Pool合约实例
    const Pool = await ethers.getContractFactory("Pool");
    const pool = await Pool.attach(poolAddress);
    
    // 检查合约函数接口
    console.log("池子合约函数接口:");
    let hasBalanceOf = false;
    for (const fragment of Pool.interface.fragments) {
      if (fragment.type === "function") {
        if (fragment.name === "balanceOf") {
          hasBalanceOf = true;
        }
      }
    }
    console.log(`合约${hasBalanceOf ? "有" : "没有"} balanceOf 函数`);
    
    // 获取代币地址
    const alphaAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // Alpha代币地址
    const betaAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";  // Beta代币地址
    const gammaAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"; // Gamma代币地址

    let tokenAddresses = [alphaAddress, betaAddress, gammaAddress];
    console.log(`使用代币: ${tokenAddresses}`);

    // 在添加流动性前尝试检索池中的实际代币
    const poolTokens = [];
    try {
      let index = 0;
      while (true) {
        try {
          const tokenAddr = await pool.i_tokens_addresses(index);
          poolTokens.push(tokenAddr);
          index++;
        } catch (e) {
          break; // 已获取所有代币
        }
      }
      console.log("池中代币:", poolTokens);
    } catch (error) {
      console.log("无法获取池子中的代币:", error.message);
    }

    // 如果成功获取池子代币，使用这些代币和顺序
    if (poolTokens.length > 0) {
      tokenAddresses = poolTokens;
    }

    // 获取代币合约实例并授权
    const tokenInstances = [];
    for (let i = 0; i < tokenAddresses.length; i++) {
      const Token = await ethers.getContractFactory("NewToken");
      const token = await Token.attach(tokenAddresses[i]);
      tokenInstances.push(token);
      
      // 查询代币余额
      const balance = await token.balanceOf(user.address);
      console.log(`账户 ${user.address} 持有 ${ethers.formatEther(balance)} ${await token.symbol()}`);

      // 授权代币给池子合约
      const approveAmount = ethers.parseEther("1000"); // 授权1000个代币
      await token.connect(user).approve(poolAddress, approveAmount);
      console.log(`已授权 ${ethers.formatEther(approveAmount)} ${await token.symbol()} 给池子合约`);
    }

    // 查询池子中代币余额
    console.log("添加流动性前池子中的代币余额:");
    for (let i = 0; i < tokenAddresses.length; i++) {
      try {
        const balance = await pool.tokenBalances(tokenAddresses[i]);
        console.log(`池子中 ${await tokenInstances[i].symbol()} 余额: ${ethers.formatEther(balance)}`);
      } catch (error) {
        console.log(`无法获取池子中 ${await tokenInstances[i].symbol()} 余额`);
      }
    }

    // 在脚本中添加这些代码
    console.log("直接从代币合约查询池子中的余额:");
    for (let i = 0; i < tokenInstances.length; i++) {
      const token = tokenInstances[i];
      const balance = await token.balanceOf(poolAddress);
      console.log(`池子中 ${await token.symbol()} 余额 (从代币合约查询): ${ethers.formatEther(balance)}`);
    }

    // 确认发送了代币到池子
    for (let i = 0; i < tokenInstances.length; i++) {
      // 在添加流动性后直接检查代币余额
      const token = tokenInstances[i];
      const balanceBefore = await token.balanceOf(poolAddress);
      console.log(`添加前池子中 ${await token.symbol()} 余额: ${ethers.formatEther(balanceBefore)}`);
    }

    // 尝试添加流动性
    try {
      const amount0 = ethers.parseEther("10"); // 10个Alpha代币 
      const amount1 = ethers.parseEther("30"); // 30个Beta代币
      const amount2 = ethers.parseEther("20"); // 20个Gamma代币
      const amounts = [amount0, amount1, amount2];
      
      console.log("尝试添加流动性: addLiquidity(address[], uint256[])");
      console.log("代币数量:", amounts.map(a => ethers.formatEther(a)));
      
      const tx = await pool.connect(user).addLiquidity(tokenAddresses, amounts);
      console.log("交易已发送，等待确认...");
      const receipt = await tx.wait();
      console.log(`流动性添加成功，交易哈希: ${receipt.hash}`);
      console.log(`Gas使用: ${receipt.gasUsed.toString()}`);
      
      // 检查事件
      if (receipt.logs) {
        console.log(`交易包含 ${receipt.logs.length} 个日志事件`);
        for (let i = 0; i < receipt.logs.length; i++) {
          const log = receipt.logs[i];
          try {
            const parsedLog = pool.interface.parseLog(log);
            if (parsedLog) {
              console.log(`事件: ${parsedLog.name}`);
              console.log(`参数: ${JSON.stringify(parsedLog.args)}`);
            }
          } catch (error) {
            // 解析失败，跳过
          }
        }
      }
      
      // 直接进行下一步操作
      console.log("添加流动性后池子中的代币余额:");
      for (let i = 0; i < tokenAddresses.length; i++) {
        try {
          const balance = await pool.tokenBalances(tokenAddresses[i]);
          console.log(`池子中 ${await tokenInstances[i].symbol()} 余额: ${ethers.formatEther(balance)}`);
        } catch (error) {
          console.log(`无法获取池子中 ${await tokenInstances[i].symbol()} 余额`);
        }
      }
      
      // 同步后再次检查
      for (let i = 0; i < tokenInstances.length; i++) {
        const token = tokenInstances[i];
        const balanceAfter = await token.balanceOf(poolAddress);
        console.log(`添加后池子中 ${await token.symbol()} 余额: ${ethers.formatEther(balanceAfter)}`);
      }

      // 尝试使用不同方法获取LP代币余额
      try {
        console.log("尝试获取LP余额...");
        
        // 方法1：直接调用balanceOf
        const lpBalance = await pool.balanceOf(user.address);
        console.log(`账户LP余额: ${ethers.formatEther(lpBalance)}`);
      } catch (error) {
        console.log("无法获取LP余额，尝试其他方法...");
        
        try {
          // 方法2：通过低级调用获取余额
          const lpTokenInterface = new ethers.Interface(["function balanceOf(address) view returns (uint256)"]);
          const data = lpTokenInterface.encodeFunctionData("balanceOf", [user.address]);
          const result = await ethers.provider.call({
            to: poolAddress,
            data
          });
          const decoded = lpTokenInterface.decodeFunctionResult("balanceOf", result);
          console.log(`账户LP余额 (低级调用): ${ethers.formatEther(decoded[0])}`);
        } catch (error2) {
          console.log("无法通过低级调用获取LP余额");
        }
      }
    } catch (error) {
      console.log("添加流动性失败:", error.message);
    }

    console.log("流动性添加操作完成");

  } catch (error) {
    console.error("脚本执行失败:", error);
    // 打印更详细的错误信息
    if (error.reason) console.error("错误原因:", error.reason);
    if (error.code) console.error("错误代码:", error.code);
    if (error.data) console.error("错误数据:", error.data);
  }
}



main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("未捕获的错误:", error);
    process.exit(1);
  });