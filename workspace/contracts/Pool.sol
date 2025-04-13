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
    uint256[] public  INITIAL_RATIO = [1, 2,3];
    
    //tokenBalances是一个映射，用于存储每个代币的余额
    //key是代币地址，value是代币余额
    mapping(address => uint256) public tokenBalances;

    // 费用相关变量
    uint256 public constant FEE_DENOMINATOR = 10000;
    uint256 public tradingFee = 30; // 0.3%
    mapping(address => uint256) public lpFee; // 单独存储交易费用
    mapping(address => uint256) public liquidityProviderIncentives; // LP激励池

    // 滑点控制相关常量
    uint256 public constant SLIPPAGE_DENOMINATOR = 10000;
    uint256 public constant MIN_SLIPPAGE = 10; // 最小0.1%
    uint256 public constant MAX_SLIPPAGE = 1000; // 最大10%
    uint256 public maxSlippage = 500; // 默认5%

    // 代币滑点限制映射
    mapping(address => uint256) public tokenMaxSlippage; // 各代币的滑点限制

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

    event IncentiveDistributed(
        address indexed recipient,
        uint256 amount,
        string incentiveType
    );

    event SlippageProtectionTriggered(
        address indexed user,
        string operation,
        address indexed token,
        uint256 expectedAmount,
        uint256 actualAmount,
        uint256 slippage
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
            i_tokens_map[token_add] = i + 1;  // 从 1 开始索引
            tokenBalances[token_add] = 0;
            lpFee[token_add] = 0; // 初始化 lpFee
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
        require(tokenIn != tokenOut, "Same tokens");
        require(amountIn > 0, "Zero input amount");
        
        uint256 balanceOut = tokenBalances[tokenOut];
        uint256 balanceIn = tokenBalances[tokenIn];
        
        require(balanceIn > 0 && balanceOut > 0, "Insufficient liquidity");
        
        // 计算交易费用
        uint256 fee = (amountIn * tradingFee) / FEE_DENOMINATOR;
        uint256 amountInAfterFee = amountIn - fee;

        // 对于三种代币的流动性池，我们仍然使用恒定乘积公式，但只针对交易涉及的两种代币
        // 保持交易对的交易逻辑不变
        uint256 amountOut = (balanceOut * amountInAfterFee) / (balanceIn + amountInAfterFee);
        require(amountOut > 0, "Zero output amount");
        require(amountOut <= balanceOut, "Insufficient output liquidity");

        return amountOut;
    }

    // 计算滑点
    function calculateSlippage(
        uint256 expectedAmount,
        uint256 actualAmount
    ) public pure returns (uint256) {
        if (actualAmount >= expectedAmount) return 0;
        return ((expectedAmount - actualAmount) * SLIPPAGE_DENOMINATOR) / expectedAmount;
    }

    // 设置最大滑点
    function setMaxSlippage(uint256 _maxSlippage) external {
        require(msg.sender == factory, "Only factory can set slippage");
        require(_maxSlippage <= MAX_SLIPPAGE, "Max slippage too high");
        require(_maxSlippage >= MIN_SLIPPAGE, "Max slippage too low");
        maxSlippage = _maxSlippage;
    }

    // 设置代币最大滑点
    function setTokenMaxSlippage(address token, uint256 _maxSlippage) external {
        require(msg.sender == factory, "Only factory can set token slippage");
        require(_maxSlippage <= MAX_SLIPPAGE, "Max slippage too high");
        require(_maxSlippage >= MIN_SLIPPAGE, "Max slippage too low");
        tokenMaxSlippage[token] = _maxSlippage;
    }

    // 修改 swap 函数，添加滑点保护
    function swap(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 minAmountOut  // 添加最小输出数量参数
    ) public nonReentrant {
        // input validity checks
        require(tokenIn != tokenOut, "Same tokens");
        require(i_tokens_map[tokenIn] > 0, "tokenIn not in pool");
        require(i_tokens_map[tokenOut] > 0, "tokenOut not in pool");
        require(amountIn > 0, "Zero amount");

        // Check balances
        uint256 balanceOut = tokenBalances[tokenOut];
        require(balanceOut > 0, "Insufficient output token liquidity");
        
        // 计算交易费用
        uint256 fee = (amountIn * tradingFee) / FEE_DENOMINATOR;
        uint256 amountInAfterFee = amountIn - fee;

        //getAmountOut函数计算代币兑换的输出数量
        uint256 amountOut = getAmountOut(tokenIn, amountIn, tokenOut);
        require(amountOut > 0, "Zero output amount");
        require(amountOut <= balanceOut, "Insufficient output token balance");

        // 计算预期输出数量
        uint256 expectedAmountOut = getAmountOut(tokenIn, amountIn, tokenOut);
        
        // 检查滑点
        uint256 slippage = calculateSlippage(expectedAmountOut, minAmountOut);
        require(slippage <= maxSlippage, "Slippage too high");
        require(expectedAmountOut >= minAmountOut, "Insufficient output amount");

        // swapping tokens
        require(
            IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn),
            "Transfer tokenIn failed"
        );

        // 将费用存入 lpFee
        lpFee[tokenIn] += fee;

        require(
            IERC20(tokenOut).transfer(msg.sender, amountOut),
            "Transfer tokenOut failed"
        );

        // update pool balances
        tokenBalances[tokenIn] += amountInAfterFee;
        tokenBalances[tokenOut] -= amountOut;
        
        emit Swapped(tokenIn, amountIn, tokenOut, amountOut);
    }

    function claimLpIncentives(address token) external {
        require(i_tokens_map[token] != 0, "Token not in pool");
        uint256 userLpShare = balanceOf(msg.sender);
        require(userLpShare > 0, "No LP tokens owned");

        uint256 totalLp = totalSupply();
        uint256 incentiveAmount = (liquidityProviderIncentives[token] * userLpShare) / totalLp;

        // 将 lpFee 中的费用分配给用户
        uint256 feeShare = (lpFee[token] * userLpShare) / totalLp;

        uint256 totalClaim = incentiveAmount + feeShare;
        require(totalClaim > 0, "No incentives to claim");
        
        // 更新激励池和 lpFee
        liquidityProviderIncentives[token] -= incentiveAmount;
        lpFee[token] -= feeShare;

        require(
            IERC20(token).transfer(msg.sender, totalClaim),
            "Incentive transfer failed"
        );
        tokenBalances[token] -= totalClaim;

        emit IncentiveDistributed(msg.sender, totalClaim, "LP_REWARD_CLAIM");
    }

    //计算添加流动性所需的token1和token2数量
    //amount0是添加的token0数量
    function getRequiredAmounts(uint256 amount0) public view returns (uint256[] memory) {
        
        uint256 length = i_tokens_addresses.length;
        uint256[] memory return_amount = new uint256[](length);
        uint256 balance0 = tokenBalances[i_tokens_addresses[0]];//输入的token0余额

        for (uint256 i = 1; i < length; i++) {
            
            address token_add = i_tokens_addresses[i];
            uint256 balan = tokenBalances[token_add];
            uint256 amount;
            if (balan == 0) {
                amount = amount0 * INITIAL_RATIO[i];
            }
            else{
                amount = (amount0 *balan ) /  balance0;
            }
            return_amount[i] = amount;
            // return_amount[i+3] = balan;
        }
        return_amount[0] = amount0;
        return return_amount;
    }

    // 计算几何平均数
    function geometricMean(uint256[] memory values) public pure returns (uint256) {
        require(values.length > 0, "Empty array");
        
        // 如果只有一个值，直接返回
        if (values.length == 1) {
            return values[0];
        }

        // 为了避免溢出，我们先将每个数除以一个合适的因子
        uint256[] memory scaledValues = new uint256[](values.length);
        for (uint256 i = 0; i < values.length; i++) {
            scaledValues[i] = values[i] / 1e18;
            require(scaledValues[i] > 0, "Value too small after scaling");
        }
        
        // 计算乘积的平方根
        if (values.length == 2) {
            uint256 sqrt = _sqrt(scaledValues[0] * scaledValues[1]);
            return sqrt * 1e18;
        }
        
        // 对于三个数，计算立方根
        if (values.length == 3) {
            uint256 product = scaledValues[0] * scaledValues[1];
            require(product / scaledValues[0] == scaledValues[1], "Multiplication overflow");
            product = product * scaledValues[2];
            require(product / scaledValues[2] > 0, "Multiplication overflow");
            
            uint256 cbrt = _cbrt(product);
            return cbrt * 1e18;
        }

        revert("Unsupported number of values");
    }

    // 计算平方根
    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    // 计算立方根
    function _cbrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        
        uint256 z = (x + 1) / 3;
        uint256 y = x;
        
        for (uint i = 0; i < 100 && z < y; i++) {
            y = z;
            z = (2 * z + x / (z * z)) / 3;
        }
        
        return y;
    }

    //findmin
    function findMin(uint256[] memory ratios) public pure returns (uint256) {
        uint256 minRatio = ratios[0];
        for (uint256 i = 1; i < ratios.length; i++) {
            if (ratios[i] < minRatio) {
                minRatio = ratios[i];
            }
        }
        return minRatio;
    }
    
    function addLiquidity(address[] memory token_add, uint256[] memory amounts) public nonReentrant {
        require( token_add.length == amounts.length, "the lens of amount and token_add should be equal");

        uint256 amountLP;
        if (totalSupply() > 0) {
            uint256[] memory ratios = new uint256[](amounts.length);
            for (uint i = 0; i < amounts.length; i++) {
                ratios[i] = (amounts[i]) / tokenBalances[i_tokens_addresses[i]];
            }
            uint256 minRatio = findMin(ratios);
            amountLP = (minRatio * totalSupply()) ;
        } else {
            // 首次添加流动性，使用几何平均数
            amountLP = geometricMean(amounts);
        }
        
        // 铸造LP代币
        _mint(msg.sender, amountLP);
        
        // 转移代币到池子
        uint256 length = token_add.length;
        for (uint256 i = 0; i < length; i++) {
            address i_token_addr = token_add[i];
            uint index = i_tokens_map[i_token_addr] - 1;  // 减 1 得到实际索引
            IERC20 i_token = i_tokens[index];

            require(
                i_token.transferFrom(msg.sender, address(this), amounts[i]),
                "Transfer token failed"
            );
            tokenBalances[i_token_addr] += amounts[i];
        }

        emit AddedLiquidity(
            token_add, amounts
        );
    }

    // function to withdraw liquidity
    function withdrawLiquidity(uint256 lpTokenAmount) public nonReentrant {
        require(lpTokenAmount > 0, "Cannot withdraw zero LP tokens");
        require(balanceOf(msg.sender) >= lpTokenAmount, "Insufficient LP token balance");

        // 计算提取比例 - 增加精度避免整数除法问题
        uint256 totalLp = totalSupply();
        uint256 ratio = (lpTokenAmount * 1e18) / totalLp;

        // 按比例提取所有代币
        uint256 length = i_tokens_addresses.length;
        address[] memory tokens = new address[](length);
        uint256[] memory withdrawAmounts = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            address tokenAddr = i_tokens_addresses[i];
            tokens[i] = tokenAddr;

            // 增加精度计算，避免取整问题
            uint256 amount = (tokenBalances[tokenAddr] * ratio) / 1e18;
            withdrawAmounts[i] = amount;

            // 确保金额大于0
            require(amount > 0, "Withdraw amount too small");

            // 先从池子余额减去
            tokenBalances[tokenAddr] -= amount;

            // 提取用户应得的 lpFee
            uint256 feeShare = (lpFee[tokenAddr] * lpTokenAmount) / totalLp;
            if (feeShare > 0) {
                lpFee[tokenAddr] -= feeShare; // 从总 lpFee 中扣除
                amount += feeShare; // 将手续费加入提取金额
            }

            // 转账给用户
            bool success = IERC20(tokenAddr).transfer(msg.sender, amount);
            require(success, "Token transfer failed");
        }

        // 销毁LP代币
        _burn(msg.sender, lpTokenAmount);

        emit WithdrawLiquidity(tokens, withdrawAmounts);
    }
    
    // 设置交易费率（仅允许合约所有者调用）
    function setTradingFee(uint256 _tradingFee) external {
        require(msg.sender == factory, "Only factory can set trading fee");
        require(_tradingFee <= 100, "Fee too high"); // 限制最高费率为 1%
        tradingFee = _tradingFee;
    }

    // 获取代币数组长度
    function getTokensLength() external view returns (uint256) {
        return i_tokens.length;
    }
}
