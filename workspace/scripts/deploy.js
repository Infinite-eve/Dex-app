const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const poolConfigs = require("./poolConfig");

async function main() {
<<<<<<< Updated upstream

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

=======
  await hre.network.provider.send("hardhat_reset");
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy tokens
>>>>>>> Stashed changes
  const NewToken = await hre.ethers.getContractFactory("NewToken");
  const tokens = {};

  // Deploy all tokens first
  for (const config of poolConfigs) {
    for (const tokenName of config.tokens) {
      if (!tokens[tokenName]) {
        const token = await NewToken.deploy(tokenName, tokenName);
        await token.waitForDeployment();
        const tokenAddress = await token.getAddress();
        tokens[tokenName] = {
          contract: token,
          address: tokenAddress
        };
        console.log(`${tokenName} deployed to:`, tokenAddress);
      }
    }
  }

<<<<<<< Updated upstream
  // Deploy Beta
  const token1 = await NewToken.deploy("Beta", "BETA");
  await token1.waitForDeployment();
  console.log("Beta deployed to:", await token1.getAddress());

  // Deploy the Pool
  const Pool = await hre.ethers.getContractFactory("Pool");
  const pool = await Pool.deploy(
    await token0.getAddress(),
    await token1.getAddress()
  );
  await pool.waitForDeployment();
  console.log("Pool deployed to:", await pool.getAddress());
=======
  // Deploy Factory contract
  const Factory = await hre.ethers.getContractFactory("Factory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("Factory deployed to:", factoryAddress);

  // Create pools based on configurations
  const poolAddresses = {};
  for (const config of poolConfigs) {
    const tokenAddresses = config.tokens.map(tokenName => tokens[tokenName].address);
    const tx = await factory.createPool(tokenAddresses);
    await tx.wait();
    
    const poolAddress = await factory.getPool(tokenAddresses);
    poolAddresses[config.name] = poolAddress;
    console.log(`Pool ${config.name} deployed to:`, poolAddress);
  }
>>>>>>> Stashed changes

    // Create utils directory if it doesn't exist
    const utilsPath = path.join(__dirname, "../frontend/src/utils");
    if (!fs.existsSync(utilsPath)) {
      fs.mkdirSync(utilsPath, { recursive: true });
    }

  // Write contract addresses to file
  const addresses = {
<<<<<<< Updated upstream
    token0: await token0.getAddress(),
    token1: await token1.getAddress(),
    pool: await pool.getAddress(),
=======
    tokens: Object.fromEntries(
      Object.entries(tokens).map(([name, token]) => [name.toLowerCase(), token.address])
    ),
    pools: poolAddresses,
    factory: factoryAddress
>>>>>>> Stashed changes
  };

  // Write data to the file
  fs.writeFileSync(
    path.join(utilsPath, "deployed-addresses.json"),
    JSON.stringify(addresses, null, 2),
    { flag: 'w' }
  );
  console.log("\nContract addresses have been written to deployed-addresses.json");

    // Export ABIs
    const artifacts = {
      NewToken: await hre.artifacts.readArtifact("NewToken"),
      LPToken: await hre.artifacts.readArtifact("LPToken"),
      Pool: await hre.artifacts.readArtifact("Pool")
    };

    const abis = {
      NewToken: artifacts.NewToken.abi,
      LPToken: artifacts.LPToken.abi,
      Pool: artifacts.Pool.abi
    };

<<<<<<< Updated upstream

    // Write data to the file (creates the file if it doesn't exist)
    fs.writeFileSync(path.join(utilsPath, "contract-abis.json"),
    JSON.stringify(abis, null, 2), { flag: 'w' }); // 'w' flag ensures the file is created or overwritten
    console.log("Contract ABIs have been written to contract-abis.json", { flag: 'w' });

=======
  fs.writeFileSync(
    path.join(utilsPath, "contract-abis.json"),
    JSON.stringify(abis, null, 2),
    { flag: 'w' }
  );
  console.log("Contract ABIs have been written to contract-abis.json");
>>>>>>> Stashed changes
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });