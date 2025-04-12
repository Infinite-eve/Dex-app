const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {

  await hre.network.provider.send("hardhat_reset");
  // 默认取第一个
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const nonce = await deployer.getNonce();

  const NewToken = await hre.ethers.getContractFactory("NewToken");

  // Deploy Alpha
  const token0 = await NewToken.deploy("Alpha", "ALPHA");
  await token0.waitForDeployment();
  console.log("Alpha deployed to:", await token0.getAddress());

  // Deploy Beta
  const token1 = await NewToken.deploy("Beta", "BETA");
  await token1.waitForDeployment();
  console.log("Beta deployed to:", await token1.getAddress());

  // Deploy Gamma (第三个代币)
  const token2 = await NewToken.deploy("Gamma", "GAMMA");
  await token2.waitForDeployment();
  console.log("Gamma deployed to:", await token2.getAddress());

  // 部署Factory合约
  const Factory = await hre.ethers.getContractFactory("Factory");//类/工厂大写通过 getContractFactory 获取的合约工厂对象（ContractFactory 类型），用于部署合约
  const factory = await Factory.deploy();//部署后的合约实例
  await factory.waitForDeployment();
  console.log("Factory deployed to:", await factory.getAddress());

  // 使用Factory创建带有三个代币的Pool
  const addresses_token_pool1 = [
    await token0.getAddress(),
    await token1.getAddress(),
    await token2.getAddress()
  ];
  const tx1 = await factory.createPool(
    addresses_token_pool1
  );
  await tx1.wait();
  
  // 获取创建的池子地址
  const pool1Address = await factory.getPool(
    addresses_token_pool1
  );
  console.log("Pool 1 (Alpha-Beta-Gamma) deployed to:", pool1Address);

  // 创建第二个池子 (Alpha-Beta)
  const addresses_token_pool2 = [
    await token0.getAddress(),
    await token1.getAddress()
  ];
  const tx2 = await factory.createPool(
    addresses_token_pool2
  );
  await tx2.wait();
  
  // 获取创建的池子地址
  const pool2Address = await factory.getPool(
    addresses_token_pool2
  );
  console.log("Pool 2 (Alpha-Beta) deployed to:", pool2Address);

  // 创建第三个池子 (Beta-Gamma)
  const addresses_token_pool3 = [
    await token1.getAddress(),
    await token2.getAddress()
  ];
  const tx3 = await factory.createPool(
    addresses_token_pool3
  );
  await tx3.wait();
  
  // 获取创建的池子地址
  const pool3Address = await factory.getPool(
    addresses_token_pool3
  );
  console.log("Pool 3 (Beta-Gamma) deployed to:", pool3Address);

  // Create utils directory if it doesn't exist
  const utilsPath = path.join(__dirname, "../frontend/src/utils");
  if (!fs.existsSync(utilsPath)) {
    fs.mkdirSync(utilsPath, { recursive: true });
  }

  // Write contract addresses to file
  const addresses = {
    token0: await token0.getAddress(),
    token1: await token1.getAddress(),
    token2: await token2.getAddress(),
    pools: {
      pool1: {
        address: pool1Address,
        tokens: ["Alpha", "Beta", "Gamma"],
        pair: "ALPHA-BETA-GAMMA"
      },
      pool2: {
        address: pool2Address,
        tokens: ["Alpha", "Beta"],
        pair: "ALPHA-BETA"
      }, 
      pool3: {
        address: pool3Address,
        tokens: ["Beta", "Gamma"],
        pair: "BETA-GAMMA"
      }
    },
    factory: await factory.getAddress()
  };

  // Write data to the file (creates the file if it doesn't exist)
  fs.writeFileSync(path.join(utilsPath, "deployed-addresses.json"),
  JSON.stringify(addresses, null, 2), { flag: 'w' }); // 'w' flag ensures the file is created or overwritten
  console.log("\nContract addresses have been written to deployed-addresses.json");

  // Export ABIs
  const artifacts = {
    NewToken: await hre.artifacts.readArtifact("NewToken"),
    LPToken: await hre.artifacts.readArtifact("LPToken"),
    Pool: await hre.artifacts.readArtifact("Pool"),
    Factory: await hre.artifacts.readArtifact("Factory")
  };

  const abis = {
    NewToken: artifacts.NewToken.abi,
    LPToken: artifacts.LPToken.abi,
    Pool: artifacts.Pool.abi,
    Factory: artifacts.Factory.abi,
  };

  // Write data to the file (creates the file if it doesn't exist)
  fs.writeFileSync(path.join(utilsPath, "contract-abis.json"),
  JSON.stringify(abis, null, 2), { flag: 'w' }); // 'w' flag ensures the file is created or overwritten
  console.log("Contract ABIs have been written to contract-abis.json");

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });