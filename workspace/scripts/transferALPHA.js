const { ethers } = require("hardhat");
const addresses = require("../frontend/src/utils/deployed-addresses.json"); 

async function main() {
  // Connect to the Hardhat network
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // 获取签名者（默认使用 Hardhat 配置中的第一个账户）
  const [senderWallet] = await ethers.getSigners();
  console.log(`Sender address: ${senderWallet.address}`);

  // Replace with the address of the recipient account
  //替换自己的地址
  const recipientAddress = "0x51C87a004CEa3f03a77A5398Bb0B7EEb15DAB92f"; // My address (from MetaMask)

  const NewToken = await hre.ethers.getContractFactory("NewToken");
  const Alpha = NewToken.attach(addresses.token0);

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