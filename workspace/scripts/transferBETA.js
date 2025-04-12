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
  const recipientAddress = "0x340BdD53512704732F8F69104d674BB5a5F3D6aD"; // My address (from MetaMask)

  const NewToken = await hre.ethers.getContractFactory("NewToken");
  const BETA = NewToken.attach(addresses.token1);

  const balanceBETAFrom = await BETA.balanceOf(`${senderWallet.address}`);
  console.log("Address:", senderWallet.address); 
  console.log("Balance BETA (from):", ethers.formatEther(balanceBETAFrom), "BETA"); 
  // console.log("Balance:", ethers.formatEther(balance), "ETH"); 

  const balanceBETAToOld = await BETA.balanceOf(`${recipientAddress}`);
  // 输出账号
  console.log("Address:", recipientAddress);
  console.log("Balance BETA:", ethers.formatEther(balanceBETAToOld), "BETA"); 

  const amount = ethers.parseEther("1000");
  await BETA.transfer(recipientAddress, amount)
  console.log("Transfer done:", "BETA");

  const balanceBETAFromNow = await BETA.balanceOf(`${senderWallet.address}`);
  console.log("Balance BETA (from):", ethers.formatEther(balanceBETAFromNow), "BETA");
  
  // 输入当前账号BETA币的余额
  const balanceBETA = await BETA.balanceOf(`${recipientAddress}`);
  console.log("Balance BETA:", ethers.formatEther(balanceBETA), "BETA"); 

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });