// require("@nomicfoundation/hardhat-toolbox");

// module.exports = {
//   solidity: {
//     version: "0.8.20",
//     settings: {
//       optimizer: {
//         enabled: true,
//         runs: 200
//       }
//     }
//   },
//   networks: {
//     hardhat: {
//       chainId: 31337
//     },
//     localhost: {
//       url: "http://127.0.0.1:8545"
//     }
//   }
// };

require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true
    }
  }
};