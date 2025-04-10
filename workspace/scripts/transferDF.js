const { ethers } = require("hardhat"); // 引入 Hardhat 的 ethers 扩展

async function main() {
  // 通过 --network 参数动态获取网络配置
  // 例如运行命令: npx hardhat run script.js --network localhost
  const network = await ethers.provider.getNetwork();
  console.log(`Connected to network: ${network.name} (Chain ID: ${network.chainId})`);

  // 获取签名者（默认使用 Hardhat 配置中的第一个账户）
  const [senderWallet] = await ethers.getSigners();
  console.log(`Sender address: ${senderWallet.address}`);

  // 接收地址（替换为你的 MetaMask 地址）
  const recipientAddress = "0x4563f36Bb992cD358ABC81cB6991F2fE798Ec6CE";

  // 转账金额（以 ETH 为单位）
  const amountInEther = "1000";
  const amountInWei = ethers.parseEther(amountInEther);

  // 发送交易
  console.log(`Sending ${amountInEther} ETH from ${senderWallet.address} to ${recipientAddress}...`);
  const tx = await senderWallet.sendTransaction({
    to: recipientAddress,
    value: amountInWei,
  });

  // 等待交易确认
  await tx.wait();
  console.log(`Transaction successful. Hash: ${tx.hash}`);

  const balance = await ethers.provider.getBalance(`${recipientAddress}`);
  console.log("Balance:", ethers.formatEther(balance), "ETH"); // 应显示 1000 ETH
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });