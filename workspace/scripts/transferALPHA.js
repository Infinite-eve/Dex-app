const { ethers } = require("hardhat");
const addresses = require("../frontend/src/utils/deployed-addresses.json"); 

async function main() {
  // Connect to the Hardhat network
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // 获取签名者（默认使用 Hardhat 配置中的第一个账户）
  const [senderWallet] = await ethers.getSigners();
  console.log(`Sender address: ${senderWallet.address}`);

  // Replace with the address of the recipient account
  const recipientAddress = "0x4563f36Bb992cD358ABC81cB6991F2fE798Ec6CE"; // My address (from MetaMask)

  const NewToken = await ethers.getContractFactory("NewToken");
  const Alpha = NewToken.attach(addresses.tokens.alpha);

  const balanceAlphaFrom = await Alpha.balanceOf(`${senderWallet.address}`);
  console.log("Address:", senderWallet.address);
  console.log("Balance Alpha (from):", ethers.formatEther(balanceAlphaFrom), "ALPHA"); 
  // console.log("Balance:", ethers.formatEther(balance), "ETH"); 

  const balanceAlphaToOld = await Alpha.balanceOf(`${recipientAddress}`);
  // 输出账号
  console.log("Address:", recipientAddress); 
  console.log("Balance Alpha:", ethers.formatEther(balanceAlphaToOld), "ALPHA");

  const amount = ethers.parseEther("1000");
  await Alpha.transfer(recipientAddress, amount)
  console.log("Transfer done:", "ALPHA");

  const balanceAlphaFromNow = await Alpha.balanceOf(`${senderWallet.address}`);
  console.log("Balance Alpha (from):", ethers.formatEther(balanceAlphaFromNow), "ALPHA"); 
  
  // 输入当前账号alpha币的余额
  const balanceAlpha = await Alpha.balanceOf(`${recipientAddress}`);
  console.log("Balance Alpha:", ethers.formatEther(balanceAlpha), "ALPHA"); 

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });