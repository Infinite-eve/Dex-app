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
  const Gamma = NewToken.attach(addresses.tokens.gamma);

  const balanceGammaFrom = await Gamma.balanceOf(`${senderWallet.address}`);
  console.log("Address:", senderWallet.address);
  console.log("Balance Gamma (from):", ethers.formatEther(balanceGammaFrom), "GAMMA"); 

  const balanceGammaToOld = await Gamma.balanceOf(`${recipientAddress}`);
  console.log("Address:", recipientAddress); 
  console.log("Balance Gamma:", ethers.formatEther(balanceGammaToOld), "GAMMA");

  const amount = ethers.parseEther("1000");
  await Gamma.transfer(recipientAddress, amount);
  console.log("Transfer done:", "GAMMA");

  const balanceGammaFromNow = await Gamma.balanceOf(`${senderWallet.address}`);
  console.log("Balance Gamma (from):", ethers.formatEther(balanceGammaFromNow), "GAMMA"); 
  
  const balanceGamma = await Gamma.balanceOf(`${recipientAddress}`);
  console.log("Balance Gamma:", ethers.formatEther(balanceGamma), "GAMMA"); 
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 