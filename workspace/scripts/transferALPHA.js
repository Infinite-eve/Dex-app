const { ethers } = require("hardhat");
const addresses = require("../frontend/src/utils/deployed-addresses.json"); 

async function main() {
  // Connect to the Hardhat network
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Replace with the address of the recipient account
  //替换自己的地址
  const recipientAddress = "0x340BdD53512704732F8F69104d674BB5a5F3D6aD"; // My address (from MetaMask)

  const NewToken = await hre.ethers.getContractFactory("NewToken");
  const Alpha = NewToken.attach(addresses.token0);

  const amount = ethers.parseEther("500000");
  await Alpha.transfer(recipientAddress, amount)

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });