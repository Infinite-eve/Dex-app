const { ethers } = require("hardhat");

async function main() {
  // Connect to the Hardhat network
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

  // Replace with the private key of the sender account
  //这个一致可以不替换，因为是默认的hardhat账户
  const senderPrivateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // Default Hardhat account #1
  const senderWallet = new ethers.Wallet(senderPrivateKey, provider);

  // Replace with the address of the recipient account
  //这个地址可以替换成你的metamask地址
  const recipientAddress = "0x340BdD53512704732F8F69104d674BB5a5F3D6aD"; // Your address (from MetaMask)

  // Amount to transfer (in Ether)
  const amountInEther = "1000"; // 1 ETH
  const amountInWei = ethers.parseEther(amountInEther);

  // Send the transaction
  console.log(`Sending ${amountInEther} DF from ${senderWallet.address} to ${recipientAddress}...`);
  const tx = await senderWallet.sendTransaction({
    to: recipientAddress,
    value: amountInWei,
  });

  // Wait for the transaction to be mined
  await tx.wait();
  console.log(`Transaction successful with hash: ${tx.hash}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });