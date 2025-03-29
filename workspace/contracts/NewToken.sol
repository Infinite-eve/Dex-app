// SPDX-License-Identifier: MIT
//用于创建新的ERC20代币
//该合约继承自OpenZeppelin的ERC20合约
//ERC20是ERC20标准接口，定义了ERC20代币的基本功能

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract NewToken is ERC20 {

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 1000000 * 10**decimals()); //_mint函数用于铸造代币；
        //msg.sender是当前调用合约的账户地址
        //1000000是代币的初始供应量
        //10**decimals()是将代币的小数位数设置为18
    }
    
}