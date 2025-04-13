const { isAddress } = require("ethers");



const addresses = require("../frontend/src/utils/deployed-addresses.json"); 

async function main() {
  // Connect to the Hardhat network
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // 获取签名者（默认使用 Hardhat 配置中的第一个账户）
  const [senderWallet] = await ethers.getSigners();
  console.log(`Sender address: ${senderWallet.address}`);

  
  // Replace with the address of the recipient account
  //替换自己的地址
  const recipientAddress = "0x178C4a24C06654425C0f83425FB57590e0327ee0"; // My address (from MetaMask)
  if (isAddress(recipientAddress)) {
      console.log("Valid address");
  } else {
      console.log("Invalid address");
  }
  const NewToken = await hre.ethers.getContractFactory("NewToken");
  const GAMMA = NewToken.attach(addresses.token2);
  
  console.log("gammaAddress:", addresses.token2); 
  const balanceGAMMAFrom = await GAMMA.balanceOf(`${senderWallet.address}`);
  console.log("Address:", senderWallet.address); 
  console.log("Balance GAMMA (from):", ethers.formatEther(balanceGAMMAFrom), "GAMMA"); 

  const balanceGAMMAToOld = await GAMMA.balanceOf(`${recipientAddress}`);
  // 输出账号
  console.log("Address:", recipientAddress);
  console.log("Balance GAMMA:", ethers.formatEther(balanceGAMMAToOld), "GAMMA"); 

  const amount = ethers.parseEther("1000");
  await GAMMA.transfer(recipientAddress, amount)
  console.log("Transfer done:", "GAMMA");

  const balanceGAMMAFromNow = await GAMMA.balanceOf(`${senderWallet.address}`);
  console.log("Balance GAMMA (from):", ethers.formatEther(balanceGAMMAFromNow), "GAMMA");
  
  // 输入当前账号GAMMA币的余额
  const balanceGAMMA = await GAMMA.balanceOf(`${recipientAddress}`);
  console.log("Balance GAMMA:", ethers.formatEther(balanceGAMMA), "GAMMA"); 
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 