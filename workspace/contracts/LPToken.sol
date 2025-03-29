// SPDX-License-Identifier: MIT
//LPToken合约用于创建LP代币
//LP代币是用于表示流动性池中代币份额的代币
//该合约继承自OpenZeppelin的ERC20合约
//ERC20是ERC20标准接口，定义了ERC20代币的基本功能

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LPToken is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
    //初始供应量为0，无须铸造（_mint函数)
}