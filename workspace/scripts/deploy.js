const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const NewToken = await hre.ethers.getContractFactory("NewToken");

  // Deploy Alpha
  const token0 = await NewToken.deploy("Alpha", "ALPHA");
  await token0.waitForDeployment();
  console.log("Alpha deployed to:", await token0.getAddress());

  // Deploy Beta
  const token1 = await NewToken.deploy("Beta", "BETA");
  await token1.waitForDeployment();
  console.log("Beta deployed to:", await token1.getAddress());

  // Deploy the Pool
  const Pool = await hre.ethers.getContractFactory("Pool");
  console.log("Deploying Pool contract...");
  const pool = await Pool.deploy(
    await token0.getAddress(),
    await token1.getAddress(),
    deployer.address // feeCollector 地址
  );
  console.log("Deployment transaction hash:", pool.deploymentTransaction().hash);
  await pool.waitForDeployment();
  console.log("Pool deployed to:", await pool.getAddress());

  // Create utils directory if it doesn't exist
  const utilsPath = path.join(__dirname, "../frontend/src/utils");
  if (!fs.existsSync(utilsPath)) {
    fs.mkdirSync(utilsPath, { recursive: true });
  }

  // Write contract addresses to file
  const addresses = {
    token0: await token0.getAddress(),
    token1: await token1.getAddress(),
    pool: await pool.getAddress(),
  };

  fs.writeFileSync(
    path.join(utilsPath, "deployed-addresses.json"),
    JSON.stringify(addresses, null, 2),
    { flag: "w" }
  );
  console.log("\nContract addresses have been written to deployed-addresses.json");

  // Export ABIs
  const artifacts = {
    NewToken: await hre.artifacts.readArtifact("NewToken"),
    LPToken: await hre.artifacts.readArtifact("LPToken"),
    Pool: await hre.artifacts.readArtifact("Pool"),
  };

  const abis = {
    NewToken: artifacts.NewToken.abi,
    LPToken: artifacts.LPToken.abi,
    Pool: artifacts.Pool.abi,
  };

  fs.writeFileSync(
    path.join(utilsPath, "contract-abis.json"),
    JSON.stringify(abis, null, 2),
    { flag: "w" }
  );
  console.log("Contract ABIs have been written to contract-abis.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });