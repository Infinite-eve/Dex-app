// SPDX-License-Identifier: MIT
//Pool合约用于创建流动性池
//流动性池是用于存储和交换两种ERC20代币的合约
//该合约继承自LPToken合约
//LPToken是用于表示流动性池中代币份额的代币

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LPToken.sol";

contract Pool is LPToken, ReentrancyGuard {
    IERC20 immutable i_token0;//对 ERC-20 代币合约的不可变引用
    IERC20 immutable i_token1;

    address immutable i_token0_address;//对 ERC-20 地址的不可变引用
    address immutable i_token1_address;

    // 在这里添加 factory 变量声明
    address public immutable factory;

    //初始比例为1:2，即1个token0需要2个token1
    //可以修改初始比例
    uint256 constant INITIAL_RATIO = 2; //token0:token1 = 1:2
    
    //tokenBalances是一个映射，用于存储每个代币的余额
    //key是代币地址，value是代币余额
    mapping(address => uint256) tokenBalances;
    

    //事件用于记录流动性池中的代币添加和交换操作
    event AddedLiquidity(
        uint256 indexed lpToken,
        address token0,
        uint256 indexed amount0,
        address token1,
        uint256 indexed amount1
    );

    event WithdrawLiquidity(
        uint256 indexed lpToken,
        address token0,
        uint256 indexed amount0,
        address token1,
        uint256 indexed amount1
    );

    event Swapped(
        address tokenIn,
        uint256 indexed amountIn,
        address tokenOut,
        uint256 indexed amountOut
    );

    //构造函数，用于初始化流动性池
    //token0和token1是流动性池中的两种代币
    //LPToken是用于表示流动性池中代币份额的代币
    // 替换原有的构造函数
    constructor(address token0, address token1) LPToken("LPToken", "LPT") {
        factory = msg.sender; // 记录创建者（工厂合约）地址
        i_token0 = IERC20(token0);
        i_token1 = IERC20(token1);

        i_token0_address = token0;
        i_token1_address = token1;
    }

    //计算代币兑换的输出数量
    //tokenIn是输入代币地址
    //amountIn是输入代币数量
    //tokenOut是输出代币地址
    function getAmountOut(
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) public view returns (uint256) {
        uint256 balanceOut = tokenBalances[tokenOut];//输出代币当前的余额   
        uint256 balanceIn = tokenBalances[tokenIn];//输入兑换的币当前的余额
        //恒定乘积公式 池中代币数量乘积k不变
        //B代币存量，A代表兑换量
        //balanceOut * balanceIn = k
        //k/（balanceIn+amountIn）为输出代币在池中的量
        //balanceout - k/（balanceIn+amountIn）为输出代币的量；通分后得到下式
        uint256 amountOut = (balanceOut * amountIn) / (balanceIn + amountIn);

        return amountOut;
    }

    function swap(
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) public nonReentrant {
        // input validity checks
        //检查输入、输出的代币和定义的代币是否相同
        require(tokenIn != tokenOut, "Same tokens");
        require(
            tokenIn == i_token0_address || tokenIn == i_token1_address,
            "Invalid token"
        );
        require(
            tokenOut == i_token0_address || tokenOut == i_token1_address,
            "Invalid token"
        );
        require(amountIn > 0, "Zero amount");

        //getAmountOut函数计算代币兑换的输出数量
        uint256 amountOut = getAmountOut(tokenIn, amountIn, tokenOut);

        // swapping tokens
        //msg.sender是当前调用合约的账户地址
        //require函数用于检查代币转移是否成功
        require(
            IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn),
            "Swap Failed"
        );
        require(
            IERC20(tokenOut).transfer(msg.sender, amountOut),
            "Swap Failed"
        );

        // update pool balances
        tokenBalances[tokenIn] += amountIn;
        tokenBalances[tokenOut] -= amountOut;
        //emit事件，用于记录代币交换操作
        emit Swapped(tokenIn, amountIn, tokenOut, amountOut);
    }

    //计算添加流动性所需的token1数量
    //amount0是添加的token0数量
    function getRequiredAmount1(uint256 amount0) public view returns (uint256) {
        uint256 balance0 = tokenBalances[i_token0_address];
        uint256 balance1 = tokenBalances[i_token1_address];

        if (balance0 == 0 || balance1 == 0) {
            return amount0 * INITIAL_RATIO;
        }
        //返回可以兑换的token1数量
        return (amount0 * balance1) / balance0;
    }

    function addLiquidity(uint256 amount0) public nonReentrant {
        // input validity check
        //amount0是添加的token0数量
        require(amount0 > 0, "Amount must be greater than 0");

        // calculate and mint liquidity tokens
        uint256 amount1 = getRequiredAmount1(amount0);
        uint256 amountLP;
        //totalsupply()是LPToken的总供应量，ERC20标准接口
        if (totalSupply() > 0) {
            amountLP =
                (amount0 * totalSupply()) /
                tokenBalances[i_token0_address] ;
        } else {
            //首次添加流动性，amountLP等于amount0
            amountLP = amount0;
        }
        _mint(msg.sender, amountLP);//铸造LP代币

        // deposit token0
        require(
            i_token0.transferFrom(msg.sender, address(this), amount0),
            "Transfer Alpha failed"
        );
        tokenBalances[i_token0_address] += amount0;

        // deposit token1
        require(
            i_token1.transferFrom(msg.sender, address(this), amount1),
            "Transfer Beta failed"
        );
        tokenBalances[i_token1_address] += amount1;

        emit AddedLiquidity(
            amountLP,
            i_token0_address,
            amount0,
            i_token1_address,
            amount1
        );
    }

    // function to withdraw liquidity
    //销毁LP代币，并转移代币
    // todo: infinite zhou: 确认参数数量
    function withdrawingliquidity(uint256 amount0) public {
        // input validity check
        require(amount0 > 0, "Amount must be greater than 0");

        // calculate and mint liquidity tokens
        uint256 amount1 = getRequiredAmount1(amount0);

        // calculate and burn liquidity tokens
        uint256 amountLP = (amount0 * totalSupply()) /
            tokenBalances[i_token0_address];
        _burn(msg.sender, amountLP);

        // withdraw token0
        require(
            i_token0.transfer(msg.sender, amount0),
            "Transfer Alpha failed"
        );
        tokenBalances[i_token0_address] -= amount0;

        // withdraw token1
        require(i_token1.transfer(msg.sender, amount1), "Transfer Beta failed");
        tokenBalances[i_token1_address] -= amount1;

        emit WithdrawLiquidity(
            amountLP,
            i_token0_address,
            amount0,
            i_token1_address,
            amount1
        );
    }

    //测试不过，提示补充此函数
    //getReserves函数返回池中代币的余额和LPToken的总供应量
    function getReserves()
        public
        view
        returns (uint256, uint256, uint256)
    {
        return (
            i_token0.balanceOf(address(this)),
            i_token1.balanceOf(address(this)),
            totalSupply()
        );
    }
}
