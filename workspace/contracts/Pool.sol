// SPDX-License-Identifier: MIT
//Pool合约用于创建流动性池
//流动性池是用于存储和交换三种ERC20代币的合约
//该合约继承自LPToken合约
//LPToken是用于表示流动性池中代币份额的代币

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LPToken.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract Pool is LPToken, ReentrancyGuard {

    // token 对象
    IERC20[] public  i_tokens;
    // token 地址
    address[] public  i_tokens_addresses;
    // token map（k: address -> v: index in i_tokens）
    mapping(address => uint256) public i_tokens_map;

    // 在这里添加 factory 变量声明
    address public  factory;

    //初始比例为1:2:3，即1个token0需要2个token1和3个token2
    //可以修改初始比例
    // todo & fixme:@infinite-zhou, 更改为可变比率
    // uint256 constant INITIAL_RATIO_1 = 2; //token0:token1 = 1:2
    // uint256 constant INITIAL_RATIO_2 = 3; //token0:token2 = 1:3
    uint256[] public  INITIAL_RATIO = [1, 2,3];
    
    //tokenBalances是一个映射，用于存储每个代币的余额
    //key是代币地址，value是代币余额
    mapping(address => uint256) public tokenBalances;
    

    //事件用于记录流动性池中的代币添加和交换操作
    event AddedLiquidity(
        address[] token_add,
        uint256[] amounts
    );

    event WithdrawLiquidity(
        address[] token_add,
        uint256[] amounts
    );

    event Swapped(
        address tokenIn,
        uint256 indexed amountIn,
        address tokenOut,
        uint256 indexed amountOut
    );

    //构造函数，用于初始化流动性池
    //token0, token1和token2是流动性池中的三种代币
    //LPToken是用于表示流动性池中代币份额的代币
    constructor(address[] memory tokens_add) LPToken("LPToken", "LPT") {
        factory = msg.sender; // 记录创建者（工厂合约）地址
        uint256 length = tokens_add.length;
        i_tokens = new IERC20[](length);
        i_tokens_addresses = new address[](length);

        for (uint256 i = 0; i < length; i++) {
            
            address token_add = tokens_add[i];
            
            // 或者调用代币合约
            i_tokens[i] = (IERC20(token_add));
            i_tokens_addresses[i] = (token_add);
            i_tokens_map[token_add] = i;
            tokenBalances[token_add] = 0;
        }
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
        
        // 对于三种代币的流动性池，我们仍然使用恒定乘积公式，但只针对交易涉及的两种代币
        // 保持交易对的交易逻辑不变
        uint256 amountOut = (balanceOut * amountIn) / (balanceIn + amountIn);

        return amountOut;
    }

    function swap(
        address tokenIn,
        uint256 amountIn,
        address tokenOut
    ) public nonReentrant {
        // input validity checks
        require(tokenIn != tokenOut, "Same tokens");
        require(i_tokens_map[tokenIn] != 0, "tokenIn not in i_tokens_map");
        require(i_tokens_map[tokenOut] != 0, "tokenOut not in i_tokens_map");
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

    //计算添加流动性所需的token1和token2数量
    //amount0是添加的token0数量
    function getRequiredAmounts(uint256 amount0) public view returns (uint256[] memory) {
        
        // todo: infinite-zhou 改为根据数组
        
        uint256 length = i_tokens_addresses.length;
        uint256[] memory return_amount = new uint256[](length);
        uint256 balance0 = tokenBalances[i_tokens_addresses[0]];

        for (uint256 i = 1; i < length; i++) {
            
            address token_add = i_tokens_addresses[i];
            uint256 balan = tokenBalances[token_add];
            uint256 amount;
            if (balan == 0) {
                amount = amount0 * INITIAL_RATIO[i];
            }
            else{
                amount = (amount0 *balance0 ) /  balan;
            }
            return_amount[i] = amount;
        }
        return_amount[0] = amount0;
        return return_amount;

    }

    function addLiquidity(address[] memory token_add, uint256[] memory amounts) public nonReentrant {
        require( token_add.length == amounts.length, "the lens of amount and token_add should be equal");

        uint256 amountLP;
        //totalsupply()是LPToken的总供应量，ERC20标准接口
        // todo: @infinite-zhou 搞清楚这里的amountLP究竟是多少
        if (totalSupply() > 0) {
            amountLP =
                (amounts[0] * totalSupply()) /
                tokenBalances[i_tokens_addresses[0]] ;
        } else {
            //首次添加流动性，amountLP等于amount0
            amountLP = amounts[0];
        }
        _mint(msg.sender, amountLP);//铸造LP代币
        
        uint256 length = token_add.length;
        for (uint256 i = 0; i < length; i++) {
            
            address i_token_addr = token_add[i];
            uint index = i_tokens_map[i_token_addr];
            IERC20 i_token = i_tokens[index];

            require(
                i_token.transferFrom(msg.sender, address(this), amounts[i]),
                "Transfer token0 failed"
            );
            tokenBalances[i_token_addr] += amounts[i];
        }

        emit AddedLiquidity(
            token_add, amounts
        );
    }

    // function to withdraw liquidity
    //销毁LP代币，并转移代币
    function withdrawingliquidity(address[] memory token_add, uint256[] memory amounts) public {
        require( token_add.length == amounts.length, "the lens of amount and token_add should be equal");

        uint256 amountLP;
        //totalsupply()是LPToken的总供应量，ERC20标准接口
        // todo: @infinite-zhou 搞清楚这里的amountLP究竟是多少
        if (totalSupply() > 0) {
            amountLP =
                (amounts[0] * totalSupply()) /
                tokenBalances[i_tokens_addresses[0]] ;
        } else {
            //首次添加流动性，amountLP等于amount0
            amountLP = amounts[0];
        }
        _burn(msg.sender, amountLP);//铸造LP代币
        
        uint256 length = token_add.length;
        for (uint256 i = 0; i < length; i++) {
            
            address i_token_addr = token_add[i];
            uint index = i_tokens_map[i_token_addr];
            IERC20 i_token = i_tokens[index];

            require(
                i_token.transferFrom(msg.sender, address(this), amounts[i]),
                "Transfer token0 failed"
            );
            tokenBalances[i_token_addr] -= amounts[i];
        }

        emit WithdrawLiquidity(
            token_add,
            amounts
        );
    }

    //getReserves函数返回池中代币的余额和LPToken的总供应量
    // function getReserves()
    //     public
    //     view
    //     returns (uint256, uint256, uint256, uint256)
    // {
    //     return (
    //         i_token0.balanceOf(address(this)),
    //         i_token1.balanceOf(address(this)),
    //         i_token2.balanceOf(address(this)),
    //         totalSupply()
    //     );
    // }
}
